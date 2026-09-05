//
//  SampleStore.mm — see SampleStore.h.
//

#import "SampleStore.h"

#import "SampleDecode.h"

#include <atomic>
#include <fcntl.h>
#include <memory>
#include <thread>
#include <unistd.h>
#include <vector>

#include "sample_stream.h"
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

/**
 * How much of a streamed take is kept ahead of the playhead, in seconds.
 *
 * Four seconds of sixteen-bit mono is 375 KB a slot. The reader wakes every
 * few milliseconds, so this is three orders of magnitude more headroom than
 * it needs — which is the point: an underrun is audible and a few hundred
 * kilobytes are not (INV-TPORT-028).
 */
constexpr double kWindowSeconds = 4.0;

/// How often the reader looks at whether a window wants filling.
constexpr std::chrono::milliseconds kReaderTick{5};

/// How much it reads at a time when one does.
constexpr std::size_t kReadFrames = 8192;

/// A take too long to hold, read from its cache file as it plays.
struct Streamed {
  int fd = -1;                          ///< the cache file, opened once
  std::vector<std::int16_t> window;     ///< what the reader fills
  std::unique_ptr<micdrp::SampleStream> stream;
  std::int64_t frameCount = 0;
  std::int64_t filePos = 0;             ///< reader thread only
  std::uint64_t servedGeneration = 0;   ///< reader thread only

  ~Streamed() {
    if (fd >= 0) {
      close(fd);
    }
  }
};

/// A window no longer reachable from a slot, and when it stops mattering.
struct RetiredWindow {
  std::unique_ptr<Streamed> held;
  double freeAfterMs = 0.0;
};

}  // namespace

@implementation SampleStore {
  micdrp::SynthMailbox *_mailbox;
  double _sampleRate;
  micdrp::Frames _slots[micdrp::kMaxSamples];
  std::unique_ptr<Streamed> _streamed[micdrp::kMaxSamples];
  double _scheduledUntilMs[micdrp::kMaxSamples];
  std::vector<Retired> _retired;
  std::vector<RetiredWindow> _retiredWindows;
  /// Fills every streamed window. One thread for all of them: they are read
  /// sequentially and a take at a time, so there is nothing to parallelise.
  std::thread _reader;
  std::atomic<bool> _readerRunning;
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
  // Converted once, on first sight, and read straight from disk after
  // (INV-TPORT-027).
  NSURL *cache = micdrp::frameCacheFor(path, _sampleRate, error);
  if (cache == nil) {
    return -1;
  }
  const std::int64_t frames = micdrp::frameCountOf(cache);
  if (frames <= 0) {
    if (error) {
      *error = [NSError errorWithDomain:@"micdrp.SampleStore"
                                   code:2
                               userInfo:@{
                                 NSLocalizedDescriptionKey :
                                     @"this take decoded to no audio"
                               }];
    }
    return -1;
  }
  // Freed here rather than on a timer: this is the moment memory is about to
  // be spent, and the clock has moved on since the last retirement.
  [self retire:index atMs:nowMs];
  _scheduledUntilMs[index] = 0.0;

  const std::int64_t residentMax =
      (std::int64_t)(micdrp::kResidentMaxSeconds * _sampleRate);
  const BOOL ok = frames <= residentMax
                      ? [self holdSlot:index from:cache error:error]
                      : [self streamSlot:index from:cache frames:frames error:error];
  if (!ok) {
    return -1;
  }
  return (double)frames / _sampleRate * 1000.0;
}

/// A take short enough to hold: the whole of it, resident.
- (BOOL)holdSlot:(int)index from:(NSURL *)cache error:(NSError **)error {
  micdrp::Frames audio = micdrp::residentFrames(cache, error);
  if (audio == nullptr) {
    return NO;
  }
  _slots[index] = audio;
  micdrp::SampleData data;
  data.frames = audio->data();
  data.frameCount = audio->size();
  micdrp::postSetSample(*_mailbox, index, data);
  return YES;
}

