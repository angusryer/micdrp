//
//  SynthModule.mm
//  micdrp
//
//  Platform shell over the C++ synth core: it does nothing but hand samples
//  to an output. JS-thread calls become SynthCommands posted through the
//  lock-free mailbox; the AVAudioSourceNode render block drains them and
//  renders, so the Synth is only ever touched by the audio thread.
//

#import "SynthModule.h"

#import <AVFoundation/AVFoundation.h>
#import <React/RCTLog.h>

#include <atomic>
#include <cmath>

#include "synth.h"
#include "synth_mailbox.h"

using micdrp::Bus;
using micdrp::ScheduledNote;
using micdrp::SynthCommand;

namespace {

Bus toBus(double v) {
  const int i = (int)v;
  return (i >= 0 && i < (int)Bus::Count) ? (Bus)i : Bus::Melody;
}

}  // namespace

@implementation SynthModule {
  AVAudioEngine *_engine;
  AVAudioSourceNode *_source;
  micdrp::Synth _synth;          // audio-thread only once the engine runs
  micdrp::SynthMailbox _mailbox; // JS thread posts, render block drains
  std::atomic<std::int64_t> _renderedSamples;
  double _sampleRate;
  std::atomic<bool> _running;
  BOOL _ownsSession;             // we activated Playback, so we deactivate it
}

RCT_EXPORT_MODULE(NativeSynth)

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeSynthSpecJSI>(params);
}

- (dispatch_queue_t)methodQueue {
  return dispatch_get_main_queue();
}

/// RCTBridgeModule's optional teardown hook — a reload must not leave an
/// engine running against a module instance that is going away.
- (void)invalidate {
  [self teardown];
}

#pragma mark - exported methods

- (void)start:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  if (_running.load()) {
    resolve(nil);
    return;
  }

  // Capture already holds the session with PlayAndRecord, which permits
  // playback — changing category under it would kill the input tap. Claim
  // Playback only when nobody claimed anything better.
  NSError *err = nil;
  AVAudioSession *session = [AVAudioSession sharedInstance];
  if (![session.category isEqualToString:AVAudioSessionCategoryPlayAndRecord]) {
    [session setCategory:AVAudioSessionCategoryPlayback error:&err];
    [session setActive:YES error:&err];
    if (err) {
      reject(@"session_failed", err.localizedDescription, err);
      return;
    }
    _ownsSession = YES;
  }

  _engine = [[AVAudioEngine alloc] init];
  const double hwRate = [_engine.outputNode outputFormatForBus:0].sampleRate;
  _sampleRate = hwRate > 0 ? hwRate : 48000.0;
  _synth.configure(_sampleRate);
  _mailbox.drain(_synth);  // stale commands from a previous run, discarded
  _synth.clearAll();
  _renderedSamples = 0;

  // Locals, so the block captures raw pointers rather than retaining self.
  micdrp::Synth *synth = &_synth;
  micdrp::SynthMailbox *mailbox = &_mailbox;
  std::atomic<std::int64_t> *clock = &_renderedSamples;

  AVAudioFormat *fmt =
      [[AVAudioFormat alloc] initWithCommonFormat:AVAudioPCMFormatFloat32
                                       sampleRate:_sampleRate
                                         channels:1
                                      interleaved:NO];
  _source = [[AVAudioSourceNode alloc]
      initWithFormat:fmt
         renderBlock:^OSStatus(BOOL *isSilence, const AudioTimeStamp *ts,
                               AVAudioFrameCount frameCount, AudioBufferList *out) {
           mailbox->drain(*synth);
           synth->render((float *)out->mBuffers[0].mData, frameCount);
           clock->fetch_add(frameCount, std::memory_order_relaxed);
           return noErr;
         }];

  [_engine attachNode:_source];
  [_engine connect:_source to:_engine.mainMixerNode format:fmt];
  [_engine prepare];
  if (![_engine startAndReturnError:&err]) {
    [self teardown];
    reject(@"engine_failed", err.localizedDescription, err);
    return;
  }
  _running = true;
  resolve(nil);
}

- (void)stop:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  [self teardown];
  resolve(nil);
}

- (void)teardown {
  _running = false;
  if (_engine) {
    [_engine stop];
    if (_source) {
      [_engine detachNode:_source];
    }
  }
  _source = nil;
  _engine = nil;
  if (_ownsSession) {
    [[AVAudioSession sharedInstance]
        setActive:NO
      withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation
            error:nil];
    _ownsSession = NO;
  }
}

- (NSNumber *)nowMs {
  if (!_running.load()) {
    return @0;
  }
  const double samples = (double)_renderedSamples.load(std::memory_order_relaxed);
  return @(samples / _sampleRate * 1000.0);
}

- (void)post:(const SynthCommand &)command {
  if (!_mailbox.post(command)) {
    RCTLogWarn(@"SynthModule: mailbox full, command dropped");
  }
}

- (void)setBusLevel:(double)bus level:(double)level {
  SynthCommand c;
  c.kind = SynthCommand::Kind::SetBusLevel;
  c.bus = toBus(bus);
  c.level = (float)level;
  [self post:c];
}

- (void)schedule:(NSArray *)notes {
  if (!_running.load()) {
    RCTLogWarn(@"SynthModule: schedule before start, notes dropped");
    return;
  }
  const double samplesPerMs = _sampleRate / 1000.0;
  for (NSDictionary *note in notes) {
    SynthCommand c;
    c.kind = SynthCommand::Kind::Schedule;
    c.note = ScheduledNote{
        toBus([note[@"bus"] doubleValue]),
        (float)[note[@"frequencyHz"] doubleValue],
        (std::int64_t)llround([note[@"startMs"] doubleValue] * samplesPerMs),
        (std::int64_t)llround([note[@"endMs"] doubleValue] * samplesPerMs)};
    [self post:c];
  }
}

- (void)clearBus:(double)bus {
  SynthCommand c;
  c.kind = SynthCommand::Kind::ClearBus;
  c.bus = toBus(bus);
  [self post:c];
}

- (void)clearAll {
  SynthCommand c;
  c.kind = SynthCommand::Kind::ClearAll;
  [self post:c];
}

@end
