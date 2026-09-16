/// <reference path="../pb_data/types.d.ts" />

// users.apple_sub — the Apple ID an account is linked to (INV-ACCOUNT-025).
// Hidden, so no API response carries it, and unique where set, so one Apple
// ID can never reach two accounts.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.add(new TextField({
    id: "text_apple_sub", name: "apple_sub", hidden: true,
    required: false, system: false, presentable: false, max: 0, min: 0, pattern: ""
  }));
  users.addIndex("idx_users_apple_sub", true, "apple_sub", "apple_sub != ''");
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.removeIndex("idx_users_apple_sub");
  users.fields.removeById("text_apple_sub");
  app.save(users);
});
