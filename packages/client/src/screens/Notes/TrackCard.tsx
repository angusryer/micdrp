/**
 * One thing that can sound, and everything that decides how it sounds.
 *
 * A card rather than a row in a list, because most of these carry more than a
 * level: the melody has a reading and a register too, and those belong beside
 * the volume they share a subject with rather than scattered under one long
 * column of unrelated switches (INV-NOTES-082).
 *
 * Every card has the same two things in the same place — a level and a
 * speaker — so the eye learns one shape and reads the rest as differences.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../components/Icon';
import { LevelSlider } from '../../components/LevelSlider';
import { useTheme } from '../../theme';

export interface TrackCardProps {
  title: string;
  /** What this actually is, in a line, for whoever did not name it. */
  hint?: string;
  level: number;
  onLevelChange: (level: number) => void;
  isAudible: boolean;
  onAudibleChange: (isAudible: boolean) => void;
  /**
   * Silenced by something other than the singer — the last track that can
   * sound cannot be turned off, since a press would then do nothing.
   */
  isLocked?: boolean;
  /** Anything else about this track: a reading, a register. */
  children?: React.ReactNode;
}

export function TrackCard({
  title,
  hint,
  level,
  onLevelChange,
  isAudible,
  onAudibleChange,
  isLocked = false,
  children
}: TrackCardProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.neutral100, borderColor: colors.neutral500 }
      ]}
    >
      <Text style={[styles.title, { color: colors.gray500 }]}>{title}</Text>
      {hint ? (
        <Text style={[styles.hint, { color: colors.gray300 }]}>{hint}</Text>
      ) : null}

      <View style={styles.row}>
        <View style={styles.slider}>
          <LevelSlider
            value={level}
            onChange={onLevelChange}
            accessibilityLabel={`${title} level`}
          />
        </View>
        {/* The speaker is the mute: a slash through it is what every device
            uses, so it is recognised rather than read. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isAudible ? `Mute ${title}` : `Unmute ${title}`}
          accessibilityState={{ disabled: isLocked, selected: !isAudible }}
          disabled={isLocked}
          hitSlop={8}
          onPress={() => onAudibleChange(!isAudible)}
          style={({ pressed }) => [
            styles.speaker,
            { opacity: isLocked ? 0.35 : pressed ? 0.5 : 1 }
          ]}
        >
          <Icon
            name={isAudible ? 'speaker' : 'speakerOff'}
            size={20}
            color={isAudible ? colors.primary500 : colors.gray300}
          />
        </Pressable>
      </View>

      {children}
    </View>
  );
}

export default TrackCard;

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    gap: 2
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  hint: { fontSize: 11, lineHeight: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  slider: { flex: 1 },
  speaker: { padding: 4 }
});
