// =============================================================================
// SIGNATURE SERVICE — In-app digital signature capture
// =============================================================================
// Captures customer/contractor signatures for quotes, invoices, job closeout,
// and handover documents. Stores as base64 PNG with metadata.
//
// Usage contexts:
// 1. Quote acceptance — customer signs to approve a quote
// 2. Invoice acknowledgement — customer confirms receipt
// 3. Job closeout/handover — both parties sign completion
// 4. Service agreement — customer signs recurring contract
// 5. Safety briefing — worker signs toolbox talk acknowledgement
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ─────────────────────────────────────────────────────────────────

export type SignatureContext =
  | 'quote_acceptance'
  | 'invoice_acknowledgement'
  | 'job_closeout'
  | 'service_agreement'
  | 'safety_briefing'
  | 'change_order'
  | 'handover';

export interface SignatureRecord {
  id: string;
  context: SignatureContext;
  referenceId: string;           // quote ID, invoice ID, job ID, etc.
  referenceType: string;         // 'quote', 'invoice', 'job', 'agreement'
  signerName: string;
  signerRole: 'customer' | 'contractor' | 'worker' | 'site_lead';
  signatureDataUri: string;      // base64 PNG data URI
  signedAt: string;
  ipAddress?: string;
  deviceInfo?: string;
  location?: { latitude: number; longitude: number };
  legalText: string;             // The text the signer agreed to
}

export interface SignatureRequest {
  context: SignatureContext;
  referenceId: string;
  referenceType: string;
  signerName: string;
  signerRole: SignatureRecord['signerRole'];
  legalText?: string;
}

// ─── Legal Texts (multilingual) ────────────────────────────────────────────

const LEGAL_TEXTS: Record<SignatureContext, Record<string, string>> = {
  quote_acceptance: {
    en: 'By signing, I accept this quote and authorize the work described above.',
    nl: 'Door te ondertekenen accepteer ik deze offerte en autoriseer ik de hierboven beschreven werkzaamheden.',
    de: 'Mit meiner Unterschrift akzeptiere ich dieses Angebot und beauftrage die oben beschriebenen Arbeiten.',
    fr: 'En signant, j\'accepte ce devis et autorise les travaux decrits ci-dessus.',
    es: 'Al firmar, acepto este presupuesto y autorizo los trabajos descritos anteriormente.',
    it: 'Firmando, accetto questo preventivo e autorizzo i lavori sopra descritti.',
  },
  invoice_acknowledgement: {
    en: 'I acknowledge receipt of this invoice and the work described.',
    nl: 'Ik bevestig de ontvangst van deze factuur en de beschreven werkzaamheden.',
    de: 'Ich bestatige den Erhalt dieser Rechnung und der beschriebenen Arbeiten.',
    fr: 'Je reconnais avoir recu cette facture et les travaux decrits.',
    es: 'Acuso recibo de esta factura y los trabajos descritos.',
    it: 'Riconosco la ricezione di questa fattura e i lavori descritti.',
  },
  job_closeout: {
    en: 'I confirm that the work has been completed satisfactorily.',
    nl: 'Ik bevestig dat de werkzaamheden naar tevredenheid zijn afgerond.',
    de: 'Ich bestatige, dass die Arbeiten zufriedenstellend abgeschlossen wurden.',
    fr: 'Je confirme que les travaux ont ete realises de maniere satisfaisante.',
    es: 'Confirmo que los trabajos se han completado satisfactoriamente.',
    it: 'Confermo che i lavori sono stati completati in modo soddisfacente.',
  },
  service_agreement: {
    en: 'I agree to the terms of this service agreement and the recurring schedule described.',
    nl: 'Ik ga akkoord met de voorwaarden van deze serviceovereenkomst en het beschreven terugkerend schema.',
    de: 'Ich stimme den Bedingungen dieser Servicevereinbarung und dem beschriebenen wiederkehrenden Zeitplan zu.',
    fr: 'J\'accepte les conditions de ce contrat de service et le calendrier recurrent decrit.',
    es: 'Acepto los terminos de este acuerdo de servicio y el calendario recurrente descrito.',
    it: 'Accetto i termini di questo contratto di servizio e il programma ricorrente descritto.',
  },
  safety_briefing: {
    en: 'I confirm that I have received and understood this safety briefing.',
    nl: 'Ik bevestig dat ik deze veiligheidsinstructie heb ontvangen en begrepen.',
    de: 'Ich bestatige, dass ich diese Sicherheitsunterweisung erhalten und verstanden habe.',
    fr: 'Je confirme avoir recu et compris cette consigne de securite.',
    es: 'Confirmo que he recibido y comprendido esta charla de seguridad.',
    it: 'Confermo di aver ricevuto e compreso questo briefing sulla sicurezza.',
  },
  change_order: {
    en: 'I approve this change order and the associated cost and schedule impact.',
    nl: 'Ik keur deze wijziging goed inclusief de bijbehorende kosten en planningsimpact.',
    de: 'Ich genehmige diesen Nachtrag und die damit verbundenen Kosten- und Terminauswirkungen.',
    fr: 'J\'approuve cet avenant et l\'impact associe sur les couts et le calendrier.',
    es: 'Apruebo este cambio y el impacto asociado en costos y plazos.',
    it: 'Approvo questa variante e l\'impatto associato su costi e tempistiche.',
  },
  handover: {
    en: 'I confirm receipt of the completed work, including all documentation and keys.',
    nl: 'Ik bevestig de ontvangst van het opgeleverde werk, inclusief alle documentatie en sleutels.',
    de: 'Ich bestatige den Empfang der abgeschlossenen Arbeiten, einschliesslich aller Dokumente und Schlussel.',
    fr: 'Je confirme la reception des travaux acheves, y compris toute la documentation et les cles.',
    es: 'Confirmo la recepcion del trabajo completado, incluyendo toda la documentacion y llaves.',
    it: 'Confermo la ricezione dei lavori completati, inclusa tutta la documentazione e le chiavi.',
  },
};

