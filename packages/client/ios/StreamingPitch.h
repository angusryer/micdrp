//
//  StreamingPitch.h
//  micdrp
//
//  The streaming shell around the shared MPM detector: buffer PCM into
//  frames, advance by a hop, emit one reading per completed window.
//
//  Extracted from AudioEngineModule so that file is the bridge and this is
//  the analysis. Pure C++ — no React, no Objective-C — so it is readable and
//  testable on its own.
//
//  KNOWN DUPLICATION: cpp/dsp/pitch_engine.h is a fuller version of this,
//  built around a lock-free ring buffer precisely so the audio thread neither
//  allocates nor blocks. Nothing ever wired it up. What is here instead runs
//  the detector on the audio thread and is driven under a mutex by its caller,
//  which is not real-time safe: a lock or a reallocation on that thread is how
//  a recording gets a gap in it. Moving to the shared engine is the right fix
//  and is a change to how capture is threaded, so it wants its own pass and a
//  device to prove it on rather than riding along with unrelated work.
//

#ifndef StreamingPitch_h
#define StreamingPitch_h

#include <vector>

#include "level.h"  // micdrp::dsp::windowLevelDb, kSilenceDb
#include "mpm.h"    // micdrp::dsp::Mpm, EngineConfig, PitchResult
#include "notes.h"  // micdrp::dsp::frequencyToNote, NoteReading

namespace micdrp::bridge {

// Engine config (mirrors DEFAULT_ENGINE_CONFIG in contract.ts).
struct EngineConfig {
  double sampleRateHz = 44100.0;
  int frameSize = 2048;
  int hopSize = 1024;
  double minFrequencyHz = 70.0;
  double maxFrequencyHz = 1200.0;
  double clarityThreshold = 0.9;
  double emitRateHz = 60.0;
};

// One analysed hop (matches the contract PitchSample; `voiced` flags null midi/cents).
struct PitchSample {
  double timestampMs = 0;
  double frequencyHz = 0;
  double clarity = 0;
  // How loud this window was, in dBFS. Defaults to silence rather than to
  // zero, so a frame nothing measured cannot claim to be the loudest thing in
  // the take (INV-PITCH-020).
  double levelDb = micdrp::dsp::kSilenceDb;
  int midi = 0;
  int cents = 0;
  bool voiced = false;
};

// Streaming MPM over a sliding frame: buffers PCM into `frameSize` windows,
// advancing by `hopSize`, and appends one PitchSample per full window. Pure C++
// so it stays off any managed runtime.
class PitchEngine {
 public:
  explicit PitchEngine(const EngineConfig &cfg) : cfg_(cfg) {
    buffer_.reserve(static_cast<size_t>(cfg.frameSize) * 2);
    micdrp::dsp::EngineConfig dsp;
    dsp.sampleRateHz = cfg.sampleRateHz;
    dsp.frameSize = static_cast<std::size_t>(cfg.frameSize);
    dsp.hopSize = static_cast<std::size_t>(cfg.hopSize);
    dsp.minFrequencyHz = cfg.minFrequencyHz;
    dsp.maxFrequencyHz = cfg.maxFrequencyHz;
    dsp.clarityThreshold = cfg.clarityThreshold;
    dsp.emitRateHz = cfg.emitRateHz;
    mpm_.configure(dsp);
  }

  // Append `count` mono float samples captured at `tMs`; emit completed frames.
  void push(const float *mono, int count, double tMs, std::vector<PitchSample> &out) {
    for (int i = 0; i < count; ++i) {
      buffer_.push_back(mono[i]);
    }
    while (static_cast<int>(buffer_.size()) >= cfg_.frameSize) {
      analyzeWindow(tMs, out);
      // Advance by hopSize.
      const int hop = cfg_.hopSize > 0 ? cfg_.hopSize : cfg_.frameSize;
      buffer_.erase(buffer_.begin(), buffer_.begin() + hop);
    }
  }

 private:
  void analyzeWindow(double tMs, std::vector<PitchSample> &out) {
    micdrp::dsp::PitchResult r =
        mpm_.detect(buffer_.data(), static_cast<std::size_t>(cfg_.frameSize));

    PitchSample s;
    s.timestampMs = tMs;
    s.clarity = r.clarity;
    // The same window the pitch was read from, through the same function the
    // other engine uses (INV-PITCH-020).
    s.levelDb = micdrp::dsp::windowLevelDb(
        buffer_.data(), static_cast<std::size_t>(cfg_.frameSize));
    if (r.voiced && r.clarity >= cfg_.clarityThreshold) {
      micdrp::dsp::NoteReading note = micdrp::dsp::frequencyToNote(r.frequencyHz);
      s.frequencyHz = r.frequencyHz;
      s.midi = note.midi;
      s.cents = note.cents;
      s.voiced = true;
    }
    out.push_back(s);
  }

  EngineConfig cfg_;
  micdrp::dsp::Mpm mpm_;
  std::vector<float> buffer_;
};

}  // namespace micdrp::bridge

#endif /* StreamingPitch_h */
