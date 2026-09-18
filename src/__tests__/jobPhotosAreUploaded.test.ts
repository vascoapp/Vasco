/**
 * @jest-environment node
 */
// The job screen carried a SECOND photo gallery beside the real one. Its
// `jobPhotos` array was written only by its own "add" button — a local file://
// URI pushed into component state, never uploaded, gone on the next
// navigation — and read by nothing else. So it opened EMPTY for a job with
// twenty uploaded photos, and every photo added through it was lost (#339).
//
// The real path already existed one route away (`job/[id]/photos`): it labels
// the shot, uploads it, and queues it when the job is still a temp id. The fix
// is one upload path, with the inline gallery as a VIEW of it.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const src = stripComments(fs.readFileSync(path.join(ROOT, 'app/contractor/job/[id].tsx'), 'utf8'));

describe('the job gallery shows the photos that exist', () => {
  it('fills itself from jobPhotoService, not from its own button', () => {
    expect(src).toMatch(/const photos = await listJobPhotos\(String\(id\)\)/);
    expect(src).toMatch(/setJobPhotos\(/);
    const effect = src.slice(src.indexOf('const photos = await listJobPhotos'), src.indexOf('const photos = await listJobPhotos') + 900);
    expect(effect).toMatch(/uri: p\.publicUrl as string/);
  });

  it('re-reads when the screen is focused again', () => {
    // Returning from the photos screen must not leave a stale list — the old
    // local gallery never refreshed, which is how it hid its own defect.
    expect(src).toMatch(/useFocusEffect\(useCallback\(\(\) => \{ setPhotoRefreshTick/);
    expect(src).toMatch(/\}, \[id, photoRefreshTick\]\)/);
  });

  it('adding a photo goes through the screen that uploads', () => {
    expect(src).toMatch(/onAddPhoto=\{\(\) => router\.push\(`\/contractor\/job\/\$\{job\.id\}\/photos`/);
  });

  it('keeps no local-only add path', () => {
    // `showPhotoPicker` hands back a file:// URI and nothing else; on this
    // screen it could only ever produce a photo that was never stored.
    expect(src).not.toMatch(/showPhotoPicker/);
  });

  it('the evidence grid is drawn from photos, not from a counter', () => {
    // It rendered `Array.from({length: photoCount})` icon placeholders — the
    // first half labelled "Before", the rest "After" — with no image behind
    // any of them, and its add button announced a capture it never made.
    expect(src).not.toMatch(/Array\.from\(\{ length: Math\.min\(photoCount/);
    expect(src).not.toMatch(/setPhotoCount\(prev => prev \+ 1\)/);
    expect(src).not.toMatch(/jobs\.photoAddedDesc/);
    const grid = src.slice(src.indexOf('styles.galleryGrid'), src.indexOf('styles.galleryAddText'));
    expect(grid).toMatch(/jobPhotos\.slice\(0, 6\)\.map/);
    expect(grid).toMatch(/<Image source=\{\{ uri: photo\.uri \}\}/);
  });
});

describe('the upload path itself still exists', () => {
  const photosScreen = stripComments(fs.readFileSync(path.join(ROOT, 'app/contractor/job/[id]/photos.tsx'), 'utf8'));

  it('uploads with base64 and handles the offline queue', () => {
    expect(photosScreen).toMatch(/uploadJobPhoto\(\{ jobId: String\(id\), imageBase64/);
    expect(photosScreen).toMatch(/base64: true/);
  });
});

describe('a failed photo read is not an empty gallery', () => {
  // `listJobPhotos` returned [] for offline, for a query error and for "this
  // job has none" alike, and the job screen re-reads on every FOCUS — so
  // walking into a basement and coming back emptied a gallery of twenty photos
  // and set the count to 0 (sweep 2026-09-18).
  const fs = require('fs');
  const path = require('path');
  const ROOT = path.resolve(__dirname, '../..');
  const read = (rel: string) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

  it('the service reports failure as null, not as an empty list', () => {
    const svc = read('src/services/jobPhotoService.ts');
    const at = svc.indexOf('export async function listJobPhotos');
    expect(at).toBeGreaterThan(-1);
    const body = svc.slice(at, svc.indexOf('export async function deleteJobPhoto'));
    expect(body).toMatch(/Promise<JobPhotoRecord\[\] \| null>/);
    expect(body).toMatch(/if \(!isSupabaseConfigured\) return null;/);
    // The catch must not swallow into [].
    expect(body.slice(body.lastIndexOf('catch'))).toMatch(/return null;/);
  });

  it('the job screen keeps what it has when the read fails', () => {
    const screen = read('app/contractor/job/[id].tsx');
    const at = screen.indexOf('const photos = await listJobPhotos(String(id));');
    expect(at).toBeGreaterThan(-1);
    expect(screen.slice(at, at + 400)).toMatch(/if \(photos === null\) return;/);
  });

  it('the photos screen does the same, and reads prev to avoid a stale closure', () => {
    const screen = read('app/contractor/job/[id]/photos.tsx');
    expect(screen).toMatch(/const loadFailed = list === null;/);
    expect(screen).toMatch(/setPhotos\(\(prev\) =>/);
    expect(screen).toMatch(/loadFailed \? prev : serverPhotos/);
  });
});

