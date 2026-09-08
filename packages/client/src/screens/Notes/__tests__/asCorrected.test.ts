/**
 * ACC-NOTES-242 / INV-NOTES-228 — a take is described as its owner has
 * corrected it.
 *
 * The card went on describing what the detector heard, so correcting a note
 * by hand changed nothing anybody could see from the list — which read as
 * the correction not having been kept at all.
 */
import { correctedMelody, correctedSummary } from '../../../data/asCorrected';
import type { NoteMeta } from '../../../data/notesCache';

/** One note as the detector reports them, with everything it measured. */
const note = (midi: number, startMs: number): NoteMeta['melody'][number] => ({
  midi,
  startMs,
  endMs: startMs + 400,
  durationMs: 400,
  cents: 0,
  clarity: 1,
  loudnessDb: -12
});

/** A take heard as three notes, the highest of them at MIDI 72. */
const heard: NoteMeta['melody'] = [note(60, 0), note(64, 500), note(72, 1000)];

/** The singer says that top note was really an octave above it. */
const corrected: NoteMeta['interpretations'] = [
  {
    id: 'active',
    name: 'Original',
    createdAtMs: 0,
    isFrozen: false,
    chords: [],
    notes: [{ atMs: 1000, midi: 84 }]
  }
];

it('describes a take nobody has corrected exactly as it was heard', () => {
  expect(correctedMelody({ melody: heard }).map((n) => n.midi)).toEqual([
    60, 64, 72
  ]);
});

it('ACC-NOTES-242: carries the correction into the range', () => {
  const said = correctedSummary({ melody: heard, interpretations: corrected });
  expect(said.rangeHighMidi).toBe(84);
  expect(said.rangeLowMidi).toBe(60);
});

it('leaves the count alone, because a correction moves a note rather than adding one', () => {
  const said = correctedSummary({ melody: heard, interpretations: corrected });
  expect(said.noteCount).toBe(3);
});

it('ignores a frozen reading, which is not the current answer', () => {
  const frozen: NoteMeta['interpretations'] = [
    { ...corrected![0], id: 'kept', isFrozen: true }
  ];
  const said = correctedSummary({ melody: heard, interpretations: frozen });
  expect(said.rangeHighMidi).toBe(72);
});
