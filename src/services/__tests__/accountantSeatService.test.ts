/**
 * @jest-environment node
 *
 * ACCOUNTANT SEAT — the contractor side of the collaboration layer.
 *
 * A seat is standing access to someone else's financial records, so the
 * properties worth pinning are about restraint rather than features: one link
 * per adviser, no silent second grant, and no link handed out that does not
 * work yet.
 *
 * The SQL half (RPC projection, expiry/revoke discriminator, anon having no
 * grant on the table) was verified directly against production — it cannot be
 * exercised from here, and asserting it in a mock would prove only that the
 * mock agrees with itself.
 */

let mockConfigured = true;
const mockFrom = jest.fn();
const mockGetUser = jest.fn();

jest.mock('../../lib/supabase', () => ({
  get isSupabaseConfigured() { return mockConfigured; },
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: { getUser: () => mockGetUser() },
  },
}));

import { publishSeat, listSeats, revokeSeat } from '../accountantSeatService';

const HANDOVER = {
  businessName: 'Test BV', country: 'DE',
  periodStart: '2026-04-01', periodEnd: '2026-06-30',
  invoices: [], totals: { invoiced: 0, count: 0 },
  notFiled: [], awaitingConfirmation: [], mandateApplies: true,
} as never;

const INPUT = {
  label: 'Steuerberater Klein',
  businessName: 'Test BV',
  country: 'DE',
  periodStart: '2026-04-01',
  periodEnd: '2026-06-30',
  handover: HANDOVER,
};

const ROW = {
  id: 'seat-1', label: 'Steuerberater Klein', access_code: 'abc123abc123abc123abc123abc123ab',
  period_start: '2026-04-01', period_end: '2026-06-30',
  created_at: '2026-08-06T10:00:00Z', expires_at: '2027-02-02T10:00:00Z',
  last_viewed_at: null, view_count: 0,
};

/** Minimal chainable stub — only the calls this service actually makes. */
function tableStub(opts: { existing?: unknown; returned?: unknown }) {
  const captured: { inserted?: any; updated?: any } = {};
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    is: () => chain,
    ilike: () => chain,
    order: () => Promise.resolve({ data: [ROW], error: null }),
    maybeSingle: () => Promise.resolve({ data: opts.existing ?? null, error: null }),
    single: () => Promise.resolve({ data: opts.returned ?? ROW, error: null }),
    insert: (payload: any) => { captured.inserted = payload; return chain; },
    update: (payload: any) => { captured.updated = payload; return chain; },
  };
  return { chain, captured };
}

beforeEach(() => {
  mockConfigured = true;
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
});

describe('publishSeat', () => {
  it('mints a 128-bit access code and returns the adviser URL', async () => {
    const { chain, captured } = tableStub({});
    mockFrom.mockReturnValue(chain);

    const seat = await publishSeat(INPUT);

    expect(captured.inserted.access_code).toMatch(/^[0-9a-f]{32}$/);
    expect(captured.inserted.user_id).toBe('user-1');
    expect(seat.url).toBe(`https://admin.vascobuild.com/accountant/${ROW.access_code}`);
  });

  it('refreshes the existing seat instead of minting a second link', async () => {
    // The accountant bookmarked a URL. Handing them a new one every quarter
    // guarantees they eventually open a stale link and read the wrong period,
    // which on a filing surface is worse than having no link at all.
    const { chain, captured } = tableStub({ existing: { id: 'seat-1' } });
    mockFrom.mockReturnValue(chain);

    await publishSeat(INPUT);

    expect(captured.inserted).toBeUndefined();
    expect(captured.updated).toBeTruthy();
    // A refresh must not re-issue the credential.
    expect(captured.updated.access_code).toBeUndefined();
    expect(captured.updated.period_end).toBe('2026-06-30');
  });

  it('refuses to publish while offline rather than hand out a dead link', async () => {
    mockConfigured = false;
    await expect(publishSeat(INPUT)).rejects.toThrow('offline');
  });

  it('requires a name, so seats can be told apart when revoking', async () => {
    const { chain } = tableStub({});
    mockFrom.mockReturnValue(chain);
    await expect(publishSeat({ ...INPUT, label: '   ' })).rejects.toThrow('label_required');
  });
});

describe('listSeats', () => {
  it('maps rows to seats with the URL built from the access code', async () => {
    const { chain } = tableStub({});
    mockFrom.mockReturnValue(chain);
    const seats = await listSeats();
    expect(seats).toHaveLength(1);
    expect(seats[0].lastViewedAt).toBeNull();
    expect(seats[0].url).toContain('/accountant/');
  });

  it('returns empty rather than throwing when there is no backend', async () => {
    mockConfigured = false;
    await expect(listSeats()).resolves.toEqual([]);
  });
});

describe('revokeSeat', () => {
  it('marks revoked_at rather than deleting the row', async () => {
    // Who could see this, between when and when, should survive the
    // withdrawal — the RPC treats revoked and expired alike, so the link stops
    // working immediately either way.
    const captured: any = {};
    const chain: any = {
      update: (payload: any) => { captured.updated = payload; return chain; },
      eq: () => Promise.resolve({ error: null }),
    };
    mockFrom.mockReturnValue(chain);

    await expect(revokeSeat('seat-1')).resolves.toBe(true);
    expect(captured.updated.revoked_at).toBeTruthy();
  });
});
