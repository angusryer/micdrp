/**
 * Which voice a track speaks in (INV-NOTES-144).
 *
 * A row of names rather than a slider or a wheel: there are five of them,
 * they are not ordered by anything, and picking one is a decision made by
 * ear — so the whole set has to be visible and one press away.
 *
 * Only for tracks the engine actually synthesizes. A recording sounds like
 * whatever was recorded, and offering to change its timbre would be offering
 * something the app cannot do.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { VOICES, type VoiceName } from '../../audio/voices';

export interface VoicePickerProps {
  voice: VoiceName;
  onChange: (voice: VoiceName) => void;
}

export function VoicePicker({
  voice,
  onChange
}: VoicePickerProps): React.JSX.Element {
  const { colors } = useTheme();
  const chosen = VOICES.find((one) => one.name === voice) ?? VOICES[0];

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {VOICES.map((one) => {
            const isChosen = one.name === voice;
            return (
              <Pressable
                key={one.name}
                accessibilityRole="radio"
                accessibilityState={{ selected: isChosen }}
                accessibilityLabel={one.title}
                testID={`voice-${one.name}`}
                onPress={() => onChange(one.name)}
                style={[
                  styles.pill,
                  {
                    backgroundColor: isChosen
                      ? colors.primary100
                      : colors.neutral100,
                    borderColor: isChosen ? colors.primary500 : colors.neutral500
                  }
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    { color: isChosen ? colors.primary500 : colors.gray300 }
                  ]}
                >
                  {one.title}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      {/* What the choice is for, in the words somebody choosing would use.
          A row of five names says nothing about which to pick. */}
      <Text style={[styles.hint, { color: colors.gray300 }]}>{chosen.hint}</Text>
    </View>
  );
}

export default VoicePicker;

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: 'row', gap: 6 },
  pill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  pillText: { fontSize: 13, fontWeight: '600' },
  hint: { fontSize: 12 }
});
