//
//  SampleStore.mm — see SampleStore.h.
//

#import "SampleStore.h"

#import "SampleDecode.h"

#include <vector>

#include "synth.h"
#include "synth_commands.h"
#include "synth_mailbox.h"

namespace {

/// How long after a voice's last scheduled moment its audio is still assumed
/// to be in use.
///
/// Comfortably past the release ramp, which is the only thing that can keep a
/// voice sounding beyond its end. Being generous costs a few megabytes for a
/// moment; being tight costs a read of freed memory on the audio thread,
/// which is a crash rather than a glitch (INV-NOTES-133).
constexpr double kGraceMs = 1000.0;

/// One buffer no longer reachable from a slot, and when it stops mattering.
struct Retired {
  micdrp::Frames frames;
  double freeAfterMs = 0.0;
};

}  // namespace

@implementation SampleStore {
  micdrp::SynthMailbox *_mailbox;
  double _sampleRate;
  micdrp::Frames _slots[micdrp::kMaxSamples];
  double _scheduledUntilMs[micdrp::kMaxSamples];
  std::vector<Retired> _retired;
}

- (instancetype)initWithMailbox:(micdrp::SynthMailbox *)mailbox
                     sampleRate:(double)sampleRateHz {
  if (self = [super init]) {
    _mailbox = mailbox;
    _sampleRate = sampleRateHz;
  }
  return self;
}

- (BOOL)holds:(int)slot {
  return slot >= 0 && slot < micdrp::kMaxSamples;
}

- (double)loadSlot:(double)slot
              path:(NSString *)path
             nowMs:(double)nowMs
             error:(NSError **)error {
  const int index = (int)slot;
  if (![self holds:index]) {
    if (error) {
      *error = [NSError errorWithDomain:@"micdrp.SampleStore"
                                   code:1
                               userInfo:@{
                                 NSLocalizedDescriptionKey : @"no such slot"
                               }];
    }
    return -1;
  }
  micdrp::Frames frames = micdrp::decodeSample(path, _sampleRate, error);
  if (frames == nullptr) {
    return -1;
  }
  // Freed here rather than on a timer: this is the moment memory is about to
  // be spent, and the clock has moved on since the last retirement.
  [self retire:index atMs:nowMs];
  _slots[index] = frames;
  _scheduledUntilMs[index] = 0.0;
  micdrp::postSetSample(*_mailbox, slot, frames->data(), frames->size());
  return (double)frames->size() / _sampleRate * 1000.0;
}

- (void)unloadSlot:(double)slot nowMs:(double)nowMs {
  const int index = (int)slot;
  if (![self holds:index]) {
    return;
  }
  micdrp::postSetSample(*_mailbox, slot, nullptr, 0);
  [self retire:index atMs:nowMs];
}

- (void)scheduleSlot:(double)slot
                 bus:(double)bus
              fromMs:(double)fromMs
             startMs:(double)startMs
               endMs:(double)endMs {
  const int index = (int)slot;
  if (![self holds:index]) {
    return;
  }
  // Recorded before the command is posted, so a retirement racing this call
  // still waits for it (INV-NOTES-133).
  if (endMs > _scheduledUntilMs[index]) {
    _scheduledUntilMs[index] = endMs;
  }
  micdrp::postScheduleSample(*_mailbox, bus, slot, fromMs, startMs, endMs,
                             _sampleRate);
}

/// Move a slot's audio to the graveyard, dated by how far it was scheduled,
/// and release everything the clock has already passed.
- (void)retire:(int)slot atMs:(double)nowMs {
  if (_slots[slot] != nullptr) {
    _retired.push_back(
        Retired{_slots[slot], _scheduledUntilMs[slot] + kGraceMs});
    _slots[slot] = nullptr;
    _scheduledUntilMs[slot] = 0.0;
  }
  for (auto it = _retired.begin(); it != _retired.end();) {
    it = (nowMs >= it->freeAfterMs) ? _retired.erase(it) : it + 1;
  }
}

- (void)releaseAll {
  for (micdrp::Frames &slot : _slots) {
    slot = nullptr;
  }
  for (double &until : _scheduledUntilMs) {
    until = 0.0;
  }
  _retired.clear();
}

@end
