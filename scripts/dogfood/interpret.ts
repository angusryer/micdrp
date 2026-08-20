/**
 * Reading a transcript as a set of independent change requests.
 *
 * The prompt's job is mostly restraint. A spoken remark is rambling, often
 * self-correcting, and sometimes not a request at all — the failure mode that
 * matters is inventing a confident task out of an aside, so the model is told
 * to quote what it heard and to say when it is unsure rather than to be
 * helpful (INV-DOG-007).
 *
 * Spec: dogfood.interpret_clip.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { ChangeRequestDto, ScreenVisit } from 'shared';

const client = new Anthropic();

const SYSTEM = `You read a spoken remark from the sole developer of a React
Native singing app about their own app, and split it into independent change
requests.

You are not a helpful assistant here. You are a careful transcriber of intent.

Rules:
- Split on distinct asks. One remark usually contains several; each must stand
  alone, because one being unsafe to act on must not hold up the others.
- Quote the span you got each request from, verbatim. If a quote does not
  support the summary you wrote, the summary is wrong.
- Score confidence honestly. Rambling, trailing off, self-correction, and
  "maybe we could" all mean low confidence. A high score is a claim that acting
  on this unattended is safe.
- Classify what the change would touch. javascript means React/TypeScript under
  packages/. native means iOS, Android, or the C++ engine. infrastructure means
  CI, release scripts, secrets, or the update server. unknown when unsure —
  unknown is a real answer and a safe one.
- An observation with no ask ("this screen loads fast") is not a request. Say
  so with an empty list rather than manufacturing one.
- Name the files you expect to change, repo-relative, when you can.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['requests'],
  properties: {
    requests: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['summary', 'quote', 'route', 'confidence', 'blastRadius', 'paths'],
        properties: {
          summary: { type: 'string', description: 'Imperative, one sentence' },
          quote: { type: 'string', description: 'Verbatim span from the transcript' },
          route: { type: ['string', 'null'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          blastRadius: {
            type: 'string',
            enum: ['javascript', 'native', 'infrastructure', 'unknown']
          },
          paths: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }
} as const;

type Interpreted = Omit<ChangeRequestDto, 'id' | 'clipId' | 'state'>;

/** Split one transcript into requests, in the order they were spoken. */
export async function interpret(
  transcript: string,
  trail: ScreenVisit[]
): Promise<Interpreted[]> {
  const context = trail.length
    ? trail.map((v) => `${Math.round(v.atMs / 1000)}s: ${v.route}`).join('\n')
    : '(no screens recorded)';

  const response = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: { type: 'json_schema', schema: SCHEMA } },
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content:
          `Screens on show while this was spoken, by offset:\n${context}\n\n` +
          `Use them to resolve which screen each request is about.\n\n` +
          `Transcript:\n${transcript}`
      }
    ]
  });

  const text = response.content.find((block) => block.type === 'text');
  if (!text || text.type !== 'text') {
    return [];
  }
  const parsed = JSON.parse(text.text) as { requests: Interpreted[] };
  return parsed.requests ?? [];
}
