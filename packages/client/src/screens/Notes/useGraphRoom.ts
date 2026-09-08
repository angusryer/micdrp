/**
 * Bringing the graph into the room a sheet leaves it (INV-NOTES-226).
 *
 * Two acts and one measurement. The page is scrolled so the graph's top
 * meets the header, and the graph is drawn in what is left between there and
 * the top of the sheet. The arithmetic is in `graphRoom.ts`; this is the
 * measuring and the scrolling, which need a screen.
 *
 * The scroll fires on the sheet arriving, not on the render: a sheet stays
 * open across every redraw underneath it, and scrolling on each one would
 * take the page back from wherever it had since been put (INV-NOTES-225).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent, ScrollView } from 'react-native';

import { graphHeightFor } from './graphRoom';

export interface GraphRoomOptions {
  /** How much of the page the open sheets cover, and zero when none does. */
  coveredPx: number;
  /** The share the graph takes when nothing covers it. */
  usualPx: number;
}

export function useGraphRoom({ coveredPx, usualPx }: GraphRoomOptions) {
  const scrollRef = useRef<ScrollView>(null);
  const [viewportPx, setViewportPx] = useState(0);
  /** Where the graph sits in the page, from the page's own top. */
  const graphTop = useRef(0);

  const onViewportLayout = useCallback(
    (e: LayoutChangeEvent) => setViewportPx(e.nativeEvent.layout.height),
    []
  );
  const onGraphLayout = useCallback((e: LayoutChangeEvent) => {
    graphTop.current = e.nativeEvent.layout.y;
  }, []);

  const isCovered = coveredPx > 0;
  useEffect(() => {
    if (isCovered) {
      scrollRef.current?.scrollTo({ y: graphTop.current, animated: true });
    }
  }, [isCovered]);

  return {
    scrollRef,
    onViewportLayout,
    onGraphLayout,
    graphHeight: graphHeightFor({
      viewportPx,
      coveredPx,
      usualPx,
      // What is above the graph once the page is scrolled to it: nothing.
      // The title and the bar have gone off the top, which is why the rail
      // carries a transport of its own (INV-NOTES-227).
      headerPx: 0
    })
  };
}

export default useGraphRoom;
