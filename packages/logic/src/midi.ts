/**
 * Export detected notes to a Standard MIDI File (format 0).
 *
 * Pure byte assembly — no native or filesystem dependencies — so it runs in
 * Jest and on-device alike. Returns the raw `.mid` bytes.
 */

import type { NoteEvent } from './segmentation';

export interface MidiOptions {
  /** Ticks per quarter note (division). Default 480. */
  ticksPerQuarter?: number;
  /** Tempo in beats per minute. Default 120. */
  bpm?: number;
  /** Fixed note velocity (0..127). When omitted, velocity is derived from clarity. */
  velocity?: number;
}

interface MidiEvent {
  tick: number;
  /** 1 = note-on, 0 = note-off. */
  kind: 0 | 1;
  midi: number;
  velocity: number;
}

export function notesToMidi(
  notes: NoteEvent[],
  options: MidiOptions = {}
): Uint8Array {
  const ticksPerQuarter = options.ticksPerQuarter ?? 480;
  const bpm = options.bpm ?? 120;
  const microsPerQuarter = Math.round(60000000 / bpm);
  const ticksPerMs = ticksPerQuarter / (microsPerQuarter / 1000);

  const events: MidiEvent[] = [];
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    const onTick = Math.max(0, Math.round(note.startMs * ticksPerMs));
    let offTick = Math.round(note.endMs * ticksPerMs);
    if (offTick <= onTick) {
      offTick = onTick + 1;
    }
    const velocity =
      options.velocity != null
        ? clamp(Math.round(options.velocity), 0, 127)
        : clamp(Math.round(note.clarity * 127), 1, 127);
    events.push({ tick: onTick, kind: 1, midi: note.midi, velocity });
    events.push({ tick: offTick, kind: 0, midi: note.midi, velocity: 0 });
  }

  // Order by tick; at a tie, emit note-offs before note-ons.
  events.sort((a, b) => a.tick - b.tick || a.kind - b.kind);

  const track: number[] = [];

  // Tempo meta event at delta 0.
  pushVarLen(track, 0);
  track.push(
    0xff,
    0x51,
    0x03,
    (microsPerQuarter >> 16) & 0xff,
    (microsPerQuarter >> 8) & 0xff,
    microsPerQuarter & 0xff
  );

  let prevTick = 0;
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    pushVarLen(track, ev.tick - prevTick);
    prevTick = ev.tick;
    if (ev.kind === 1) {
      track.push(0x90, ev.midi & 0x7f, ev.velocity & 0x7f);
    } else {
      track.push(0x80, ev.midi & 0x7f, 0x40);
    }
  }

  // End of track.
  pushVarLen(track, 0);
  track.push(0xff, 0x2f, 0x00);

  const out: number[] = [];
  // Header chunk: MThd, length 6, format 0, 1 track, division.
  out.push(0x4d, 0x54, 0x68, 0x64);
  pushUint32(out, 6);
  pushUint16(out, 0);
  pushUint16(out, 1);
  pushUint16(out, ticksPerQuarter);
  // Track chunk.
  out.push(0x4d, 0x54, 0x72, 0x6b);
  pushUint32(out, track.length);
  for (let i = 0; i < track.length; i++) {
    out.push(track[i]);
  }

  return Uint8Array.from(out);
}

/** Variable-length quantity, big-endian with continuation bits. */
function pushVarLen(arr: number[], value: number): void {
  let v = value < 0 ? 0 : Math.floor(value);
  const groups: number[] = [v & 0x7f];
  v = Math.floor(v / 128);
  while (v > 0) {
    groups.push((v & 0x7f) | 0x80);
    v = Math.floor(v / 128);
  }
  for (let i = groups.length - 1; i >= 0; i--) {
    arr.push(groups[i]);
  }
}

function pushUint32(arr: number[], value: number): void {
  arr.push(
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff
  );
}

function pushUint16(arr: number[], value: number): void {
  arr.push((value >>> 8) & 0xff, value & 0xff);
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}
