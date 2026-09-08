/**
 * What the legend says, section by section (INV-NOTES-232).
 *
 * Split from the sheet that shows it so neither has to be read to change the
 * other. Each row carries the mark the rail carries, from where the rail gets
 * it: the letters come from the rail itself and the moment from the same
 * formatter the foot says it with. A legend that redraws its subject is a
 * legend that can disagree with it.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../components/Icon';
import { clockLabel } from './RunClock';
import { TRACK_INITIAL } from './TrackRail';
import { TRACK_TITLES, type TrackName } from './playbackTracks';

export interface LegendRow {
  key: string;
  /** The mark as the rail draws it. */
  mark: React.ReactNode;
  title: string;
  why: string;
}

export interface LegendSection {
  key: string;
  heading: string;
  rows: LegendRow[];
}

/** What the rail's marks are drawn in, so the legend cannot drift from it. */
export interface LegendColors {
  on: string;
  off: string;
  record: string;
}

/** A translator, taken as an argument so this file holds no strings itself. */
type Say = (key: string) => string;

/** The letters, one per track the note actually has (INT-NOTES-026). */
const trackRows = (tracks: readonly TrackName[], t: Say, c: LegendColors) =>
  tracks.map((track) => ({
    key: `track-${track}`,
    mark: (
      <Text style={[styles.initial, { color: c.on }]}>
        {TRACK_INITIAL[track] ?? track[0].toUpperCase()}
      </Text>
    ),
    title: TRACK_TITLES[track] ?? track,
    why: t('notes.railLegendTrackWhy')
  }));

/** One row, named and explained, from the glyph the rail draws. */
const glyphRow = (
  key: string,
  name: Parameters<typeof Icon>[0]['name'],
  t: Say,
  c: LegendColors,
  color = c.off
) => ({
  key,
  mark: <Icon name={name} size={18} color={color} />,
  title: t(`notes.railLegend${key}`),
  why: t(`notes.railLegend${key}Why`)
});

export function legendSections(
  tracks: readonly TrackName[],
  hasTransport: boolean,
  hasActs: boolean,
  t: Say,
  c: LegendColors
): LegendSection[] {
  const sections: LegendSection[] = [];

  if (tracks.length > 0) {
    sections.push({
      key: 'tracks',
      heading: t('notes.railLegendTracks'),
      rows: trackRows(tracks, t, c)
    });
  }

  sections.push({
    key: 'graph',
    heading: t('notes.railLegendGraph'),
    rows: [
      glyphRow('Snap', 'grid', t, c, c.on),
      glyphRow('Menu', 'kebab', t, c),
      glyphRow('Help', 'help', t, c)
    ]
  });

  if (hasTransport) {
    sections.push({
      key: 'transport',
      heading: t('notes.railLegendTransport'),
      rows: [
        glyphRow('Rewind', 'rewind', t, c),
        glyphRow('Play', 'play', t, c, c.on),
        {
          key: 'Clock',
          // Said by the same formatter the foot says it with, standing at the
          // top of a take rather than following anything.
          mark: (
            <Text style={[styles.clock, { color: c.off }]}>{clockLabel(0)}</Text>
          ),
          title: t('notes.railLegendClock'),
          why: t('notes.railLegendClockWhy')
        },
        {
          key: 'Handle',
          // The bar down the foot's curved end: a shape, so it is drawn
          // rather than named.
          mark: <View style={[styles.handle, { backgroundColor: c.on }]} />,
          title: t('notes.railLegendHandle'),
          why: t('notes.railLegendHandleWhy')
        }
      ]
    });
  }

  if (hasActs) {
    sections.push({
      key: 'acts',
      heading: t('notes.railLegendActs'),
      rows: [
        {
          key: 'Record',
          mark: <View style={[styles.disc, { backgroundColor: c.record }]} />,
          title: t('notes.railLegendRecord'),
          why: t('notes.railLegendRecordWhy')
        },
        glyphRow('Reread', 'reset', t, c),
        glyphRow('Chords', 'piano', t, c, c.on)
      ]
    });
  }

  return sections;
}

const styles = StyleSheet.create({
  initial: { fontSize: 15, fontWeight: '700' },
  clock: { fontSize: 11, fontVariant: ['tabular-nums'] },
  disc: { width: 18, height: 18, borderRadius: 9 },
  handle: { width: 3, height: 20, borderRadius: 2 }
});
