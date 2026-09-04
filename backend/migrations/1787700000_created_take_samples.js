/// <reference path="../pb_data/types.d.ts" />

// take_samples — a take handed over so its reading can be checked against
// the recording that produced it. See
// .harnex/project/specs/domains/dogfood/entities-samples.yml.
//
// Deliberately a second collection rather than a kind of dogfood_clip. A
// clip is speech and carries an instruction; a sample is singing and
// carries none, and an unattended loop that transcribed one would find
// words in it and act on them (INV-DOG-036). The loop's claim reads
// dogfood_clips by name, so nothing here is reachable from it.
//
// The audio is this record's own copy, not a pointer at the note's
// (INV-DOG-032): a note is local first, is renamed by the server when it
// arrives, is re-read whenever a detector is tuned, and can be deleted —
// evidence that followed it would repair itself the moment the mistake it
// recorded was papered over.
migrate((app) => {
  const collection = new Collection({
  "createRule": "@request.auth.id != \"\" && user = @request.auth.id",
  "deleteRule": "user = @request.auth.id",
  "listRule": "user = @request.auth.id",
  "viewRule": "user = @request.auth.id",
  "updateRule": "user = @request.auth.id",
  "fields": [
    {
      "autogeneratePattern": "[a-z0-9]{15}",
      "help": "",
      "hidden": false,
      "id": "text3208210256",
      "max": 15,
      "min": 15,
      "name": "id",
      "pattern": "^[a-z0-9]+$",
      "presentable": false,
      "primaryKey": true,
      "required": true,
      "system": true,
      "type": "text"
    },
    {
      "cascadeDelete": true,
      "collectionId": "_pb_users_auth_",
      "help": "",
      "hidden": false,
      "id": "relation_user",
      "maxSelect": 1,
      "minSelect": 0,
      "name": "user",
      "presentable": false,
      "required": true,
      "system": false,
      "type": "relation"
    },
    {
      "autogeneratePattern": "",
      "help": "",
      "hidden": false,
      "id": "text_note_id",
      "max": 0,
      "min": 0,
      "name": "note_id",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": true,
      "system": false,
      "type": "text"
    },
    {
      "autogeneratePattern": "",
      "help": "",
      "hidden": false,
      "id": "text_sample_title",
      "max": 0,
      "min": 0,
      "name": "title",
      "pattern": "",
      "presentable": true,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    },
    {
      "help": "",
      "hidden": false,
      "id": "file_sample_audio",
      "maxSelect": 1,
      "maxSize": 52428800,
      "mimeTypes": null,
      "name": "audio",
      "presentable": false,
      "protected": false,
      "required": false,
      "system": false,
      "thumbs": null,
      "type": "file"
    },
    {
      "help": "",
      "hidden": false,
      "id": "number_sample_duration_ms",
      "max": null,
      "min": null,
      "name": "duration_ms",
      "onlyInt": false,
      "presentable": false,
      "required": true,
      "system": false,
      "type": "number"
    },
    {
      "help": "",
      "hidden": false,
      "id": "number_sample_rate_hz",
      "max": null,
      "min": null,
      "name": "sample_rate_hz",
      "onlyInt": false,
      "presentable": false,
      "required": true,
      "system": false,
      "type": "number"
    },
    {
      "help": "",
      "hidden": false,
      "id": "json_sample_reading",
      "maxSize": 5242880,
      "name": "reading",
      "presentable": false,
      "required": true,
      "system": false,
      "type": "json"
    },
    {
      "autogeneratePattern": "",
      "help": "",
      "hidden": false,
      "id": "text_sample_app_version",
      "max": 0,
      "min": 0,
      "name": "app_version",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": true,
      "system": false,
      "type": "text"
    },
    {
      "help": "",
      "hidden": false,
      "id": "number_sample_build_number",
      "max": null,
      "min": null,
      "name": "build_number",
      "onlyInt": false,
      "presentable": false,
      "required": true,
      "system": false,
      "type": "number"
    },
    {
      "autogeneratePattern": "",
      "help": "",
      "hidden": false,
      "id": "text_sample_bundle_id",
      "max": 0,
      "min": 0,
      "name": "bundle_id",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    },
    {
      "help": "",
      "hidden": false,
      "id": "number_shared_at_ms",
      "max": null,
      "min": null,
      "name": "shared_at_ms",
      "onlyInt": false,
      "presentable": false,
      "required": true,
      "system": false,
      "type": "number"
    },
    {
      "autogeneratePattern": "",
      "help": "",
      "hidden": false,
      "id": "text_sample_state",
      "max": 0,
      "min": 0,
      "name": "state",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": true,
      "system": false,
      "type": "text"
    },
    {
      "help": "",
      "hidden": false,
      "id": "number_pulled_at_ms",
      "max": null,
      "min": null,
      "name": "pulled_at_ms",
      "onlyInt": false,
      "presentable": false,
      "required": false,
      "system": false,
      "type": "number"
    },
    {
      "hidden": false,
      "id": "autodate_created",
      "name": "created",
      "onCreate": true,
      "onUpdate": false,
      "presentable": false,
      "system": false,
      "type": "autodate"
    },
    {
      "hidden": false,
      "id": "autodate_updated",
      "name": "updated",
      "onCreate": true,
      "onUpdate": true,
      "presentable": false,
      "system": false,
      "type": "autodate"
    }
  ],
  "id": "pbc_take_samples",
  "indexes": [
    "CREATE INDEX `idx_take_samples_state` ON `take_samples` (`state`, `shared_at_ms`)",
    // Asked on every visit to a take's details, to say whether the row
    // offers to share or to withdraw.
    "CREATE INDEX `idx_take_samples_note` ON `take_samples` (`user`, `note_id`)"
  ],
  "name": "take_samples",
  "system": false,
  "type": "base"
});

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_take_samples");

  return app.delete(collection);
})
