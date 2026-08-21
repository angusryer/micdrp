/** Formatting shared by NoteCard and its parts. */

/** Format ms duration as M:SS. */
export function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

/**
 * The line that sits directly above a card's play control (INV-NOTES-016).
 *
 * Pass the running position while the take plays and it reads as a counter
 * against the take's length; pass null in every other state and it is the
 * length alone. The position is bounded by the length, so a clock that has run
 * a shade past the last sample never reports more take than there was.
 */
export function formatPlaybackCounter(
  durationMs: number,
  positionMs: number | null
): string {
  if (positionMs == null) {
    return formatDuration(durationMs);
  }
  const heard = formatDuration(Math.min(Math.max(positionMs, 0), durationMs));
  return `${heard} / ${formatDuration(durationMs)}`;
}

/** Format a ms epoch timestamp as a short date. */
export function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
