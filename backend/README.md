# Backend

A self-hosted [PocketBase](https://pocketbase.io) instance: one Go binary
providing auth, record collections with per-record access rules, and file
storage. It replaced Supabase, whose free tier the project outgrew.

## Running it

```sh
backend/dev.sh --superuser     # first run: fetch binary + create dev superuser
backend/dev.sh                 # thereafter
```

Serves on `127.0.0.1:8090`. The admin UI is at <http://127.0.0.1:8090/_/>.
`.bin/` (the binary) and `.data/` (the SQLite database and uploaded files) are
gitignored — only `migrations/` is committed, because that is the schema's
source of truth.

## Schema

Three collections, mirroring the domain specs:

| Collection | Purpose | Spec |
|---|---|---|
| `users` | Built-in auth record. Its `name` field is the singer's display name. | `account` |
| `notes` | One sung musical-idea memo. `melody_json` is the symbolic source of truth; `audio` is an optional attached file. | `notes` |
| `practice_progress` | One row per finished practice session. Numbers only, no audio. | `practice` |

Two things the Supabase schema needed are structural here:

- **A profile per account.** `profiles` was a separate table kept in step with
  `auth.users` by an insert trigger. PocketBase's auth record carries the
  display name itself, so "every account has exactly one profile"
  (`INV-ACCOUNT-007`) is guaranteed by construction rather than by a trigger.

- **Account deletion.** `delete_account` was a `SECURITY DEFINER` routine
  scoped to `auth.uid()`. Here the `users` collection's delete rule is
  `id = @request.auth.id`, so a caller can delete themselves and nobody else,
  and the `cascadeDelete` relation on `notes` and `practice_progress` removes
  their records — including attached audio files, which the Postgres foreign-key
  cascade could not reach.

## Access rules

Every rule on `notes` and `practice_progress` is `user = @request.auth.id`
(create additionally requires an authenticated caller). The backend evaluates
this on every request; a client cannot widen its own access by changing a
query. This is what `INV-NOTES-005`, `INV-PRACT-007` and `INV-ACCOUNT-006`
assert, and `backend/verify-rules.mjs` demonstrates it against a running
instance.

## Deploying

The binary is self-contained, so any host that runs a process and keeps a
volume works — fly.io, Railway, a VPS. Point the app at it by setting
`BACKEND_URL` in `packages/client/.env`. Until then it runs locally, which is
enough for the simulator but not for a TestFlight build on someone else's
phone.
