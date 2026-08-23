/**
 * PlaybackMixToggle — which tracks the transport sounds.
 *
 * One toggle per track, shown at once rather than cycled through: a singer
 * comparing their line against the harmony it implied, or against what was read
 * out of it, needs to see which tracks are sounding, not press until it is
 * right. Only the turning is here; the transport that honours it is
 * usePlaybackMix (INV-NOTES-019).
 *
 * A toggle that would leave nothing sounding — or the melody with no take under
 * it — is drawn dimmed and does not take a press (`isTrackLocked`).
 *
 * The row the readings now sit under in the same list (INV-NOTES-026), which is
 * why the pill itself is TogglePill rather than a private one.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTranslation } from '../../i18n';
import { TogglePill } from './TogglePill';
import {
  isTrackLocked,
  TRACK_ORDER,
  type PlaybackMix,
  type TrackName
} from './playbackTracks';

export interface PlaybackMixToggleProps {
  value: PlaybackMix;
  onChange: (mix: PlaybackMix) => void;
  /** The tracks this note has. One the note lacks is not offered at all. */
  offered: readonly TrackName[];
}

export function PlaybackMixToggle({
  value,
  onChange,
  offered
}: PlaybackMixToggleProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <View
      accessibilityRole="toolbar"
      accessibilityLabel={t('notes.mix.label')}
      style={styles.row}
    >
      {TRACK_ORDER.filter((track) => offered.includes(track)).map((track) => (
        <TogglePill
          key={track}
          label={t(`notes.mix.${track}`)}
          isOn={value[track]}
          isDisabled={isTrackLocked(track, value)}
          onPress={() => onChange({ ...value, [track]: !value[track] })}
        />
      ))}
    </View>
  );
}

export default PlaybackMixToggle;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 }
});
