/**
 * Sing the bassline you heard under the tune.
 *
 * The take plays and you sing over it, which is the whole idea: the harmony a
 * melody only implies is something the singer already knows and can simply
 * perform (INV-NOTES-071).
 *
 * The reported alignment is shown rather than hidden. It is a correction
 * applied to a real performance, and a correction nobody can see cannot be
 * found to be wrong (INV-NOTES-074) — if a layer reads late, that number is
 * the first place to look.
 */
import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import type { NoteLayerDto } from 'shared';

import { useTheme } from '../../theme';

export interface LayerControlProps {
  layers: readonly NoteLayerDto[];
  isRecording: boolean;
  alignedByMs: number | null;
  onStart: () => void;
  onStop: () => void;
  onMuteChange: (layerId: string, isMuted: boolean) => void;
}

export function LayerControl({
  layers,
  isRecording,
  alignedByMs,
  onStart,
  onStop,
  onMuteChange
}: LayerControlProps): React.JSX.Element {
  const { colors } = useTheme();
  const bass = layers.find((layer) => layer.role === 'bass');

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={[styles.title, { color: colors.typography }]}>
          Hum a bass line
        </Text>
        {/* A record button, which is a red circle everywhere — squared off
            while it is running, the way every transport says the same thing. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isRecording ? 'Finish the bass line' : 'Hum a bass line'
          }
          onPress={isRecording ? onStop : onStart}
          hitSlop={8}
          style={({ pressed }) => [styles.record, { opacity: pressed ? 0.6 : 1 }]}
        >
          <View
            style={[
              styles.dot,
              {
                backgroundColor: colors.error,
                borderRadius: isRecording ? 3 : DOT / 2,
                width: isRecording ? DOT * 0.72 : DOT,
                height: isRecording ? DOT * 0.72 : DOT
              }
            ]}
          />
        </Pressable>
      </View>

      {bass ? (
        <View style={styles.row}>
          <View style={styles.labels}>
            <Text style={[styles.title, { color: colors.gray500 }]}>
              Hear the bass line
            </Text>
            {/* What was subtracted, and why it is not nothing. */}
            <Text style={[styles.hint, { color: colors.gray300 }]}>
              {bass.alignedByMs > 0
                ? `Moved ${Math.round(bass.alignedByMs)} ms earlier, for the round trip`
                : 'No round trip was reported, so nothing was corrected'}
            </Text>
          </View>
          <Switch
            testID="hear-bass-layer"
            accessibilityLabel="Hear the bass line"
            value={!bass.isMuted}
            onValueChange={(on) => onMuteChange(bass.id, !on)}
          />
        </View>
      ) : null}

      {alignedByMs != null && !bass ? (
        <Text style={[styles.hint, { color: colors.gray300 }]}>
          {`Round trip measured at ${Math.round(alignedByMs)} ms`}
        </Text>
      ) : null}
    </View>
  );
}

export default LayerControl;

/** The record dot's diameter at rest. */
const DOT = 18;

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 12
  },
  labels: { flexShrink: 1 },
  title: { fontSize: 14, fontWeight: '600' },
  hint: { fontSize: 11, marginTop: 2, lineHeight: 15 },
  record: { padding: 6 },
  dot: {}
});
