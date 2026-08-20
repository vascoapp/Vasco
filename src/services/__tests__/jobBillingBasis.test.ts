import {
  jobBillingBasis,
  buildJobActualLines,
  loggedHours,
  billableMaterials,
  type BillingLabels,
} from '../jobBillingBasis';
import type { JobMaterial } from '../../domain/materials';

const labels: BillingLabels = {
  labour: (h: number) => `Arbeitsstunden (${h} Std.)`,
  material: 'Material',
  workRecord: ({ hours, materialCount, completedOn }) =>
    `Aus dem Auftrag: ${hours} Std., ${materialCount} Materialien${completedOn ? `, ${completedOn.slice(0, 10)}` : ''}.`,
};

const catalog = [
  { id: 'mat-1', name: 'Grohe mengkraan' },
  { id: 'mat-2', name: 'Koperen buis 15mm' },
];

function material(over: Partial<JobMaterial> = {}): JobMaterial {
  return {
    id: 'jm-1',
    jobId: 'job-1',
    materialId: 'mat-1',
    quantity: 2,
    unit: 'stuk',
    unitPrice: 45,
    totalPrice: 90,
    status: 'installed',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...over,
  };
}

const bareJob = { timeEntries: [], actualHours: undefined, quotedAmount: undefined, agreedAmount: undefined, title: 'Lekkage reparatie', completedAt: undefined };

describe('loggedHours', () => {
  it('prefers the per-entry log over the rollup', () => {
    expect(loggedHours({ timeEntries: [{ id: '1', date: '2026-08-01', hours: 3 }, { id: '2', date: '2026-08-02', hours: 2.5 }], actualHours: 99 })).toBe(5.5);
  });
  it('falls back to actualHours when nothing is itemised', () => {
    expect(loggedHours({ timeEntries: [], actualHours: 2.5 })).toBe(2.5);
  });
  it('is 0 for a job nobody logged time on', () => {
    expect(loggedHours({ timeEntries: [], actualHours: undefined })).toBe(0);
  });
});

describe('billableMaterials', () => {
  it('bills what was delivered or fitted, never what was only planned or ordered', () => {
    const list = [
      material({ id: 'a', status: 'planned' }),
      material({ id: 'b', status: 'ordered' }),
      material({ id: 'c', status: 'delivered' }),
      material({ id: 'd', status: 'installed' }),
    ];
    expect(billableMaterials(list).map(m => m.id)).toEqual(['c', 'd']);
  });
});

describe('buildJobActualLines', () => {
  it('names the material from the catalogue', () => {
    const { lineItems } = buildJobActualLines(bareJob, [material()], catalog, 65, labels);
    expect(lineItems).toEqual([{ description: 'Grohe mengkraan', quantity: 2, unitPrice: 45 }]);
  });

  it('falls back to a generic name for a material not in the catalogue', () => {
    const { lineItems } = buildJobActualLines(bareJob, [material({ materialId: 'unknown' })], catalog, 65, labels);
    expect(lineItems[0].description).toBe('Material');
  });

  it('derives a unit price from the recorded total when the unit price is missing', () => {
    const m = material({ unitPrice: undefined, totalPrice: 90, quantity: 3 });
    const { lineItems } = buildJobActualLines(bareJob, [m], catalog, 65, labels);
    expect(lineItems[0].unitPrice).toBe(30);
  });

  it('skips a material it cannot price rather than billing it at zero', () => {
    const m = material({ unitPrice: undefined, totalPrice: undefined });
    expect(buildJobActualLines(bareJob, [m], catalog, 65, labels).lineItems).toHaveLength(0);
  });

  it('prices logged hours at the contractor rate', () => {
    const job = { timeEntries: [{ id: '1', date: '2026-08-01', hours: 4 }], actualHours: undefined };
    const { lineItems, unpricedHours } = buildJobActualLines(job, [], catalog, 65, labels);
    expect(lineItems[0]).toEqual({ description: 'Arbeitsstunden (4 Std.)', quantity: 4, unitPrice: 65 });
    expect(unpricedHours).toBe(0);
  });

  it('still shows the hours when no rate is set, and says they are unpriced', () => {
    const job = { timeEntries: [{ id: '1', date: '2026-08-01', hours: 4 }], actualHours: undefined };
    const { lineItems, unpricedHours } = buildJobActualLines(job, [], catalog, undefined, labels);
    expect(lineItems[0].unitPrice).toBe(0);
    expect(unpricedHours).toBe(4);
  });
});

