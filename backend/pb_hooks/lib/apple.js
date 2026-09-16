// Sign in with Apple: believe an identity token only on Apple's signature,
// then find, link or create the account. See
// .harnex/project/specs/domains/account/invariants-apple.yml.

const ISSUER = "https://appleid.apple.com";
const KEYS_TTL_MS = 24 * 60 * 60 * 1000;

const keysUrl = () => $os.getenv("APPLE_KEYS_URL") || ISSUER + "/auth/keys";

/** Apple's signing keys, cached across requests and refetched on a miss. */
function signingKey(kid) {
  const store = $app.store();
  const cached = store.get("apple_keys");
  const fresh = cached && Date.now() - cached.at < KEYS_TTL_MS;
  const find = (entry) => entry && entry.keys.find((key) => key.kid === kid);
  if (fresh && find(cached)) return find(cached);
  const res = $http.send({ url: keysUrl(), method: "GET", timeout: 10 });
  if (res.statusCode !== 200) return null;
  const entry = { at: Date.now(), keys: res.json.keys || [] };
  store.set("apple_keys", entry);
  return find(entry);
}

/** The verified claims of `token`, or null (INV-ACCOUNT-024). */
function verifiedClaims(token, nonce) {
  const rs256 = require(`${__hooks}/lib/rs256.js`);
  const audience = $os.getenv("APPLE_AUDIENCE");
  const jwt = rs256.decode(token);
  if (!audience || !jwt || jwt.header.alg !== "RS256" || !nonce) return null;
  const key = signingKey(jwt.header.kid);
  if (!key || !rs256.verify(jwt.input, jwt.signature, key)) return null;
  const { iss, aud, exp, sub } = jwt.claims;
  const audienceOk = Array.isArray(aud) ? aud.includes(audience) : aud === audience;
  if (iss !== ISSUER || !audienceOk || !sub) return null;
  if (typeof exp !== "number" || exp * 1000 < Date.now()) return null;
  if (jwt.claims.nonce !== $security.sha256(String(nonce))) return null;
  return jwt.claims;
}

function findFirst(app, filter, params) {
  const rows = app.findRecordsByFilter("users", filter, "", 1, 0, params);
  return rows.length ? rows[0] : null;
}

/** Find, link or create the account for verified `claims` (INV-ACCOUNT-025). */
function accountFor(claims, name) {
  let user = null;
  $app.runInTransaction((app) => {
    user = findFirst(app, "apple_sub = {:sub}", { sub: claims.sub });
    if (user) return;
    const email = String(claims.email || "").toLowerCase();
    const vouched = claims.email_verified === true || claims.email_verified === "true";
    if (!email || !vouched) return;
    user = findFirst(app, "email = {:email}", { email });
    // An account already linked to another Apple ID is not taken over.
    if (user && user.getString("apple_sub")) {
      user = null;
      return;
    }
    if (!user) {
      user = new Record(app.findCollectionByNameOrId("users"));
      user.set("email", email);
      user.setPassword($security.randomString(48));
      user.set("name", name || "");
    }
    user.set("verified", true);
    user.set("apple_sub", claims.sub);
    app.save(user);
  });
  return user;
}

module.exports = { verifiedClaims, accountFor };
