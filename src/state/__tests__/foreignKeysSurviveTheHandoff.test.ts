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
  it('both conversion sites prefer the id field over the display name', () => {
    const resolved = [...SRC.matchAll(
      /customer_id: isUuid\(quote\.customerId\) \? quote\.customerId\s*\n\s*: isUuid\(quote\.customer\) \? quote\.customer : null,/g,
    )];
    expect(resolved.length).toBe(2);
  });

  it('no site reads only the display name any more', () => {
    expect(SRC).not.toMatch(/customer_id: isUuid\(quote\.customer\) \? quote\.customer : null,/);
  });

  it('the name is still accepted as a fallback', () => {
    // A BE-hydrated quote carries the uuid in `.customer`; dropping that
    // branch would break the case that used to be the only working one.
    expect(SRC).toMatch(/isUuid\(quote\.customer\) \? quote\.customer : null/);
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
