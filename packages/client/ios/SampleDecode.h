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

#include <memory>
#include <vector>

NS_ASSUME_NONNULL_BEGIN

namespace micdrp {

/// Decoded audio, shared so a retired buffer can outlive the slot that held
/// it for as long as a voice might still be reading it.
using Frames = std::shared_ptr<std::vector<float>>;

/// Read `path` — a plain path or a file:// URL — as mono at `sampleRateHz`.
/// Null with `error` set on anything the system cannot open or convert.
Frames decodeSample(NSString *path, double sampleRateHz, NSError **error);

}  // namespace micdrp

NS_ASSUME_NONNULL_END

#endif /* SampleDecode_h */
