// =============================================================================
// CERTIFICATE OCR SERVICE
// =============================================================================
// Reuses the existing `analyze-photo` Edge Function with a cert-specific
// prompt (via `mode: 'certificate'`). Returns prefill data the Compliance
// Center add-cert form uses to populate fields — the contractor still
// confirms before we create the Certification row.
// =============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getCurrentCountry } from '../lib/currentUser';

export interface ExtractedCertData {
  certName?: string;
  issuingBody?: string;
  certificationNumber?: string;
  holderName?: string;
  issueDate?: string;     // ISO YYYY-MM-DD
  expiryDate?: string;    // ISO YYYY-MM-DD
  category?: 'technical' | 'safety' | 'environmental' | 'quality' | 'industry_specific';
  confidence: number;     // 0-100
  warnings?: string[];
}

/** Fallback when Supabase isn't configured OR the function is unavailable. */
const DEMO_RESULT: ExtractedCertData = {
  certName: 'VCA Basic',
  issuingBody: 'SSVV',
  certificationNumber: '—',
  issueDate: new Date().toISOString().slice(0, 10),
  expiryDate: new Date(Date.now() + 3 * 365 * 86400000).toISOString().slice(0, 10),
  category: 'safety',
  confidence: 0,
  warnings: ['Demo mode — configure ANTHROPIC_API_KEY for real OCR'],
};

/**
 * Extract structured certificate data from a photo of the cert card / PDF.
 * `imageBase64` is the raw base64 string (no data-URL prefix) from
 * expo-image-picker with `{ base64: true }`.
 */
export async function extractCertData(imageBase64: string): Promise<ExtractedCertData> {
  if (!imageBase64) return DEMO_RESULT;
  if (!isSupabaseConfigured) return DEMO_RESULT;

  try {
    const country = getCurrentCountry() ?? 'NL';
    const { data, error } = await supabase.functions.invoke('analyze-photo', {
      body: {
        imageBase64,
        country,
        mode: 'certificate',
      },
    });
    if (error || !data) return DEMO_RESULT;
    if ((data as any).error) return (data as any).fallback ?? DEMO_RESULT;
    return normalizeResult(data);
  } catch {
    return DEMO_RESULT;
  }
}

/** The Edge Function may return Claude's raw JSON shape — normalize a few
 * field variants we've seen in the wild (valid_until vs expiryDate, etc.). */
function normalizeResult(raw: any): ExtractedCertData {
  const d = raw ?? {};
  return {
    certName: d.certName ?? d.name ?? d.title ?? undefined,
    issuingBody: d.issuingBody ?? d.issuer ?? d.authority ?? undefined,
    certificationNumber: d.certificationNumber ?? d.certNumber ?? d.number ?? undefined,
    holderName: d.holderName ?? d.holder ?? d.recipient ?? undefined,
    issueDate: d.issueDate ?? d.issued ?? d.issued_on ?? undefined,
    expiryDate: d.expiryDate ?? d.validUntil ?? d.valid_until ?? d.expires ?? undefined,
    category: d.category ?? undefined,
    confidence: typeof d.confidence === 'number' ? d.confidence : 0,
    warnings: Array.isArray(d.warnings) ? d.warnings : [],
  };
}
