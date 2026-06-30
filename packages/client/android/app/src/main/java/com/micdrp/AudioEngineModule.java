package com.micdrp;

import android.Manifest;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * WP-AUDIO-BRIDGE — Tier-1 native audio engine (Android).
 *
 * <p>Pipeline: {@link AudioRecord} PCM capture on a dedicated thread -> JNI into
 * the shared C++ PitchEngine (packages/client/cpp/dsp, bridged by audio_jni.cpp)
 * -> MPM analysis -> throttled {@code PitchSample} maps emitted to JS via
 * {@link DeviceEventManagerModule.RCTDeviceEventEmitter}. Raw PCM never crosses
 * into JS; captured audio is written to a .wav for the RecordingHandle uri and
 * the full (un-throttled) analysis is returned from {@code stop()}.
 *
 * <p>The JS app never touches this directly — it goes through
 * {@code src/audio/AudioEngine.ts}, which picks this module when present.
 */
public class AudioEngineModule extends ReactContextBaseJavaModule {

  static {
    // libmicdrp_audio.so packages cpp/dsp + audio_jni.cpp (see app CMakeLists).
    System.loadLibrary("micdrp_audio");
  }

  private static final String TAG = "AudioEngineModule";
  private static final String PITCH_EVENT = "AudioEnginePitch";
  private static final String STATE_EVENT = "AudioEngineState";

  private final ReactApplicationContext reactContext;

  // Config (mirrors DEFAULT_ENGINE_CONFIG).
  private int sampleRateHz = 44100;
  private int frameSize = 2048;
  private int hopSize = 1024;
  private double minFrequencyHz = 70;
  private double maxFrequencyHz = 1200;
  private double clarityThreshold = 0.9;
  private double emitRateHz = 60;

  private final AtomicBoolean running = new AtomicBoolean(false);
  private Thread captureThread;
  private long engineHandle = 0; // native PitchEngine pointer

  private long startTimeMs;
  private long lastEmitMs;
  private String recordingId;
  private File captureFile;

  AudioEngineModule(ReactApplicationContext context) {
    super(context);
    this.reactContext = context;
  }

  @NonNull
  @Override
  public String getName() {
    return "AudioEngineModule";
  }

  // ---- JNI bridge to cpp/dsp (implemented in audio_jni.cpp) ----

  /** Create a native PitchEngine; returns an opaque handle (pointer as long). */
  private native long nativeCreate(int sampleRateHz, int frameSize, int hopSize,
                                   double minFrequencyHz, double maxFrequencyHz,
                                   double clarityThreshold);

  /**
   * Feed a mono Float32 hop. Returns the latest analysed frame packed as
   * [timestampMs, frequencyHz, clarity, midi, cents, voiced] or null if no new
   * frame was produced. Full-resolution frames are accumulated natively.
   */
  private native double[] nativePush(long handle, float[] samples, int length, double timestampMs);

  /** Drain all accumulated frames as a flat [t,f,clarity,midi,cents,voiced,...] array. */
  private native double[] nativeDrain(long handle);

  /** Destroy the native engine. */
  private native void nativeDestroy(long handle);

  // ---- config ----

  @ReactMethod
  public void configure(ReadableMap config, Promise promise) {
    try {
      if (config.hasKey("sampleRateHz")) sampleRateHz = config.getInt("sampleRateHz");
      if (config.hasKey("frameSize")) frameSize = config.getInt("frameSize");
      if (config.hasKey("hopSize")) hopSize = config.getInt("hopSize");
      if (config.hasKey("minFrequencyHz")) minFrequencyHz = config.getDouble("minFrequencyHz");
      if (config.hasKey("maxFrequencyHz")) maxFrequencyHz = config.getDouble("maxFrequencyHz");
      if (config.hasKey("clarityThreshold")) clarityThreshold = config.getDouble("clarityThreshold");
      if (config.hasKey("emitRateHz")) emitRateHz = config.getDouble("emitRateHz");
      promise.resolve(null);
    } catch (Exception e) {
      promise.reject("configure_failed", e);
    }
  }

  // ---- permission ----

