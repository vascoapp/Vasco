/**
 * @jest-environment node
 */
// Two shapes where a screen accepted input and told the contractor it was kept,
// while nothing had been written (sweep 2026-09-16, #339):
//
//  - D5: "Next invoice number" sat above its own small Apply button. Pressing
//    Save — the button you press after filling in a form — wrote every other
//    field and silently discarded the typed number. A contractor migrating from
//    another tool continued their series at 1.
//  - D21: `upsertJobQualitySignal` returned void and was wrapped in a
//    try/catch. supabase-js RESOLVES with `{ error }` instead of throwing, so a
//    rejected write reached the screen as success: "Saved".
//
// The general rule both break: a Save button commits everything on its screen,
// and a write reports its outcome to the thing that claims success.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

describe('business settings: Save commits the invoice counter too', () => {
  const src = read('app/(modals)/business-settings.tsx');
  const save = src.slice(src.indexOf('const handleSave'), src.indexOf('const filled ='));

  it('the screen still offers the explicit Apply button', () => {
    expect(src).toMatch(/onPress=\{applyCounter\}/);
  });

  it('Save sets the counter when the typed number differs from the loaded one', () => {
    expect(save).toMatch(/setDocumentCounter\('invoice',/);
    expect(save).toMatch(/nextInvoiceNo !== \(loadedCounter\.current \?\? ''\)/);
  });

  it('Save does not leave the screen when the counter is refused', () => {
    const at = save.indexOf('setDocumentCounter');
    const after = save.slice(at, at + 700);
    expect(after).toMatch(/if \(!res\.ok\)/);
    // The refusal must return BEFORE router.back(), or the contractor leaves
    // believing the number was taken.
    // ⚠️ `indexOf` is −1 when ABSENT, and −1 is less than every index — the
    // original form of this check passed when the `return;` was deleted, i.e.
    // it could not fail in the direction it was written for (meta-sweep
    // 2026-09-17).
    const ret = after.indexOf('return;');
    const back = after.indexOf('router.back()');
    expect(ret).toBeGreaterThan(-1);
    if (back > -1) expect(ret).toBeLessThan(back);
  });

  it('Apply moves the baseline, so Save does not re-send the same number', () => {
    const apply = src.slice(src.indexOf('const applyCounter'), src.indexOf('const handleSave'));
    expect(apply).toMatch(/loadedCounter\.current = String\(res\.next\)/);
  });

  it('handleSave re-runs when the typed number changes', () => {
    const deps = src.slice(src.indexOf('}, [businessName'), src.indexOf('}, [businessName') + 700);
    expect(deps).toMatch(/nextInvoiceNo/);
  });
});

describe('job quality: "Saved" means the row was written', () => {
  const service = read('src/services/intelligenceCaptureService.ts');
  const screen = read('app/contractor/job-quality/[id].tsx');
  const fn = service.slice(service.indexOf('export async function upsertJobQualitySignal'), service.indexOf('// 5. Read helpers'));

  it('the write reads the error supabase-js resolves with', () => {
    expect(fn).toMatch(/const \{ error \} = await/);
    expect(fn).toMatch(/if \(error\)/);
  });

  it('every exit of the write reports an outcome', () => {
    // No bare `return;` — each one used to be an invisible skip.
    expect(fn).not.toMatch(/\n\s*return;\s*\n/);
    expect(fn).toMatch(/return \{ ok: true \}/);
    for (const reason of ['offline', 'no-session', 'job-not-saved', 'rejected']) {
      expect(fn).toContain(`reason: '${reason}'`);
    }
  });

  it('the screen only claims success on ok', () => {
    const handler = screen.slice(screen.indexOf('const handleSubmit'), screen.indexOf('return ('));
    const guard = handler.indexOf('if (!res.ok)');
    const saved = handler.indexOf("jobQuality.savedTitle");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(saved);
    expect(handler.slice(guard, saved)).toMatch(/return;/);
  });
});

describe('a maintenance contract keeps the date it started', () => {
  const src = read('app/contractor/recurring/[id].tsx');

  it('Save reuses the loaded start date and only stamps now() for a new one', () => {
    // `startDate: new Date().toISOString()` on every save slid the whole
    // schedule: a yearly boiler service due next month, edited to change the
    // reminder lead time, became due in a year (#339).
    expect(src).toMatch(/startDate: startDate \?\? new Date\(\)\.toISOString\(\)/);
    expect(src).not.toMatch(/startDate: new Date\(\)\.toISOString\(\),/);
  });

  it('the loader captures it', () => {
    const effect = src.slice(src.indexOf('getAllRecurring().then'), src.indexOf('const customer ='));
    expect(effect).toMatch(/setStartDate\(t\.startDate\)/);
  });
});

describe('a sent quote is not demoted by a control that edits nothing', () => {
  const src = read('app/quotes/[id].tsx');

  it('the client card no longer offers the placebo pencil', () => {
    // It set `editing`, which only its own icon read, and on a SENT quote it
    // first offered to mark the quote draft — undoing the send for nothing.
    expect(src).not.toMatch(/setEditing/);
    expect(src).not.toMatch(/quotes\.editSentQuote/);
  });

  it('nothing else on the screen demotes a sent quote to draft', () => {
    expect(src).not.toMatch(/updateQuote\([^)]*\{\s*status:\s*'draft'\s*\}/);
  });
});

describe('a permit remembers WHICH job it is for', () => {
  const src = read('app/contractor/permits.tsx');

  it('stores the picked job id', () => {
    // The wizard made the contractor pick a job and kept only its title.
    const create = src.slice(src.indexOf('const handleCreatePermit'), src.indexOf('setActiveTab(\'overzicht\')'));
    expect(create).toMatch(/jobId: selectedJobId \?\? undefined/);
  });

  it('scopes by id, with the title match only as the legacy fallback', () => {
    const start = src.indexOf('const visiblePermits');
    // End anchored from the start: a bare indexOf can find an earlier match
    // and hand back an empty slice that every `not.toMatch` passes (#339).
    const filter = src.slice(start, src.indexOf('}, [permits, focusJob]', start));
    expect(filter.length).toBeGreaterThan(100);
    expect(filter).toMatch(/p\.jobId === focusJob\.id/);
    // Renaming the job used to break the link, and "Badkamer" matched
    // "Badkamer renovatie" too.
    expect(filter).toMatch(/p\.jobId\s*\?/);
  });
});
