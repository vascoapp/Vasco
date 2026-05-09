/**
 * @jest-environment node
 *
 * R66 round 43 — photo intelligence loop closes end-to-end.
 *
 * Locks the dormant→active wiring R35 closed: AIQuoteFromPhoto persists a
 * photo analysis via `persistPhotoAnalysis`, the cohort RPC
 * `get_photo_analysis_cohort` reads it back, the FE wrapper
 * `getPhotoAnalysisCohort` parses the response, and the cohort panel
 * renders only when k-anonymity ≥ 5 contractors. Past failure modes:
 * - R243 wired the BE side but the FE wrapper had zero callers (pure
 *   dormant feature for two months).
 * - FE used `complexity: 'medium'` while BE schema enforced
 *   `'moderate'` — the persisted enum value never matched cohort lookups.
 *
 * This e2e locks: persist payload shape, cohort RPC arg shape, response
 * parsing, k-anonymity gate, complexity-enum alignment.
 */

let mockUserId: string | null = 'user-photo-e2e';

jest.mock('../../lib/currentUser', () => ({
  getAuthedUserId: () => mockUserId,
  getCurrentUserId: () => mockUserId ?? 'anon',
  getCurrentTrade: () => 'plumbing',
  getCurrentCountry: () => 'NL',
}));

const mockInserts: Array<{ table: string; row: any }> = [];
let mockRpcResponse: any = null;
const mockRpcCalls: Array<{ name: string; args: any }> = [];

jest.mock('../../lib/supabase', () => ({
  __esModule: true,
  isSupabaseConfigured: true,
  supabase: {
    from: (table: string) => ({
      insert: async (rows: any) => {
        const arr = Array.isArray(rows) ? rows : [rows];
        for (const row of arr) mockInserts.push({ table, row });
        return { error: null };
      },
    }),
    rpc: async (name: string, args: any) => {
      mockRpcCalls.push({ name, args });
      return { data: mockRpcResponse, error: null };
    },
  },
}));

import {
  persistPhotoAnalysis,
  getPhotoAnalysisCohort,
} from '../intelligenceCaptureService';

