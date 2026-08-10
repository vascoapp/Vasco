// =============================================================================
// jobUpdatesToRowPayload tests (R304)
// =============================================================================
// Was the silent FE→BE drift bug. Schedule edits, signature captures, address
// changes — all silently dropped before R304's mapper landed. These tests
// pin the camelCase → snake_case translation so future updates can't reintroduce
// the regression.
// =============================================================================

import { jobUpdatesToRowPayload } from '../mappers';

describe('jobUpdatesToRowPayload', () => {
  it('maps schedule edit fields', () => {
    const out = jobUpdatesToRowPayload({
      scheduledDate: '2026-05-10',
      scheduledStartTime: '09:00',
      scheduledEndTime: '12:00',
      estimatedDuration: 3,
    });
    expect(out).toEqual({
      scheduled_date: '2026-05-10',
      scheduled_start_time: '09:00',
      scheduled_end_time: '12:00',
      estimated_duration: 3,
    });
  });

  it('maps financial fields', () => {
    const out = jobUpdatesToRowPayload({
      quotedAmount: 1500,
      agreedAmount: 1450,
    });
    expect(out).toEqual({
      quoted_amount: 1500,
      agreed_amount: 1450,
    });
  });

  it('maps R301 signature fields', () => {
    const out = jobUpdatesToRowPayload({
      signatureSvg: 'data:image/png;base64,abc',
      customerSignoffAt: '2026-05-02T12:00:00Z',
    });
    expect(out).toEqual({
      signature_svg: 'data:image/png;base64,abc',
      customer_signoff_at: '2026-05-02T12:00:00Z',
    });
  });

  it('flattens nested address into address_*', () => {
    const out = jobUpdatesToRowPayload({
      address: {
        street: 'Damrak 1',
        city: 'Amsterdam',
        postcode: '1012',
        country: 'NL',
        accessNotes: 'Side entrance',
        parkingNotes: 'Free after 18:00',
      },
    });
    expect(out).toEqual({
      address_street: 'Damrak 1',
      address_city: 'Amsterdam',
      address_postcode: '1012',
      address_country: 'NL',
      address_access_notes: 'Side entrance',
      address_parking_notes: 'Free after 18:00',
    });
  });

  it('maps customer + status + trade + priority', () => {
    const out = jobUpdatesToRowPayload({
      customerId: 'cust-1',
      status: 'completed',
      trade: 'plumbing',
      priority: 'high',
    });
    expect(out).toEqual({
      customer_id: 'cust-1',
      status: 'completed',
      trade: 'plumbing',
      priority: 'high',
    });
  });

  it('maps site contact + completedAt', () => {
    const out = jobUpdatesToRowPayload({
      siteContact: 'Mark',
      sitePhone: '+31612345678',
      completedAt: '2026-05-02T15:00:00Z',
    });
    expect(out).toEqual({
      site_contact: 'Mark',
      site_phone: '+31612345678',
      completed_at: '2026-05-02T15:00:00Z',
    });
  });

  it('maps roomsAreas array + specifications text', () => {
    const out = jobUpdatesToRowPayload({
      roomsAreas: ['Bathroom', 'Kitchen'],
      specifications: 'Tile + grout',
    });
    expect(out).toEqual({
      rooms_areas: ['Bathroom', 'Kitchen'],
      specifications: 'Tile + grout',
    });
  });

  it('drops FE-only / separate-table fields silently', () => {
    const out = jobUpdatesToRowPayload({
      materials: [] as any,
      photos: [] as any,
      notes: [] as any,
      invoiceId: 'inv-1',
      actualHours: 5,
      actualCost: 200,
    } as any);
    expect(out).toEqual({});
  });

  // Migration 20260806000005: quoteId is no longer "derived". Same shape as the
  // R66r12 timeEntries note below — the previous version of this test asserted
  // the drop as correct, which is how a broken contract survives a green suite.
  //
  // What it cost: the quote→job→invoice chain is the thing this product sells
  // and it could not be followed in the data at all, only guessed at by
  // matching names and amounts. The link lived in React state and died on cold
  // start.
  it('persists quoteId — the quote→job link is data, not a derived value', () => {
    expect(jobUpdatesToRowPayload({ quoteId: 'q-1' } as any)).toEqual({ quote_id: 'q-1' });
  });

  // R66 round 12: timeEntries is no longer dropped — it persists as
  // jobs.time_entries JSONB. The previous "drops" test was encoding the bug
  // that lost every contractor's logged hours on cold start.
  it('persists timeEntries as time_entries JSONB column', () => {
    const entries = [{ id: 'te-1', date: '2026-05-07', hours: 4.5, clockIn: '08:00', clockOut: '12:30' }];
    const out = jobUpdatesToRowPayload({
      timeEntries: entries as any,
    });
    expect(out).toEqual({ time_entries: entries });
  });

  it('persists empty timeEntries array (clearing all hours)', () => {
    const out = jobUpdatesToRowPayload({ timeEntries: [] as any });
    expect(out).toEqual({ time_entries: [] });
  });

  it('drops `undefined` keys but preserves explicit `null`', () => {
    const out = jobUpdatesToRowPayload({
      customerId: null as any,
      title: 'Updated',
    });
    expect(out).toEqual({
      customer_id: null,
      title: 'Updated',
    });
  });

  it('empty input → empty payload', () => {
    expect(jobUpdatesToRowPayload({})).toEqual({});
  });

  it('partial address only sets the present sub-keys', () => {
    const out = jobUpdatesToRowPayload({
      address: { street: 'New street' } as any,
    });
    expect(out).toEqual({
      address_street: 'New street',
    });
  });

  // These three became user-editable on the job detail screen, which makes them
  // user-CLEARABLE. A bare `undefined` leaves a key that JSON.stringify drops,
  // so the column keeps its old value and the cleared field returns on cold
  // start — the learnings #143 shape, already fixed once for targetEndDate.
  describe('site contact and notes can be cleared, not just set', () => {
    it('maps values through', () => {
      expect(jobUpdatesToRowPayload({
        siteContact: 'Building concierge',
        sitePhone: '+31 20 555 1235',
        specifications: 'Tiles 5cm higher than drawing',
      })).toEqual({
        site_contact: 'Building concierge',
        site_phone: '+31 20 555 1235',
        specifications: 'Tiles 5cm higher than drawing',
      });
    });

    it('turns an explicit undefined into null so the column actually empties', () => {
      const out = jobUpdatesToRowPayload({
        siteContact: undefined,
        sitePhone: undefined,
        specifications: undefined,
      });
      expect(out).toEqual({ site_contact: null, site_phone: null, specifications: null });
      // The point of the null: a key whose value is undefined does not survive
      // serialisation, so the clear would never reach the database.
      expect(JSON.parse(JSON.stringify(out))).toEqual(out);
    });

    it('leaves them out entirely when not mentioned', () => {
      expect(jobUpdatesToRowPayload({ title: 'x' })).toEqual({ title: 'x' });
    });
  });
});
