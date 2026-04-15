// =============================================================================
// REMINDER CADENCE — escalating overdue reminder copy
// =============================================================================
// Day 3 : friendly "just a heads-up"
// Day 7 : firm "please settle this week"
// Day 14: final "we'll escalate to collections if not settled"
// Per-customer override allows gentler cadence for VIPs.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

export type CadenceStep = 'friendly' | 'firm' | 'final';
export type Locale = 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';

const OVERRIDE_KEY = '@vasco_reminder_cadence_override';

export function stepForDaysOverdue(daysOverdue: number): CadenceStep | null {
  // No reminder before day 3 — we want to give customers a grace period.
  if (daysOverdue < 3) return null;
  if (daysOverdue < 7) return 'friendly';
  if (daysOverdue < 14) return 'firm';
  return 'final';
}

const COPY: Record<CadenceStep, Record<Locale, { subject: string; body: string }>> = {
  friendly: {
    en: {
      subject: 'Quick nudge: invoice {{ref}}',
      body: `Hi {{customer}},\n\nJust a quick reminder that invoice {{ref}} for {{amount}} has been open for a few days. If you've already paid, apologies — please ignore. Otherwise, tap here to pay in one go: {{link}}\n\nThanks,\n{{business}}`,
    },
    nl: {
      subject: 'Kleine herinnering: factuur {{ref}}',
      body: `Hoi {{customer}},\n\nKleine herinnering dat factuur {{ref}} van {{amount}} nog openstaat. Al betaald? Excuses, dan mag je deze negeren. Anders kun je hier in één keer betalen: {{link}}\n\nGroet,\n{{business}}`,
    },
    de: {
      subject: 'Kurze Erinnerung: Rechnung {{ref}}',
      body: `Hallo {{customer}},\n\nkurze Erinnerung, dass Rechnung {{ref}} über {{amount}} noch offen ist. Bereits bezahlt? Bitte entschuldigen — dann ignorieren Sie diese Nachricht. Sonst hier bequem bezahlen: {{link}}\n\nVielen Dank,\n{{business}}`,
    },
    fr: {
      subject: 'Petit rappel : facture {{ref}}',
      body: `Bonjour {{customer}},\n\nPetit rappel : la facture {{ref}} de {{amount}} est encore ouverte. Si vous avez déjà réglé, toutes mes excuses. Sinon, payez en un clic : {{link}}\n\nMerci,\n{{business}}`,
    },
    es: {
      subject: 'Recordatorio: factura {{ref}}',
      body: `Hola {{customer}},\n\nUn recordatorio rápido: la factura {{ref}} de {{amount}} sigue pendiente. Si ya has pagado, disculpa — ignora este mensaje. Si no, paga aquí en un clic: {{link}}\n\nGracias,\n{{business}}`,
    },
    it: {
      subject: 'Piccolo promemoria: fattura {{ref}}',
      body: `Ciao {{customer}},\n\npromemoria che la fattura {{ref}} di {{amount}} è ancora aperta. Se hai già pagato, scusa — ignora pure. Altrimenti paga al volo qui: {{link}}\n\nGrazie,\n{{business}}`,
    },
  },
  firm: {
    en: {
      subject: 'Please settle invoice {{ref}}',
      body: `Hi {{customer}},\n\nInvoice {{ref}} for {{amount}} is now {{days}} days overdue. Please settle this week to keep our records clean: {{link}}\n\nIf there's an issue, let me know and we'll sort it out.\n\n{{business}}`,
    },
    nl: {
      subject: 'Graag deze week betalen — factuur {{ref}}',
      body: `Hoi {{customer}},\n\nFactuur {{ref}} van {{amount}} is nu {{days}} dagen vervallen. Kun je deze week afronden? Betaal hier: {{link}}\n\nIs er een probleem? Laat het me weten dan lossen we het op.\n\n{{business}}`,
    },
    de: {
      subject: 'Bitte begleichen: Rechnung {{ref}}',
      body: `Hallo {{customer}},\n\nRechnung {{ref}} über {{amount}} ist jetzt {{days}} Tage überfällig. Bitte begleichen Sie diese Woche: {{link}}\n\nSollte etwas nicht stimmen, melden Sie sich bitte.\n\n{{business}}`,
    },
    fr: {
      subject: 'Règlement demandé — facture {{ref}}',
      body: `Bonjour {{customer}},\n\nLa facture {{ref}} de {{amount}} a {{days}} jours de retard. Merci de régler cette semaine : {{link}}\n\nUn souci ? Dites-le-moi, je m'en occupe.\n\n{{business}}`,
    },
    es: {
      subject: 'Por favor paga — factura {{ref}}',
      body: `Hola {{customer}},\n\nLa factura {{ref}} de {{amount}} lleva {{days}} días vencida. Por favor regulariza esta semana: {{link}}\n\nSi hay algún problema, dímelo y lo solucionamos.\n\n{{business}}`,
    },
    it: {
      subject: 'Per favore saldare — fattura {{ref}}',
      body: `Ciao {{customer}},\n\nLa fattura {{ref}} di {{amount}} è scaduta da {{days}} giorni. Per favore saldala questa settimana: {{link}}\n\nSe c'è un problema fammelo sapere, risolviamo.\n\n{{business}}`,
    },
  },
  final: {
    en: {
      subject: 'Final notice: invoice {{ref}}',
      body: `Hi {{customer}},\n\nInvoice {{ref}} for {{amount}} is now {{days}} days overdue. This is the final reminder before I hand the matter to a collections partner. You can still settle directly here: {{link}}\n\nPlease get in touch today if there's an issue.\n\n{{business}}`,
    },
    nl: {
      subject: 'Laatste herinnering: factuur {{ref}}',
      body: `Hoi {{customer}},\n\nFactuur {{ref}} van {{amount}} is nu {{days}} dagen vervallen. Dit is de laatste herinnering voordat ik overdraag aan een incassopartner. Je kunt nog steeds direct betalen: {{link}}\n\nNeem vandaag contact op als er iets aan de hand is.\n\n{{business}}`,
    },
    de: {
      subject: 'Letzte Mahnung: Rechnung {{ref}}',
      body: `Hallo {{customer}},\n\nRechnung {{ref}} über {{amount}} ist {{days}} Tage überfällig. Letzte Erinnerung vor Übergabe an ein Inkasso. Direkt bezahlen: {{link}}\n\nBitte melden Sie sich heute, falls es ein Problem gibt.\n\n{{business}}`,
    },
    fr: {
      subject: 'Dernier rappel : facture {{ref}}',
      body: `Bonjour {{customer}},\n\nLa facture {{ref}} de {{amount}} est en retard de {{days}} jours. Dernier rappel avant transfert à un service de recouvrement. Paiement direct : {{link}}\n\nMerci de me contacter aujourd'hui en cas de problème.\n\n{{business}}`,
    },
    es: {
      subject: 'Último aviso: factura {{ref}}',
      body: `Hola {{customer}},\n\nLa factura {{ref}} de {{amount}} lleva {{days}} días vencida. Este es el último aviso antes de traspasar a una agencia de cobros. Aún puedes pagar aquí: {{link}}\n\nPor favor contacta hoy si hay algún problema.\n\n{{business}}`,
    },
    it: {
      subject: 'Ultimo avviso: fattura {{ref}}',
      body: `Ciao {{customer}},\n\nLa fattura {{ref}} di {{amount}} è scaduta da {{days}} giorni. Questo è l'ultimo promemoria prima di passarla a un servizio di recupero. Puoi ancora pagare qui: {{link}}\n\nContattami oggi se c'è un problema.\n\n{{business}}`,
    },
  },
};

