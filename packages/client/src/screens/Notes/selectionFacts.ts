/**
 * What the chosen thing is, and what can be done to it.
 *
 * Separated from the sheet that draws it because these are two different
 * questions, and only this one has a right answer worth pinning: which facts
 * a person is deciding from, and which verbs are honest to offer.
 *
 * The strip this replaced named the thing and offered verbs, but never said
 * what the thing actually was — the pitch that was read, how far off it sat,
 * which bar it fell in (INT-NOTES-027). Those are the facts the decision is
 * made from, and they were the ones missing.
 *
 * A verb appears only where it would do something. "Put it back" on a note
 * nobody has moved is a control that reports nothing and does nothing.
 */
import { isAltered } from 'logic';

import { chordRoleAt, chordRoleColour } from '../../components/chordRoles';
import type { Selection } from '../../components/graphSelection';
import { midiToLabel } from '../Results/NoteList';
import type { useNoteDetail } from './useNoteDetail';

/** One line of the sheet's readout: a name and what it currently says. */
export interface SelectionFact {
  label: string;
  value: string;
}

export interface SelectionAction {
  label: string;
  run: () => void;
  /** Takes something away rather than changing it, and is drawn as such. */
  isDestructive?: boolean;
}

export interface SelectionDescription {
  title: string;
  /** The colour the graph is lighting it in, so the two are plainly one thing. */
  accent: string;
  facts: SelectionFact[];
  actions: SelectionAction[];
}

const seconds = (ms: number): string => `${(ms / 1000).toFixed(2)}s`;

/**
 * How loud it was, or that nobody measured it.
 *
 * Not measured is its own reading rather than a blank: a take captured before
 * the engine reported levels, or one recorded by a binary older than this
 * bundle, has no number and saying zero would be a lie (INV-PITCH-020).
 */
function loudness(db: number | null): string {
  return db == null ? 'not measured' : `${Math.round(db)} dB`;
}

/** Cents as a signed reading, or "in tune" when there is nothing to report. */
function centsOff(cents: number): string {
  const rounded = Math.round(cents);
  if (rounded === 0) {
    return 'in tune';
  }
  return `${rounded > 0 ? '+' : ''}${rounded} cents`;
}

export function describeSelection(
  selection: Selection,
  detail: ReturnType<typeof useNoteDetail>,
  accent: string,
  onSelect: () => void
): SelectionDescription {
  if (selection.kind === 'chordTone') {
    return describeChordTone(selection, detail);
  }
  if (selection.kind === 'melodyNote') {
    return describeSungNote(selection, detail, accent);
  }
  if (selection.kind === 'layerNote') {
    return describeLayerNote(selection, detail, accent);
  }
  if (selection.kind === 'hit') {
    return describeHit(selection, detail, accent);
  }
  if (selection.kind === 'beat') {
    return describeBeat(selection, detail, accent);
  }
  return describeBarLine(selection, detail, accent, onSelect);
}

function describeChordTone(
  selection: Extract<Selection, { kind: 'chordTone' }>,
  detail: ReturnType<typeof useNoteDetail>
): SelectionDescription {
  const slot = detail.chords.slots[selection.slot];
  const voiced = detail.chords.voicing(selection.slot)[selection.tone];
  const actions: SelectionAction[] = [
    {
      label: 'Hear the chord',
      run: () => detail.auditionChord(selection.slot)
    },
    {
      label: 'Silence this note',
      run: () => detail.chords.toggleTone(selection.slot, selection.tone)
    }
  ];
  // Offered only where there is something to undo.
  if (isAltered(slot?.voicing)) {
    actions.push({
      label: 'Put it back',
      run: () => detail.chords.resetTone(selection.slot, selection.tone)
    });
  }
  return {
    title: slot?.label ?? 'Chord',
    accent: chordRoleColour(selection.tone),
    facts: [
      { label: 'Part', value: chordRoleAt(selection.tone) },
      { label: 'Pitch', value: voiced != null ? midiToLabel(voiced) : '—' },
      { label: 'Bar', value: slot ? String(slot.bar) : '—' },
      ...(slot ? [{ label: 'Starts', value: seconds(slot.startMs) }] : [])
    ],
    actions
  };
}

function describeSungNote(
  selection: Extract<Selection, { kind: 'melodyNote' }>,
  detail: ReturnType<typeof useNoteDetail>,
  accent: string
): SelectionDescription {
  const note = detail.melody[selection.index];
  const isCorrected = detail.isCorrected(selection.index);
  const actions: SelectionAction[] = [
    { label: 'Hear it', run: () => note && detail.playNote(note.midi) }
  ];
  if (isCorrected) {
    actions.push({
      label: 'Put it back',
      run: () => detail.resetNote(selection.index)
    });
  }
  return {
    title: note ? midiToLabel(note.midi) : 'Sung note',
    accent,
    facts: note
      ? [
          { label: 'Starts', value: seconds(note.startMs) },
          { label: 'Lasts', value: seconds(note.endMs - note.startMs) },
          // What the detector heard against the note it settled on. The
          // reason a note looks wrong is usually here.
          { label: 'Tuning', value: centsOff(note.cents) },
          { label: 'Loudness', value: loudness(note.loudnessDb) },
          {
            label: 'Read as',
            value: isCorrected ? 'moved by hand' : 'detected'
          }
        ]
      : [],
    actions
  };
}

