/**
 * INV-NOTES-141 — the tracks start at the loudness the take was sung at.
 *
 * The tracks were balanced at fixed numbers chosen by ear against one take.
 * Against a quieter take the same numbers bury it; against a loud one they
 * vanish under it — and the singer then does by hand, on every note, what a
 * measurement could do once.
 */
import {
  matchGain,
  matchedLevels,
  sungLoudnessDb,
  takeGain,
  VOICE_PEAK
} from '../levelMatch';

const at = (...dbs: (number | null)[]) =>
  dbs.map((loudnessDb) => ({ loudnessDb }));

describe('how loud the singing was', () => {
  it('takes the median, so one shouted note is not the performance', () => {
    expect(sungLoudnessDb(at(-30, -20, -19, -18, -2))).toBe(-19);
  });

  it('leaves out what nothing measured', () => {
    // "Nobody looked" and "it was silent" are different claims, and only one
    // of them is about the singing.
    expect(sungLoudnessDb(at(-20, null, -20))).toBe(-20);
  });

  it('leaves out the room', () => {
    // Below the floor is not a voice; counting it would drag the reading
    // down and quieten an accompaniment against singing that was not quiet.
    expect(sungLoudnessDb(at(-20, -80, -20))).toBe(-20);
  });

  it('says nothing where nothing was measured at all', () => {
    expect(sungLoudnessDb(at(null, null))).toBeNull();
    expect(sungLoudnessDb([])).toBeNull();
  });
});

describe('moving the tracks to meet it', () => {
  it('leaves them where they are when nothing was measured', () => {
    expect(matchGain(null)).toBe(1);
  });

  it('quietens them for a quiet take and lifts them for a loud one', () => {
    const quiet = matchGain(-30);
    const loud = matchGain(-6);
    expect(quiet).toBeLessThan(1);
    expect(loud).toBeGreaterThan(quiet);
  });

  it('puts a take at the voice peak exactly level with it', () => {
    const db = 20 * Math.log10(VOICE_PEAK);
    expect(matchGain(db)).toBeCloseTo(1, 6);
  });

  it('quietens an arm’s-length take without silencing it', () => {
    // A take recorded across a room should lower the accompaniment, not
    // remove it.
    expect(matchGain(-55)).toBeGreaterThan(0);
  });
});

describe('the levels a note starts at', () => {
  const defaults = { take: 1, chords: 0.7, melody: 0.6, layers: 0.9 };
  const isRecording = (t: string) => t === 'take' || t === 'layers';

  it('keeps the ratios the tracks were given', () => {
    // One factor for all of them: the balance survives and only the whole
    // moves.
    const levels = matchedLevels(defaults, -30, isRecording);
    expect(levels.chords / levels.melody).toBeCloseTo(0.7 / 0.6, 6);
  });

  it('leaves the recordings alone, since they are what is matched to', () => {
    const levels = matchedLevels(defaults, -30, isRecording);
    expect(levels.take).toBe(1);
    expect(levels.layers).toBe(0.9);
  });

  it('never asks for more than full', () => {
    expect(matchedLevels(defaults, 0, isRecording).chords).toBeLessThanOrEqual(1);
  });

  it('changes nothing for a take nobody measured', () => {
    expect(matchedLevels(defaults, null, isRecording)).toEqual(defaults);
  });
});

describe('a take quieter than the reference', () => {
  /**
   * INV-NOTES-141 / ACC-NOTES-218. A bus level could not exceed one, so a
   * quiet take at full level was already as loud as it could ever be and the
   * match could only push the tracks down towards it. Against a take quieter
   * than the floor allows it ran out of room and left the accompaniment above
   * the singing — which is the complaint the measurement exists to answer.
   */
  // Around -40 dBFS: sung well back from the phone.
  const FAR = -40;

  it('ACC-NOTES-218: lifts the take rather than only lowering the tracks', () => {
    expect(takeGain(FAR)).toBeGreaterThan(1);
  });

  it('brings the two within reach of each other', () => {
    const amplitude = Math.pow(10, FAR / 20);
    const lifted = amplitude * takeGain(FAR);
    const tracks = VOICE_PEAK * matchGain(FAR);
    // Within a factor of two of each other, where before the tracks were
    // more than an order of magnitude above the take.
    expect(Math.max(lifted, tracks) / Math.min(lifted, tracks)).toBeLessThan(2);
  });

  it('does not lift a take that is already loud enough', () => {
    const loud = 20 * Math.log10(VOICE_PEAK);
    expect(takeGain(loud)).toBeCloseTo(1, 6);
    expect(takeGain(loud + 6)).toBe(1);
  });

  it('does not lift a take nothing measured', () => {
    expect(takeGain(null)).toBe(1);
  });

  it('is bounded, because make-up gain raises the room with the voice', () => {
    expect(takeGain(-120)).toBeLessThanOrEqual(4);
  });

  it('does not spend the same difference twice', () => {
    // The tracks are matched against the take *after* it has been lifted, so
    // a take fully rescued by the lift leaves them where they were.
    const rescued = 20 * Math.log10(VOICE_PEAK / 2);
    expect(takeGain(rescued)).toBeCloseTo(2, 6);
    expect(matchGain(rescued)).toBeCloseTo(1, 6);
  });
});
