/**
 * Reading back what was drawn on a canvas.
 *
 * Skia draws into a surface, so there is nothing in the rendered tree to
 * query and nothing a test can assert against — which pushes towards having
 * the runtime hand out intermediate arrays that only tests read. That trade
 * gets worse as the canvas gets busier: the drawing code ends up shaped by
 * what is convenient to inspect rather than by what is fast to draw.
 *
 * So the seam is here instead. The Skia mock in jest.setup renders every
 * primitive as a host node carrying its own props, and an SkPath records the
 * commands written into it. This reads those back, off the rendered JSON so
 * it does not depend on which private handles the test renderer exposes. The
 * runtime stays free to write straight into a path and allocate nothing.
 */

/** A node of the rendered tree, as the test renderer serialises it. */
export interface DrawnNode {
  type: string;
  props: Record<string, unknown>;
  children: DrawnNode[] | null;
}

/** Anything that can be searched: a render result or a node already found. */
type Searchable = { toJSON: () => unknown } | DrawnNode | null;

/**
 * Every `<Line>`, `<Path>`, `<RoundedRect>` and so on drawn inside this tree,
 * in the order they were drawn — which is the order they paint in.
 */
export function skiaDrawn(tree: Searchable, primitive: string): DrawnNode[] {
  const root =
    tree && typeof (tree as { toJSON?: unknown }).toJSON === 'function'
      ? (tree as { toJSON: () => unknown }).toJSON()
      : tree;
  const wanted = `skia-${primitive}`;
  const found: DrawnNode[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const drawn = node as DrawnNode;
    if (drawn.type === wanted) {
      found.push(drawn);
    }
    drawn.children?.forEach(walk);
  };
  walk(root);
  return found;
}

/** The commands written into a recording SkPath, in order. */
export function pathCommands(path: unknown): [string, number, number][] {
  return (path as { commands?: [string, number, number][] })?.commands ?? [];
}
