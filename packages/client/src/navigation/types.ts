import type { RecordingHandle } from '../audio/contract';

/**
 * Route maps for the app. Screens are typed against these via
 * `NativeStackScreenProps`/`BottomTabScreenProps`.
 */
export type RootStackParamList = {
  Main: undefined;
  Results: { handle: RecordingHandle };
};

/** Unauthenticated stack, shown when there is no Supabase session. */
export type AuthStackParamList = {
  Login: undefined;
};

export type MainTabParamList = {
  Record: undefined;
  Library: undefined;
  Profile: undefined;
  Settings: undefined;
};
