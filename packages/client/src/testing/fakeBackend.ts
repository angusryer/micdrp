/**
 * An in-memory stand-in for the PocketBase client.
 *
 * It is deliberately not a bare set of jest.fn()s: it enforces the same
 * ownership rule the real backend does, so a repo that forgot to scope a query
 * fails here rather than passing against a permissive mock. `backend/verify-rules.mjs`
 * proves the real instance behaves this way; this mirrors it for unit tests.
 */

export interface FakeRecord {
  id: string;
  created: string;
  updated: string;
  [key: string]: unknown;
}

interface Store {
  [collection: string]: FakeRecord[];
}

let store: Store = {};
let authed: { id: string; token: string } | null = null;
let seq = 0;

const nowIso = (): string => new Date(1750000000000 + seq).toISOString();
const nextId = (): string => `rec${(seq += 1)}`;

/** A record is reachable only by its owner. `users` records own themselves. */
function ownedBy(collection: string, record: FakeRecord, userId: string): boolean {
  return collection === 'users' ? record.id === userId : record.user === userId;
}

function visible(collection: string): FakeRecord[] {
  if (!authed) {
    return [];
  }
  const userId = authed.id;
  return (store[collection] ?? []).filter((r) => ownedBy(collection, r, userId));
}

/**
 * FormData carries everything as text. The real backend parses each value back
 * to its declared field type, so a number field comes out a number and a json
 * field comes out parsed — the fake has to do the same or repos appear to work
 * here and return strings in production.
 */
function coerceForm(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== 'string') {
      out[key] = value;
      continue;
    }
    if (key.endsWith('_json')) {
      try {
        out[key] = JSON.parse(value);
      } catch {
        out[key] = value;
      }
      continue;
    }
    const asNumber = Number(value);
    out[key] =
      value.trim() !== '' && Number.isFinite(asNumber) ? asNumber : value;
  }
  return out;
}

function notFound(): Error {
  // The real backend does not distinguish "someone else's" from "absent".
  return Object.assign(new Error("The requested resource wasn't found."), {
    status: 404
  });
}

class FakeCollection {
  constructor(private readonly name: string) {}

  create<T>(payload: Record<string, unknown> | FormData): Promise<T> {
    const data =
      payload instanceof FormData
        ? coerceForm(
            Object.fromEntries(
              (payload as unknown as {
                entries(): Iterable<[string, unknown]>;
              }).entries()
            )
          )
        : payload;
    const record: FakeRecord = {
      ...(data),
      id: nextId(),
      created: nowIso(),
      updated: nowIso()
    };
    if (this.name === 'users') {
      record.name = (record.name) ?? '';
    }
    // An uploaded file is stored and the record keeps its filename.
    const audio = record.audio as { name?: string } | string | undefined;
    if (audio && typeof audio === 'object' && audio.name) {
      record.audio = audio.name;
    }
    if (this.name === 'notes' && typeof record.audio !== 'string') {
      record.audio = '';
    }
    (store[this.name] ??= []).push(record);
    return Promise.resolve(record as T);
  }

  getOne<T>(id: string): Promise<T> {
    const found = visible(this.name).find((r) => r.id === id);
    return found ? Promise.resolve(found as T) : Promise.reject(notFound());
  }

  getFullList<T>(opts?: { sort?: string }): Promise<T[]> {
    const rows = [...visible(this.name)];
    if (opts?.sort) {
      const desc = opts.sort.startsWith('-');
      const key = desc ? opts.sort.slice(1) : opts.sort;
      rows.sort((a, b) =>
        String(a[key]).localeCompare(String(b[key])) * (desc ? -1 : 1)
      );
    }
    return Promise.resolve(rows as T[]);
  }

  update<T>(id: string, patch: Record<string, unknown>): Promise<T> {
    const found = visible(this.name).find((r) => r.id === id);
    if (!found) {
      return Promise.reject(notFound());
    }
    Object.assign(found, patch, { updated: nowIso() });
    return Promise.resolve(found as T);
  }

  delete(id: string): Promise<boolean> {
    const found = visible(this.name).find((r) => r.id === id);
    if (!found) {
      return Promise.reject(notFound());
    }
    store[this.name] = (store[this.name] ?? []).filter((r) => r.id !== id);
    if (this.name === 'users') {
      // cascadeDelete: the singer's records go with them.
      for (const key of Object.keys(store)) {
        store[key] = store[key].filter((r) => r.user !== id);
      }
    }
    return Promise.resolve(true);
  }

  /**
   * Renew the session the app restored (INV-NOTES-140).
   *
   * Succeeds while somebody is authed and refuses otherwise, which is what
   * the real one does: a token the server will not accept cannot be renewed
   * into one it will.
   */
  authRefresh<T>(): Promise<T> {
    if (nextAuthError) {
      const err = nextAuthError;
      nextAuthError = null;
      return Promise.reject(err);
    }
    return authed == null
      ? Promise.reject(new Error('not authenticated'))
      : Promise.resolve(authed as unknown as T);
  }

  authWithPassword<T>(email: string, _password: string): Promise<T> {
    if (nextAuthError) {
      const err = nextAuthError;
      nextAuthError = null;
      return Promise.reject(err);
    }
    const user =
      (store.users ?? []).find((r) => r.email === email) ??
      ({ id: nextId(), email, name: '', created: nowIso(), updated: nowIso() });
    if (!(store.users ?? []).includes(user)) {
      (store.users ??= []).push(user);
    }
    const session = { id: user.id, token: `token-${user.id}` };
    authed = session;
    listeners.forEach((fn) => fn());
    return Promise.resolve({ token: session.token, record: user } as T);
  }

  requestPasswordReset(_email: string): Promise<boolean> {
    return Promise.resolve(true);
  }
}

type Listener = () => void;
const listeners = new Set<Listener>();

/** Set by failNextAuth() so a test can exercise the failure path. */
let nextAuthError: Error | null = null;

export const fakeBackend = {
  collection: (name: string) => new FakeCollection(name),
  files: {
    getToken: () => Promise.resolve('file-token'),
    getURL: (record: { id: string }, filename: string, q?: { token?: string }) =>
      `http://fake/api/files/notes/${record.id}/${filename}?token=${q?.token ?? ''}`
  },
  authStore: {
    get token(): string {
      return authed?.token ?? '';
    },
    get record(): FakeRecord | null {
      if (!authed) {
        return null;
      }
      const id = authed.id;
      return (store.users ?? []).find((r) => r.id === id) ?? null;
    },
    get isValid(): boolean {
      return authed != null;
    },
    clear(): void {
      authed = null;
      listeners.forEach((fn) => fn());
    },
    onChange(fn: Listener, fireImmediately?: boolean): () => void {
      listeners.add(fn);
      if (fireImmediately) {
        fn();
      }
      return () => listeners.delete(fn);
    }
  },
  autoCancellation: (_enabled: boolean) => undefined
};

/** Make the next authWithPassword reject, for exercising failure paths. */
export function failNextAuth(message: string): void {
  nextAuthError = new Error(message);
}

/** Reset every collection and sign out. Call from beforeEach. */
export function resetFakeBackend(): void {
  store = {};
  authed = null;
  seq = 0;
  nextAuthError = null;
  listeners.clear();
}

/** Sign a singer in, creating them if needed. Returns their id. */
export async function signInFake(email = 'singer@micdrp.test'): Promise<string> {
  const auth = await fakeBackend
    .collection('users')
    .authWithPassword<{ record: FakeRecord }>(email, 'password');
  return auth.record.id;
}
