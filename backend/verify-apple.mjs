/**
 * Demonstrates, against a running backend, that Sign in with Apple believes
 * only Apple's signature (INV-ACCOUNT-024..026). A local key server stands in
 * for Apple, so the backend must be started pointing at it:
 *
 *   APPLE_KEYS_URL=http://127.0.0.1:8199/keys APPLE_AUDIENCE=io.greenlyre.micdrp backend/dev.sh &
 *   node backend/verify-apple.mjs
 */
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { createServer } from 'node:http';

const BASE = process.env.BACKEND_URL ?? 'http://127.0.0.1:8090';
const AUDIENCE = 'io.greenlyre.micdrp';
const apple = generateKeyPairSync('rsa', { modulusLength: 2048 });
const impostor = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...apple.publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const keys = createServer((_req, res) => res.end(JSON.stringify({ keys: [jwk] })));
await new Promise((resolve) => keys.listen(8199, '127.0.0.1', resolve));

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const sha = (text) => createHash('sha256').update(text).digest('hex');

function token(claims = {}, key = apple.privateKey) {
  const body = {
    iss: 'https://appleid.apple.com', aud: AUDIENCE, sub: 'apple-sub-1', nonce: sha('n1'),
    exp: Math.floor(Date.now() / 1000) + 600, email: 'apple@micdrp.test', email_verified: 'true', ...claims
  };
  const input = `${b64({ alg: 'RS256', kid: 'k1' })}.${b64(body)}`;
  return `${input}.${sign('sha256', Buffer.from(input), key).toString('base64url')}`;
}

async function call(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

const signIn = (identityToken, nonce = 'n1') => call('/api/micdrp/session/apple', { identityToken, nonce, name: 'Ada' });
const failures = [];
const check = (label, pass) => {
  if (!pass) failures.push(label);
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label}`);
};

const run = Date.now();
const sub = `apple-${run}`;
const email = `apple-${run}@micdrp.test`;

const first = await signIn(token({ sub, email }));
check('a signed token signs in', first.status === 200 && first.data.record.email === email);
check('it returns a refresh token', typeof first.data?.meta?.refreshToken === 'string');
const refreshed = await call('/api/micdrp/session/refresh', { refreshToken: first.data?.meta?.refreshToken });
check('that refresh token renews', refreshed.status === 200);
const again = await signIn(token({ sub, email: undefined, email_verified: undefined }));
check('one Apple ID is one account', again.data?.record?.id === first.data?.record?.id);

const kept = `kept-${run}@micdrp.test`;
await call('/api/collections/users/records', { email: kept, password: 'password12345', passwordConfirm: 'password12345' });
const password = await call('/api/collections/users/auth-with-password', { identity: kept, password: 'password12345' });
const linked = await signIn(token({ sub: `linked-${run}`, email: kept }));
check('an existing account with that email is kept', linked.data?.record?.id === password.data?.record?.id);
const takeover = await signIn(token({ sub: `other-${run}`, email: kept }));
check('an account linked to another Apple ID is not taken over', takeover.status === 400);

const refused = {
  'a token signed by another key': token({ sub }, impostor.privateKey),
  'another audience': token({ sub, aud: 'com.example.other' }),
  'another issuer': token({ sub, iss: 'https://example.com' }),
  'an expired token': token({ sub, exp: Math.floor(Date.now() / 1000) - 5 }),
  'a tampered token': (() => {
    const [h, , s] = token({ sub }).split('.');
    return `${h}.${b64({ iss: 'https://appleid.apple.com', aud: AUDIENCE, sub: 'someone-else', nonce: sha('n1'), exp: 9999999999 })}.${s}`;
  })()
};
for (const [label, forged] of Object.entries(refused)) {
  check(`${label} is refused`, (await signIn(forged)).status === 401);
}
check('a wrong nonce is refused', (await signIn(token({ sub }), 'n2')).status === 401);
const unvouched = await signIn(token({ sub: `new-${run}`, email: `x-${run}@micdrp.test`, email_verified: 'false' }));
check('an unverified email cannot create an account', unvouched.status === 400);

keys.close();
if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log('\nApple sign-in believes only Apple.');
