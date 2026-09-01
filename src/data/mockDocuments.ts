import { Invoice, Quote } from '../domain/documents';
import { localDateKey } from '../utils/dateKey';

export const quotes: Quote[] = [
  {
    id: 'Q-2026-0031',
    customer: 'Fam. Bakker',
    customerId: 'cust-004',
    job: 'Lekkage inspectie — Fam. Bakker',
    amount: 180,
    status: 'sent',
    trade: 'plumbing',
    lastUpdated: '1 day ago',
  },
  {
    id: 'Q-2026-0032',
    customer: 'Fam. de Vries',
    customerId: 'cust-001',
    job: 'CV-ketel onderhoud — Fam. de Vries',
    amount: 450,
    status: 'accepted',
    trade: 'plumbing',
    lastUpdated: '3 days ago',
  },
  {
    id: 'Q-2026-0033',
    customer: 'Fam. Jansen',
    customerId: 'cust-002',
    job: 'Badkamer renovatie — Fam. Jansen',
    amount: 4200,
    status: 'accepted',
    trade: 'plumbing',
    lastUpdated: '1 week ago',
  },
  {
    id: 'Q-2026-0034',
    customer: 'De Jong',
    job: 'Binnenschilderwerk',
    amount: 2450,
    status: 'draft',
    lastUpdated: '2 days ago',
  },
  {
    id: 'Q-2026-0035',
    customer: 'Van Dijk',
    job: 'Buitenschilderwerk',
    amount: 1120,
    status: 'draft',
    lastUpdated: '1 day ago',
  },
  {
    id: 'Q-2026-0036',
    customer: 'Bouwgroep Atlas',
    job: 'Schutting beitsen',
    amount: 780,
    status: 'sent',
    lastUpdated: 'Today',
  },
];

