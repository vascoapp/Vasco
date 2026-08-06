// =============================================================================
// WATCHDOG-DAILY — Supabase Edge Function
// =============================================================================
// Posts one operator digest to Telegram every morning at 09:00 Europe/Amsterdam
// covering the last 24 hours:
//
//   1. Supabase platform logs — API gateway 4xx/5xx, edge-function invocations
//      and failures, auth errors, postgres ERROR/FATAL. Read via the
//      Management API (these logs are not in the project database).
//   2. Paying customers — the good (converted, upgraded, renewed, recovered,
//      cash collected) and the bad (churned, past due, downgraded, trials
//      lapsing with no payment method, paying users gone silent).
//   3. Backend / app signals — signups, activity, jobs, quotes, invoices,
//      EVE queue outcomes, push delivery failures.
//   4. Automation analysis — every vasco-* pg_cron schedule: did it run in the
//      window, did it succeed, and is the watchdog itself healthy (it logs its
//      own runs so it can report a missed or failed previous run).
//
// Design rules, learned from monitoring that lies:
//   * Never fail silently. Every section that cannot be collected is listed
//     explicitly as DEGRADED in the message. A missing section must never
//     render as a reassuring zero.
//   * Never let one bad source kill the digest. Platform logs, DB snapshot
//     and cron health are collected independently.
//   * Always deliver something. If collection fails outright, the failure
//     itself is what gets sent to Telegram.
//
// DST: pg_cron runs in UTC, so a fixed UTC schedule drifts an hour twice a
// year. The cron entry fires at BOTH 07:00 and 08:00 UTC and this function
// no-ops unless it is actually 09:00 in Europe/Amsterdam — correct in both
// CET and CEST with no seasonal edit.
//
// Modes (query params):
//   ?dry=1    build and return the message as JSON, send nothing
//   ?force=1  bypass the 09:00-local gate (manual / ad-hoc run)
//
// Secrets required:
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID   delivery
//   WATCHDOG_MGMT_TOKEN, WATCHDOG_PROJECT_REF   platform logs (optional)
//   ANTHROPIC_API_KEY / MOONSHOT_API_KEY   LLM narrative (optional)
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { esc, readTelegramConfig, sendTelegram } from '../_shared/telegram.ts';
import {
  checkLlmKey,
  type LlmKeyStatus,
  collectPlatformLogs,
  readLogsConfig,
  unavailableLogs,
  type PlatformLogs,
} from '../_shared/supabaseLogs.ts';
import { chat } from '../_shared/llm.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TZ = 'Europe/Amsterdam';
const TARGET_HOUR = 9;
const WINDOW_HOURS = 24;
// Anything older than this means a run was skipped entirely (schedule
// unregistered, project paused, function failing to boot).
const MISSED_RUN_THRESHOLD_H = 26;

type Severity = 'ok' | 'warn' | 'critical';

interface Issue {
  severity: Severity;
  text: string;
}

// --- helpers -----------------------------------------------------------------

function localHour(d: Date, tz: string): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', hour12: false })
      .format(d),
  );
}

function fmtLocal(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(d);
}

