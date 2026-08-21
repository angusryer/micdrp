/**
 * PlaybackMixToggle — what the play control beside it sounds.
 *
 * Three exclusive choices, shown at once rather than cycled through by a
 * single button: a singer comparing their line against the harmony it implied
 * needs to see which of the three they are hearing, not press until it is
 * right. Only the choice is here; the transport that honours it is
 * usePlaybackMix (INV-NOTES-019).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import type { PlaybackMix } from './usePlaybackMix';

const OPTIONS: ReadonlyArray<{ mix: PlaybackMix; labelKey: string }> = [
  { mix: 'take', labelKey: 'notes.mix.take' },
  { mix: 'chords', labelKey: 'notes.mix.chords' },
  { mix: 'both', labelKey: 'notes.mix.both' }
];

export interface PlaybackMixToggleProps {
  value: PlaybackMix;
  onChange: (mix: PlaybackMix) => void;
}

export function PlaybackMixToggle({
  value,
  onChange
}: PlaybackMixToggleProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('notes.mix.label')}
      style={styles.row}
    >
      {OPTIONS.map(({ mix, labelKey }) => {
        const selected = mix === value;
        return (
          <Pressable
            key={mix}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            onPress={() => onChange(mix)}
            style={[
              styles.option,
              {
                backgroundColor: selected ? colors.primary500 : colors.neutral100,
                borderColor: selected ? colors.primary500 : colors.neutral500
              }
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: selected ? colors.white : colors.gray300 }
              ]}
            >
              {t(labelKey)}
            </Text>
          </Pressable>
        );
      })}
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
  label: { fontSize: 12, fontWeight: '600' }
});
