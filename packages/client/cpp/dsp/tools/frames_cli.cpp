// frames_cli.cpp — the device's pitch engine, on the bench (INV-NOTES-261).
//
// Reads mono float32 little-endian PCM from stdin, runs it through the same
// PitchEngine the phone runs, and writes one JSON object per analysed frame
// to stdout — the same ten fields the bridge marshals to JS, so a reading
// made from these frames is a reading made from the phone's frames.
//
// This exists so that no analysis of audio happens anywhere but here. The
// corpus tool used to detect pitch with the TypeScript reference; it is the
// same algorithm within 1e-4 Hz and not the same bits, and "within" is not
// "exactly" when a take is being compared with itself across a re-read.
//
//   c++ -std=c++17 -O2 -I. mpm.cpp notes.cpp ring_buffer.cpp pitch_engine.cpp \
//       tools/frames_cli.cpp -o dsp_frames
//   dsp_frames --rate 48000 < take.f32 > frames.jsonl
//
// Every option defaults to EngineConfig's own default, which mirrors
// DEFAULT_ENGINE_CONFIG in audio/contract.ts — the one place that decides.
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>

#include "pitch_engine.h"

using namespace micdrp::dsp;

namespace {

double argOr(int argc, char** argv, const char* flag, double fallback) {
  for (int i = 1; i + 1 < argc; ++i) {
    if (std::strcmp(argv[i], flag) == 0) {
      return std::atof(argv[i + 1]);
    }
  }
  return fallback;
}

// Fed a hop at a time and drained after each, which is what the microphone
// does and what the ring can always hold. Pushing more than the ring's
// four windows between drains overflows it, and push() reports that by
// accepting fewer samples than it was given — a report analyzeFile once
// ignored, dropping half of every chunk of a file re-read. So a short
// write here is a bug, not a condition to carry on past.
void feed(PitchEngine& engine, const std::vector<float>& pcm, std::size_t hop) {
  for (std::size_t at = 0; at < pcm.size(); at += hop) {
    const std::size_t n = std::min(hop, pcm.size() - at);
    const std::size_t took = engine.push(pcm.data() + at, n);
    if (took != n) {
      std::fprintf(stderr, "dsp_frames: engine dropped %zu of %zu samples at %zu\n",
                   n - took, n, at);
      std::exit(2);
    }
    while (auto s = engine.tryAnalyze()) {
      const PitchSample& f = *s;
      std::printf(
          "{\"timestampMs\":%.17g,\"frequencyHz\":%.17g,\"clarity\":%.17g,"
          "\"levelDb\":%.17g,\"centroidHz\":%.17g,\"flatness\":%.17g,"
          "\"rolloffHz\":%.17g,\"fluxDb\":%.17g,",
          f.timestampMs, f.frequencyHz, f.clarity, f.levelDb, f.centroidHz,
          f.flatness, f.rolloffHz, f.fluxDb);
      if (f.voiced) {
        std::printf("\"midi\":%d,\"cents\":%d}\n", f.midi, f.cents);
      } else {
        std::printf("\"midi\":null,\"cents\":null}\n");
      }
    }
  }
}

}  // namespace

int main(int argc, char** argv) {
  EngineConfig cfg;
  cfg.sampleRateHz = argOr(argc, argv, "--rate", cfg.sampleRateHz);
  cfg.frameSize = (std::size_t)argOr(argc, argv, "--frame", (double)cfg.frameSize);
  cfg.hopSize = (std::size_t)argOr(argc, argv, "--hop", (double)cfg.hopSize);
  cfg.minFrequencyHz = argOr(argc, argv, "--min-hz", cfg.minFrequencyHz);
  cfg.maxFrequencyHz = argOr(argc, argv, "--max-hz", cfg.maxFrequencyHz);
  cfg.clarityThreshold = argOr(argc, argv, "--clarity", cfg.clarityThreshold);

  std::vector<float> pcm;
  float buf[4096];
  std::size_t got;
  while ((got = std::fread(buf, sizeof(float), 4096, stdin)) > 0) {
    pcm.insert(pcm.end(), buf, buf + got);
  }

  PitchEngine engine;
  engine.configure(cfg);
  feed(engine, pcm, cfg.hopSize);
  return 0;
}