export function getLegalText(context: SignatureContext, language: string): string {
  return LEGAL_TEXTS[context]?.[language] || LEGAL_TEXTS[context]?.en || '';
}

// ─── Signature Storage ─────────────────────────────────────────────────────

const SIGNATURES_KEY = '@vasco_signatures';

export async function saveSignature(record: SignatureRecord): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(SIGNATURES_KEY);
    const records: SignatureRecord[] = raw ? JSON.parse(raw) : [];
    records.unshift(record);
    await AsyncStorage.setItem(SIGNATURES_KEY, JSON.stringify(records));
  } catch {}
}

export async function getSignaturesForReference(
  referenceId: string,
): Promise<SignatureRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(SIGNATURES_KEY);
    const records: SignatureRecord[] = raw ? JSON.parse(raw) : [];
    return records.filter((r) => r.referenceId === referenceId);
  } catch {
    return [];
  }
}

export async function getAllSignatures(limit: number = 50): Promise<SignatureRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(SIGNATURES_KEY);
    const records: SignatureRecord[] = raw ? JSON.parse(raw) : [];
    return records.slice(0, limit);
  } catch {
    return [];
  }
}

// ─── Create Signature Record ───────────────────────────────────────────────

export function createSignatureRecord(
  request: SignatureRequest,
  signatureDataUri: string,
  language: string = 'en',
): SignatureRecord {
  return {
    id: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    context: request.context,
    referenceId: request.referenceId,
    referenceType: request.referenceType,
    signerName: request.signerName,
    signerRole: request.signerRole,
    signatureDataUri,
    signedAt: new Date().toISOString(),
    legalText: request.legalText || getLegalText(request.context, language),
  };
}

// ─── Embed Signature in PDF HTML ───────────────────────────────────────────

export function signatureHtmlBlock(
  record: SignatureRecord,
): string {
  return `
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #E5E7EB;">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          <img src="${record.signatureDataUri}" style="height:48px;max-width:200px;" alt="Signature" />
          <div style="margin-top:4px;padding-top:4px;border-top:1px solid #111827;width:200px;">
            <div style="font-size:11px;font-weight:600;color:#111827;">${record.signerName}</div>
            <div style="font-size:9px;color:#9CA3AF;">${new Date(record.signedAt).toLocaleDateString()} · ${record.signerRole}</div>
          </div>
        </div>
        <div style="text-align:right;max-width:250px;">
          <div style="font-size:8px;color:#9CA3AF;line-height:1.4;">${record.legalText}</div>
        </div>
      </div>
    </div>
  `;
}

// ─── UI Labels ─────────────────────────────────────────────────────────────

export const SIGNATURE_LABELS: Record<string, { title: string; instruction: string; clear: string; accept: string }> = {
  en: { title: 'Sign Here', instruction: 'Draw your signature below', clear: 'Clear', accept: 'Accept & Sign' },
  nl: { title: 'Teken hier', instruction: 'Teken uw handtekening hieronder', clear: 'Wissen', accept: 'Accepteren & Ondertekenen' },
  de: { title: 'Hier unterschreiben', instruction: 'Zeichnen Sie Ihre Unterschrift unten', clear: 'Loschen', accept: 'Akzeptieren & Unterschreiben' },
  fr: { title: 'Signez ici', instruction: 'Dessinez votre signature ci-dessous', clear: 'Effacer', accept: 'Accepter & Signer' },
  es: { title: 'Firme aqui', instruction: 'Dibuje su firma abajo', clear: 'Borrar', accept: 'Aceptar y Firmar' },
  it: { title: 'Firma qui', instruction: 'Disegna la tua firma sotto', clear: 'Cancella', accept: 'Accetta e Firma' },
};
