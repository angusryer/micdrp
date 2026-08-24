/**
 * Every track, declared once.
 *
 * A track used to be spelled out in six places — the mix type, the order, the
 * defaults for on and for level, the titles, the glyph guide, the listening
 * store — plus a bus number that lived in a C++ enum, so adding one meant an
 * Xcode build and a TestFlight upload to hand the synth an integer the caller
 * already knew (INV-NOTES-121).
 *
 * Now it is one entry and everything derives from it. The same shape the
 * analysis knobs use (INV-ACCOUNT-014), for the same reason: two lists drift
 * the moment one is edited, and the drift is silent in both directions.
 *
 * What a track does NOT declare is how it is drawn. A melodic track is pitch
 * against time and a percussive one is lanes; those are genuinely different
 * pictures, and two of a thing is not a pattern worth an abstraction. The role
 * names which you get, and that is as far as it goes.
 */

/** What kind of thing a track is, which decides how it is read. */
export type TrackRole =
  /** The recording itself. Read by nothing: it is the thing being read. */
  | 'recording'
  /** Notes with pitch — a melody, a bass line (INV-NOTES-115). */
  | 'melodic'
  /** Struck sounds with no pitch (INV-PITCH-025). */
  | 'percussive'
  /** A scaffold the app produces rather than reads: the click. */
  | 'timing';

export interface TrackSpec {
  name: string;
  role: TrackRole;
  /** What the options sheet calls it. */
  title: string;
  /** On before anything is turned. */
  startsOn: boolean;
  /** Where it sits in the mix, 0..1. */
  level: number;
}

/**
 * The tracks, in the order they are drawn and in the order they take buses.
 *
 * Bus numbers come from position rather than being written down, so no two
 * tracks can be given the same one — which is how the click ended up sharing
 * the melody's and silencing the tune along with itself (INV-NOTES-119).
 */
export const TRACKS = [
  {
    name: 'take',
    role: 'recording',
    title: 'Your take',
    startsOn: true,
    // The thing being judged, so it sits at full and everything read from it
    // sits under it (INV-NOTES-082).
    level: 1
  },
  {
    name: 'chords',
    role: 'melodic',
    title: 'Chords read from your take',
    startsOn: true,
    level: 0.7
  },
  {
    name: 'melody',
    role: 'melodic',
    title: 'Transcription of your take',
    startsOn: false,
    level: 0.6
  },
  {
    name: 'rhythm',
    role: 'percussive',
    title: 'Drums read from your take',
    startsOn: false,
    level: 0.6
  },
  {
    name: 'count',
    role: 'timing',
    title: 'Count-in',
    startsOn: false,
    // Faint. It is there to be followed, not listened to, and a loud click
    // over a quiet take is the take you stop hearing.
    level: 0.35
  }
] as const satisfies readonly TrackSpec[];

export type TrackName = (typeof TRACKS)[number]['name'];

const byName = new Map<string, TrackSpec>(
  TRACKS.map((track) => [track.name, track])
);

/** What a track declared about itself. */
export function trackSpec(name: TrackName): TrackSpec {
  return byName.get(name) as TrackSpec;
}

/**
 * Which mixer bus a track sounds on.
 *
 * Its position in the list. The synth's whole notion of a bus is an index
 * into a level array — it has never known what "chords" means, and naming
 * them natively was the only reason a new track needed a build
 * (INV-NOTES-121).
 */
export function trackBus(name: TrackName): number {
  return TRACKS.findIndex((track) => track.name === name);
}

/** Every track of a kind, for anything that treats them alike. */
export const tracksWithRole = (role: TrackRole): TrackName[] =>
  TRACKS.filter((track) => track.role === role).map((track) => track.name);
