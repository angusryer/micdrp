//
//  SampleDecode.mm — see SampleDecode.h.
//

#import "SampleDecode.h"

#import <AVFoundation/AVFoundation.h>

namespace micdrp {
namespace {

/// How much is read from the file at a time. Large enough that a long take is
/// a few hundred reads rather than thousands; small enough to be nothing.
constexpr AVAudioFrameCount kReadChunk = 8192;

NSError *fail(NSString *why) {
  return [NSError errorWithDomain:@"micdrp.SampleDecode"
                             code:1
                         userInfo:@{NSLocalizedDescriptionKey : why}];
}

/// A local URL for whatever the caller has.
///
/// A note synced from the backend has an https audio URL and a note captured
/// but not yet synced has a local one (INV-NOTES-012), and AVAudioFile opens
/// only the second kind. So a remote take is fetched to a temporary file
/// first — blocking, on the caller's background queue, which is where the
/// decode was going to happen anyway.
NSURL *_Nullable localURLFor(NSString *path, NSError **error) {
  if ([path hasPrefix:@"file://"]) {
    return [NSURL URLWithString:path];
  }
  if (![path hasPrefix:@"http"]) {
    return [NSURL fileURLWithPath:path];
  }
  NSURL *remote = [NSURL URLWithString:path];
  NSData *data = [NSData dataWithContentsOfURL:remote options:0 error:error];
  if (data == nil) {
    return nil;
  }
  NSURL *scratch = [[NSURL fileURLWithPath:NSTemporaryDirectory()]
      URLByAppendingPathComponent:[[NSUUID UUID] UUIDString]];
  if (![data writeToURL:scratch options:NSDataWritingAtomic error:error]) {
    return nil;
  }
  return scratch;
}

AVAudioFormat *monoAt(double sampleRateHz) {
  return [[AVAudioFormat alloc] initWithCommonFormat:AVAudioPCMFormatFloat32
                                          sampleRate:sampleRateHz
                                            channels:1
                                         interleaved:NO];
}

/// Convert a whole file into one buffer at the target format.
///
/// Whole rather than streamed: holding the take in memory is what takes the
/// decode out of every press, and one note is played at a time
/// (INV-NOTES-133).
AVAudioPCMBuffer *_Nullable convertWhole(AVAudioFile *file,
                                         AVAudioFormat *target,
                                         NSError **error) {
  AVAudioConverter *converter =
      [[AVAudioConverter alloc] initFromFormat:file.processingFormat
                                      toFormat:target];
  const double ratio = target.sampleRate / file.processingFormat.sampleRate;
  const AVAudioFrameCount capacity =
      (AVAudioFrameCount)((double)file.length * ratio) + kReadChunk;
  AVAudioPCMBuffer *out = [[AVAudioPCMBuffer alloc] initWithPCMFormat:target
                                                        frameCapacity:capacity];
  AVAudioPCMBuffer *in =
      [[AVAudioPCMBuffer alloc] initWithPCMFormat:file.processingFormat
                                    frameCapacity:kReadChunk];
  if (converter == nil || out == nil || in == nil) {
    if (error) {
      *error = fail(@"could not prepare to decode this take");
    }
    return nil;
  }

  __block BOOL reachedEnd = NO;
  __block NSError *readError = nil;
  AVAudioConverterInputBlock feed =
      ^AVAudioBuffer *_Nullable(AVAudioPacketCount need,
                                AVAudioConverterInputStatus *status) {
        if (reachedEnd || ![file readIntoBuffer:in error:&readError] ||
            in.frameLength == 0) {
          reachedEnd = YES;
          *status = AVAudioConverterInputStatus_EndOfStream;
          return nil;
        }
        *status = AVAudioConverterInputStatus_HaveData;
        return in;
      };

  NSError *convertError = nil;
  const AVAudioConverterOutputStatus status =
      [converter convertToBuffer:out
                           error:&convertError
              withInputFromBlock:feed];
  if (status == AVAudioConverterOutputStatus_Error) {
    if (error) {
      *error = convertError ?: readError ?: fail(@"could not decode this take");
    }
    return nil;
  }
  return out;
}

}  // namespace

Frames decodeSample(NSString *path, double sampleRateHz, NSError **error) {
  const BOOL isRemote = [path hasPrefix:@"http"];
  NSURL *local = localURLFor(path, error);
  if (local == nil) {
    return nullptr;
  }
  AVAudioFile *file = [[AVAudioFile alloc] initForReading:local error:error];
  AVAudioPCMBuffer *audio =
      file == nil ? nil : convertWhole(file, monoAt(sampleRateHz), error);
  file = nil;
  // The audio is in memory now, so a copy fetched to disk has done its job.
  if (isRemote) {
    [[NSFileManager defaultManager] removeItemAtURL:local error:nil];
  }
  if (audio == nil) {
    return nullptr;
  }
  const float *source = audio.floatChannelData[0];
  return std::make_shared<std::vector<float>>(source,
                                              source + audio.frameLength);
}

}  // namespace micdrp
