import { Invoice, Quote } from '../domain/documents';
import { localDateKey } from '../utils/dateKey';

export const quotes: Quote[] = [
  {
    id: 'q-seed-1',
    customer: 'Fam. Bakker',
    customerId: 'cust-004',
    job: 'Lekkage inspectie — Fam. Bakker',
    amount: 180,
    status: 'sent',
    trade: 'plumbing',
    lastUpdated: '1 day ago',
  },
  {
    id: 'q-seed-2',
    customer: 'Fam. de Vries',
    customerId: 'cust-001',
    job: 'CV-ketel onderhoud — Fam. de Vries',
    amount: 450,
    status: 'accepted',
    trade: 'plumbing',
    lastUpdated: '3 days ago',
  },
  {
    id: 'q-seed-3',
    customer: 'Fam. Jansen',
    customerId: 'cust-002',
    job: 'Badkamer renovatie — Fam. Jansen',
    amount: 4200,
    status: 'accepted',
    trade: 'plumbing',
    lastUpdated: '1 week ago',
  },
  {
    id: 'q-102',
    customer: 'De Jong',
    job: 'Interior repaint',
    amount: 2450,
    status: 'draft',
    lastUpdated: '2 days ago',
  },
  {
    id: 'q-103',
    customer: 'Van Dijk',
    job: 'Exterior repaint',
    amount: 1120,
    status: 'draft',
    lastUpdated: '1 day ago',
  },
  {
    id: 'q-104',
    customer: 'Bouwgroep Atlas',
    job: 'Fence staining',
    amount: 780,
    status: 'sent',
    lastUpdated: 'Today',
  },
];

export const invoices: Invoice[] = [
  {
    id: 'inv-seed-1',
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
    id: 'i-1043',
    customer: 'Bouwgroep Atlas',
    job: 'Exterior repaint',
    amount: 450,
    status: 'overdue',
    dueInDays: -10,
    dueDate: localDateKey(new Date(Date.now() - 10 * 86400000)),
    sentAt: new Date(Date.now() - 40 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 40 * 86400000).toISOString(),
  },
  {
    id: 'i-1044',
    customer: 'Van Dijk',
    job: 'Exterior repaint',
    amount: 760,
    status: 'paid',
    dueInDays: 0,
    paidAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    sentAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    id: 'i-1045',
    customer: 'De Jong',
    job: 'Interior repaint',
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
  { id: 'q-de-1', customer: 'Familie Krüger', customerId: 'cust-de-001', job: 'Heizungstausch — Krüger', amount: 6800, status: 'sent', trade: 'plumbing', lastUpdated: '1 day ago' },
  { id: 'q-de-2', customer: 'Stefan Weber', customerId: 'cust-de-002', job: 'Badezimmer Teilsanierung — Weber', amount: 4200, status: 'sent', trade: 'plumbing', lastUpdated: '4 days ago' },
  { id: 'q-de-3', customer: 'Anja Hoffmann', customerId: 'cust-de-003', job: 'Badsanierung komplett — Hoffmann', amount: 9400, status: 'accepted', trade: 'plumbing', lastUpdated: '8 days ago' },
  { id: 'q-de-4', customer: 'Hausverwaltung Rheinblick GmbH', customerId: 'cust-de-004', job: 'Strangsanierung Haus 3 — Rheinblick', amount: 18500, status: 'sent', trade: 'plumbing', lastUpdated: '2 days ago' },
  { id: 'q-de-5', customer: 'Bäckerei Lindner GmbH', customerId: 'cust-de-005', job: 'Fettabscheider Wartung — Lindner', amount: 890, status: 'draft', trade: 'plumbing', lastUpdated: '5 days ago' },
  { id: 'q-de-6', customer: 'Familie Krüger', customerId: 'cust-de-001', job: 'Entkalkungsanlage — Krüger', amount: 1450, status: 'draft', trade: 'plumbing', lastUpdated: '6 days ago' },
];

export const deInvoices: Invoice[] = [
  // B2B, and a GmbH — the customer that can already demand XRechnung today.
  { id: 'inv-de-1', customer: 'Bäckerei Lindner GmbH', customerId: 'cust-de-005', job: 'Trinkwasserleitung erneuern — Bäckerei Lindner', jobId: 'j-de-5', amount: 5200, status: 'overdue', dueInDays: -14, dueDate: localDateKey(new Date(Date.now() - 14 * 86400000)), sentAt: new Date(Date.now() - 44 * 86400000).toISOString(), createdAt: new Date(Date.now() - 44 * 86400000).toISOString() },
  { id: 'inv-de-2', customer: 'Stefan Weber', customerId: 'cust-de-002', job: 'Heizungswartung — Weber', amount: 180, status: 'overdue', dueInDays: -11, dueDate: localDateKey(new Date(Date.now() - 11 * 86400000)), sentAt: new Date(Date.now() - 41 * 86400000).toISOString(), createdAt: new Date(Date.now() - 41 * 86400000).toISOString() },
  { id: 'inv-de-3', customer: 'Anja Hoffmann', customerId: 'cust-de-003', job: 'Abschlagsrechnung Badsanierung — Hoffmann', amount: 3200, status: 'paid', dueInDays: 0, dueDate: localDateKey(new Date(Date.now() - 3 * 86400000)), paidAt: new Date(Date.now() - 2 * 86400000).toISOString(), sentAt: new Date(Date.now() - 20 * 86400000).toISOString(), createdAt: new Date(Date.now() - 20 * 86400000).toISOString() },
  { id: 'inv-de-4', customer: 'Familie Krüger', customerId: 'cust-de-001', job: 'Notdienst Heizung — Krüger', amount: 290, status: 'draft', dueInDays: 14, dueDate: localDateKey(new Date(Date.now() + 14 * 86400000)), createdAt: new Date(Date.now() - 1 * 86400000).toISOString() },
];
