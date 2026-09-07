/**
 * Which take a turn of a knob applies to (INV-NOTES-217).
 *
 * The same panel is drawn in two places, and it must not quietly mean two
 * different things. Beside a take it is being turned while listening to that
 * take, so that is what it changes. On the account screen there is no take
 * to mean, so it changes where a new one starts.
 *
 * A control whose scope depends on where it happens to be drawn, and does
 * not say so, is worse than two controls. This is the one place that decides
 * it, so the panel reads a scope rather than knowing about takes at all.
 */
import type { ReadingKnob } from './readingKnobs';
import { knobValue, resetKnobs, setKnobValue } from './readingValues';
import { resetTakeKnobs, setTakeKnobValue, takeKnobValue } from './takeKnobs';

export interface KnobScope {
  value: (knob: ReadingKnob) => number;
  set: (knob: ReadingKnob, value: number) => void;
  /** Put everything in scope back: this take, or the app-wide numbers. */
  reset: () => void;
  /** What turning a knob here will change, said in the panel. */
  says: string;
  /** The label on the control that undoes it all. */
  resetSays: string;
}

/** Beside a take, or app-wide where there is no take to mean. */
export function knobScope(noteId?: string | null): KnobScope {
  if (noteId == null || noteId.length === 0) {
    return {
      value: knobValue,
      set: (knob, value) => void setKnobValue(knob, value),
      reset: resetKnobs,
      says: 'These are where a new take starts. Takes already read keep the settings they were read with.',
      resetSays: 'Back to defaults'
    };
  }
  return {
    value: (knob) => takeKnobValue(noteId, knob),
    set: (knob, value) => void setTakeKnobValue(noteId, knob, value),
    reset: () => resetTakeKnobs(noteId),
    says: 'These apply to this take only. Read it again to hear them.',
    resetSays: 'Back to the app settings'
  };
}
