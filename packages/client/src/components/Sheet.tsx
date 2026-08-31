/**
 * The bottom sheet, once (INV-NOTES-181).
 *
 * There were four, each written out again, and they had drifted: one reported
 * what it covered and three did not, two dimmed what was behind and two did
 * not, and the differences were accidents of when each was written rather
 * than decisions. The scroll-clear fault was found and fixed once, then
 * shipped again with the next sheet that covered a page.
 *
 * What every sheet does is built in here and cannot be forgotten: presenting
 * from a boolean, the grabber in the chrome outside the scroll, the corner,
 * and reporting how much of the screen it covers so the page beneath can be
 * scrolled clear of it (INV-NOTES-109).
 *
 * What differs is passed in, as behaviour rather than as a variant name: how
 * far up it opens and what it may be dragged to, whether what is behind it is
 * dimmed, and whether it scrolls its own contents. "The tall one" and "the one
 * over the graph" describe today's four; a sheet that takes its heights can be
 * the fifth without a new name.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native';
import { TrueSheet } from '@lodev09/react-native-true-sheet';

import { useTheme } from '../theme';

/** How tall a sheet may be: a fraction of the screen, or what it needs. */
export type SheetDetent = number | 'auto';

export interface SheetProps {
  /** Its native name, which is also how a test tells one sheet from another. */
  name: string;
  isOpen: boolean;
  /**
   * Called after the native dismiss, however it happened — dragged down, a
   * tap outside, or the caller's own close — so the caller's boolean never
   * disagrees with what is on screen.
   */
  onClose: () => void;
  /**
   * Where it stops. The first is where it opens; the rest are what it can be
   * dragged to. Defaults to fitting its content.
   */
  detents?: SheetDetent[];
  /**
   * Whether what is behind it is dimmed and out of reach.
   *
   * Off wherever the thing behind is the thing being worked on — the graph
   * under the selection, the graph under the analysis knobs. Dimming it hides
   * the very change being watched for.
   */
  isDimmed?: boolean;
  /**
   * Told how much of the screen this is covering, in px, and zero when it
   * goes. A page that does not use this cannot have its last row reached
   * (INV-NOTES-109).
   */
  onCover?: (px: number) => void;
  /** Whether it scrolls its own contents. Off where the caller scrolls. */
  isScrolling?: boolean;
  /** What it is drawn on. Defaults to the raised surface. */
  background?: string;
  children: React.ReactNode;
}

export function Sheet({
  name,
  isOpen,
  onClose,
  detents = ['auto'],
  isDimmed = true,
  onCover,
  isScrolling = true,
  background,
  children
}: SheetProps): React.JSX.Element {
  const { colors } = useTheme();
  const sheet = useRef<TrueSheet>(null);

  // Driven from a boolean rather than a ref handed to callers: every caller
  // already holds "is it open", and a second way of saying the same thing is
  // a second thing to keep in step.
  useEffect(() => {
    if (isOpen) {
      void sheet.current?.present();
    } else {
      void sheet.current?.dismiss();
    }
  }, [isOpen]);

  // Measured from where it actually settled rather than assumed: a sheet
  // sizes itself to its content or to wherever it was dragged, and neither is
  // knowable from here.
  const settledAt = useCallback(
    (position: number) => {
      onCover?.(Math.max(0, Dimensions.get('window').height - position));
    },
    [onCover]
  );

  const tallest = detents.reduce<number>(
    (most, one) => (typeof one === 'number' ? Math.max(most, one) : most),
    0.86
  );

  return (
    <TrueSheet
      ref={sheet}
      name={name}
      detents={detents}
      dimmed={isDimmed}
      // In the sheet chrome outside the scroll. A grabber inside a ScrollView
      // is the one place it cannot work: dragging it scrolls the body and
      // never pans the sheet (INV-NOTES-077).
      grabber
      grabberOptions={{ topMargin: 12 }}
      cornerRadius={16}
      backgroundColor={background ?? colors.neutral50}
      onDidPresent={(e) => settledAt(e.nativeEvent.position)}
      // Dragged to another stop is a new height to scroll clear of. On the
      // stop rather than continuously: position changes fire every frame of a
      // drag, and the page below does not need to re-lay-out on each one.
      onDetentChange={(e) => settledAt(e.nativeEvent.position)}
      onDidDismiss={() => {
        onCover?.(0);
        onClose();
      }}
    >
      {isScrolling ? (
        <ScrollView
          style={{
            maxHeight: Math.round(Dimensions.get('window').height * tallest)
          }}
          contentInsetAdjustmentBehavior="never"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.body}>{children}</View>
      )}
    </TrueSheet>
  );
}

const styles = StyleSheet.create({
  body: { flexShrink: 1 }
});

export default Sheet;
