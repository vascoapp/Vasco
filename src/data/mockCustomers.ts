import type { Customer } from '../domain/customers';

export const customers: Customer[] = [
  {
    id: 'cust-001',
    name: 'Emma de Vries',
    email: 'emma@email.nl',
    phone: '+31 6 1234 5678',
    address: 'Prinsengracht 123, 1015 DT Amsterdam',
  },
  {
    id: 'cust-002',
    name: 'Thomas van Dijk',
    email: 'thomas.vandijk@gmail.com',
    phone: '+31 6 9876 5432',
    address: 'Beethovenstraat 45, 1077 HN Amsterdam',
  },
  {
    id: 'cust-003',
    name: 'Lisa Jansen',
    email: 'l.jansen@cityprop.nl',
    phone: '+31 20 555 1234',
    address: 'Herengracht 500, 1017 CB Amsterdam',
  },
  {
    id: 'cust-004',
    name: 'Mark & Sophie Peters',
    email: 'peters.family@outlook.com',
    phone: '+31 6 5555 4444',
    address: 'Vondelstraat 78, 1054 GN Amsterdam',
  },
];
