/**
 * The agent's grant — INV-DOG-017.
 *
 * This exists because its absence cost a day. The loop ran with no grant at
 * all, so every edit the agent proposed was refused and every run reported
 * building nothing, which is indistinguishable from having nothing to build.
 */
import {
  AGENT_EDIT_TOOLS,
  agentAllowedTools,
  agentPermissionArgs
} from '../dto/dogfoodAgent';

describe('the agent grant', () => {
  it('INV-DOG-017: lets the agent write', () => {
    // The whole bug in one assertion.
    expect(AGENT_EDIT_TOOLS).toContain('Edit');
    expect(AGENT_EDIT_TOOLS).toContain('Write');
  });

  it('accepts edits without asking, because nobody is there to ask', () => {
    expect(agentPermissionArgs()).toEqual(
      expect.arrayContaining(['--permission-mode', 'acceptEdits'])
    );
  });

  it('allows the shell only what verifying a change needs', () => {
    const tools = agentAllowedTools();
    expect(tools).toContain('Bash(yarn *)');
    // Unscoped Bash would reach the whole machine, where the maintainer's
    // credentials live. The worktree bounds edits; it does not bound a shell.
    expect(tools.split(',')).not.toContain('Bash');
  });

  it('never lets the agent commit', () => {
    // An agent that commits leaves a clean tree, which the loop reads as
    // having changed nothing — the failure this whole file exists to prevent.
    const shell = agentAllowedTools();
    expect(shell).not.toMatch(/Bash\(git commit/);
    expect(shell).not.toMatch(/Bash\(git push/);
    expect(shell).not.toMatch(/Bash\(git \*/);
  });
});
