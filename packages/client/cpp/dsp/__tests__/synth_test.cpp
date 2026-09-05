// synth_test.cpp — host test for the shared voice pool (INV-NOTES-028/029).
//
//   cd packages/client/cpp/dsp
//   cmake -S . -B build && cmake --build build && ./build/dsp_synth_test
//
// Or without CMake:
//   c++ -std=c++17 -O2 -I. synth.cpp __tests__/synth_test.cpp -o t && ./t
//
// No audio device is involved: the core produces samples, so everything it
// promises can be checked on a host.

#include "synth.h"

#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <vector>

using micdrp::Bus;
using micdrp::SampleData;
using micdrp::ScheduledNote;
using micdrp::Synth;

namespace {

int failures = 0;

void check(bool ok, const char* what) {
  if (!ok) {
    std::printf("FAIL: %s\n", what);
    ++failures;
  }
}

/// Peak absolute sample over a block — how loud something is, roughly.
float peak(const std::vector<float>& buf) {
  float p = 0.0f;
  for (float s : buf) {
    p = std::max(p, std::fabs(s));
  }
  return p;
}

/// Render `frames` in blocks of `block`, returning everything.
std::vector<float> renderAll(Synth& synth, std::size_t frames, std::size_t block = 256) {
  std::vector<float> out(frames, 0.0f);
  for (std::size_t i = 0; i < frames; i += block) {
    synth.render(out.data() + i, std::min(block, frames - i));
  }
  return out;
}

constexpr double kRate = 48000.0;

void soundsWhatWasScheduled() {
  Synth synth;
  synth.configure(kRate);
  synth.schedule({Bus::Melody, 440.0f, 0, 24000});
  const auto out = renderAll(synth, 24000);
  check(peak(out) > 0.05f, "a scheduled note is audible");
}

void silentBeforeAndAfter() {
  Synth synth;
  synth.configure(kRate);
  // Half a second in, for a quarter second.
  synth.schedule({Bus::Melody, 440.0f, 24000, 36000});

  std::vector<float> before(1000, 0.0f);
  synth.render(before.data(), before.size());
  check(peak(before) == 0.0f, "silent before a note begins");

  renderAll(synth, 47000);  // through the note and past its end
  std::vector<float> after(1000, 0.0f);
  synth.render(after.data(), after.size());
  check(peak(after) == 0.0f, "silent after a note ends");
}

void oneClockForEveryBus() {
  // The reason the pool exists: two busses given the same start must sound
  // together, not as close together as two graphs can manage (INV-NOTES-028).
  Synth a;
  a.configure(kRate);
  a.setBusLevel(Bus::Chords, 0.0f);
  a.schedule({Bus::Melody, 440.0f, 5000, 20000});
  a.schedule({Bus::Chords, 330.0f, 5000, 20000});
  const auto melodyOnly = renderAll(a, 20000);

  Synth b;
  b.configure(kRate);
  b.setBusLevel(Bus::Melody, 0.0f);
  b.schedule({Bus::Melody, 440.0f, 5000, 20000});
  b.schedule({Bus::Chords, 330.0f, 5000, 20000});
  const auto chordsOnly = renderAll(b, 20000);

  // Each bus starts at the same sample, to the sample.
  std::size_t firstMelody = melodyOnly.size();
  std::size_t firstChords = chordsOnly.size();
  for (std::size_t i = 0; i < melodyOnly.size(); ++i) {
    if (firstMelody == melodyOnly.size() && melodyOnly[i] != 0.0f) firstMelody = i;
    if (firstChords == chordsOnly.size() && chordsOnly[i] != 0.0f) firstChords = i;
  }
  check(firstMelody == firstChords, "both busses start on the same sample");
  // A sine begins at zero amplitude, so the first sample that differs from
  // silence is the one after the start.
  check(firstMelody == 5001, "and on the sample they were scheduled for");
}

void levelMovesWhatIsAlreadySounding() {
  // Mixing is done by ear while listening (INV-NOTES-027).
  Synth synth;
  synth.configure(kRate);
  synth.schedule({Bus::Melody, 440.0f, 0, 96000});
  const auto loud = renderAll(synth, 24000);
  synth.setBusLevel(Bus::Melody, 0.25f);
  const auto quiet = renderAll(synth, 24000);
  check(peak(quiet) < peak(loud) * 0.5f, "a level change reaches a sounding note");
}

void silenceIsSilent() {
  Synth synth;
  synth.configure(kRate);
  synth.setBusLevel(Bus::Melody, 0.0f);
  synth.schedule({Bus::Melody, 440.0f, 0, 24000});
  const auto out = renderAll(synth, 24000);
  check(peak(out) == 0.0f, "a bus at zero makes no sound at all");
}

void longTakeCostsNoMoreThanShort() {
  // INV-NOTES-029: the pool is fixed, so hundreds of notes cannot become
  // hundreds of anything.
  Synth synth;
  synth.configure(kRate);
  for (int i = 0; i < 800; ++i) {
    const std::int64_t start = i * 2400;  // one note every 50ms
    synth.schedule({Bus::Melody, 220.0f + static_cast<float>(i % 24) * 10.0f,
                    start, start + 2400});
  }
  std::size_t highWater = 0;
  std::vector<float> block(256, 0.0f);
  for (int i = 0; i < 8000; ++i) {
    synth.render(block.data(), block.size());
    highWater = std::max(highWater, synth.activeVoices());
  }
  check(highWater <= micdrp::kMaxVoices, "voices stay within the pool");
  check(highWater > 0, "and the take actually sounded");
}

void overlappingNotesBeyondThePoolDoNotBreak() {
  Synth synth;
  synth.configure(kRate);
  // Far more at once than there are voices: the excess is stolen, not leaked.
  for (int i = 0; i < 200; ++i) {
    synth.schedule({Bus::Chords, 110.0f + static_cast<float>(i), 0, 96000});
  }
  const auto out = renderAll(synth, 4800);
  check(synth.activeVoices() <= micdrp::kMaxVoices, "the pool is never exceeded");
  check(peak(out) <= 1.0f, "the mix never leaves the representable range");
}

void startsAndStopsWithoutClicking() {
  // A step change in amplitude is heard as a tick against the take.
  Synth synth;
  synth.configure(kRate);
  synth.schedule({Bus::Audition, 440.0f, 100, 4800});
  const auto out = renderAll(synth, 9600);
  float biggestJump = 0.0f;
  for (std::size_t i = 1; i < out.size(); ++i) {
    biggestJump = std::max(biggestJump, std::fabs(out[i] - out[i - 1]));
  }
  // One sample of a 440Hz sine at full voice level moves far less than this;
  // an un-ramped start or stop moves the whole amplitude at once.
  check(biggestJump < 0.05f, "no discontinuity at a note's edges");
}

void clearingABusLeavesOthersSounding() {
  Synth synth;
  synth.configure(kRate);
  synth.schedule({Bus::Melody, 440.0f, 0, 96000});
  synth.schedule({Bus::Chords, 330.0f, 0, 96000});
  renderAll(synth, 4800);
  synth.clearBus(Bus::Melody);
  renderAll(synth, 4800);  // let the release finish
  const auto out = renderAll(synth, 4800);
  check(peak(out) > 0.02f, "the other bus keeps sounding");

  synth.setBusLevel(Bus::Chords, 0.0f);
  const auto silent = renderAll(synth, 4800);
  check(peak(silent) == 0.0f, "and the cleared bus contributes nothing");
}

void reconfiguringResets() {
  // Sample positions from another rate describe different moments.
  Synth synth;
  synth.configure(kRate);
  synth.schedule({Bus::Melody, 440.0f, 0, 96000});
  renderAll(synth, 4800);
  synth.configure(44100.0);
  check(synth.now() == 0, "the clock restarts");
  const auto out = renderAll(synth, 4800);
  check(peak(out) == 0.0f, "and nothing scheduled under the old rate survives");
}

void nonsenseIsIgnored() {
  Synth synth;
  synth.configure(kRate);
  synth.schedule({Bus::Melody, 440.0f, 1000, 1000});    // zero length
  synth.schedule({Bus::Melody, 440.0f, 2000, 1000});    // ends before it starts
  synth.schedule({Bus::Melody, 0.0f, 0, 24000});        // no pitch
  const auto out = renderAll(synth, 24000);
  check(peak(out) == 0.0f, "a malformed note is dropped, not sounded");
  synth.render(nullptr, 128);  // must not crash
}

void scheduledOutOfOrder() {
  // Notes arrive as a melody is edited, not in time order.
  Synth synth;
  synth.configure(kRate);
  synth.schedule({Bus::Melody, 440.0f, 24000, 36000});
  synth.schedule({Bus::Melody, 330.0f, 0, 12000});
  std::vector<float> first(12000, 0.0f);
  for (std::size_t i = 0; i < first.size(); i += 256) {
    synth.render(first.data() + i, std::min<std::size_t>(256, first.size() - i));
  }
  check(peak(first) > 0.05f, "the earlier note sounds even though it came second");
}



// ---------------------------------------------------------------------------
// Recorded audio: a take is a voice like any other (INV-NOTES-133).

/// A recognisable block of "recorded" audio: frame n holds the value n/10000,
/// which stays inside full scale so the output clamp never hides a mismatch.
std::vector<float> ramp(std::size_t frames) {
  std::vector<float> data(frames);
  for (std::size_t i = 0; i < frames; ++i) {
    data[i] = static_cast<float>(i) / 10000.0f;
  }
  return data;
}

/// Where a note is a sample rather than a tone.
ScheduledNote takeNote(int slot, std::int64_t start, std::int64_t end,
                       std::int64_t from = 0) {
  ScheduledNote note;
  note.bus = Bus::Take;
  note.sampleSlot = slot;
  note.sourceFrame = from;
  note.startSample = start;
  note.endSample = end;
  return note;
}

void soundsTheFramesItWasGiven() {
  Synth synth;
  synth.configure(48000.0);
  const std::vector<float> audio = ramp(2000);
  synth.setSample(0, SampleData{audio.data(), audio.size()});
  synth.schedule(takeNote(0, 0, 1500));

  std::vector<float> out(1024, 0.0f);
  synth.render(out.data(), out.size());
  // Past the ramp-in, the output is the recorded frame at unity — not a tone,
  // and not attenuated the way a synthesized voice is.
  check(std::fabs(out[1000] - audio[1000]) < 0.01f,
        "a scheduled take sounds its own frames");
}

void beginsWhereItWasAskedTo() {
  Synth synth;
  synth.configure(48000.0);
  const std::vector<float> audio = ramp(2000);
  synth.setSample(0, SampleData{audio.data(), audio.size()});
  // Resuming a take part-way through is how a scrubbed playhead sounds.
  synth.schedule(takeNote(0, 0, 900, 1000));

  std::vector<float> out(512, 0.0f);
  synth.render(out.data(), out.size());
  check(std::fabs(out[500] - audio[1500]) < 0.01f,
        "a take begins at the frame it was asked for");
}

void stopsWhenItsSpanEnds() {
  Synth synth;
  synth.configure(48000.0);
  const std::vector<float> audio(4000, 0.5f);
  synth.setSample(0, SampleData{audio.data(), audio.size()});
  synth.schedule(takeNote(0, 0, 256));

  std::vector<float> out(256, 0.0f);
  synth.render(out.data(), out.size());
  // Past the release ramp, which is deliberately not instant: stopping must
  // not click any more than starting does.
  std::vector<float> after(1024, 0.0f);
  synth.render(after.data(), after.size());
  check(peak(std::vector<float>(after.begin() + 512, after.end())) < 0.001f,
        "a take stops when its span ends");
}

void runsOutRatherThanLooping() {
  Synth synth;
  synth.configure(48000.0);
  const std::vector<float> audio(100, 0.5f);
  synth.setSample(0, SampleData{audio.data(), audio.size()});
  // A span far longer than the audio: what is not there is silence, not the
  // beginning again.
  synth.schedule(takeNote(0, 0, 4000));

  std::vector<float> out(200, 0.0f);
  synth.render(out.data(), out.size());
  check(peak(std::vector<float>(out.begin() + 120, out.end())) < 0.02f,
        "a take that ran out is silent rather than looping");
}

void busLevelScalesTheTake() {
  Synth synth;
  synth.configure(48000.0);
  const std::vector<float> audio(4000, 0.8f);
  synth.setSample(0, SampleData{audio.data(), audio.size()});
  synth.setBusLevel(Bus::Take, 0.25f);
  synth.schedule(takeNote(0, 0, 2000));

  std::vector<float> out(512, 0.0f);
  synth.render(out.data(), out.size());
  check(std::fabs(peak(out) - 0.2f) < 0.02f,
        "the take's bus level is the take's level");
}

void replacingASlotLeavesASoundingVoiceAlone() {
  Synth synth;
  synth.configure(48000.0);
  const std::vector<float> first(4000, 0.6f);
  const std::vector<float> second(4000, 0.1f);
  synth.setSample(0, SampleData{first.data(), first.size()});
  synth.schedule(takeNote(0, 0, 4000));

  std::vector<float> out(512, 0.0f);
  synth.render(out.data(), out.size());
  // Loading another take while one is sounding must not change what is being
  // heard: the voice holds the audio it began with.
  synth.setSample(0, SampleData{second.data(), second.size()});
  std::vector<float> after(512, 0.0f);
  synth.render(after.data(), after.size());
  check(std::fabs(peak(after) - 0.6f) < 0.02f,
        "a sounding take keeps the audio it started with");
}

void anEmptySlotSoundsNothing() {
  Synth synth;
  synth.configure(48000.0);
  synth.schedule(takeNote(3, 0, 2000));
  std::vector<float> out(512, 0.0f);
  synth.render(out.data(), out.size());
  check(peak(out) < 0.001f, "a slot with no audio in it sounds nothing");
}

void takeAndToneShareTheClock() {
  Synth synth;
  synth.configure(48000.0);
  const std::vector<float> audio(48000, 0.4f);
  synth.setSample(0, SampleData{audio.data(), audio.size()});
  // Both booked for the same moment, which is the whole point of one engine.
  synth.schedule(takeNote(0, 4800, 24000));
  ScheduledNote tone;
  tone.bus = Bus::Melody;
  tone.frequencyHz = 440.0f;
  tone.startSample = 4800;
  tone.endSample = 24000;
  synth.schedule(tone);

  std::vector<float> before(4096, 0.0f);
  synth.render(before.data(), before.size());
  check(peak(before) < 0.001f, "neither sounds before its moment");
  std::vector<float> at(4096, 0.0f);
  synth.render(at.data(), at.size());
  check(synth.activeVoices() == 2, "a take and a tone start on the same clock");
}

void reconfiguringForgetsLoadedAudio() {
  Synth synth;
  synth.configure(48000.0);
  const std::vector<float> audio(4000, 0.5f);
  synth.setSample(0, SampleData{audio.data(), audio.size()});
  // Frames at one rate are a different duration at another, so they are not
  // audio for the new rate.
  synth.configure(44100.0);
  check(synth.sample(0).frames == nullptr,
        "a rate change forgets audio loaded for the old one");
}

void slotsOutOfRangeAreIgnored() {
  Synth synth;
  synth.configure(48000.0);
  const std::vector<float> audio(4000, 0.5f);
  synth.setSample(-1, SampleData{audio.data(), audio.size()});
  synth.setSample(999, SampleData{audio.data(), audio.size()});
  check(synth.sample(-1).frames == nullptr, "a slot below the range is ignored");
  check(synth.sample(999).frames == nullptr, "a slot above the range is ignored");
}

}  // namespace


