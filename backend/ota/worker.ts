/**
 * The update server. One Worker, one D1 table, archives in R2.
 *
 * It answers exactly one question — given a binary and the bundle it is
 * running, what should it do next. The rules behind that answer are NOT here:
 * they live in `packages/shared/src/dto/updateBundle.ts`, so they are covered
 * by the ordinary test suite and written down once. This file fetches the
 * channel's bundles, hands them to `decideUpdate`, and translates the result
 * into the shape hot-updater's client expects.
 *
 * It is deliberately not part of the PocketBase instance on fly.io: that
 * deployment is single-machine SQLite by constraint, and serving bundle
 * downloads through it buys nothing.
 *
 * Only iOS is served. Android eligibility has no equivalent of the receipt
 * check the client gates on, so it is out of scope until it gets a decision of
 * its own — and serving it bundles it cannot gate would be worse than not
 * serving it at all.
 *
 * Spec: .harnex/project/specs/domains/updates/
 */
import {
  decideUpdate,
  NIL_BUNDLE_ID,
  type UpdateBundleDto,
  type UpdateClientDto
} from 'shared';

export interface Env {
  DB: D1Database;
  BUNDLES: R2Bucket;
  /** Public origin the bundle archives are served from. */
  BUNDLE_BASE_URL: string;
}

/**
 * A row of hot-updater's own `bundles` table.
 *
 * The schema is theirs (see `backend/ota/README.md`): their CLI builds the
 * archive, uploads it to R2 and inserts the row, and reimplementing any of
 * that would be reimplementing the one part of this that is genuinely fiddly.
 *
 * `min_build_number` is the one thing their schema has no column for, so
 * `yarn ota publish` stamps it into `metadata` after the deploy.
 */
type BundleRow = {
  id: string;
  channel: string;
  target_app_version: string | null;
  file_hash: string;
  storage_uri: string;
  enabled: number;
  metadata: string | null;
};

/** The lowest BUILD_NUMBER this bundle may run on, or 0 if never stamped. */
function minBuildNumber(row: BundleRow): number {
  try {
    const parsed = JSON.parse(row.metadata ?? '{}') as Record<string, unknown>;
    const value = Number(parsed.min_build_number);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

/** hot-updater's answer shape. `null` means nothing to do. */
type UpdateInfo = {
  id: string;
  status: 'UPDATE' | 'ROLLBACK';
  fileUrl: string | null;
  fileHash: string | null;
  shouldForceUpdate: boolean;
  message: string | null;
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

const toDto = (row: BundleRow, publicBase: string): UpdateBundleDto => ({
  bundleId: row.id,
  channel: row.channel,
  targetAppVersion: row.target_app_version ?? '',
  minBuildNumber: minBuildNumber(row),
  // storage_uri is an r2:// address; the client needs something it can fetch.
  fileUrl: `${publicBase}/${row.storage_uri.replace(/^r2:\/\//, '')}`,
  fileHash: row.file_hash,
  isEnabled: row.enabled === 1
});

/**
 * Every bundle on the channel.
 *
 * The filtering happens in `decideUpdate` rather than in SQL so that the rules
 * have exactly one home. A beta channel holds a handful of rows, so reading
 * them all costs nothing worth the duplication.
 */
async function channelBundles(
  env: Env,
  channel: string
): Promise<UpdateBundleDto[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, channel, target_app_version, file_hash, storage_uri,
            enabled, metadata
       FROM bundles
      WHERE channel = ?1 AND platform = 'ios'`
  )
    .bind(channel)
    .all<BundleRow>();

  const base = env.BUNDLE_BASE_URL.replace(/\/$/, '');
  return (results ?? []).map((row) => toDto(row, base));
}

function toUpdateInfo(
  decision: ReturnType<typeof decideUpdate>
): UpdateInfo | null {
  if (decision.decision === 'none') {
    return null;
  }
  return {
    id: decision.bundleId ?? NIL_BUNDLE_ID,
    status: decision.decision === 'update' ? 'UPDATE' : 'ROLLBACK',
    fileUrl: decision.fileUrl,
    fileHash: decision.fileHash,
    // The singer is always asked; nothing this server says can force a reload.
    shouldForceUpdate: false,
    message: null
  };
}

async function handleCheck(request: Request, env: Env): Promise<Response> {
  let body: Partial<UpdateClientDto>;
  try {
    body = await request.json<Partial<UpdateClientDto>>();
  } catch {
    return json({ error: 'malformed request' }, 400);
  }
  if (!body.channel || !body.appVersion) {
    return json({ error: 'channel and appVersion are required' }, 400);
  }

  // This is untrusted input feeding a numeric comparison that decides whether
  // a binary may run a bundle. A non-numeric buildNumber must not read as
  // "high enough" — coercing to 0 fails closed.
  const client: UpdateClientDto = {
    channel: body.channel,
    appVersion: body.appVersion,
    buildNumber: Number(body.buildNumber) || 0,
    bundleId: body.bundleId ?? NIL_BUNDLE_ID
  };

  const bundles = await channelBundles(env, client.channel);
  return json(toUpdateInfo(decideUpdate(bundles, client)));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/check') {
      return handleCheck(request, env);
    }

    return json({ error: 'not found' }, 404);
  }
} satisfies ExportedHandler<Env>;
