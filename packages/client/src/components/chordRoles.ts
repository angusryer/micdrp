/**
 * chordRoles — which part of a chord a note is, and what colour says so.
 *
 * A chord's tones are listed root-first, so a note's index in that list is
 * the part it plays. Colouring by that index rather than by height is what
 * makes the root findable at a glance in a band of small rectangles — and
 * findable is what makes it draggable with intent (INV-NOTES-052).
 *
 * It also makes a renaming legible. Pull the fifth of a C up to A and the
 * chord becomes A minor: the note under the finger turns from the fifth's
 * colour to the root's, so the reading shows up in the thing that changed
 * rather than only in a label somewhere else.
 */

/** What a note is to the chord it belongs to. */
export type ChordRole = 'root' | 'third' | 'fifth' | 'seventh' | 'extension';

/**
 * Spectrum order from the root upward, so the ordering itself carries the
 * meaning: the further through the chord a note is, the further through the
 * spectrum its colour.
 *
 * Chosen to stay apart on a small dark rectangle rather than to be pretty.
 * Colour only ever reinforces here — vertical position is still the pitch and
 * the card still carries the name — because red against green is the
 * commonest way for colour to fail a reader.
 */
const ROLE_COLOURS: readonly string[] = [
  '#FF5A4E', // root — red
  '#3FBF5F', // third — green
  '#3F8CFF', // fifth — blue
  '#A45CFF' // seventh — purple
];

/** Anything past a seventh, which nothing builds yet but voicings may reach. */
const EXTENSION_COLOUR = '#FF9F1C';

const ROLE_NAMES: readonly ChordRole[] = ['root', 'third', 'fifth', 'seventh'];

/** The part a note plays, from its position in the chord's tone list. */
export function chordRoleAt(toneIndex: number): ChordRole {
  return ROLE_NAMES[toneIndex] ?? 'extension';
}

/** The colour that says which part a note plays. */
export function chordRoleColour(toneIndex: number): string {
  return ROLE_COLOURS[toneIndex] ?? EXTENSION_COLOUR;
}
