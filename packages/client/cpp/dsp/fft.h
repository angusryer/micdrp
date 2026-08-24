// fft.h — an in-place radix-2 FFT, sized once and reused.
//
// Here for two reasons that turn out to be one. The pitch detector's NSDF
// needs an autocorrelation, which it was computing directly at O(n^2) — about
// two million multiply-adds per frame, nine percent of a core before anything
// else runs. Autocorrelation is a transform, a magnitude, and a transform back
// (Wiener-Khinchin), which is O(n log n): a twentieth of the work.
//
// And the magnitude spectrum it passes through on the way is exactly what
// telling a thumped sound from a hissed one needs. The expensive question and
// the one we could not answer at all have the same answer (INV-PITCH-026).
//
// Doubles throughout, matching the TS oracle's number type, so the parity test
// compares like with like.
//
// configure() allocates; forward() and inverse() do not. Size once off the
// audio thread and the hot path is arithmetic only.

#ifndef MICDRP_DSP_FFT_H
#define MICDRP_DSP_FFT_H

#include <cmath>
#include <cstddef>
#include <vector>

namespace micdrp::dsp {

/** The smallest power of two at or above `n`, and at least 1. */
inline std::size_t nextPowerOfTwo(std::size_t n) {
  std::size_t size = 1;
  while (size < n) {
    size <<= 1;
  }
  return size;
}

class Fft {
 public:
  /** Size the transform. `size` is rounded up to a power of two. */
  void configure(std::size_t size) {
    n_ = nextPowerOfTwo(size < 2 ? 2 : size);
    // Bit-reversal permutation, worked out once rather than per transform.
    reversed_.assign(n_, 0);
    std::size_t bits = 0;
    while ((static_cast<std::size_t>(1) << bits) < n_) {
      ++bits;
    }
    for (std::size_t i = 0; i < n_; ++i) {
      std::size_t r = 0;
      for (std::size_t b = 0; b < bits; ++b) {
        if (i & (static_cast<std::size_t>(1) << b)) {
          r |= static_cast<std::size_t>(1) << (bits - 1 - b);
        }
      }
      reversed_[i] = r;
    }
    // Twiddles for every stage, laid out so a stage reads a contiguous run.
    cos_.assign(n_ / 2, 0.0);
    sin_.assign(n_ / 2, 0.0);
    for (std::size_t i = 0; i < n_ / 2; ++i) {
      const double angle =
          -2.0 * M_PI * static_cast<double>(i) / static_cast<double>(n_);
      cos_[i] = std::cos(angle);
      sin_[i] = std::sin(angle);
    }
  }

  std::size_t size() const { return n_; }

  /** In place, unnormalised. `re` and `im` must both be size() long. */
  void forward(double* re, double* im) const { run(re, im, false); }

  /** In place, scaled by 1/size(), so inverse(forward(x)) == x. */
  void inverse(double* re, double* im) const { run(re, im, true); }

 private:
  void run(double* re, double* im, bool isInverse) const {
    if (n_ == 0 || re == nullptr || im == nullptr) {
      return;
    }
    for (std::size_t i = 0; i < n_; ++i) {
      const std::size_t j = reversed_[i];
      if (j > i) {
        std::swap(re[i], re[j]);
        std::swap(im[i], im[j]);
      }
    }
    for (std::size_t span = 1; span < n_; span <<= 1) {
      const std::size_t stride = n_ / (span * 2);
      for (std::size_t start = 0; start < n_; start += span * 2) {
        for (std::size_t k = 0; k < span; ++k) {
          const std::size_t t = k * stride;
          const double wr = cos_[t];
          // The inverse is the forward with the twiddles conjugated, which is
          // the whole difference between them.
          const double wi = isInverse ? -sin_[t] : sin_[t];
          const std::size_t a = start + k;
          const std::size_t b = a + span;
          const double xr = re[b] * wr - im[b] * wi;
          const double xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr;
          im[b] = im[a] - xi;
          re[a] += xr;
          im[a] += xi;
        }
      }
    }
    if (isInverse) {
      const double scale = 1.0 / static_cast<double>(n_);
      for (std::size_t i = 0; i < n_; ++i) {
        re[i] *= scale;
        im[i] *= scale;
      }
    }
  }

  std::size_t n_ = 0;
  std::vector<std::size_t> reversed_{};
  std::vector<double> cos_{};
  std::vector<double> sin_{};
};

}  // namespace micdrp::dsp

#endif  // MICDRP_DSP_FFT_H
