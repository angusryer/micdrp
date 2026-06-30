# micdrp — Open product questions

Things that are **logically buildable but where the product intent is not yet
clear**. Per the working agreement, the unambiguous engine/data layers are built
and tested; the decisions below are parked here so the UX can be settled before
wiring them into the screens. Nothing here blocks the merged work.

---

## 1. Practice / target-melody mode (sing *against* a target)

**Built and tested (clear intent):**
- `logic/melodies.ts` — a deterministic catalogue of practice exercises
  (`PRACTICE_MELODIES`: major/minor scales, arpeggio, fifths, octave leaps, a
  nursery tune) that build absolute-timed `TargetNote[]`, transposable by root
  and pace. Pure music theory, fully unit-tested.
- `audio/referenceTone.ts` — `createReferenceTonePlayer()` plays any
  `TargetNote[]` as reference tones (one enveloped sine per note, pitched via the
  shared `midiToFrequency`), so what the singer hears is exactly what the scorer
  grades. Inert no-op when the audio package is absent; unit-tested via an
  injected context.
- Scoring already supports an external target: `scorePitch(frames, targets)`.

**Open questions before wiring it into the Record/Results screens:**
1. **Selection UX.** Where does the user pick an exercise — a new "Practice" tab,
   a mode toggle on the Record screen, or a pre-roll sheet? Does the choice
   persist as a default?
2. **Live target display.** During a take, should the Record screen draw the
   target line/notes alongside the live pitch line (Skia), and should it scroll
   in sync with a transport clock? This touches the real-time render path, so the
   interaction model (countdown, looping, tempo control) needs to be pinned down
   first.
3. **Reference playback timing.** Play the reference once before recording, or
   simultaneously (singer follows along)? Simultaneous playback risks the mic
   capturing the reference tone — do we need it muted-through-headphones-only, or
   a short count-in then silence?
4. **Scoring window.** Use the melody's own timeline as-is, or time-align the
   sung take to the target (allow the singer to start late / rubato) before
   scoring? Today `scorePitch` matches by absolute timestamp.
5. **Catalogue source.** Is the built-in exercise set enough for v1, or do we
   want user-imported songs / a remote song library? (If remote, it's a new
   Supabase table + storage, mirroring `recordings`.)

## 2. Reference-tone affordances outside practice mode

Should the Results screen let the user tap a detected note to hear its reference
pitch (using the same `referenceTone` player)? Cheap to add, but it's unclear if
that's desired or clutter.

## 3. Social / sharing

The handoff lists "sharing/social" as future scope. MIDI export + share already
exists. Open: do we want shareable links to a take (public read via a signed/long
URL or a public bucket path), a feed, or follower mechanics? Each is a different
data-model and privacy decision — not started, deliberately.

## 4. Account specifics (Profile shipped; edges to confirm)

The Profile screen ships with display-name editing, sign-out, and
delete-account. Two things to confirm against the real backend:
- **`delete_account` RPC privileges.** It is `security definer` and deletes the
  caller's `auth.users` row (cascading profiles + recordings). On some Supabase
  projects the function owner may lack delete rights on `auth.users`; if so, move
  account deletion to an Edge Function using the service-role key. Verify on a
  real project (Phase V).
- **Email change / password reset.** Not built. Supabase supports both
  (`updateUser`, `resetPasswordForEmail`); add to Profile if wanted.
