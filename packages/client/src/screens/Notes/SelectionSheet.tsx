/**
 * SelectionSheet — where the selection lives when the phone is upright.
 *
 * Undimmed on purpose. The point of choosing something is to act on it, and
 * dragging is one of the actions — a sheet that covered the graph would make
 * the buttons and the direct manipulation exclusive, when moving the thing is
 * the one that has to be watched while it happens (INV-NOTES-078).
 *
 * Upright there is room below the graph for it to rise into. Sideways there
 * is not, and SelectionPanel comes in from the side instead — the content is
 * the same SelectionBody either way.
 *
 * It reports how much of the screen it took, because the page underneath has
 * to be able to scroll clear of it. Undimmed and non-modal means the page is
 * still live, and a page that cannot reach its own bottom row is live in name
 * only (INV-NOTES-109).
 */
import React from 'react';

import type { Chosen } from '../../components/graphSelection';
import { Sheet } from '../../components/Sheet';
import { useTheme } from '../../theme';
import { SelectionBody } from './SelectionBody';
import type { useNoteDetail } from './useNoteDetail';

export interface SelectionSheetProps {
  detail: ReturnType<typeof useNoteDetail>;
  selection: Chosen;
  onSelect: (selection: Chosen) => void;
  /**
   * How much of the screen the sheet is covering, in px, and zero once it has
   * gone. The page under it keeps that much room at its foot so its last row
   * can still be scrolled into view (INV-NOTES-109).
   */
  onCover?: (height: number) => void;
}

export function SelectionSheet({
  detail,
  selection,
  onSelect,
  onCover
}: SelectionSheetProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <Sheet
      name="selection"
      isOpen={selection.length > 0}
      // Dragged away means put down, so the graph and the sheet never
      // disagree about whether anything is chosen.
      onClose={() => onSelect([])}
      // The graph stays live behind it, which is the whole point
      // (INV-NOTES-078).
      isDimmed={false}
      onCover={onCover}
      background={colors.neutral50}
    >
      <SelectionBody
        detail={detail}
        selection={selection}
        onSelect={onSelect}
      />
    </Sheet>
  );
}

export default SelectionSheet;
