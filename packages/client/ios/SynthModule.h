//
//  SynthModule.h
//  micdrp
//
//  One voice pool, one clock, for everything the app sounds (iOS).
//
//  AVAudioSourceNode pulls samples from the shared C++ Synth
//  (packages/client/cpp/dsp/synth.h); JS calls cross to the audio thread
//  through the lock-free SynthMailbox, so the render callback never takes a
//  lock (INV-NOTES-028).
//
//  A TurboModule: the interface is declared once in src/specs/NativeSynth.ts,
//  codegen derives NativeSynthSpec from it, and this class implements that
//  protocol. The JS app never imports it directly; it goes through
//  src/audio/synthPlayer.ts, which falls back when the binary lacks this
//  module (INV-NOTES-030).
//

#ifndef SynthModule_h
#define SynthModule_h

#import <AppSpecs/AppSpecs.h>

@interface SynthModule : NativeSynthSpecBase <NativeSynthSpec>

@end

#endif /* SynthModule_h */
