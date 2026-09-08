#!/usr/bin/env node
// =============================================================================
// WATCHDOG GATE — decide whether last night's production digest fails the build
// =============================================================================
// This logic used to live inlined in .github/workflows/watchdog-alerts.yml,
// where it had two problems that only a runner could reveal:
//
//   1. The workflow had NO `actions/checkout` step, so `.github/watchdog-acks.json`
//      was never on disk. The Python caught FileNotFoundError, set `acks = []`
//      and carried on — so the acknowledgement mechanism shipped DISARMED, and
//      the nightly check went red exactly as before. The fix was "decoy-proven"
//      locally, where the file obviously exists; the one posture that mattered
//      (the runner's empty workspace) was the one that could not be tested.
//
//   2. Logic inside a YAML heredoc cannot be run by a test. So it wasn't.
//
// Hence: a real script, with `--self-test`, run by CI. A missing acks file is
// now a LOUD failure, never a silent downgrade — that specific silence is what
// made a shipped fix inert for a whole day.
//
//   node scripts/watchdog-gate.mjs --digest /tmp/wd.json
//   node scripts/watchdog-gate.mjs --self-test
//
// Exit 0 = nothing unacknowledged. Exit 1 = a critical needs a human.
// Exit 2 = the gate itself is misconfigured (which is also a failure).
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const args = process.argv.slice(2);
const get = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i === -1 ? fallback : args[i + 1];
};

const ACKS_DEFAULT = '.github/watchdog-acks.json';

// GitHub renders ::error:: / ::warning:: as annotations; elsewhere they are
// still readable plain text, so there is no need to branch on CI.
const err = (m) => console.log(`::error::${m}`);
const warn = (m) => console.log(`::warning::${m}`);

function loadAcks(acksPath) {
  let raw;
  try {
    raw = fs.readFileSync(acksPath, 'utf8');
  } catch (e) {
    // Deliberately fatal. An unreadable acks file cannot be told apart from a
    // workspace that was never checked out, and the second one silently
    // disarms every acknowledgement. If you genuinely have none, commit the
    // file with "acks": [] — an explicit empty list, not an absent file.
    err(`Cannot read ${acksPath} (${e.code === 'ENOENT' ? 'not found' : e.message}).`);
    err('The acknowledgement list is required. If the workflow runs without');
    err('actions/checkout the file is absent and every ack is silently ignored.');
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    err(`${acksPath} is not valid JSON: ${e.message}`);
    return null;
  }
  if (!Array.isArray(parsed.acks)) {
    err(`${acksPath} has no "acks" array.`);
    return null;
  }
  return parsed.acks;
}

function run({ digestPath, acksPath, today }) {
  let digest;
  try {
    digest = JSON.parse(fs.readFileSync(digestPath, 'utf8'));
  } catch (e) {
    err(`Cannot read the watchdog digest at ${digestPath}: ${e.message}`);
    return 2;
  }

  const acks = loadAcks(acksPath);
  if (acks === null) return 2;

  const issues = Array.isArray(digest.issues) ? digest.issues : [];

  const live = [];
  for (const a of acks) {
    const exp = a && typeof a.expires === 'string' ? a.expires : '';
    // Compare ISO date strings, not Date objects: no timezone can shift a
    // day boundary and quietly extend or expire an acknowledgement.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(exp) || Number.isNaN(Date.parse(exp))) {
      warn(`ack for ${JSON.stringify(a?.match)} has no valid \`expires\` — ignoring it`);
      continue;
    }
    if (!a.match) {
      warn('an ack entry has no `match` — ignoring it');
      continue;
    }
    if (exp >= today) live.push(a);
    else warn(`ack for ${JSON.stringify(a.match)} EXPIRED on ${exp} — re-ack it or fix it`);
  }

  const ackFor = (text) =>
    live.find((a) => (text || '').toLowerCase().includes(a.match.toLowerCase()));

  if (!issues.length) console.log('No issues reported.');

  const unacked = [];
  for (const i of issues) {
    const sev = String(i.severity || '?').toLowerCase();
    const text = i.text || '';
    const a = sev === 'critical' ? ackFor(text) : null;
    if (a) {
      console.log(`[CRITICAL·ACKED] ${text}`);
      console.log(`                 └─ ${a.reason} (ack expires ${a.expires})`);
    } else {
      console.log(`[${sev.toUpperCase()}] ${text}`);
      if (sev === 'critical') unacked.push(text);
    }
  }

  if (unacked.length) {
    console.log('');
    for (const t of unacked) err(t);
    err(`${unacked.length} unacknowledged CRITICAL issue(s) in production.`);
    return 1;
  }

  if (issues.some((i) => String(i.severity || '').toLowerCase() === 'warn')) {
    warn('Production has warnings — not failing the run.');
  } else if (issues.length) {
    console.log('Nothing unacknowledged.');
  } else {
    console.log('Healthy.');
  }
  return 0;
}

