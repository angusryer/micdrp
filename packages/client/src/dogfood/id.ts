/**
 * Clip identifiers.
 *
 * Generated on the device rather than by the server, because a clip exists —
 * and has to be tracked through the upload queue — before any server has seen
 * it. Time-ordered so a queue sorts by when it was spoken.
 */
let counter = 0;

export function newClipId(): string {
  counter += 1;
  const stamp = Date.now().toString(36);
  const seq = counter.toString(36).padStart(3, '0');
  const noise = Math.floor(Math.random() * 0xffff).toString(36);
  return `${stamp}-${seq}-${noise}`;
}
