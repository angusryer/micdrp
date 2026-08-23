/**
 * PlaybackOptions — everything in the sheet that is not a track toggle.
 *
 * The transport draws the tracks itself, since it is the thing that honours
 * them; everything else that decides what a press does is gathered here and
 * handed to it, so PlaybackBar never learns what an octave or a reading is
 * (INT-NOTES-021).
 *
 * Order is the order the questions are asked in: which reading is heard and
 * which is drawn, then how loud that melody sits, which register it plays in,
 * and whether dragging a note sounds it. The two readings come first because
 * they say what the tracks below them are — the same take, read two ways.
 *
 * Its own file so NoteDetailScreen stays composition and this list can grow
 * without the screen growing with it.
 */
import React from 'react';

import { DragAuditionControl } from './DragAuditionControl';
import { HearItAs } from './HearItAs';
import { MelodyMix } from './MelodyMix';
import { MelodyOctave } from './MelodyOctave';
import { SeeItAs } from './SeeItAs';
import type { useNoteDetail } from './useNoteDetail';

export interface PlaybackOptionsProps {
  detail: ReturnType<typeof useNoteDetail>;
}

export function PlaybackOptions({
  detail
}: PlaybackOptionsProps): React.JSX.Element {
  return (
    <>
      <HearItAs
        mode={detail.playbackMode}
        onChange={detail.setPlaybackMode}
        canNotate={detail.hasGrid}
      />
      {/* Its own choice rather than a second use of the playback one: reading
          the notation while hearing the raw take is how you tell which of the
          two is wrong (INV-NOTES-026). */}
      <SeeItAs
        view={detail.notationView}
        onChange={detail.setNotationView}
        canNotate={detail.canNotate}
      />
      <MelodyMix
        level={detail.melodyLevel}
        onLevelChange={detail.setMelodyLevel}
      />
      <MelodyOctave
        octaves={detail.octaves}
        range={detail.octaveRange}
        onShift={detail.shiftOctave}
      />
      <DragAuditionControl
        isAudible={detail.isDragAudible}
        onAudibleChange={detail.setIsDragAudible}
        level={detail.dragLevel}
        onLevelChange={detail.setDragLevel}
      />
    </>
  );
}

export default PlaybackOptions;
