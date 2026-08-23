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
import { IconToggle } from './IconToggle';
import { OctaveSlider } from './OctaveSlider';
import type { useNoteDetail } from './useNoteDetail';

export interface TrackOptionsProps {
  detail: ReturnType<typeof useNoteDetail>;
  track: TrackName;
}

export function TrackOptions({
  detail,
  track
}: TrackOptionsProps): React.JSX.Element | null {
  if (track === 'chords') {
    return (
      <View style={styles.toggles}>
        {/* Which register the chords occupy, which is really a question about
            what you are listening on: a phone speaker has almost nothing an
            octave below middle C (INV-NOTES-039). */}
        <IconToggle
          testID="lift-chords"
          icon="speaker"
          offIcon="headphones"
          isOn={detail.chordsLifted}
          onChange={detail.toggleChordsLifted}
          label="Lift the chords for the phone speaker"
        />
      </View>
    );
  }

  if (track !== 'melody') {
    return null;
  }

  return (
    <>
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
