/**
 * One remark in the queue: what it was about, how far the loop has got, and a
 * way to be rid of it.
 *
 * Split from the screen, which owns the list and the polling.
 */
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../theme';
import { isInFlight } from 'shared';

import { discardClip, type QueuedClip } from './queue';

export function QueueRow({
  clip,
  onRemoved
}: {
  clip: QueuedClip;
  onRemoved: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();

  // Asked first rather than offered back afterwards: the audio goes with the
  // record, and there is nothing to undo it from.
  const confirmRemove = (): void => {
    Alert.alert(
      'Remove this remark?',
      clip.isCancelling
        ? 'It is already being withdrawn.'
        : isInFlight(clip.state)
          ? 'It is being worked on now. The work will stop and the recording goes too.'
          : 'The recording goes too, and cannot be brought back.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void discardClip(clip)
              .then(onRemoved)
              .catch(() => Alert.alert('Could not remove it', 'Try again in a moment.'));
          }
        }
      ]
    );
  };
  const percent = clip.progress?.percent ?? 0;
  const isDone = clip.state === 'delivered' || percent >= 100;

  return (
    <View style={[styles.row, { backgroundColor: colors.neutral100 }]}>
      <View style={styles.head}>
        <Text numberOfLines={2} style={[styles.label, { color: colors.typography }]}>
          {clip.label ?? `Recorded ${new Date(clip.recordedAtMs).toLocaleTimeString()}`}
        </Text>
        <TouchableOpacity
          testID={`remove-clip-${clip.id}`}
          accessibilityRole="button"
          accessibilityLabel="Remove this remark"
          onPress={confirmRemove}
          hitSlop={8}
          style={styles.remove}
        >
          <Text style={[styles.removeMark, { color: colors.gray500 }]}>×</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.track, { backgroundColor: colors.neutral500 }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.max(2, percent)}%`,
              // Stalled reads differently from failed: it may yet finish, but
              // it has not said anything for a long time.
              backgroundColor: clip.isStalled
                ? colors.error
                : isDone
                  ? colors.primary300
                  : colors.primary500
            }
          ]}
        />
      </View>

      <Text style={[styles.note, { color: colors.gray500 }]}>
        {clip.isCancelling
          ? 'withdrawing…'
          : clip.isStalled
            ? `${percent}% · silent for a while`
            : `${percent}% · ${clip.progress?.note ?? clip.state}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderRadius: 12, padding: 14, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  label: { flex: 1, fontSize: 15, fontWeight: '600' },
  remove: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  removeMark: { fontSize: 22, lineHeight: 24 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  note: { fontSize: 12 },
});

export default QueueRow;
