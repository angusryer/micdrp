/**
 * INV-NOTES-121 — a track is declared once.
 *
 * A track used to be spelled out in six places plus a C++ enum, so adding one
 * meant an Xcode build and a TestFlight upload to hand the synth an integer
 * the caller already knew. The failure that made it worth fixing was quieter
 * than the tedium: the click was given the melody's bus, so turning the click
 * down turned the tune down with it and neither control did what it said
 * (INV-NOTES-119).
 *
 * What this pins is that the registry is the only place, and that nothing
 * derived from it can drift out of step with it.
 */
import {
  DEFAULT_LEVELS,
  DEFAULT_MIX,
  TRACK_ORDER,
  TRACK_TITLES
} from '../playbackTracks';
import { TRACKS, trackBus, trackSpec, tracksWithRole } from '../trackRegistry';

describe('the tracks, declared once', () => {
  it('has some to check at all', () => {
    // A registry that quietly emptied would pass every assertion below while
    // checking none of them.
    expect(TRACKS.length).toBeGreaterThan(3);
  });

  it('gives every track a bus of its own', () => {
    // The bug that prompted this: two voices on one bus share a level, so
    // one control moves both and neither says what it does.
    const buses = TRACKS.map((track) => trackBus(track.name));
    expect(new Set(buses).size).toBe(buses.length);
    for (const bus of buses) {
      expect(bus).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps the track buses clear of the ones that are not tracks', () => {
    // A tapped note and the chord root have buses too. Overlapping would put
    // an audition on top of a track and move both with one slider.
    const AUDITION_BUS = 8;
    for (const track of TRACKS) {
      expect(trackBus(track.name)).toBeLessThan(AUDITION_BUS);
    }
  });

  it('derives the mix, the levels, the titles and the order from it', () => {
    for (const track of TRACKS) {
      expect(DEFAULT_MIX[track.name]).toBe(track.startsOn);
      expect(DEFAULT_LEVELS[track.name]).toBe(track.level);
      expect(TRACK_TITLES[track.name]).toBe(track.title);
      expect(TRACK_ORDER).toContain(track.name);
    }
    // And nothing derived carries a track the registry does not.
    expect(TRACK_ORDER).toHaveLength(TRACKS.length);
    expect(Object.keys(DEFAULT_MIX)).toHaveLength(TRACKS.length);
    expect(Object.keys(DEFAULT_LEVELS)).toHaveLength(TRACKS.length);
  });

  it('names every track something a person would say', () => {
    for (const track of TRACKS) {
      expect(track.title.trim().length).toBeGreaterThan(2);
      expect(track.level).toBeGreaterThan(0);
      expect(track.level).toBeLessThanOrEqual(1);
    }
  });

  it('says what kind each one is, so its reading is decided', () => {
    // The role is what connects a track to how it is read: melodic tracks go
    // through the note reader, percussive ones through the hit reader
    // (INV-NOTES-115).
    expect(tracksWithRole('melodic').length).toBeGreaterThan(0);
    expect(tracksWithRole('percussive')).toContain('rhythm');
    expect(tracksWithRole('recording')).toEqual(['take']);
    expect(trackSpec('count').role).toBe('timing');
  });

  it('answers for every track it lists', () => {
    for (const track of TRACKS) {
      expect(trackSpec(track.name)).toBe(track);
    }
  });
});
