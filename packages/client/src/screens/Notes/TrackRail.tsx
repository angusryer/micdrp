/**
 * The column riding down the left edge of the graph (INV-NOTES-142).
 *
 * It lived in a sheet reached from the top bar, which is the wrong place for
 * it: silencing a track is done WHILE listening and looking at the graph, and
 * a control that has to be opened first interrupts the thing it is for.
 *
 * Fixed beside the drawing rather than inside its scroll, so it is the same
 * distance from every part of the take. Flush against it, because the two are
 * one instrument — a gap would read as two panels and the rail would stop
 * being the graph's edge and start being a sidebar.
 *
 * Three pieces, and this file is only the column that holds them: RailSwitches,
 * the mutes and the grid, which give way and scroll (INV-NOTES-233);
 * RailBelow, the door onto what governs the graph (INV-NOTES-229), the
 * question mark that says what all of this means (INV-NOTES-232), and the
 * rewind; and RailFoot, where the take is played from (INV-NOTES-227). The
 * column's colour turns right along the bottom to hold that foot, so it reads
 * as the graph's edge continuing rather than a control dropped on the drawing.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { RailFoot, RAIL_FOOT_HEIGHT, type RailFootProps } from './RailFoot';
import { RailBelow } from './RailBelow';
import { RailSwitches } from './RailSwitches';
import { useTheme } from '../../theme';
import { type PlaybackMix, type TrackName } from './playbackTracks';

/** How wide the rail is. Enough for a thumb, and no more than the graph can spare. */
export const TRACK_RAIL_WIDTH = 38;

export interface TrackRailProps {
  /** Which tracks this note has, in the order they are drawn. */
  tracks: readonly TrackName[];
  mix: PlaybackMix;
  height: number;
  onToggle: (track: TrackName, isAudible: boolean) => void;
  /** Whether an edit lands on the grid (INV-NOTES-143). */
  isSnapping: boolean;
  onSnapping: (snap: boolean) => void;
  /** Open what governs the graph from outside it (INV-NOTES-229). */
  onMenu?: () => void;
  /** Say what every mark on this column means (INV-NOTES-232). */
  onHelp?: () => void;
  /** Back to the beginning, directly above the play control. */
  onRewind?: () => void;
  /** The take, played from the foot of the column (INV-NOTES-227). */
  transport?: RailFootProps | null;
}

export function TrackRail({
  tracks,
  mix,
  height,
  onToggle,
  isSnapping,
  onSnapping,
  onMenu,
  onHelp,
  onRewind,
  transport
}: TrackRailProps): React.JSX.Element | null {
  const { colors } = useTheme();
  if (tracks.length === 0) {
    return null;
  }

  return (
    <View
      testID="track-rail"
      style={[
        styles.rail,
        {
          width: TRACK_RAIL_WIDTH,
          height,
          backgroundColor: colors.neutral100,
          // Room for the foot, which is drawn out of the flow.
          paddingBottom: transport != null ? RAIL_FOOT_HEIGHT : 6
        }
      ]}
    >
      {/* The one part of the column that gives way, in whatever room the
          graph's height leaves it (INV-NOTES-233). Nothing below it scrolls:
          the menu opens level with a fixed distance up from the foot
          (INV-NOTES-229) and the transport is at the graph's foot and nowhere
          else (INV-NOTES-227), and either one scrolled out of place would
          make both of those promises false. */}
      <RailSwitches
        tracks={tracks}
        mix={mix}
        onToggle={onToggle}
        isSnapping={isSnapping}
        onSnapping={onSnapping}
      />

      <RailBelow onMenu={onMenu} onHelp={onHelp} onRewind={onRewind} />

      {transport != null ? <RailFoot {...transport} /> : null}
    </View>
  );
}

export default TrackRail;

const styles = StyleSheet.create({
  // No radius on the right and no margin: it meets the drawing exactly.
  //
  // Raised over the drawing, because the foot reaches out past the column
  // and the drawing is painted after it. Without this the take's transport
  // is behind the graph and cannot be pressed at all.
  rail: {
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    paddingVertical: 6,
    alignItems: 'center',
    gap: 2,
    zIndex: 1,
    elevation: 1
  }
});
