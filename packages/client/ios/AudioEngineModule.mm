//
//  AudioEngineModule.mm
//  micdrp
//
//  WP-AUDIO-BRIDGE — Tier-1 native audio engine (iOS).
//
//  Pipeline:
//    AVAudioEngine input tap (real-time audio thread)
//      -> feed Float32 frames into the shared C++ PitchEngine (cpp/dsp)
//      -> PitchEngine runs MPM (mpm.h) + note conversion (notes.h) over hops
//      -> emit throttled PitchSample dictionaries to JS via RCTEventEmitter
//    Raw PCM never crosses into JS. Captured audio is written to a .caf file
//    for the RecordingHandle uri; the full (un-throttled) analysis is returned
//    from stop().
//
//  The C++ DSP core is owned by WP-DSP-CORE under packages/client/cpp/dsp.
//  This file references only its public headers; the Podspec/Xcode project add
//  cpp/dsp/*.cpp to the compile sources (see docs/NATIVE_SETUP.md).
//

#import "AudioEngineModule.h"

#import <AVFoundation/AVFoundation.h>
#import <React/RCTLog.h>

#include <atomic>
#include <memory>
#include <mutex>
#include <vector>

// Shared C++ DSP core (WP-DSP-CORE): the mechanical port of packages/logic's
// MPM detector + note conversion (golden-parity tested against the TS oracle).
// This bridge owns only the *streaming* shell (hop buffering + throttling); the
// math lives in cpp/dsp so there is a single source of truth.
#include "mpm.h"    // micdrp::dsp::detectPitch, MpmOptions, PitchResult
#include "notes.h"  // micdrp::dsp::frequencyToNote, NoteReading

namespace {

// Engine config (mirrors DEFAULT_ENGINE_CONFIG in contract.ts).
struct EngineConfig {
  double sampleRateHz = 44100.0;
  int frameSize = 2048;
  int hopSize = 1024;
  double minFrequencyHz = 70.0;
  double maxFrequencyHz = 1200.0;
  double clarityThreshold = 0.9;
  double emitRateHz = 60.0;
};

// One analysed hop (matches the contract PitchSample; `voiced` flags null midi/cents).
struct PitchSample {
  double timestampMs = 0;
  double frequencyHz = 0;
  double clarity = 0;
  int midi = 0;
  int cents = 0;
  bool voiced = false;
};

// Streaming MPM over a sliding frame: buffers PCM into `frameSize` windows,
// advancing by `hopSize`, and appends one PitchSample per full window. Pure C++
// so it stays off any managed runtime.
class PitchEngine {
 public:
  explicit PitchEngine(const EngineConfig &cfg) : cfg_(cfg) {
    buffer_.reserve(static_cast<size_t>(cfg.frameSize) * 2);
  }

  // Append `count` mono float samples captured at `tMs`; emit completed frames.
  void push(const float *mono, int count, double tMs, std::vector<PitchSample> &out) {
    for (int i = 0; i < count; ++i) {
      buffer_.push_back(mono[i]);
    }
    while (static_cast<int>(buffer_.size()) >= cfg_.frameSize) {
      analyzeWindow(tMs, out);
      // Advance by hopSize.
      const int hop = cfg_.hopSize > 0 ? cfg_.hopSize : cfg_.frameSize;
      buffer_.erase(buffer_.begin(), buffer_.begin() + hop);
    }
  }

 private:
  void analyzeWindow(double tMs, std::vector<PitchSample> &out) {
    micdrp::dsp::MpmOptions opts;
    opts.clarityThreshold = cfg_.clarityThreshold;
    opts.minFrequency = cfg_.minFrequencyHz;
    opts.maxFrequency = cfg_.maxFrequencyHz;
    micdrp::dsp::PitchResult r =
        micdrp::dsp::detectPitch(buffer_.data(), cfg_.frameSize, cfg_.sampleRateHz, opts);

    PitchSample s;
    s.timestampMs = tMs;
    s.clarity = r.clarity;
    if (r.voiced && r.clarity >= cfg_.clarityThreshold) {
      micdrp::dsp::NoteReading note = micdrp::dsp::frequencyToNote(r.frequencyHz);
      s.frequencyHz = r.frequencyHz;
      s.midi = note.midi;
      s.cents = note.cents;
      s.voiced = true;
    }
    out.push_back(s);
  }

  EngineConfig cfg_;
  std::vector<float> buffer_;
};

}  // namespace

static NSString *const kPitchEvent = @"AudioEnginePitch";
static NSString *const kStateEvent = @"AudioEngineState";

