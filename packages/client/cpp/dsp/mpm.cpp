// mpm.cpp — see mpm.h. Mechanical port of packages/logic/src/mpm.ts.
//
// Line-for-line correspondence with detectPitch() is intentional: the TS
// version is the oracle, so any change here must keep parity (see the host
// parity test). Parabolic interpolation, hump scanning and the clarity cutoff
// match the reference exactly. The only deliberate representation choice is the
// unvoiced sentinel: TS returns {frequency: null}, here {frequencyHz: 0,
// voiced: false}, to match the PitchSample wire contract.

#include "mpm.h"

#include <cmath>
#include <limits>

namespace micdrp::dsp {

namespace {

inline double clamp01(double value) {
  if (value < 0.0) {
    return 0.0;
  }
  if (value > 1.0) {
    return 1.0;
  }
  return value;
}

constexpr PitchResult kUnvoiced{0.0, 0.0, false};

}  // namespace

void Mpm::configure(const EngineConfig& config) {
  config_ = config;
  // Pre-size scratch so detect() never allocates on the audio thread for
  // frames up to frameSize. maxPositions can grow up to ~n/2 humps.
  nsdf_.assign(config_.frameSize, 0.0f);
  maxPositions_.reserve(config_.frameSize / 2 + 1);
}

PitchResult Mpm::detect(const float* frame, std::size_t n) {
  const double sampleRate = config_.sampleRateHz;
  const double threshold = config_.clarityThreshold;

  if (frame == nullptr || n < 4 || sampleRate <= 0.0) {
    return kUnvoiced;
  }

  if (nsdf_.size() < n) {
    nsdf_.assign(n, 0.0f);  // grows only when n exceeds the configured size
  }
  float* nsdf = nsdf_.data();

  // Normalized Square Difference Function (NSDF), type-II autocorrelation.
  // acf/div accumulate in double (matching JS number); nsdf stores float32
  // (matching the TS Float32Array) so peak picking sees identical values.
  for (std::size_t tau = 0; tau < n; ++tau) {
    double acf = 0.0;  // autocorrelation at lag tau
    double div = 0.0;  // sum of squares of both windows (m'(tau))
    for (std::size_t i = 0; i < n - tau; ++i) {
      const double a = static_cast<double>(frame[i]);
      const double b = static_cast<double>(frame[i + tau]);
      acf += a * b;
      div += a * a + b * b;
    }
    nsdf[tau] = div > 0.0 ? static_cast<float>((2.0 * acf) / div) : 0.0f;
  }

  // Collect the maximum of each positive "hump" after the lag-0 lobe.
  maxPositions_.clear();
  std::size_t i = 0;
  // Skip the initial positive lobe around lag 0.
  while (i < n - 1 && nsdf[i] > 0.0f) {
    ++i;
  }
  while (i < n - 1) {
    // Advance to the next positive region.
    while (i < n - 1 && nsdf[i] <= 0.0f) {
      ++i;
    }
    if (i >= n - 1) {
      break;
    }
    // Track the local maximum within this positive region.
    float localMax = -std::numeric_limits<float>::infinity();
    std::size_t localMaxIdx = i;
    while (i < n - 1 && nsdf[i] > 0.0f) {
      if (nsdf[i] > localMax) {
        localMax = nsdf[i];
        localMaxIdx = i;
      }
      ++i;
    }
    maxPositions_.push_back(localMaxIdx);
  }

  if (maxPositions_.empty()) {
    return kUnvoiced;
  }

  // Highest peak sets the acceptance cutoff.
  float highest = 0.0f;
  for (std::size_t k = 0; k < maxPositions_.size(); ++k) {
    const float v = nsdf[maxPositions_[k]];
    if (v > highest) {
      highest = v;
    }
  }
  if (highest <= 0.0f) {
    return kUnvoiced;
  }

  const double cutoff = static_cast<double>(threshold) * static_cast<double>(highest);

  // First key maximum at or above the cutoff wins.
  for (std::size_t k = 0; k < maxPositions_.size(); ++k) {
    const std::size_t p = maxPositions_[k];
    if (static_cast<double>(nsdf[p]) < cutoff) {
      continue;
    }

    // Parabolic interpolation around the integer peak for sub-sample accuracy.
    double peakTau = static_cast<double>(p);
    double peakValue = static_cast<double>(nsdf[p]);
    if (p > 0 && p < n - 1) {
      const double s0 = static_cast<double>(nsdf[p - 1]);
      const double s1 = static_cast<double>(nsdf[p]);
      const double s2 = static_cast<double>(nsdf[p + 1]);
      const double denom = s0 + s2 - 2.0 * s1;
      if (denom != 0.0) {
        const double delta = (0.5 * (s0 - s2)) / denom;
        peakTau = static_cast<double>(p) + delta;
        peakValue = s1 - 0.25 * (s0 - s2) * delta;
      }
    }

    if (peakTau <= 0.0) {
      return PitchResult{0.0, clamp01(peakValue), false};
    }

    const double frequency = sampleRate / peakTau;
    if (frequency < config_.minFrequencyHz) {
      return PitchResult{0.0, clamp01(peakValue), false};
    }
    if (frequency > config_.maxFrequencyHz) {
      return PitchResult{0.0, clamp01(peakValue), false};
    }
    return PitchResult{frequency, clamp01(peakValue), true};
  }

  return PitchResult{0.0, clamp01(static_cast<double>(highest)), false};
}

}  // namespace micdrp::dsp
