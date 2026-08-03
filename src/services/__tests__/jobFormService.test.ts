// =============================================================================
// JOB FORMS
// =============================================================================
// The properties worth pinning are the ones that would corrupt a work record:
// a form counted complete when a required reading is missing, and a template
// edit silently rewriting what a crew already recorded.
// =============================================================================

import {
  validateResponse,
  completionPercent,
  templatesForJob,
  blankAnswers,
  type JobFormTemplate,
  type JobFormAnswer,
} from '../jobFormService';

const tpl = (over: Partial<JobFormTemplate> = {}): JobFormTemplate => ({
  id: 'f1',
  name: 'CV-ketel onderhoud',
  trade: 'plumbing',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  fields: [
    { id: 'a', label: 'Radiatoren ontlucht', type: 'check', required: true, sortOrder: 1 },
    { id: 'b', label: 'Waterdruk', type: 'number', required: true, unit: 'bar', sortOrder: 2 },
    { id: 'c', label: 'Opmerkingen', type: 'text', required: false, sortOrder: 3 },
  ],
  ...over,
});

describe('required answers', () => {
  it('treats an explicit "no" as answered', () => {
    // "Did you bleed the radiators? No" is a legitimate and often important
    // record. Requiring a TICK would push crews to tick things they did not do.
    const answers: JobFormAnswer[] = [
      { fieldId: 'a', label: 'Radiatoren ontlucht', type: 'check', checked: false },
      { fieldId: 'b', label: 'Waterdruk', type: 'number', number: 1.8 },
    ];
    expect(validateResponse(tpl(), answers)).toEqual([]);
  });

  it('blocks when a required reading is missing', () => {
    const answers: JobFormAnswer[] = [
      { fieldId: 'a', label: 'Radiatoren ontlucht', type: 'check', checked: true },
    ];
    expect(validateResponse(tpl(), answers).map((e) => e.code)).toContain('missing_required');
  });

  it('does not block on an unanswered optional field', () => {
    const answers: JobFormAnswer[] = [
      { fieldId: 'a', label: 'Radiatoren ontlucht', type: 'check', checked: true },
      { fieldId: 'b', label: 'Waterdruk', type: 'number', number: 2 },
    ];
    expect(validateResponse(tpl(), answers)).toEqual([]);
  });

  it('treats whitespace as unanswered for required text', () => {
    const t = tpl({ fields: [{ id: 'x', label: 'Serienummer', type: 'text', required: true, sortOrder: 1 }] });
    expect(validateResponse(t, [{ fieldId: 'x', label: 'Serienummer', type: 'text', text: '   ' }]))
      .toHaveLength(1);
  });

  it('rejects a NaN reading rather than storing it', () => {
    const answers: JobFormAnswer[] = [
      { fieldId: 'a', label: 'Radiatoren ontlucht', type: 'check', checked: true },
      { fieldId: 'b', label: 'Waterdruk', type: 'number', number: Number.NaN },
    ];
    const codes = validateResponse(tpl(), answers).map((e) => e.code);
    expect(codes).toContain('missing_required');
  });

  it('flags a template with no fields instead of reporting it complete', () => {
    expect(validateResponse(tpl({ fields: [] }), []).map((e) => e.code)).toContain('empty_template');
  });
});

describe('completion', () => {
  it('reads honestly for a half-filled form', () => {
    const answers: JobFormAnswer[] = [
      { fieldId: 'a', label: 'Radiatoren ontlucht', type: 'check', checked: true },
    ];
    expect(completionPercent(tpl(), answers)).toBe(33);
  });

  it('counts an unticked box as answered', () => {
    const answers: JobFormAnswer[] = [
      { fieldId: 'a', label: 'Radiatoren ontlucht', type: 'check', checked: false },
    ];
    expect(completionPercent(tpl(), answers)).toBe(33);
  });

  it('is 0 for an empty template rather than dividing by zero', () => {
    expect(completionPercent(tpl({ fields: [] }), [])).toBe(0);
  });
});

describe('which templates a job can use', () => {
  const plumbing = tpl({ id: 'p', trade: 'plumbing' });
  const anyTrade = tpl({ id: 'g', trade: undefined });
  const electrical = tpl({ id: 'e', trade: 'electrical' });

  it('offers the job trade plus trade-agnostic forms', () => {
    const ids = templatesForJob([plumbing, anyTrade, electrical], 'plumbing').map((t) => t.id);
    expect(ids).toEqual(['p', 'g']);
  });

  it('matches trade case-insensitively', () => {
    // Trade comes from onboarding in one place and the job in another; a case
    // difference should not hide the contractor's own form.
    expect(templatesForJob([plumbing], 'Plumbing').map((t) => t.id)).toEqual(['p']);
  });

  it('offers everything when the job has no trade', () => {
    // `Job.trade` is optional and the only in-app job-creation path never sets
    // it, so this is the COMMON case, not an edge case. Treating an unknown
    // trade as "trade-agnostic" filtered out every trade-tagged form and left
    // the contractor on "no form for this trade" for a form they had just
    // written. Unknown means we cannot narrow, so offer the lot.
    expect(templatesForJob([plumbing, anyTrade, electrical], undefined).map((t) => t.id)).toEqual([
      'p',
      'g',
      'e',
    ]);
  });

  it('does not silently hide a trade-tagged form on an untyped job', () => {
    // The regression proper: one form, tagged, and a job with no trade.
    expect(templatesForJob([plumbing], undefined)).toHaveLength(1);
  });
});

describe('answer snapshotting', () => {
  it('copies the label and unit onto the answer', () => {
    // So a form completed in March still reads correctly after the template is
    // reworded in June — the response is evidence, not a live view.
    const blank = blankAnswers(tpl());
    expect(blank[1]).toMatchObject({ fieldId: 'b', label: 'Waterdruk', type: 'number', unit: 'bar' });
  });

  it('orders by sortOrder, not array order', () => {
    const t = tpl({
      fields: [
        { id: 'z', label: 'Last', type: 'check', required: false, sortOrder: 9 },
        { id: 'a', label: 'First', type: 'check', required: false, sortOrder: 1 },
      ],
    });
    expect(blankAnswers(t).map((a) => a.fieldId)).toEqual(['a', 'z']);
  });
});