function eur(n: unknown): string {
  const v = Number(n ?? 0);
  return `€${v.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** A section that failed to collect returns { error }. Treat it as unknown. */
function sectionOk(s: unknown): s is Record<string, unknown> {
  return !!s && typeof s === 'object' && !('error' in (s as Record<string, unknown>));
}

// --- cron analysis -----------------------------------------------------------

interface CronRow {
  jobname: string;
  schedule: string;
  active: boolean;
  status: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_ms: number | null;
  message: string | null;
}

interface CronJobSummary {
  jobname: string;
  schedule: string;
  active: boolean;
  runs: number;
  failures: number;
  lastStatus: string | null;
  lastStart: string | null;
  lastMessage: string | null;
}

function summariseCron(rows: CronRow[]): CronJobSummary[] {
  const byJob = new Map<string, CronJobSummary>();
  for (const r of rows) {
    let s = byJob.get(r.jobname);
    if (!s) {
      s = {
        jobname: r.jobname, schedule: r.schedule, active: r.active,
        runs: 0, failures: 0, lastStatus: null, lastStart: null, lastMessage: null,
      };
      byJob.set(r.jobname, s);
    }
    // The RPC LEFT JOINs, so a job with no runs in the window yields one row
    // with null status. Don't count that as a run.
    if (!r.start_time) continue;
    s.runs++;
    if (r.status && r.status !== 'succeeded') s.failures++;
    if (!s.lastStart || r.start_time > s.lastStart) {
      s.lastStart = r.start_time;
      s.lastStatus = r.status;
      s.lastMessage = r.message;
    }
  }
  return [...byJob.values()].sort((a, b) => a.jobname.localeCompare(b.jobname));
}

/**
 * A daily job that did not run in a 24h window is a real failure; a weekly one
 * legitimately sits idle six days out of seven. Parse the day-of-week field so
 * we only alarm on schedules that were actually due.
 */
function isDailySchedule(schedule: string): boolean {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length < 5) return false;
  return parts[4] === '*' && parts[2] === '*';
}

// --- message composition -----------------------------------------------------

function buildMessage(args: {
  now: Date;
  since: Date;
  snapshot: Record<string, unknown>;
  snapshotError: string | null;
  logs: PlatformLogs;
  cron: CronJobSummary[];
  cronError: string | null;
  issues: Issue[];
  severity: Severity;
  narrative: string | null;
  narrativeSource: string;
  degraded: string[];
}): string {
  const {
    now, since, snapshot, snapshotError, logs, cron, cronError,
    issues, severity, narrative, narrativeSource, degraded,
  } = args;

  const icon = severity === 'critical' ? '🔴' : severity === 'warn' ? '🟠' : '🟢';
  const L: string[] = [];

  L.push(`${icon} <b>VASCO WATCHDOG</b> — ${esc(fmtLocal(now))}`);
  L.push(`<i>window: ${esc(fmtLocal(since))} → ${esc(fmtLocal(now))} (${WINDOW_HOURS}h)</i>`);

  // ---- headline -------------------------------------------------------------
  if (issues.length === 0) {
    L.push('');
    L.push('All clear — no errors, no billing problems, all automations ran.');
  } else {
    L.push('');
    L.push('<b>⚠️ NEEDS ATTENTION</b>');
    for (const i of issues.slice(0, 12)) {
      L.push(`${i.severity === 'critical' ? '🔴' : '🟠'} ${esc(i.text)}`);
    }
    if (issues.length > 12) L.push(`<i>…and ${issues.length - 12} more</i>`);
  }

  // ---- paying customers -----------------------------------------------------
  L.push('');
  L.push('━━━━━━━━━━━━━━━━━━━━');
  L.push('<b>💰 PAYING CUSTOMERS</b>');

  const subs = snapshot.subs;
  const chg = snapshot.sub_changes;

  if (sectionOk(subs)) {
    const byTier = (subs.by_tier ?? {}) as Record<string, number>;
    const tierStr = Object.keys(byTier).length
      ? Object.entries(byTier).map(([t, n]) => `${t} ${n}`).join(' · ')
      : 'none';
    L.push(`Paying now: <b>${num(subs.paying_active)}</b>  (${esc(tierStr)})`);
    L.push(`Trialing: ${num(subs.trialing)} · Past due: ${num(subs.past_due)} · Canceled: ${num(subs.canceled)} · Expired: ${num(subs.expired)}`);
  } else {
    L.push('⚠️ subscription standing UNAVAILABLE');
  }

  if (sectionOk(chg)) {
    L.push('');
    L.push('<b>Good (24h)</b>');
    L.push(`✅ New paid: ${num(chg.new_paid)} · Trial→paid: ${num(chg.trial_converted)} · Upgrades: ${num(chg.upgraded)} · Recovered from past-due: ${num(chg.recovered)}`);
    L.push('<b>Bad (24h)</b>');
    L.push(`❌ Churned: ${num(chg.churned)} · Went past-due: ${num(chg.went_past_due)} · Downgraded to free: ${num(chg.downgraded_to_free)}`);
    if (num(chg.audit_rows_total) === 0) {
      L.push('<i>ℹ️ Change tracking just went live — these counts stay at 0 until the first real subscription change is recorded. They are not yet evidence of stability.</i>');
    }
  } else {
    L.push('⚠️ subscription change history UNAVAILABLE');
  }

  if (sectionOk(subs)) {
    const cliff = num(subs.ending_3d);
    const trialCliff = num(subs.trials_ending_3d_no_provider);
    const zombie = num(subs.active_but_expired_period);
    if (cliff || trialCliff || zombie) {
      L.push('<b>Watch</b>');
      if (cliff) L.push(`⏳ ${cliff} paid period(s) end within 3 days`);
      if (trialCliff) L.push(`⏳ ${trialCliff} trial(s) end within 3 days with no payment provider attached`);
      if (zombie) L.push(`🩸 ${zombie} marked active but period already expired (unbilled access)`);
    }
  }

  const risk = snapshot.risk;
  if (sectionOk(risk) && num(risk.paying_silent_14d) > 0) {
    L.push(`😶 ${num(risk.paying_silent_14d)} paying user(s) with zero activity in 14 days — churn risk`);
  }

  // ---- money ----------------------------------------------------------------
  const money = snapshot.money;
  L.push('');
  L.push('━━━━━━━━━━━━━━━━━━━━');
  L.push('<b>🧾 CASH &amp; DOCUMENTS (24h)</b>');
  if (sectionOk(money)) {
    L.push(`Paid: ${num(money.paid_24h_count)} invoices · <b>${esc(eur(money.paid_24h_amount))}</b>`);
    L.push(`Sent: ${num(money.sent_24h)} invoices · Quotes: ${num(money.quotes_24h)} created, ${num(money.quotes_sent_24h)} sent`);
    L.push(`Open: ${num(money.open_count)} · ${esc(eur(money.open_amount))}`);
    L.push(`Overdue: <b>${num(money.overdue_count)}</b> · ${esc(eur(money.overdue_amount))}`);
  } else {
    L.push('⚠️ UNAVAILABLE');
  }

  // ---- app / backend --------------------------------------------------------
  const users = snapshot.users;
  const act = snapshot.activity;
  L.push('');
  L.push('━━━━━━━━━━━━━━━━━━━━');
  L.push('<b>📱 APP BACKEND (24h)</b>');
  if (sectionOk(users)) {
    L.push(`Users: ${num(users.total)} total · +${num(users.new_24h)} new · ${num(users.unconfirmed_24h)} of those unconfirmed`);
  }
  if (sectionOk(act)) {
    L.push(`Active users: ${num(act.active_users_24h)} · Events: ${num(act.events_24h)}`);
    L.push(`Jobs: +${num(act.jobs_24h)} · Customers: +${num(act.customers_24h)}`);
    const top = (act.top_events ?? {}) as Record<string, number>;
    const topStr = Object.entries(top).slice(0, 5).map(([k, v]) => `${k} ${v}`).join(' · ');
    if (topStr) L.push(`Top events: ${esc(topStr)}`);
  }
  const eve = snapshot.eve;
  if (sectionOk(eve) && num(eve.total_24h) > 0) {
    const byOutcome = (eve.by_outcome ?? {}) as Record<string, number>;
    L.push(`EVE queue: ${Object.entries(byOutcome).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  }
  const push = snapshot.push;
  if (sectionOk(push) && num(push.sent_24h) > 0) {
    L.push(`Push: ${num(push.sent_24h)} sent · ${num(push.failed_24h)} failed`);
  }
  if (snapshotError) L.push(`⚠️ snapshot error: ${esc(snapshotError)}`);

  // ---- platform logs --------------------------------------------------------
  L.push('');
  L.push('━━━━━━━━━━━━━━━━━━━━');
  L.push('<b>🗂 SUPABASE LOGS (24h)</b>');
  if (!logs.available) {
    L.push(`⚠️ NOT COLLECTED — ${esc(logs.reason ?? 'unknown')}`);
  } else {
    if (logs.api) {
      L.push(`API: ${num(logs.api.total)} requests · ${num(logs.api.e4xx)} 4xx · <b>${num(logs.api.e5xx)} 5xx</b>`);
    }
    if (logs.failingPaths.length) {
      L.push('Top failing routes:');
      for (const p of logs.failingPaths.slice(0, 5)) {
        L.push(`  ${p.code} × ${p.n} — ${esc(p.path)}`);
      }
    }
    if (logs.fnInvocations.length) {
      const total = logs.fnInvocations.reduce((a, b) => a + num(b.n), 0);
      const failed = logs.fnInvocations
        .filter((f) => num(f.code) >= 400)
        .reduce((a, b) => a + num(b.n), 0);
      L.push(`Edge functions: ${total} invocations · ${failed} non-2xx`);
      for (const f of logs.fnInvocations.filter((f) => num(f.code) >= 400).slice(0, 5)) {
        L.push(`  ${esc(f.fn)} → ${f.code} × ${f.n}`);
      }
    } else {
      L.push('Edge functions: no invocations logged');
    }
    if (logs.fnErrors.length) {
      L.push('Function errors:');
      for (const e of logs.fnErrors.slice(0, 4)) {
        L.push(`  <code>${esc(String(e.msg).slice(0, 140))}</code>`);
      }
    }
    if (logs.authErrors.length) {
      L.push('Auth problems:');
      for (const a of logs.authErrors.slice(0, 4)) {
        L.push(`  ${esc(a.level)} ${esc(a.status ?? '')} ${esc(a.path ?? '')} × ${a.n}`);
      }
    }
    if (logs.pgErrors.length) {
      L.push('Postgres errors:');
      for (const p of logs.pgErrors.slice(0, 4)) {
        L.push(`  ${esc(p.sev)} × ${p.n} — <code>${esc(String(p.msg).slice(0, 120))}</code>`);
      }
    }
    if (!logs.failingPaths.length && !logs.fnErrors.length && !logs.pgErrors.length && !logs.authErrors.length) {
      L.push('No errors logged. 👌');
    }
    for (const e of logs.errors) L.push(`⚠️ ${esc(e)}`);
  }

  // ---- automation analysis --------------------------------------------------
  L.push('');
  L.push('━━━━━━━━━━━━━━━━━━━━');
  L.push('<b>⚙️ AUTOMATION HEALTH</b>');
  if (cronError) {
    L.push(`⚠️ cron health UNAVAILABLE — ${esc(cronError)}`);
  } else if (!cron.length) {
    L.push('🔴 No vasco-* schedules registered at all — every automation is dead.');
  } else {
    const failing = cron.filter((c) => c.failures > 0);
    const idleDaily = cron.filter((c) => c.runs === 0 && isDailySchedule(c.schedule) && c.active);
    const inactive = cron.filter((c) => !c.active);
    L.push(`${cron.length} schedules · ${cron.filter((c) => c.runs > 0).length} ran · ${failing.length} with failures`);
    for (const c of failing.slice(0, 6)) {
      L.push(`🔴 ${esc(c.jobname)} — ${c.failures}/${c.runs} failed`);
      if (c.lastMessage) L.push(`   <code>${esc(c.lastMessage.slice(0, 120))}</code>`);
    }
    for (const c of idleDaily.slice(0, 6)) L.push(`🟠 ${esc(c.jobname)} — daily, but did not run`);
    for (const c of inactive.slice(0, 6)) L.push(`🟠 ${esc(c.jobname)} — DISABLED`);
    if (!failing.length && !idleDaily.length && !inactive.length) {
      L.push('All schedules healthy. 👌');
    }
  }

  // watchdog self-check
  const prev = snapshot.previous_run as Record<string, unknown> | undefined;
  if (prev && prev.ran_at) {
    const prevAt = new Date(String(prev.ran_at));
    const ageH = (now.getTime() - prevAt.getTime()) / 3_600_000;
    if (ageH > MISSED_RUN_THRESHOLD_H) {
      L.push(`🟠 Watchdog itself: previous run was ${Math.round(ageH)}h ago — a run was missed.`);
    } else {
      L.push(`Watchdog itself: last ran ${esc(fmtLocal(prevAt))} (${prev.delivered ? 'delivered' : 'NOT delivered'}).`);
    }
  } else {
    L.push('Watchdog itself: this is the first recorded run.');
  }

  if (degraded.length) {
    L.push(`🟠 DEGRADED sections (data missing, not zero): ${esc(degraded.join(', '))}`);
  }

  // ---- narrative ------------------------------------------------------------
  if (narrative) {
    L.push('');
    L.push('━━━━━━━━━━━━━━━━━━━━');
    L.push('<b>🧠 ANALYSIS</b>');
    L.push(esc(narrative));
    L.push(`<i>— ${esc(narrativeSource)}</i>`);
  }

  return L.join('\n');
}

