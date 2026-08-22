//
//  CaptureFile.h / .mm — where a take is written, and in what format.
//
//  Extracted from AudioEngineModule so the bridge is not also a container
//  expert. The two decisions here were each paid for once already, so both
//  are spelled out where they are made.
//

#ifndef CaptureFile_h
#define CaptureFile_h

#import <AVFoundation/AVFoundation.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Open a file to record into, under `directory`, named for `recordingId`.
 *
 * Returns nil when the file cannot be opened; analysis still works without
 * persisted audio, so a caller should carry on rather than fail the capture.
 * `outURL` is set whether or not opening succeeds.
 */
AVAudioFile *_Nullable MicdrpOpenCaptureFile(NSString *directory,
                                             NSString *recordingId,
                                             AVAudioFormat *hardwareFormat,
                                             NSURL *_Nullable *_Nonnull outURL);

NS_ASSUME_NONNULL_END

#endif /* CaptureFile_h */
