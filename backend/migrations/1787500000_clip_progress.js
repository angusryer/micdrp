/// <reference path="../pb_data/types.d.ts" />

// dogfood_clips progress — how far the loop has got with a clip.
//
// The loop runs on a machine the maintainer is not looking at, often while
// they are elsewhere. Without this a claimed clip is indistinguishable from a
// stuck one, and the only way to tell is to go and read a log.
//
// All three are optional: a clip recorded before this existed simply has no
// progress, which is not an error.
migrate((app) => {
  const collection = app.findCollectionByNameOrId('dogfood_clips');

  collection.fields.addAt(collection.fields.length, new Field({
    hidden: false, id: 'number1787500001', name: 'progress_percent',
    presentable: false, required: false, system: false, type: 'number',
    min: 0, max: 100, onlyInt: true
  }));
  collection.fields.addAt(collection.fields.length, new Field({
    hidden: false, id: 'text1787500002', name: 'progress_note',
    presentable: false, required: false, system: false, type: 'text',
    max: 120, min: 0, pattern: '', autogeneratePattern: ''
  }));
  collection.fields.addAt(collection.fields.length, new Field({
    hidden: false, id: 'number1787500003', name: 'progress_at_ms',
    presentable: false, required: false, system: false, type: 'number',
    min: 0, onlyInt: true
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('dogfood_clips');
  for (const id of ['number1787500001', 'text1787500002', 'number1787500003']) {
    collection.fields.removeById(id);
  }
  return app.save(collection);
});
