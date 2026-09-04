/**
 * Demonstrates, against a running backend, that record ownership is enforced
 * by the server and not by client code.
 *
 * This is the executable form of INV-NOTES-005, INV-PRACT-007 and
 * INV-ACCOUNT-006: "a singer reaches only their own rows". Two accounts are
 * created, one writes a record, and the other is denied every way of reaching
 * it. A backend misconfiguration that widened access would fail here.
 *
 *   backend/dev.sh &            # in one shell
 *   node backend/verify-rules.mjs
 */
const BASE = process.env.BACKEND_URL ?? 'http://127.0.0.1:8090';

async function call(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) };
}

async function signUp(who) {
  const email = `${who}-${Date.now()}@micdrp.test`;
  const password = 'password12345';
  await call('/api/collections/users/records', {
    method: 'POST',
    body: { email, password, passwordConfirm: password, name: who }
  });
  const { data } = await call('/api/collections/users/auth-with-password', {
    method: 'POST',
    body: { identity: email, password }
  });
  return data;
}

const checks = [];
const check = (label, pass) => {
  checks.push({ label, pass });
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label}`);
};

const alice = await signUp('alice');
const bob = await signUp('bob');

const { data: note } = await call('/api/collections/notes/records', {
  method: 'POST',
  token: alice.token,
  body: {
    user: alice.record.id,
    title: 'Alice idea',
    duration_ms: 1200,
    sample_rate_hz: 44100,
    note_count: 1,
    melody_json: [
      { midi: 60, startMs: 0, endMs: 400, durationMs: 400, cents: 0, clarity: 0.9 }
    ]
  }
});

check('the owner reads their own record', (await call(`/api/collections/notes/records/${note.id}`, { token: alice.token })).ok);
check('another singer cannot read it', !(await call(`/api/collections/notes/records/${note.id}`, { token: bob.token })).ok);
check('another singer cannot delete it', !(await call(`/api/collections/notes/records/${note.id}`, { method: 'DELETE', token: bob.token })).ok);
check('another singer lists none of it', (await call('/api/collections/notes/records', { token: bob.token })).data.items.length === 0);
check('an anonymous caller lists nothing', ((await call('/api/collections/notes/records')).data?.items ?? []).length === 0);
check('the record survived every attempt', (await call(`/api/collections/notes/records/${note.id}`, { token: alice.token })).ok);

// A shared take is a recording of somebody singing, handed over so a reading
// can be checked against it. Ownership is the whole of what protects it, and
// the contract promises 403 to anyone else (dogfood/contracts.yml).
const { data: sample } = await call('/api/collections/take_samples/records', {
  method: 'POST',
  token: alice.token,
  body: {
    user: alice.record.id,
    note_id: note.id,
    title: 'Alice idea',
    duration_ms: 1200,
    sample_rate_hz: 44100,
    reading: { melody: [], hits: [], noteCount: 0 },
    app_version: '1.0.0',
    build_number: 1,
    shared_at_ms: Date.now(),
    state: 'shared'
  }
});

check('the owner reads their own shared take', (await call(`/api/collections/take_samples/records/${sample.id}`, { token: alice.token })).ok);
check('another singer cannot hear it', !(await call(`/api/collections/take_samples/records/${sample.id}`, { token: bob.token })).ok);
check('another singer cannot unshare it', !(await call(`/api/collections/take_samples/records/${sample.id}`, { method: 'DELETE', token: bob.token })).ok);
check('another singer lists no shared takes', (await call('/api/collections/take_samples/records', { token: bob.token })).data.items.length === 0);
check('the owner can take it back', (await call(`/api/collections/take_samples/records/${sample.id}`, { method: 'DELETE', token: alice.token })).ok);

const failed = checks.filter((c) => !c.pass).length;
console.log(`\n${checks.length - failed}/${checks.length} ownership checks passed`);
process.exit(failed === 0 ? 0 : 1);
