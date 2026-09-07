/// <reference path="../pb_data/types.d.ts" />

// notes.read_with_json — the thresholds a take's reading was made with.
//
// Every number the reader turns on lived once for the whole app, so a
// recording made in August was read again with a tuning arrived at in
// September against a different take, and came back as a different melody
// with nothing to say it had been read under settings never chosen for it
// (INV-NOTES-216).
//
// The version column next door says which reader; this says which settings.
// Together they are what makes a stored melody a measurement rather than an
// artefact — a reading whose thresholds are not written down cannot be
// reproduced, compared, or argued with.
//
// Optional, because every take already in the library was read before this
// existed and has no honest value to give. Those fall back to the app-wide
// numbers once, and are stamped on the next reading.
migrate((app) => {
  const collection = app.findCollectionByNameOrId('notes');

  collection.fields.addAt(
    collection.fields.length,
    new Field({
      hidden: false,
      id: 'json1787800000',
      maxSize: 65536,
      name: 'read_with_json',
      presentable: false,
      required: false,
      system: false,
      type: 'json'
    })
  );

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('notes');
  collection.fields.removeById('json1787800000');
  return app.save(collection);
});
