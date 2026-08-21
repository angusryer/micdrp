/**
 * Watching the feedback queue while the screen is open.
 *
 * Polled rather than pushed: a run takes minutes, so a few seconds of
 * staleness costs nothing, and the alternative is a live connection to
 * maintain for a screen that is open for a minute at a time.
 *
 * Polling stops when the screen goes away.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { feedbackQueue, type QueuedClip } from './queue';

/** Often enough to feel live, rare enough to be free. */
const POLL_MS = 5000;

export interface FeedbackQueue {
  clips: QueuedClip[];
  isLoading: boolean;
  /** Set when the last read failed; the previous list is kept meanwhile. */
  error: string | null;
  refresh: () => void;
}

export function useFeedbackQueue(): FeedbackQueue {
  const [clips, setClips] = useState<QueuedClip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  const read = useCallback(async () => {
    try {
      const next = await feedbackQueue();
      if (alive.current) {
        setClips(next);
        setError(null);
      }
    } catch {
      // The list already on screen stays: a moment offline should not blank
      // out what was there a second ago.
      if (alive.current) {
        setError('Could not reach the backend');
      }
    } finally {
      if (alive.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void read();
    const timer = setInterval(() => void read(), POLL_MS);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, [read]);

  return { clips, isLoading, error, refresh: useCallback(() => void read(), [read]) };
}
