//
//  AudioEngineModule.h
//  micdrp
//
//  WP-AUDIO-BRIDGE — Tier-1 native audio engine (iOS).
//
//  AVAudioEngine input tap at the configured sample rate -> C++ PitchEngine
//  (packages/client/cpp/dsp) -> throttled PitchSample events via RCTEventEmitter.
//
//  The JS app never imports this directly; it goes through
//  src/audio/AudioEngine.ts, which selects this module when present.
//

#ifndef AudioEngineModule_h
#define AudioEngineModule_h

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface AudioEngineModule : RCTEventEmitter <RCTBridgeModule>

@end

#endif /* AudioEngineModule_h */
