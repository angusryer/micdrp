/**
 * What a layer is, and how its role decides the way it is read.
 *
 * A layer and a track are deliberately different things and stay different
 * (INV-NOTES-122):
 *
 *   A TRACK is a channel in the mixer. It has a level, a switch and a bus, and
 *   it is declared once in the track registry. Most tracks are readings of the
 *   take — the chords, the transcription, the drums — and own no audio.
 *
 *   A LAYER is a second recording, made against the take. It owns audio, a
 *   role, and a reading of its own. It is a performance, not a reading of one.
 *
 * The relationship is one way: every layer sounds through a track, and no
 * track requires a layer. Merging them would lose the distinction that
 * matters — a reading can be thrown away and made again (INV-NOTES-116), and a
 * recording cannot.
 *
 * What a layer's role decides is how it is read. A bass line is all notes; a
 * drum layer is all hits. Being told which is worth more than any amount of
 * cleverness on ambiguous input (INV-NOTES-115), and until now the role was
 * carried all the way to storage and never consulted — every layer, including
 * one recorded as drums, was read as notes.
 */
import type { TakeRole } from 'logic';
import type { LayerRole } from 'shared';

export interface LayerRoleSpec {
  role: LayerRole;
  /** What it is called where a person chooses it. */
  title: string;
  /** How a recording in this role is read (INV-NOTES-115). */
  reads: TakeRole;
  /** What it is for, in one line, where a person is choosing between them. */
  what: string;
}

/**
 * The roles a layer can be recorded in.
 *
 * `other` is not a failure to classify. It is a performance kept and sounded
 * without being read, because a layer nobody knows how to interpret is still
 * worth having and inventing a reading for it would be worse than admitting
 * none.
 */
export const LAYER_ROLES = [
  {
    role: 'bass',
    title: 'Bass line',
    reads: 'bass',
    what: 'The roots you hear under the tune. This is what states where the chords change.'
  },
  {
    role: 'drums',
    title: 'Drums',
    reads: 'drums',
    what: 'Mouth drums against the take. Read for hits rather than notes, so nothing is mistaken for singing.'
  },
  {
    role: 'melody',
    title: 'Melody',
    reads: 'melody',
    what: 'A tune sung over the take. Read for notes, with no drums looked for.'
  },
  {
    role: 'other',
    title: 'Something else',
    reads: 'mixed',
    what: 'Kept and sounded, and read as best it can be — the reading a first take gets.'
  }
] as const satisfies readonly LayerRoleSpec[];

const byRole = new Map<string, LayerRoleSpec>(
  LAYER_ROLES.map((spec) => [spec.role, spec])
);

/** What a layer in this role declared about itself. */
export function layerRoleSpec(role: LayerRole): LayerRoleSpec {
  return byRole.get(role) ?? (byRole.get('other') as LayerRoleSpec);
}

/**
 * How a recording in this role should be read.
 *
 * The one place the two vocabularies meet. A layer's role is a thing a person
 * chose; a take role is an instruction to the reader, and letting each side
 * keep its own words while naming the mapping once is what stops them drifting
 * into two lists that disagree (Axiom 2).
 */
export function takeRoleFor(role: LayerRole): TakeRole {
  return layerRoleSpec(role).reads;
}
