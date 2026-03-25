// =============================================================================
// TRADE CONTEXT — Trade-specific and country-specific intelligence
// =============================================================================
// Provides contextual language, seasonal advice, and customer intelligence
// for enriching AI outputs with domain knowledge.
// =============================================================================

import { MS_PER_DAY } from '../utils/timeConstants';

// ---------------------------------------------------------------------------
// Trade terminology per country
// ---------------------------------------------------------------------------

interface TradeTerms {
  jobWord: string;
  quoteWord: string;
  customerWord: string;
  certWarning?: string;
  seasonalTip?: string;
  commonMaterials: string[];
}

const TRADE_TERMS: Record<string, Record<string, TradeTerms>> = {
  plumbing: {
    NL: {
      jobWord: 'klus',
      quoteWord: 'offerte',
      customerWord: 'klant',
      certWarning: 'KIWA/SCIOS certificering verloopt — controleer voor de CV-seizoenstart',
      commonMaterials: ['koperen buis 15mm', 'PVC afvoerbuis 40mm', 'flexibele aansluitleiding', 'kraanwerk', 'sifon'],
    },
    DE: {
      jobWord: 'Auftrag',
      quoteWord: 'Angebot',
      customerWord: 'Kunde',
      certWarning: 'DVGW-Zertifizierung und Meisterbrief rechtzeitig erneuern',
      commonMaterials: ['Kupferrohr 15mm', 'HT-Rohr DN40', 'Flexschlauch', 'Eckventil', 'Siphon'],
    },
    FR: {
      jobWord: 'chantier',
      quoteWord: 'devis',
      customerWord: 'client',
      certWarning: 'Qualification RGE a renouveler avant la saison de chauffage',
      commonMaterials: ['tube cuivre 14mm', 'tube PVC 40mm', 'flexible raccord', 'robinetterie', 'siphon'],
    },
    ES: {
      jobWord: 'trabajo',
      quoteWord: 'presupuesto',
      customerWord: 'cliente',
      certWarning: 'Renovar Carne de Instalador antes de la temporada de calefaccion',
      commonMaterials: ['tubo cobre 15mm', 'tubo PVC 40mm', 'latiguillo flexible', 'griferia', 'sifon'],
    },
    IT: {
      jobWord: 'lavoro',
      quoteWord: 'preventivo',
      customerWord: 'cliente',
      certWarning: 'Rinnovare certificazione DM 37/08 Lettera A',
      commonMaterials: ['tubo rame 14mm', 'tubo PVC 40mm', 'flessibile raccordo', 'rubinetteria', 'sifone'],
    },
    UK: {
      jobWord: 'job',
      quoteWord: 'quote',
      customerWord: 'client',
      certWarning: 'Unvented hot water certificate renewal due — check before heating season',
      commonMaterials: ['15mm copper pipe', '40mm PVC waste pipe', 'flexible connector', 'tap fittings', 'bottle trap'],
    },
  },
  electrical: {
    NL: {
      jobWord: 'klus',
      quoteWord: 'offerte',
      customerWord: 'klant',
      certWarning: 'NEN 1010 certificering vernieuwing controleren',
      commonMaterials: ['VD-draad 2.5mm2', 'centraaldoos', 'wandcontactdoos', 'installatieautomaat', 'kabelgoot'],
    },
    DE: {
      jobWord: 'Auftrag',
      quoteWord: 'Angebot',
      customerWord: 'Kunde',
      certWarning: 'Elektrofachkraft-Zertifizierung und VDE-Pruefung aktuell halten',
      commonMaterials: ['NYM-J 3x1.5mm2', 'Abzweigdose', 'Steckdose', 'Leitungsschutzschalter', 'Kabelkanal'],
    },
    FR: {
      jobWord: 'chantier',
      quoteWord: 'devis',
      customerWord: 'client',
      certWarning: 'Habilitation Electrique et Consuel a renouveler',
      commonMaterials: ['cable R2V 3G1.5', 'boite de derivation', 'prise electrique', 'disjoncteur', 'goulotte'],
    },
    ES: {
      jobWord: 'trabajo',
      quoteWord: 'presupuesto',
      customerWord: 'cliente',
      certWarning: 'Renovar Certificado Instalador Electricista y REBT',
      commonMaterials: ['cable RV-K 3x1.5mm2', 'caja de derivacion', 'enchufe', 'magnetotermico', 'canaleta'],
    },
    IT: {
      jobWord: 'lavoro',
      quoteWord: 'preventivo',
      customerWord: 'cliente',
      certWarning: 'Rinnovare certificazione DM 37/08 Lettera A - Impianti Elettrici',
      commonMaterials: ['cavo FG7OR 3G1.5', 'cassetta derivazione', 'presa elettrica', 'magnetotermico', 'canalina'],
    },
    UK: {
      jobWord: 'job',
      quoteWord: 'quote',
      customerWord: 'client',
      certWarning: 'Part P competent person registration and NICEIC/ELECSA renewal due',
      commonMaterials: ['2.5mm twin & earth', 'junction box', 'double socket', 'MCB', 'mini trunking'],
    },
  },
  gas: {
    NL: {
      jobWord: 'klus',
      quoteWord: 'offerte',
      customerWord: 'klant',
      certWarning: 'Scios Scope 8 en F-gassen certificering tijdig vernieuwen',
      commonMaterials: ['gasslang', 'gasregelaar', 'CV-ketelonderdelen', 'rookgasafvoer', 'thermostaat'],
    },
    DE: {
      jobWord: 'Auftrag',
      quoteWord: 'Angebot',
      customerWord: 'Kunde',
      certWarning: 'DVGW-Zertifizierung und F-Gas Verordnung beachten',
      commonMaterials: ['Gasschlauch', 'Gasdruckregler', 'Kesselteile', 'Abgasrohr', 'Thermostat'],
    },
    FR: {
      jobWord: 'chantier',
      quoteWord: 'devis',
      customerWord: 'client',
      certWarning: 'Certification Qualigaz et PG a renouveler',
      commonMaterials: ['tuyau gaz', 'detendeur', 'pieces chaudiere', 'conduit fumee', 'thermostat'],
    },
    ES: {
      jobWord: 'trabajo',
      quoteWord: 'presupuesto',
      customerWord: 'cliente',
      certWarning: 'Renovar Certificado Instalador Gas Tipo A/B',
      commonMaterials: ['tubo gas', 'regulador gas', 'repuestos caldera', 'conducto humos', 'termostato'],
    },
    IT: {
      jobWord: 'lavoro',
      quoteWord: 'preventivo',
      customerWord: 'cliente',
      certWarning: 'Rinnovare DM 37/08 Lettera C e Certificato Prevenzione Incendi',
      commonMaterials: ['tubo gas', 'regolatore gas', 'ricambi caldaia', 'canna fumaria', 'termostato'],
    },
    UK: {
      jobWord: 'job',
      quoteWord: 'quote',
      customerWord: 'client',
      certWarning: 'Gas Safe registration is MANDATORY — check renewal date immediately',
      commonMaterials: ['gas flex connector', 'pressure regulator', 'boiler parts', 'flue pipe', 'thermostat'],
    },
  },
  painting: {
    NL: {
      jobWord: 'klus',
      quoteWord: 'offerte',
      customerWord: 'klant',
      certWarning: 'VCA-VOL veiligheidscertificaat controleren',
      commonMaterials: ['latex muurverf', 'grondverf', 'plamuur', 'schuurpapier', 'afdekfolie'],
    },
    DE: {
      jobWord: 'Auftrag',
      quoteWord: 'Angebot',
      customerWord: 'Kunde',
      certWarning: 'Meisterbrief und Gefahrstoffunterweisung aktuell halten',
      commonMaterials: ['Wandfarbe', 'Grundierung', 'Spachtelmasse', 'Schleifpapier', 'Abdeckfolie'],
    },
    FR: {
      jobWord: 'chantier',
      quoteWord: 'devis',
      customerWord: 'client',
      certWarning: 'Qualification Qualibat peinture a renouveler',
      commonMaterials: ['peinture murale', 'sous-couche', 'enduit', 'papier abrasif', 'bache de protection'],
    },
    ES: {
      jobWord: 'trabajo',
      quoteWord: 'presupuesto',
      customerWord: 'cliente',
      certWarning: 'Renovar Licencia de Actividad municipal',
      commonMaterials: ['pintura plastica', 'imprimacion', 'masilla', 'lija', 'plastico protector'],
    },
    IT: {
      jobWord: 'lavoro',
      quoteWord: 'preventivo',
      customerWord: 'cliente',
      certWarning: 'Verificare Attestazione SOA per lavori pubblici',
      commonMaterials: ['pittura murale', 'primer', 'stucco', 'carta vetrata', 'telo protettivo'],
    },
    UK: {
      jobWord: 'job',
      quoteWord: 'quote',
      customerWord: 'client',
      certWarning: 'CSCS card and public liability insurance renewal due',
      commonMaterials: ['emulsion paint', 'primer', 'filler', 'sandpaper', 'dust sheets'],
    },
  },
  carpentry: {
    NL: {
      jobWord: 'klus',
      quoteWord: 'offerte',
      customerWord: 'klant',
      certWarning: 'VCA-VOL veiligheidscertificaat controleren',
      commonMaterials: ['steigerhout', 'multiplex', 'schroeven RVS', 'houtlijm', 'beslag'],
    },
    DE: {
      jobWord: 'Auftrag',
      quoteWord: 'Angebot',
      customerWord: 'Kunde',
      certWarning: 'Meisterbrief und Maschinenschein aktuell halten',
      commonMaterials: ['Konstruktionsvollholz', 'Multiplex', 'Edelstahlschrauben', 'Holzleim', 'Beschlag'],
    },
    FR: {
      jobWord: 'chantier',
      quoteWord: 'devis',
      customerWord: 'client',
      certWarning: 'Qualification Qualibat menuiserie a renouveler',
      commonMaterials: ['bois massif', 'contreplaque', 'vis inox', 'colle a bois', 'ferrure'],
    },
    ES: {
      jobWord: 'trabajo',
      quoteWord: 'presupuesto',
      customerWord: 'cliente',
      certWarning: 'Renovar Licencia de Actividad municipal',
      commonMaterials: ['madera maciza', 'contrachapado', 'tornillos inox', 'cola de madera', 'herraje'],
    },
    IT: {
      jobWord: 'lavoro',
      quoteWord: 'preventivo',
      customerWord: 'cliente',
      certWarning: 'Verificare Attestazione SOA per lavori pubblici',
      commonMaterials: ['legno massello', 'multistrato', 'viti inox', 'colla per legno', 'ferramenta'],
    },
    UK: {
      jobWord: 'job',
      quoteWord: 'quote',
      customerWord: 'client',
      certWarning: 'CSCS card and NVQ Level 2+ renewal due',
      commonMaterials: ['structural timber', 'plywood', 'stainless screws', 'wood glue', 'ironmongery'],
    },
  },
};

