/**
 * How the coding agent is invoked: what it is told, and what it may do.
 *
 * Split from execute.ts, which owns what happens around the agent — the
 * clean tree, the harness, the restore on failure.
 */
// Imported by file rather than through the `shared` barrel: Node's ESM
// loader needs explicit extensions, and the barrel's own imports are
// extensionless for Metro's benefit.
import type { ChangeRequestDto } from '../../packages/shared/src/dto/dogfood.ts';

/**
 * What the coding agent is allowed to do (INV-DOG-017).
 *
 * Without a grant it cannot write at all: every edit is refused, it exits
 * zero having explained itself, and an empty diff comes back looking like a
 * considered decision to change nothing. The loop ran a full day on that
 * misreading and built nothing.
 *
 * Editing is unrestricted; shell access is not. The worktree bounds what a
 * bad edit can reach, and the gate bounds what a diff may contain — but
 * neither bounds a shell command, which runs on the maintainer's own machine
 * with their credentials in the environment. So the shell is allowed only
 * the commands verifying a change actually needs.
 *
 * Committing is deliberately absent. Delivery is the loop's job, and an
 * agent that commits leaves a clean tree that reads as having done nothing.
 */
const AGENT_TOOLS = [
  'Read',
  'Edit',
  'Write',
  'Glob',
  'Grep',
  'Bash(yarn *)',
  'Bash(npx *)',
  'Bash(node *)',
  'Bash(sh scripts/*)',
  'Bash(./.harnex/*)',
  'Bash(harnex *)',
  'Bash(git status*)',
  'Bash(git diff*)',
  'Bash(git log*)'
].join(',');

export const AGENT_ARGS = ['--permission-mode', 'acceptEdits', '--allowedTools', AGENT_TOOLS];

/** Keep the agent's own account of a run; the loop must not guess at it. */
export function lastWords(output: string): string {
  const said = output.trim().split('\n').filter(Boolean).slice(-3).join(' ');
  return said.length > 300 ? `${said.slice(0, 297)}...` : said;
}

/** What the agent is asked to do, in the maintainer's own words. */
export function agentPrompt(request: ChangeRequestDto): string {
  return (
    `A spoken change request from the maintainer of this repository.\n\n` +
    `What they asked for: ${request.summary}\n` +
    `Their exact words: "${request.quote}"\n` +
    (request.route ? `The screen they were looking at: ${request.route}\n` : '') +
    `\nMake this change. Follow the repository's axioms: update the spec ` +
    `before the code, keep files under 150 lines, and run the harness. ` +
    `Do not touch signing material, secrets, CI, or the release scripts — ` +
    `if the change would need any of those, make no change at all and say ` +
    `why. Native code is fine to change; it simply ships as a build rather ` +
    `than over the air.\n\n` +
    `This was spoken aloud from memory while looking at a screen, so parts ` +
    `of the description may not match the code exactly. Where a detail is ` +
    `already true or simply wrong, do the parts that do apply rather than ` +
    `nothing. Only make no change at all if there is nothing here you can ` +
    `act on, and then say precisely what you looked at and why.`
  );
}
