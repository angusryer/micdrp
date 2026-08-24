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
import { SEGMENT_KNOBS } from '../../../analysis/segmentSettings';

const engine = en.settings.engine as Record<string, string>;
const analysis = en.settings.analysis as Record<string, string>;

/** Every field the settings screen steps, by the key its hint is stored under. */
const HINTED = [
  ...[
    'frameSize',
    'hopSize',
    'minFrequency',
    'maxFrequency',
    'clarityThreshold',
    'voicedClarityMin',
    'voicedLevelDb',
    'emitRate'
  ].map(
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
    // whistling outright, and the voicing floor drops soft singing.
    expect(engine.maxFrequencyHint.toLowerCase()).toContain('whistl');
    expect(engine.voicedClarityMinHint.toLowerCase()).toContain('quiet');
  });

  it('does not send someone to the knob that will not fix it', () => {
    // clarityThreshold used to carry the quiet-whistle description, and it
    // was the wrong knob: it chooses WHICH pitch, and lowering it invites
    // octave errors while doing nothing about notes going missing
    // (INV-PITCH-021). A hint pointing at the wrong control is worse than
    // none, because it gets followed.
    expect(engine.clarityThresholdHint.toLowerCase()).not.toContain('missed');
    expect(engine.clarityThresholdHint.toLowerCase()).toContain('octave');
  });

  it('describes a situation rather than which way to turn it', () => {
    // "Lower this to..." tells you what the stepper already shows. A
    // situation lets a person recognise their own case.
    for (const { text } of HINTED) {
      expect(text.toLowerCase()).not.toMatch(/^(raise|lower|increase|decrease) /);
    }
  });
});

describe('INV-ACCOUNT-014: a knob cannot ship without a description', () => {
  const segment = en.settings.segment as Record<string, string>;

  it.each(SEGMENT_KNOBS.map((k) => k.key))('names %s', (key) => {
    // Rendered from the same table the analysis reads, so this is the whole
    // list by construction rather than a list somebody remembered to update.
    expect(typeof segment[key]).toBe('string');
    expect(segment[key].trim().length).toBeGreaterThan(0);
  });

  it.each(SEGMENT_KNOBS.map((k) => k.key))('says when %s is noticed', (key) => {
    const hint = segment[`${key}Hint`];
    expect(typeof hint).toBe('string');
    expect(hint.trim().length).toBeGreaterThan(20);
    // A situation, not an instruction: "lower this to..." tells you what the
    // stepper already shows, where a situation lets you recognise your case.
    expect(hint.toLowerCase()).not.toMatch(/^(raise|lower|increase|decrease) /);
  });

  it('leaves every knob somewhere to go in both directions', () => {
    // A knob whose default sits on its own limit is a control that only
    // works one way, which reads as broken rather than as opinionated.
    for (const knob of SEGMENT_KNOBS) {
      expect(knob.fallback).toBeGreaterThan(knob.min);
      expect(knob.fallback).toBeLessThan(knob.max);
      expect(knob.step).toBeGreaterThan(0);
    }
  });
});
