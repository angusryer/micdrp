/**
 * Turning a clip into the requests in it.
 *
 * Split from loop.ts, which owns what happens to those requests afterwards.
 * This is the listening and the reading.
 */
import type PocketBase from 'pocketbase';

// Imported by file rather than through the `shared` barrel: Node's ESM loader
// needs explicit extensions.
import type { ChangeRequestDto } from '../../packages/shared/src/dto/dogfood.ts';

import { audioUrl, storeTitle, storeTranscript, type Clip } from './clips.ts';
import { interpret } from './interpret.ts';
import type { Report } from './progress.ts';
import { transcribe } from './transcribe.ts';

export /**
 * Hear a clip and read it, paying for each at most once.
 *
 * Both halves are kept: a re-run must not transcribe the same audio again
 * (INV-DOG-013), and a run reclaimed after it died mid-build already has its
 * requests — re-reading the same words would cost again and could land on a
 * different split of them (INV-DOG-016).
 */
async function understand(
  pb: PocketBase,
  clip: Clip,
  report: Report
): Promise<ChangeRequestDto[]> {
  let transcript = clip.transcript;
  if (!transcript) {
    await report('transcribing', 'listening');
    const heard = await transcribe(audioUrl(pb, clip));
    transcript = heard.text;
    await storeTranscript(pb, clip.id, heard.text, heard.confidence);
  }

  if (clip.requests?.length) {
    return clip.requests;
  }

  await report('interpreting', 'reading it');
  const reading = await interpret(transcript, clip.screen_trail ?? []);
  // A name for the remark, so the queue reads as a list of things rather than
  // a list of transcripts.
  await storeTitle(pb, clip.id, reading.title);
  return reading.requests.map((r, i) => ({
    ...r,
    id: `${clip.id}-${i}`,
    clipId: clip.id,
    state: 'proposed'
  }));
}
