//
//  AudioRouteModule.mm — see AudioRouteModule.h.
//

#import "AudioRouteModule.h"

#import <AVFoundation/AVFoundation.h>

@implementation AudioRouteModule

RCT_EXPORT_MODULE(NativeAudioRoute)

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeAudioRouteSpecJSI>(params);
}

/// Read fresh each time rather than cached: a route changes whenever someone
/// plugs something in, and a stale answer is worse than none.
- (NSNumber *)isHeadphones {
  AVAudioSessionRouteDescription *route =
      [AVAudioSession sharedInstance].currentRoute;
  for (AVAudioSessionPortDescription *port in route.outputs) {
    NSString *type = port.portType;
    // Everything that ends at someone's ears rather than in the room. The
    // question being asked is whether the microphone will hear the output,
    // so what matters is not "is it a headphone" but "is it enclosed".
    if ([type isEqualToString:AVAudioSessionPortHeadphones] ||
        [type isEqualToString:AVAudioSessionPortBluetoothA2DP] ||
        [type isEqualToString:AVAudioSessionPortBluetoothHFP] ||
        [type isEqualToString:AVAudioSessionPortBluetoothLE] ||
        [type isEqualToString:AVAudioSessionPortUSBAudio]) {
      return @YES;
    }
  }
  return @NO;
}

@end
