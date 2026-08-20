/**
 * Reading a transcript as a set of independent change requests.
 *
 * This goes through the `claude` CLI rather than the SDK for one practical
 * reason: the execute step already drives that binary, so the loop needs no
 * API key of its own and no second credential to keep working. One auth path,
 * already signed in.
 *
 * The prompt's job is mostly restraint. A spoken remark rambles, corrects
 * itself, and is sometimes not a request at all — so the model is told to
 * quote what it heard and to admit uncertainty rather than to be helpful.
 * An invented task is worse than a missed one (INV-DOG-007).
 *
 * Spec: dogfood.interpret_clip.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
// Imported by file rather than through the `shared` barrel: Node's ESM
// loader needs explicit extensions, and the barrel's own imports are
// extensionless for Metro's benefit. This is the only file the loop needs.
import type { BlastRadius, ScreenVisit } from '../../packages/shared/src/dto/dogfood.ts';

const run = promisify(execFile);

export interface Interpreted {
  summary: string;
  quote: string;
  route: string | null;
  confidence: number;
  blastRadius: BlastRadius;
  paths: string[];
}

const INSTRUCTIONS = `You are reading a spoken remark from the sole developer
of a React Native singing app about their own app, and splitting it into
independent change requests.

You are not a helpful assistant here. You are a careful transcriber of intent.

Rules:
- Split on distinct asks. One remark usually holds several, and each must stand
  alone — one being unsafe to act on must not hold up the others.
- Quote the span each request came from, verbatim. If the quote does not
  support the summary, the summary is wrong.
- Score confidence honestly, 0 to 1. Rambling, trailing off, self-correction
  and "maybe we could" all mean low confidence. A high score is a claim that
  acting on this unattended is safe.
- blastRadius: "javascript" for React/TypeScript under packages/; "native" for
  iOS, Android or the C++ engine; "infrastructure" for CI, release scripts,
  secrets or the update server; "unknown" when unsure. unknown is a real
  answer and a safe one.
- An observation with no ask ("this screen loads fast") is not a request.
  Return an empty list rather than manufacturing one.
- Set route to the screen the request is about, taken from the trail below by
  matching what was said against what was on show at that offset. Only use null
  when the request genuinely concerns no screen.
- Name the files you expect to change, repo-relative, when you can. The layout
  is: packages/client/src (the React Native app — screens/, components/,
  dogfood/, updates/, data/, audio/), packages/logic/src (pure DSP and music
  theory), packages/shared/src (types crossing the app, server and tooling),
  backend/ (PocketBase and the update Worker), scripts/ (release and tooling).
  There is no packages/app. Guessing a path that does not exist is worse than
  naming none, because the paths are checked against what must not be touched.

Reply with JSON only — no prose, no code fence — shaped:
{"requests":[{"summary":"","quote":"","route":null,"confidence":0,
"blastRadius":"javascript","paths":[]}]}`;

/** Strip a code fence if the model wrapped the JSON in one anyway. */
function parseRequests(raw: string): Interpreted[] {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < start) {
    return [];
  }
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
      requests?: Interpreted[];
    };
    return parsed.requests ?? [];
  } catch {
    // A reply we cannot read is not a reason to invent work.
    return [];
  }
}

/** Split one transcript into requests, in the order they were spoken. */
export async function interpret(
  transcript: string,
  trail: ScreenVisit[]
): Promise<Interpreted[]> {
  const context = trail.length
    ? trail.map((v) => `${Math.round(v.atMs / 1000)}s: ${v.route}`).join('\n')
    : '(no screens recorded)';

  const prompt =
    `${INSTRUCTIONS}\n\n` +
    `Screens on show while this was spoken, by offset:\n${context}\n\n` +
    `Use them to resolve which screen each request is about.\n\n` +
    `Transcript:\n${transcript}`;

  const { stdout } = await run('claude', ['-p', prompt], {
    timeout: 5 * 60 * 1000,
    maxBuffer: 10 * 1024 * 1024
  });
  return parseRequests(stdout);
}
