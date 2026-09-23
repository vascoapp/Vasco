/**
 * @jest-environment node
 *
 * R66 round 27 — pending job photos queue.
 * Verifies: queuePhoto persists metadata; rewriteJobIds responds to idRemap;
 * flushQueue retries through uploadJobPhoto; temp-id entries skip; a photo
 * that keeps failing is NEVER deleted — it slows to one try a day (A3).
 */

const mockFsState: Record<string, Uint8Array> = {};

jest.mock('@react-native-async-storage/async-storage', () => {
  const mockStore: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => (k in mockStore ? mockStore[k] : null)),
      setItem: jest.fn(async (k: string, v: string) => { mockStore[k] = v; }),
      removeItem: jest.fn(async (k: string) => { delete mockStore[k]; }),
      __mockStore: mockStore,
    },
  };
});

jest.mock('expo-file-system', () => {
  const mockFiles: Record<string, Uint8Array> = mockFsState;
  function Directory(this: any, dirBase: any, sub?: string) {
    this.base = dirBase;
    this.sub = sub;
  }
  Object.defineProperty(Directory.prototype, 'exists', { get() { return true; } });
  Directory.prototype.create = function () {};
  function FileMock(this: any, ...args: any[]) {
    if (args.length === 1) {
      this.uri = typeof args[0] === 'string' ? args[0] : `${args[0]?.base ?? 'doc'}/${args[0]?.sub ?? ''}/file`;
    } else {
      this.uri = `${args[0]?.base ?? 'doc'}/${args[0]?.sub ?? ''}/${args[1] ?? 'file'}`;
    }
  }
  Object.defineProperty(FileMock.prototype, 'exists', { get(this: any) { return this.uri in mockFiles; } });
  FileMock.prototype.create = function (this: any) { mockFiles[this.uri] = new Uint8Array(); };
  FileMock.prototype.write = function (this: any, bytes: Uint8Array) { mockFiles[this.uri] = bytes; };
  FileMock.prototype.bytes = function (this: any) { return Promise.resolve(mockFiles[this.uri] ?? new Uint8Array()); };
  FileMock.prototype.delete = function (this: any) { delete mockFiles[this.uri]; };
  return {
    __esModule: true,
    Directory,
    File: FileMock,
    Paths: { document: 'doc' },
  };
});

let mockUploadCalls: Array<{ jobId: string }> = [];
let mockUploadShouldFail = false;

jest.mock('../jobPhotoService', () => ({
  __esModule: true,
  uploadJobPhoto: jest.fn(async (input: any) => {
    mockUploadCalls.push({ jobId: input.jobId });
    if (mockUploadShouldFail) return null;
    return {
      id: `bephoto-${Date.now()}`,
      jobId: input.jobId,
      storagePath: 'remote/path',
      kind: input.kind ?? 'during',
      caption: input.caption,
      takenAt: new Date().toISOString(),
    };
  }),
}));

// The queues upload only for the contractor who owns them (sweep A4): sign
// one in. Everything else in currentUser stays real.
jest.mock('../../lib/currentUser', () => ({
  ...jest.requireActual('../../lib/currentUser'),
  getAuthedUserId: () => '11111111-1111-1111-1111-111111111111',
}));

jest.mock('../../lib/idShape', () => ({
  __esModule: true,
  isTempIdFast: (id: string) => typeof id === 'string' && /^j-/.test(id),
}));

beforeEach(async () => {
  mockUploadCalls = [];
  mockUploadShouldFail = false;
  for (const k of Object.keys(mockFsState)) delete mockFsState[k];
  const { clearAll } = require('../pendingJobPhotosQueue');
  await clearAll();
});

