import type { RecordingHandle } from '../audio/contract';

/**
 * Route maps for the app. Screens are typed against these via
 * `NativeStackScreenProps`/`BottomTabScreenProps`.
 */
export type RootStackParamList = {
  Main: undefined;
  Results: { handle: RecordingHandle };
};

export type MainTabParamList = {
  Record: undefined;
  Library: undefined;
  Settings: undefined;
};