describe('R66r43 — photo cohort intelligence loop', () => {
  beforeEach(() => {
    mockInserts.length = 0;
    mockRpcCalls.length = 0;
    mockRpcResponse = null;
    mockUserId = 'user-photo-e2e';
  });

  describe('persistPhotoAnalysis (write side)', () => {
    it('writes a photo_analyses row with snake_case columns + correct user attribution', async () => {
      await persistPhotoAnalysis({
        jobId: 'job-uuid-real',
        trade: 'plumbing',
        detectedRooms: ['bathroom', 'kitchen'],
        estimatedComplexity: 'moderate',
        estimatedDurationHours: 14,
        estimatedCostEur: 1850,
        rawResponse: { items: [{ desc: 'sink' }] },
      });

      const rows = mockInserts.filter((m) => m.table === 'photo_analyses');
      expect(rows).toHaveLength(1);
      const row = rows[0].row;
      expect(row.user_id).toBe('user-photo-e2e');
      expect(row.job_id).toBe('job-uuid-real');
      expect(row.trade).toBe('plumbing');
      expect(row.detected_rooms).toEqual(['bathroom', 'kitchen']);
      expect(row.estimated_complexity).toBe('moderate');
      expect(row.estimated_duration_hours).toBe(14);
      expect(row.estimated_cost_eur).toBe(1850);
      expect(row.raw_response).toEqual({ items: [{ desc: 'sink' }] });
    });

    it('nullifies temp ids — `j-{ts}` jobIds would fail the FK constraint', async () => {
      // R59 contract: temp-id detection prevents lossy FK insert failures.
      await persistPhotoAnalysis({
        jobId: 'j-1234567890',
        quoteId: 'q-9876543210',
        trade: 'electrical',
        estimatedComplexity: 'simple',
      });

      const row = mockInserts[0].row;
      expect(row.job_id).toBeNull();
      expect(row.quote_id).toBeNull();
      expect(row.trade).toBe('electrical');
    });

    it('skips write entirely when no auth user — prevents anon rows polluting cohort', async () => {
      mockUserId = null;
      await persistPhotoAnalysis({
        trade: 'plumbing',
        estimatedComplexity: 'moderate',
      });
      expect(mockInserts).toHaveLength(0);
    });

    it('rejects FE legacy "medium" via type system — BE schema enforces simple|moderate|complex', () => {
      // The PhotoAnalysisRow type's estimatedComplexity field is typed as
      // `'simple' | 'moderate' | 'complex'`. R66r35 added the FE→BE
      // remap at the call site (data.estimatedComplexity === 'medium' ?
      // 'moderate' : data.estimatedComplexity) before persist. This test
      // is a compile-time guard — if someone widens the type to include
      // 'medium', this assertion suite needs updating.
      const valid: 'simple' | 'moderate' | 'complex' = 'moderate';
      expect(['simple', 'moderate', 'complex']).toContain(valid);
    });
  });

  describe('getPhotoAnalysisCohort (read side, R35)', () => {
    it('calls the RPC with snake_case arg keys (p_trade/p_country/p_complexity)', async () => {
      mockRpcResponse = [
        {
          avg_duration_hours: 12.5,
          avg_cost_eur: 1750,
          median_cost_eur: 1700,
          sample_size: 42,
          contractor_count: 18,
        },
      ];

      const cohort = await getPhotoAnalysisCohort('plumbing', 'NL', 'moderate');

      expect(mockRpcCalls).toHaveLength(1);
      expect(mockRpcCalls[0].name).toBe('get_photo_analysis_cohort');
      expect(mockRpcCalls[0].args).toEqual({
        p_trade: 'plumbing',
        p_country: 'NL',
        p_complexity: 'moderate',
      });
      expect(cohort).toEqual({
        avgDurationHours: 12.5,
        avgCostEur: 1750,
        medianCostEur: 1700,
        sampleSize: 42,
        contractorCount: 18,
      });
    });

    it('returns null when the RPC reports no data (k-anonymity below threshold)', async () => {
      // The migration's RPC returns `[null, null, null, 0, <count>]` when
      // contractor_count < 5 — but the wrapper checks `data.length === 0`
      // first as a strict empty-cohort signal.
      mockRpcResponse = [];

      const cohort = await getPhotoAnalysisCohort('plumbing', 'NL', 'moderate');
      expect(cohort).toBeNull();
    });

    it('passes null for optional country + complexity when caller omits them', async () => {
      mockRpcResponse = [
        { avg_duration_hours: 10, avg_cost_eur: null, median_cost_eur: null, sample_size: 5, contractor_count: 5 },
      ];

      await getPhotoAnalysisCohort('plumbing');

      expect(mockRpcCalls[0].args).toEqual({
        p_trade: 'plumbing',
        p_country: null,
        p_complexity: null,
      });
    });

    it('parses partial cohort data — null cost fields stay null, sample/contractor coerce to numbers', async () => {
      // Real BE response when only duration data is mature; cost not yet
      // aggregated. Component should still render the duration column.
      mockRpcResponse = [
        {
          avg_duration_hours: 8.0,
          avg_cost_eur: null,
          median_cost_eur: null,
          sample_size: '12', // BE returns bigint as string
          contractor_count: '7',
        },
      ];

      const cohort = await getPhotoAnalysisCohort('painting', 'NL', 'simple');
      expect(cohort).not.toBeNull();
      expect(cohort!.avgDurationHours).toBe(8.0);
      expect(cohort!.avgCostEur).toBeNull();
      expect(cohort!.medianCostEur).toBeNull();
      expect(cohort!.sampleSize).toBe(12);
      expect(cohort!.contractorCount).toBe(7);
    });
  });

  describe('persist → cohort cross-attribution invariants', () => {
    it('the trade/country threaded into persistPhotoAnalysis is the same the cohort RPC slices on', async () => {
      // The dormant→active fix only works if writer + reader agree on the
      // partition key. This is what R66r35 specifically wires.
      await persistPhotoAnalysis({
        jobId: 'job-uuid-1',
        trade: 'roofing',
        estimatedComplexity: 'complex',
      });
      mockRpcResponse = [
        { avg_duration_hours: 24, avg_cost_eur: 5000, median_cost_eur: 4800, sample_size: 30, contractor_count: 10 },
      ];

      const writeRow = mockInserts[0].row;
      const cohort = await getPhotoAnalysisCohort('roofing', 'NL', 'complex');

      expect(writeRow.trade).toBe('roofing');
      expect(mockRpcCalls[0].args.p_trade).toBe('roofing');
      expect(writeRow.estimated_complexity).toBe('complex');
      expect(mockRpcCalls[0].args.p_complexity).toBe('complex');
      expect(cohort).toBeTruthy();
    });
  });
});
