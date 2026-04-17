// =============================================================================
// CUSTOMER PHOTO UPLOAD — public uploads via decision portal
// =============================================================================
// Customer submits photos via the decisions portal (no contractor auth).
// Photos upload to the `customer-uploads` Supabase bucket, bucket RLS allows
// anon inserts into a prefix derived from the tracker access token, and
// the returned 30-day signed URLs are what get stored on the decision.
//
// In demo mode (no Supabase) we keep the local `file://` URIs so the
// contractor side can still preview the photos during dev.
// =============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';

const BUCKET = 'customer-uploads';

/** Decode base64 → Uint8Array. Matches the jobPhotoService upload path
 * (the proven pattern on RN Hermes — fetch('file://...').arrayBuffer() is
 * unreliable on Android). */
function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^;]+;base64,/, '');
  const bin = globalThis.atob ? globalThis.atob(clean) : Buffer.from(clean, 'base64').toString('binary');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export interface CustomerPhotoInput {
  /** Local preview URI — used for display only. */
  uri: string;
  /** Required for the actual upload. Obtained via ImagePicker {base64: true}. */
  base64?: string;
  /** Optional content type; defaults to image/jpeg. */
  contentType?: string;
}

/**
 * Upload photos → return readable signed URLs. Falls back to local URIs
 * when Supabase is not configured OR when no base64 was provided (demo-mode
 * parity: the UI still shows the photos the customer picked).
 */
export async function uploadCustomerPhotos(
  photos: Array<CustomerPhotoInput | string>,
  opts?: { accessToken?: string },
): Promise<string[]> {
  // Legacy-friendly: string[] is treated as URI-only (no base64, demo fallback).
  const normalized: CustomerPhotoInput[] = photos.map((p) =>
    typeof p === 'string' ? { uri: p } : p,
  );
  if (normalized.length === 0) return [];

  const fallback = () => normalized.map((p) => p.uri);
  if (!isSupabaseConfigured) return fallback();

  const prefix = opts?.accessToken ?? 'anon';
  const uploaded: string[] = [];

  for (let i = 0; i < normalized.length; i += 1) {
    const { base64, contentType } = normalized[i];
    if (!base64) continue;
    const ct = contentType ?? 'image/jpeg';
    const ext = ct === 'image/png' ? 'png' : 'jpg';
    const filename = `${prefix}/${Date.now()}-${i}.${ext}`;
    const bytes = base64ToBytes(base64);
    const { error } = await (supabase.storage.from(BUCKET) as any).upload(filename, bytes, {
      contentType: ct,
      upsert: false,
    });
    if (error) continue;
    const { data: signed } = await (supabase.storage.from(BUCKET) as any)
      .createSignedUrl(filename, 60 * 60 * 24 * 30); // 30-day signed URL
    if (signed?.signedUrl) uploaded.push(signed.signedUrl);
  }

  // Every upload failed → fall back to local URIs so the submission still
  // reaches the contractor (they see previews, just not cloud copies).
  return uploaded.length > 0 ? uploaded : fallback();
}
