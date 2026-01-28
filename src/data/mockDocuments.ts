import { Invoice, Quote } from '../domain/documents';

export const quotes: Quote[] = [
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
