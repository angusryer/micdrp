/**
 * ACC-NOTES-238 / INV-NOTES-224 — a decision is kept on this device the
 * moment it is made.
 *
 * Pitch corrections went to the server and nowhere else, while the screen
 * that shows them reads the cache. Going back to the list then ran a sync,
 * which overwrites that cache with what the server holds — and the save,
 * debounced and then a round trip, had usually not landed. So a correction
 * survived only when it won a race it had no reason to win.
 */
const mockStore = new Map<string, unknown>();

jest.mock('../store', () => ({
  setJSON: (key: string, value: unknown) => mockStore.set(key, value),
  getJSON: (key: string) => mockStore.get(key),
  getString: (key: string) => mockStore.get(key) as string | undefined,
  setString: (key: string, value: string) => mockStore.set(key, value),
  remove: (key: string) => void mockStore.delete(key),
  has: (key: string) => mockStore.has(key),
  getAllKeys: () => [...mockStore.keys()],
  clearAll: () => mockStore.clear()
}));

const mockList = jest.fn<Promise<unknown[]>, []>();
const mockSave = jest.fn<Promise<void>, unknown[]>();
jest.mock('../notesRepo', () => ({
  notesRepo: {
    list: () => mockList(),
    saveInterpretations: (...args: unknown[]) => mockSave(...args)
  }
}));

import type { InterpretationDto, NoteDto } from 'shared';

import { cachedNotes, syncNotes } from '../notesSync';
import {
  flushInterpretations,
  queueInterpretations,
  resetInterpretationQueueForTests
} from '../interpretationQueue';
import { NOTES_INDEX_KEY, type NoteMeta } from '../notesCache';

/** A correction: the note heard at 500ms is really a semitone higher. */
const corrected: InterpretationDto[] = [
  {
    id: 'active',
    name: 'Original',
    createdAtMs: 0,
    isFrozen: false,
    chords: [],
    notes: [{ atMs: 500, midi: 62 }]
  }
];

/** The take as it sits on this device before anything is corrected. */
const cached = (over: Partial<NoteMeta> = {}): NoteMeta => ({
  id: 'note-1',
  title: 'A tune',
  createdAtMs: 10,
  durationMs: 4000,
  sampleRateHz: 48000,
  audioPath: 'takes/note-1.wav',
  melody: [],
  noteCount: 0,
  localAudioUri: 'file:///takes/note-1.wav',
  ...over
});

/** What the server says about the same take: it has heard of no correction. */
const fromServer = (): NoteDto =>
  ({
    id: 'note-1',
    title: 'A tune',
    createdAtMs: 10,
    durationMs: 4000,
    sampleRateHz: 48000,
    audioPath: 'takes/note-1.wav',
    melody: [],
    noteCount: 0,
    interpretations: []
  }) as unknown as NoteDto;

const noteNow = (): NoteMeta | undefined =>
  cachedNotes().find((n) => n.id === 'note-1');

beforeEach(() => {
  mockStore.clear();
  resetInterpretationQueueForTests();
  mockList.mockReset().mockResolvedValue([fromServer()]);
  mockSave.mockReset().mockResolvedValue(undefined);
  mockStore.set(NOTES_INDEX_KEY, { 'note-1': cached() });
});

it('ACC-NOTES-238: keeps a correction on the device before it is sent', () => {
  queueInterpretations('note-1', corrected);
  // What re-opening the note reads. Nothing has been sent anywhere.
  expect(noteNow()?.interpretations?.[0].notes).toEqual([
    { atMs: 500, midi: 62 }
  ]);
});

it('does not let a sync replace a reading still waiting to be delivered', async () => {
  queueInterpretations('note-1', corrected);
  await syncNotes();
  expect(noteNow()?.interpretations?.[0].notes).toEqual([
    { atMs: 500, midi: 62 }
  ]);
});

it('takes the server word once the correction has reached it', async () => {
  queueInterpretations('note-1', corrected);
  await flushInterpretations();
  // Nothing is waiting any more, so the server is authoritative again — and
  // this one is answering with a reading that predates the save.
  await syncNotes();
  expect(noteNow()?.interpretations).toEqual([]);
});

it('leaves the audio sung on this device where a sync can still find it', async () => {
  // The local file outlives the upload and is the faster thing to play
  // (INV-NOTES-139). The sync read it back out of the half-built index it
  // was writing, where only takes that had never been uploaded appear, so
  // every synced take lost it.
  await syncNotes();
  expect(noteNow()?.localAudioUri).toBe('file:///takes/note-1.wav');
});

it('says nothing about a take that is no longer on this device', () => {
  // A save can outlive the take being deleted; re-creating it from an edit
  // would put back a note somebody threw away.
  queueInterpretations('gone', corrected);
  expect(cachedNotes().map((n) => n.id)).toEqual(['note-1']);
});