/**
 * The run: time passing, owned by the engine (INV-TPORT-010).
 *
 * The app used to remember a start moment and compute elapsed against a
 * wall clock, which is right until the engine is late, suspended or
 * short of a block. And it predicted the end with a timeout set from a
 * duration measured at decode, which is wrong whenever the prediction
 * is and cannot be right about a run that failed early.
 */
void aRunAdvancesWithRenderedBlocks() {
  Synth s;
  s.configure(48000.0);
  s.startTransport(0, 0, 48000);
  check(s.report().running, "a run that began is running");
  std::vector<float> out(4800);
  s.render(out.data(), out.size());
  check(s.report().positionSamples == 4800,
        "the position is where the rendered blocks left it");
}

void aRunBeginsWhereItWasTold() {
  Synth s;
  s.configure(48000.0);
  // Resumed a second in: the position is of the material, not of the run.
  s.startTransport(0, 48000, 96000);
  check(s.report().positionSamples == 48000,
        "a resumed run starts from the offset it was given");
}

void aRunEndsItselfAndSaysSo() {
  Synth s;
  s.configure(48000.0);
  s.startTransport(0, 0, 2400);
  std::vector<float> out(4800);
  s.render(out.data(), out.size());
  const micdrp::TransportReport r = s.report();
  check(!r.running, "a run past its end is not running");
  check(r.ended == 1, "the ending was counted");
  check(r.positionSamples == 2400, "the position stops at the end, not past it");
}

