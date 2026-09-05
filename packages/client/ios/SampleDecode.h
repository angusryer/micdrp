//
//  SampleDecode.h
//  micdrp
//
//  Reading a recorded file into the engine's own format (INV-NOTES-133).
//
//  Once, at load, rather than while rendering: rate conversion in the render
//  loop is a per-sample cost on the audio thread for a conversion that is
//  identical every time it is done. Mono, because the synth mixes one channel
//  and a take is a voice.
//
//  Its own file because it is a file format problem, not an audio graph
//  problem: nothing here knows what a bus or a slot is.
//

#ifndef SampleDecode_h
#define SampleDecode_h

#import <Foundation/Foundation.h>

#include <cstdint>
#include <memory>
#include <vector>

NS_ASSUME_NONNULL_BEGIN

namespace micdrp {

/// Decoded audio, shared so a retired buffer can outlive the slot that held
/// it for as long as a voice might still be reading it.
///
/// Sixteen-bit, which is what the microphone captured (INV-TPORT-026). It
/// was float32: four bytes a frame, 11 MB a minute, and again for every
/// layer sung over the take.
using Frames = std::shared_ptr<std::vector<std::int16_t>>;

/// This recording's engine-rate mono frames, as a raw file on disk.
///
/// Written the first time the recording is seen and read directly ever
/// after, so the decode — the slow step, and the one that can fail — is
/// paid once rather than on every note opened (INV-TPORT-027). It is also
/// what makes reading a passage from disk possible at all: a reader thread
/// cannot run a codec.
///
/// Nil with `error` set on anything the system cannot open or convert.
NSURL *_Nullable frameCacheFor(NSString *path, double sampleRateHz,
                               NSError **error);

/// How many frames a cache file holds. 0 where it cannot be read.
std::int64_t frameCountOf(NSURL *cache);

/// The whole of a cache file, resident and ready to sound.
Frames residentFrames(NSURL *cache, NSError **error);

/// Read `path` — a plain path or a file:// URL — as resident mono frames at
/// `sampleRateHz`, caching the conversion. Null with `error` set.
Frames decodeSample(NSString *path, double sampleRateHz, NSError **error);

}  // namespace micdrp

NS_ASSUME_NONNULL_END

#endif /* SampleDecode_h */
