/**
 * Test-only helper for driving a hook through a render harness.
 *
 * @types/react 19 disagrees with itself: `FunctionComponent`'s return is
 * `ReactNode`, which includes `bigint` and `Promise<ReactNode>`, while the
 * `JSXElementConstructor` inside `ReactElement` excludes both. A harness
 * component is a perfectly valid element either way, so the cast is contained
 * here rather than repeated at every call site.
 */
import React from 'react';

export function harnessElement<P extends object>(
  Component: React.FunctionComponent<P>,
  props: P
): React.ReactElement {
  return React.createElement(Component, props) as React.ReactElement;
}
