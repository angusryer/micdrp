# Clarify: transport

Before any spec writing, the agent needs answers to these
questions. The human responds in natural language; the
agent translates answers into the structured spec files.

Per axiom-1, no code change happens before the spec is
approved. Per axiom-5, implementation decisions (language,
library, schema) belong to the agent — questions here are
WHAT, not HOW.

## What this feature does

- One paragraph describing the user-visible behavior.
- Who uses it (actor types)?
- What problem does it solve?

## Observable entities

- List the nouns. Each entity has properties an actor
  can read or change. Internal-only properties go in a
  separate section.

## User actions (capabilities)

- One verb per action. For each: who does it, what must
  be true beforehand (preconditions), what is true after
  (postconditions), which roles may invoke it.

## Business rules (invariants)

- Things that must always be true. Phrased so they're
  mechanically verifiable.

## Interfaces

- REST? GraphQL? CLI? Webhook? Multiple? For each,
  what's the surface (paths, types, fields)?

## Edge cases the human cares about

- Unauthorized access (what status code?)
- Concurrent edits
- Empty / null / archived states
- Idempotency (re-running a request should …?)

## Out of scope

- What this feature deliberately does NOT do.
  Important because next sessions may ask.

---

Agent: walk through each section with the human. When a
section is complete and unambiguous, mark it [DONE].
When all sections are [DONE], write the spec files in
project/specs/domains/transport/ and run
`harnex validate` before requesting human approval.
