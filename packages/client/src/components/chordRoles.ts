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
 *
 * Muted rather than saturated. The chords are what the take implied; the sung
 * line and the hummed bass are what someone actually performed, and the
 * brightest thing on the graph should be the performance rather than the
 * reading of it (INV-NOTES-105). Held apart in hue, which is what the reading
 * needs, and turned down in strength, which is what the ranking needs.
 */
const ROLE_COLOURS: readonly string[] = [
  '#E0837B', // root — red
  '#7EBE8D', // third — green
  '#82A9DE', // fifth — blue
  '#B394D8' // seventh — purple
];

/** Anything past a seventh, which nothing builds yet but voicings may reach. */
const EXTENSION_COLOUR = '#DFB27E';

const ROLE_NAMES: readonly ChordRole[] = ['root', 'third', 'fifth', 'seventh'];

/** The part a note plays, from its position in the chord's tone list. */
export function chordRoleAt(toneIndex: number): ChordRole {
  return ROLE_NAMES[toneIndex] ?? 'extension';
}

/** The colour that says which part a note plays. */
export function chordRoleColour(toneIndex: number): string {
  return ROLE_COLOURS[toneIndex] ?? EXTENSION_COLOUR;
}
