// fft_test.cpp — the transform, checked against results known by hand.
//
// Everything downstream of this is arithmetic on its output, so a wrong FFT
// would show up as a plausible-looking pitch that is simply not the one that
// was sung. These are the cases whose answers can be written down without a
// second implementation to compare against.
//
//   c++ -std=c++17 -O2 -I. __tests__/fft_test.cpp -o dsp_fft_test

#include <cmath>
#include <cstdio>
#include <vector>

#include "fft.h"

using micdrp::dsp::Fft;
using micdrp::dsp::nextPowerOfTwo;

namespace {

int failures = 0;

void check(bool ok, const char* what) {
  if (!ok) {
    std::printf("FAIL: %s\n", what);
    ++failures;
  }
}

void near(double got, double want, double tol, const char* what) {
  if (std::fabs(got - want) > tol) {
    std::printf("FAIL: %s (got %.9f, wanted %.9f)\n", what, got, want);
    ++failures;
  }
}

}  // namespace

int main() {
  check(nextPowerOfTwo(1) == 1, "one is already a power of two");
  check(nextPowerOfTwo(1024) == 1024, "and so is 1024");
  check(nextPowerOfTwo(1025) == 2048, "one past rounds up");
  check(nextPowerOfTwo(0) == 1, "nothing rounds up to one");

  Fft fft;
  fft.configure(8);
  check(fft.size() == 8, "configured to the size asked for");

  // A constant signal is all energy at DC and none anywhere else.
  {
    std::vector<double> re(8, 1.0), im(8, 0.0);
    fft.forward(re.data(), im.data());
    near(re[0], 8.0, 1e-12, "a constant is N at bin zero");
    for (std::size_t k = 1; k < 8; ++k) {
      near(re[k], 0.0, 1e-12, "and nothing at any other bin");
      near(im[k], 0.0, 1e-12, "with no imaginary part either");
    }
  }

  // A sine at exactly bin 1 puts all its energy in bins 1 and N-1.
  {
    std::vector<double> re(8), im(8, 0.0);
    for (std::size_t i = 0; i < 8; ++i) {
      re[i] = std::sin(2.0 * M_PI * static_cast<double>(i) / 8.0);
    }
    fft.forward(re.data(), im.data());
    near(std::hypot(re[1], im[1]), 4.0, 1e-12, "a bin-1 sine has magnitude N/2");
    near(std::hypot(re[7], im[7]), 4.0, 1e-12, "mirrored at N-1");
    near(std::hypot(re[2], im[2]), 0.0, 1e-12, "and nothing at bin 2");
  }

  // The property everything else rests on: a round trip changes nothing.
  {
    const std::size_t n = 1024;
    Fft big;
    big.configure(n);
    std::vector<double> re(n), im(n, 0.0), wasRe(n);
    for (std::size_t i = 0; i < n; ++i) {
      re[i] = std::sin(2.0 * M_PI * 7.0 * static_cast<double>(i) / n) +
              0.4 * std::cos(2.0 * M_PI * 61.0 * static_cast<double>(i) / n);
      wasRe[i] = re[i];
    }
    big.forward(re.data(), im.data());
    big.inverse(re.data(), im.data());
    double worst = 0.0;
    for (std::size_t i = 0; i < n; ++i) {
      worst = std::max(worst, std::fabs(re[i] - wasRe[i]));
    }
    near(worst, 0.0, 1e-12, "a forward and an inverse leave the signal alone");
  }

  // Autocorrelation by transform, against the direct sum it replaces. This is
  // the substitution the pitch detector depends on, so it is checked against
  // the arithmetic it is standing in for rather than against itself.
  {
    const std::size_t n = 64;
    std::vector<double> x(n);
    for (std::size_t i = 0; i < n; ++i) {
      x[i] = std::sin(2.0 * M_PI * 5.0 * static_cast<double>(i) / n) + 0.1;
    }
    Fft big;
    big.configure(2 * n);
    std::vector<double> re(big.size(), 0.0), im(big.size(), 0.0);
    for (std::size_t i = 0; i < n; ++i) {
      re[i] = x[i];
    }
    big.forward(re.data(), im.data());
    for (std::size_t k = 0; k < big.size(); ++k) {
      re[k] = re[k] * re[k] + im[k] * im[k];
      im[k] = 0.0;
    }
    big.inverse(re.data(), im.data());

    double worst = 0.0;
    for (std::size_t tau = 0; tau < n; ++tau) {
      double direct = 0.0;
      for (std::size_t i = 0; i + tau < n; ++i) {
        direct += x[i] * x[i + tau];
      }
      worst = std::max(worst, std::fabs(re[tau] - direct));
    }
    near(worst, 0.0, 1e-10,
         "autocorrelation by transform matches the direct sum");
  }

  if (failures > 0) {
    std::printf("%d failure(s)\n", failures);
    return 1;
  }
  std::printf("FFT OK\n");
  return 0;
}
