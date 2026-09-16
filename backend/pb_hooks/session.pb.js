/// <reference path="../pb_data/types.d.ts" />

// Session routes: refresh token rotation for the users collection. The rules
// live in lib/session.js; see
// .harnex/project/specs/domains/account/invariants-session.yml.

// A real sign-in starts a line. The refresh route answers through the same
// response with an empty method, so it does not start a second one.
onRecordAuthRequest((e) => {
  if (["password", "oauth2", "otp"].includes(e.authMethod)) {
    const session = require(`${__hooks}/lib/session.js`);
    const meta = Object.assign({}, e.meta || {});
    meta.refreshToken = session.issue($app, e.record, "").token;
    e.meta = meta;
  }
  e.next();
}, "users");

// An access token may not renew itself (INV-ACCOUNT-016).
onRecordAuthRefreshRequest((e) => {
  throw new ForbiddenError("Renew with a refresh token.");
}, "users");

routerAdd("POST", "/api/micdrp/session/refresh", (e) => {
  const session = require(`${__hooks}/lib/session.js`);
  const out = session.refresh(String(e.requestInfo().body.refreshToken || ""));
  if (!out) {
    throw new UnauthorizedError("The refresh token was refused.");
  }
  return $apis.recordAuthResponse(e, out.user, "", { refreshToken: out.token });
});

routerAdd("POST", "/api/micdrp/session/adopt", (e) => {
  const session = require(`${__hooks}/lib/session.js`);
  const token = session.adopt(e.auth);
  if (!token) {
    throw new ForbiddenError("This account already has a refresh token.");
  }
  return e.json(200, { refreshToken: token });
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/micdrp/session/sign-out", (e) => {
  const session = require(`${__hooks}/lib/session.js`);
  session.signOut(String(e.requestInfo().body.refreshToken || ""));
  return e.noContent(204);
});

cronAdd("refresh_tokens_prune", "17 4 * * *", () => {
  require(`${__hooks}/lib/session.js`).prune();
});
