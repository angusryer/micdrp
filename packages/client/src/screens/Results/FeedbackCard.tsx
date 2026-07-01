/**
 * Coaching feedback card for a finished take (WP-CLIENT-ANALYSIS).
 *
 * Renders the on-device {@link FeedbackDto} synthesized by
 * `analysis/feedback.computeFeedback`: the detected key + tempo, and the
 * strengths / improvements / suggestions narrative. Purely presentational — it
 * owns no pipeline work and no per-frame state, so it re-renders only on coarse
 * transitions. The numeric score lives in {@link ScoreCard}; this card is the
 * qualitative companion to it.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { FeedbackDto } from 'shared';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';

export interface FeedbackCardProps {
  /** On-device feedback for the take. */
  feedback: FeedbackDto;
}

function Chip(props: { label: string; value: string; color: string; muted: string }) {
  return (
    <View style={styles.chip}>
      <Text style={[styles.chipLabel, { color: props.muted }]}>{props.label}</Text>
      <Text style={[styles.chipValue, { color: props.color }]}>{props.value}</Text>
    </View>
  );
}

function Section(props: {
  title: string;
  items: string[];
  bullet: string;
  titleColor: string;
  textColor: string;
}) {
  if (props.items.length === 0) {
    return null;
  }
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: props.titleColor }]}>
        {props.title}
      </Text>
      {props.items.map((item, index) => (
        <View key={`${index}:${item}`} style={styles.bulletRow}>
          <Text style={[styles.bullet, { color: props.titleColor }]}>{props.bullet}</Text>
          <Text style={[styles.bulletText, { color: props.textColor }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export function FeedbackCard({ feedback }: FeedbackCardProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.neutral100, borderColor: colors.neutral500 }
      ]}
      accessibilityRole="summary"
      accessibilityLabel={t('results.feedbackLabel')}
    >
      <View style={styles.chips}>
        <Chip
          label={t('results.key')}
          value={feedback.key ?? '—'}
          color={colors.typography}
          muted={colors.gray300}
        />
        <Chip
          label={t('results.tempo')}
          value={
            feedback.tempoBpm != null
              ? t('results.bpm', { value: feedback.tempoBpm })
              : '—'
          }
          color={colors.typography}
          muted={colors.gray300}
        />
      </View>

      <Section
        title={t('results.strengths')}
        items={feedback.strengths}
        bullet="+"
        titleColor={colors.primary500}
        textColor={colors.typography}
      />
      <Section
        title={t('results.improvements')}
        items={feedback.improvements}
        bullet="!"
        titleColor={colors.gray500}
        textColor={colors.typography}
      />
      <Section
        title={t('results.suggestions')}
        items={feedback.suggestions}
        bullet="→"
        titleColor={colors.gray500}
        textColor={colors.typography}
      />
    </View>
  );
}

export default FeedbackCard;

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 16
  },
  chips: { flexDirection: 'row', gap: 24 },
  chip: { gap: 2 },
  chipLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  chipValue: { fontSize: 18, fontWeight: '600' },
  section: { gap: 6 },
  sectionTitle: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700'
  },
  bulletRow: { flexDirection: 'row', gap: 8 },
  bullet: { fontSize: 14, fontWeight: '700', width: 14 },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 20 }
});
