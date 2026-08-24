/// <reference path="../pb_data/types.d.ts" />

// notes.hits_json and notes.analysis_version — the rest of the reading, and
// which reading it is.
//
// A take has exactly two things that cannot be produced again: the recording,
// and what a person did to it. The melody was already stored as though it were
// a fact; it is a reading of the audio, and so are the struck sounds beside it
// (INV-NOTES-116).
//
// The version is what makes staleness a fact rather than a guess. Without it
// the only honest offer to re-read is one on every take in the library, which
// trains a person to ignore it. Absent means the oldest reading, which is what
// every take stored before this column existed was given.
//
// Both optional, so nothing already in the library becomes an error.
migrate((app) => {
  const collection = app.findCollectionByNameOrId('notes');

  collection.fields.addAt(
    collection.fields.length,
    new Field({
      hidden: false,
      id: 'json1787600000',
      maxSize: 5242880,
      name: 'hits_json',
      presentable: false,
      required: false,
      system: false,
      type: 'json'
    })
  );

  collection.fields.addAt(
    collection.fields.length,
    new Field({
      hidden: false,
      id: 'num1787600001',
      max: null,
      min: 0,
      name: 'analysis_version',
      onlyInt: true,
      presentable: false,
      required: false,
      system: false,
      type: 'number'
    })
  );

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('notes');
  collection.fields.removeById('json1787600000');
  collection.fields.removeById('num1787600001');
  return app.save(collection);
});