// --- issue detection ---------------------------------------------------------

function detectIssues(
  snapshot: Record<string, unknown>,
  logs: PlatformLogs,
  cron: CronJobSummary[],
  cronError: string | null,
  snapshotError: string | null,
  degraded: string[],
  now: Date,
  llmKey: LlmKeyStatus,
): Issue[] {
  const issues: Issue[] = [];
  const add = (severity: Severity, text: string) => issues.push({ severity, text });

  // Platform
  if (logs.available && logs.api && num(logs.api.e5xx) > 0) {
    add('critical', `${num(logs.api.e5xx)} server errors (5xx) on the API`);
  }
  if (logs.pgErrors.some((p) => p.sev === 'FATAL' || p.sev === 'PANIC')) {
    add('critical', 'Postgres FATAL/PANIC entries in the log');
  }
  if (logs.fnErrors.length > 0) {
    add('warn', `${logs.fnErrors.length} edge-function error log(s)`);
  }
  const fnFailed = logs.fnInvocations
    .filter((f) => num(f.code) >= 500)
    .reduce((a, b) => a + num(b.n), 0);
  if (fnFailed > 0) add('critical', `${fnFailed} edge-function invocation(s) returned 5xx`);
  if (logs.authErrors.length > 0) {
    const n = logs.authErrors.reduce((a, b) => a + num(b.n), 0);
    add('warn', `${n} auth error/warning event(s) — check signup and login`);
  }
  if (!logs.available) {
    add('warn', `Supabase platform logs not collected (${logs.reason ?? 'unknown'})`);
  }

  // Billing
  const chg = snapshot.sub_changes;
  if (sectionOk(chg)) {
    if (num(chg.churned) > 0) add('critical', `${num(chg.churned)} paying customer(s) churned`);
    if (num(chg.went_past_due) > 0) add('critical', `${num(chg.went_past_due)} payment(s) went past due`);
    if (num(chg.downgraded_to_free) > 0) add('warn', `${num(chg.downgraded_to_free)} downgrade(s) to free`);
  }
  const subs = snapshot.subs;
  if (sectionOk(subs)) {
    if (num(subs.past_due) > 0) add('critical', `${num(subs.past_due)} subscription(s) currently past due`);
    if (num(subs.active_but_expired_period) > 0) {
      add('warn', `${num(subs.active_but_expired_period)} active subscription(s) past their paid period — unbilled access`);
    }
    if (num(subs.trials_ending_3d_no_provider) > 0) {
      add('warn', `${num(subs.trials_ending_3d_no_provider)} trial(s) ending within 3 days with no payment method`);
    }
  }
  const risk = snapshot.risk;
  if (sectionOk(risk) && num(risk.paying_silent_14d) > 0) {
    add('warn', `${num(risk.paying_silent_14d)} paying user(s) inactive for 14 days`);
  }

  // Money
  const money = snapshot.money;
  if (sectionOk(money) && num(money.overdue_count) > 0) {
    add('warn', `${num(money.overdue_count)} overdue invoice(s) worth ${eur(money.overdue_amount)}`);
  }

  // Delivery
  const push = snapshot.push;
  if (sectionOk(push) && num(push.failed_24h) > 0) {
    add('warn', `${num(push.failed_24h)} push notification(s) failed to deliver`);
  }

  // AI layer — is the headline capability actually switched on?
  // CRITICAL, not warn: with no provider key, analyze-photo returns HTTP 500,
  // so a contractor photographing a job gets an error. That is a total outage
  // of the thing the product is sold on, and on 2026-08-06 it ran that way
  // unnoticed while every other metric here reported healthy.
  if (llmKey.checked && !llmKey.configured) {
    add('critical', 'No LLM provider key set — photo-to-quote, SOW drafting and the AI queue cannot run');
  } else if (!llmKey.checked && llmKey.reason) {
    add('warn', `LLM provider key not verified (${llmKey.reason})`);
  }

  // Automations
  if (cronError) add('warn', `Cron health could not be read: ${cronError}`);
  else if (!cron.length) add('critical', 'No vasco-* cron schedules registered — automations are not running');
  else {
    for (const c of cron.filter((x) => x.failures > 0)) {
      add('critical', `Automation ${c.jobname} failed ${c.failures}× in 24h`);
    }
    for (const c of cron.filter((x) => x.runs === 0 && isDailySchedule(x.schedule) && x.active)) {
      add('warn', `Automation ${c.jobname} is daily but did not run`);
    }
    for (const c of cron.filter((x) => !x.active)) {
      add('warn', `Automation ${c.jobname} is disabled`);
    }
  }

  // Self
  const prev = snapshot.previous_run as Record<string, unknown> | undefined;
  if (prev?.ran_at) {
    const ageH = (now.getTime() - new Date(String(prev.ran_at)).getTime()) / 3_600_000;
    if (ageH > MISSED_RUN_THRESHOLD_H) {
      add('warn', `Watchdog missed a run — previous was ${Math.round(ageH)}h ago`);
    }
  }

  if (snapshotError) add('critical', `Backend snapshot failed: ${snapshotError}`);
  if (degraded.length) add('warn', `Data missing for: ${degraded.join(', ')}`);

  return issues;
}

