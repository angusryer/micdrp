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

/// A floor for the log in the flatness geometric mean, and for the flux
/// ratio. Small enough to be silence, large enough not to be an infinity.
constexpr double kTinyPower = 1e-20;

/// How much of the energy sits below the rolloff frequency.
constexpr double kRolloffShare = 0.85;

}  // namespace

void Mpm::configure(const EngineConfig& config) {
  config_ = config;
  // Pre-size scratch so detect() never allocates on the audio thread for
  // frames up to frameSize. maxPositions can grow up to ~n/2 humps.
  nsdf_.assign(config_.frameSize, 0.0f);
  maxPositions_.reserve(config_.frameSize / 2 + 1);
  // Twice the frame, so the circular autocorrelation the transform gives is
  // the linear one we want: without the padding, lag tau would wrap around
  // and add the end of the window to its own beginning.
  sizeTransform(config_.frameSize);
}

/** Size the transform and its scratch. Allocates; never called from detect. */
void Mpm::sizeTransform(std::size_t n) {
  fft_.configure(2 * (n < 4 ? 4 : n));
  re_.assign(fft_.size(), 0.0);
  im_.assign(fft_.size(), 0.0);
  power_.assign(fft_.size() / 2 + 1, 0.0);
  lastPower_.assign(power_.size(), 0.0);
  energy_.assign((n < 4 ? 4 : n) + 1, 0.0);
  hasPrevious_ = false;
}

/**
 * What the magnitude spectrum says, before it is turned back into lags.
 *
 * All four readings answer questions periodicity cannot. Centroid and rolloff
 * say where an unpitched sound sits — a thump and a hiss are both unvoiced and
 * differ in nothing else. Flatness says whether it is pitched at all, directly
 * rather than by inference from how well it correlates with itself. Flux says
 * that something new started, which is what an attack is (INV-PITCH-026).
 */
void Mpm::readSpectrum(std::size_t n) {
  const double sampleRate = config_.sampleRateHz;
  const std::size_t bins = power_.size();
  if (bins < 2 || sampleRate <= 0.0 || n == 0) {
    spectral_ = Spectral{};
    return;
  }
  const double binHz = sampleRate / static_cast<double>(fft_.size());

  double total = 0.0;
  double weighted = 0.0;
  double logSum = 0.0;
  for (std::size_t k = 1; k < bins; ++k) {
    const double p = power_[k];
    total += p;
    weighted += p * binHz * static_cast<double>(k);
    // Geometric mean in the log domain, floored so one empty bin does not
    // drive the whole product to zero.
    logSum += std::log(p > kTinyPower ? p : kTinyPower);
  }
  if (!(total > 0.0)) {
    spectral_ = Spectral{};
    hasPrevious_ = false;
    return;
  }
  const double count = static_cast<double>(bins - 1);
  const double arithmetic = total / count;
  const double geometric = std::exp(logSum / count);

  Spectral out;
  out.centroidHz = weighted / total;
  out.flatness = arithmetic > 0.0 ? geometric / arithmetic : 0.0;

  // Rolloff: the frequency below which most of the energy lies.
  double running = 0.0;
  for (std::size_t k = 1; k < bins; ++k) {
    running += power_[k];
    if (running >= kRolloffShare * total) {
      out.rolloffHz = binHz * static_cast<double>(k);
      break;
    }
  }

  // Flux: how far the spectrum moved. Only rises count — an attack adds
  // energy, and a note ending is not an onset.
  if (hasPrevious_) {
    double rise = 0.0;
    for (std::size_t k = 1; k < bins; ++k) {
      const double delta = power_[k] - lastPower_[k];
      if (delta > 0.0) {
        rise += delta;
      }
    }
    out.fluxDb = 10.0 * std::log10((rise + kTinyPower) / (total + kTinyPower));
  }
  lastPower_.assign(power_.begin(), power_.end());
  hasPrevious_ = true;
  spectral_ = out;
}

/**
 * The frame into the frequency domain and back out as its autocorrelation.
 *
 * Wiener-Khinchin: the autocorrelation of a signal is the inverse transform
 * of its power spectrum. Two transforms and a magnitude, where the direct sum
 * was two million multiply-adds (INV-PITCH-026). The power spectrum is kept
 * on the way through, because it is the only thing that can say what an
 * unpitched sound was.
 */
void Mpm::transform(const float* frame, std::size_t n) {
  const std::size_t size = fft_.size();
  for (std::size_t i = 0; i < size; ++i) {
    re_[i] = i < n ? static_cast<double>(frame[i]) : 0.0;
    im_[i] = 0.0;
  }
  fft_.forward(re_.data(), im_.data());
  for (std::size_t k = 0; k < size; ++k) {
    const double magnitude = re_[k] * re_[k] + im_[k] * im_[k];
    if (k < power_.size()) {
      power_[k] = magnitude;
    }
    re_[k] = magnitude;
    im_[k] = 0.0;
  }
  readSpectrum(n);
  // Back out: re_[tau] is now the autocorrelation at lag tau.
  fft_.inverse(re_.data(), im_.data());
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
  if (energy_.size() < n + 1 || fft_.size() < 2 * n) {
    sizeTransform(n);  // likewise: only when asked for more than configured
  }
  float* nsdf = nsdf_.data();

  // Normalized Square Difference Function (NSDF), type-II autocorrelation.
  //
  // The numerator comes from the transform. The denominator is
  //   m(tau) = sum(x[i]^2, i < n-tau) + sum(x[i]^2, tau <= i < n)
  // which is two lookups into a running sum of squares rather than a second
  // pass per lag — the same arithmetic the direct loop did, at O(n) instead
  // of O(n^2) (INV-PITCH-026).
  //
  // acf accumulates in double (matching JS number); nsdf stores float32
  // (matching the TS Float32Array) so peak picking sees identical values.
  transform(frame, n);
  energy_[0] = 0.0;
  for (std::size_t i = 0; i < n; ++i) {
    const double x = static_cast<double>(frame[i]);
    energy_[i + 1] = energy_[i] + x * x;
  }
  for (std::size_t tau = 0; tau < n; ++tau) {
    const double acf = re_[tau];
    const double div = energy_[n - tau] + (energy_[n] - energy_[tau]);
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