export interface RenderArgs {
  step: CadenceStep;
  locale: Locale;
  customer: string;
  ref: string;
  amount: string;
  days: number;
  link: string;
  business: string;
}

export function renderReminder(args: RenderArgs): { subject: string; body: string } {
  const tpl = COPY[args.step][args.locale] ?? COPY[args.step].en;
  const subst = (s: string) => s
    .replace(/\{\{customer\}\}/g, args.customer)
    .replace(/\{\{ref\}\}/g, args.ref)
    .replace(/\{\{amount\}\}/g, args.amount)
    .replace(/\{\{days\}\}/g, String(args.days))
    .replace(/\{\{link\}\}/g, args.link)
    .replace(/\{\{business\}\}/g, args.business);
  return { subject: subst(tpl.subject), body: subst(tpl.body) };
}

// ── Per-customer overrides (e.g. VIP → delay cadence by 3 days) ──────

interface Override {
  customerId: string;
  delayDays: number;
}

export async function setCadenceOverride(customerId: string, delayDays: number): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(OVERRIDE_KEY);
    const map: Record<string, Override> = raw ? JSON.parse(raw) : {};
    map[customerId] = { customerId, delayDays };
    await AsyncStorage.setItem(OVERRIDE_KEY, JSON.stringify(map));
  } catch {}
}

export async function getCadenceOverride(customerId: string): Promise<Override | null> {
  try {
    const raw = await AsyncStorage.getItem(OVERRIDE_KEY);
    const map: Record<string, Override> = raw ? JSON.parse(raw) : {};
    return map[customerId] ?? null;
  } catch {
    return null;
  }
}

/** Effective step considering any per-customer delay. */
export async function effectiveStep(customerId: string, daysOverdue: number): Promise<CadenceStep | null> {
  const override = await getCadenceOverride(customerId);
  const delay = override?.delayDays ?? 0;
  return stepForDaysOverdue(daysOverdue - delay);
}
