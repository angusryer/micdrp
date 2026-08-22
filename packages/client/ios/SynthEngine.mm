//
//  SynthEngine.mm — see SynthEngine.h.
//

#import "SynthEngine.h"

#import "AudioSessionClaim.h"

#import <AVFoundation/AVFoundation.h>
#import <React/RCTLog.h>

#include <atomic>

#include "synth.h"
#include "synth_commands.h"
#include "synth_mailbox.h"

namespace {

/// What the synth renders at, whatever the hardware currently wants.
///
/// Taking the hardware's rate would mean a route change changes what a
/// sample position means, and the only way to honour that is to reconfigure
/// the Synth — which clears the schedule, so plugging in headphones would
/// stop the music (INV-NOTES-031). The engine converts our format to the
/// output's, so the clock can simply stay still.
constexpr double kRenderSampleRate = 48000.0;

}  // namespace

@implementation SynthEngine {
  AVAudioEngine *_engine;
  AVAudioSourceNode *_source;
  AVAudioFormat *_renderFormat;  // ours, not the hardware's (INV-NOTES-031)
  id _configObserver;
  micdrp::Synth _synth;          // audio-thread only once the engine runs
  micdrp::SynthMailbox _mailbox; // other threads post, render block drains
  std::atomic<std::int64_t> _renderedSamples;
  std::atomic<bool> _running;
  AudioSessionClaim *_session;
}

- (instancetype)init {
  if (self = [super init]) {
    _session = [[AudioSessionClaim alloc] init];
  }
  return self;
}

/// The render block holds raw pointers into these ivars, so the engine must
/// be stopped before they go away. Releasing it and hoping is not enough:
/// the audio thread can be inside the block at the moment this returns.
- (void)dealloc {
  [self stop];
}

- (BOOL)startAndReturnError:(NSError **)error {
  if (_running.load()) {
    return YES;
  }
  if (![_session claimForPlaybackOrError:error]) {
    return NO;
  }

  _engine = [[AVAudioEngine alloc] init];
  _synth.configure(kRenderSampleRate);
  _mailbox.drain(_synth);  // stale commands from a previous run, discarded
  _synth.clearAll();
  _renderedSamples = 0;
  _renderFormat =
      [[AVAudioFormat alloc] initWithCommonFormat:AVAudioPCMFormatFloat32
                                       sampleRate:kRenderSampleRate
                                         channels:1
                                      interleaved:NO];

  // Locals, so the render block captures raw pointers rather than retaining
  // self — a retain cycle here would keep an audio engine alive forever.
  micdrp::Synth *synth = &_synth;
  micdrp::SynthMailbox *mailbox = &_mailbox;
  std::atomic<std::int64_t> *clock = &_renderedSamples;
  _source = [[AVAudioSourceNode alloc]
      initWithFormat:_renderFormat
         renderBlock:^OSStatus(BOOL *isSilence, const AudioTimeStamp *ts,
                               AVAudioFrameCount frames, AudioBufferList *out) {
           mailbox->drain(*synth);
           synth->render((float *)out->mBuffers[0].mData, frames);
           clock->fetch_add(frames, std::memory_order_relaxed);
           return noErr;
         }];

  [_engine attachNode:_source];
  [_engine connect:_source to:_engine.mainMixerNode format:_renderFormat];
  [self observeConfigurationChanges];
  [_engine prepare];
  if (![_engine startAndReturnError:error]) {
    [self stop];
    return NO;
  }
  _running = true;
  return YES;
}

/// A configuration change tears the graph's connections down and stops the
/// engine. Nothing restarts it on its own, so an unobserved engine goes
/// silent for the rest of the session the first time headphones appear
/// (INV-NOTES-031).
- (void)observeConfigurationChanges {
  __weak SynthEngine *weakSelf = self;
  _configObserver = [[NSNotificationCenter defaultCenter]
      addObserverForName:AVAudioEngineConfigurationChangeNotification
                  object:_engine
                   queue:[NSOperationQueue mainQueue]
              usingBlock:^(NSNotification *note) {
                [weakSelf reconnectAfterConfigurationChange];
              }];
}

- (void)reconnectAfterConfigurationChange {
  if (!_running.load() || _engine == nil || _source == nil) {
    return;
  }
  // The Synth is deliberately left alone: its clock and everything scheduled
  // on it still describe the same moments, because what we render is our own
  // format rather than the hardware's.
  [_engine connect:_source to:_engine.mainMixerNode format:_renderFormat];
  NSError *err = nil;
  if (!_engine.isRunning && ![_engine startAndReturnError:&err]) {
    RCTLogWarn(@"SynthEngine: restart after route change failed: %@",
               err.localizedDescription);
  }
}

- (void)stop {
  _running = false;
  if (_configObserver) {
    [[NSNotificationCenter defaultCenter] removeObserver:_configObserver];
    _configObserver = nil;
  }
  [_engine stop];
  if (_engine && _source) {
    [_engine detachNode:_source];
  }
  _source = nil;
  _engine = nil;
  [_session relinquish];
}

- (double)nowMs {
  if (!_running.load()) {
    return 0;
  }
  const double samples = (double)_renderedSamples.load(std::memory_order_relaxed);
  return samples / kRenderSampleRate * 1000.0;
}

/// A full ring means a command was refused rather than applied, which is
/// worth saying out loud: the note that did not make it is one the singer
/// asked to hear.
- (void)warnIfRefused:(BOOL)accepted {
  if (!accepted) {
    RCTLogWarn(@"SynthEngine: mailbox full, command dropped");
  }
}

- (void)setBusLevel:(double)bus level:(double)level {
  [self warnIfRefused:micdrp::postBusLevel(_mailbox, bus, level)];
}

- (void)scheduleBus:(double)bus
        frequencyHz:(double)frequencyHz
            startMs:(double)startMs
              endMs:(double)endMs {
  if (!_running.load()) {
    return;  // nothing to sound into; the caller starts the engine first
  }
  [self warnIfRefused:micdrp::postSchedule(_mailbox, bus, frequencyHz, startMs,
                                           endMs, kRenderSampleRate)];
}

- (void)clearBus:(double)bus {
  [self warnIfRefused:micdrp::postClearBus(_mailbox, bus)];
}

- (void)clearAll {
  [self warnIfRefused:micdrp::postClearAll(_mailbox)];
}

@end
