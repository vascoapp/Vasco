// =============================================================================
// JOB PHOTO SERVICE
// =============================================================================
// Upload a local image to the `job-photos` Supabase Storage bucket and
// record the metadata in `job_photos` so it's retrievable cross-device.
// Path convention: `<user_id>/<job_id>/<uuid>.jpg` — mirrors storage RLS.
// =============================================================================

import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { isTempIdFast } from '../lib/idShape';

export type PhotoKind = 'before' | 'during' | 'after' | 'defect' | 'handover';

export interface JobPhotoRecord {
  id: string;
  jobId: string;
  storagePath: string;
  publicUrl?: string;
  kind: PhotoKind;
  caption?: string;
  takenAt: string;
}

export interface UploadJobPhotoInput {
  jobId: string;
  /** base64 image (without `data:...;base64,` prefix). */
  imageBase64: string;
  kind?: PhotoKind;
  caption?: string;
  contentType?: string; // default image/jpeg
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^;]+;base64,/, '');
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export async function uploadJobPhoto(input: UploadJobPhotoInput): Promise<JobPhotoRecord | null> {
  if (!isSupabaseConfigured) return null;
  // R59: refuse to upload when jobId is a temp id. The storage path
  // `${user.id}/${input.jobId}/${uuid}.jpg` would embed the temp id,
  // and `job_photos.job_id` is a FK → jobs(id) so the metadata insert
  // would fail with no row matched. Photo would land in the bucket
  // orphaned forever. Caller should retry once the offline queue flushes
  // the parent job and refreshData picks up the BE uuid.
  if (isTempIdFast(input.jobId)) return null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const uuid = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const contentType = input.contentType ?? 'image/jpeg';
    const ext = contentType === 'image/png' ? 'png' : 'jpg';
    const path = `${user.id}/${input.jobId}/${uuid}.${ext}`;

    const bytes = base64ToBytes(input.imageBase64);
    const { error: upErr } = await supabase.storage
      .from('job-photos')
      .upload(path, bytes, { contentType, upsert: false });
    if (upErr) return null;

    const takenAt = new Date().toISOString();
    const { data: row, error: rowErr } = await (supabase.from('job_photos' as any) as any)
      .insert({
        user_id: user.id,
        job_id: input.jobId,
        storage_path: path,
        caption: input.caption ?? null,
        kind: input.kind ?? 'during',
        taken_at: takenAt,
      })
      .select()
      .single();
    if (rowErr) return null;

    const { data: signed } = await supabase.storage
      .from('job-photos')
      .createSignedUrl(path, 60 * 60 * 24); // 24h signed URL for immediate display

    return {
      id: row.id,
      jobId: input.jobId,
      storagePath: path,
      publicUrl: signed?.signedUrl,
      kind: (input.kind ?? 'during') as PhotoKind,
      caption: input.caption,
      takenAt,
    };
  } catch {
    return null;
  }
}

export async function listJobPhotos(jobId: string): Promise<JobPhotoRecord[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data } = await (supabase.from('job_photos' as any) as any)
      .select('id, storage_path, caption, kind, taken_at')
      .eq('job_id', jobId)
      .order('taken_at', { ascending: false });
    if (!data) return [];
    const out: JobPhotoRecord[] = [];
    for (const row of data as any[]) {
      const { data: signed } = await supabase.storage
        .from('job-photos')
        .createSignedUrl(row.storage_path, 60 * 60 * 24);
      out.push({
        id: row.id,
        jobId,
        storagePath: row.storage_path,
        publicUrl: signed?.signedUrl,
        kind: row.kind,
        caption: row.caption,
        takenAt: row.taken_at,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function deleteJobPhoto(photoId: string, storagePath: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    await supabase.storage.from('job-photos').remove([storagePath]);
    await (supabase.from('job_photos' as any) as any).delete().eq('id', photoId);
    return true;
  } catch {
    return false;
  }
}
