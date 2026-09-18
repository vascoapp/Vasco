/**
 * @jest-environment node
 */
// Two ways a real relationship was thrown away on the write path
// (verified 2026-09-19):
//
// 1. `convertQuoteToJob` and the acceptance auto-job both built the job's
//    `customer_id` as `isUuid(quote.customer) ? quote.customer : null`. But
//    `addQuote` sets `customer: matchedCustomer?.name` — the DISPLAY NAME —
//    and puts the uuid in `customerId` beside it. So converting a quote
//    created in the same session dropped the customer FK while fully online,
//    with a perfectly valid uuid sitting one field away. It only ever worked
//    for quotes hydrated from the backend, where the mapper happens to put the
//    uuid in `.customer`. `addInvoice` already resolved it the right way round.
//
// 2. `addProject` swapped its temp id for the real one in local state but —
//    unlike `addCustomer` and `addJob` — never told the offline queue. So
//    `addJobToProject` queued an update carrying `project_id: 'proj-<ts>'`,
//    the flush had no mapping for it, Postgres rejected it (22P02) on all five
//    attempts and the write was dropped: the job left the project in silence.
//
// Static, because these are lines inside a 5,000-line provider whose mount
// pulls the whole app. What matters is which field each expression reads.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../../utils/stripComments';

const SRC = stripComments(
  fs.readFileSync(path.resolve(__dirname, '../AppState.tsx'), 'utf8'),
);

describe('a quote converted to a job keeps its customer', () => {
  it('both conversion sites read the id field first, the display name second', () => {
    // `quote.customerId ?? quote.customer` in that order is the whole fix: the
    // id for anything made in this session, the `.customer` slot for a
    // BE-hydrated quote (where the mapper puts the uuid there). Reading only
    // `.customer` dropped the FK on a fully online conversion.
    const sites = [...SRC.matchAll(/await fkOrNull\(quote\.customerId \?\? quote\.customer\)/g)];
    expect(sites.length).toBe(2);
  });

  it('no site reads only the display name any more', () => {
    expect(SRC).not.toMatch(/customer_id: isUuid\(quote\.customer\) \? quote\.customer : null,/);
  });

  it('the resolution goes through fkOrNull, so a temp id is looked up too', () => {
    // Not `isUuid(...) ? ... : null` any more: a customer created offline has
    // a temp id here, and `fkOrNull` finds the real one when it is known.
    expect(SRC).not.toMatch(/customer_id: isUuid\(quote\.customerId\)/);
  });
});

describe('a project teaches the queue its real id', () => {
  const at = SRC.indexOf("'addProject'");
  const block = SRC.slice(at, at + 1400);

  it('the addProject persist block is where we think it is', () => {
    expect(at).toBeGreaterThan(-1);
    expect(block).toContain('setProjects(prev => prev.map(p => p.id === tempId');
  });

  it('remembers tempId → finalId like addCustomer and addJob do', () => {
    expect(block).toMatch(/rememberIdRemap\(tempId, finalProjectId\)/);
  });

  it('every mutator that swaps an id also records the mapping', () => {
    // The mapping is what lets a LATER flush rewrite a child row that still
    // carries the parent's temp id. A swap without it is a dangling link.
    // EVERY id swap, whatever the callback parameter is named. Written
    // generically on purpose: the first version of this test only looked at
    // three shapes and passed while `convertQuoteToJob`, the acceptance
    // auto-job and `addMaterial` all swapped an id and told nobody.
    const swaps = [...SRC.matchAll(/\b([a-z]+)\.id === tempId \? \{ \.\.\.\1, id: /g)];
    expect(swaps.length).toBeGreaterThanOrEqual(7);
    for (const swap of swaps) {
      const near = SRC.slice(swap.index, (swap.index ?? 0) + 900);
      expect({ at: swap.index, remembers: /rememberIdRemap\(/.test(near) })
        .toEqual({ at: swap.index, remembers: true });
    }
  });
});

describe('a FK that cannot be written yet is repaired, not discarded', () => {
  // `isUuid(x) ? x : null` keeps the document and throws away the link, and
  // nothing backfills an already-inserted row. Every write that guards a uuid
  // FK now resolves through `fkOrNull` (which consults the persisted temp→real
  // map) and queues a repair for whatever is still pending. See #349 and
  // `src/services/fkRepair.ts`.
  it('no documents write nulls a temp FK outright any more', () => {
    for (const bad of [
      /customer_id: isUuid\(job\.customerId\)/,
      /customer_id: isUuid\(project\.customerId\)/,
      /project_id: isUuid\(projectId\)/,
      /customer_id: isUuid\(customer\) \? customer : null/,
      /job_id: isUuid\(jobId\) \? jobId : null/,
      /customer_id: isUuid\(customerId\) \? customerId : null/,
      /customer_id: isUuid\(quote\.customerId\)/,
    ]) {
      expect({ pattern: String(bad), present: bad.test(SRC) })
        .toEqual({ pattern: String(bad), present: false });
    }
  });

  it('every resolved FK has a repair queued for it', () => {
    const resolved = [...SRC.matchAll(/await fkOrNull\(/g)];
    const repairs = [...SRC.matchAll(/await queue(?:Row)?FkRepairs\(/g)];
    // EXACT, not "at least": the FK names repeat across sites (four mutators
    // each call theirs `invCustomerFk`), so a per-name check passes while a
    // whole site's repair is deleted — that version of this test was proven
    // toothless by decoy. The count is what has teeth. Adding a site means
    // updating this number, which is the moment to ask whether the new site
    // queues its repair too.
    expect({ resolved: resolved.length, repairs: repairs.length })
      .toEqual({ resolved: 16, repairs: 10 });

    // …and every repair names an FK that was actually resolved.
    for (const m of SRC.matchAll(/\['([a-z_]+)', (\w+Fk)\]/g)) {
      expect({ column: m[1], fk: m[2], declared: SRC.includes(`const ${m[2]} = await fkOrNull(`) })
        .toEqual({ column: m[1], fk: m[2], declared: true });
    }
  });

  it('the repairs address rows the flush can still find', () => {
    // Documents are matched by document_number, other tables by their row id —
    // both of which the flush rewrites from the same map before applying.
    expect(SRC).toMatch(/queueFkRepairs\(docNumber, \[/);
    expect(SRC).toMatch(/queueRowFkRepairs\('projects', tempId, \[/);
    expect(SRC).toMatch(/queueRowFkRepairs\('jobs', finalJobId, \[/);
  });

  it('leads are the deliberate exception', () => {
    // A lead row carries customer_name / phone / email denormalised, so a null
    // FK costs the join and not the information. Left as-is ON PURPOSE — if
    // that ever changes, this test is where to notice.
    expect(SRC).toMatch(/customer_id: isUuid\(newLead\.customerId\)/);
  });
});
