/**
 * How the time left is shown: the digits, and the colour they wear.
 *
 * Separate from the control because it is the one part of it with no state,
 * no effects, and no audio session — a pure reading of the session snapshot,
 * which is what makes the two thresholds cheap to test.
 */
import type { ThemeColors } from '../theme';
import type { CountdownUrgency } from './types';

/** m:ss, rounded up so the last second is shown rather than skipped. */
export const countdownLabel = (ms: number): string => {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/**
 * The countdown's colour, which is the only thing urgency changes.
 *
 * Warm before red: caution says a sentence has room to finish, warning says
 * finish it now. The numbers behind these live in `config.ts`.
 */
export const countdownColor = (
  urgency: CountdownUrgency,
  colors: ThemeColors
): string => {
  if (urgency === 'warning') {
    return colors.error;
  }
  return urgency === 'caution' ? colors.caution : colors.gray300;
};
