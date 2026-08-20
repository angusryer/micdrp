/**
 * How a batch is described — to git history, and to the maintainer's log.
 *
 * Split from deliver.ts, which owns the delivering. Wording lives here
 * because it is the part a human actually reads.
 */
// Imported by file rather than through the `shared` barrel: Node's ESM
// loader needs explicit extensions.
import type { ChangeRequestDto } from '../../packages/shared/src/dto/dogfood.ts';
import type { DeliveryOutcome } from './deliver.ts';

export function commitMessage(batch: ChangeRequestDto[]): string {
  const subject =
    batch.length === 1
      ? batch[0].summary
      : `apply ${batch.length} spoken change requests`;

  const body = batch
    .map((r) => `- ${r.summary}\n  heard as: "${r.quote}"`)
    .join('\n');

  return (
    `feat(dogfood): ${subject.charAt(0).toLowerCase()}${subject.slice(1)}\n\n` +
    `Built from spoken feedback, unattended. The maintainer's own words are\n` +
    `quoted so a misreading is visible as a misreading rather than hidden\n` +
    `behind a paraphrase.\n\n${body}\n\n` +
    `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>\n`
  );
}

/** One line saying what became of a pass, for the maintainer's log. */
export function describeOutcome(
  outcome: DeliveryOutcome,
  requestCount: number,
  builtCount: number
): string {
  const ending =
    outcome.route === 'testflight'
      ? 'shipped to TestFlight — install it when the email arrives'
      : outcome.published
        ? 'published over the air'
        : outcome.pushed
          ? 'committed to main; not yet on the device'
          : 'nothing delivered';
  return `dogfood: ${requestCount} request(s), ${builtCount} built, ${ending}`;
}
