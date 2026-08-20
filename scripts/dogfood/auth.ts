/**
 * Getting at the backend as the account the clips belong to.
 *
 * Clips are owner-scoped server-side, so the loop reads them as their owner
 * rather than as an administrator — it sees exactly what the maintainer sees
 * and nothing more.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import PocketBase from 'pocketbase';

const run = promisify(execFile);

export function connect(): PocketBase {
  const url = process.env.BACKEND_URL;
  if (!url) {
    throw new Error('BACKEND_URL is not set');
  }
  return new PocketBase(url);
}

/** The 1Password item holding the app login the clips belong to. */
const OP_ITEM = 'op://micdrp/wi5e4xd6dl6zn6wyx7u4e5m3ra';

/**
 * Read one field out of 1Password.
 *
 * Credentials come from the vault rather than the environment so there is no
 * plaintext password sitting in a shell profile. The AI_MICDRP_RW service
 * account is scoped to the micdrp vault and nothing else.
 */
async function fromVault(field: string): Promise<string> {
  const token = process.env.AI_MICDRP_RW ?? process.env.OP_SERVICE_ACCOUNT_TOKEN;
  if (!token) {
    throw new Error('AI_MICDRP_RW is not set — cannot read the app login');
  }
  const { stdout } = await run('op', ['read', `${OP_ITEM}/${field}`], {
    env: { ...process.env, OP_SERVICE_ACCOUNT_TOKEN: token }
  });
  return stdout.trim();
}

/**
 * Sign in as the account the clips belong to.
 *
 * Clips are owner-scoped server-side, so the loop reads them as their owner
 * rather than as an administrator — it sees exactly what the maintainer sees
 * and nothing more.
 */
export async function signIn(pb: PocketBase): Promise<void> {
  // The environment first, and `op` only as an interactive fallback. Reading
  // 1Password's container makes macOS prompt "node would like to access data
  // from other apps", and a scheduled run has nobody to answer it.
  const email = process.env.DOGFOOD_EMAIL ?? (await fromVault('username'));
  const password = process.env.DOGFOOD_PASSWORD ?? (await fromVault('password'));
  await pb.collection('users').authWithPassword(email, password);
}
