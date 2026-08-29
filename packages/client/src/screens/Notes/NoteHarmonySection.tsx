/**
 * NoteHarmonySection — what to say about the backdrop, and where it sits.
 *
 * The cards themselves moved onto the graph, under the bars they describe
 * (INV-NOTES-061); a second copy here would be a second thing to keep in step
 * with the take. What is left is the reading that has no place on the drawing:
 * how to change a chord, which register the backdrop occupies, and the way
 * back to what was heard.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { LayerControl } from './LayerControl';
import type { useNoteDetail } from './useNoteDetail';

export interface NoteHarmonySectionProps {
  detail: ReturnType<typeof useNoteDetail>;
  /** Start the take, so the layer is sung against something. */
  onPlayTake?: () => void;
  onStopTake?: () => void;
}

export function NoteHarmonySection({
  detail,
  onPlayTake,
  onStopTake
}: NoteHarmonySectionProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { chords } = detail;

  // Asked for, not assumed. The chords used to appear on their own, built on
  // a tempo nobody had confirmed and a metre nobody had stated
  // (INV-NOTES-171).
  if (!detail.hasHarmony) {
    return (
      <View style={styles.ask}>
        <Text style={[styles.caption, { color: colors.gray300 }]}>
          {t('notes.harmonyAsk')}
        </Text>
        <Text
          accessibilityRole="button"
          testID="ask-for-harmony"
          onPress={detail.askForHarmony}
          style={[
            styles.askAction,
            { color: colors.primary500, backgroundColor: colors.neutral100 }
          ]}
        >
          {t('notes.harmonyAskAction')}
        </Text>
      </View>
    );
  }

  if (chords.slots.length === 0) {
    return (
      <Text style={[styles.caption, { color: colors.gray300 }]}>
        {t('notes.harmonyNone')}
      </Text>
    );
  }

  return (
    <>
      {/* The one thing the reading cannot infer, which the singer can simply
          perform (INV-NOTES-071). Beside the chords because it is the reason
          they are what they are. */}
      <LayerControl
        layers={detail.layers}
        isRecording={detail.layerCapture.isRecording}
        alignedByMs={detail.layerCapture.alignedByMs}
        onStart={() => {
          // Recording first, then playback: a take that started while the
          // microphone was still opening would be sung against a moment that
          // has already gone by.
          void detail.layerCapture.start('bass').then(() => onPlayTake?.());
        }}
        onStop={() => {
          onStopTake?.();
          void detail.layerCapture.stop();
        }}
        onMuteChange={detail.setLayerMuted}
      />
      {chords.hasEdits ? (
        <Text
          accessibilityRole="button"
          onPress={chords.revertAll}
          style={[styles.action, { color: colors.primary500 }]}
        >
          {t('notes.harmonyReset')}
        </Text>
      ) : null}
    </>
  );
}

export default NoteHarmonySection;

const styles = StyleSheet.create({
  ask: { alignItems: 'flex-start', gap: 8, paddingVertical: 4 },
  askAction: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    overflow: 'hidden'
  },
  caption: { fontSize: 12, marginTop: 8 },
  action: { fontSize: 14, fontWeight: '600', marginTop: 10 }
});
