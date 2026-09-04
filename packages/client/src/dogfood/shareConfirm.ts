/**
 * What is said before a recording leaves the device, and before one is
 * taken back.
 *
 * The control that raises these is a single quiet word in a header, which
 * is not enough room to say what tapping it does — and this is the one
 * control in the app that sends a recording of the maintainer's singing
 * anywhere. So the explanation lives here, in front of the action rather
 * than after it, and nothing goes on one tap of an unlabelled word.
 *
 * Separate from the control for the same reason the out-of-time alert is:
 * the control holds the state, and this holds none of it.
 */
import { Alert } from 'react-native';

/** Just enough of i18n's `t` to look up the strings below. */
type Translate = (key: string) => string;

/**
 * Ask before sending. Resolves true only when the maintainer said yes —
 * dismissing counts as no, which is why this resolves rather than
 * taking a callback for the accept alone.
 */
export function confirmShare(t: Translate): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(t('dogfood.share.confirm.title'), t('dogfood.share.confirm.body'), [
      { text: t('dogfood.share.confirm.cancel'), style: 'cancel', onPress: () => resolve(false) },
      { text: t('dogfood.share.confirm.send'), onPress: () => resolve(true) }
    ]);
  });
}

/** Ask before taking one back. Destructive, because the audio goes too. */
export function confirmWithdraw(t: Translate): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(t('dogfood.share.stop.title'), t('dogfood.share.stop.body'), [
      { text: t('dogfood.share.stop.cancel'), style: 'cancel', onPress: () => resolve(false) },
      {
        text: t('dogfood.share.stop.confirm'),
        style: 'destructive',
        onPress: () => resolve(true)
      }
    ]);
  });
}

/**
 * Say that a share has not gone yet, and why, and offer to drop it.
 *
 * A queue that will not drain is invisible from the outside: the take is
 * on the device, the server has nothing, and neither end can say why. The
 * control has room for one word, so the reason lives here. Resolves true
 * when the maintainer would rather it did not go at all.
 */
export function confirmPending(
  t: Translate,
  because: string | null
): Promise<boolean> {
  const body =
    because == null
      ? t('dogfood.share.pending.body')
      : `${t('dogfood.share.pending.body')}\n\n${because}`;
  return new Promise((resolve) => {
    Alert.alert(t('dogfood.share.pending.title'), body, [
      { text: t('dogfood.share.pending.wait'), style: 'cancel', onPress: () => resolve(false) },
      {
        text: t('dogfood.share.stop.confirm'),
        style: 'destructive',
        onPress: () => resolve(true)
      }
    ]);
  });
}

/** Say why nothing happened, when a share could not be made or sent. */
export function reportShareProblem(t: Translate, problem: string): void {
  Alert.alert(t('dogfood.share.failed'), problem, [
    { text: t('dogfood.share.confirm.cancel') }
  ]);
}
