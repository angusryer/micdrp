/**
 * What belongs to one track, under that track's own level.
 *
 * The sheet used to be a column of unrelated switches with the tracks above
 * them, so nothing said which control was about which line. Everything that
 * belongs to a track now sits in that track's card: a row of glyph toggles
 * under its level, and a register slider where the track is a melodic line
 * that can be moved (INV-NOTES-082).
 *
 * The transport draws the cards, since it is the thing that honours them, and
 * asks this for the contents — so PlaybackBar never learns what an octave or
 * a reading is.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { TrackName } from './playbackTracks';
import { trackSpec } from './trackRegistry';
import { VoicePicker } from './VoicePicker';
import { IconToggle } from './IconToggle';
import { OctaveSlider } from './OctaveSlider';
import type { useNoteDetail } from './useNoteDetail';

/**
 * How far the chords may move.
 *
 * Two either way covers what it is for: a backdrop voiced where a piano would
 * put it is inaudible on a phone, and one or two octaves up is the whole of
 * the fix (INV-NOTES-039).
 */
const CHORD_OCTAVE_RANGE = { down: 2, up: 2 };

export interface TrackOptionsProps {
  detail: ReturnType<typeof useNoteDetail>;
  track: TrackName;
}

export function TrackOptions({
  detail,
  track
}: TrackOptionsProps): React.JSX.Element | null {
  // What this track sounds like, above whatever else it carries. Every track
  // the engine synthesizes has one; a recording sounds like what was recorded
  // (INV-NOTES-144).
  const voice =
    trackSpec(track).role === 'recording' ? null : (
      <VoicePicker
        voice={detail.listening.voices[track]}
        onChange={(next) => detail.listening.setVoice(track, next)}
      />
    );

  if (track === 'chords') {
    // Lifting the chords for the phone speaker was only ever moving them by
    // an octave, said as a listening choice. Said as what it is, it is the
    // same control the other lines have (INV-NOTES-039).
    return (
      <>
        {voice}
        <OctaveSlider
          octaves={detail.chordOctaves}
          range={CHORD_OCTAVE_RANGE}
          onChange={detail.setChordOctaves}
          label="Chord octave"
        />
      </>
    );
  }

  if (track !== 'melody') {
    return voice;
  }

  return (
    <>
      {voice}
      <View style={styles.toggles}>
        {/* Heard on the beat grid rather than where it was sung. A wrong snap
            is inaudible in a short take and plain in the picture, which is
            why the two are asked separately (INV-NOTES-026). */}
        <IconToggle
          testID="hear-on-grid"
          icon="grid"
          isOn={detail.playbackMode === 'as-notated'}
          onChange={(on) =>
            detail.setPlaybackMode(on ? 'as-notated' : 'as-sung')
          }
          isDisabled={!detail.hasGrid}
          label="Align to the nearest beat when heard"
        />
        {/* And drawn that way. Reading the notation while hearing the raw
            take is how you tell which of the two is wrong. */}
        <IconToggle
          testID="see-on-grid"
          icon="eye"
          isOn={detail.notationView === 'as-notated'}
          onChange={(on) =>
            detail.setNotationView(on ? 'as-notated' : 'as-sung')
          }
          isDisabled={!detail.canNotate}
          label="Draw it on the beat grid"
        />
        {/* Sounding a pitch as a drag crosses it makes the drag its own
            audition (INV-NOTES-070). */}
        <IconToggle
          testID="hear-while-dragging"
          icon="speaker"
          offIcon="speakerOff"
          isOn={detail.isDragAudible}
          onChange={detail.setIsDragAudible}
          label="Hear notes while dragging them"
        />
      </View>
      {/* One movement rather than seven presses, centred on the take's own
          register (INV-NOTES-058). */}
      <OctaveSlider
        octaves={detail.octaves}
        range={detail.octaveRange}
        onChange={(octaves) => detail.setOctaves(octaves)}
      />
    </>
  );
}

export default TrackOptions;

const styles = StyleSheet.create({
  toggles: { flexDirection: 'row', gap: 8, marginTop: 10 }
});