describe('jobBillingBasis', () => {
  const quoteLines = [{ description: 'Badkamer', quantity: 1, unitPrice: 4200 }];

  it('bills the agreed price when one exists, and does NOT add the materials on top', () => {
    const basis = jobBillingBasis({
      job: { ...bareJob, agreedAmount: 4200, quotedAmount: 4000 },
      quoteLines,
      jobMaterials: [material()],
      catalog,
      hourlyRate: 65,
      vatRatePercent: 19,
      labels,
    });
    expect(basis.source).toBe('quote');
    expect(basis.agreedAmount).toBe(4200);
    expect(basis.lineItems).toEqual(quoteLines);
  });

  it('falls back to the quoted amount when nothing was separately agreed', () => {
    const basis = jobBillingBasis({
      job: { ...bareJob, quotedAmount: 280 }, quoteLines, jobMaterials: [], catalog, hourlyRate: 65, vatRatePercent: 19, labels,
    });
    expect(basis.source).toBe('quote');
    expect(basis.agreedAmount).toBe(280);
  });

  it('bills the job\'s own record when no price was ever agreed — the case that used to throw', () => {
    const job = { ...bareJob, timeEntries: [{ id: '1', date: '2026-08-01', hours: 3 }] };
    const basis = jobBillingBasis({ job, quoteLines: [], jobMaterials: [material()], catalog, hourlyRate: 65, vatRatePercent: 19, labels });
    expect(basis.source).toBe('actuals');
    expect(basis.lineItems.map(l => l.description)).toEqual(['Arbeitsstunden (3 Std.)', 'Grohe mengkraan']);
    expect(basis.netAmount).toBe(3 * 65 + 2 * 45);
  });

  it('reports "none" — not a zero invoice — when the job recorded nothing at all', () => {
    const basis = jobBillingBasis({ job: bareJob, quoteLines: [], jobMaterials: [], catalog, hourlyRate: 65, vatRatePercent: 19, labels });
    expect(basis.source).toBe('none');
    expect(basis.netAmount).toBe(0);
    expect(basis.lineItems).toEqual([]);
  });

  it('refuses rather than minting a EUR 0 invoice when the hours cannot be priced', () => {
    const job = { ...bareJob, timeEntries: [{ id: '1', date: '2026-08-01', hours: 6 }] };
    const basis = jobBillingBasis({ job, quoteLines: [], jobMaterials: [], catalog, hourlyRate: undefined, vatRatePercent: 19, labels });
    expect(basis.source).toBe('none');
    expect(basis.netAmount).toBe(0);
    // The caller needs to tell the contractor WHICH of the two reasons it is.
    expect(basis.unpricedHours).toBe(6);
  });

  it('bills the materials and reports the unpriced hours when only the rate is missing', () => {
    const job = { ...bareJob, timeEntries: [{ id: '1', date: '2026-08-01', hours: 6 }] };
    const basis = jobBillingBasis({ job, quoteLines: [], jobMaterials: [material()], catalog, hourlyRate: undefined, vatRatePercent: 19, labels });
    expect(basis.source).toBe('actuals');
    expect(basis.netAmount).toBe(90);
    expect(basis.unpricedHours).toBe(6);
  });

  it('gives an agreed-price job a real line named after the job when no quote lines exist', () => {
    const job = { ...bareJob, agreedAmount: 119, title: 'Lekkage reparatie', timeEntries: [{ id: '1', date: '2026-08-01', hours: 2 }] };
    const basis = jobBillingBasis({ job, quoteLines: [], jobMaterials: [], catalog, hourlyRate: 65, vatRatePercent: 19, labels });
    expect(basis.source).toBe('quote');
    expect(basis.lineItems).toEqual([{ description: 'Lekkage reparatie', quantity: 1, unitPrice: 100 }]);
    // The line is NET and grosses back up to exactly what was agreed.
    expect(Math.round(basis.lineItems[0].unitPrice * 1.19 * 100) / 100).toBe(119);
  });

  it('carries the job record onto a fixed-price invoice as a note, not as lines', () => {
    const job = {
      ...bareJob, agreedAmount: 280, title: 'Lekkage reparatie',
      timeEntries: [{ id: '1', date: '2026-08-01', hours: 2.5 }],
      completedAt: '2026-08-08T10:00:00.000Z',
    };
    const basis = jobBillingBasis({ job, quoteLines, jobMaterials: [material()], catalog, hourlyRate: 65, vatRatePercent: 19, labels });
    expect(basis.lineItems).toEqual(quoteLines); // the agreement, untouched
    expect(basis.workRecord).toContain('2.5 Std.');
    expect(basis.workRecord).toContain('1 Materialien');
    expect(basis.workRecord).toContain('2026-08-08');
  });

  it('has no work record when the job recorded nothing', () => {
    const basis = jobBillingBasis({ job: { ...bareJob, agreedAmount: 280 }, quoteLines, jobMaterials: [], catalog, hourlyRate: 65, vatRatePercent: 19, labels });
    expect(basis.workRecord).toBeUndefined();
  });

  it('does not treat planned materials as a reason to invoice', () => {
    const basis = jobBillingBasis({
      job: bareJob, quoteLines: [], jobMaterials: [material({ status: 'planned' })], catalog, hourlyRate: 65, vatRatePercent: 19, labels,
    });
    expect(basis.source).toBe('none');
  });
});
