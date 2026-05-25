// Pure-JS port of supabase/functions/_shared/aiIntentRouter.ts for unit
// testing the deterministic classifier without spinning up Deno/Supabase.
// MUST stay in sync with the real file — change one, change the other.
// (Kept temporarily for the R193 ship; remove once deployed + verified.)

const INVOICE_KEYWORDS   = /\b(invoice|bill|factuur\w*|factureren|reken\w*)/i;
const OVERDUE_KEYWORDS   = /\b(overdue|outstanding|unpaid|hasn'?t paid|achterstallig\w*|openstaand\w*|niet betaald)/i;
const REMIND_KEYWORDS    = /\b(remind|reminder|nudge|herinner\w*|herinnering\w*)\b/i;
const REVENUE_KEYWORDS   = /\b(revenue|earnings|make|made|earn|earned|income|omzet|verdiend|gemaakt)\b/i;
const WEEKLY_KEYWORDS    = /\b(weekly|this week|my week|how was|week summary|recap|deze week|samenvatting)\b/i;
const FIND_KEYWORDS      = /\b(find|lookup|search|zoek|opzoek|opzoeken|do I have)\b/i;
const SCHEDULE_KEYWORDS  = /\b(schedule|book|plan|inplannen|agenderen)\b/i;
const CANCEL_KEYWORDS    = /\b(cancel|annul\w*)\b/i;
const STATUS_KEYWORDS    = /\b(status of|where are we|how is|hoe staat|how's)\b/i;
const AMOUNT_RE          = /(?:[$€£]\s*)?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?:\s*(?:dollars?|usd|euros?|eur|pounds?|gbp))?/i;

function findCustomerInContext(message, customers) {
  if (!customers?.length) return null;
  const lower = message.toLowerCase();
  const sorted = [...customers].sort((a, b) => b.name.length - a.name.length);
  for (const c of sorted) if (lower.includes(c.name.toLowerCase())) return c;
  return null;
}

function extractAmount(message) {
  const m = AMOUNT_RE.exec(message);
  if (!m) return null;
  const raw = m[1].replace(/\./g, '').replace(/,/g, '.');
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function fmtCurrency(amount, locale) {
  const isUS = (locale ?? '').toLowerCase().startsWith('en-us');
  const symbol = isUS ? '$' : '€';
  return `${symbol}${amount.toLocaleString(isUS ? 'en-US' : 'nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function classifyDeterministic(message, ctx) {
  const msg = (message ?? '').trim();
  if (!msg) return null;
  const customers = ctx.customers ?? [];
  const locale = ctx.locale ?? 'en';
  const tier = 'deterministic';

  if (OVERDUE_KEYWORDS.test(msg)) {
    const n = ctx.overdueCount ?? 0;
    const humanResponse = n === 0
      ? "You're all caught up — no overdue invoices."
      : n === 1 ? 'You have 1 overdue invoice.' : `You have ${n} overdue invoices.`;
    return { intent: 'list_overdue', humanResponse, ai_tier: tier };
  }

  if (REVENUE_KEYWORDS.test(msg) && !INVOICE_KEYWORDS.test(msg)) {
    const total = ctx.recentInvoiceTotal ?? 0;
    return { intent: 'query_revenue', humanResponse: `Your recent invoice total is ${fmtCurrency(total, locale)}.`, ai_tier: tier };
  }

  if (WEEKLY_KEYWORDS.test(msg) && !INVOICE_KEYWORDS.test(msg)) {
    const rev = ctx.weeklyRevenue ?? 0;
    const jobs = ctx.weeklyJobsCompleted ?? 0;
    const quotes = ctx.weeklyQuotesSent ?? 0;
    return {
      intent: 'weekly_summary',
      humanResponse: `This week: ${fmtCurrency(rev, locale)} revenue, ${jobs} job${jobs === 1 ? '' : 's'} completed, ${quotes} quote${quotes === 1 ? '' : 's'} sent.`,
      ai_tier: tier,
    };
  }

  if (FIND_KEYWORDS.test(msg)) {
    const stripped = msg.replace(FIND_KEYWORDS, '').trim();
    const matched = findCustomerInContext(stripped, customers);
    if (matched) {
      return {
        intent: 'find_customer',
        humanResponse: `Found ${matched.name}.`,
        action: { type: 'find_customer', params: { customerId: matched.id, name: matched.name } },
        ai_tier: tier,
      };
    }
    return null;
  }

  if (REMIND_KEYWORDS.test(msg)) {
    const matched = findCustomerInContext(msg, customers);
    if (matched) {
      return {
        intent: 'send_reminder',
        humanResponse: `I'll send a reminder to ${matched.name}.`,
        action: { type: 'send_reminder', params: { customerName: matched.name, customerId: matched.id } },
        ai_tier: tier,
      };
    }
    return null;
  }

  if (INVOICE_KEYWORDS.test(msg)) {
    const matched = findCustomerInContext(msg, customers);
    const amount = extractAmount(msg);
    if (matched && amount) {
      const isUS = (locale ?? '').toLowerCase().startsWith('en-us');
      const currency = isUS ? 'USD' : 'EUR';
      return {
        intent: 'create_invoice',
        humanResponse: `Creating an invoice for ${matched.name} — ${fmtCurrency(amount, locale)}.`,
        action: { type: 'create_invoice', params: { customerName: matched.name, customerId: matched.id, amount, currency } },
        ai_tier: tier,
      };
    }
    return null;
  }

  if (CANCEL_KEYWORDS.test(msg)) {
    const matched = findCustomerInContext(msg, customers);
    if (matched) {
      return {
        intent: 'cancel_job',
        humanResponse: `Cancelling the job for ${matched.name}.`,
        action: { type: 'cancel_job', params: { customerName: matched.name, customerId: matched.id } },
        ai_tier: tier,
      };
    }
    return null;
  }

  if (STATUS_KEYWORDS.test(msg)) {
    const jobs = ctx.activeJobs ?? [];
    if (!jobs.length) {
      return { intent: 'query_job_status', humanResponse: 'No active jobs right now.', ai_tier: tier };
    }
    const matched = findCustomerInContext(msg, customers);
    if (matched) {
      const job = jobs.find((j) => j.customer.toLowerCase().includes(matched.name.toLowerCase()));
      if (job) return { intent: 'query_job_status', humanResponse: `${matched.name}: ${job.status}.`, ai_tier: tier };
    }
    const summary = jobs.slice(0, 5).map((j) => `${j.customer}: ${j.status}`).join('; ');
    return { intent: 'query_job_status', humanResponse: `Active jobs — ${summary}.`, ai_tier: tier };
  }

  if (SCHEDULE_KEYWORDS.test(msg)) return null;

  return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// TEST CASES
