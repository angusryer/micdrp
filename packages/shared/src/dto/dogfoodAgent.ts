/**
 * What the loop's coding agent is allowed to do.
 *
 * Policy, not plumbing — which is why it sits beside the gate rather than in
 * the script that spawns the agent. The gate decides whether a change may be
 * attempted; this decides what the thing attempting it can reach.
 *
 * Spec: INV-DOG-017.
 */

/** Editing is unrestricted: the worktree and the gate bound what it reaches. */
export const AGENT_EDIT_TOOLS = ['Read', 'Edit', 'Write', 'Glob', 'Grep'] as const;

/**
 * Shell access is not unrestricted.
 *
 * The worktree bounds what a bad edit reaches and the gate bounds what a diff
 * may contain, but neither bounds a shell command — that runs on the
 * maintainer's own machine, with their credentials in the environment. Only
 * what verifying a change actually needs is allowed.
 *
 * Committing is deliberately absent. Delivery is the loop's job, and an agent
 * that commits leaves a clean tree that reads as having changed nothing.
 */
export const AGENT_SHELL_TOOLS = [
  'Bash(yarn *)',
  'Bash(npx *)',
  'Bash(node *)',
  'Bash(sh scripts/*)',
  'Bash(./.harnex/*)',
  'Bash(harnex *)',
  'Bash(git status*)',
  'Bash(git diff*)',
  'Bash(git log*)'
] as const;

/** The full grant, as the CLI wants it. */
export function agentAllowedTools(): string {
  return [...AGENT_EDIT_TOOLS, ...AGENT_SHELL_TOOLS].join(',');
}

/**
 * Arguments that let the agent work at all.
 *
 * Without a grant it cannot write: every edit is refused, it exits zero
 * having explained itself, and an empty diff comes back looking like a
 * considered decision to change nothing. The loop ran a day on that
 * misreading and built nothing at all.
 */
export function agentPermissionArgs(): string[] {
  return ['--permission-mode', 'acceptEdits', '--allowedTools', agentAllowedTools()];
}
