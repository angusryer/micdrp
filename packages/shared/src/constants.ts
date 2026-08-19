/** Shared constants used across the workspace packages. */

// Storage and collection names used to live here, on the premise that a
// TypeScript backend would import them too. The backend is now a PocketBase
// instance configured by JS migrations, which cannot import this package, so
// the names live beside the only consumer that can enforce them —
// packages/client/src/lib/backend.ts.

// The "in tune" cents tolerance lives in `logic` (DEFAULT_TOLERANCE_CENTS) — it
// is a scoring-algorithm parameter, owned by the package that defines scoring,
// not a cross-cutting wire constant.

export {};
