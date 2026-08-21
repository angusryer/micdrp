# micdrp — where this is going

Written as a handoff to another agent picking the work up. It is about intent,
not history: what the project is for, the pipeline that now builds it, the
work still ahead, and the standing constraints that are easy to violate by
accident.

`docs/HANDOFF.md` is an older snapshot and is stale in one important way — it
describes a Supabase backend. The backend is now **PocketBase on fly.io**
(`micdrp-backend.fly.dev`). Treat that file as history.

---

## 1. What micdrp is

A React Native singing app. You sing an idea into it; it hears what you sang
and writes it down. Three tabs — **Practice** (sing against a target, scored
live), **Notes** (record a sung idea, get it analysed and kept), **Dashboard**
(what your corpus says about your tendencies).

The whole thing rests on one promise, which is the litmus test the maintainer
stated for the analysis work:

> When I play the MIDI back, I should essentially hear exactly what I sang.

Everything in section 4 is in service of that sentence. If a change makes
playback less faithful to the take, it is wrong regardless of what else it
improves.

Read `CLAUDE.md` first for how to work in this repo — it is agent-first, specs
are canonical, and there are six axioms that are not negotiable. `harnex state`
tells you where each domain stands.

---

## 2. The pipeline: a voice memo becomes a shipped commit

This is the part worth understanding before touching anything, because it means
the repo changes while you are working in it.

The maintainer records spoken feedback **in the app**, walking around, in their
own words — "the melody is too quiet under the take", that kind of thing. From
there it is fully autonomous:

1. The clip uploads to PocketBase.
2. `scripts/dogfood/` polls, claims the oldest clip, and transcribes it
   **locally** with whisper.cpp — these are unfiltered notes about unreleased
   work in the maintainer's own voice, and there is no reason for them to leave
   the machine.
3. A model call turns the transcript into structured change requests, each with
   a confidence and a blast radius. A reading it is unsure of is filed with the
   words it came from, never guessed at.
4. A gate decides what may be built unattended. Only JavaScript ships that way
   — not caution for its own sake, but because JavaScript is the only thing
   that goes over the air and the only thing that rolls itself back when it
   fails to boot. Native and infrastructure changes need a build, a human, and
   a decision.
