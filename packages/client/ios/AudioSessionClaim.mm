//
//  AudioSessionClaim.mm — see AudioSessionClaim.h.
//

#import "AudioSessionClaim.h"

#import <AVFoundation/AVFoundation.h>

@implementation AudioSessionClaim {
  BOOL _held;
}

- (BOOL)claimForPlaybackOrError:(NSError **)error {
  if (_held) {
    return YES;
  }
  AVAudioSession *session = [AVAudioSession sharedInstance];
  // PlayAndRecord already permits playback, and taking the category from a
  // running capture would end it. Borrow rather than claim.
  if ([session.category isEqualToString:AVAudioSessionCategoryPlayAndRecord]) {
    return YES;
  }
  if (![session setCategory:AVAudioSessionCategoryPlayback error:error] ||
      ![session setActive:YES error:error]) {
    return NO;
  }
  _held = YES;
  return YES;
}

- (void)relinquish {
  if (!_held) {
    return;
  }
  // Telling other apps is what lets music resume where it left off rather
  // than staying stopped after the app makes one sound.
  [[AVAudioSession sharedInstance]
      setActive:NO
    withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation
          error:nil];
  _held = NO;
}

@end