/// A take too long to hold: a window, and a thread that keeps it ahead of
/// the playhead (INV-TPORT-028).
- (BOOL)streamSlot:(int)index
              from:(NSURL *)cache
            frames:(std::int64_t)frames
             error:(NSError **)error {
  auto held = std::make_unique<Streamed>();
  held->fd = open(cache.path.fileSystemRepresentation, O_RDONLY);
  if (held->fd < 0) {
    if (error) {
      *error = [NSError errorWithDomain:@"micdrp.SampleStore"
                                   code:3
                               userInfo:@{
                                 NSLocalizedDescriptionKey :
                                     @"could not open this take to read it"
                               }];
    }
    return NO;
  }
  held->frameCount = frames;
  held->window.assign((std::size_t)(kWindowSeconds * _sampleRate), 0);
  held->stream = std::make_unique<micdrp::SampleStream>();
  held->stream->attach(held->window.data(), held->window.size(), frames);

  micdrp::SampleData data;
  data.stream = held->stream.get();
  // Published before the pointer is handed over, so the audio thread can
  // never see a stream that is not yet pointing at its window.
  _streamed[index] = std::move(held);
  micdrp::postSetSample(*_mailbox, index, data);
  [self startReader];
  return YES;
}

/// The reader, started when something first needs one and stopped at teardown.
- (void)startReader {
  if (_readerRunning.load()) {
    return;
  }
  _readerRunning.store(true);
  // Weak, resolved once. The thread then holds the store for as long as it
  // runs, which is what we want — it stops when the flag clears, not when
  // the last other reference goes.
  __weak SampleStore *weakSelf = self;
  _reader = std::thread([weakSelf]() {
    SampleStore *me = weakSelf;
    if (me != nil) {
      [me fillWindows];
    }
  });
}

- (void)dealloc {
  // The thread writes into windows this is about to free. Nothing else in
  // here is safe until it has stopped.
  if (_readerRunning.exchange(false) && _reader.joinable()) {
    _reader.join();
  }
}

/**
 * Keep every streamed window full. Runs off both the audio thread and the
 * JS thread, so it may block on a read and nothing waits for it.
 */
- (void)fillWindows {
  std::vector<std::int16_t> scratch(kReadFrames);
  while (_readerRunning.load()) {
    for (auto &held : _streamed) {
      if (held == nullptr || held->stream == nullptr) {
        continue;
      }
      micdrp::SampleStream &stream = *held->stream;
      // A locate: the audio thread admitted a voice somewhere else, so what
      // the window holds describes a moment nobody is listening to.
      const std::uint64_t generation = stream.generation();
      if (generation != held->servedGeneration) {
        held->servedGeneration = generation;
        held->filePos = stream.startPos();
        stream.rewindTo(held->filePos);
      }
      while (stream.room() > 0 && held->filePos < held->frameCount) {
        const std::size_t want =
            std::min(scratch.size(), (std::size_t)stream.room());
        const ssize_t got =
            pread(held->fd, scratch.data(), want * sizeof(std::int16_t),
                  held->filePos * (off_t)sizeof(std::int16_t));
        if (got <= 0) {
          break;  // the cache was reclaimed under us; silence, not a crash
        }
        const std::size_t read = (std::size_t)got / sizeof(std::int16_t);
        held->filePos += (std::int64_t)stream.supply(scratch.data(), read);
      }
    }
    std::this_thread::sleep_for(kReaderTick);
  }
}

- (void)unloadSlot:(double)slot nowMs:(double)nowMs {
  const int index = (int)slot;
  if (![self holds:index]) {
    return;
  }
  micdrp::postSetSample(*_mailbox, slot, micdrp::SampleData{});
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
  if (_streamed[slot] != nullptr) {
    // A window cannot go in the graveyard: the reader thread would go on
    // writing into it. Told to stop pointing at it first, then dropped
    // after the same grace every resident buffer gets — by which time no
    // voice can still be inside it (INV-NOTES-133).
    micdrp::postSetSample(*_mailbox, slot, micdrp::SampleData{});
    _retiredWindows.push_back(
        RetiredWindow{std::move(_streamed[slot]),
                      _scheduledUntilMs[slot] + kGraceMs});
    _streamed[slot] = nullptr;
  }
  for (auto it = _retiredWindows.begin(); it != _retiredWindows.end();) {
    it = (nowMs >= it->freeAfterMs) ? _retiredWindows.erase(it) : it + 1;
  }
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
  // The thread first: it writes into windows that are about to go away.
  if (_readerRunning.exchange(false) && _reader.joinable()) {
    _reader.join();
  }
  for (auto &held : _streamed) {
    held.reset();
  }
  for (micdrp::Frames &slot : _slots) {
    slot = nullptr;
  }
  for (double &until : _scheduledUntilMs) {
    until = 0.0;
  }
  _retired.clear();
}

@end
