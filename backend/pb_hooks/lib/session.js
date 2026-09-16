// Rotating refresh tokens. See
// .harnex/project/specs/domains/account/invariants-session.yml.
//
// Loaded with require() from inside each handler: PocketBase runs every hook
// in its own isolated runtime, so nothing at the top of session.pb.js is in
// scope when a handler runs.

/** A token unused for this long stops working (INV-ACCOUNT-019). */
const LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;
const COLLECTION = "refresh_tokens";

const hash = (token) => $security.sha256(token);

function findByHash(app, token) {
  try {
    return app.findFirstRecordByData(COLLECTION, "token_hash", hash(token));
  } catch (_) {
    return null;
  }
}

function findById(app, id) {
  try {
    return id ? app.findRecordById(COLLECTION, id) : null;
  } catch (_) {
    return null;
  }
}

/** Issue a token in `family`, returning the plain token and its row. */
function issue(app, user, family) {
  const token = $security.randomString(64);
  const row = new Record(app.findCollectionByNameOrId(COLLECTION));
  row.set("user", user.id);
  row.set("family", family || $security.randomString(24));
  row.set("token_hash", hash(token));
  row.set("token_key", user.tokenKey());
  row.set("expires_at_ms", Date.now() + LIFETIME_MS);
  app.save(row);
  return { token, row };
}

function revokeFamily(app, family) {
  const rows = app.findRecordsByFilter(COLLECTION, "family = {:family}", "", 0, 0, { family });
  for (const row of rows) {
    row.set("revoked", true);
    app.save(row);
  }
}

/** Retire `row` in favour of a new token in its family. */
function rotate(app, row, user) {
  const next = issue(app, user, row.getString("family"));
  row.set("rotated_at_ms", Date.now());
  row.set("successor", next.row.id);
  app.save(row);
  return next.token;
}

/**
 * The answer to a used token: a lost response when its successor was never
 * used, theft otherwise (INV-ACCOUNT-018).
 */
function replay(app, row, user) {
  const successor = findById(app, row.getString("successor"));
  const unused = successor && !successor.getBool("revoked") && !successor.getInt("rotated_at_ms");
  if (!unused) {
    revokeFamily(app, row.getString("family"));
    return null;
  }
  successor.set("revoked", true);
  app.save(successor);
  return rotate(app, row, user);
}

/** Exchange a refresh token. Returns { user, token } or null when refused. */
function refresh(token) {
  let out = null;
  $app.runInTransaction((app) => {
    const row = token ? findByHash(app, token) : null;
    if (!row) return;
    const family = row.getString("family");
    const user = findUser(app, row.getString("user"));
    const lapsed = row.getInt("expires_at_ms") < Date.now();
    if (!user || row.getBool("revoked") || user.tokenKey() !== row.getString("token_key")) {
      revokeFamily(app, family);
      return;
    }
    if (lapsed) return;
    const next = row.getInt("rotated_at_ms") ? replay(app, row, user) : rotate(app, row, user);
    out = next ? { user, token: next } : null;
  });
  return out;
}

function findUser(app, id) {
  try {
    return app.findRecordById("users", id);
  } catch (_) {
    return null;
  }
}

/** Start a line for a signed-in account that has none (INV-ACCOUNT-023). */
function adopt(user) {
  let token = null;
  $app.runInTransaction((app) => {
    const lines = app.findRecordsByFilter(COLLECTION, "user = {:id}", "", 1, 0, { id: user.id });
    if (lines.length === 0) token = issue(app, user, "").token;
  });
  return token;
}

/** End the line `token` belongs to, whatever state it is in. */
function signOut(token) {
  const row = token ? findByHash($app, token) : null;
  if (row) revokeFamily($app, row.getString("family"));
}

function prune() {
  const rows = $app.findRecordsByFilter(COLLECTION, "expires_at_ms < {:now}", "", 0, 0, { now: Date.now() });
  for (const row of rows) $app.delete(row);
}

module.exports = { issue, refresh, adopt, signOut, prune };