  @ReactMethod
  public void requestPermission(Promise promise) {
    boolean granted = ContextCompat.checkSelfPermission(
        reactContext, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
    // Interactive request is driven by the host Activity / a permissions lib at
    // the JS layer; here we report the current grant state.
    promise.resolve(granted);
  }

  // ---- start ----

  @ReactMethod
  public void start(Promise promise) {
    if (running.get()) {
      promise.resolve(null);
      return;
    }
    if (ContextCompat.checkSelfPermission(reactContext, Manifest.permission.RECORD_AUDIO)
        != PackageManager.PERMISSION_GRANTED) {
      emitState("error");
      promise.reject("permission_denied", "RECORD_AUDIO not granted");
      return;
    }

    final int minBuf = AudioRecord.getMinBufferSize(
        sampleRateHz, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_FLOAT);
    if (minBuf <= 0) {
      emitState("error");
      promise.reject("audio_init_failed", "Invalid AudioRecord buffer size");
      return;
    }
    final int bufferBytes = Math.max(minBuf, hopSize * 4 * 4);

    final AudioRecord record;
    try {
      record = new AudioRecord(
          MediaRecorder.AudioSource.MIC,
          sampleRateHz,
          AudioFormat.CHANNEL_IN_MONO,
          AudioFormat.ENCODING_PCM_FLOAT,
          bufferBytes);
    } catch (IllegalArgumentException e) {
      emitState("error");
      promise.reject("audio_init_failed", e);
      return;
    }
    if (record.getState() != AudioRecord.STATE_INITIALIZED) {
      record.release();
      emitState("error");
      promise.reject("audio_init_failed", "AudioRecord failed to initialize");
      return;
    }

    engineHandle = nativeCreate(sampleRateHz, frameSize, hopSize,
        minFrequencyHz, maxFrequencyHz, clarityThreshold);

    recordingId = UUID.randomUUID().toString();
    captureFile = new File(reactContext.getCacheDir(), "micdrp-" + recordingId + ".wav");

    startTimeMs = System.currentTimeMillis();
    lastEmitMs = 0;
    running.set(true);

    captureThread = new Thread(() -> captureLoop(record), "micdrp-audio");
    captureThread.start();

    emitState("recording");
    promise.resolve(null);
  }

  private void captureLoop(AudioRecord record) {
    FileOutputStream pcmOut = null;
    long pcmBytes = 0;
    try {
      pcmOut = new FileOutputStream(captureFile);
      // Reserve 44-byte WAV header; filled in on close.
      pcmOut.write(new byte[44]);

      record.startRecording();
      final float[] buf = new float[hopSize];
      final byte[] pcmScratch = new byte[hopSize * 2];

      while (running.get()) {
        int read = record.read(buf, 0, hopSize, AudioRecord.READ_BLOCKING);
        if (read <= 0) {
          continue;
        }
        final double tMs = System.currentTimeMillis() - startTimeMs;
        final double[] latest = nativePush(engineHandle, buf, read, tMs);

        // Persist as 16-bit PCM little-endian.
        int byteLen = 0;
        for (int i = 0; i < read; i++) {
          float clamped = buf[i] < -1f ? -1f : (buf[i] > 1f ? 1f : buf[i]);
          short s = (short) (clamped * 32767f);
          pcmScratch[byteLen++] = (byte) (s & 0xff);
          pcmScratch[byteLen++] = (byte) ((s >> 8) & 0xff);
        }
        pcmOut.write(pcmScratch, 0, byteLen);
        pcmBytes += byteLen;

        if (latest != null) {
          maybeEmitPitch(latest);
        }
      }
    } catch (IOException e) {
      Log.w(TAG, "capture loop io error", e);
    } finally {
      try {
        record.stop();
      } catch (IllegalStateException ignored) {
      }
      record.release();
      if (pcmOut != null) {
        try {
          pcmOut.close();
        } catch (IOException ignored) {
        }
        writeWavHeader(captureFile, pcmBytes, sampleRateHz);
      }
    }
  }

  private void maybeEmitPitch(double[] frame) {
    final long now = System.currentTimeMillis();
    final double minInterval = 1000.0 / (emitRateHz > 0 ? emitRateHz : 60.0);
    if (now - lastEmitMs < minInterval) {
      return;
    }
    lastEmitMs = now;
    emitPitch(frameToMap(frame));
  }

  // frame layout: [timestampMs, frequencyHz, clarity, midi, cents, voiced]
  private WritableMap frameToMap(double[] f) {
    WritableMap map = Arguments.createMap();
    map.putDouble("timestampMs", f[0]);
    map.putDouble("frequencyHz", f[1]);
    map.putDouble("clarity", f[2]);
    boolean voiced = f[5] != 0;
    if (voiced) {
      map.putInt("midi", (int) Math.round(f[3]));
      map.putInt("cents", (int) Math.round(f[4]));
    } else {
      map.putNull("midi");
      map.putNull("cents");
    }
    return map;
  }

  // ---- stop ----

  @ReactMethod
  public void stop(Promise promise) {
    if (!running.get()) {
      promise.reject("not_running", "AudioEngine is not running");
      return;
    }
    emitState("analyzing");
    running.set(false);

    final Thread t = captureThread;
    if (t != null) {
      try {
        t.join(2000);
      } catch (InterruptedException ignored) {
        Thread.currentThread().interrupt();
      }
    }
    captureThread = null;

    final long durationMs = System.currentTimeMillis() - startTimeMs;

    final double[] flat = engineHandle != 0 ? nativeDrain(engineHandle) : new double[0];
    if (engineHandle != 0) {
      nativeDestroy(engineHandle);
      engineHandle = 0;
    }

    WritableArray samples = Arguments.createArray();
    if (flat != null) {
      for (int i = 0; i + 6 <= flat.length; i += 6) {
        double[] frame = new double[]{flat[i], flat[i + 1], flat[i + 2],
            flat[i + 3], flat[i + 4], flat[i + 5]};
        samples.pushMap(frameToMap(frame));
      }
    }

    WritableMap handle = Arguments.createMap();
    handle.putString("id", recordingId != null ? recordingId : UUID.randomUUID().toString());
    handle.putString("uri", captureFile != null ? "file://" + captureFile.getAbsolutePath() : "");
    handle.putDouble("sampleRateHz", sampleRateHz);
    handle.putDouble("durationMs", durationMs);
    handle.putArray("samples", samples);

    emitState("idle");
    promise.resolve(handle);
  }

  // ---- emitters ----

  private void emitPitch(WritableMap body) {
    if (!reactContext.hasActiveCatalystInstance()) {
      return;
    }
    reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
        .emit(PITCH_EVENT, body);
  }

  private void emitState(String state) {
    if (!reactContext.hasActiveCatalystInstance()) {
      return;
    }
    reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
        .emit(STATE_EVENT, state);
  }

  // RCTEventEmitter parity no-ops so JS NativeEventEmitter does not warn.
  @ReactMethod
  public void addListener(String eventName) {
    // no-op: events are emitted via RCTDeviceEventEmitter
  }

  @ReactMethod
  public void removeListeners(double count) {
    // no-op
  }

  // ---- minimal WAV (16-bit PCM mono) header writer ----

  private static void writeWavHeader(File file, long pcmBytes, int sampleRate) {
    try (RandomAccessFile raf = new RandomAccessFile(file, "rw")) {
      long totalDataLen = pcmBytes + 36;
      int channels = 1;
      int bitsPerSample = 16;
      long byteRate = (long) sampleRate * channels * bitsPerSample / 8;
      ByteBuffer header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN);
      header.put("RIFF".getBytes());
      header.putInt((int) totalDataLen);
      header.put("WAVE".getBytes());
      header.put("fmt ".getBytes());
      header.putInt(16); // PCM subchunk size
      header.putShort((short) 1); // audio format = PCM
      header.putShort((short) channels);
      header.putInt(sampleRate);
      header.putInt((int) byteRate);
      header.putShort((short) (channels * bitsPerSample / 8)); // block align
      header.putShort((short) bitsPerSample);
      header.put("data".getBytes());
      header.putInt((int) pcmBytes);
      raf.seek(0);
      raf.write(header.array());
    } catch (IOException e) {
      Log.w(TAG, "failed to finalize wav header", e);
    }
  }
}
