/**
 * What every mark on the rail means (INV-NOTES-232).
 *
 * The rail is glyphs and single letters because it is 38 points wide, and
 * every point it takes is a moment of the take it does not draw. That is the
 * right trade for a control pressed while looking at the graph and the wrong
 * one for a control met for the first time — a letter is only a reminder to
 * whoever already knows what it stands for. This is where the knowing comes
 * from.
 *
 * Up from the bottom of the screen, dimming what is behind it, alone among
 * the things reached from the rail. The menu beside it opens sideways because
 * what it offers is used while watching the graph (INV-NOTES-229); this is
 * read once, understood, and put away, and nothing is being watched while it
 * is open.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Sheet } from '../../components/Sheet';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { legendSections } from './railLegendRows';
import { TRACK_RAIL_WIDTH } from './TrackRail';
import type { TrackName } from './playbackTracks';

export interface RailLegendProps {
  isOpen: boolean;
  onClose: () => void;
  /** The tracks the rail is showing, and no others (INT-NOTES-026). */
  tracks: readonly TrackName[];
  /** Whether the foot is there to be described. */
  hasTransport?: boolean;
  /** Whether that foot opens into the acts (INV-NOTES-230). */
  hasActs?: boolean;
}

export function RailLegend({
  isOpen,
  onClose,
  tracks,
  hasTransport = false,
  hasActs = false
}: RailLegendProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const sections = legendSections(
    tracks,
    hasTransport,
    hasActs,
    t,
    { on: colors.primary500, off: colors.gray300, record: colors.error }
  );

  return (
    <Sheet
      name="rail-legend"
      isOpen={isOpen}
      onClose={onClose}
      // Most of the screen, and draggable to the rest of it: it is a list as
      // long as the rail has controls, and a sheet sized to its own content
      // would open at whatever length this note happens to make it.
      detents={[0.7, 0.95]}
      // Nothing behind it is in use while it is being read, and the page it
      // covers is put back the moment it goes — so there is no last row to
      // scroll clear of (INV-NOTES-109).
      background={colors.neutral50}
    >
      <View testID="rail-legend" style={styles.body}>
        <Text style={[styles.title, { color: colors.typography }]}>
          {t('notes.railLegendTitle')}
        </Text>
        <Text style={[styles.why, { color: colors.gray300 }]}>
          {t('notes.railLegendWhy')}
        </Text>

        {sections.map((section) => (
          <View key={section.key} style={styles.section}>
            <Text style={[styles.heading, { color: colors.gray300 }]}>
              {section.heading}
            </Text>
            {section.rows.map((row) => (
              <View key={row.key} style={styles.row}>
                {/* A fixed column, so every mark lines up under the last and
                    the eye runs down them the way it runs down the rail. */}
                <View style={styles.mark}>{row.mark}</View>
                <View style={styles.said}>
                  <Text style={[styles.rowTitle, { color: colors.typography }]}>
                    {row.title}
                  </Text>
                  <Text style={[styles.rowWhy, { color: colors.gray300 }]}>
                    {row.why}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ))}
      </View>
    </Sheet>
  );
}

export default RailLegend;

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  title: { fontSize: 18, fontWeight: '700' },
  why: { fontSize: 13, marginTop: 2 },
  section: { marginTop: 20 },
  heading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 7 },
  // The rail's own width, so the column of marks is the column of marks.
  mark: { width: TRACK_RAIL_WIDTH, alignItems: 'center' },
  said: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowWhy: { fontSize: 12, marginTop: 1 }
});
