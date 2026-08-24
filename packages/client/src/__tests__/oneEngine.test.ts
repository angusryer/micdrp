/**
 * INV-PITCH-021 — there is one streaming pitch engine, and one place a frame
 * becomes a PitchSample.
 *
 * There were two. `cpp/dsp/pitch_engine.h` was the real-time-safe one, built
 * around a lock-free ring precisely so the audio thread neither allocates nor
 * blocks; `ios/StreamingPitch.h` was a second shell that re-implemented the
 * same job on the audio thread, and it was the one capture actually ran. The
 * duplication was documented in a comment at the top of the file that lost.
 *
 * A comment is not a guard. A field added to the shared PitchSample compiled,
 * passed its unit tests, and never reached the app — because the struct the
 * bridge marshalled was the other one, and nothing anywhere could notice. The
 * archive was the first thing to find out, four minutes in.
 *
 * So this counts them. It is a crude test and that is the point: the failure
 * it prevents is crude, and it is invisible to every other kind of check.
 *
 * The TS detector (`logic/mpm.ts`) and the C++ one (`cpp/dsp/mpm.cpp`) are a
 * deliberate pair, held together by the golden-parity test — that is two
 * implementations of one *algorithm*, checked against each other, which is a
 * different thing from two shells nobody compares.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');

/** Every C++/ObjC++ source under the client, excluding build output. */
function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'build' || entry === 'Pods' || entry === 'node_modules') {
      continue;
    }
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      sources(path, out);
    } else if (/\.(h|hpp|cpp|mm)$/.test(entry)) {
      out.push(path);
    }
  }
  return out;
}

const FILES = [
  ...sources(join(ROOT, 'ios')),
  ...sources(join(ROOT, 'cpp'))
].map((path) => ({ path, text: readFileSync(path, 'utf8') }));

/** Files declaring a type or class by this name, as repo-relative paths. */
const declaring = (pattern: RegExp) =>
  FILES.filter((f) => pattern.test(f.text)).map((f) =>
    f.path.slice(ROOT.length + 1)
  );

describe('one streaming pitch engine', () => {
  it('finds C++ sources to check at all', () => {
    // A search that quietly matched nothing would pass every assertion below
    // while checking none of them.
    expect(FILES.length).toBeGreaterThan(5);
  });

  it('declares PitchSample exactly once', () => {
    // The struct the bridge marshals and the struct the engine fills have to
    // be the same struct, or a field added to one is silently absent from the
    // other.
    expect(declaring(/\bstruct\s+PitchSample\b/)).toEqual([
      'cpp/dsp/pitch_engine.h'
    ]);
  });

  it('declares a streaming PitchEngine exactly once', () => {
    expect(declaring(/\b(class|struct)\s+PitchEngine\b/)).toEqual([
      'cpp/dsp/pitch_engine.h'
    ]);
  });

  it('declares EngineConfig exactly once', () => {
    expect(declaring(/\bstruct\s+EngineConfig\b/)).toEqual(['cpp/dsp/mpm.h']);
  });

  it('measures a window level in exactly one place', () => {
    // Two readings of the same audio would be free to disagree, and the whole
    // use of a level is comparing one note against another (INV-PITCH-020).
    expect(declaring(/\bdouble\s+windowLevelDb\s*\(/)).toEqual([
      'cpp/dsp/level.h'
    ]);
  });

  it('keeps the bridge free of a shell of its own', () => {
    // Everything under ios/ is the bridge: sessions, routing, marshalling. The
    // moment analysis moves back in there, this is two engines again.
    const analysis = FILES.filter(
      (f) =>
        f.path.includes('/ios/') &&
        /\bstruct\s+PitchSample\b|\b(class|struct)\s+PitchEngine\b/.test(f.text)
    );
    expect(analysis.map((f) => f.path.slice(ROOT.length + 1))).toEqual([]);
  });
});
