/**
 * What a worklet reaches, read statically (INV-NOTES-207).
 *
 * Running a worklet is not testable here — there is no UI thread under jest,
 * and a worklet calling plain JavaScript does not throw, it takes the process
 * down. But *reading* one is testable, and the violation is entirely visible
 * in the source: a call, out of a worklet, to a function that does not carry
 * the directive.
 *
 * Twice now that has shipped and exited the app the instant a note was
 * opened — `xForMs` from an animated style, then `clamp` from `placeLoupe`.
 * Both times nothing caught it until a device did. This is what catches it.
 *
 * Deliberately a source scan rather than a lint rule: it is one rule about
 * one hazard in one project, and a bespoke ESLint plugin would be more
 * machinery than the thing it guards.
 */

/** Everything the Reanimated runtime provides, or the language does. */
const AVAILABLE = new Set([
  'if', 'for', 'while', 'switch', 'return', 'typeof', 'void', 'delete', 'new',
  'Math', 'Number', 'String', 'Boolean', 'Array', 'Object', 'JSON', 'Date',
  'Set', 'Map', 'RegExp', 'Error', 'Symbol', 'console',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'push', 'pop', 'shift', 'unshift', 'slice', 'splice', 'map', 'filter',
  'reduce', 'forEach', 'find', 'findIndex', 'includes', 'indexOf', 'join',
  'concat', 'sort', 'reverse', 'some', 'every', 'keys', 'values', 'entries',
  'assign', 'floor', 'ceil', 'round', 'abs', 'min', 'max', 'sqrt', 'pow',
  'sign', 'trunc', 'random', 'hypot', 'atan2', 'log', 'exp', 'now',
  'toFixed', 'toString', 'charAt', 'charCodeAt', 'substring', 'split', 'trim',
  'replace', 'startsWith', 'endsWith',
  // Reanimated's own, which are worklets on the other side of the bridge.
  'withTiming', 'withSpring', 'withDecay', 'withSequence', 'withDelay',
  'withRepeat', 'interpolate', 'interpolateColor', 'runOnJS', 'runOnUI',
  'scrollTo', 'measure', 'cancelAnimation', 'setGestureState'
]);

const DIRECTIVE = "'worklet';";

/** How far past a function's opening brace the directive may sit. */
const DIRECTIVE_WINDOW = 800;

/** Whether the text just inside a function opens with the directive. */
function carriesDirective(afterBrace: string): boolean {
  return afterBrace.slice(0, DIRECTIVE_WINDOW).includes(DIRECTIVE);
}

/** Every module-scope function in a source file, and whether it is a worklet. */
export function declaredFunctions(source: string): Map<string, boolean> {
  const found = new Map<string, boolean>();
  const shapes = [
    /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm,
    /^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)[^=]*=>\s*\{/gm
  ];
  for (const shape of shapes) {
    for (const match of source.matchAll(shape)) {
      const rest = source.slice(match.index ?? 0);
      const brace = rest.indexOf('{');
      found.set(
        match[1],
        brace >= 0 && carriesDirective(rest.slice(brace + 1))
      );
    }
  }
  return found;
}

/** The body of every worklet in a file, brace-matched from its directive. */
export function workletBodies(source: string): string[] {
  const bodies: string[] = [];
  let at = source.indexOf(DIRECTIVE);
  while (at >= 0) {
    let depth = 1;
    let i = at + DIRECTIVE.length;
    while (i < source.length && depth > 0) {
      if (source[i] === '{') {
        depth += 1;
      } else if (source[i] === '}') {
        depth -= 1;
      }
      i += 1;
    }
    bodies.push(source.slice(at + DIRECTIVE.length, i));
    at = source.indexOf(DIRECTIVE, i);
  }
  return bodies;
}

/** Every function called in a body that something has to vouch for. */
export function calledNames(body: string): string[] {
  const names = new Set<string>();
  for (const call of body.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
    const name = call[1];
    // Hooks and components cannot be called from a worklet at all, and are
    // caught by the runtime rather than by this.
    if (AVAILABLE.has(name) || name.startsWith('use') || /^[A-Z]/.test(name)) {
      continue;
    }
    names.add(name);
  }
  return [...names];
}
