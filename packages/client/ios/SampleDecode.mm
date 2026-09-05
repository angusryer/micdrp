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

/// The one format anything resident is held in: mono, engine rate, and
/// sixteen-bit because that is the precision the microphone captured
/// (INV-TPORT-026).
AVAudioFormat *monoAt(double sampleRateHz) {
  return [[AVAudioFormat alloc] initWithCommonFormat:AVAudioPCMFormatInt16
                                          sampleRate:sampleRateHz
                                            channels:1
                                         interleaved:NO];
}

/// Which cache file a recording's frames belong in.
///
/// Keyed on the address without its query, because a backend file token is
/// minted fresh on every press and the recording it points at is the same
/// one (INV-NOTES-014, INV-TPORT-020). FNV-1a, so the name is the same in
/// this launch and the next.
NSString *cacheKeyFor(NSString *path) {
  NSString *bare = path;
  const NSRange query = [path rangeOfString:@"?"];
  if (query.location != NSNotFound) {
    bare = [path substringToIndex:query.location];
  }
  std::uint64_t hash = 14695981039346656037ULL;
  for (const char *c = bare.UTF8String; c != nullptr && *c != 0; ++c) {
    hash ^= static_cast<unsigned char>(*c);
    hash *= 1099511628211ULL;
  }
  return [NSString stringWithFormat:@"%016llx.pcm", hash];
}

/// Where cache files live. Under Caches on purpose: the system may reclaim
/// them, and everything here can be made again from the recording.
NSURL *_Nullable cacheDirectory(NSError **error) {
  NSFileManager *fm = [NSFileManager defaultManager];
  NSURL *base = [fm URLForDirectory:NSCachesDirectory
                           inDomain:NSUserDomainMask
                  appropriateForURL:nil
                             create:YES
                              error:error];
  if (base == nil) {
    return nil;
  }
  NSURL *dir = [base URLByAppendingPathComponent:@"micdrp-frames"
                                     isDirectory:YES];
  if (![fm createDirectoryAtURL:dir
      withIntermediateDirectories:YES
                       attributes:nil
                            error:error]) {
    return nil;
  }
  return dir;
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

/// Everything up to a buffer: fetch if remote, open, convert whole.
AVAudioPCMBuffer *_Nullable decodeWhole(NSString *path, double sampleRateHz,
                                        NSError **error) {
  const BOOL isRemote = [path hasPrefix:@"http"];
  NSURL *local = localURLFor(path, error);
  if (local == nil) {
    return nil;
  }
  AVAudioFile *file = [[AVAudioFile alloc] initForReading:local error:error];
  AVAudioPCMBuffer *audio =
      file == nil ? nil : convertWhole(file, monoAt(sampleRateHz), error);
  file = nil;
  // The audio is in memory now, so a copy fetched to disk has done its job.
  if (isRemote) {
    [[NSFileManager defaultManager] removeItemAtURL:local error:nil];
  }
  return audio;
}

}  // namespace

std::int64_t frameCountOf(NSURL *cache) {
  NSNumber *size = nil;
  NSError *err = nil;
  if (![cache getResourceValue:&size forKey:NSURLFileSizeKey error:&err] ||
      size == nil) {
    return 0;
  }
  return size.longLongValue / static_cast<std::int64_t>(sizeof(std::int16_t));
}

Frames residentFrames(NSURL *cache, NSError **error) {
  // Mapped for the read and copied out of, which is a read on a background
  // queue rather than a page fault on the audio thread (INV-TPORT-028).
  NSData *data = [NSData dataWithContentsOfURL:cache
                                       options:NSDataReadingMappedIfSafe
                                         error:error];
  if (data == nil) {
    return nullptr;
  }
  const std::int16_t *first = static_cast<const std::int16_t *>(data.bytes);
  return std::make_shared<std::vector<std::int16_t>>(
      first, first + data.length / sizeof(std::int16_t));
}

NSURL *_Nullable frameCacheFor(NSString *path, double sampleRateHz,
                               NSError **error) {
  NSURL *dir = cacheDirectory(error);
  if (dir == nil) {
    return nil;
  }
  NSURL *cache = [dir URLByAppendingPathComponent:cacheKeyFor(path)];
  if (frameCountOf(cache) > 0) {
    return cache;  // converted on a previous sighting (INV-TPORT-027)
  }
  AVAudioPCMBuffer *audio = decodeWhole(path, sampleRateHz, error);
  if (audio == nil) {
    return nil;
  }
  NSData *raw =
      [NSData dataWithBytes:audio.int16ChannelData[0]
                     length:audio.frameLength * sizeof(std::int16_t)];
  // Atomic, so a cache file that exists is a cache file that is complete —
  // a half-written one would read as a take that stops early.
  if (![raw writeToURL:cache options:NSDataWritingAtomic error:error]) {
    return nil;
  }
  return cache;
}

Frames decodeSample(NSString *path, double sampleRateHz, NSError **error) {
  NSURL *cache = frameCacheFor(path, sampleRateHz, error);
  return cache == nil ? nullptr : residentFrames(cache, error);
}

}  // namespace micdrp
