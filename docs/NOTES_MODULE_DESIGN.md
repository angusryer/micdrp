# micdrp — Notes + Dashboard module (design / build spec)

Spec for the next build session. Reframes freeform recording as **Notes**, adds
continual on-device pattern analysis over the notes corpus, and a **Dashboard**
that visualizes training progress and the user's melodic/harmonic tendencies.
Consolidates the app to **3 tabs** + a header-accessed **Account & Settings**
screen. Yolo mode (single dev, no users): replace, don't migrate.

---

## 1. Intent

A **note** is a sung musical-idea memo: you sing something, it's saved and
analysed. The system continually mines the corpus of notes to answer:
- which **intervals** do I sing most / avoid?
- which **melodic fragments** recur most?
- which **chord changes** do my melodies reflect most?
- (Dashboard) how is my **training** (Practice) trending over time?

This is the missing "understand my own voice" half of the app, distinct from
Practice (target-driven training).

---

## 2. Key decisions (confirmed)

| Topic | Decision |
|---|---|
| Freeform recording | **Is** the Notes idea. Collapse the old **Record + Library** tabs into a single **Notes** surface. |
| Self-score logic | **Keep it, reframe as analysis** — the per-note metrics (key, tempo, range, intonation steadiness) are descriptive analysis of a note, not a grade. No "score / 100" headline. |
| Corpus | The user's **notes** only. Practice takes are excluded (they're target melodies, not the user's ideas). |
| Practice takes | **Don't keep the takes** (no audio/full record). **Keep the progress trajectory** — one lightweight metrics row per practice session, for the Dashboard. |
| v1 insights | **All three**: interval histogram, frequent fragments, chord-change reflection. |
| Chord inference | **Infer from the melody**, and make it **tuneable** (window, vocabulary, key-relative, min-confidence). |
| Compute | **On-device, recomputed on change**; persist each note's symbolic melody so re-aggregation never re-touches audio. |
| "Most avoided" | Patterns **harmonically furthest from the user's most-common patterns** (max distance from the common-pattern centroid), not merely least-frequent. |

---

## 3. Information architecture (changes the merged app)

Tabs collapse from 5 → **3**:

| Was | Now |
|---|---|
| Record (freeform, self-scored) + Library | **Notes** — capture, list, per-note analysis, playback |
| Practice | **Practice** — unchanged capture; now writes a progress row instead of a full recording |
| Profile + Settings (two tabs) | **Account & Settings** — one screen, reached via a **header button** on each tab |
| — | **Dashboard** — training progress + common patterns + avoided patterns |

Result: **Practice · Notes · Dashboard** tabs, plus a header gear/avatar →
**Account & Settings**.

---

## 4. Data model (Supabase)

Replace the generic `recordings` table with two purpose-built tables.

### `notes` (the corpus)
```
notes(
  id uuid pk,
  user_id uuid -> auth.users on delete cascade,
  created_at timestamptz default now(),
  title text,
  duration_ms int,
  sample_rate_hz int,
  audio_path text,                 -- blob in storage (reuse 'takes' bucket or rename 'notes')
  melody_json jsonb not null,      -- NoteEvent[] (the symbolic melody; source of truth for analysis)
  key text,
  tempo_bpm numeric,
  -- reframed self-analysis (descriptive, not a grade):
  in_tune_ratio numeric,
  mean_cents_error numeric,
  note_count int,
  range_low_midi int,
  range_high_midi int
)
```
Owner-scoped RLS exactly like the current `recordings` policies. `melody_json`
is what makes corpus analysis pure-data (no DSP re-run).

### `practice_progress` (trajectory only — no audio)
```
practice_progress(
  id uuid pk,
  user_id uuid -> auth.users on delete cascade,
  created_at timestamptz default now(),
  melody_id text,
  root_midi int,
  note_duration_ms int,
  score numeric,
  in_tune_ratio numeric,
  mean_cents_error numeric,
  evaluated_frames int
)
```
One row per finished practice session. Powers the Dashboard trend. Practice no
longer persists a recording/audio.

