// The customer's statutory right to cancel a contract accepted in the portal.
//
// FR: Code de la consommation L221-5/L221-18 (W108). UK: the Consumer
// Contracts (Information, Cancellation and Additional Charges) Regulations 2013
// — a contract a homeowner accepts online (distance) or at home (off-premises)
// can be cancelled within 14 days; the information must be given BEFORE the
// contract, or the period runs up to 12 months, and leaving it out of an
// off-premises contract is an offence (reg. 19). The UK portal showed nothing
// (UK walk, 2026-10-08).
//
// The database enforces the acknowledgement for the same markets
// (decide_acceptance_link, migration 20261008000002) — keep the two lists equal.

export const CANCELLATION_RIGHT_COUNTRIES = ['FR', 'UK'] as const;

export function cancellationRightApplies(contractorCountry: string | null | undefined): boolean {
  return (CANCELLATION_RIGHT_COUNTRIES as readonly string[]).includes((contractorCountry ?? '').toUpperCase());
}

type Lang = 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';

/** UK wording, in the READER's language (the portal follows their browser). */
const UK_NOTICE: Record<Lang, { title: string; body: string; check: string }> = {
  en: {
    check: 'I have read and understood my right to cancel',
    title: 'Your 14-day right to cancel',
    body: 'You can cancel this contract within 14 days of accepting it, without giving a reason (Consumer Contracts Regulations 2013). To cancel, tell the business clearly — by email or letter — before the 14 days end. If you ask for the work to start within those 14 days and then cancel, you pay for the work done up to that point.',
  },
  nl: {
    check: 'Ik heb mijn annuleringsrecht gelezen en begrepen',
    title: 'Uw annuleringsrecht van 14 dagen',
    body: 'U kunt deze overeenkomst binnen 14 dagen na acceptatie zonder opgaaf van reden annuleren (Britse Consumer Contracts Regulations 2013). Laat het bedrijf dat vóór het einde van de 14 dagen duidelijk weten, per e-mail of brief. Vraagt u om binnen die 14 dagen met het werk te beginnen en annuleert u daarna, dan betaalt u voor het werk dat tot dan is gedaan.',
  },
  de: {
    check: 'Ich habe mein Widerrufsrecht gelesen und verstanden',
    title: 'Ihr 14-tägiges Widerrufsrecht',
    body: 'Sie können diesen Vertrag innerhalb von 14 Tagen nach Annahme ohne Angabe von Gründen widerrufen (britische Consumer Contracts Regulations 2013). Teilen Sie dies dem Betrieb vor Ablauf der 14 Tage eindeutig mit, per E-Mail oder Brief. Wenn Sie verlangen, dass die Arbeiten innerhalb dieser 14 Tage beginnen, und dann widerrufen, zahlen Sie für die bis dahin erbrachten Arbeiten.',
  },
  fr: {
    check: 'J’ai lu et compris mon droit d’annulation',
    title: 'Votre droit d’annulation de 14 jours',
    body: 'Vous pouvez annuler ce contrat dans les 14 jours suivant son acceptation, sans avoir à vous justifier (Consumer Contracts Regulations 2013, Royaume-Uni). Pour annuler, informez clairement l’entreprise par e-mail ou par courrier avant la fin des 14 jours. Si vous demandez que les travaux commencent pendant ces 14 jours puis annulez, vous payez les travaux effectués jusque-là.',
  },
  es: {
    check: 'He leído y entendido mi derecho de cancelación',
    title: 'Su derecho de cancelación de 14 días',
    body: 'Puede cancelar este contrato en los 14 días siguientes a su aceptación sin dar ninguna razón (Consumer Contracts Regulations 2013, Reino Unido). Para cancelar, comuníqueselo claramente a la empresa por correo electrónico o carta antes de que terminen los 14 días. Si pide que el trabajo empiece dentro de esos 14 días y luego cancela, pagará el trabajo realizado hasta ese momento.',
  },
  it: {
    check: 'Ho letto e compreso il mio diritto di recesso',
    title: 'Il suo diritto di recesso di 14 giorni',
    body: 'Può recedere da questo contratto entro 14 giorni dall’accettazione senza indicarne il motivo (Consumer Contracts Regulations 2013, Regno Unito). Per recedere, lo comunichi chiaramente all’impresa via e-mail o lettera prima della scadenza dei 14 giorni. Se chiede che i lavori inizino entro questi 14 giorni e poi recede, paga i lavori svolti fino a quel momento.',
  },
};

/**
 * The notice for this contractor's market in the reader's language, or null
 * when the page's own (FR) copy applies / no right applies.
 */
export function ukCancellationNotice(contractorCountry: string | null | undefined, lang: string): { title: string; body: string; check: string } | null {
  if ((contractorCountry ?? '').toUpperCase() !== 'UK') return null;
  return UK_NOTICE[(lang in UK_NOTICE ? lang : 'en') as Lang];
}
