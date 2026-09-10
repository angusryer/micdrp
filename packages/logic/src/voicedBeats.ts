/**
 * The beat heard in the take rather than tapped into it (INV-NOTES-242).
 *
 * A thump, a tap or a hiss in the recording is somebody marking the beat
 * with their mouth while both hands were busy, and it says exactly what a
 * finger on the pad says. So it anchors the timeline the same way, and is
 * drawn in a colour of its own so the graph never claims a person tapped
 * something they sang.
 *
 * There is nothing to accept. Both are things the person did; asking for a
 * press before one counted would make somebody confirm their own singing
 * back to the app. What there is instead is throwing one away, which is
 * where dismissals come in.
 */
import type { Anchor } from './beatAnchors';
import type { TappedBeat } from './tappedBeats';

/** What a detected percussive sound looks like, as much as is needed here. */
export interface VoicedHit {
  atMs: number;
  confidence: number;
}

/**
 * How sure a sound must be before it is offered as a beat.
 *
 * A take is full of quiet noises — a breath, a chair, a lip parting — and a
 * beat placed on each of them is worse than no beats at all, because every
 * one has to be thrown away by hand. Set where a clear consonant passes and
 * room noise does not.
 */
const MIN_CONFIDENCE = 0.5;

/**
 * How near a dismissal has to be to count as the same sound, in ms.
 *
 * A re-read finds the same consonant a few milliseconds off, so an exact
 * instant would let every dismissed beat come back the next time the take
 * was read — the app overruling somebody about their own recording
 * (INV-NOTES-243). Wide enough to survive that, narrower than any plausible
 * gap between two real sounds.
 */
const SAME_SOUND_MS = 45;

/** Whether this sound is one that was already thrown away. */
export function isDismissed(
  atMs: number,
  dismissed: readonly number[]
): boolean {
  return dismissed.some((gone) => Math.abs(gone - atMs) <= SAME_SOUND_MS);
}

/**
 * Every beat a person put there, by finger or by mouth, in time order.
 *
 * Taps win where the two land on the same moment: somebody who tapped over
 * their own consonant has said the same thing twice, and two anchors a few
 * milliseconds apart would make a gap of almost nothing between them.
 */
export function anchorsFrom(
  taps: readonly TappedBeat[],
  hits: readonly VoicedHit[],
  dismissed: readonly number[] = []
): Anchor[] {
  const tapped: Anchor[] = taps.map((tap) => ({
    atMs: tap.atMs,
    isDownbeat: tap.isDownbeat
  }));
  const voiced: Anchor[] = hits
    .filter(
      (hit) =>
        hit.confidence >= MIN_CONFIDENCE &&
        !isDismissed(hit.atMs, dismissed) &&
        !tapped.some((tap) => Math.abs(tap.atMs - hit.atMs) <= SAME_SOUND_MS)
    )
    .map((hit) => ({ atMs: hit.atMs, isDownbeat: false, isVoiced: true }));

  return [...tapped, ...voiced].sort((a, b) => a.atMs - b.atMs);
}

/**
 * Throwing one away: a tap is deleted, a voiced beat is remembered as gone.
 *
 * Two different acts because the two are kept in different places. A tap
 * exists only in the list of taps, so removing it from that list is the
 * whole of it. A voiced beat is read out of the audio every time, so the
 * only way to keep it away is to write down that it went (INV-NOTES-243).
 */
export interface BeatRemoval {
  taps: TappedBeat[];
  dismissed: number[];
}

export function removeAnchor(
  anchors: readonly Anchor[],
  index: number,
  taps: readonly TappedBeat[],
  dismissed: readonly number[]
): BeatRemoval {
  const going = anchors[index];
  if (going == null) {
    return { taps: [...taps], dismissed: [...dismissed] };
  }
  if (going.isVoiced === true) {
    return {
      taps: [...taps],
      dismissed: isDismissed(going.atMs, dismissed)
        ? [...dismissed]
        : [...dismissed, going.atMs]
    };
  }
  return {
    taps: taps.filter((tap) => tap.atMs !== going.atMs),
    dismissed: [...dismissed]
  };
}
