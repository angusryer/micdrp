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
 */
import React, { useEffect, useRef } from 'react';
import { TrueSheet } from '@lodev09/react-native-true-sheet';

import type { Chosen } from '../../components/graphSelection';
import { useTheme } from '../../theme';
import { SelectionBody } from './SelectionBody';
import type { useNoteDetail } from './useNoteDetail';

export interface SelectionSheetProps {
  detail: ReturnType<typeof useNoteDetail>;
  selection: Chosen;
  onSelect: (selection: Chosen) => void;
}

export function SelectionSheet({
  detail,
  selection,
  onSelect
}: SelectionSheetProps): React.JSX.Element {
  const { colors } = useTheme();
  const sheet = useRef<TrueSheet>(null);

  useEffect(() => {
    if (selection.length > 0) {
      void sheet.current?.present();
    } else {
      void sheet.current?.dismiss();
    }
  }, [selection]);

  return (
    <TrueSheet
      ref={sheet}
      name="selection"
      detents={['auto']}
      grabber
      grabberOptions={{ topMargin: 12 }}
      cornerRadius={16}
      backgroundColor={colors.neutral50}
      // The graph stays live behind it, which is the whole point
      // (INV-NOTES-078).
      dimmed={false}
      // Dragged away means put down, so the graph and the sheet never
      // disagree about whether anything is chosen.
      onDidDismiss={() => onSelect([])}
    >
      <SelectionBody
        detail={detail}
        selection={selection}
        onSelect={onSelect}
      />
    </TrueSheet>
  );
}

export default SelectionSheet;
