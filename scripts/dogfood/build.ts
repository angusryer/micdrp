/**
 * Turning gated requests into built ones.
 *
 * Split from loop.ts, which owns claiming a clip and delivering what comes
 * out. This is the middle: for each request, decide, build, verify, keep.
 */
// Imported by file rather than through the `shared` barrel: Node's ESM
// loader needs explicit extensions.
import { gateRequest, type ChangeRequestDto } from '../../packages/shared/src/dto/dogfood.ts';

import { executeRequest } from './execute.ts';
import type { Report } from './progress.ts';
import { checkpoint } from './tree.ts';

/**
 * Build every request that the gate allows, in order.
 *
 * Mutates each request's state as it goes — the caller stores the whole set
 * afterwards, so a run that dies still leaves a record of how far it got.
 */
export async function buildRequests(
  requests: ChangeRequestDto[],
  dryRun: boolean,
  report?: Report,
  stillWanted?: () => Promise<boolean>
): Promise<ChangeRequestDto[]> {
  const buildable = requests.filter((r) => gateRequest(r).mayBuild);
  let attempted = 0;
  const built: ChangeRequestDto[] = [];
  for (const request of requests) {
    // A resumed clip must not build again what it already shipped. Its
    // change is in main; repeating it is at best a no-op and at worst a
    // second, conflicting edit (INV-DOG-016).
    if (request.state === 'delivered' || request.state === 'filed') {
      continue;
    }
    const verdict = gateRequest(request);
    if (!verdict.mayBuild) {
      request.state = 'filed';
      console.log(`  filed: ${request.summary} (${verdict.reason})`);
      continue;
    }
    if (dryRun) {
      console.log(`  would build (${verdict.route}): ${request.summary}`);
      continue;
    }
    // Asked between requests, not only at the end. A clip carrying four of
    // them is half an hour of work, and building all of it for a remark
    // somebody has already discarded is the same waste either way
    // (INV-DOG-026).
    // eslint-disable-next-line no-await-in-loop -- one change at a time, by design
    if (stillWanted && !(await stillWanted())) {
      break;
    }

    // Reported per request: a clip carrying four of them should move the bar
    // four times rather than sit at one number for twenty minutes.
    // eslint-disable-next-line no-await-in-loop -- one change at a time, by design
    await report?.('building', `building ${attempted + 1} of ${buildable.length}`, attempted, buildable.length);
    attempted += 1;
    // eslint-disable-next-line no-await-in-loop -- one change at a time, by design
    const outcome = await executeRequest(request);
    if (!outcome.built) {
      request.state = 'abandoned';
      console.log(`  abandoned: ${request.summary} (${outcome.reason})`);
      continue;
    }
    request.state = 'built';
    built.push(request);
    // Kept now so the next request starts clean and a later failure cannot
    // reset this one away (INV-DOG-009).
    // eslint-disable-next-line no-await-in-loop -- one change at a time, by design
    await checkpoint(request.summary);
  }
  return built;
}
