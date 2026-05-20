// =============================================================================
// SCREENSHOT STRINGS — per-locale interior text for App Store renders
// =============================================================================
// nl: original Dutch interior (NL-first contractor experience)
// en-US: US interior (Mike Reynolds HVAC, $ amounts, "Estimate" terminology)
//
// Used by the 5 AppStore*.tsx compositions in this directory. Each
// composition reads STRINGS[locale] and renders the same visual layout
// with locale-appropriate copy + data.
// =============================================================================

export type ScreenshotLocale = 'nl' | 'en-US';

export interface ScreenshotStrings {
  tabs: { vandaag: string; werk: string; geld: string; klanten: string; vasco: string };

  vandaag: {
    title: string;
    subtitle: string;
    aiHeaderLabel: string;
    aiHeadline: string;
    aiBody: string;
    aiCta: string;
    savingsLabel: string;
    savingsAmount: string;
    sectionTitle: string;
    rows: Array<{ time: string; title: string; address: string; status: string }>;
    statusOnRoute: string;
    statusScheduled: string;
  };

  quote: {
    title: string;
    subtitle: string;
    cohortBadge: string;
    tierGood: string;
    tierBetter: string;
    tierBest: string;
    tierGoodPrice: string;
    tierBetterPrice: string;
    tierBestPrice: string;
    tierGoodSubtitle: string;
    tierBetterSubtitle: string;
    tierBestSubtitle: string;
    tierGoodFeatures: string[];
    tierBetterFeatures: string[];
    tierBestFeatures: string[];
    cta: string;
  };

  geld: {
    title: string;
    subtitle: string;
    kpi1Label: string; kpi1Value: string;
    kpi2Label: string; kpi2Value: string;
    sectionTitle: string;
    rows: Array<{
      customer: string;
      ref: string;
      amount: string;
      status: string;
      cta?: string;
    }>;
    bottomCardTitle: string;
    bottomCardBody: string;
  };

  photo: {
    title: string;
    subtitle: string;
    detectedTag: string;
    captionTitle: string;
    captionSub: string;
    sectionTitle: string;
    lines: Array<{ name: string; qty: string; price: string }>;
    totalLabel: string;
    totalAmount: string;
    cta: string;
  };

  vat: {
    title: string;
    subtitle: string;
    safetyBanner: string;
    bigLabel: string;
    bigAmount: string;
    bigSub: string;
    sectionTitle: string;
    rows: Array<{ code: string; label: string; amount: string; vat: string; negative?: boolean }>;
    exportCardTitle: string;
    exportCardBody: string;
    exportCta: string;
  };
}

