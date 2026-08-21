/// <reference path="../pb_data/types.d.ts" />

// notes.interpretations_json — what a person made of a take.
//
// A list, not a single edit set, because a note holds several readings and one
// is active (see .harnex/project/specs/domains/notes/entities-edits.yml). The
// active one stores only what was overridden and is replayed against whatever
// analysis now infers; a frozen one stores the whole reading, because its
// purpose is to survive detection changing underneath it.
//
// Optional, so every note recorded before readings existed loads as having
// none rather than as an error (INV-NOTES-022).
migrate((app) => {
  const collection = app.findCollectionByNameOrId('notes');

  collection.fields.addAt(
    collection.fields.length,
    new Field({
      hidden: false,
      id: 'json1787400000',
      maxSize: 5242880,
      name: 'interpretations_json',
      presentable: false,
      required: false,
      system: false,
      type: 'json'
    })
  );

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('notes');
  collection.fields.removeById('json1787400000');
  return app.save(collection);
});