> Migration is a clean rewrite of `supabase/migrations/0001_init.sql` (no users):
> drop `recordings`, add `notes` + `practice_progress`. Update the `Database`
> type in `lib/supabase.ts`. Keep the `delete_account` RPC (now cascades both).

---

## 5. Analysis (`logic` — pure, dependency-free, unit-tested)

The heavy DSP already ran at capture; this is cheap symbolic math.

- `melodyToIntervals(NoteEvent[]) → number[]` — consecutive signed semitone
  deltas (transposition-invariant).
- `intervalHistogram(corpus: number[][]) → Map<intervalName, count>` — directional
  (up/down) and folded interval-class counts; named (m2, M2, m3, …, P5, …).
- `frequentFragments(corpus, { nRange: [3,5] }) → { intervals, count, example }[]` —
  top recurring interval n-grams, each with a representative pitch realization
  (playable via `referenceTone`).
- `impliedHarmony(NoteEvent[], opts) → { startMs, endMs, chord, confidence }[]` —
  per-window chord estimate via key/chord-template matching (reuse the
  Krumhansl-Schmuckler machinery in `logic/key.ts`). **Tuneable** `opts`:
  `windowMs`, `vocabulary: 'triads' | 'sevenths'`, `keyRelative: boolean`,
  `minConfidence: number`.
- `chordReflection(corpus, opts) → { change, count }[]` — which chords / chord
  changes the melodies most reflect.
- `avoidanceProfile(corpus, vocabulary) → { pattern, distance }[]` — patterns
  **furthest** from the centroid of the user's common patterns (define a distance
  over interval / pitch-class vectors). This is "most avoided."

All consume `melody_json` from the notes cache; no audio.

---

## 6. Notes tab

- **Capture**: reuse `useRecordController` + `smoothPitch → segmentNotes`; **no
  score gate**. Save → `notesRepo.create({ audioUri, melody, analysis, title? })`.
- **List**: replaces Library — notes newest-first, playback, swipe-delete.
- **Detail**: the reframed analysis (key, tempo, range, steadiness, note list),
  tap-a-note-to-hear (existing `referenceTone`), MIDI export (existing).
- `computeFeedback` is reused but **relabelled** — surface the metrics as
  "analysis," drop the headline score number.

---

## 7. Dashboard tab

Three sections:
1. **Training progress** — trajectory from `practice_progress` (score / in-tune
   ratio over time; optional per-melody filter).
2. **Most common patterns** — top intervals, fragments, chord reflections from the
   notes corpus.
3. **Most avoided patterns** — from `avoidanceProfile` (furthest from common).

Charts: start with lightweight RN/Skia views (no heavy chart dependency unless it
proves needed).

---

## 8. Account & Settings (consolidated)

One screen merging the current Profile + Settings:
- Account: display name, email, password reset, sign out, delete account.
- Engine tuning, theme.
- **Chord-inference tuning knobs**: `windowMs`, vocabulary (triads / 7ths),
  key-relative, min-confidence.
- About.

Reached via a header button (gear/avatar) on each tab; no longer tabs.

---

## 9. Compute model

On-device. Notes-corpus aggregates recompute when notes change (cheap). Practice
appends a progress row per session. Optionally cache the latest aggregate summary
in MMKV for instant Dashboard open. No server/background job (cross-device
aggregation is deferred).

---

## 10. Build order (next session)

1. **Schema**: rewrite migration → `notes` + `practice_progress`; `notesRepo` +
   `practiceProgressRepo`; update `Database` type.
2. **logic**: intervals / histogram / fragments / impliedHarmony / chordReflection
   / avoidance + tests (pure, CI-green).
3. **Notes tab**: capture (reframed Record) + list + detail + playback.
4. **Practice**: write a `practice_progress` row on finish (drop full-recording save).
5. **Dashboard tab**: progress + common + avoided.
6. **Account & Settings**: consolidate Profile + Settings; header nav button.
7. **Cleanup/i18n**: remove Record + Library tabs and the old `recordings` path;
   3-tab navigator; new i18n keys.

## 11. Deferred / open

- Cross-device (server-side) aggregation — on-device only for now.
- Chart visual design.
- Note tagging / titling / folders.
- Whether to keep a MIDI/file **import** path for notes (currently sung-only).