export const STRINGS: Record<ScreenshotLocale, ScreenshotStrings> = {
  // ─── Dutch (NL-first launch) ──────────────────────────────────────────
  nl: {
    tabs: { vandaag: 'Vandaag', werk: 'Werk', geld: 'Geld', klanten: 'Klanten', vasco: 'Vasco' },

    vandaag: {
      title: 'Vandaag',
      subtitle: 'Woensdag 19 mei',
      aiHeaderLabel: 'Vasco voor jou',
      aiHeadline: '3 offertes wachten om verstuurd te worden',
      aiBody: 'Binnen 24 uur versturen verdubbelt je acceptatie. Tik om alles in één keer te doen.',
      aiCta: 'VERSTUUR ALLES',
      savingsLabel: 'Vasco bespaarde je deze week',
      savingsAmount: '4u 23min  ·  €847',
      sectionTitle: 'Agenda vandaag',
      rows: [
        { time: '09:00', title: 'Lekkage badkamer — De Jong', address: 'Amstelveen', status: 'ONDERWEG' },
        { time: '11:30', title: 'CV-ketel onderhoud — Bakker', address: 'Hoofddorp', status: 'GEPLAND' },
        { time: '14:00', title: 'Riool ontstoppen — Mulder', address: 'Amsterdam Zuid', status: 'GEPLAND' },
      ],
      statusOnRoute: 'ONDERWEG',
      statusScheduled: 'GEPLAND',
    },

    quote: {
      title: 'Offerte',
      subtitle: 'Stap 3 — Voorbeeld',
      cohortBadge: 'Vergelijkbare loodgieters in NL: 67% accepteert "Beter"',
      tierGood: 'GOED', tierBetter: 'BETER', tierBest: 'BEST',
      tierGoodPrice: '€485', tierBetterPrice: '€890', tierBestPrice: '€1.450',
      tierGoodSubtitle: 'Reparatie nu — geen garantie op oud leidingwerk',
      tierBetterSubtitle: 'Reparatie + leidingen vervangen (10 jaar garantie)',
      tierBestSubtitle: 'Volledige modernisering — alles in één keer goed',
      tierGoodFeatures: ['Lekkage stoppen', 'Materiaal inbegrepen', '1u arbeid'],
      tierBetterFeatures: ['Volledige badkamer-leidingen', 'Druktest na werk', '10 jaar garantie'],
      tierBestFeatures: ['Alle aanvoer + afvoer', 'Nieuwe shut-off kranen', '15 jaar garantie'],
      cta: 'VERSTUUR NAAR KLANT',
    },

    geld: {
      title: 'Geld',
      subtitle: '3 facturen open  ·  €4.280 binnen',
      kpi1Label: 'Te ontvangen', kpi1Value: '€4.280',
      kpi2Label: 'Te laat', kpi2Value: '€890',
      sectionTitle: 'Open facturen',
      rows: [
        { customer: 'De Jong', ref: 'F-2026-041', amount: '€1.890', status: '14 dgn over tijd', cta: 'HERINNERING' },
        { customer: 'Bakker BV', ref: 'F-2026-042', amount: '€1.520', status: 'Vandaag verlopen', cta: 'BETAALLINK' },
        { customer: 'Mulder', ref: 'F-2026-043', amount: '€870', status: 'Verstuurd · 3 dagen' },
      ],
      bottomCardTitle: 'Auto-incasso aan',
      bottomCardBody: 'Vasco stuurt herinneringen + escaleert na 14d / 30d / 60d. Jij doet niets.',
    },

    photo: {
      title: 'AI Offerte',
      subtitle: 'Foto geanalyseerd in 8 sec',
      detectedTag: '✨ Lekkage gedetecteerd',
      captionTitle: 'Badkamer · De Jong · Amstelveen',
      captionSub: "3 foto's geüpload",
      sectionTitle: 'Vasco vond deze regels',
      lines: [
        { name: 'Lekkage stop kit', qty: '1 st', price: '€48,90' },
        { name: 'PVC buis Ø32mm', qty: '2 m', price: '€18,40' },
        { name: 'Sifon vervangen', qty: '1 st', price: '€34,50' },
        { name: 'Arbeid (geschat)', qty: '2,5u', price: '€237,50' },
      ],
      totalLabel: 'Totaal',
      totalAmount: '€339,30 + btw',
      cta: 'MAAK OFFERTE →',
    },

    vat: {
      title: 'BTW Q1 2026',
      subtitle: '01 jan — 31 mrt',
      safetyBanner: 'Voorbereiding — Vasco dient niet zelf in. Controleer altijd zelf.',
      bigLabel: 'Te betalen aan Belastingdienst',
      bigAmount: '€3.847,20',
      bigSub: 'Aangifte verwacht: 30 apr 2026',
      sectionTitle: 'Rubriek-overzicht',
      rows: [
        { code: '1a', label: 'Leveringen 21%', amount: '€18.420,00', vat: '€3.868,20' },
        { code: '1b', label: 'Leveringen 9%', amount: '€420,00', vat: '€37,80' },
        { code: '5b', label: 'Voorbelasting', amount: '—', vat: '−€58,80', negative: true },
      ],
      exportCardTitle: 'Export naar Moneybird',
      exportCardBody: 'of DATEV · Pennylane · 19 andere',
      exportCta: 'EXPORT →',
    },
  },

  // ─── US English (Mike Reynolds HVAC) ──────────────────────────────────
  'en-US': {
    tabs: { vandaag: 'Today', werk: 'Work', geld: 'Money', klanten: 'Clients', vasco: 'Vasco' },

    vandaag: {
      title: 'Today',
      subtitle: 'Tuesday May 20',
      aiHeaderLabel: 'From Vasco',
      aiHeadline: '3 estimates ready to send',
      aiBody: 'Sending within 24h doubles your acceptance rate. Tap to send all 3.',
      aiCta: 'SEND ALL',
      savingsLabel: 'Vasco saved you this week',
      savingsAmount: '4h 23min  ·  $847',
      sectionTitle: "Today's schedule",
      rows: [
        { time: '9:00 AM', title: 'AC not cooling — Williams', address: 'Austin, TX', status: 'EN ROUTE' },
        { time: '11:30 AM', title: 'Annual HVAC service — Chen', address: 'Round Rock, TX', status: 'SCHEDULED' },
        { time: '2:00 PM', title: 'Full system install — Garcia', address: 'Cedar Park, TX', status: 'SCHEDULED' },
      ],
      statusOnRoute: 'EN ROUTE',
      statusScheduled: 'SCHEDULED',
    },

    quote: {
      title: 'Estimate',
      subtitle: 'Step 3 — Preview',
      cohortBadge: 'Similar HVAC pros in TX: 67% pick "Better"',
      tierGood: 'GOOD', tierBetter: 'BETTER', tierBest: 'BEST',
      tierGoodPrice: '$485', tierBetterPrice: '$890', tierBestPrice: '$1,450',
      tierGoodSubtitle: 'Repair now — no warranty on aging coils',
      tierBetterSubtitle: 'Repair + coil replacement (10-year warranty)',
      tierBestSubtitle: 'Full system replacement — done right first time',
      tierGoodFeatures: ['Stop the leak', 'Refrigerant included', '1 hr labor'],
      tierBetterFeatures: ['Full coil replacement', 'Pressure test', '10-year warranty'],
      tierBestFeatures: ['New condenser + air handler', 'Smart thermostat', '15-year warranty'],
      cta: 'SEND TO CUSTOMER',
    },

    geld: {
      title: 'Money',
      subtitle: '3 invoices open  ·  $4,280 incoming',
      kpi1Label: 'Outstanding', kpi1Value: '$4,280',
      kpi2Label: 'Overdue', kpi2Value: '$890',
      sectionTitle: 'Open invoices',
      rows: [
        { customer: 'Williams', ref: 'INV-2026-041', amount: '$1,890', status: '14 days overdue', cta: 'REMIND' },
        { customer: 'Chen', ref: 'INV-2026-042', amount: '$1,520', status: 'Due today', cta: 'PAY LINK' },
        { customer: 'Garcia', ref: 'INV-2026-043', amount: '$870', status: 'Sent · 3 days ago' },
      ],
      bottomCardTitle: 'Auto-collect ON',
      bottomCardBody: 'Vasco sends reminders + escalates at 7d / 14d / 30d. You do nothing.',
    },

    photo: {
      title: 'AI Estimate',
      subtitle: 'Photo analyzed in 8 sec',
      detectedTag: '✨ Compressor failure detected',
      captionTitle: 'AC unit · Williams · Austin TX',
      captionSub: '3 photos uploaded',
      sectionTitle: 'Vasco found these line items',
      lines: [
        { name: 'Capacitor 45/5 mfd', qty: '1 ea', price: '$48.90' },
        { name: 'R-410A refrigerant', qty: '2 lb', price: '$78.40' },
        { name: 'Contactor 30A', qty: '1 ea', price: '$34.50' },
        { name: 'Labor (estimated)', qty: '2.5 hrs', price: '$287.50' },
      ],
      totalLabel: 'Subtotal',
      totalAmount: '$449.30 + tax',
      cta: 'CREATE ESTIMATE →',
    },

    vat: {
      title: 'Sales tax Q1 2026',
      subtitle: 'Jan 01 — Mar 31',
      safetyBanner: 'Prep only — Vasco does not file. Always review with your CPA.',
      bigLabel: 'Sales tax collected',
      bigAmount: '$3,847.20',
      bigSub: 'Filing due: Apr 20, 2026',
      sectionTitle: 'By state · breakdown',
      rows: [
        { code: 'TX', label: 'Texas state · 6.25%', amount: '$58,420.00', vat: '$3,651.25' },
        { code: 'TX', label: 'Austin local · 2.00%', amount: '$58,420.00', vat: '$1,168.40' },
        { code: '—', label: 'Resale exempt', amount: '—', vat: '−$972.45', negative: true },
      ],
      exportCardTitle: 'Export to QuickBooks',
      exportCardBody: 'or Xero · FreshBooks · 19 others',
      exportCta: 'EXPORT →',
    },
  },
};
