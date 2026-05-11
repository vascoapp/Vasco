/**
 * @jest-environment node
 *
 * R66r55: signatureService BE-backed audit-trail.
 */

const mockState = {
  authUser: { id: 'user-123' } as { id: string } | null,
  insertedRows: [] as Record<string, unknown>[],
  insertError: null as null | { message: string },
  rpcArgs: null as null | Record<string, unknown>,
  rpcReturn: 'sig-uuid-1' as string | null,
  rpcError: null as null | { message: string },
};

jest.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: mockState.authUser } }),
    },
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        mockState.insertedRows.push(row);
        return {
          select: () => ({
            maybeSingle: async () =>
              mockState.insertError
                ? { data: null, error: mockState.insertError }
                : { data: { id: 'sig-uuid-1' }, error: null },
          }),
        };
      },
      select: () => ({
        eq: () => ({
          order: async () => ({ data: [], error: null }),
        }),
      }),
    }),
    rpc: async (_name: string, args: Record<string, unknown>) => {
      mockState.rpcArgs = args;
      return mockState.rpcError
        ? { data: null, error: mockState.rpcError }
        : { data: mockState.rpcReturn, error: null };
    },
  },
}));

import {
  recordContractorSignature,
  recordPortalSignature,
  getLegalText,
  signatureHtmlBlock,
} from '../signatureService';

beforeEach(() => {
  mockState.authUser = { id: 'user-123' };
  mockState.insertedRows = [];
  mockState.insertError = null;
  mockState.rpcArgs = null;
  mockState.rpcReturn = 'sig-uuid-1';
  mockState.rpcError = null;
});

describe('recordContractorSignature', () => {
  test('inserts a signature row scoped to the contractor user', async () => {
    const id = await recordContractorSignature({
      jobId: 'job-abc',
      signerName: 'Jan de Vries',
      signatureSvg: '<svg></svg>',
    });
    expect(id).toBe('sig-uuid-1');
    expect(mockState.insertedRows).toHaveLength(1);
    expect(mockState.insertedRows[0]).toMatchObject({
      job_id: 'job-abc',
      contractor_user_id: 'user-123',
      signer_name: 'Jan de Vries',
      signer_role: 'customer',
      signature_svg: '<svg></svg>',
    });
  });

  test('returns null when not authenticated', async () => {
    mockState.authUser = null;
    const id = await recordContractorSignature({
      jobId: 'job-abc',
      signerName: 'X',
      signatureSvg: '<svg/>',
    });
    expect(id).toBeNull();
    expect(mockState.insertedRows).toHaveLength(0);
  });

  test('returns null when insert errors out', async () => {
    mockState.insertError = { message: 'rls denied' };
    const id = await recordContractorSignature({
      jobId: 'job-abc',
      signerName: 'X',
      signatureSvg: '<svg/>',
    });
    expect(id).toBeNull();
  });
});

describe('recordPortalSignature', () => {
  test('calls the SECURITY DEFINER RPC with the access code', async () => {
    const id = await recordPortalSignature({
      accessCode: 'CAP-ABCD-1234',
      signerName: 'Marie Dubois',
      signatureSvg: '<svg></svg>',
      userAgent: 'Mozilla/5.0',
    });
    expect(id).toBe('sig-uuid-1');
    expect(mockState.rpcArgs).toMatchObject({
      p_access_code: 'CAP-ABCD-1234',
      p_signer_name: 'Marie Dubois',
      p_signer_role: 'customer',
      p_signature_svg: '<svg></svg>',
      p_user_agent: 'Mozilla/5.0',
    });
    // ip_hash is server-derived — must NOT be in the RPC args.
    expect(mockState.rpcArgs).not.toHaveProperty('p_ip_hash');
  });

  test('returns null on RPC error (invalid access code)', async () => {
    mockState.rpcError = { message: 'invalid_or_expired_access_code' };
    const id = await recordPortalSignature({
      accessCode: 'BAD-CODE',
      signerName: 'X',
      signatureSvg: '<svg/>',
    });
    expect(id).toBeNull();
  });
});

describe('getLegalText', () => {
  test('returns NL text for job_closeout', () => {
    const txt = getLegalText('job_closeout', 'nl');
    expect(txt).toContain('werkzaamheden');
  });
  test('falls back to English for unknown language', () => {
    const txt = getLegalText('handover', 'xx');
    expect(txt).toContain('completed work');
  });
});

describe('signatureHtmlBlock', () => {
  test('embeds raw SVG markup inline', () => {
    const html = signatureHtmlBlock({
      signatureSvg: '<svg><path/></svg>',
      signerName: 'Jan',
      signedAt: '2026-05-11T10:00:00Z',
      legalText: 'I confirm the work.',
    });
    expect(html).toContain('<svg><path/></svg>');
    expect(html).toContain('Jan');
    expect(html).toContain('I confirm the work.');
  });
  test('uses img tag for data: URI signatures', () => {
    const html = signatureHtmlBlock({
      signatureSvg: 'data:image/png;base64,iVBORw==',
      signerName: 'Marie',
    });
    expect(html).toContain('<img src="data:image/png;base64,iVBORw==');
  });
  test('escapes HTML in signer name', () => {
    const html = signatureHtmlBlock({
      signatureSvg: '<svg/>',
      signerName: '<script>alert(1)</script>',
    });
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });
});
