// synth_commands.cpp — see synth_commands.h.

#include "synth_commands.h"

#include <cmath>

namespace micdrp {

Bus busFromIndex(double index) {
  const int i = static_cast<int>(index);
  return (i >= 0 && i < kMaxBuses) ? static_cast<Bus>(i) : Bus::Melody;
}

std::int64_t samplesFromMs(double ms, double sampleRateHz) {
  const double rate = sampleRateHz > 0.0 ? sampleRateHz : 48000.0;
  return static_cast<std::int64_t>(std::llround(ms * rate / 1000.0));
}

bool postSchedule(SynthMailbox& mailbox, double busIndex, double frequencyHz,
                  double startMs, double endMs, double sampleRateHz) {
  SynthCommand c;
  c.kind = SynthCommand::Kind::Schedule;
  c.note = ScheduledNote{busFromIndex(busIndex),
                         static_cast<float>(frequencyHz),
                         samplesFromMs(startMs, sampleRateHz),
                         samplesFromMs(endMs, sampleRateHz)};
  return mailbox.post(c);
}

bool postBusLevel(SynthMailbox& mailbox, double busIndex, double level) {
  SynthCommand c;
  c.kind = SynthCommand::Kind::SetBusLevel;
  c.bus = busFromIndex(busIndex);
  c.level = static_cast<float>(level);
  return mailbox.post(c);
}

bool postClearBus(SynthMailbox& mailbox, double busIndex) {
  SynthCommand c;
  c.kind = SynthCommand::Kind::ClearBus;
  c.bus = busFromIndex(busIndex);
  return mailbox.post(c);
}

bool postClearAll(SynthMailbox& mailbox) {
  SynthCommand c;
  c.kind = SynthCommand::Kind::ClearAll;
  return mailbox.post(c);
}

}  // namespace micdrp
