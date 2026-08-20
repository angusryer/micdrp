/**
 * The loop's credentials: cached while a human is present, loaded when not.
 *
 * Split from schedule.ts, which owns the schedule itself.
 *
 * None of this reaches the plist. That file is world-readable in
 * ~/Library/LaunchAgents, and writing tokens into it would copy every secret
 * out of the places built to hold them into one that is not.
 */
import { execFile } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

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
/** Where the app login is cached for scheduled runs. Owner-readable only. */
export const CREDENTIALS_FILE = join(homedir(), '.micdrp-dogfood-credentials');

/**
 * Cache the app login so scheduled runs never invoke `op`.
 *
 * The 1Password CLI reads 1Password's own group container, and macOS treats
 * that as one app reaching into another's data — so every run raised
 * "node would like to access data from other apps". A prompt nobody is there
 * to answer stops the run dead, which is the same class of failure as the
 * whisper model living in Superwhisper's container.
 *
 * Written 0600, holding one application password. The service account token
 * already sitting in the shell profile can read the entire vault, so this is
 * not a widening of what a reader of this account could obtain.
 */
export async function cacheCredentials(): Promise<void> {
  const token = process.env.AI_MICDRP_RW;
  if (!token) {
    throw new Error('AI_MICDRP_RW is not set — cannot read the app login');
  }
  const item = 'op://micdrp/wi5e4xd6dl6zn6wyx7u4e5m3ra';
  const read = async (field: string): Promise<string> => {
    const { stdout } = await run('op', ['read', `${item}/${field}`], {
      env: { ...process.env, OP_SERVICE_ACCOUNT_TOKEN: token }
    });
    return stdout.trim();
  };

  const credentials = {
    DOGFOOD_EMAIL: await read('username'),
    DOGFOOD_PASSWORD: await read('password')
  };
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials), { mode: 0o600 });
}

/** Load the cached app login, when one has been written. */
export function loadCachedCredentials(): void {
  try {
    const cached = JSON.parse(readFileSync(CREDENTIALS_FILE, 'utf8')) as Record<
      string,
      string
    >;
    for (const [name, value] of Object.entries(cached)) {
      process.env[name] ??= value;
    }
  } catch {
    // Not cached. An interactive run falls back to `op`.
  }
}

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
