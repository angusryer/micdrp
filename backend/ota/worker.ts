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
  r2ObjectKey,
  type UpdateBundleDto,
  type UpdateClientDto
} from 'shared';

export interface Env {
  DB: D1Database;
  BUNDLES: R2Bucket;
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

/** One number out of the row's metadata, or undefined when absent. */
function metaNumber(row: BundleRow, key: string): number | undefined {
  try {
    const parsed = JSON.parse(row.metadata ?? '{}') as Record<string, unknown>;
    const value = Number(parsed[key]);
    return Number.isFinite(value) ? value : undefined;
  } catch {
    return undefined;
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

const toDto = (row: BundleRow, origin: string): UpdateBundleDto => ({
  bundleId: row.id,
  channel: row.channel,
  targetAppVersion: row.target_app_version ?? '',
  minBuildNumber: metaNumber(row, 'min_build_number') ?? 0,
  builtFromBuild: metaNumber(row, 'built_from_build'),
  // Archives are served back through this Worker rather than from a public
  // bucket. The bucket stays private, there is no r2.dev origin or custom
  // domain to configure, and the download URL is the same host the client
  // already asked — one fewer value to get wrong.
  fileUrl: `${origin}/bundle/${r2ObjectKey(row.storage_uri)}`,
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
  channel: string,
  origin: string
): Promise<UpdateBundleDto[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, channel, target_app_version, file_hash, storage_uri,
            enabled, metadata
       FROM bundles
      WHERE channel = ?1 AND platform = 'ios'`
  )
    .bind(channel)
    .all<BundleRow>();

  return (results ?? []).map((row) => toDto(row, origin));
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

/**
 * Stream a bundle archive out of the private bucket.
 *
 * Unauthenticated on purpose: the archive is the same JavaScript already
 * inside the app, its integrity is established by the hash the client verifies
 * natively, and requiring a credential here would mean shipping one in the
 * binary — where it could be read straight back out.
 */
async function handleBundle(key: string, env: Env): Promise<Response> {
  const object = await env.BUNDLES.get(key);
  if (!object) {
    return json({ error: 'not found' }, 404);
  }
  return new Response(object.body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      // Bundle ids are immutable, so the archive behind one never changes.
      'Cache-Control': 'public, max-age=31536000, immutable',
      etag: object.httpEtag
    }
  });
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
    bundleId: body.bundleId ?? NIL_BUNDLE_ID,
    minBundleId: body.minBundleId
  };

  const origin = new URL(request.url).origin;
  const bundles = await channelBundles(env, client.channel, origin);
  return json(toUpdateInfo(decideUpdate(bundles, client)));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/check') {
      return handleCheck(request, env);
    }

    if (request.method === 'GET' && url.pathname.startsWith('/bundle/')) {
      return handleBundle(
        decodeURIComponent(url.pathname.slice('/bundle/'.length)),
        env
      );
    }

    return json({ error: 'not found' }, 404);
  }
} satisfies ExportedHandler<Env>;