void aStoppedRunHoldsItsPosition() {
  Synth s;
  s.configure(48000.0);
  s.startTransport(0, 0, 48000);
  std::vector<float> out(4800);
  s.render(out.data(), out.size());
  s.stopTransport();
  const std::int64_t held = s.report().positionSamples;
  s.render(out.data(), out.size());
  check(s.report().positionSamples == held,
        "a stopped run does not go on advancing");
}

void startingAgainReplacesTheRun() {
  Synth s;
  s.configure(48000.0);
  s.startTransport(0, 0, 48000);
  const std::uint32_t first = s.report().generation;
  s.startTransport(0, 24000, 48000);
  const micdrp::TransportReport r = s.report();
  check(r.generation != first, "a new run is a new generation");
  check(r.positionSamples == 24000, "the newer run replaced the older one");
}

/** Muting is not stopping (INV-TPORT-013). */
void aSilentBusStillPassesTime() {
  Synth s;
  s.configure(48000.0);
  s.setBusLevel(Bus::Melody, 0.0f);
  s.startTransport(0, 0, 48000);
  std::vector<float> out(4800);
  s.render(out.data(), out.size());
  check(s.report().running, "time passes with every bus silent");
  check(s.report().positionSamples == 4800,
        "the position advances with every bus silent");
}

