/**
 * The launchd job description.
 *
 * Split from schedule.ts, which owns installing and removing it.
 *
 * Everything here is explicit because launchd resolves nothing: absolute
 * paths, a named PATH, and no secrets. The plist is a world-readable file in
 * ~/Library/LaunchAgents, so writing tokens into it would copy every secret
 * out of the places built to hold them into one that is not.
 */
import { homedir } from 'node:os';
import { join } from 'node:path';

const REPO = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
export const LABEL = 'com.micdrp.dogfood';
export const PLIST = join(homedir(), 'Library/LaunchAgents', `${LABEL}.plist`);
export const LOG_DIR = join(homedir(), 'Library/Logs/micdrp');
const LOG = join(LOG_DIR, 'dogfood.log');

/**
 * What the scheduled run can find.
 *
 * Naming a PATH is not enough: it must resolve to the same tools the
 * maintainer's shell finds (INV-DOG-021). An earlier one found a python3,
 * just not the one carrying the YAML module, so spec validation tried to
 * install it and failed on a pip that was not there either — and every
 * change the loop made was discarded for a reason that never appeared when
 * anyone ran it by hand.
 *
 * pyenv first, by shim rather than by version, so it follows whatever this
 * project pins instead of a number that goes stale.
 */
export const SCHEDULED_PATH = [
  join(homedir(), '.pyenv/shims'),
  '/opt/homebrew/bin',
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
  join(homedir(), '.local/bin')
].join(':');

export function plist(intervalSeconds: number): string {
  // Absolute paths throughout: launchd resolves nothing. No secrets here.
  const env: Record<string, string> = {
    PATH: SCHEDULED_PATH,
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
