import { Invoice, Quote } from '../domain/documents';

export const quotes: Quote[] = [
  {
    id: 'q-seed-1',
    customer: 'cust-004',
    job: 'Lekkage inspectie — Fam. Bakker',
    amount: 180,
    status: 'sent',
    trade: 'plumbing',
    lastUpdated: '1 day ago',
  },
  {
    id: 'q-seed-2',
    customer: 'cust-001',
    job: 'CV-ketel onderhoud — Fam. de Vries',
    amount: 450,
    status: 'accepted',
    trade: 'plumbing',
    lastUpdated: '3 days ago',
  },
  {
    id: 'q-seed-3',
    customer: 'cust-002',
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
    id: 'i-1043',
    customer: 'Bouwgroep Atlas',
    job: 'Exterior repaint',
    amount: 1980,
    status: 'overdue',
    dueInDays: -7,
  },
  {
    id: 'i-1044',
    customer: 'Van Dijk',
    job: 'Exterior repaint',
    amount: 760,
    status: 'sent',
    dueInDays: 7,
  },
  {
    id: 'i-1045',
    customer: 'De Jong',
    job: 'Interior repaint',
    amount: 640,
    status: 'paid',
    dueInDays: 0,
  },
];
