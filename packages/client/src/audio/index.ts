/**
 * Public audio barrel — the only audio surface screens/hooks/machines import.
 *
 * Re-exports the engine singleton, the React hook, and the contract types so
 * consumers never reach into the native module, the worklet, or the contract
 * file directly.
 */

export { audioEngine, default } from './AudioEngine';
export { useAudioEngine } from './useAudioEngine';
export type { UseAudioEngine } from './useAudioEngine';

export type {
  AudioEngine,
  EngineConfig,
  EngineState,
  PitchSample,
  RecordingHandle
} from './contract';
export { DEFAULT_ENGINE_CONFIG } from './contract';

export { createReferenceTonePlayer } from './referenceTone';
export type {
  ReferenceTonePlayer,
  ReferenceToneOptions,
  AudioContextLike
} from './referenceTone';
