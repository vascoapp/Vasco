// =============================================================================
// SUPABASE PLATFORM LOGS — Management API reader
// =============================================================================
// Supabase's platform logs (API gateway, edge functions, auth, postgres) are
// NOT in the project database — they live in a Logflare-backed analytics store
// reachable only through the Management API:
//
//   GET https://api.supabase.com/v1/projects/{ref}/analytics/endpoints/logs.all
//       ?sql=<urlencoded>&iso_timestamp_start=...&iso_timestamp_end=...
//
// The SQL dialect is BigQuery-ish: metadata is a repeated field, so every
// query has to CROSS JOIN UNNEST(metadata) before it can reach nested
// columns. Each query below was validated against the live project before
// being committed (a bogus field name returns
// {"result":null,"error":"Field ... does not exist."}, so a silent-empty
// result genuinely means "no matching log rows", not "broken query").
//
// Auth: a personal access token (sbp_...) in WATCHDOG_MGMT_TOKEN. This is a
// separate credential from the service-role key and grants org-wide read, so
// it lives only in edge-function secrets and is never returned in a response.
//
// RETENTION: the free plan keeps logs for 1 day. A 24h digest window is
// therefore the maximum useful lookback; asking for more silently returns
// only the retained slice. Paid plans extend this (7d Pro / 28d Team).
// =============================================================================

const API_BASE = 'https://api.supabase.com/v1/projects';

export interface LogQueryResult<T = Record<string, unknown>> {
  rows: T[];
  error: string | null;
}

export interface LogsConfig {
  token: string;
  projectRef: string;
}

export function readLogsConfig(): LogsConfig | null {
  // NOTE: secrets may not be named SUPABASE_* — that prefix is reserved by
  // the platform and `supabase secrets set` rejects it.
  const token = Deno.env.get('WATCHDOG_MGMT_TOKEN');
  const projectRef = Deno.env.get('WATCHDOG_PROJECT_REF');
  if (!token || !projectRef) return null;
  return { token, projectRef };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function queryOnce<T>(
  cfg: LogsConfig,
  sql: string,
  since: Date,
  until: Date,
): Promise<LogQueryResult<T> & { throttled?: boolean }> {
  const url =
    `${API_BASE}/${cfg.projectRef}/analytics/endpoints/logs.all` +
    `?sql=${encodeURIComponent(sql)}` +
    `&iso_timestamp_start=${encodeURIComponent(since.toISOString())}` +
    `&iso_timestamp_end=${encodeURIComponent(until.toISOString())}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${cfg.token}` },
    });
    const body = await res.text();
    if (!res.ok) {
      const throttled = res.status === 429 || body.includes('ThrottlerException');
      return { rows: [], error: `HTTP ${res.status}: ${body.slice(0, 200)}`, throttled };
    }
    const json = JSON.parse(body);
    if (json.error) return { rows: [], error: String(json.error).slice(0, 200) };
    return { rows: (json.result ?? []) as T[], error: null };
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * The analytics endpoint is aggressively rate-limited — six concurrent queries
 * reliably trip "ThrottlerException: Too Many Requests". Queries are therefore
 * issued sequentially with a small gap, and a throttled query is retried once
 * after a longer backoff. Slower, but the digest runs once a day and a partial
 * log section is worse than a two-second delay.
 */
async function query<T = Record<string, unknown>>(
  cfg: LogsConfig,
  sql: string,
  since: Date,
  until: Date,
): Promise<LogQueryResult<T>> {
  const first = await queryOnce<T>(cfg, sql, since, until);
  if (!first.throttled) return { rows: first.rows, error: first.error };
  await sleep(3000);
  const second = await queryOnce<T>(cfg, sql, since, until);
  return { rows: second.rows, error: second.error };
}

// --- Query definitions -------------------------------------------------------

const Q_API_TOTALS = `
select
  count(*) as total,
  countif(r.status_code >= 500) as e5xx,
  countif(r.status_code >= 400 and r.status_code < 500) as e4xx
from edge_logs
cross join unnest(metadata) as m
cross join unnest(m.response) as r`;

const Q_API_FAILING_PATHS = `
select req.path as path, r.status_code as code, count(*) as n
from edge_logs
cross join unnest(metadata) as m
cross join unnest(m.response) as r
cross join unnest(m.request) as req
where r.status_code >= 400
group by path, code
order by n desc
limit 8`;

