//
//  AudioSessionClaim.h
//  micdrp
//
//  Who owns the one audio session, and who is only borrowing it.
//
//  There is a single AVAudioSession per app and two things here want it: a
//  capture needs PlayAndRecord, playback needs only Playback. Whoever asks
//  second must not take the category from whoever asked first — setting
//  Playback under a running capture kills its input tap, and that is a
//  recording lost while someone is singing into it.
//
//  A claim therefore takes the session only when nothing better is already
//  held, and remembers whether it took it, so releasing gives back exactly
//  what it took and never deactivates a session it was merely borrowing.
//

#ifndef AudioSessionClaim_h
#define AudioSessionClaim_h

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface AudioSessionClaim : NSObject

/// Make the session usable for playback. A session already held for capture
/// is left exactly as it is. NO on failure, with `error` set.
- (BOOL)claimForPlaybackOrError:(NSError **)error;

/// Give back only what this claim took. A no-op when it took nothing.
/// Safe to call repeatedly.
- (void)relinquish;

@end

NS_ASSUME_NONNULL_END

#endif /* AudioSessionClaim_h */
