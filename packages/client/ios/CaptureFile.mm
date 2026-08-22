//
//  CaptureFile.mm — see CaptureFile.h.
//

#import "CaptureFile.h"

#import <React/RCTLog.h>

AVAudioFile *MicdrpOpenCaptureFile(NSString *directory,
                                   NSString *recordingId,
                                   AVAudioFormat *hardwareFormat,
                                   NSURL *_Nullable *outURL) {
  // The directory comes from the caller (files.ts) rather than being chosen
  // here. NSTemporaryDirectory() was the previous home, and the system is free
  // to reclaim it — which would leave a saved note pointing at audio that had
  // silently vanished (INV-PITCH-011).
  NSString *dir = directory.length > 0 ? directory : NSTemporaryDirectory();
  [[NSFileManager defaultManager] createDirectoryAtPath:dir
                            withIntermediateDirectories:YES
                                             attributes:nil
                                                  error:nil];
  NSString *path = [dir stringByAppendingPathComponent:
                    [NSString stringWithFormat:@"%@.wav", recordingId]];
  NSURL *url = [NSURL fileURLWithPath:path];
  *outURL = url;

  // WAV holding 16-bit PCM, not CAF holding Float32 (INV-PITCH-012).
  //
  // CAF/Float32 is the natural choice — it is what the hardware format already
  // is, so writing it costs nothing. But playback decodes through miniaudio,
  // which opens WAV, MP3 and FLAC and hands only .mp4, .m4a and .aac to
  // ffmpeg. CAF matched nothing, so every note ever recorded failed to open
  // and the UI said only "Playback failed".
  //
  // 16-bit is deliberate too: it is what every decoder agrees on, and it
  // halves what has to be uploaded. `commonFormat` stays Float32 because that
  // is what the tap delivers; AVAudioFile converts on write.
  NSDictionary *settings = @{
    AVFormatIDKey: @(kAudioFormatLinearPCM),
    AVSampleRateKey: @(hardwareFormat.sampleRate),
    AVNumberOfChannelsKey: @(hardwareFormat.channelCount),
    AVLinearPCMBitDepthKey: @16,
    AVLinearPCMIsFloatKey: @NO,
    AVLinearPCMIsBigEndianKey: @NO,
    AVLinearPCMIsNonInterleaved: @NO
  };

  NSError *err = nil;
  AVAudioFile *file = [[AVAudioFile alloc] initForWriting:url
                                                 settings:settings
                                             commonFormat:AVAudioPCMFormatFloat32
                                              interleaved:NO
                                                    error:&err];
  if (err) {
    RCTLogWarn(@"CaptureFile: open failed: %@", err.localizedDescription);
    return nil;
  }
  return file;
}
