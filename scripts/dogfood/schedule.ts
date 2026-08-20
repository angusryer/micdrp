/**
 * Running the loop unattended, on a schedule.
 *
 * launchd rather than a polling terminal: the point is that a remark spoken
 * on the way out of the door is acted on without anyone having left a shell
 * open. A launchd agent survives logout, reboot, and closing the laptop lid.
 *
 * A launchd job inherits almost no environment — not PATH, not the shell
 * profile — so a command that works in a terminal fails to find node,
 * whisper-cli or op when launchd runs it, silently and forever. PATH is
 * therefore named explicitly here.
 *
 * Credentials are NOT. The plist is a world-readable file in
 * ~/Library/LaunchAgents, and writing tokens into it copies every secret out
 * of the places built to hold them into one that is not. The run reads them
 * from the login profile at startup instead — see `loadProfileSecrets`.
 *
 * Spec: dogfood.schedule_loop.
 */
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

const REPO = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
const LABEL = 'com.micdrp.dogfood';
const PLIST = join(homedir(), 'Library/LaunchAgents', `${LABEL}.plist`);
const LOG_DIR = join(homedir(), 'Library/Logs/micdrp');
export const LOG = join(LOG_DIR, 'dogfood.log');

/** The secrets the loop needs, named so the run can find them itself. */
const SECRETS = [
  'AI_MICDRP_RW',
  'MICDRP_CLOUDFLARE_API_TOKEN',
  'MICDRP_CLOUDFLARE_ACCOUNT_ID'
] as const;

/**
 * Load the loop's credentials from the login profile into this process.
 *
 * Called at the start of a run rather than written into the plist. The plist
 * lives in ~/Library/LaunchAgents and is readable by anything running as this
 * user; putting tokens in it would copy every secret out of the keychain and
 * the shell profile into a plain file that nothing guards.
 */
export function loadProfileSecrets(): void {
  const zshrc = join(homedir(), '.zshrc');
  let lines: string[];
  try {
    lines = readFileSync(zshrc, 'utf8').split('\n');
  } catch {
    return;
  }
  for (const name of SECRETS) {
    if (process.env[name]) {
      continue;
    }
    const line = lines.find((l) => l.trim().startsWith(`export ${name}=`));
    if (line) {
      process.env[name] = line.slice(line.indexOf('=') + 1).replace(/^["']|["']$/g, '');
    }
  }
}

function plist(intervalSeconds: number): string {
  // Absolute paths throughout: launchd resolves nothing. No secrets here.
  const env: Record<string, string> = {
    PATH: '/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:' + join(homedir(), '.local/bin'),
    HOME: homedir(),
    BACKEND_URL: 'https://micdrp-backend.fly.dev'
  };

  const entries = Object.entries(env)
    .map(([k, v]) => `      <key>${k}</key>\n      <string>${v}</string>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${LABEL}</string>
    <key>ProgramArguments</key>
    <array>
      <string>/opt/homebrew/bin/node</string>
      <string>--experimental-strip-types</string>
      <string>${REPO}/scripts/dogfood/cli.ts</string>
      <string>--once</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${REPO}</string>
    <key>StartInterval</key>
    <integer>${intervalSeconds}</integer>
    <key>RunAtLoad</key>
    <false/>
    <key>StandardOutPath</key>
    <string>${LOG}</string>
    <key>StandardErrorPath</key>
    <string>${LOG}</string>
    <key>EnvironmentVariables</key>
    <dict>
${entries}
    </dict>
  </dict>
</plist>
`;
}

export async function install(intervalSeconds: number): Promise<void> {
  mkdirSync(LOG_DIR, { recursive: true });
  // Unload first so installing twice replaces rather than stacks.
  await run('launchctl', ['unload', PLIST]).catch(() => undefined);
  writeFileSync(PLIST, plist(intervalSeconds));
  await run('launchctl', ['load', PLIST]);
  console.log(
    `dogfood: running every ${intervalSeconds}s. Log: ${LOG}\n` +
      'Stop it with `yarn dogfood uninstall`.'
  );
}

export async function uninstall(): Promise<void> {
  if (!existsSync(PLIST)) {
    console.log('dogfood: no schedule installed.');
    return;
  }
  await run('launchctl', ['unload', PLIST]).catch(() => undefined);
  unlinkSync(PLIST);
  console.log('dogfood: schedule removed. Uploaded clips are untouched.');
}

export function isScheduled(): boolean {
  return existsSync(PLIST);
}
