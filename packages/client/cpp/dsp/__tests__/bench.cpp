// bench.cpp — what the hot path actually costs, printed rather than asserted.
//
// Here because the last two arguments about where work should live were both
// settled by measuring and both went against the intuition. An FFT was assumed
// heavy and turned out to cost a twentieth of what the detector already spent;
// the detector was spending nine percent of a core on an O(n^2) sum it did not
// need. Neither would have been found by reasoning about it (INV-PITCH-026).
//
// It prints a table and asserts almost nothing. A speed threshold on a shared
// machine is either so loose it never fires or so tight it fails for reasons
// that are not the code's.
//
//   c++ -std=c++17 -O2 -I. mpm.cpp notes.cpp ring_buffer.cpp pitch_engine.cpp \
//       __tests__/bench.cpp -o dsp_bench && ./dsp_bench

#include <chrono>
#include <cmath>
#include <cstdio>
#include <vector>

#include "pitch_engine.h"

using namespace micdrp::dsp;

namespace {

constexpr int kRuns = 200;

double microsPer(const char* label, int runs, void (*body)(void*), void* arg) {
  const auto from = std::chrono::steady_clock::now();
  for (int i = 0; i < runs; ++i) {
    body(arg);
  }
  const double us =
      std::chrono::duration<double, std::micro>(
          std::chrono::steady_clock::now() - from)
          .count() /
      static_cast<double>(runs);
  std::printf("  %-22s %8.1f us/frame", label, us);
  return us;
}

struct DetectArg {
  Mpm* mpm;
  const float* frame;
  std::size_t n;
};

void runDetect(void* raw) {
  auto* a = static_cast<DetectArg*>(raw);
  a->mpm->detect(a->frame, a->n);
}

}  // namespace

int main() {
  EngineConfig cfg;
  const std::size_t n = cfg.frameSize;
  std::vector<float> window(n);
  for (std::size_t i = 0; i < n; ++i) {
    window[i] = static_cast<float>(
        std::sin(2.0 * M_PI * 220.0 * static_cast<double>(i) / cfg.sampleRateHz));
  }

  const double hopsPerSecond = cfg.sampleRateHz / static_cast<double>(cfg.hopSize);
  std::printf("\n  frame %zu, hop %zu, %.1f frames/second of audio\n\n",
              n, cfg.hopSize, hopsPerSecond);

  Mpm mpm;
  mpm.configure(cfg);
  DetectArg arg{&mpm, window.data(), n};
  const double detectUs = microsPer("pitch + spectrum", kRuns, runDetect, &arg);
  std::printf("   -> %5.2f%% of one core\n", detectUs * hopsPerSecond / 10000.0);

  std::printf("\n  window level            %8.1f us/frame\n",
              [&] {
                const auto from = std::chrono::steady_clock::now();
                volatile double sink = 0;
                for (int i = 0; i < kRuns; ++i) {
                  sink += windowLevelDb(window.data(), n);
                }
                (void)sink;
                return std::chrono::duration<double, std::micro>(
                           std::chrono::steady_clock::now() - from)
                           .count() /
                       kRuns;
              }());

  // The only thing worth failing on: a frame must cost less than the time it
  // represents, or capture cannot keep up with itself at any buffer size.
  const double frameBudgetUs = 1e6 / hopsPerSecond;
  std::printf("\n  budget per frame        %8.1f us\n", frameBudgetUs);
  if (detectUs >= frameBudgetUs) {
    std::printf("\nBENCH FAILED: a frame costs more than it lasts\n");
    return 1;
  }
  std::printf("\nBENCH OK\n");
  return 0;
}