@implementation AudioEngineModule {
  AVAudioEngine *_engine;
  AVAudioFile *_captureFile;
  NSURL *_captureURL;

  std::shared_ptr<PitchEngine> _pitch;
  std::mutex _pitchMutex;          // guards _pitch + _samples
  std::vector<PitchSample> _samples;

  EngineConfig _config;
  std::atomic<bool> _hasListeners;
  std::atomic<bool> _running;

  double _startHostTime;           // capture start, ms
  double _lastEmitMs;              // last throttled emit, ms
  NSString *_recordingId;
}

RCT_EXPORT_MODULE();

#pragma mark - lifecycle / RCTEventEmitter

- (instancetype)init {
  if (self = [super init]) {
    _config = EngineConfig{};  // C++ defaults mirror DEFAULT_ENGINE_CONFIG
    _hasListeners = false;
    _running = false;
    _lastEmitMs = 0;
  }
  return self;
}

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (NSArray<NSString *> *)supportedEvents {
  return @[ kPitchEvent, kStateEvent ];
}

- (void)startObserving {
  _hasListeners = true;
}

- (void)stopObserving {
  _hasListeners = false;
}

- (dispatch_queue_t)methodQueue {
  return dispatch_get_main_queue();
}

#pragma mark - helpers

- (void)emitState:(NSString *)state {
  if (_hasListeners) {
    [self sendEventWithName:kStateEvent body:state];
  }
}

static double NowMs() {
  return (double)(CACurrentMediaTime() * 1000.0);
}

#pragma mark - exported methods

RCT_EXPORT_METHOD(configure:(NSDictionary *)config
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
  @try {
    std::lock_guard<std::mutex> lock(_pitchMutex);
    if (config[@"sampleRateHz"]) _config.sampleRateHz = [config[@"sampleRateHz"] doubleValue];
    if (config[@"frameSize"]) _config.frameSize = [config[@"frameSize"] intValue];
    if (config[@"hopSize"]) _config.hopSize = [config[@"hopSize"] intValue];
    if (config[@"minFrequencyHz"]) _config.minFrequencyHz = [config[@"minFrequencyHz"] doubleValue];
    if (config[@"maxFrequencyHz"]) _config.maxFrequencyHz = [config[@"maxFrequencyHz"] doubleValue];
    if (config[@"clarityThreshold"]) _config.clarityThreshold = [config[@"clarityThreshold"] doubleValue];
    if (config[@"emitRateHz"]) _config.emitRateHz = [config[@"emitRateHz"] doubleValue];
    resolve(nil);
  } @catch (NSException *e) {
    reject(@"configure_failed", e.reason, nil);
  }
}

RCT_EXPORT_METHOD(requestPermission:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
  AVAudioSession *session = [AVAudioSession sharedInstance];
  AVAudioSessionRecordPermission perm = [session recordPermission];
  if (perm == AVAudioSessionRecordPermissionGranted) {
    resolve(@YES);
    return;
  }
  if (perm == AVAudioSessionRecordPermissionDenied) {
    resolve(@NO);
    return;
  }
  [session requestRecordPermission:^(BOOL granted) {
    resolve(granted ? @YES : @NO);
  }];
}

RCT_EXPORT_METHOD(start:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
  if (_running.load()) {
    resolve(nil);
    return;
  }

  NSError *sessionErr = nil;
  AVAudioSession *session = [AVAudioSession sharedInstance];
  [session setCategory:AVAudioSessionCategoryPlayAndRecord
                  mode:AVAudioSessionModeMeasurement
               options:AVAudioSessionCategoryOptionDefaultToSpeaker
                 error:&sessionErr];
  if (sessionErr) {
    [self emitState:@"error"];
    reject(@"session_failed", sessionErr.localizedDescription, sessionErr);
    return;
  }
  [session setActive:YES error:&sessionErr];
  if (sessionErr) {
    [self emitState:@"error"];
    reject(@"session_failed", sessionErr.localizedDescription, sessionErr);
    return;
  }

  _engine = [[AVAudioEngine alloc] init];
  AVAudioInputNode *input = _engine.inputNode;
  AVAudioFormat *hwFormat = [input outputFormatForBus:0];

  // Build the (re)usable C++ engine under lock.
  {
    std::lock_guard<std::mutex> lock(_pitchMutex);
    _config.sampleRateHz = hwFormat.sampleRate > 0 ? hwFormat.sampleRate : _config.sampleRateHz;
    _pitch = std::make_shared<PitchEngine>(_config);
    _samples.clear();
  }

  // Capture file for the RecordingHandle uri.
  _recordingId = [[NSUUID UUID] UUIDString];
  NSString *dir = NSTemporaryDirectory();
  NSString *path = [dir stringByAppendingPathComponent:
                    [NSString stringWithFormat:@"micdrp-%@.caf", _recordingId]];
  _captureURL = [NSURL fileURLWithPath:path];
  NSError *fileErr = nil;
  _captureFile = [[AVAudioFile alloc] initForWriting:_captureURL
                                            settings:hwFormat.settings
                                        commonFormat:AVAudioPCMFormatFloat32
                                         interleaved:NO
                                               error:&fileErr];
  if (fileErr) {
    RCTLogWarn(@"AudioEngineModule: capture file open failed: %@", fileErr.localizedDescription);
    _captureFile = nil;  // analysis still works without persisted audio
  }

  __weak AudioEngineModule *weakSelf = self;
  [input installTapOnBus:0
              bufferSize:(AVAudioFrameCount)_config.hopSize
                  format:hwFormat
                   block:^(AVAudioPCMBuffer *buffer, AVAudioTime *when) {
    AudioEngineModule *strongSelf = weakSelf;
    if (!strongSelf) return;
    [strongSelf processBuffer:buffer];
  }];

  _startHostTime = NowMs();
  _lastEmitMs = 0;

  NSError *startErr = nil;
  [_engine prepare];
  if (![_engine startAndReturnError:&startErr]) {
    [input removeTapOnBus:0];
    _engine = nil;
    [self emitState:@"error"];
    reject(@"engine_failed", startErr.localizedDescription, startErr);
    return;
  }

  _running = true;
  [self emitState:@"recording"];
  resolve(nil);
}

