# The dogfood loop

Talk to the app about the app; the loop builds what you asked for.

```sh
yarn dogfood --dry-run     # hear and interpret, build nothing — start here
yarn dogfood --no-deliver  # build and verify, commit nothing
yarn dogfood --once        # one pass
yarn dogfood               # poll every 2 minutes
yarn dogfood status        # running, or halted and why
yarn dogfood resume        # clear a halt
yarn dogfood samples       # pull shared takes into .samples/
```

## Shared takes are the other direction

`yarn dogfood samples` fetches nothing to act on. A remark says a reading was
wrong; a shared take *is* the reading being wrong, and a detector can be run
against it. Each one lands in `.samples/<date>-<title>-<id>/` as the recording
plus a `reading.json` holding what the app heard, what the maintainer corrected
by hand, and which analysis version produced it — so a change to pitch
detection can be scored against a real voice instead of against a test written
from the same assumptions that caused the error.

They live in a separate collection from the clips and no run ever claims one
(INV-DOG-036). Audio arriving from the same person through the same door would
otherwise be transcribed, found to contain words, and acted on. The corpus is
never committed (INV-DOG-038): it is recordings of a person singing.

## Run it with `--dry-run` first

The gate is only as good as the blast-radius judgement, and that judgement is
itself a model call. `--dry-run` prints what the loop *would* build without
touching anything, so you can read a few clips' worth of interpretation before
letting it commit. That is worth doing more than once.

## What it will and will not do

Only JavaScript ships unattended (INV-DOG-005). That is not caution for its own
sake: JavaScript is the only thing that goes over the air, and the only thing
that rolls itself back when it fails to boot. Native and infrastructure changes
need a build, a human, and a decision.

Signing material, secrets, CI, the release scripts and the update server are
off limits at any confidence (INV-DOG-006). Their failure mode is not a bad
screen; it is an app that cannot ship, which is exactly the state that would
stop the loop delivering its own fix.

A reading the model is unsure of is filed with the words it came from, never
guessed at (INV-DOG-007). Preflight gates every change and the assembled batch
(INV-DOG-008). A failed attempt restores the tree (INV-DOG-009). Three failures
in a row halt the loop (INV-DOG-010).

## Transcription is local

whisper.cpp, using the model Superwhisper already downloaded
(`~/Library/Application Support/superwhisper/ggml-small.en.bin`). These are
unfiltered notes about unreleased work in your own voice; there is no reason
for them to leave the machine.

```sh
brew install whisper-cpp   # ffmpeg is already required by the toolchain
mkdir -p ~/.cache/whisper
cp ~/Library/Application\ Support/superwhisper/ggml-small.en.bin ~/.cache/whisper/
```

The copy matters. Reading the model out of Superwhisper's own container makes
macOS raise a consent prompt — "node wants to access data from other apps" —
and a prompt nobody is there to answer stops an unattended run dead.

Superwhisper itself is not driven directly, despite being the obvious
candidate. It transcribes what you dictate into the Mac's microphone and has no
documented entry point for transcribing a file — the agent inbox that looks
like one is undocumented, and a loop that runs unattended must not depend on
another app's internals, which change without warning.

## What it needs

| | |
|---|---|
| `BACKEND_URL` | The PocketBase instance holding the clips |
| `DOGFOOD_EMAIL` / `DOGFOOD_PASSWORD` | The account whose clips it reads |
| `ANTHROPIC_API_KEY` or `ant auth login` | For interpretation |
| `MICDRP_CLOUDFLARE_API_TOKEN` | Only when it publishes a bundle |

Spec: `.harnex/project/specs/domains/dogfood/`.
