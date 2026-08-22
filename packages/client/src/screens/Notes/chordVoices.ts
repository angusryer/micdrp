/**
 * chordVoices — splitting a voiced progression into the bass and the rest.
 *
 * The root sounds on its own bus so it can be mixed as the ground the harmony
 * stands on rather than as another note inside it (INV-NOTES-040). That means
 * two lists from one progression, and the chord list must not keep the note
 * the bass is already sounding.
 */
import {
  rootMidiAtOrAbove,
  voicedTones,
  type ChordPlayback,
  type ChordSlot
} from 'logic';

/**
 * The root of each chord on its own, at the same floor the chord uses, so the
 * bass and the harmony agree about where the music sits. A silenced root
 * yields nothing rather than a silent note — one decision, not two.
 */
export function rootsOnly(
  slots: readonly ChordSlot[],
  floorMidi: number
): ChordPlayback[] {
  return slots.map((slot) => {
    const root = voicedTones(
      rootMidiAtOrAbove(slot.rootPc, floorMidi),
      slot.quality,
      slot.voicing
    )[0];
    return {
      midi: root && !root.muted ? [root.midi] : [],
      startMs: slot.startMs,
      endMs: slot.endMs
    };
  });
}

/**
 * The chord without its root, since the root is sounding on its own bus and
 * doubling it there would just make the bass louder than it was mixed to be.
 */
export function withoutRoot(
  voiced: readonly ChordPlayback[],
  slots: readonly ChordSlot[],
  floorMidi: number
): ChordPlayback[] {
  return voiced.map((played, i) => {
    const slot = slots[i];
    if (!slot) {
      return played;
    }
    const rootMidi = rootMidiAtOrAbove(slot.rootPc, floorMidi);
    return { ...played, midi: played.midi.filter((m) => m !== rootMidi) };
  });
}
