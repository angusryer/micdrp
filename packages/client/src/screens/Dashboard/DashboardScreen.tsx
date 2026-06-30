/**
 * DashboardScreen — visualise training progress and the singer's tendencies.
 *
 * Three sections (design §7):
 *   1. Training progress — the practice-score trend over sessions (TrendChart).
 *   2. Most common patterns — top intervals, recurring melodic fragments (tap to
 *      hear), and the chord changes the melodies most reflect.
 *   3. Most avoided patterns — interval classes furthest from the singer's own
 *      common-pattern centroid.
 *
 * All insight comes from `useDashboard` (cache-first `analyzeCorpus`); this
 * screen is presentational and never touches the live audio path.
 */
import React, { useCallback, useEffect, useMemo } from 'react';
import {
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from 'react-native';

import { midiSequenceToTargets, type Fragment } from 'logic';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { createReferenceTonePlayer } from '../../audio/referenceTone';
import { MelodyView } from '../../components/MelodyView';
import { useDashboard } from './useDashboard';
import { TrendChart } from './TrendChart';

const CHART_HEIGHT = 120;
const SCREEN_MARGIN = 20;
/** Per-note duration when auditioning a fragment, in ms. */
const FRAGMENT_NOTE_MS = 320;

export function DashboardScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { analysis, progress, noteCount, loading, refresh } = useDashboard();

  const tonePlayer = useMemo(() => createReferenceTonePlayer(), []);
  useEffect(() => () => tonePlayer.stop(), [tonePlayer]);
  const playFragment = useCallback(
    (fragment: Fragment) => {
      tonePlayer.play(
        midiSequenceToTargets(fragment.exampleMidi, FRAGMENT_NOTE_MS)
      );
    },
    [tonePlayer]
  );

  const chartWidth = width - 2 * SCREEN_MARGIN;
  const scores = progress.map((p) => p.score ?? 0);
  const latestScore = scores.length > 0 ? scores[scores.length - 1] : null;

  const topIntervals = analysis.intervals.byClass.slice(0, 6);
  const maxIntervalCount = topIntervals[0]?.count ?? 1;
  const topChanges = analysis.chords.changes.slice(0, 6);
  const maxChangeCount = topChanges[0]?.count ?? 1;
  const topFragments = analysis.fragments.slice(0, 6);
  const avoided = analysis.avoided.slice(0, 6);
  const maxAvoidedDistance = avoided[0]?.distance ?? 1;

  const empty = noteCount === 0 && progress.length === 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.neutral300 }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={colors.primary500}
          />
        }
      >
        <Text style={[styles.title, { color: colors.typography }]}>
          {t('dashboard.title')}
        </Text>

        {empty ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: colors.typography }]}>
              {t('dashboard.emptyTitle')}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.gray300 }]}>
              {t('dashboard.emptySubtitle')}
            </Text>
          </View>
        ) : null}

        {/* 1. Training progress */}
        <Section title={t('dashboard.progressTitle')}>
          {progress.length > 0 ? (
            <>
              <TrendChart
                values={scores}
                width={chartWidth}
                height={CHART_HEIGHT}
              />
              <View style={styles.progressMeta}>
                <Text style={[styles.metaStrong, { color: colors.typography }]}>
                  {latestScore != null
                    ? t('dashboard.latestScore', {
                        score: Math.round(latestScore)
                      })
                    : ''}
                </Text>
                <Text style={[styles.metaText, { color: colors.gray300 }]}>
                  {t('dashboard.sessions', { count: progress.length })}
                </Text>
              </View>
            </>
          ) : (
            <Text style={[styles.metaText, { color: colors.gray300 }]}>
              {t('dashboard.noProgress')}
            </Text>
          )}
        </Section>

        {/* 2. Most common patterns */}
        <Section title={t('dashboard.commonTitle')}>
          {noteCount === 0 ? (
            <Text style={[styles.metaText, { color: colors.gray300 }]}>
              {t('dashboard.noNotes')}
            </Text>
          ) : (
            <>
              <Text style={[styles.subhead, { color: colors.gray500 }]}>
                {t('dashboard.intervals')}
              </Text>
              {topIntervals.map((iv) => (
                <BarRow
                  key={`iv-${iv.ic}`}
                  label={iv.name}
                  value={String(iv.count)}
                  ratio={iv.count / maxIntervalCount}
                  color={colors.primary500}
                />
              ))}

              {topFragments.length > 0 ? (
                <>
                  <Text style={[styles.subhead, { color: colors.gray500 }]}>
                    {t('dashboard.fragments')}
                  </Text>
                  {topFragments.map((fr, i) => (
                    <Pressable
                      key={`fr-${i}`}
                      accessibilityRole="button"
                      accessibilityLabel={t('dashboard.playFragment')}
                      onPress={() => playFragment(fr)}
                      style={[
                        styles.fragmentRow,
                        { borderColor: colors.neutral500 }
                      ]}
                    >
                      <MelodyView
                        notes={midiSequenceToTargets(
                          fr.exampleMidi,
                          FRAGMENT_NOTE_MS
                        )}
                        width={chartWidth * 0.5}
                        height={36}
                        showContour={false}
                      />
                      <Text style={[styles.countText, { color: colors.gray300 }]}>
                        ×{fr.count} ▶
                      </Text>
                    </Pressable>
                  ))}
                </>
              ) : null}

              {topChanges.length > 0 ? (
                <>
                  <Text style={[styles.subhead, { color: colors.gray500 }]}>
                    {t('dashboard.chordChanges')}
                  </Text>
                  {topChanges.map((ch, i) => (
                    <BarRow
                      key={`ch-${i}`}
                      label={ch.label}
                      value={String(ch.count)}
                      ratio={ch.count / maxChangeCount}
                      color={colors.gold}
                    />
                  ))}
                </>
              ) : null}
            </>
          )}
        </Section>

        {/* 3. Most avoided patterns */}
        <Section title={t('dashboard.avoidedTitle')}>
          {noteCount === 0 ? (
            <Text style={[styles.metaText, { color: colors.gray300 }]}>
              {t('dashboard.noNotes')}
            </Text>
          ) : (
            <>
              <Text style={[styles.metaText, { color: colors.gray300 }]}>
                {t('dashboard.avoidedHint')}
              </Text>
              {avoided.map((a) => (
                <BarRow
                  key={`av-${a.ic}`}
                  label={a.name}
                  value={`${Math.round(a.presence * 100)}%`}
                  ratio={a.distance / maxAvoidedDistance}
                  color={colors.error}
                />
              ))}
            </>
          )}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.section,
        { backgroundColor: colors.neutral100, borderColor: colors.neutral500 }
      ]}
    >
      <Text style={[styles.sectionTitle, { color: colors.typography }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function BarRow({
  label,
  value,
  ratio,
  color
}: {
  label: string;
  value: string;
  ratio: number;
  color: string;
}): React.JSX.Element {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <View style={styles.barRow}>
      <Text style={[styles.barLabel, { color: colors.typography }]}>
        {label}
      </Text>
      <View style={[styles.barTrack, { backgroundColor: colors.neutral300 }]}>
        <View
          style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]}
        />
      </View>
      <Text style={[styles.barValue, { color: colors.gray300 }]}>{value}</Text>
    </View>
  );
}

export default DashboardScreen;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: SCREEN_MARGIN, gap: 16 },
  title: { fontSize: 28, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 12, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptySubtitle: { fontSize: 13, textAlign: 'center', paddingHorizontal: 16 },
  section: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    gap: 10
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  subhead: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6
  },
  metaStrong: { fontSize: 15, fontWeight: '700' },
  metaText: { fontSize: 13 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 56, fontSize: 13, fontWeight: '600' },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    overflow: 'hidden'
  },
  barFill: { height: 10, borderRadius: 5 },
  barValue: { width: 44, fontSize: 12, textAlign: 'right' },
  fragmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8
  },
  countText: { fontSize: 13 }
});
