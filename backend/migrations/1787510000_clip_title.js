/// <reference path="../pb_data/types.d.ts" />

// dogfood_clips.title — a few words naming what a remark is about.
//
// The queue was listing the first seventy characters of each transcript, which
// reads as a wall of speech rather than a list of things. The loop writes this
// when it reads the remark; a clip that has not been read yet simply has none.
migrate((app) => {
  const collection = app.findCollectionByNameOrId('dogfood_clips');
  collection.fields.addAt(collection.fields.length, new Field({
    autogeneratePattern: '', hidden: false, id: 'text1787510001',
    max: 60, min: 0, name: 'title', pattern: '', presentable: false,
    primaryKey: false, required: false, system: false, type: 'text'
  }));
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('dogfood_clips');
  collection.fields.removeById('text1787510001');
  return app.save(collection);
});