// Real-time audio thread. No Objective-C allocation on the hot path beyond the
// throttled event payload; PCM is handed straight to the C++ engine.
- (void)processBuffer:(AVAudioPCMBuffer *)buffer {
  const AVAudioFrameCount frameCount = buffer.frameLength;
  float *const *channels = buffer.floatChannelData;
  if (channels == nullptr || frameCount == 0) {
    return;
  }
  const float *mono = channels[0];

  // Persist raw audio (best-effort; ignore errors on the audio thread).
  if (_captureFile != nil) {
    [_captureFile writeFromBuffer:buffer error:nil];
  }

  std::vector<PitchSample> emitted;
  {
    std::lock_guard<std::mutex> lock(_pitchMutex);
    if (!_pitch) return;
    const double tMs = NowMs() - _startHostTime;
    // PitchEngine buffers the hop, runs MPM when a full frame is available, and
    // appends one PitchSample per analysed hop (full resolution).
    _pitch->push(mono, (int)frameCount, tMs, _samples);
    if (!_samples.empty()) {
      emitted.push_back(_samples.back());
    }
  }

  if (emitted.empty() || !_hasListeners) {
    return;
  }

  // Throttle JS emission to ~emitRateHz.
  const double now = NowMs();
  const double minIntervalMs = 1000.0 / (_config.emitRateHz > 0 ? _config.emitRateHz : 60.0);
  if (now - _lastEmitMs < minIntervalMs) {
    return;
  }
  _lastEmitMs = now;

  const PitchSample &s = emitted.back();
  NSDictionary *body = @{
    @"timestampMs": @(s.timestampMs),
    @"frequencyHz": @(s.frequencyHz),
    @"clarity": @(s.clarity),
    @"midi": (s.voiced ? @(s.midi) : (id)[NSNull null]),
    @"cents": (s.voiced ? @(s.cents) : (id)[NSNull null]),
  };
  [self sendEventWithName:kPitchEvent body:body];
}

RCT_EXPORT_METHOD(stop:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
  if (!_running.load()) {
    reject(@"not_running", @"AudioEngine is not running", nil);
    return;
  }
  [self emitState:@"analyzing"];

  AVAudioInputNode *input = _engine.inputNode;
  [input removeTapOnBus:0];
  [_engine stop];
  _engine = nil;
  _running = false;

  const double durationMs = NowMs() - _startHostTime;

  NSMutableArray *samplesOut = [NSMutableArray array];
  double sampleRate = _config.sampleRateHz;
  {
    std::lock_guard<std::mutex> lock(_pitchMutex);
    for (const PitchSample &s : _samples) {
      [samplesOut addObject:@{
        @"timestampMs": @(s.timestampMs),
        @"frequencyHz": @(s.frequencyHz),
        @"clarity": @(s.clarity),
        @"midi": (s.voiced ? @(s.midi) : (id)[NSNull null]),
        @"cents": (s.voiced ? @(s.cents) : (id)[NSNull null]),
      }];
    }
    _pitch.reset();
  }

  _captureFile = nil;  // flushes + closes
  NSString *uri = _captureURL ? _captureURL.absoluteString : @"";

  NSDictionary *handle = @{
    @"id": _recordingId ?: [[NSUUID UUID] UUIDString],
    @"uri": uri,
    @"sampleRateHz": @(sampleRate),
    @"durationMs": @(durationMs),
    @"samples": samplesOut,
  };

  [self emitState:@"idle"];
  resolve(handle);
}

@end
