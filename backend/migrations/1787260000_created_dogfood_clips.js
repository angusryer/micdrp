/// <reference path="../pb_data/types.d.ts" />

// dogfood_clips — spoken feedback about the app, and what the agent loop has
// made of it. See .harnex/project/specs/domains/dogfood/contracts.yml.
//
// The transcript and the requests read out of it are stored on the clip
// itself so a re-run pays for neither again (INV-DOG-013), and the claim
// fields are what stop two runs working the same clip (INV-DOG-012).
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
      "help": "",
      "hidden": false,
      "id": "file_audio",
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
      "id": "number_duration_ms",
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
      "id": "json_screen_trail",
      "maxSize": 1048576,
      "name": "screen_trail",
      "presentable": false,
      "required": true,
      "system": false,
      "type": "json"
    },
    {
      "autogeneratePattern": "",
      "help": "",
      "hidden": false,
      "id": "text_app_version",
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
      "id": "number_build_number",
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
      "id": "text_bundle_id",
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
      "id": "number_recorded_at_ms",
      "max": null,
      "min": null,
      "name": "recorded_at_ms",
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
      "id": "text_state",
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
      "id": "number_claimed_at_ms",
      "max": null,
      "min": null,
      "name": "claimed_at_ms",
      "onlyInt": false,
      "presentable": false,
      "required": false,
      "system": false,
      "type": "number"
    },
    {
      "autogeneratePattern": "",
      "help": "",
      "hidden": false,
      "id": "text_claimed_by",
      "max": 0,
      "min": 0,
      "name": "claimed_by",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    },
    {
      "autogeneratePattern": "",
      "help": "",
      "hidden": false,
      "id": "text_transcript",
      "max": 0,
      "min": 0,
      "name": "transcript",
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
      "id": "number_transcript_confidence",
      "max": null,
      "min": null,
      "name": "transcript_confidence",
      "onlyInt": false,
      "presentable": false,
      "required": false,
      "system": false,
      "type": "number"
    },
    {
      "help": "",
      "hidden": false,
      "id": "json_requests",
      "maxSize": 1048576,
      "name": "requests",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "json"
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
  "id": "pbc_dogfood_clips",
  "indexes": [
    "CREATE INDEX `idx_dogfood_state` ON `dogfood_clips` (`state`, `recorded_at_ms`)"
  ],
  "name": "dogfood_clips",
  "system": false,
  "type": "base"
});

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_dogfood_clips");

  return app.delete(collection);
})
