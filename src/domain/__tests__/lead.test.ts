import {
  groupLeadsByStatus,
  pipelineValue,
  winRate,
  LEAD_STATUS_ORDER,
  type Lead,
  type LeadStatus,
} from '../lead';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function makeLead(overrides: Partial<Lead>): Lead {
  const now = new Date().toISOString();
  return {
    id: `lead-${Math.random().toString(36).slice(2, 9)}`,
    status: 'new',
    source: 'manual',
    customerName: 'Test Customer',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('lead domain helpers', () => {
  describe('groupLeadsByStatus', () => {
    it('returns empty buckets for empty input', () => {
      const out = groupLeadsByStatus([]);
      for (const s of LEAD_STATUS_ORDER) expect(out[s]).toEqual([]);
    });

    it('buckets leads by status', () => {
      const leads: Lead[] = [
        makeLead({ status: 'new' }),
        makeLead({ status: 'new' }),
        makeLead({ status: 'won', estimatedValue: 500 }),
        makeLead({ status: 'lost' }),
      ];
      const out = groupLeadsByStatus(leads);
      expect(out.new.length).toBe(2);
      expect(out.won.length).toBe(1);
      expect(out.lost.length).toBe(1);
      expect(out.contacted.length).toBe(0);
      expect(out.estimate_sent.length).toBe(0);
    });

    it('sorts each column newest-first', () => {
      const older = makeLead({
        id: 'old',
        status: 'new',
        createdAt: new Date(Date.now() - 10 * MS_PER_DAY).toISOString(),
      });
      const newer = makeLead({
        id: 'new',
        status: 'new',
        createdAt: new Date().toISOString(),
      });
      const out = groupLeadsByStatus([older, newer]);
      expect(out.new[0].id).toBe('new');
      expect(out.new[1].id).toBe('old');
    });
  });

  describe('pipelineValue', () => {
    it('sums estimatedValue across non-lost leads', () => {
      const leads: Lead[] = [
        makeLead({ status: 'new', estimatedValue: 100 }),
        makeLead({ status: 'estimate_sent', estimatedValue: 200 }),
        makeLead({ status: 'won', estimatedValue: 1000 }),
        makeLead({ status: 'lost', estimatedValue: 500 }), // excluded
      ];
      expect(pipelineValue(leads)).toBe(1300);
    });

    it('handles missing estimatedValue', () => {
      const leads: Lead[] = [
        makeLead({ status: 'new', estimatedValue: 100 }),
        makeLead({ status: 'contacted' }), // no value
      ];
      expect(pipelineValue(leads)).toBe(100);
    });

    it('returns 0 for empty input', () => {
      expect(pipelineValue([])).toBe(0);
    });

    it('returns 0 when only lost leads exist', () => {
      expect(pipelineValue([makeLead({ status: 'lost', estimatedValue: 500 })])).toBe(0);
    });
  });

  describe('winRate', () => {
    it('returns 0 when no closed leads', () => {
      const leads: Lead[] = [makeLead({ status: 'new' }), makeLead({ status: 'contacted' })];
      expect(winRate(leads)).toBe(0);
    });

    it('returns 100 when every closed lead won', () => {
      const now = new Date().toISOString();
      const leads: Lead[] = [
        makeLead({ status: 'won', convertedAt: now }),
        makeLead({ status: 'won', convertedAt: now }),
      ];
      expect(winRate(leads)).toBe(100);
    });

    it('returns 50 with one won + one lost', () => {
      const now = new Date().toISOString();
      const leads: Lead[] = [
        makeLead({ status: 'won', convertedAt: now }),
        makeLead({ status: 'lost', convertedAt: now }),
      ];
      expect(winRate(leads)).toBe(50);
    });

    it('excludes leads converted before the window', () => {
      const old = new Date(Date.now() - 200 * MS_PER_DAY).toISOString();
      const recent = new Date().toISOString();
      const leads: Lead[] = [
        // outside default 90d window
        makeLead({ status: 'won', convertedAt: old }),
        makeLead({ status: 'lost', convertedAt: old }),
        // inside window
        makeLead({ status: 'lost', convertedAt: recent }),
      ];
      expect(winRate(leads, 90)).toBe(0); // only the recent lost counts
    });

    it('rounds to integer percent', () => {
      const now = new Date().toISOString();
      const leads: Lead[] = [
        makeLead({ status: 'won', convertedAt: now }),
        makeLead({ status: 'lost', convertedAt: now }),
        makeLead({ status: 'lost', convertedAt: now }),
      ];
      expect(winRate(leads)).toBe(33); // 1/3 → 33%
    });
  });
});