5. `claude -p` builds it in a **clone** of the repo (not a worktree — a
   worktree's `.git` is a file, and validation ran against the wrong tree).
   Preflight gates every change and the assembled batch, because two changes
   that each pass alone can fail together.
6. It commits, rebases onto what it just fetched, pushes, and **publishes its
   own OTA bundle** via hot-updater → Cloudflare Workers/D1/R2.
7. The maintainer's phone offers an update.

That loop works end to end and has shipped commits on its own. `yarn dogfood
status` says whether it is running or halted; three failures in a row halt it.

**What this means for you:** `main` moves under you during long sessions. Rebase
rather than assume. If `harnex spec next-id` hands you an ID, it may already
have been taken by the loop between the call and your write — validation is the
real safety net, so run it.

**What the loop must never touch**, at any confidence: `fastlane/`, signing
material (`.p12`, `.keystore`, `.mobileprovision`), `.gitsecret/`, any `.env*`,
`scripts/release*`, `scripts/ota*`, `scripts/preflight*`, `.github/`, and
`backend/ota/`. Their failure mode is not a bad screen; it is an app that
cannot ship, which is exactly the state that would stop the loop delivering its
own fix.

---

## 3. In flight: the audio moves to C++

The maintainer's direction, stated plainly: **pick the faster implementation
even when it needs a native build.** Do not choose JavaScript to keep a change
OTA-deliverable. OTA is a convenience for iteration speed, not a constraint on
architecture. (Do still *say* when something needs a binary, so they expect a
TestFlight email rather than an in-app prompt.)

Three pieces are moving to C++, in this order:

1. **One audio graph** — *started.* Chords, melody and tap-to-audition each
   built their own `AudioContext`: three graphs, three device sessions, no
   shared clock, so alignment went through an elapsed time measured in JS and
   handed between them. `packages/client/cpp/dsp/synth.{h,cpp}` replaces that
   with one sample counter and a fixed pool of 32 voices mixed across four
   gain busses (Take, Melody, Chords, Audition). STL-only and host-tested —
   `__tests__/synth_test.cpp`, prints `SYNTH OK` — because a core that
   produces samples can be checked without an audio device.

   Still to do: the ObjC++ layer feeding an `AVAudioEngine` source node, the
   TurboModule spec and Xcode registration, and the JS binding that replaces
   the three `createReferenceTonePlayer` instances. **This needs a new
   TestFlight binary; it cannot ship over the air.**

2. **Analysis off the JS thread.** Opening a note currently runs `quantize`,
   `harmonizeToGrid`, `detectKey` and `recentreNotes` synchronously in JS.

3. **Playback scheduling** — subsumed by (1); the voice pool is what replaces
   an oscillator-plus-gain-node per note.

**Settle this before doing (2):** `packages/client/cpp/dsp` and
`packages/logic` are already parallel implementations of the same music theory
(`notes.h` / `notes.ts`), kept in step deliberately and guarded by a parity
test — C++ for the hot path, TS for tests and offline work. Moving *all* of
analysis to C++ doubles that duplication unless one is made canonical or the TS
side becomes a thin binding over the C++. Decide first, or Axiom 2 ("one
source, derived everywhere") erodes quietly. The current recommendation is to
split by role rather than unify, but it is not settled.

---

## 4. The longer-term work

These came from the maintainer directly. Where they gave a specific model,
it is preserved here in their terms — in several cases they rejected the
options I proposed and described something better, so do not re-derive from
first principles.

### Editable time signatures, by dragging bar lines

Their model, which is the one to build:

> Allowing the user to pull the downbeat of a bar — so you could pull the
> downbeat back a beat and it would snap to wherever the beat would land in the
> tempo, and that would reduce the number of beats in the bar to the left and
> increase the number of beats in the bar to the right, maintaining the correct
> aggregated number of beats without having to infer things.

The bar line is the handle; the meter is the consequence. Nothing is inferred,
and the total beat count is conserved by construction.

**Odd meters are in scope, not an edge case** — "what about 15/8, or 11/4 or
7/4, or 13/8 or 13/4 — we need to support them all". This is why bar lines sit
on grid **steps** rather than beats in `packages/logic/bars.ts`; a beat-indexed
model cannot express 7/8.

### The loupe

The drag interaction borrows iOS text selection: a magnified view of the region
under the drag, positioned **above or beside the finger, never under it**. The
whole point is to see what you are placing while your thumb is on top of it.

### Relative pitch

> I don't actually care that I'm singing an A note — I'm just singing a pitch.
> When I move to a different note, the relative distance between those two
> pitches can be in tune with one another.

Concert A is not the reference; the take's own centre is. `packages/logic/tuning.ts`
finds that centre with circular statistics and reads everything against it, so a
take sung uniformly sharp reads as in tune rather than as a hundred errors. Note
that a previous claim that this was fully wired through was overstated — check
what actually consumes `recentreNotes` before assuming.

### Vibrato

A vibrato is one note sung expressively, not a run of separate notes.
`segmentation.ts` holds a note open through a configurable window
(`vibratoSemitones`, default 0.6) and anchors its centre after 200ms. Exposed in
settings, because how wide a singer's vibrato is varies by singer.

### Two ways to hear a take

**As sung** (fractional MIDI, exact times) and **as notated** (rounded to
semitones and to the grid). Both exist so that a complaint about playback stops
being ambiguous between the detector and the notation — you can tell which one
is wrong by ear.

### Persistence, then rhythm editing

Interpretations are versioned like git: the **active** interpretation is a set
of diffs, a **frozen** one is a commit. Storage is already designed for this
(`collectEdits` / `replayEdits` in `interpretation.ts` are inverses, round-trip
tested); the UI is not built. Persistence lands before rhythm editing, so an
edit survives being made.

### LLM chord suggestions

Deferred deliberately until pitch detection is solid. Suggesting harmony over a
melody that was read wrong compounds the error instead of revealing it.

---

## 5. Standing constraints

- **Never** put build secrets in `packages/client/.env*` — react-native-config
  compiles them into the IPA.
- OTA and Cloudflare commands read `MICDRP_CLOUDFLARE_API_TOKEN`, never the
  ambient `CLOUDFLARE_API_TOKEN` (that one belongs to a different project).
  Missing is an error, not a fallback.
- No secrets in the launchd plist — `~/Library/LaunchAgents` is world-readable.
- File budget 150 lines, function budget 40. It applies to spec files too;
  split by concern.
- The C++ host tests are run manually, not by preflight. `cmake -S . -B build
  && cmake --build build` in `packages/client/cpp/dsp`, or the one-liner in
  that `CMakeLists.txt`.

**On reporting to the maintainer:** say what is true now and what is next.
Resolved items in brief point form, half a sentence each. Do not explain *how*
something was fixed unless asked.
