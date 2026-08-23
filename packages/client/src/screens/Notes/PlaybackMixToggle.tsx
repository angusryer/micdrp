/**
 * PlaybackMixToggle — which tracks the play control beside it sounds.
 *
 * One toggle per track, shown at once rather than cycled through: a singer
 * comparing their line against the harmony it implied, or against what was read
 * out of it, needs to see which tracks are sounding, not press until it is
 * right. Only the turning is here; the transport that honours it is
 * usePlaybackMix (INV-NOTES-019).
 *
 * A toggle that would leave nothing sounding — or the melody with no take under
 * it — is drawn dimmed and does not take a press (`isTrackLocked`).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
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

/** One track's toggle: its name, filled when it is on, dimmed when locked. */
function TrackPill({
  label,
  isOn,
  isLocked,
  onPress
}: {
  label: string;
  isOn: boolean;
  isLocked: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: isOn, disabled: isLocked }}
      disabled={isLocked}
      onPress={onPress}
      style={[
        styles.option,
        isLocked && styles.locked,
        {
          backgroundColor: isOn ? colors.primary500 : colors.neutral100,
          borderColor: isOn ? colors.primary500 : colors.neutral500
        }
      ]}
    >
      <Text
        style={[styles.label, { color: isOn ? colors.white : colors.gray300 }]}
      >
        {label}
      </Text>
    </Pressable>
  );
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
        <TrackPill
          key={track}
          label={t(`notes.mix.${track}`)}
          isOn={value[track]}
          isLocked={isTrackLocked(track, value)}
          onPress={() => onChange({ ...value, [track]: !value[track] })}
        />
      ))}
    </View>
  );
}

export default PlaybackMixToggle;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth
  },
  locked: { opacity: 0.45 },
  label: { fontSize: 12, fontWeight: '600' }
});