/**
 * A note from the second take sung against this one.
 *
 * The same facts as a sung note, because it is one — a different performance,
 * read the same way (INV-NOTES-118). What it does not offer is a correction:
 * the layer is context for reading the take, and moving its pitches would be
 * editing the evidence rather than the reading.
 */
function describeLayerNote(
  selection: Extract<Selection, { kind: 'layerNote' }>,
  detail: ReturnType<typeof useNoteDetail>,
  accent: string
): SelectionDescription {
  const note = detail.bass?.[selection.index];
  return {
    title: note ? midiToLabel(note.midi) : 'Layer note',
    accent,
    facts: note
      ? [
          { label: 'Starts', value: seconds(note.startMs) },
          { label: 'Lasts', value: seconds(note.endMs - note.startMs) },
          { label: 'Tuning', value: centsOff(note.cents) },
          { label: 'Part of', value: 'the layer you sang under this' }
        ]
      : [],
    actions: note
      ? [{ label: 'Hear it', run: () => detail.playNote(note.midi) }]
      : []
  };
}

/** A struck sound: a moment and a timbre, with no pitch to report. */
function describeHit(
  selection: Extract<Selection, { kind: 'hit' }>,
  detail: ReturnType<typeof useNoteDetail>,
  accent: string
): SelectionDescription {
  const hit = detail.hits[selection.index];
  const named: Record<string, string> = {
    thump: 'Thump',
    tap: 'Tap',
    hiss: 'Hiss',
    unknown: 'Struck'
  };
  return {
    title: hit ? named[hit.kind] : 'Struck',
    accent,
    facts: hit
      ? [
          { label: 'At', value: seconds(hit.atMs) },
          { label: 'Lasts', value: seconds(hit.durationMs) },
          { label: 'Loudness', value: `${Math.round(hit.loudnessDb)} dB` },
          {
            label: 'Pitch',
            // Not a failure to detect one. A struck sound has none, and
            // saying "unknown" would invite someone to go looking.
            value: 'none — this was struck, not sung'
          }
        ]
      : [],
    actions: []
  };
}

/**
 * A beat somebody tapped along with the take.
 *
 * The only thing on the graph that was stated rather than read, which is why
 * it can be moved, put back, made a bar start and thrown away
 * (INV-NOTES-130). Everything a marked beat can do, a plain one can do:
 * marking changes what it means and nothing else (INV-NOTES-163).
 */
function describeBeat(
  selection: Extract<Selection, { kind: 'beat' }>,
  detail: ReturnType<typeof useNoteDetail>,
  accent: string
): SelectionDescription {
  const beat = detail.beats[selection.index];
  if (beat == null) {
    return { title: 'Beat', accent, facts: [], actions: [] };
  }
  const wasMoved = Math.round(beat.atMs) !== Math.round(beat.tappedAtMs);
  const actions: SelectionAction[] = [
    {
      label: beat.isDownbeat ? 'Not a bar start' : 'Start a bar here',
      run: () => detail.setBeatIsDownbeat(selection.index, !beat.isDownbeat)
    }
  ];
  // Offered only where there is something to undo (INV-NOTES-044).
  if (wasMoved) {
    actions.push({
      label: 'Put it back',
      run: () => detail.resetBeatAt(selection.index)
    });
  }
  // On every beat, marked or not. A marked one could be deleted and a plain
  // one could not, which made "start a bar here" a one-way door: the only way
  // to be rid of a beat was to promote it first (INV-NOTES-163).
  actions.push({
    label: 'Delete this beat',
    run: () => detail.removeBeatAt(selection.index)
  });
  return {
    title: beat.isDownbeat ? 'Bar starts here' : 'Beat',
    accent,
    facts: [
      { label: 'At', value: seconds(beat.atMs) },
      {
        label: 'Read as',
        value: wasMoved ? 'moved by hand' : 'where you tapped'
      },
      ...(wasMoved
        ? [{ label: 'Tapped at', value: seconds(beat.tappedAtMs) }]
        : [])
    ],
    actions
  };
}

function describeBarLine(
  selection: Extract<Selection, { kind: 'barLine' }>,
  detail: ReturnType<typeof useNoteDetail>,
  accent: string,
  onSelect: () => void
): SelectionDescription {
  const slot = detail.chords.slots[selection.lineIndex];
  return {
    title: 'Downbeat',
    accent,
    facts: [
      { label: 'Opens bar', value: String(selection.lineIndex + 1) },
      ...(slot
        ? [
            { label: 'Chord', value: slot.label },
            { label: 'Starts', value: seconds(slot.startMs) }
          ]
        : [])
    ],
    actions: [
      {
        label: 'Remove it',
        isDestructive: true,
        run: () => {
          detail.bars.merge(selection.lineIndex);
          // What it referred to has gone, so nothing is chosen any more.
          onSelect();
        }
      }
    ]
  };
}
