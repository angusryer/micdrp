/**
 * INV-NOTES-122 — a layer's role decides how it is read.
 *
 * A layer and a track are different things and stay different. A track is a
 * channel in the mixer, declared once, usually a reading of the take and
 * owning no audio. A layer is a second recording: it owns audio, a role, and a
 * reading of its own. Every layer sounds through a track; no track needs a
 * layer.
 *
 * The role was being carried all the way to storage and never consulted, so a
 * layer recorded as drums was read as singing — the reader was told what it
 * was looking at and ignored it.
 */
import { LAYER_ROLES, layerRoleSpec, takeRoleFor } from '../layerRoles';
import type { LayerRole } from 'shared';

describe('what a layer is recorded as', () => {
  it('offers a role for everything a person might sing', () => {
    const roles = LAYER_ROLES.map((spec) => spec.role);
    expect(roles).toContain('bass');
    expect(roles).toContain('drums');
    expect(roles).toContain('melody');
    expect(roles).toContain('other');
  });

  it('reads a drum layer for hits and not for singing', () => {
    // The gap this closes. Told a layer is drums, the reader stops asking
    // whether each sound might have been a note (INV-NOTES-115).
    expect(takeRoleFor('drums')).toBe('drums');
  });

  it('reads a bass line and a melody for notes', () => {
    expect(takeRoleFor('bass')).toBe('bass');
    expect(takeRoleFor('melody')).toBe('melody');
  });

  it('reads anything unclassified the way a first take is read', () => {
    // Not a failure to classify: it is kept and sounded, and read as best it
    // can be, which is the reading a take nobody declared gets.
    expect(takeRoleFor('other')).toBe('mixed');
  });

  it('falls back rather than throwing on a role it has never seen', () => {
    // A note stored by a newer build, opened by an older one. Refusing to
    // read it would lose the recording; reading it as undeclared does not.
    expect(takeRoleFor('conga' as LayerRole)).toBe('mixed');
    expect(layerRoleSpec('conga' as LayerRole).role).toBe('other');
  });

  it('says what each role is for, where a person is choosing between them', () => {
    for (const spec of LAYER_ROLES) {
      expect(spec.title.trim().length).toBeGreaterThan(2);
      expect(spec.what.trim().length).toBeGreaterThan(20);
    }
  });

  it('gives every role exactly one reading', () => {
    const seen = new Set(LAYER_ROLES.map((spec) => spec.role));
    expect(seen.size).toBe(LAYER_ROLES.length);
  });
});