describe('pendingJobPhotosQueue — R66 round 27', () => {
  test('queuePhoto persists base64 + metadata', async () => {
    const { queuePhoto, listPendingForJob } = require('../pendingJobPhotosQueue');
    const rec = await queuePhoto({
      jobId: 'real-uuid-123',
      imageBase64: 'aGVsbG8=', // "hello"
      kind: 'before',
      caption: 'wall',
    });
    expect(rec.jobId).toBe('real-uuid-123');
    expect(rec.kind).toBe('before');
    expect(rec.id).toMatch(/^pp-/);
    const pending = await listPendingForJob('real-uuid-123');
    expect(pending).toHaveLength(1);
    expect(pending[0].caption).toBe('wall');
  });

  test('flushQueue uploads pending records and removes them on success', async () => {
    const { queuePhoto, flushQueue, listPendingForJob } = require('../pendingJobPhotosQueue');
    await queuePhoto({ jobId: 'real-uuid-A', imageBase64: 'aGVsbG8=' });
    await queuePhoto({ jobId: 'real-uuid-B', imageBase64: 'aGVsbG8=' });
    const result = await flushQueue();
    expect(result.uploaded).toBe(2);
    expect(result.remaining).toBe(0);
    expect(mockUploadCalls).toHaveLength(2);
    expect(await listPendingForJob('real-uuid-A')).toHaveLength(0);
  });

  test('flushQueue skips temp-id entries (R59 contract)', async () => {
    const { queuePhoto, flushQueue } = require('../pendingJobPhotosQueue');
    await queuePhoto({ jobId: 'j-temp-123', imageBase64: 'aGVsbG8=' });
    const result = await flushQueue();
    expect(result.uploaded).toBe(0);
    expect(result.remaining).toBe(1);
    expect(mockUploadCalls).toHaveLength(0);
  });

  test('flushQueue keeps entry on retryable failure', async () => {
    const { queuePhoto, flushQueue, listPendingForJob } = require('../pendingJobPhotosQueue');
    mockUploadShouldFail = true;
    await queuePhoto({ jobId: 'real-uuid-X', imageBase64: 'aGVsbG8=' });
    const result = await flushQueue();
    expect(result.uploaded).toBe(0);
    expect(result.remaining).toBe(1);
    const pending = await listPendingForJob('real-uuid-X');
    expect(pending[0].attempts).toBe(1);
  });

  // Sweep 2026-09-23, A3: this used to drop the entry AND delete the file —
  // the only copy of the customer's photo — after 10 failures, and every
  // offline foreground counted as one.
  test('a photo that keeps failing is never deleted, and uploads once it can', async () => {
    const { queuePhoto, flushQueue, listPendingForJob } = require('../pendingJobPhotosQueue');
    mockUploadShouldFail = true;
    await queuePhoto({ jobId: 'real-uuid-P', imageBase64: 'aGVsbG8=' });
    for (let i = 0; i < 12; i++) await flushQueue();
    const pending = await listPendingForJob('real-uuid-P');
    expect(pending).toHaveLength(1);
    // The file itself — the only copy of the photo — is still on disk.
    expect(pending[0].fileUri in mockFsState).toBe(true);
    // Past 10 failures: at most one try a day, then it goes through.
    const calls = mockUploadCalls.length;
    await flushQueue();
    expect(mockUploadCalls.length).toBe(calls);
    mockUploadShouldFail = false;
    const realNow = Date.now;
    Date.now = () => realNow() + 25 * 60 * 60 * 1000;
    try {
      const r = await flushQueue();
      expect(r.uploaded).toBe(1);
    } finally {
      Date.now = realNow;
    }
    expect(await listPendingForJob('real-uuid-P')).toHaveLength(0);
  });

  test('idRemap event rewrites jobId on pending entries', async () => {
    const { queuePhoto, listPendingForJob } = require('../pendingJobPhotosQueue');
    const { emitIdRemap } = require('../idRemapBus');
    await queuePhoto({ jobId: 'j-temp-999', imageBase64: 'aGVsbG8=' });
    emitIdRemap({ table: 'jobs', tempId: 'j-temp-999', realId: 'real-uuid-999' });
    // Wait one microtask for the async listener
    await new Promise((r) => setImmediate(r));
    const stillPending = await listPendingForJob('real-uuid-999');
    expect(stillPending).toHaveLength(1);
    expect(stillPending[0].jobId).toBe('real-uuid-999');
  });
});
