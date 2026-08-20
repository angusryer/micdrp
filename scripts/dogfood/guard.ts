/**
 * The three things that keep an unattended loop from doing damage: one run at
 * a time, a count of how badly it is going, and a way to stop it.
 *
 * Split from loop.ts, which owns the work itself.
 *
 * Spec: INV-DOG-010, INV-DOG-020.
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const REPO = new URL('../..', import.meta.url).pathname;
const HALT_FILE = join(REPO, '.dogfood-halt');
const LOCK_FILE = join(REPO, '.dogfood-lock');

/**
 * Take the run lock, or report that another run holds it.
 *
 * launchd starts a run on its interval whether or not the previous one has
 * finished, and a run can take many minutes — it builds and runs preflight.
 * Two concurrent runs would fight over the working tree, which is the one
 * thing INV-DOG-009 promises will not happen.
 *
 * The lock holds a process id, not a timestamp. An elapsed-time threshold
 * has to guess how long a run may legitimately take, and the guess was
 * wrong: a clip carrying four requests takes about half an hour, which was
 * exactly the threshold, so a healthy run began outliving its own lock. Ask
 * the operating system whether the holder is alive instead of estimating.
 */
export function takeLock(): boolean {
  if (existsSync(LOCK_FILE)) {
    const holder = Number(readFileSync(LOCK_FILE, 'utf8')) || 0;
    if (holder > 0 && isAlive(holder)) {
      return false;
    }
    // A run that died leaves its lock behind; do not strand the loop forever.
  }
  writeFileSync(LOCK_FILE, String(process.pid));
  return true;
}

/** Whether a process still exists. Signal 0 checks without delivering. */
function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means it exists and belongs to someone else, which still counts.
    return (error as { code?: string }).code === 'EPERM';
  }
}

export function releaseLock(): void {
  try {
    unlinkSync(LOCK_FILE);
  } catch {
    // Already gone. Nothing to do.
  }
}

/** How many failed runs in a row before the loop stops itself. */
export const HALT_AFTER = 3;

/**
 * The failure count lives on disk, not in memory.
 *
 * Scheduled runs are separate processes: launchd starts a fresh one each
 * interval, so an in-memory counter resets every time and the halt after
 * repeated failure would never fire — the loop would fail forever, quietly,
 * which is precisely what INV-DOG-010 exists to prevent.
 */
const FAILURES_FILE = join(REPO, '.dogfood-failures');

export function readFailures(): number {
  try {
    return Number(readFileSync(FAILURES_FILE, 'utf8')) || 0;
  } catch {
    return 0;
  }
}

export function writeFailures(count: number): void {
  writeFileSync(FAILURES_FILE, String(count));
}

export function isHalted(): string | null {
  return existsSync(HALT_FILE) ? readFileSync(HALT_FILE, 'utf8').trim() : null;
}

export function halt(reason: string): void {
  writeFileSync(HALT_FILE, reason);
  console.error(`dogfood: halted — ${reason}`);
  console.error('dogfood: run `yarn dogfood resume` once it is understood.');
}
