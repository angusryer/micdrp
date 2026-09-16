/**
 * Demonstrates, against a running backend, that sessions rotate the way
 * .harnex/project/specs/domains/account/invariants-session.yml says
 * (INV-ACCOUNT-016..019, 022, 023). The checks that need to reach the token
 * table directly run only when a superuser is supplied.
 *
 *   backend/dev.sh &
 *   PB_ADMIN_EMAIL=... PB_ADMIN_PASSWORD=... node backend/verify-session.mjs
 */
const BASE = process.env.BACKEND_URL ?? 'http://127.0.0.1:8090';
const ADMIN = [process.env.PB_ADMIN_EMAIL, process.env.PB_ADMIN_PASSWORD];

async function call(path, { method = 'POST', body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

const refresh = (refreshToken) => call('/api/micdrp/session/refresh', { body: { refreshToken } });
const failures = [];
const check = (label, pass) => {
  if (!pass) failures.push(label);
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label}`);
};

async function signUp(who) {
  const email = `${who}-${Date.now()}@micdrp.test`;
  const password = 'password12345';
  await call('/api/collections/users/records', { body: { email, password, passwordConfirm: password } });
  const auth = await call('/api/collections/users/auth-with-password', { body: { identity: email, password } });
  return { ...auth.data, email, password };
}

const expiresInSec = (jwt) =>
  JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).exp - Date.now() / 1000;

// INV-ACCOUNT-016
const ann = await signUp('ann');
check('sign-in returns a refresh token', typeof ann.meta?.refreshToken === 'string');
check('the access token lasts an hour', Math.abs(expiresInSec(ann.token) - 3600) < 60);
const selfRenew = await call('/api/collections/users/auth-refresh', { token: ann.token });
check('an access token cannot renew itself', selfRenew.status === 403);

// INV-ACCOUNT-017 and 018
const rt1 = ann.meta.refreshToken;
const first = await refresh(rt1);
check('a refresh token returns a new pair', first.status === 200 && first.data.meta.refreshToken !== rt1);
const lost = await refresh(rt1);
check('a token whose answer was never used is answered again', lost.status === 200);
check('the unused answer is revoked', (await refresh(first.data.meta.refreshToken)).status === 401);

const bea = await signUp('bea');
const b1 = bea.meta.refreshToken;
const b2 = (await refresh(b1)).data.meta.refreshToken;
const b3 = (await refresh(b2)).data.meta.refreshToken;
check('a replayed token is refused', (await refresh(b1)).status === 401);
check('a replay ends the whole line', (await refresh(b3)).status === 401);

// INV-ACCOUNT-019: a password change ends every line.
const cal = await signUp('cal');
await call(`/api/collections/users/records/${cal.record.id}`, {
  method: 'PATCH',
  token: cal.token,
  body: { oldPassword: cal.password, password: 'another12345', passwordConfirm: 'another12345' }
});
check('a password change ends the line', (await refresh(cal.meta.refreshToken)).status === 401);

// INV-ACCOUNT-022
const dee = await signUp('dee');
await call('/api/micdrp/session/sign-out', { body: { refreshToken: dee.meta.refreshToken } });
check('signing out ends the line', (await refresh(dee.meta.refreshToken)).status === 401);

// INV-ACCOUNT-023: an account that already has a line cannot adopt another.
const again = await call('/api/micdrp/session/adopt', { token: dee.token });
check('an account with a line cannot adopt', again.status === 403);

if (ADMIN[0] && ADMIN[1]) {
  await verifyWithSuperuser();
} else {
  console.log('  SKIP  token table checks (set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD)');
}

async function verifyWithSuperuser() {
  const su = await call('/api/collections/_superusers/auth-with-password', {
    body: { identity: ADMIN[0], password: ADMIN[1] }
  });
  const rows = await call('/api/collections/refresh_tokens/records?perPage=500', {
    method: 'GET',
    token: su.data.token
  });
  const hashes = rows.data.items.map((r) => r.token_hash);
  check('no plain token is stored', !hashes.includes(rt1) && hashes.length > 0);

  const eve = await signUp('eve');
  const eveRows = await call(`/api/collections/refresh_tokens/records?filter=(user='${eve.record.id}')`, {
    method: 'GET',
    token: su.data.token
  });
  const row = eveRows.data.items[0];
  await call(`/api/collections/refresh_tokens/records/${row.id}`, {
    method: 'PATCH',
    token: su.data.token,
    body: { expires_at_ms: Date.now() - 1 }
  });
  check('a lapsed token is refused', (await refresh(eve.meta.refreshToken)).status === 401);

  // A session from before rotation: an account with a token and no line.
  await call(`/api/collections/refresh_tokens/records/${row.id}`, { method: 'DELETE', token: su.data.token });
  const adopted = await call('/api/micdrp/session/adopt', { token: eve.token });
  check('an account with no line adopts one', adopted.status === 200);
  check('the adopted token refreshes', (await refresh(adopted.data?.refreshToken)).status === 200);
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log('\nSessions rotate as specified.');
