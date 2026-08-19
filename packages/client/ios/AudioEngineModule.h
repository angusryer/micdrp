//
//  AudioEngineModule.h
//  micdrp
//
//  Tier-1 native audio engine (iOS).
//
//  AVAudioEngine input tap at the configured sample rate -> C++ PitchEngine
//  (packages/client/cpp/dsp) -> throttled PitchSample events to JS.
//
//  This is a TurboModule: the interface is declared once in
//  src/specs/NativeAudioEngine.ts, codegen derives NativeAudioEngineSpec from
//  it, and this class implements that protocol. A drift between the JS contract
//  and this implementation is a compile error rather than a runtime undefined.
//
//  The JS app never imports this directly; it goes through
//  src/audio/AudioEngine.ts.
//

#ifndef AudioEngineModule_h
#define AudioEngineModule_h

#import <AppSpecs/AppSpecs.h>

@interface AudioEngineModule : NativeAudioEngineSpecBase <NativeAudioEngineSpec>

@end

#endif /* AudioEngineModule_h */