int main() {
  soundsWhatWasScheduled();
  silentBeforeAndAfter();
  oneClockForEveryBus();
  levelMovesWhatIsAlreadySounding();
  silenceIsSilent();
  longTakeCostsNoMoreThanShort();
  overlappingNotesBeyondThePoolDoNotBreak();
  startsAndStopsWithoutClicking();
  clearingABusLeavesOthersSounding();
  reconfiguringResets();
  nonsenseIsIgnored();
  scheduledOutOfOrder();
  soundsTheFramesItWasGiven();
  beginsWhereItWasAskedTo();
  stopsWhenItsSpanEnds();
  runsOutRatherThanLooping();
  busLevelScalesTheTake();
  replacingASlotLeavesASoundingVoiceAlone();
  anEmptySlotSoundsNothing();
  takeAndToneShareTheClock();
  reconfiguringForgetsLoadedAudio();
  slotsOutOfRangeAreIgnored();
  aRunAdvancesWithRenderedBlocks();
  aRunBeginsWhereItWasTold();
  aRunEndsItselfAndSaysSo();
  aStoppedRunHoldsItsPosition();
  startingAgainReplacesTheRun();
  aSilentBusStillPassesTime();

  if (failures > 0) {
    std::printf("%d check(s) failed\n", failures);
    return 1;
  }
  std::printf("SYNTH OK\n");
  return 0;
}
