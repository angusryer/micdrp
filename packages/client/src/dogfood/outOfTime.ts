/**
 * What the app says when the cap ends a clip instead of a tap.
 *
 * The countdown's colour is warning enough for someone watching the header,
 * but a remark is spoken while looking at the screen it is about — so without
 * this the clip leaves in silence, and a sentence cut off mid-word reads as
 * the app having dropped it. Only the cap raises this: tapping the square is
 * an instruction, and confirming an instruction is noise.
 *
 * Separate from the control for the same reason the countdown is: the control
 * holds the session and the timer, and this holds none of it.
 */
import { Alert } from 'react-native';

/** Just enough of i18n's `t` to look up the three strings below. */
type Translate = (key: string) => string;

export function announceOutOfTime(t: Translate): void {
  Alert.alert(t('dogfood.outOfTime.title'), t('dogfood.outOfTime.body'), [
    { text: t('dogfood.outOfTime.dismiss') }
  ]);
}