// ---------------------------------------------------------------------------
// SELF-TEST
// ---------------------------------------------------------------------------
// Each case asserts an EXIT CODE, because that is the only thing the workflow
// consumes. Case 6 is the regression that prompted the rewrite: before this,
// a missing acks file scored the same as an empty one and nobody was told.
function selfTest() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wd-gate-'));
  const self = fileURLToPath(import.meta.url);

  const write = (name, obj) => {
    const p = path.join(dir, name);
    fs.writeFileSync(p, JSON.stringify(obj));
    return p;
  };

  const ACKED = 'No LLM provider key set — photo-to-quote cannot run';
  const NEW = '1 edge-function invocation(s) returned 5xx: send-email 500 ×1';

  const acksLive = write('acks-live.json', {
    acks: [{ match: 'No LLM provider key set', reason: 'deliberate', expires: '2999-01-01' }],
  });
  const acksExpired = write('acks-expired.json', {
    acks: [{ match: 'No LLM provider key set', reason: 'deliberate', expires: '2000-01-01' }],
  });
  const acksNoExpiry = write('acks-noexpiry.json', {
    acks: [{ match: 'No LLM provider key set', reason: 'deliberate' }],
  });
  const acksEmpty = write('acks-empty.json', { acks: [] });
  const missing = path.join(dir, 'does-not-exist.json');

  const critAcked = write('d1.json', { issues: [{ severity: 'critical', text: ACKED }] });
  const critBoth = write('d2.json', {
    issues: [{ severity: 'critical', text: ACKED }, { severity: 'critical', text: NEW }],
  });
  const critNew = write('d3.json', { issues: [{ severity: 'critical', text: NEW }] });
  const warnOnly = write('d4.json', { issues: [{ severity: 'warn', text: 'DSO is climbing' }] });
  const noIssues = write('d5.json', { issues: [] });

  const cases = [
    ['acked critical alone passes', critAcked, acksLive, 0],
    ['a NEW critical beside an acked one still fails', critBoth, acksLive, 1],
    ['an unacked critical fails', critNew, acksLive, 1],
    ['an EXPIRED ack stops suppressing', critAcked, acksExpired, 1],
    ['an ack with no expiry is ignored', critAcked, acksNoExpiry, 1],
    ['a MISSING acks file is fatal, never a silent empty list', critAcked, missing, 2],
    ['an empty ack list is honoured (explicit, not absent)', noIssues, acksEmpty, 0],
    ['warnings alone do not fail', warnOnly, acksLive, 0],
    ['no issues at all passes', noIssues, acksLive, 0],
  ];

  let failed = 0;
  for (const [name, digest, acksPath, want] of cases) {
    const r = spawnSync(process.execPath, [self, '--digest', digest, '--acks', acksPath], {
      encoding: 'utf8',
    });
    const got = r.status;
    if (got === want) {
      console.log(`  ✓ ${name}`);
    } else {
      failed++;
      console.log(`  ✕ ${name}\n      expected exit ${want}, got ${got}`);
      console.log((r.stdout || '').split('\n').map((l) => `      | ${l}`).join('\n'));
    }
  }

  fs.rmSync(dir, { recursive: true, force: true });

  // The gate is worthless if it does not read the file the repo actually ships.
  const repoAcks = path.resolve(ACKS_DEFAULT);
  if (!fs.existsSync(repoAcks)) {
    failed++;
    console.log(`  ✕ ${ACKS_DEFAULT} is missing from the repo`);
  } else {
    const acks = loadAcks(repoAcks);
    if (acks === null) {
      failed++;
      console.log(`  ✕ ${ACKS_DEFAULT} does not parse`);
    } else {
      const today = new Date().toISOString().slice(0, 10);
      const stale = acks.filter((a) => typeof a.expires === 'string' && a.expires < today);
      for (const a of stale) console.log(`  ! committed ack ${JSON.stringify(a.match)} expired ${a.expires}`);
      const bad = acks.filter((a) => !a.match || !a.reason || !a.expires);
      for (const a of bad) {
        failed++;
        console.log(`  ✕ committed ack ${JSON.stringify(a.match)} is missing match/reason/expires`);
      }
      console.log(`  ✓ ${ACKS_DEFAULT} parses (${acks.length} ack(s), ${stale.length} expired)`);
    }
  }

  console.log(failed ? `\n✕ watchdog gate: ${failed} case(s) failed` : '\n✓ watchdog gate: all cases pass');
  return failed ? 1 : 0;
}

if (args.includes('--self-test')) {
  process.exit(selfTest());
} else {
  process.exit(
    run({
      digestPath: get('--digest', '/tmp/wd.json'),
      acksPath: get('--acks', ACKS_DEFAULT),
      today: get('--today', new Date().toISOString().slice(0, 10)),
    })
  );
}