// ──────────────────────────────────────────────────────────────────────────────

const SAMPLE_CTX = {
  customers: [
    { id: 'c1', name: 'Joe Smith' },
    { id: 'c2', name: 'Bakkerij Jansen' },
    { id: 'c3', name: 'Sarah Chen' },
    { id: 'c4', name: 'Mike Reynolds' },
  ],
  recentInvoiceTotal: 12450,
  overdueCount: 3,
  activeJobs: [
    { id: 'j1', customer: 'Joe Smith', status: 'in_progress' },
    { id: 'j2', customer: 'Sarah Chen', status: 'awaiting_approval' },
  ],
  weeklyRevenue: 4200,
  weeklyJobsCompleted: 5,
  weeklyQuotesSent: 8,
  locale: 'en',
};

const tests = [
  // list_overdue
  { msg: 'show overdue',                 expect: { intent: 'list_overdue', tier: 'deterministic' } },
  { msg: 'who hasn\'t paid yet',         expect: { intent: 'list_overdue', tier: 'deterministic' } },
  { msg: 'toon achterstallige facturen', expect: { intent: 'list_overdue', tier: 'deterministic' } },
  // query_revenue
  { msg: 'what did I make this month',   expect: { intent: 'query_revenue', tier: 'deterministic' } },
  { msg: 'show my earnings',             expect: { intent: 'query_revenue', tier: 'deterministic' } },
  { msg: 'omzet deze maand',             expect: { intent: 'query_revenue', tier: 'deterministic' } },
  // weekly_summary
  { msg: 'how was my week',              expect: { intent: 'weekly_summary', tier: 'deterministic' } },
  { msg: 'recap',                        expect: { intent: 'weekly_summary', tier: 'deterministic' } },
  { msg: 'samenvatting deze week',       expect: { intent: 'weekly_summary', tier: 'deterministic' } },
  // find_customer
  { msg: 'find Joe Smith',               expect: { intent: 'find_customer', tier: 'deterministic', actionParam: 'customerId', actionVal: 'c1' } },
  { msg: 'lookup Sarah Chen',            expect: { intent: 'find_customer', tier: 'deterministic', actionVal: 'c3' } },
  { msg: 'zoek Bakkerij Jansen',         expect: { intent: 'find_customer', tier: 'deterministic', actionVal: 'c2' } },
  // send_reminder
  { msg: 'remind Joe Smith',             expect: { intent: 'send_reminder', tier: 'deterministic', actionVal: 'c1' } },
  { msg: 'herinner Bakkerij Jansen',     expect: { intent: 'send_reminder', tier: 'deterministic', actionVal: 'c2' } },
  // create_invoice
  { msg: 'invoice Joe Smith for $500',   expect: { intent: 'create_invoice', tier: 'deterministic', actionVal: 500 } },
  { msg: 'invoice Sarah Chen €1200',     expect: { intent: 'create_invoice', tier: 'deterministic', actionVal: 1200 } },
  { msg: 'factuur Bakkerij Jansen 250 euro', expect: { intent: 'create_invoice', tier: 'deterministic', actionVal: 250 } },
  // cancel_job
  { msg: 'cancel job for Joe Smith',     expect: { intent: 'cancel_job', tier: 'deterministic' } },
  { msg: 'annuleer Sarah Chen',          expect: { intent: 'cancel_job', tier: 'deterministic' } },
  // query_job_status
  { msg: 'status of Joe Smith',          expect: { intent: 'query_job_status', tier: 'deterministic' } },
  { msg: 'how is Sarah Chen doing',      expect: { intent: 'query_job_status', tier: 'deterministic' } },
  // schedule_job — should ALWAYS escalate (return null)
  { msg: 'schedule Joe for Tuesday at 2pm', expect: null },
  { msg: 'plan Sarah voor maandag',      expect: null },
  // ambiguous — should escalate
  { msg: 'help me with something',       expect: null },
  { msg: 'what is the weather',          expect: null },
  // missing slot — should escalate
  { msg: 'invoice somebody for $50',     expect: null }, // unknown customer
  { msg: 'remind a customer',            expect: null }, // no name
  // empty
  { msg: '',                             expect: null },
];

