// Example contact values per market, shown as PLACEHOLDERS (never defaults).
// Shared by the customer sheet and the crew form — the crew form hardcoded a
// US "mike@example.com" / "+1 555 0123" into every market (walk, 2026-09-29).
/** Example values per market, shown as placeholders (not as defaults). */
export function contactExamples(country: string) {
  const pick = <T,>(m: Record<string, T>, fallback: T): T => m[country] ?? fallback;
  return {
    email: pick({ US: 'info@example.com', UK: 'info@example.co.uk', DE: 'info@beispiel.de', FR: 'info@exemple.fr', ES: 'info@ejemplo.es', IT: 'info@esempio.it' }, 'info@dejong.nl'),
    phone: pick({ US: '(555) 123-4567', UK: '+44 20 7946 0958', DE: '+49 30 12345678', FR: '+33 6 12 34 56 78', ES: '+34 600 123 456', IT: '+39 333 1234567' }, '+31 6 12345678'),
    address: pick({ US: '123 Main St', UK: '10 Downing Street', DE: 'Unter den Linden 1', FR: '1 rue de Rivoli', ES: 'Calle Mayor 1', IT: 'Via Roma 1' }, 'Keizersgracht 100'),
    postcode: pick({ NL: '1012 AB', DE: '10115', FR: '75001', ES: '28001', IT: '20100', UK: 'SW1A 1AA' }, '78701'),
    city: pick({ DE: 'Berlin', FR: 'Paris', ES: 'Madrid', IT: 'Milano', UK: 'London', US: 'Austin' }, 'Amsterdam'),
    vat: pick({ DE: 'DE123456789', FR: 'FR12345678901', ES: 'ESB12345678', IT: 'IT12345678901', UK: 'GB123456789' }, 'NL123456789B01'),
  };
}