function deterministicNarrative(issues: Issue[], snapshot: Record<string, unknown>): string {
  const crit = issues.filter((i) => i.severity === 'critical');
  const warn = issues.filter((i) => i.severity === 'warn');
  const parts: string[] = [];

  if (!crit.length && !warn.length) {
    parts.push('Nothing needs you today. No platform errors, no billing regressions, all scheduled automations completed.');
  } else {
    if (crit.length) {
      parts.push(`${crit.length} item(s) need action today, starting with: ${crit[0].text}.`);
    }
    if (warn.length) {
      parts.push(`${warn.length} lower-priority item(s) to keep an eye on.`);
    }
  }

  const subs = snapshot.subs;
  const act = snapshot.activity;
  if (sectionOk(subs) && num(subs.paying_active) === 0) {
    parts.push('There are still no paying subscriptions, so the billing sections stay empty by definition rather than by health.');
  }
  if (sectionOk(act) && num(act.active_users_24h) === 0) {
    parts.push('No user activity was recorded in the window — the app backend saw no traffic at all.');
  }
  return parts.join(' ');
}

async function llmNarrative(
  snapshot: Record<string, unknown>,
  logs: PlatformLogs,
  cron: CronJobSummary[],
  issues: Issue[],
): Promise<{ text: string; source: string } | null> {
  // Aggregate counters only — no customer names, emails or ids leave the
  // project. Safe to send to a third-party provider (see _shared/pii.ts).
  const payload = {
    issues: issues.map((i) => `${i.severity}: ${i.text}`),
    subscriptions: snapshot.subs,
    subscription_changes: snapshot.sub_changes,
    money: snapshot.money,
    activity: snapshot.activity,
    users: snapshot.users,
    churn_risk: snapshot.risk,
    platform: logs.available
      ? { api: logs.api, failing_routes: logs.failingPaths, fn_errors: logs.fnErrors.length }
      : { unavailable: logs.reason },
    automations: cron.map((c) => ({ job: c.jobname, runs: c.runs, failures: c.failures, active: c.active })),
  };

  try {
    const res = await chat({
      task: 'watchdog',
      maxTokens: 400,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are the operations analyst for Vasco, a construction-trades SaaS. ' +
            'Given one day of monitoring data, write 3-5 short sentences for the founder. ' +
            'Lead with what needs action today and why it matters commercially. ' +
            'Be direct and concrete; cite the numbers you are given. ' +
            'Critically: if a metric is zero because there is no data or no traffic, say so plainly — ' +
            'never present an empty dataset as a healthy result. ' +
            'Do not invent numbers, causes or customer details not present in the input. ' +
            'Plain text only, no markdown, no headings.',
        },
        { role: 'user', content: JSON.stringify(payload) },
      ],
    });
    return { text: res.text.trim(), source: `${res.provider}/${res.model}` };
  } catch {
    return null; // no key configured, or provider down — caller falls back
  }
}