let passed = 0;
let failed = 0;
const failures = [];

for (const t of tests) {
  const got = classifyDeterministic(t.msg, SAMPLE_CTX);

  if (t.expect === null) {
    if (got === null) { passed++; }
    else { failed++; failures.push({ msg: t.msg, expected: 'null (escalate)', got: got.intent }); }
    continue;
  }

  if (!got) {
    failed++;
    failures.push({ msg: t.msg, expected: t.expect.intent, got: 'null' });
    continue;
  }

  if (got.intent !== t.expect.intent || got.ai_tier !== t.expect.tier) {
    failed++;
    failures.push({ msg: t.msg, expected: `${t.expect.intent}/${t.expect.tier}`, got: `${got.intent}/${got.ai_tier}` });
    continue;
  }

  // Action-value spot checks. Param name is either explicit, or inferred
  // from the value type — string IDs match customerId, numbers match amount.
  if (t.expect.actionVal !== undefined) {
    const paramName =
      t.expect.actionParam ??
      (typeof t.expect.actionVal === 'number' ? 'amount' : 'customerId');
    const actual = got.action?.params?.[paramName];
    if (actual !== t.expect.actionVal) {
      failed++;
      failures.push({ msg: t.msg, expected: `${paramName}=${t.expect.actionVal}`, got: `${paramName}=${JSON.stringify(actual)} (full: ${JSON.stringify(got.action?.params)})` });
      continue;
    }
  }

  passed++;
}

console.log(`\n${'='.repeat(60)}`);
console.log(`R193 deterministic-router e2e test`);
console.log(`${'='.repeat(60)}`);
console.log(`Passed: ${passed}/${tests.length}`);
console.log(`Failed: ${failed}/${tests.length}`);
if (failures.length) {
  console.log(`\nFailures:`);
  for (const f of failures) {
    console.log(`  msg: "${f.msg}"`);
    console.log(`    expected: ${f.expected}`);
    console.log(`    got:      ${f.got}`);
  }
}
console.log(`${'='.repeat(60)}\n`);
process.exit(failed === 0 ? 0 : 1);
