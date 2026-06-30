//
// audio_jni.cpp — WP-AUDIO-BRIDGE
//
// JNI glue between com.micdrp.AudioEngineModule (Java) and the shared C++ DSP
// core in packages/client/cpp/dsp (owned by WP-DSP-CORE). Mirrors the iOS path:
// this file owns only the streaming shell (hop buffering + frame accumulation);
// the MPM math + note conversion live in cpp/dsp so there is a single source of
// truth (host-parity-tested against packages/logic).
//
// Frames are marshalled to Java as flat doubles:
//   [timestampMs, frequencyHz, clarity, midi, cents, voiced]
//
// Built into libmicdrp_audio.so by CMakeLists.txt in this directory.
//

#include <jni.h>

#include <vector>

#include "mpm.h"    // micdrp::dsp::Mpm, EngineConfig, PitchResult
#include "notes.h"  // micdrp::dsp::frequencyToNote, NoteReading

namespace {

// Per-frame stride in the flat double array handed to Java.
constexpr int kStride = 6;

struct EngineConfig {
  double sampleRateHz = 44100.0;
  int frameSize = 2048;
  int hopSize = 1024;
  double minFrequencyHz = 70.0;
  double maxFrequencyHz = 1200.0;
  double clarityThreshold = 0.9;
};

struct PitchSample {
  double timestampMs = 0;
  double frequencyHz = 0;
  double clarity = 0;
  int midi = 0;
  int cents = 0;
  bool voiced = false;
};

// Streaming MPM over a sliding frame. Buffers PCM into `frameSize` windows
// advancing by `hopSize`, appending one PitchSample per full window. Retains the
// full (un-throttled) analysis for drain on stop().
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
    mpm_.configure(dsp);
  }

  std::vector<PitchSample> &samples() { return samples_; }

  void push(const float *mono, int count, double tMs, std::vector<PitchSample> &out) {
    for (int i = 0; i < count; ++i) {
      buffer_.push_back(mono[i]);
    }
    const int hop = cfg_.hopSize > 0 ? cfg_.hopSize : cfg_.frameSize;
    while (static_cast<int>(buffer_.size()) >= cfg_.frameSize) {
      analyzeWindow(tMs, out);
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
    if (r.voiced && r.clarity >= cfg_.clarityThreshold) {
      micdrp::dsp::NoteReading note = micdrp::dsp::frequencyToNote(r.frequencyHz);
      s.frequencyHz = r.frequencyHz;
      s.midi = note.midi;
      s.cents = note.cents;
      s.voiced = true;
    }
    out.push_back(s);  // `out` aliases samples_ from the JNI caller
  }

  EngineConfig cfg_;
  micdrp::dsp::Mpm mpm_;
  std::vector<float> buffer_;
  std::vector<PitchSample> samples_;
};

inline PitchEngine *fromHandle(jlong handle) {
  return reinterpret_cast<PitchEngine *>(handle);
}

void packFrame(double *out, const PitchSample &s) {
  out[0] = s.timestampMs;
  out[1] = s.frequencyHz;
  out[2] = s.clarity;
  out[3] = s.voiced ? static_cast<double>(s.midi) : 0.0;
  out[4] = s.voiced ? static_cast<double>(s.cents) : 0.0;
  out[5] = s.voiced ? 1.0 : 0.0;
}

}  // namespace

extern "C" {

JNIEXPORT jlong JNICALL
Java_com_micdrp_AudioEngineModule_nativeCreate(JNIEnv * /*env*/, jobject /*thiz*/,
                                               jint sampleRateHz, jint frameSize,
                                               jint hopSize, jdouble minFrequencyHz,
                                               jdouble maxFrequencyHz,
                                               jdouble clarityThreshold) {
  EngineConfig cfg;
  cfg.sampleRateHz = static_cast<double>(sampleRateHz);
  cfg.frameSize = static_cast<int>(frameSize);
  cfg.hopSize = static_cast<int>(hopSize);
  cfg.minFrequencyHz = static_cast<double>(minFrequencyHz);
  cfg.maxFrequencyHz = static_cast<double>(maxFrequencyHz);
  cfg.clarityThreshold = static_cast<double>(clarityThreshold);
  auto *engine = new PitchEngine(cfg);
  return reinterpret_cast<jlong>(engine);
}

JNIEXPORT jdoubleArray JNICALL
Java_com_micdrp_AudioEngineModule_nativePush(JNIEnv *env, jobject /*thiz*/,
                                             jlong handle, jfloatArray samples,
                                             jint length, jdouble timestampMs) {
  PitchEngine *engine = fromHandle(handle);
  if (engine == nullptr || samples == nullptr || length <= 0) {
    return nullptr;
  }

  jfloat *pcm = env->GetFloatArrayElements(samples, nullptr);
  if (pcm == nullptr) {
    return nullptr;
  }

  std::vector<PitchSample> &all = engine->samples();
  const size_t before = all.size();
  engine->push(reinterpret_cast<const float *>(pcm), static_cast<int>(length),
               static_cast<double>(timestampMs), all);
  env->ReleaseFloatArrayElements(samples, pcm, JNI_ABORT);

  if (all.size() == before) {
    return nullptr;  // no new analysed frame this hop
  }

  double packed[kStride];
  packFrame(packed, all.back());
  jdoubleArray out = env->NewDoubleArray(kStride);
  if (out == nullptr) {
    return nullptr;
  }
  env->SetDoubleArrayRegion(out, 0, kStride, packed);
  return out;
}

JNIEXPORT jdoubleArray JNICALL
Java_com_micdrp_AudioEngineModule_nativeDrain(JNIEnv *env, jobject /*thiz*/,
                                              jlong handle) {
  PitchEngine *engine = fromHandle(handle);
  if (engine == nullptr) {
    return env->NewDoubleArray(0);
  }
  const std::vector<PitchSample> &all = engine->samples();
  const jsize count = static_cast<jsize>(all.size());
  jdoubleArray out = env->NewDoubleArray(count * kStride);
  if (out == nullptr) {
    return nullptr;
  }
  if (count > 0) {
    std::vector<double> flat(static_cast<size_t>(count) * kStride);
    for (size_t i = 0; i < all.size(); ++i) {
      packFrame(&flat[i * kStride], all[i]);
    }
    env->SetDoubleArrayRegion(out, 0, count * kStride, flat.data());
  }
  return out;
}

JNIEXPORT void JNICALL
Java_com_micdrp_AudioEngineModule_nativeDestroy(JNIEnv * /*env*/, jobject /*thiz*/,
                                                jlong handle) {
  delete fromHandle(handle);
}

}  // extern "C"
