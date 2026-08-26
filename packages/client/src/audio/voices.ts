/**
 * The voices a track can speak in (INV-NOTES-144).
 *
 * Every synthesized voice was a sine — chords, bass, transcription, drums and
 * click alike. A sine is the one waveform with nothing but its fundamental,
 * so five parts at once were five things the ear had only pitch and level to
 * separate, which is why the mix sounded crowded before it sounded loud.
 *
 * Numbers cross the language boundary; what each means is decided here. The
 * order mirrors `Wave` in cpp/dsp/wave.h — the engine ignores a shape it does
 * not know and speaks in a sine instead, so a mismatch is dull rather than
 * dangerous.
 */

export const VOICES = [
  {
    name: 'sine',
    wave: 0,
    title: 'Pure',
    /** What it is for, in the words somebody choosing would use. */
    hint: 'Nothing but the note. Cleanest under a voice.'
  },
  {
    name: 'triangle',
    wave: 1,
    title: 'Soft',
    hint: 'A little body, still out of the way. Flute-ish.'
  },
  {
    name: 'square',
    wave: 2,
    title: 'Hollow',
    hint: 'Reedy and easy to pick out. Good for a line you are following.'
  },
  {
    name: 'saw',
    wave: 3,
    title: 'Bright',
    hint: 'Every partial. What a bass wants, and what cuts through.'
  },
  {
    name: 'noise',
    wave: 4,
    title: 'Struck',
    hint: 'No pitch at all. For drums, where a note would clash.'
  }
] as const;

export type VoiceName = (typeof VOICES)[number]['name'];

const byName = new Map(VOICES.map((voice) => [voice.name, voice]));

/** The number the engine knows a voice by. Unknown names read as pure. */
export function waveOf(name: VoiceName | undefined): number {
  return byName.get(name ?? 'sine')?.wave ?? 0;
}

/** What a voice is called, for anything that has to name one. */
export function voiceTitle(name: VoiceName): string {
  return byName.get(name)?.title ?? name;
}
