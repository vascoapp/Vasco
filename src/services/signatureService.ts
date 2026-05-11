// =============================================================================
// SIGNATURE SERVICE — R66r55 (2026-05-11)
// =============================================================================
// Writes signature audit-trail rows to the public.signatures table (see
// migration 20260511000003_signatures.sql). Closes the R296 GDPR gap where
// signatures only existed as device-local `jobs.signature_svg` text.
//
// Two write paths:
//   - recordContractorSignature: contractor is authenticated, writes via
//     RLS policy `signatures_insert_own`.
//   - recordPortalSignature: customer is anonymous on the decision portal
//     and writes via the SECURITY DEFINER RPC `write_signature_via_portal`,
//     which validates access_code against decision_trackers and stamps
//     contractor_user_id server-side.
//
// The legal-text + html-block helpers are kept here so the invoice/quote
// PDF generators can render an embedded signature row consistently.
// =============================================================================

import { isSupabaseConfigured, supabase } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SignerRole = 'customer' | 'site_lead' | 'inspector' | 'subcontractor' | 'other';

export interface SignatureRow {
  id: string;
  job_id: string | null;
  quote_id: string | null;
  invoice_id: string | null;
  contractor_user_id: string;
  signer_name: string;
  signer_role: SignerRole;
  signature_svg: string;
  user_agent: string | null;
  ip_hash: string | null;
  signed_at: string;
  created_at: string;
}

export interface ContractorSignatureInput {
  jobId?: string;
  quoteId?: string;
  invoiceId?: string;
  signerName: string;
  signerRole?: SignerRole;
  signatureSvg: string;
  userAgent?: string;
}

export interface PortalSignatureInput {
  accessCode: string;
  signerName: string;
  signerRole?: SignerRole;
  signatureSvg: string;
  userAgent?: string;
  ipHash?: string;
}

// ---------------------------------------------------------------------------
// Write paths
// ---------------------------------------------------------------------------

/**
 * Contractor-authenticated insert. Returns the new signature row id, or
 * null when Supabase is unconfigured (demo mode) or the insert fails.
 * Caller's UI should still flip the local "signed" state on null —
 * BE failures here are equivalent to "offline, queued" for the user's
 * mental model.
 */
export async function recordContractorSignature(
  input: ContractorSignatureInput,
): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const row = {
      job_id: input.jobId ?? null,
      quote_id: input.quoteId ?? null,
      invoice_id: input.invoiceId ?? null,
      contractor_user_id: user.id,
      signer_name: input.signerName,
      signer_role: input.signerRole ?? 'customer',
      signature_svg: input.signatureSvg,
      user_agent: input.userAgent ?? null,
    };

    // typegen drift: signatures landed in migration 20260511000003 and
    // isn't in the generated database.types yet. Same pattern as
    // feature_flags / app_config / cron RPC.
    const { data, error } = await (supabase.from('signatures' as any) as any)
      .insert(row)
      .select('id')
      .maybeSingle();

    if (error || !data) return null;
    return (data as { id: string }).id;
  } catch {
    return null;
  }
}

/**
 * Customer (anonymous) insert via the decision-portal capability URL.
 * Validates access_code server-side, resolves contractor_user_id from the
 * tracker, and writes the row with server-stamped signed_at.
 */
export async function recordPortalSignature(
  input: PortalSignatureInput,
): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.rpc('write_signature_via_portal' as never, {
      p_access_code: input.accessCode,
      p_signer_name: input.signerName,
      p_signer_role: input.signerRole ?? 'customer',
      p_signature_svg: input.signatureSvg,
      p_user_agent: input.userAgent ?? null,
      p_ip_hash: input.ipHash ?? null,
    } as never);
    if (error || typeof data !== 'string') return null;
    return data;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Read path (contractor side)
// ---------------------------------------------------------------------------

