/**
 * The current value of something, read without depending on it.
 *
 * The transport starts and stops its voices from one effect, and that effect
 * must run when the transport changes and at no other time. Naming a voice as
 * a dependency would restart it whenever it was re-made — an edit, a
 * re-render — underneath a take that never stopped (INV-NOTES-020).
 *
 * Extracted because there are now six of these and they were six copies of
 * the same four lines.
 */
import { useEffect, useRef, type MutableRefObject } from 'react';

export function useLatest<T>(value: T): MutableRefObject<T> {
  const held = useRef(value);
  useEffect(() => {
    held.current = value;
  }, [value]);
  return held;
}

export default useLatest;
