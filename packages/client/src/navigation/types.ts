import type { RecordingHandle } from '../audio/contract';

/**
 * Parameters that identify a practice exercise — passed (serialisably) through
 * navigation so the session and Results can rebuild the same `TargetNote[]` from
 * the `logic` catalogue. Kept as id + transposition rather than the note array
 * so route params stay small and JSON-safe.
 */
export interface PracticeParams {
  /** Catalogue id (see `logic` PRACTICE_MELODIES). */
  melodyId: string;
  /** Tonic MIDI the exercise is built from. */
  rootMidi: number;
  /** Duration of each note in ms. */
  noteDurationMs: number;
}

/**
 * Route maps for the app. Screens are typed against these via
 * `NativeStackScreenProps`/`BottomTabScreenProps`.
 */
export type RootStackParamList = {
  Main: undefined;
  PracticeSession: PracticeParams;
  /** `practice` is set when the take was sung against a target melody. */
  Results: { handle: RecordingHandle; practice?: PracticeParams };
  /** A single note's detail / analysis, addressed by id. */
  NoteDetail: { id: string };
  /** Consolidated Account & Settings, reached from a header button. */
  Account: undefined;
};

/** Unauthenticated stack, shown when there is no Supabase session. */
export type AuthStackParamList = {
  Login: undefined;
};

export type MainTabParamList = {
  Practice: undefined;
  Notes: undefined;
  Dashboard: undefined;
};
