/**
 * A full round trip against a LIVE backend: synthesized audio -> the real DSP
 * pipeline -> the real instance -> back out, melody compared note for note.
 *
 * This is the seam the other tests cannot reach. `logic` is tested against
 * fixtures and the repos against a fake, so nothing else proves that a melody
 * produced by the pitch pipeline survives being written to a running instance
 * and read back — that the DTO shape, the collection schema, the access rules
 * and the JSON column all agree.
 *
 * It does NOT cover the microphone or the C++ native module; those need a
 * device. Everything downstream of a captured frame is covered here.
 *
 * Opt-in, so a normal `yarn test` is unaffected and reports it as skipped
 * rather than as a pass it did not earn:
 *
 *   backend/dev.sh &
 *   RUN_INTEGRATION=1 yarn test client roundTrip
 */
import {
  detectPitch,
  detectKey,
  estimateTempo,
  frequencyToNote,
  segmentNotes,
  smoothPitch,
  type NoteEvent,
  type PitchFrame
} from 'logic';

const BASE = process.env.BACKEND_URL ?? 'http://127.0.0.1:8090';
const SAMPLE_RATE = 44100;
const FRAME = 2048;
const HOP = FRAME / 2;

/** A sung phrase: C4 D4 E4 G4, 400 ms each. */
const PHRASE = [261.63, 293.66, 329.63, 392.0];
const NOTE_MS = 400;

/** One analysis window of a sine at the given frequency. */
function sine(freq: number, offset: number): Float32Array {
  const out = new Float32Array(FRAME);
  for (let i = 0; i < FRAME; i++) {
    out[i] = Math.sin((2 * Math.PI * freq * (offset + i)) / SAMPLE_RATE);
  }
  return out;
}

/** Run synthesized audio through the same pipeline a real capture would. */
function analyzeSynthesizedTake(): { frames: PitchFrame[]; melody: NoteEvent[] } {
  const frames: PitchFrame[] = [];
  let t = 0;
  let sample = 0;
  for (const freq of PHRASE) {
    const windows = Math.round(((NOTE_MS / 1000) * SAMPLE_RATE) / HOP);
    for (let w = 0; w < windows; w++) {
      const { frequency, clarity } = detectPitch(sine(freq, sample), SAMPLE_RATE);
      const reading = frequency != null ? frequencyToNote(frequency) : null;
      frames.push({
        timestampMs: t,
        midi: reading?.midi ?? null,
        cents: reading?.cents ?? null,
        clarity
      });
      t += (HOP / SAMPLE_RATE) * 1000;
      sample += HOP;
    }
  }
  return { frames, melody: segmentNotes(smoothPitch(frames)) };
}

interface Res {
  ok: boolean;
  status: number;
  data: Record<string, unknown> | null;
}

async function call(
  path: string,
  init: { method?: string; body?: unknown; token?: string } = {}
): Promise<Res> {
  const isForm = init.body instanceof FormData;
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(init.token ? { Authorization: init.token } : {})
    },
    body: isForm
      ? (init.body as FormData)
      : init.body
        ? JSON.stringify(init.body)
        : undefined
  });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) };
}

async function backendIsUp(): Promise<boolean> {
  try {
    return (await call('/api/health')).ok;
  } catch {
    return false;
  }
}

// Opting in is explicit, so this never reports a pass it did not earn.
const describeLive = process.env.RUN_INTEGRATION ? describe : describe.skip;

describeLive('round trip: DSP pipeline -> live backend -> back', () => {
  beforeAll(async () => {
    if (!(await backendIsUp())) {
      throw new Error(
        `RUN_INTEGRATION is set but no backend answered at ${BASE}. ` +
          'Start one with backend/dev.sh'
      );
    }
  });

  it('a sung phrase survives analysis, saving and reading back', async () => {
    // 1. the real pipeline over synthesized audio
    const { melody } = analyzeSynthesizedTake();
    const expectedMidi = PHRASE.map((f) => frequencyToNote(f).midi);
    expect(melody.map((n) => n.midi)).toEqual(expectedMidi);

    const key = detectKey(melody);
    const tempo = estimateTempo(melody);

    // 2. sign up, as the app does
    const email = `roundtrip-${Date.now()}@micdrp.test`;
    const password = 'password12345';
    await call('/api/collections/users/records', {
      method: 'POST',
      body: { email, password, passwordConfirm: password, name: 'Round Trip' }
    });
    const auth = await call('/api/collections/users/auth-with-password', {
      method: 'POST',
      body: { identity: email, password }
    });
    expect(auth.ok).toBe(true);
    const token = auth.data!.token as string;
    const userId = (auth.data!.record as { id: string }).id;

    // 3. save the take with its audio, exactly as notesRepo does
    const form = new FormData();
    form.append('user', userId);
    form.append('title', 'Round trip idea');
    form.append('duration_ms', String(PHRASE.length * NOTE_MS));
    form.append('sample_rate_hz', String(SAMPLE_RATE));
    form.append('melody_json', JSON.stringify(melody));
    form.append('note_count', String(melody.length));
    form.append('key', `${key.tonicName} ${key.mode}`);
    form.append('tempo_bpm', String(tempo.bpm));
    // A minimal RIFF header stands in for a captured file; what matters is
    // that a file is attached in the same request as the record.
    // React Native's Blob typings omit the options bag the runtime accepts.
    const audio = new Blob(['RIFF']);
    (form as unknown as {
      append(name: string, value: Blob, filename: string): void;
    }).append('audio', audio, 'audio.wav');
    const created = await call('/api/collections/notes/records', {
      method: 'POST',
      body: form,
      token
    });
    expect(created.ok).toBe(true);
    expect(created.data!.audio).toBeTruthy();

    // 4. read it back — the melody must be identical
    const noteId = created.data!.id as string;
    const fetched = await call(`/api/collections/notes/records/${noteId}`, {
      token
    });
    expect(fetched.ok).toBe(true);
    expect(fetched.data!.melody_json).toEqual(melody);
    // Numbers must come back as numbers; FormData sends everything as text.
    expect(typeof fetched.data!.note_count).toBe('number');
    expect(fetched.data!.key).toBe(`${key.tonicName} ${key.mode}`);

    // 5. private to its owner
    const mine = (await call('/api/collections/notes/records', { token })).data!
      .items as unknown[];
    expect(mine).toHaveLength(1);
    const anon = ((await call('/api/collections/notes/records')).data?.items ??
      []) as unknown[];
    expect(anon).toHaveLength(0);

    // 6. deleting the account takes the note with it
    await call(`/api/collections/users/records/${userId}`, { method: 'DELETE', token });
    expect((await call(`/api/collections/notes/records/${noteId}`, { token })).ok).toBe(
      false
    );
  }, 30000);
});
