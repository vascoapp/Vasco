// The push a contractor gets when their CUSTOMER decides on a quote in the
// portal (W119). Pure, so jest checks every language and the edge function
// sends exactly what was checked.

export type DecisionLocale = 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';
export type Decision = 'accepted' | 'rejected';

const COPY: Record<DecisionLocale, {
  accepted: string; rejected: string;
  acceptedBody: string; rejectedBody: string;
  customer: string;
}> = {
  en: { accepted: 'Quote accepted', rejected: 'Quote declined', acceptedBody: '{customer} accepted quote {ref}.', rejectedBody: '{customer} declined quote {ref}.', customer: 'Your customer' },
  nl: { accepted: 'Offerte geaccepteerd', rejected: 'Offerte afgewezen', acceptedBody: '{customer} heeft offerte {ref} geaccepteerd.', rejectedBody: '{customer} heeft offerte {ref} afgewezen.', customer: 'Je klant' },
  de: { accepted: 'Angebot angenommen', rejected: 'Angebot abgelehnt', acceptedBody: '{customer} hat das Angebot {ref} angenommen.', rejectedBody: '{customer} hat das Angebot {ref} abgelehnt.', customer: 'Ihr Kunde' },
  fr: { accepted: 'Devis accepté', rejected: 'Devis refusé', acceptedBody: '{customer} a accepté le devis {ref}.', rejectedBody: '{customer} a refusé le devis {ref}.', customer: 'Votre client' },
  es: { accepted: 'Presupuesto aceptado', rejected: 'Presupuesto rechazado', acceptedBody: '{customer} ha aceptado el presupuesto {ref}.', rejectedBody: '{customer} ha rechazado el presupuesto {ref}.', customer: 'Su cliente' },
  it: { accepted: 'Preventivo accettato', rejected: 'Preventivo rifiutato', acceptedBody: '{customer} ha accettato il preventivo {ref}.', rejectedBody: '{customer} ha rifiutato il preventivo {ref}.', customer: 'Il cliente' },
};

export function quoteDecisionPush(
  locale: DecisionLocale,
  decision: Decision,
  customerName: string | null | undefined,
  quoteRef: string,
): { title: string; body: string } {
  const c = COPY[locale] ?? COPY.en;
  const who = (customerName ?? '').trim() || c.customer;
  const body = (decision === 'accepted' ? c.acceptedBody : c.rejectedBody)
    .replace('{customer}', who)
    .replace('{ref}', quoteRef);
  return { title: decision === 'accepted' ? c.accepted : c.rejected, body };
}
