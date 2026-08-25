//
//  SampleStore.h
//  micdrp
//
//  The recorded audio the engine holds, and the one hard rule about freeing
//  it (INV-NOTES-133).
//
//  A take is decoded once and handed to the audio thread as a bare pointer,
//  which is what lets the render callback stay allocation-free and lock-free.
//  The cost of that is that nothing may free a buffer while a voice might
//  still be reading it, and the audio thread cannot be asked. So this
//  remembers how far into the future each slot has been scheduled, and a
//  retired buffer is released only once the clock has passed everything that
//  could have been reading it.
//
//  It posts to the mailbox itself rather than handing frames back, because
//  loading and scheduling are the two ends of the same promise: nothing may
//  schedule audio this has not loaded, and nothing may free audio this has
//  scheduled. Splitting them would put both halves of that rule somewhere
//  else.
//

#ifndef SampleStore_h
#define SampleStore_h

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

namespace micdrp {
class SynthMailbox;
}

@interface SampleStore : NSObject

/// The mailbox is owned by the engine and outlives this. The rate is the
/// engine's own render rate, which is what everything is decoded to.
- (instancetype)initWithMailbox:(micdrp::SynthMailbox *)mailbox
                     sampleRate:(double)sampleRateHz;

/// Decode a file into `slot` and hand it to the audio thread. Returns the
/// audio's length in ms, or -1 with `error` set. Blocking, and deliberately
/// so: a take is decoded once, not per press.
- (double)loadSlot:(double)slot
              path:(NSString *)path
             nowMs:(double)nowMs
             error:(NSError **)error;

/// Give a slot back. The audio is freed once nothing can still read it.
- (void)unloadSlot:(double)slot nowMs:(double)nowMs;

/// Sound a passage of loaded audio on a bus, between two moments on the
/// engine's clock — the same clock every tone is scheduled against, which is
/// the whole point of the take living here.
- (void)scheduleSlot:(double)slot
                 bus:(double)bus
              fromMs:(double)fromMs
             startMs:(double)startMs
               endMs:(double)endMs;

/// Drop everything, whatever is sounding. Only for teardown, when the audio
/// thread is known to have stopped.
- (void)releaseAll;

@end

NS_ASSUME_NONNULL_END

#endif /* SampleStore_h */
