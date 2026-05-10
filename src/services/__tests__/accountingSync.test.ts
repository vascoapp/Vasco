/**
 * @jest-environment node
 *
 * R66r51 — accountingSyncService.runAccountingPollIfDue (close R66r50 dormancy).
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
  },
}));

const mockGetAccountingConfig = jest.fn();
const mockSyncPaymentStatus = jest.fn();
jest.mock('../../integrations/accounting', () => ({
  getAccountingConfig: (...args: any[]) => mockGetAccountingConfig(...args),
  syncPaymentStatus: (...args: any[]) => mockSyncPaymentStatus(...args),
}));

const mockMarkInvoicePaid = jest.fn();
const mockSnapshot = { invoices: [] as any[] };
jest.mock('../../state/appStateSnapshot', () => ({
  getAppStateSnapshot: () => mockSnapshot,
  getAppStateMutators: () => ({
    markInvoicePaid: mockMarkInvoicePaid,
    refreshData: jest.fn(),
  }),
}));

import { runAccountingPollIfDue } from '../accountingSyncService';

beforeEach(() => {
  jest.clearAllMocks();
  mockSnapshot.invoices = [];
});

describe('runAccountingPollIfDue', () => {
  it('no-ops when no accounting provider connected', async () => {
    mockGetAccountingConfig.mockResolvedValue({ connected: false, provider: 'none' });
    const res = await runAccountingPollIfDue();
    expect(res.paidCount).toBe(0);
    expect(mockSyncPaymentStatus).not.toHaveBeenCalled();
  });

  it('no-ops when invoice list is empty', async () => {
    mockGetAccountingConfig.mockResolvedValue({ connected: true, provider: 'moneybird' });
    mockSnapshot.invoices = [];
    const res = await runAccountingPollIfDue();
    expect(res.paidCount).toBe(0);
    expect(mockSyncPaymentStatus).not.toHaveBeenCalled();
  });

  it('marks matching invoices paid when provider returns paid ids', async () => {
    mockGetAccountingConfig.mockResolvedValue({ connected: true, provider: 'moneybird' });
    mockSyncPaymentStatus.mockResolvedValue({ paidInvoiceIds: ['inv-1', 'INV-2026-002'] });
    mockSnapshot.invoices = [
      { id: 'inv-1', status: 'sent', invoiceNumber: 'INV-2026-001', total: 500 },
      { id: 'local-uuid-2', status: 'sent', invoiceNumber: 'INV-2026-002', total: 800 },
      { id: 'inv-3', status: 'sent', invoiceNumber: 'INV-2026-003', total: 1200 },
      { id: 'inv-4', status: 'paid', invoiceNumber: 'INV-2026-004', total: 300 },
    ];

    const res = await runAccountingPollIfDue();
    expect(res.paidCount).toBe(2);
    expect(mockMarkInvoicePaid).toHaveBeenCalledWith('inv-1');
    expect(mockMarkInvoicePaid).toHaveBeenCalledWith('local-uuid-2');
    expect(mockMarkInvoicePaid).not.toHaveBeenCalledWith('inv-3');
    expect(mockMarkInvoicePaid).not.toHaveBeenCalledWith('inv-4');
  });

  it('swallows sync errors', async () => {
    mockGetAccountingConfig.mockResolvedValue({ connected: true, provider: 'moneybird' });
    mockSyncPaymentStatus.mockRejectedValue(new Error('network down'));
    mockSnapshot.invoices = [{ id: 'inv-1', status: 'sent' }];

    const res = await runAccountingPollIfDue();
    expect(res.paidCount).toBe(0);
    expect(res.error).toBeTruthy();
    expect(mockMarkInvoicePaid).not.toHaveBeenCalled();
  });
});
