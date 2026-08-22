//
//  HapticsModule.mm — see HapticsModule.h.
//

#import "HapticsModule.h"

#import <UIKit/UIKit.h>

@implementation HapticsModule

RCT_EXPORT_MODULE(NativeHaptics)

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeHapticsSpecJSI>(params);
}

/// UIKit only, so this has to be the main queue.
- (dispatch_queue_t)methodQueue {
  return dispatch_get_main_queue();
}

- (void)impact:(double)weight {
  UIImpactFeedbackStyle style = UIImpactFeedbackStyleLight;
  if (weight == 1) {
    style = UIImpactFeedbackStyleMedium;
  } else if (weight == 2) {
    style = UIImpactFeedbackStyleHeavy;
  }
  // Built per call rather than kept: a generator held across a whole session
  // goes cold, and preparing one for a tick that may never come costs more
  // than it saves.
  UIImpactFeedbackGenerator *generator =
      [[UIImpactFeedbackGenerator alloc] initWithStyle:style];
  [generator prepare];
  [generator impactOccurred];
}

@end