const DEFAULT_TERMS: TradeTerms = {
  jobWord: 'job',
  quoteWord: 'quote',
  customerWord: 'customer',
  commonMaterials: [],
};

export function getTradeTerms(trade: string, country: string): TradeTerms {
  const normalized = trade.toLowerCase().replace(/\s+/g, '');
  const countryUpper = (country || 'NL').toUpperCase();
  return TRADE_TERMS[normalized]?.[countryUpper] ?? TRADE_TERMS[normalized]?.UK ?? DEFAULT_TERMS;
}

// ---------------------------------------------------------------------------
// Customer intelligence from job history
// ---------------------------------------------------------------------------

export interface CustomerIntelligence {
  lifetimeValue: number;
  jobCount: number;
  avgJobValue: number;
  avgDSO: number;
  isRepeatCustomer: boolean;
  lastJobDate?: string;
  paymentReliability: 'excellent' | 'good' | 'fair' | 'poor';
  escalationNeeded: boolean;
  contextLine: string;
}

export function getCustomerIntelligence(
  customerId: string,
  jobs: any[],
  invoices: any[],
): CustomerIntelligence {
  const customerJobs = jobs.filter(j => j.customerId === customerId);
  const customerInvoices = invoices.filter(i =>
    i.customerId === customerId || i.customer === customerId
  );

  const jobCount = customerJobs.length;
  const isRepeatCustomer = jobCount >= 2;

  // Lifetime value from paid invoices
  const paidInvoices = customerInvoices.filter(i => i.status === 'paid');
  const lifetimeValue = paidInvoices.reduce((s: number, i: any) => s + (i.amount ?? i.total ?? 0), 0);
  const avgJobValue = jobCount > 0 ? Math.round(lifetimeValue / jobCount) : 0;

  // Average days-sales-outstanding (payment speed)
  const dsoValues: number[] = [];
  for (const inv of paidInvoices) {
    const sentDate = inv.sentAt || inv.createdAt || inv.lastUpdated;
    const paidDate = inv.paidAt || inv.lastUpdated;
    if (sentDate && paidDate) {
      const sent = new Date(sentDate).getTime();
      const paid = new Date(paidDate).getTime();
      if (paid > sent) {
        dsoValues.push(Math.ceil((paid - sent) / MS_PER_DAY));
      }
    }
  }
  const avgDSO = dsoValues.length > 0
    ? Math.round(dsoValues.reduce((a, b) => a + b, 0) / dsoValues.length)
    : 0;

  // Payment reliability
  const overdueInvoices = customerInvoices.filter(i => i.status === 'overdue');
  let paymentReliability: 'excellent' | 'good' | 'fair' | 'poor' = 'good';
  if (paidInvoices.length >= 3 && avgDSO <= 14 && overdueInvoices.length === 0) {
    paymentReliability = 'excellent';
  } else if (overdueInvoices.length >= 2 || avgDSO > 45) {
    paymentReliability = 'poor';
  } else if (overdueInvoices.length === 1 || avgDSO > 30) {
    paymentReliability = 'fair';
  }

  // Escalation needed: multiple overdue invoices
  const escalationNeeded = overdueInvoices.length >= 2;

  // Last job date
  const completedJobs = customerJobs
    .filter(j => j.status === 'completed' || j.status === 'gereed')
    .sort((a: any, b: any) => (b.completedAt || b.lastUpdated || '').localeCompare(a.completedAt || a.lastUpdated || ''));
  const lastJobDate = completedJobs[0]?.completedAt || completedJobs[0]?.lastUpdated;

  // Context line — the one-liner summary
  const parts: string[] = [];
  if (isRepeatCustomer) {
    parts.push(`Repeat customer`);
  }
  if (lifetimeValue > 0) {
    parts.push(`\u20AC${lifetimeValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
  }
  if (jobCount > 0) {
    parts.push(`${jobCount} job${jobCount !== 1 ? 's' : ''}`);
  }
  if (avgDSO > 0) {
    parts.push(`pays in ${avgDSO}d`);
  }
  if (escalationNeeded) {
    parts.push(`${overdueInvoices.length} overdue — escalation needed`);
  } else if (paymentReliability === 'excellent') {
    parts.push(`excellent payer`);
  } else if (paymentReliability === 'poor') {
    parts.push(`slow payer`);
  }

  const contextLine = parts.length > 0 ? parts.join(', ') : '';

  return {
    lifetimeValue,
    jobCount,
    avgJobValue,
    avgDSO,
    isRepeatCustomer,
    lastJobDate,
    paymentReliability,
    escalationNeeded,
    contextLine,
  };
}

// ---------------------------------------------------------------------------
// Seasonal / quarterly context
// ---------------------------------------------------------------------------

interface SeasonalEntry {
  months: number[]; // 0-based months this applies to
  tip: string;
}

const SEASONAL_TIPS: Record<string, SeasonalEntry[]> = {
  plumbing: [
    { months: [9, 10, 11, 0, 1, 2], tip: 'CV/heating season is peak — prioritize boiler maintenance quotes and emergency capacity' },
    { months: [3, 4, 5, 6, 7, 8], tip: 'Summer is new-build and renovation season — focus on bathroom and kitchen installs' },
    { months: [7, 8], tip: 'Prepare for heating season: stock CV parts, check KIWA/SCIOS cert dates, send maintenance reminders' },
  ],
  electrical: [
    { months: [3, 4, 5, 6, 7, 8], tip: 'Construction boom Q2-Q3 — new-build and renovation electrical work peaks now' },
    { months: [9, 10], tip: 'NEN/VDE inspection season — many commercial buildings need annual electrical inspections' },
    { months: [11, 0, 1, 2], tip: 'Indoor season — focus on panel upgrades, smart home installs, and EV charger quotes' },
  ],
  gas: [
    { months: [7, 8], tip: 'Heating season prep starts now — schedule boiler servicing and F-gas system checks' },
    { months: [9, 10, 11, 0, 1, 2], tip: 'Peak heating season — emergency callouts increase, keep parts stocked' },
    { months: [3, 4, 5, 6], tip: 'Off-season for heating — focus on gas installation for new builds and renovations' },
    { months: [5], tip: 'F-gas regulation deadline approaching — verify your certification is current' },
  ],
  painting: [
    { months: [3, 4, 5, 6, 7, 8], tip: 'Exterior painting season — maximize outdoor projects before autumn rain' },
    { months: [9, 10, 11, 0, 1, 2], tip: 'Interior season — kitchens, living rooms, and commercial repaints are year-round work' },
    { months: [2, 3], tip: 'Spring rush coming — send quote reminders to last year\'s exterior customers now' },
  ],
  carpentry: [
    { months: [3, 4, 5, 6, 7, 8], tip: 'Renovation peak — decks, extensions, and outdoor structures are in high demand' },
    { months: [9, 10], tip: 'Wrap up outdoor carpentry before winter — focus on weatherproofing and finishing' },
    { months: [11, 0, 1, 2], tip: 'Indoor season — kitchens, built-in wardrobes, and interior trim work' },
    { months: [1, 2], tip: 'Pre-season prep: send quotes for spring renovation projects now to fill the pipeline' },
  ],
};

const COUNTRY_SEASONAL_NOTES: Record<string, Record<number, string>> = {
  NL: {
    0: 'BTW aangifte Q4 deadline nadert',
    3: 'BTW aangifte Q1 deadline nadert',
    6: 'BTW aangifte Q2 deadline nadert — zomervakantie plannen?',
    9: 'BTW aangifte Q3 deadline nadert',
  },
  DE: {
    0: 'Umsatzsteuervoranmeldung Q4 Frist',
    3: 'Umsatzsteuervoranmeldung Q1 Frist',
    6: 'Umsatzsteuervoranmeldung Q2 Frist',
    9: 'Umsatzsteuervoranmeldung Q3 Frist',
  },
  FR: {
    0: 'Declaration TVA T4 a deposer',
    3: 'Declaration TVA T1 a deposer',
    6: 'Declaration TVA T2 a deposer',
    9: 'Declaration TVA T3 a deposer',
  },
  ES: {},
  IT: {},
  UK: {
    0: 'VAT return Q4 deadline approaching',
    3: 'VAT return Q1 deadline approaching',
    6: 'VAT return Q2 deadline approaching',
    9: 'VAT return Q3 deadline approaching',
  },
};

export function getSeasonalContext(trade: string, country: string): string {
  const month = new Date().getMonth();
  const normalized = trade.toLowerCase().replace(/\s+/g, '');
  const countryUpper = (country || 'NL').toUpperCase();

  // Find the most specific seasonal tip for this trade + month
  const tradeTips = SEASONAL_TIPS[normalized] ?? [];
  const matchingTips = tradeTips.filter(t => t.months.includes(month));
  const tradeTip = matchingTips.length > 0 ? matchingTips[0].tip : '';

  // Add country-specific note if available
  const countryNote = COUNTRY_SEASONAL_NOTES[countryUpper]?.[month] ?? '';

  if (tradeTip && countryNote) {
    return `${tradeTip}. ${countryNote}`;
  }
  return tradeTip || countryNote || '';
}