// --- entry point -------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const started = Date.now();
  const url = new URL(req.url);
  const dry = url.searchParams.get('dry') === '1';
  const force = url.searchParams.get('force') === '1';

  const now = new Date();

  // DST-safe gate: the schedule fires twice, only the 09:00-local one proceeds.
  if (!force && !dry && localHour(now, TZ) !== TARGET_HOUR) {
    return new Response(
      JSON.stringify({ skipped: true, reason: `not ${TARGET_HOUR}:00 in ${TZ}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: 'missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
  const supabase = createClient(supabaseUrl, serviceKey);
  const since = new Date(now.getTime() - WINDOW_HOURS * 3_600_000);

  // ---- collect (independently; one failure must not blank the digest) -------
  const logsCfg = readLogsConfig();

  const [snapRes, cronRes, logsRes, llmKey] = await Promise.all([
    supabase.rpc('watchdog_snapshot', { p_since: since.toISOString() }),
    supabase.rpc('get_cron_runs_since', { p_since: since.toISOString() }),
    logsCfg
      ? collectPlatformLogs(logsCfg, since, now)
      : Promise.resolve(unavailableLogs('WATCHDOG_MGMT_TOKEN / WATCHDOG_PROJECT_REF not set')),
    checkLlmKey(logsCfg),
  ]);

  const snapshot = (snapRes.data ?? {}) as Record<string, unknown>;
  const snapshotError = snapRes.error ? String(snapRes.error.message).slice(0, 300) : null;
  const cronError = cronRes.error ? String(cronRes.error.message).slice(0, 300) : null;
  const cron = summariseCron((cronRes.data ?? []) as CronRow[]);
  const logs = logsRes;

  const degraded = Array.isArray(snapshot.degraded) ? (snapshot.degraded as string[]) : [];

  const issues = detectIssues(snapshot, logs, cron, cronError, snapshotError, degraded, now, llmKey);
  const severity: Severity = issues.some((i) => i.severity === 'critical')
    ? 'critical'
    : issues.length ? 'warn' : 'ok';

  const llm = await llmNarrative(snapshot, logs, cron, issues);
  const narrative = llm?.text ?? deterministicNarrative(issues, snapshot);
  const narrativeSource = llm?.source ?? 'rule-based (no LLM key configured)';

  const message = buildMessage({
    now, since, snapshot, snapshotError, logs, cron, cronError,
    issues, severity, narrative, narrativeSource, degraded,
  });

  // ---- deliver --------------------------------------------------------------
  let delivered = false;
  let deliveryError: string | null = null;

  if (dry) {
    return new Response(
      JSON.stringify({ dry: true, severity, issues, message, snapshot, cron, logs }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const tg = readTelegramConfig();
  if (!tg) {
    deliveryError = 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set';
  } else {
    const r = await sendTelegram(tg, message);
    delivered = r.ok;
    if (!r.ok) deliveryError = r.errors.join('; ').slice(0, 500);
  }

  // ---- self-log (so tomorrow's run can report today's silence) --------------
  try {
    await supabase.from('watchdog_runs').insert({
      window_start: since.toISOString(),
      window_end: now.toISOString(),
      ok: !snapshotError && !cronError,
      delivered,
      severity,
      issue_count: issues.length,
      duration_ms: Date.now() - started,
      degraded,
      summary: {
        paying: (snapshot.subs as Record<string, unknown>)?.paying_active ?? null,
        issues: issues.map((i) => i.text).slice(0, 20),
        api_5xx: logs.api?.e5xx ?? null,
      },
      error: deliveryError ?? snapshotError ?? cronError,
    });
  } catch {
    // Never let self-logging break delivery — the digest already went out.
  }

  return new Response(
    JSON.stringify({
      ok: delivered, severity, issues: issues.length,
      delivered, deliveryError, durationMs: Date.now() - started,
    }),
    {
      status: delivered ? 200 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
});
