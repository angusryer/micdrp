/**
 * INV-ACCOUNT-013 — every setting says when you would notice it.
 *
 * These are detector internals with names like "clarity threshold" and "hop
 * size". Their labels say what they are, which their names already did. The
 * knob that lets a quiet whistle be heard was on this screen all along and
 * went unfound, because nothing on the page connected it to the room the
 * singing was happening in.
 */
import en from '../../../i18n/locales/en.json';

const engine = en.settings.engine as Record<string, string>;
const analysis = en.settings.analysis as Record<string, string>;

/** Every field the settings screen steps, by the key its hint is stored under. */
const HINTED = [
  ...['frameSize', 'hopSize', 'minFrequency', 'maxFrequency', 'clarityThreshold', 'emitRate'].map(
    (key) => ({ where: 'engine', key, text: engine[`${key}Hint`] })
  ),
  ...['windowMs', 'minConfidence'].map((key) => ({
    where: 'analysis',
    key,
    text: analysis[`${key}Hint`]
  }))
];

describe('the settings screen', () => {
  it.each(HINTED)('names a situation for $where.$key', ({ text }) => {
    expect(typeof text).toBe('string');
    expect((text ?? '').trim().length).toBeGreaterThan(0);
  });

  it('says where a quiet whistle is lost, on the knob that fixes it', () => {
    // The case that prompted this. Both halves matter: the ceiling excludes
    // whistling outright, and the clarity gate drops soft singing.
    expect(engine.maxFrequencyHint.toLowerCase()).toContain('whistl');
    expect(engine.clarityThresholdHint.toLowerCase()).toContain('quiet');
  });

  it('describes a situation rather than which way to turn it', () => {
    // "Lower this to..." tells you what the stepper already shows. A
    // situation lets a person recognise their own case.
    for (const { text } of HINTED) {
      expect(text.toLowerCase()).not.toMatch(/^(raise|lower|increase|decrease) /);
    }
  });
});
