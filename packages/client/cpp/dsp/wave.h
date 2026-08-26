// wave.h — the shapes a voice can speak in (INV-NOTES-144).
//
// Every synthesized voice used to be a sine. A sine is the one waveform with
// nothing in it but its fundamental, so five parts playing at once were five
// things the ear had only pitch and level to separate — which is why the mix
// sounded crowded before it sounded loud.
//
// Band-limited where it matters. A naive saw at 55Hz on a 48kHz engine folds
// hundreds of partials back down the spectrum, and they land as a metallic
// buzz exactly where a voice does — worse than the plain sine it replaces.
// PolyBLEP costs two multiplies near each discontinuity and nothing anywhere
// else, which is the right trade on an audio thread.
//
// Header-only and dependency-free, like the rest of this core: it is arithmetic
// on a phase, and it is testable on a host with no audio device.

#ifndef MICDRP_DSP_WAVE_H
#define MICDRP_DSP_WAVE_H

#include <cmath>
#include <cstdint>

namespace micdrp {

/// What a bus sounds like. Ordered so the numbers can cross a language
/// boundary; what each means is decided by the caller (INV-NOTES-121).
enum class Wave : int {
  Sine = 0,      ///< nothing but the fundamental — a reference tone
  Triangle = 1,  ///< soft odd partials, falling fast; a flute-ish body
  Square = 2,    ///< hollow odd partials; reads as a reed or an organ
  Saw = 3,       ///< every partial; the brightest, and what a bass wants
  Noise = 4      ///< no pitch at all, for standing in for a drum
};

/// One step of a 32-bit LCG. Cheap, allocation-free, and good enough for a
/// noise voice — this is a drum stand-in, not a random number generator.
inline float whiteNoise(std::uint32_t& state) {
  state = state * 1664525u + 1013904223u;
  // Top 24 bits into -1..1: the low bits of an LCG are the weakest.
  return static_cast<float>(state >> 8) * (2.0f / 16777216.0f) - 1.0f;
}

/**
 * PolyBLEP — the correction that rounds off a discontinuity.
 *
 * A step in a waveform is infinite bandwidth, which a sampled signal cannot
 * hold, so it aliases. This subtracts a small polynomial either side of the
 * jump, which is a band-limited step to first order and audibly enough.
 *
 * `t` is the phase 0..1 and `dt` is one sample's worth of it.
 */
inline float polyBlep(float t, float dt) {
  if (dt <= 0.0f) {
    return 0.0f;
  }
  if (t < dt) {
    const float x = t / dt;
    return x + x - x * x - 1.0f;
  }
  if (t > 1.0f - dt) {
    const float x = (t - 1.0f) / dt;
    return x * x + x + x + 1.0f;
  }
  return 0.0f;
}

/**
 * One sample of `wave` at phase `t` (0..1), advancing `dt` per sample.
 *
 * `dt` is only used to band-limit the shapes with edges; a sine and a
 * triangle have none and ignore it.
 */
inline float waveSample(Wave wave, float t, float dt, std::uint32_t& noise) {
  constexpr float kTwoPi = 6.283185307179586f;
  switch (wave) {
    case Wave::Sine:
      return std::sin(kTwoPi * t);
    case Wave::Triangle:
      // Partials fall as the square of their number, so it is naturally quiet
      // above the fundamental and needs no correction to stay clean.
      return 4.0f * std::fabs(t - 0.5f) - 1.0f;
    case Wave::Square: {
      const float raw = t < 0.5f ? 1.0f : -1.0f;
      // Two edges a cycle: one at the top of the phase and one at the half.
      return raw + polyBlep(t, dt) -
             polyBlep(std::fmod(t + 0.5f, 1.0f), dt);
    }
    case Wave::Saw:
      return 2.0f * t - 1.0f - polyBlep(t, dt);
    case Wave::Noise:
      return whiteNoise(noise);
  }
  return 0.0f;
}

}  // namespace micdrp

#endif  // MICDRP_DSP_WAVE_H
