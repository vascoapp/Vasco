import { QuoteLineItem } from '../domain/lineItems';

export const quoteLineItems: Record<string, QuoteLineItem[]> = {
  'Q-2026-0031': [
    { id: 'ls1', description: 'Lekkage opsporing', quantity: 1, unitPrice: 95 },
    { id: 'ls2', description: 'Inspectie rapport', quantity: 1, unitPrice: 85 },
  ],
  'Q-2026-0032': [
    { id: 'ls3', description: 'CV-ketel inspectie', quantity: 1, unitPrice: 150 },
    { id: 'ls4', description: 'Filter vervanging', quantity: 1, unitPrice: 45 },
    { id: 'ls5', description: 'Waterdruk controle', quantity: 1, unitPrice: 75 },
    { id: 'ls6', description: 'Voorrijkosten', quantity: 1, unitPrice: 35 },
    { id: 'ls7', description: 'Onderhoudscertificaat', quantity: 1, unitPrice: 145 },
  ],
  'Q-2026-0033': [
    { id: 'ls8', description: 'Sanitair demontage', quantity: 1, unitPrice: 480 },
    { id: 'ls9', description: 'Leidingwerk aanpassen', quantity: 1, unitPrice: 1200 },
    { id: 'ls10', description: 'Tegels plaatsen', quantity: 12, unitPrice: 85 },
    { id: 'ls11', description: 'Sanitair installatie', quantity: 1, unitPrice: 750 },
    { id: 'ls12', description: 'Afwerking en kitwerk', quantity: 1, unitPrice: 350 },
    { id: 'ls13', description: 'Materiaalkosten', quantity: 1, unitPrice: 400 },
  ],
  'Q-2026-0034': [
    { id: 'l1', description: 'Prep & masking', quantity: 1, unitPrice: 320 },
    { id: 'l2', description: 'Primer coat', quantity: 1, unitPrice: 420 },
    { id: 'l3', description: 'Finish coat', quantity: 1, unitPrice: 420 },
  ],
  'Q-2026-0035': [
    { id: 'l1', description: 'Prep & masking', quantity: 1, unitPrice: 280 },
    { id: 'l2', description: 'Primer coat', quantity: 1, unitPrice: 420 },
    { id: 'l3', description: 'Finish coat', quantity: 1, unitPrice: 420 },
  ],
  'Q-2026-0036': [
    { id: 'l1', description: 'Surface prep', quantity: 1, unitPrice: 240 },
    { id: 'l2', description: 'Stain coat', quantity: 1, unitPrice: 540 },
  ],

  // ── Store-screenshot documents, one quote + one invoice per market ──
  // Quote lines sum to the quote's NET amount; invoice lines are net and the
  // market's VAT rate brings them to the invoice's stored GROSS amount to the
  // cent (DE 19 %, FR 20 %, ES 21 %, IT 22 %, UK 20 %).
  // NL: net € 371,90 + 21 % = the invoice's € 450,00.
  'i-1043': [
    { id: 'inl1', description: 'Buitenkozijnen schuren en schilderen', quantity: 3, unitPrice: 85 },
    { id: 'inl2', description: 'Verf en materialen', quantity: 1, unitPrice: 116.9 },
  ],
  'AN-2026-0041': [
    { id: 'sde1', description: 'Gas-Brennwertkessel 24 kW inkl. Zubehör', quantity: 1, unitPrice: 3950 },
    { id: 'sde2', description: 'Demontage und Entsorgung Altkessel', quantity: 1, unitPrice: 450 },
    { id: 'sde3', description: 'Montage und Inbetriebnahme (Std.)', quantity: 24, unitPrice: 75 },
    { id: 'sde4', description: 'Hydraulischer Abgleich', quantity: 1, unitPrice: 600 },
  ],
  'inv-de-1': [
    { id: 'ide1', description: 'Kupferrohr und Pressfittings', quantity: 1, unitPrice: 1469.75 },
    { id: 'ide2', description: 'Arbeitszeit, 2 Monteure (Std.)', quantity: 32, unitPrice: 65 },
    { id: 'ide3', description: 'Druckprüfung und Spülung', quantity: 1, unitPrice: 820 },
  ],
  'DE-2026-0041': [
    { id: 'sfr1', description: 'Chaudière gaz à condensation 24 kW', quantity: 1, unitPrice: 3950 },
    { id: 'sfr2', description: 'Dépose et évacuation ancienne chaudière', quantity: 1, unitPrice: 450 },
    { id: 'sfr3', description: 'Pose et mise en service (heures)', quantity: 24, unitPrice: 75 },
    { id: 'sfr4', description: 'Équilibrage du réseau', quantity: 1, unitPrice: 600 },
  ],
  'inv-fr-1': [
    { id: 'ifr1', description: 'Tube cuivre et raccords à sertir', quantity: 1, unitPrice: 1433.33 },
    { id: 'ifr2', description: "Main-d'œuvre, 2 techniciens (heures)", quantity: 32, unitPrice: 65 },
    { id: 'ifr3', description: 'Essai de pression et rinçage', quantity: 1, unitPrice: 820 },
  ],
  'PR-2026-0041': [
    { id: 'ses1', description: 'Caldera de condensación 24 kW', quantity: 1, unitPrice: 3950 },
    { id: 'ses2', description: 'Desmontaje y retirada de caldera antigua', quantity: 1, unitPrice: 450 },
    { id: 'ses3', description: 'Instalación y puesta en marcha (horas)', quantity: 24, unitPrice: 75 },
    { id: 'ses4', description: 'Equilibrado hidráulico', quantity: 1, unitPrice: 600 },
  ],
  'inv-es-1': [
    { id: 'ies1', description: 'Tubería de cobre y accesorios de prensar', quantity: 1, unitPrice: 1397.52 },
    { id: 'ies2', description: 'Mano de obra, 2 operarios (horas)', quantity: 32, unitPrice: 65 },
    { id: 'ies3', description: 'Prueba de presión y limpieza', quantity: 1, unitPrice: 820 },
  ],
  'PV-2026-0041': [
    { id: 'sit1', description: 'Caldaia a condensazione 24 kW', quantity: 1, unitPrice: 3950 },
    { id: 'sit2', description: 'Smontaggio e smaltimento vecchia caldaia', quantity: 1, unitPrice: 450 },
    { id: 'sit3', description: 'Installazione e collaudo (ore)', quantity: 24, unitPrice: 75 },
    { id: 'sit4', description: 'Bilanciamento idraulico', quantity: 1, unitPrice: 600 },
  ],
  'inv-it-3': [
    { id: 'iit1', description: 'Acconto 30% ristrutturazione bagno', quantity: 1, unitPrice: 2622.95 },
  ],
  'QT-2026-0041': [
    { id: 'suk1', description: 'Combi boiler 30 kW incl. flue kit', quantity: 1, unitPrice: 1850 },
    { id: 'suk2', description: 'Remove and dispose of old boiler', quantity: 1, unitPrice: 250 },
    { id: 'suk3', description: 'Installation and commissioning (hours)', quantity: 16, unitPrice: 65 },
    { id: 'suk4', description: 'Powerflush and inhibitor', quantity: 1, unitPrice: 310 },
  ],
  'inv-uk-1': [
    { id: 'iuk1', description: 'Copper pipe and press fittings', quantity: 1, unitPrice: 1433.33 },
    { id: 'iuk2', description: 'Labour, 2 engineers (hours)', quantity: 32, unitPrice: 65 },
    { id: 'iuk3', description: 'Pressure test and flush', quantity: 1, unitPrice: 820 },
  ],
};