const Q_FN_INVOCATIONS = `
select m.function_id as fn, r.status_code as code, count(*) as n
from function_edge_logs
cross join unnest(metadata) as m
cross join unnest(m.response) as r
group by fn, code
order by n desc
limit 30`;

// NOTE: selecting the top-level `timestamp` column in the SAME query as a
// `cross join unnest(metadata)` makes the analytics backend fail with
// "Backend error! Retry your query." — reproducibly, 5/5 attempts, on both
// function_logs and postgres_logs. Aliasing it does not help; only dropping it
// does. (A query selecting `timestamp` with no unnest, e.g. on edge_logs,
// works fine.) The digest only renders the message text, so no timestamp is
// selected here and rows come back unordered.
const Q_FN_ERRORS = `
select m.level as level, m.function_id as fn, event_message as msg
from function_logs
cross join unnest(metadata) as m
where m.level in ('error', 'fatal')
limit 10`;

const Q_AUTH_ERRORS = `
select m.level as level, m.status as status, m.path as path, count(*) as n
from auth_logs
cross join unnest(metadata) as m
where m.level in ('error', 'fatal', 'warning')
group by level, status, path
order by n desc
limit 10`;

const Q_PG_ERRORS = `
select p.error_severity as sev, event_message as msg, count(*) as n
from postgres_logs
cross join unnest(metadata) as m
cross join unnest(m.parsed) as p
where p.error_severity in ('ERROR', 'FATAL', 'PANIC')
group by sev, msg
order by n desc
limit 10`;

export interface PlatformLogs {
  available: boolean;
  reason?: string;
  api: { total: number; e5xx: number; e4xx: number } | null;
  failingPaths: Array<{ path: string; code: number; n: number }>;
  fnInvocations: Array<{ fn: string; code: number; n: number }>;
  fnErrors: Array<{ level: string; fn: string; msg: string }>;
  authErrors: Array<{ level: string; status: string; path: string; n: number }>;
  pgErrors: Array<{ sev: string; msg: string; n: number }>;
  errors: string[];
}

/**
 * Collect every platform-log section for the window. Each query is independent:
 * one failing source degrades that section and is reported in `errors`, rather
 * than taking the whole digest down.
 */
export async function collectPlatformLogs(
  cfg: LogsConfig,
  since: Date,
  until: Date,
): Promise<PlatformLogs> {
  // Sequential on purpose — see the note on query(). Parallel trips the throttle.
  const totals = await query<{ total: number; e5xx: number; e4xx: number }>(cfg, Q_API_TOTALS, since, until);
  const paths = await query<{ path: string; code: number; n: number }>(cfg, Q_API_FAILING_PATHS, since, until);
  const fnInv = await query<{ fn: string; code: number; n: number }>(cfg, Q_FN_INVOCATIONS, since, until);
  const fnErr = await query<{ level: string; fn: string; msg: string }>(cfg, Q_FN_ERRORS, since, until);
  const authErr = await query<{ level: string; status: string; path: string; n: number }>(cfg, Q_AUTH_ERRORS, since, until);
  const pgErr = await query<{ sev: string; msg: string; n: number }>(cfg, Q_PG_ERRORS, since, until);

  const errors = [
    totals.error && `api_totals: ${totals.error}`,
    paths.error && `failing_paths: ${paths.error}`,
    fnInv.error && `fn_invocations: ${fnInv.error}`,
    fnErr.error && `fn_errors: ${fnErr.error}`,
    authErr.error && `auth_errors: ${authErr.error}`,
    pgErr.error && `pg_errors: ${pgErr.error}`,
  ].filter(Boolean) as string[];

  return {
    available: true,
    api: totals.rows[0] ?? { total: 0, e5xx: 0, e4xx: 0 },
    failingPaths: paths.rows,
    fnInvocations: fnInv.rows,
    fnErrors: fnErr.rows,
    authErrors: authErr.rows,
    pgErrors: pgErr.rows,
    errors,
  };
}

export function unavailableLogs(reason: string): PlatformLogs {
  return {
    available: false,
    reason,
    api: null,
    failingPaths: [],
    fnInvocations: [],
    fnErrors: [],
    authErrors: [],
    pgErrors: [],
    errors: [],
  };
}