export async function listSignaturesForJob(jobId: string): Promise<SignatureRow[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await (supabase.from('signatures' as any) as any)
      .select('*')
      .eq('job_id', jobId)
      .order('signed_at', { ascending: false });
    if (error || !Array.isArray(data)) return [];
    return data as SignatureRow[];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Legal text per signing context, 6 languages
// ---------------------------------------------------------------------------

export type SignatureContext =
  | 'quote_acceptance'
  | 'invoice_acknowledgement'
  | 'job_closeout'
  | 'handover'
  | 'change_order';

const LEGAL_TEXTS: Record<SignatureContext, Record<string, string>> = {
  quote_acceptance: {
    en: 'By signing, I accept this quote and authorize the work described above.',
    nl: 'Door te ondertekenen accepteer ik deze offerte en autoriseer ik de hierboven beschreven werkzaamheden.',
    de: 'Mit meiner Unterschrift akzeptiere ich dieses Angebot und beauftrage die oben beschriebenen Arbeiten.',
    fr: 'En signant, j\'accepte ce devis et autorise les travaux décrits ci-dessus.',
    es: 'Al firmar, acepto este presupuesto y autorizo los trabajos descritos anteriormente.',
    it: 'Firmando, accetto questo preventivo e autorizzo i lavori sopra descritti.',
  },
  invoice_acknowledgement: {
    en: 'I acknowledge receipt of this invoice and the work described.',
    nl: 'Ik bevestig de ontvangst van deze factuur en de beschreven werkzaamheden.',
    de: 'Ich bestätige den Erhalt dieser Rechnung und der beschriebenen Arbeiten.',
    fr: 'Je reconnais avoir reçu cette facture et les travaux décrits.',
    es: 'Acuso recibo de esta factura y los trabajos descritos.',
    it: 'Riconosco la ricezione di questa fattura e i lavori descritti.',
  },
  job_closeout: {
    en: 'I confirm that the work has been completed satisfactorily.',
    nl: 'Ik bevestig dat de werkzaamheden naar tevredenheid zijn afgerond.',
    de: 'Ich bestätige, dass die Arbeiten zufriedenstellend abgeschlossen wurden.',
    fr: 'Je confirme que les travaux ont été réalisés de manière satisfaisante.',
    es: 'Confirmo que los trabajos se han completado satisfactoriamente.',
    it: 'Confermo che i lavori sono stati completati in modo soddisfacente.',
  },
  handover: {
    en: 'I confirm receipt of the completed work, including all documentation and keys.',
    nl: 'Ik bevestig de ontvangst van het opgeleverde werk, inclusief alle documentatie en sleutels.',
    de: 'Ich bestätige den Empfang der abgeschlossenen Arbeiten, einschließlich aller Dokumente und Schlüssel.',
    fr: 'Je confirme la réception des travaux achevés, y compris toute la documentation et les clés.',
    es: 'Confirmo la recepción del trabajo completado, incluyendo toda la documentación y llaves.',
    it: 'Confermo la ricezione dei lavori completati, inclusa tutta la documentazione e le chiavi.',
  },
  change_order: {
    en: 'I approve this change order and the associated cost and schedule impact.',
    nl: 'Ik keur deze wijziging goed inclusief de bijbehorende kosten en planningsimpact.',
    de: 'Ich genehmige diesen Nachtrag und die damit verbundenen Kosten- und Terminauswirkungen.',
    fr: 'J\'approuve cet avenant et l\'impact associé sur les coûts et le calendrier.',
    es: 'Apruebo este cambio y el impacto asociado en costos y plazos.',
    it: 'Approvo questa variante e l\'impatto associato su costi e tempistiche.',
  },
};

export function getLegalText(context: SignatureContext, language: string): string {
  return LEGAL_TEXTS[context]?.[language] || LEGAL_TEXTS[context]?.en || '';
}

// ---------------------------------------------------------------------------
// PDF embed helper
// ---------------------------------------------------------------------------

/**
 * Renders an HTML block for a signature inside the invoice/quote PDF.
 * Accepts either a full SignatureRow from the BE or a lightweight inline
 * shape so the existing `Job.signatureSvg` path can keep rendering while
 * we migrate callers over.
 */
export function signatureHtmlBlock(
  args: {
    signatureSvg: string;
    signerName: string;
    signedAt?: string;
    signerRole?: SignerRole;
    legalText?: string;
  },
): string {
  const signedAtLabel = args.signedAt ? new Date(args.signedAt).toLocaleDateString() : '';
  const role = args.signerRole ?? 'customer';
  // SVG embeds inline; base64 PNG would also work via data: URI but
  // SignaturePad in this app already produces SVG markup.
  const safeSvg = args.signatureSvg.startsWith('data:')
    ? `<img src="${args.signatureSvg}" style="height:48px;max-width:200px;" alt="Signature" />`
    : `<div style="height:48px;max-width:200px;overflow:hidden;">${args.signatureSvg}</div>`;
  return `
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #E5E7EB;">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          ${safeSvg}
          <div style="margin-top:4px;padding-top:4px;border-top:1px solid #111827;width:200px;">
            <div style="font-size:11px;font-weight:600;color:#111827;">${escapeHtml(args.signerName)}</div>
            <div style="font-size:9px;color:#9CA3AF;">${signedAtLabel} · ${role}</div>
          </div>
        </div>
        ${args.legalText ? `<div style="text-align:right;max-width:250px;">
          <div style="font-size:8px;color:#9CA3AF;line-height:1.4;">${escapeHtml(args.legalText)}</div>
        </div>` : ''}
      </div>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// UI labels (preserved for SignaturePad)
// ---------------------------------------------------------------------------

export const SIGNATURE_LABELS: Record<string, { title: string; instruction: string; clear: string; accept: string }> = {
  en: { title: 'Sign Here', instruction: 'Draw your signature below', clear: 'Clear', accept: 'Accept & Sign' },
  nl: { title: 'Teken hier', instruction: 'Teken uw handtekening hieronder', clear: 'Wissen', accept: 'Accepteren & Ondertekenen' },
  de: { title: 'Hier unterschreiben', instruction: 'Zeichnen Sie Ihre Unterschrift unten', clear: 'Löschen', accept: 'Akzeptieren & Unterschreiben' },
  fr: { title: 'Signez ici', instruction: 'Dessinez votre signature ci-dessous', clear: 'Effacer', accept: 'Accepter & Signer' },
  es: { title: 'Firme aquí', instruction: 'Dibuje su firma abajo', clear: 'Borrar', accept: 'Aceptar y Firmar' },
  it: { title: 'Firma qui', instruction: 'Disegna la tua firma sotto', clear: 'Cancella', accept: 'Accetta e Firma' },
};
