//
//  SynthModule.mm
//  micdrp
//
//  Bridge plumbing only: this turns TurboModule calls into SynthEngine
//  calls. Everything that makes a sound lives in SynthEngine.
//

#import "SynthModule.h"

#import "SynthEngine.h"

@implementation SynthModule {
  SynthEngine *_engine;
}

RCT_EXPORT_MODULE(NativeSynth)

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (instancetype)init {
  if (self = [super init]) {
    _engine = [[SynthEngine alloc] init];
  }
  return self;
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
  [_engine stop];
}

#pragma mark - exported methods

- (void)start:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  NSError *err = nil;
  if (![_engine startAndReturnError:&err]) {
    reject(@"engine_failed", err.localizedDescription, err);
    return;
  }
  resolve(nil);
}

- (void)stop:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  [_engine stop];
  resolve(nil);
}

- (NSNumber *)nowMs {
  return @([_engine nowMs]);
}

- (void)setBusLevel:(double)bus level:(double)level {
  [_engine setBusLevel:bus level:level];
}

- (void)schedule:(NSArray *)notes {
  for (NSDictionary *note in notes) {
    [_engine scheduleBus:[note[@"bus"] doubleValue]
             frequencyHz:[note[@"frequencyHz"] doubleValue]
                 startMs:[note[@"startMs"] doubleValue]
                   endMs:[note[@"endMs"] doubleValue]];
  }
}

- (void)clearBus:(double)bus {
  [_engine clearBus:bus];
}

- (void)clearAll {
  [_engine clearAll];
}

@end
