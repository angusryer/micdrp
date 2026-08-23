/**
 * One yes-or-no about a track, said with a glyph.
 *
 * These live in a row under the track's own level, which is where every
 * toggle belonging to that line goes (INV-NOTES-082). A pill pair spends a
 * word on each answer to say what a lit or unlit glyph says for nothing, and
 * this sheet had grown four of them.
 *
 * Lit means on. Where the two states are genuinely different things rather
 * than one thing present or absent — a low voicing against a lifted one — the
 * glyph changes with them, the way the speaker grows a slash.
 *
 * The words survive in the accessibility label, which is the one place a name
 * costs nothing.
 */
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Icon, type IconName } from '../../components/Icon';
import { useTheme } from '../../theme';

export interface IconToggleProps {
  /** Shown when on, and when off unless `offIcon` says otherwise. */
  icon: IconName;
  /** A different glyph for the off state, where off is its own thing. */
  offIcon?: IconName;
  isOn: boolean;
  onChange: (isOn: boolean) => void;
  /** What this is, for whoever cannot see the glyph. */
  label: string;
  isDisabled?: boolean;
  testID?: string;
}

export function IconToggle({
  icon,
  offIcon,
  isOn,
  onChange,
  label,
  isDisabled = false,
  testID
}: IconToggleProps): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: isOn, disabled: isDisabled }}
      disabled={isDisabled}
      hitSlop={6}
      onPress={() => onChange(!isOn)}
      style={({ pressed }) => [
        styles.button,
        {
          borderColor: isOn ? colors.primary500 : colors.neutral500,
          backgroundColor: isOn ? colors.primary100 : 'transparent',
          opacity: isDisabled ? 0.35 : pressed ? 0.5 : 1
        }
      ]}
    >
      <Icon
        name={isOn ? icon : (offIcon ?? icon)}
        size={18}
        color={isOn ? colors.primary500 : colors.gray300}
      />
    </Pressable>
  );
}

export default IconToggle;

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderRadius: 10,
    width: 38,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
