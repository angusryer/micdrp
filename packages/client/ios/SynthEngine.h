//
//  SynthEngine.h
//  micdrp
//
//  The audio side of the one synth: an AVAudioEngine source node pulling the
//  shared C++ core (packages/client/cpp/dsp/synth.h), and the lock-free
//  mailbox that carries calls from any other thread to the render callback.
//
//  Split from SynthModule so the TurboModule is bridge plumbing and this is
//  the thing that makes sound. Deliberately free of React types: what it
//  needs from a caller is doubles and an error out-parameter.
//
//  Every method here is safe to call from outside the audio thread; nothing
//  here blocks it.
//

#ifndef SynthEngine_h
#define SynthEngine_h

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface SynthEngine : NSObject

/// Bring the engine up: session, source node, clock at zero. Idempotent
/// while running. NO on failure, with `error` set.
- (BOOL)startAndReturnError:(NSError **)error;

/// Tear it down and release any claim this engine made on the audio session.
/// Safe to call repeatedly, and safe when never started.
- (void)stop;

/// Where the clock has reached, in ms since start; 0 when not running.
- (double)nowMs;

/// Bus index as the JS contract numbers them: 0 Take, 1 Melody, 2 Chords,
/// 3 Audition. Anything else is treated as Melody rather than refused —
/// there is no sensible way to fail a level change on the audio path.
- (void)setBusLevel:(double)bus level:(double)level;

/// Schedule one note. Times are absolute ms on this engine's own clock, the
/// one `nowMs` reads.
- (void)scheduleBus:(double)bus
        frequencyHz:(double)frequencyHz
            startMs:(double)startMs
              endMs:(double)endMs;

/// Decode a recorded take into slot `slot`, ready to be scheduled like any
/// other sound (INV-NOTES-133). Returns its length in ms, or -1 with `error`
/// set. Blocking: call it off the main thread.
- (double)loadSample:(double)slot
                path:(NSString *)path
               error:(NSError **)error;

/// Give a slot back. The audio is freed once nothing can still be reading it.
- (void)unloadSample:(double)slot;

/// Schedule recorded audio: which slot, how far into it to begin, and the
/// span on this engine's clock — the same clock `scheduleBus:` uses, which is
/// the whole reason the take lives here.
- (void)scheduleSampleBus:(double)bus
                     slot:(double)slot
                   fromMs:(double)fromMs
                  startMs:(double)startMs
                    endMs:(double)endMs;

/// What a bus sounds like (INV-NOTES-144): 0 sine, 1 triangle, 2 square,
/// 3 saw, 4 noise. Anything else is treated as a sine rather than refused —
/// there is no sensible way to fail a timbre change on the audio path.
- (void)setBusWave:(double)bus wave:(double)wave;

/// Drop what is pending on a bus and release what it has sounding.
- (void)clearBus:(double)bus;
- (void)clearAll;

/// Begin a run: time passing from `fromMs` of the material, at `startMs`
/// on the engine clock, until `endMs`. Separate from scheduling the audio
/// (INV-TPORT-013).
- (void)startTransportFromMs:(double)fromMs
                     startMs:(double)startMs
                       endMs:(double)endMs;

/// End the run now. The position stays where it reached.
- (void)stopTransport;

/// What the engine is doing, as one consistent snapshot (INV-TPORT-012).
- (NSDictionary *)transportReport;

@end

NS_ASSUME_NONNULL_END

#endif /* SynthEngine_h */
