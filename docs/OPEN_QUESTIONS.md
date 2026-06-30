# micdrp — Open product questions

Decisions that have been settled are recorded here with what shipped; what
remains genuinely open is called out at the end. Nothing here blocks merged work.

---

## 1. Practice / target-melody mode — BUILT

Decisions (from the product Q&A) and how they shipped:

| Decision | Choice | Where |
|---|---|---|
| Entry point | Dedicated **Practice tab** | `screens/Practice/PracticeScreen` + a 5th tab |
| Reference audio | **Adaptive**: play-along on headphones, else count-in | `usePracticeSession` + `audio/outputRoute` |
| Live visuals | **Target + live line scrolling in sync** | `screens/Practice/PracticePitchView` (Skia) |
| Scoring | **Fixed timeline** (absolute time) | `logic.scorePitch` + `analysis/feedback` |
| Catalogue | **Built-in exercises only** for v1 | `logic/melodies.ts` |

Flow: pick an exercise (+ key/pace) → `PracticeSession` runs the count-in or
play-along, records for the melody's length while the target + live pitch scroll
together → `Results` scores the take against that melody (per-target feedback).

**Still open / deferred here:**
1. **Headphone-route detection is pluggable but not yet wired to a native
   module.** `audio/outputRoute.detectHeadphonesConnected()` returns `false`
   (→ count-in) until a probe is registered via `setHeadphoneProbe`. Wire a small
   native route check (iOS `AVAudioSession.currentRoute`, Android
   `AudioManager`/`AudioDeviceInfo`) in Phase V so play-along actually engages on
   headphones.
2. **Catalogue growth** — remote song library (a Supabase `melodies` table) or
   user MIDI import were deferred; built-in set ships first.
3. **Timing tolerance** — fixed-timeline scoring ships; rubato/time-aligned
   ("warp the take to the target") scoring was deferred as a later enhancement.
4. **Transport polish** — no on-screen countdown digits or progress bar yet
   (the status text + scrolling target convey position); add if it tests poorly.

## 2. Results: tap a note to hear its pitch — BUILT

`Results` → `NoteList` rows are tappable and play the note's reference pitch via
the shared `referenceTone` player.

## 3. Sharing / social — DEFERRED

Unchanged: MIDI export/share only. Shareable take links / feed / follows remain
future scope (each is a separate data-model + privacy decision).

## 4. Account features

- **Password reset — BUILT.** `useAuth().resetPassword` + a "Forgot password?"
  affordance on the Login screen (Supabase `resetPasswordForEmail`).
- **Email change** — not built (deferred); Supabase `updateUser` supports it.
- **`delete_account` RPC privileges** — still to verify on a real Supabase
  project (fallback: an Edge Function with the service role). Phase V check.
