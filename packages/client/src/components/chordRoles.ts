/**
 * chordRoles — which part of a chord a note is, and what colour says so.
 *
 * A chord's tones keep their place in its list however far they are dragged,
 * so a note's index is a stable identity rather than a description of what it
 * currently is. Colour attaches to that, and therefore never changes
 * (INV-NOTES-052).
 *
 * Persistence is the point: these are three things you push around, and a
 * thing that changes colour under your finger is not the same thing any more.
 *
 * The consequence is that the red one is not always the root. Carry it above
 * the others and the chord is an inversion, named after whatever now sits at
 * the bottom — the colour tracks the note, and the name tracks the sound.
 */

/** Which of a chord's notes this is, by the part it was built as. */
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
