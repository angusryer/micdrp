/// <reference path="../pb_data/types.d.ts" />

// refresh_tokens — the lines that keep a singer signed in. See
// .harnex/project/specs/domains/account/invariants-session.yml.
//
// Only a hash of each token is stored (INV-ACCOUNT-017), and every rule is
// null so nothing but the session hooks in pb_hooks/ can reach a row. The
// access token drops from a week to an hour in the same step
// (INV-ACCOUNT-016): a long refresh token is what keeps someone signed in,
// so the bearer credential on every request no longer has to.
const field = (name, type, extra) => ({
  hidden: false, id: `${type}_${name}`, name, presentable: false,
  required: false, system: false, type, ...extra
});

migrate((app) => {
  const collection = new Collection({
    id: "pbc_refresh_tokens",
    name: "refresh_tokens",
    type: "base",
    system: false,
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      field("user", "relation", {
        cascadeDelete: true, collectionId: "_pb_users_auth_",
        maxSelect: 1, minSelect: 0, required: true
      }),
      // Every token descended from one sign-in shares a family.
      field("family", "text", { required: true, max: 0, min: 0, pattern: "" }),
      field("token_hash", "text", { required: true, max: 0, min: 0, pattern: "" }),
      // The account's tokenKey when issued; a password change rotates it.
      field("token_key", "text", { required: true, max: 0, min: 0, pattern: "" }),
      field("expires_at_ms", "number", { required: true, onlyInt: true }),
      field("rotated_at_ms", "number", { onlyInt: true }),
      // The id of the token issued when this one was used.
      field("successor", "text", { max: 0, min: 0, pattern: "" }),
      field("revoked", "bool", {})
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_refresh_tokens_hash` ON `refresh_tokens` (`token_hash`)",
      "CREATE INDEX `idx_refresh_tokens_family` ON `refresh_tokens` (`family`)",
      "CREATE INDEX `idx_refresh_tokens_user` ON `refresh_tokens` (`user`)"
    ]
  });
  app.save(collection);

  const users = app.findCollectionByNameOrId("users");
  users.authToken.duration = 3600;
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.authToken.duration = 604800;
  app.save(users);

  app.delete(app.findCollectionByNameOrId("pbc_refresh_tokens"));
});
