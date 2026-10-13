/**
 * A user session must not be able to grant itself a plan. The owner may
 * write its own subscriptions row (the in-app trial needs that), so the
 * database trigger `subscriptions_pin_entitlement` decides what a client may
 * change: start a ≤31-day Pro trial, or move down to free — nothing else.
 * Live-probed 2026-10-13 (tier-guard probe, 10/10). This guards the SQL so a
 * later migration cannot quietly undo it.
 */
import fs from 'fs';
import path from 'path';

const dir = path.resolve(__dirname, '../../supabase/migrations');
const latest = (fn: string) => {
  const defs = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8').replace(/--[^\n]*/g, ''))
    .filter((sql) => new RegExp(`function public\\.${fn}\\(\\)`).test(sql));
  return defs[defs.length - 1] ?? '';
};

it('the entitlement pin exists and runs as the caller', () => {
  const sql = latest('subscriptions_pin_entitlement');
  expect(sql).toMatch(/security invoker/i);
  expect(sql).not.toMatch(/security definer/i);
  expect(sql).toMatch(/create trigger subscriptions_pin_entitlement\s+before insert or update on public\.subscriptions/i);
});

it('a client can only start a capped trial or move down', () => {
  const sql = latest('subscriptions_pin_entitlement');
  expect(sql).toMatch(/max_trial timestamptz := now\(\) \+ interval '31 days'/);
  expect(sql).toMatch(/new\.trial_ends_at := least\(new\.trial_ends_at, max_trial\)/);
  expect(sql).toMatch(/if new\.tier is distinct from old\.tier and new\.tier <> 'free' then\s+new\.tier := old\.tier;/);
  expect(sql).toMatch(/if old\.external_id is not null then\s+new\.tier := old\.tier;/);
  expect(sql).toMatch(/new\.external_id := case when tg_op = 'INSERT' then null else old\.external_id end;/);
});
