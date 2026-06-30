/**
 * Summary card for a finished take (WP-RESULTS-UI).
 *
 * Renders coarse, already-computed analysis stats — note count, duration, and an
 * optional pitch score vs. a reference melody. Purely presentational: it owns no
 * pipeline work and no per-frame state, so it is safe to re-render on coarse
 * transitions only.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { PitchScore } from 'logic';

import { useTheme } from '../../theme';

export interface ScoreCardProps {
  /** Number of segmented notes in the take. */
  noteCount: number;
  /** Total take duration in milliseconds. */
  durationMs: number;
  /** Pitch score vs. the target melody, or null when unscored. */
  score: PitchScore | null;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function Stat(props: {
  label: string;
  value: string;
  color: string;
  muted: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: props.color }]}>{props.value}</Text>
      <Text style={[styles.statLabel, { color: props.muted }]}>{props.label}</Text>
    </View>
  );
}

export function ScoreCard({ noteCount, durationMs, score }: ScoreCardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.neutral100, borderColor: colors.neutral500 }
      ]}
      accessibilityRole="summary"
    >
      {score != null ? (
        <View style={styles.scoreBlock}>
          <Text
            style={[styles.score, { color: colors.primary500 }]}
            accessibilityLabel={`Pitch score ${score.score} out of 100`}
          >
            {score.score}
          </Text>
          <Text style={[styles.scoreUnit, { color: colors.gray300 }]}>/ 100</Text>
        </View>
      ) : (
        <Text style={[styles.noScore, { color: colors.gray300 }]}>No reference melody</Text>
      )}

      <View style={styles.row}>
        <Stat
          label="Notes"
          value={String(noteCount)}
          color={colors.typography}
          muted={colors.gray300}
        />
        <Stat
          label="Length"
          value={formatDuration(durationMs)}
          color={colors.typography}
          muted={colors.gray300}
        />
        {score != null ? (
          <Stat
            label="In tune"
            value={`${Math.round(score.inTuneRatio * 100)}%`}
            color={colors.typography}
            muted={colors.gray300}
          />
        ) : null}
      </View>
    </View>
  );
}

export default ScoreCard;

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 16
  },
  scoreBlock: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  score: { fontSize: 56, fontWeight: '700', lineHeight: 60 },
  scoreUnit: { fontSize: 18, marginBottom: 10 },
  noScore: { fontSize: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 22, fontWeight: '600' },
  statLabel: { fontSize: 12, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }
});