// Quote ids ARE document numbers here, and invoices carry a `reference`.
//
// On a real row `id` is the server-minted `document_number` (#230), so a
// fixture id shaped `q-seed-2` becomes the number the contractor is shown:
// `/quotes/[id]` titles the whole screen "OFFERTE Q-SEED-2". Quotes have no
// `reference` override slot to borrow, so the ids themselves are the numbers.
// Cross-references live only in this folder (mockLineItems is keyed by quote
// id, mockInsights carries one) plus the screen-walk fixtures.
//
// Every invoice fixture carries a `reference`. Without one, `documentNumber()`
// falls back to the row id — correctly, because on a real row `id` IS the
// server-minted document number (#230). Fixture ids are not, so the demo told
// the contractor "Factuur inv-seed-1 14d te laat" on the Vandaag card and
// titled the German invoice screen "Rechnung inv-de-1", while the seeds in
// quoteApprovalService showed proper "AN-2026-0055" two cards away.
// `reference` rather than renaming the ids: the ids are cross-referenced from
// the job seeds, the AI queue and the approval fixtures. `Quote` has no
// `reference` slot and is deliberately left alone — adding one would be a
// dead optional field (5-file rule), and no screen renders a quote id as a
// number today.
export const invoices: Invoice[] = [
  {
    id: 'inv-seed-1', reference: 'F-2026-0041',
    customer: 'Hotel NH',
    customerId: 'cust-005',
    job: 'Vloerverwarming check — Hotel NH',
    jobId: 'j-seed-5',
    amount: 350,
    status: 'overdue',
    dueInDays: -14,
    dueDate: localDateKey(new Date(Date.now() - 14 * 86400000)),
    sentAt: new Date(Date.now() - 44 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 44 * 86400000).toISOString(),
  },
  {
    id: 'i-1043', reference: 'F-2026-0038',
    customer: 'Bouwgroep Atlas',
    job: 'Buitenschilderwerk',
    amount: 450,
    status: 'overdue',
    dueInDays: -10,
    dueDate: localDateKey(new Date(Date.now() - 10 * 86400000)),
    sentAt: new Date(Date.now() - 40 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 40 * 86400000).toISOString(),
  },
  {
    id: 'i-1044', reference: 'F-2026-0039',
    customer: 'Van Dijk',
    job: 'Buitenschilderwerk',
    amount: 760,
    status: 'paid',
    dueInDays: 0,
    paidAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    sentAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    id: 'i-1045', reference: 'F-2026-0040',
    customer: 'De Jong',
    job: 'Binnenschilderwerk',
    amount: 640,
    status: 'draft',
    dueInDays: 30,
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
];

// ─── German demo documents ───────────────────────────────────────────────────
// Forked for the same reason as DE_SEED_JOBS/DE_SEED_CUSTOMERS. Those two alone
// were a HALF fix: invoices and quotes carry their own denormalised `customer`
// and `job` strings and are seeded at state init, outside the country branch,
// so the German demo still rendered "Vloerverwarming check — Hotel NH" on
// Geld/Facturen — AND the AI queue built its cards from them, producing German
// sentences wrapped around Dutch job names ("Angebot nachfassen Fam. Bakker",
// and a customer-facing "wir kommen heute um 09:00 für CV-ketel onderhoud").
// Caught by the new `as: 'handwerker'` walk; invisible to every Dutch walk.
//
// Same status spread as the Dutch set: 2 overdue / 1 paid / 1 draft, and a
// quote mix across sent/accepted/draft. j-de-4 is deliberately left uninvoiced
// so the queue still has a real draft_invoice card to prepare.
export const deQuotes: Quote[] = [
  { id: 'AN-2026-0041', customer: 'Familie Krüger', customerId: 'cust-de-001', job: 'Heizungstausch — Krüger', amount: 6800, status: 'sent', trade: 'plumbing', lastUpdated: '1 day ago' },
  { id: 'AN-2026-0042', customer: 'Stefan Weber', customerId: 'cust-de-002', job: 'Badezimmer Teilsanierung — Weber', amount: 4200, status: 'sent', trade: 'plumbing', lastUpdated: '4 days ago' },
  { id: 'AN-2026-0043', customer: 'Anja Hoffmann', customerId: 'cust-de-003', job: 'Badsanierung komplett — Hoffmann', amount: 9400, status: 'accepted', trade: 'plumbing', lastUpdated: '8 days ago' },
  { id: 'AN-2026-0044', customer: 'Hausverwaltung Rheinblick GmbH', customerId: 'cust-de-004', job: 'Strangsanierung Haus 3 — Rheinblick', amount: 18500, status: 'sent', trade: 'plumbing', lastUpdated: '2 days ago' },
  { id: 'AN-2026-0045', customer: 'Bäckerei Lindner GmbH', customerId: 'cust-de-005', job: 'Fettabscheider Wartung — Lindner', amount: 890, status: 'draft', trade: 'plumbing', lastUpdated: '5 days ago' },
  { id: 'AN-2026-0046', customer: 'Familie Krüger', customerId: 'cust-de-001', job: 'Entkalkungsanlage — Krüger', amount: 1450, status: 'draft', trade: 'plumbing', lastUpdated: '6 days ago' },
];

// FR / ES / IT documents.
//
// Jobs+customers alone is a HALF fix — the German comment below says so, and it
// is the same trap here: invoices and quotes carry their own denormalised
// customer/job strings, so without these the Geld and Facturen tabs keep
// rendering Dutch names under a French UI, and the AI queue builds French
// cards around Dutch job titles.
//
// Amounts mirror the DE set deliberately: the point of these fixtures is the
// LANGUAGE and the market's formatting, not different numbers per country.

export const frQuotes: Quote[] = [
  { id: 'DE-2026-0041', customer: 'Famille Bernard', customerId: 'cust-fr-001', job: 'Remplacement chaudière — Bernard', amount: 6800, status: 'sent', trade: 'plumbing', lastUpdated: '1 day ago' },
  { id: 'DE-2026-0042', customer: 'Julien Petit', customerId: 'cust-fr-002', job: 'Rénovation partielle salle de bains — Petit', amount: 4200, status: 'sent', trade: 'plumbing', lastUpdated: '4 days ago' },
  { id: 'DE-2026-0043', customer: 'Camille Lefèvre', customerId: 'cust-fr-003', job: 'Rénovation salle de bains — Lefèvre', amount: 9400, status: 'accepted', trade: 'plumbing', lastUpdated: '8 days ago' },
  { id: 'DE-2026-0044', customer: 'Syndic Bellecour SAS', customerId: 'cust-fr-004', job: 'Rénovation colonne montante — Bellecour', amount: 18500, status: 'sent', trade: 'plumbing', lastUpdated: '2 days ago' },
  { id: 'DE-2026-0045', customer: 'Boulangerie Lefort SARL', customerId: 'cust-fr-005', job: 'Entretien bac à graisses — Lefort', amount: 890, status: 'draft', trade: 'plumbing', lastUpdated: '5 days ago' },
];

export const frInvoices: Invoice[] = [
  { id: 'inv-fr-1', reference: 'FA-2026-0087', customer: 'Boulangerie Lefort SARL', customerId: 'cust-fr-005', job: 'Rénovation réseau eau potable — Boulangerie Lefort', jobId: 'j-fr-5', amount: 5200, status: 'overdue', dueInDays: -14, dueDate: localDateKey(new Date(Date.now() - 14 * 86400000)), sentAt: new Date(Date.now() - 44 * 86400000).toISOString(), createdAt: new Date(Date.now() - 44 * 86400000).toISOString() },
  { id: 'inv-fr-2', reference: 'FA-2026-0088', customer: 'Julien Petit', customerId: 'cust-fr-002', job: 'Entretien chaudière — Petit', amount: 180, status: 'overdue', dueInDays: -11, dueDate: localDateKey(new Date(Date.now() - 11 * 86400000)), sentAt: new Date(Date.now() - 41 * 86400000).toISOString(), createdAt: new Date(Date.now() - 41 * 86400000).toISOString() },
  { id: 'inv-fr-3', reference: 'FA-2026-0086', customer: 'Camille Lefèvre', customerId: 'cust-fr-003', job: 'Acompte rénovation salle de bains — Lefèvre', amount: 3200, status: 'paid', dueInDays: 0, dueDate: localDateKey(new Date(Date.now() - 3 * 86400000)), paidAt: new Date(Date.now() - 2 * 86400000).toISOString(), sentAt: new Date(Date.now() - 20 * 86400000).toISOString(), createdAt: new Date(Date.now() - 20 * 86400000).toISOString() },
  { id: 'inv-fr-4', reference: 'FA-2026-0089', customer: 'Famille Bernard', customerId: 'cust-fr-001', job: 'Dépannage chaudière — Bernard', amount: 290, status: 'draft', dueInDays: 14, dueDate: localDateKey(new Date(Date.now() + 14 * 86400000)), createdAt: new Date(Date.now() - 1 * 86400000).toISOString() },
];

export const esQuotes: Quote[] = [
  { id: 'PR-2026-0041', customer: 'Familia García', customerId: 'cust-es-001', job: 'Sustitución de caldera — García', amount: 6800, status: 'sent', trade: 'plumbing', lastUpdated: '1 day ago' },
  { id: 'PR-2026-0042', customer: 'Javier Ruiz', customerId: 'cust-es-002', job: 'Reforma parcial de baño — Ruiz', amount: 4200, status: 'sent', trade: 'plumbing', lastUpdated: '4 days ago' },
  { id: 'PR-2026-0043', customer: 'Lucía Navarro', customerId: 'cust-es-003', job: 'Reforma integral de baño — Navarro', amount: 9400, status: 'accepted', trade: 'plumbing', lastUpdated: '8 days ago' },
  { id: 'PR-2026-0044', customer: 'Administración Retiro S.L.', customerId: 'cust-es-004', job: 'Renovación de montante — Retiro', amount: 18500, status: 'sent', trade: 'plumbing', lastUpdated: '2 days ago' },
  { id: 'PR-2026-0045', customer: 'Panadería Molina S.L.', customerId: 'cust-es-005', job: 'Mantenimiento separador de grasas — Molina', amount: 890, status: 'draft', trade: 'plumbing', lastUpdated: '5 days ago' },
];

export const esInvoices: Invoice[] = [
  { id: 'inv-es-1', reference: 'FC-2026-0087', customer: 'Panadería Molina S.L.', customerId: 'cust-es-005', job: 'Renovación de red de agua potable — Panadería Molina', jobId: 'j-es-5', amount: 5200, status: 'overdue', dueInDays: -14, dueDate: localDateKey(new Date(Date.now() - 14 * 86400000)), sentAt: new Date(Date.now() - 44 * 86400000).toISOString(), createdAt: new Date(Date.now() - 44 * 86400000).toISOString() },
  { id: 'inv-es-2', reference: 'FC-2026-0088', customer: 'Javier Ruiz', customerId: 'cust-es-002', job: 'Mantenimiento de caldera — Ruiz', amount: 180, status: 'overdue', dueInDays: -11, dueDate: localDateKey(new Date(Date.now() - 11 * 86400000)), sentAt: new Date(Date.now() - 41 * 86400000).toISOString(), createdAt: new Date(Date.now() - 41 * 86400000).toISOString() },
  { id: 'inv-es-3', reference: 'FC-2026-0086', customer: 'Lucía Navarro', customerId: 'cust-es-003', job: 'Anticipo reforma de baño — Navarro', amount: 3200, status: 'paid', dueInDays: 0, dueDate: localDateKey(new Date(Date.now() - 3 * 86400000)), paidAt: new Date(Date.now() - 2 * 86400000).toISOString(), sentAt: new Date(Date.now() - 20 * 86400000).toISOString(), createdAt: new Date(Date.now() - 20 * 86400000).toISOString() },
  { id: 'inv-es-4', reference: 'FC-2026-0089', customer: 'Familia García', customerId: 'cust-es-001', job: 'Servicio urgente de caldera — García', amount: 290, status: 'draft', dueInDays: 14, dueDate: localDateKey(new Date(Date.now() + 14 * 86400000)), createdAt: new Date(Date.now() - 1 * 86400000).toISOString() },
];

export const itQuotes: Quote[] = [
  { id: 'PV-2026-0041', customer: 'Famiglia Rossi', customerId: 'cust-it-001', job: 'Sostituzione caldaia — Rossi', amount: 6800, status: 'sent', trade: 'plumbing', lastUpdated: '1 day ago' },
  { id: 'PV-2026-0042', customer: 'Marco Conti', customerId: 'cust-it-002', job: 'Ristrutturazione parziale bagno — Conti', amount: 4200, status: 'sent', trade: 'plumbing', lastUpdated: '4 days ago' },
  { id: 'PV-2026-0043', customer: 'Giulia Greco', customerId: 'cust-it-003', job: 'Ristrutturazione completa bagno — Greco', amount: 9400, status: 'accepted', trade: 'plumbing', lastUpdated: '8 days ago' },
  { id: 'PV-2026-0044', customer: 'Amministrazione Navigli S.r.l.', customerId: 'cust-it-004', job: 'Rifacimento colonna montante — Navigli', amount: 18500, status: 'sent', trade: 'plumbing', lastUpdated: '2 days ago' },
  { id: 'PV-2026-0045', customer: 'Panificio Bruno S.r.l.', customerId: 'cust-it-005', job: 'Manutenzione separatore di grassi — Bruno', amount: 890, status: 'draft', trade: 'plumbing', lastUpdated: '5 days ago' },
];

export const itInvoices: Invoice[] = [
  { id: 'inv-it-1', reference: 'FT-2026-0087', customer: 'Panificio Bruno S.r.l.', customerId: 'cust-it-005', job: 'Rifacimento rete acqua potabile — Panificio Bruno', jobId: 'j-it-5', amount: 5200, status: 'overdue', dueInDays: -14, dueDate: localDateKey(new Date(Date.now() - 14 * 86400000)), sentAt: new Date(Date.now() - 44 * 86400000).toISOString(), createdAt: new Date(Date.now() - 44 * 86400000).toISOString() },
  { id: 'inv-it-2', reference: 'FT-2026-0088', customer: 'Marco Conti', customerId: 'cust-it-002', job: 'Manutenzione caldaia — Conti', amount: 180, status: 'overdue', dueInDays: -11, dueDate: localDateKey(new Date(Date.now() - 11 * 86400000)), sentAt: new Date(Date.now() - 41 * 86400000).toISOString(), createdAt: new Date(Date.now() - 41 * 86400000).toISOString() },
  { id: 'inv-it-3', reference: 'FT-2026-0086', customer: 'Giulia Greco', customerId: 'cust-it-003', job: 'Acconto ristrutturazione bagno — Greco', amount: 3200, status: 'paid', dueInDays: 0, dueDate: localDateKey(new Date(Date.now() - 3 * 86400000)), paidAt: new Date(Date.now() - 2 * 86400000).toISOString(), sentAt: new Date(Date.now() - 20 * 86400000).toISOString(), createdAt: new Date(Date.now() - 20 * 86400000).toISOString() },
  { id: 'inv-it-4', reference: 'FT-2026-0089', customer: 'Famiglia Rossi', customerId: 'cust-it-001', job: 'Intervento urgente caldaia — Rossi', amount: 290, status: 'draft', dueInDays: 14, dueDate: localDateKey(new Date(Date.now() + 14 * 86400000)), createdAt: new Date(Date.now() - 1 * 86400000).toISOString() },
];

export const deInvoices: Invoice[] = [
  // B2B, and a GmbH — the customer that can already demand XRechnung today.
  { id: 'inv-de-1', reference: 'RE-2026-0087', customer: 'Bäckerei Lindner GmbH', customerId: 'cust-de-005', job: 'Trinkwasserleitung erneuern — Bäckerei Lindner', jobId: 'j-de-5', amount: 5200, status: 'overdue', dueInDays: -14, dueDate: localDateKey(new Date(Date.now() - 14 * 86400000)), sentAt: new Date(Date.now() - 44 * 86400000).toISOString(), createdAt: new Date(Date.now() - 44 * 86400000).toISOString() },
  { id: 'inv-de-2', reference: 'RE-2026-0088', customer: 'Stefan Weber', customerId: 'cust-de-002', job: 'Heizungswartung — Weber', amount: 180, status: 'overdue', dueInDays: -11, dueDate: localDateKey(new Date(Date.now() - 11 * 86400000)), sentAt: new Date(Date.now() - 41 * 86400000).toISOString(), createdAt: new Date(Date.now() - 41 * 86400000).toISOString() },
  { id: 'inv-de-3', reference: 'RE-2026-0086', customer: 'Anja Hoffmann', customerId: 'cust-de-003', job: 'Abschlagsrechnung Badsanierung — Hoffmann', amount: 3200, status: 'paid', dueInDays: 0, dueDate: localDateKey(new Date(Date.now() - 3 * 86400000)), paidAt: new Date(Date.now() - 2 * 86400000).toISOString(), sentAt: new Date(Date.now() - 20 * 86400000).toISOString(), createdAt: new Date(Date.now() - 20 * 86400000).toISOString() },
  { id: 'inv-de-4', reference: 'RE-2026-0089', customer: 'Familie Krüger', customerId: 'cust-de-001', job: 'Notdienst Heizung — Krüger', amount: 290, status: 'draft', dueInDays: 14, dueDate: localDateKey(new Date(Date.now() + 14 * 86400000)), createdAt: new Date(Date.now() - 1 * 86400000).toISOString() },
];
