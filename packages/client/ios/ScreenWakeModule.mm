//
//  ScreenWakeModule.mm — see ScreenWakeModule.h.
//

#import "ScreenWakeModule.h"

#import <UIKit/UIKit.h>

@implementation ScreenWakeModule

RCT_EXPORT_MODULE(NativeScreenWake)

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeScreenWakeSpecJSI>(params);
}

/// UIApplication only, so this has to be the main queue.
- (dispatch_queue_t)methodQueue {
  return dispatch_get_main_queue();
}

- (void)setAwake:(BOOL)isAwake {
  [UIApplication sharedApplication].idleTimerDisabled = isAwake;
}

/// A reload must not leave the screen pinned awake by a module that is going
/// away — nothing would ever turn it back off.
- (void)invalidate {
  [UIApplication sharedApplication].idleTimerDisabled = NO;
}

@end
