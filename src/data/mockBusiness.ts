import { BusinessProfile } from '../domain/business';

// Default/empty seed — used for fresh accounts.
export const businessProfile: BusinessProfile = {
  isComplete: false,
  completenessPercent: 60,
};

// R78 US foundation: seed business profile for contractor@vasco.us.dev so
// the demo flow renders realistic US invoices (EIN, TX address, ACH bank
// details, sales-tax-eligible). Triggers when getCurrentCountry() returns
// 'US' on user-change.
export const US_BUSINESS_PROFILE: BusinessProfile = {
  isComplete: true,
  completenessPercent: 100,
  businessName: "Reynolds Heating & Cooling",
  email: "mike@reynoldshvac.com",
  phone: "+1 512 555 0142",
  address: "2847 Burnet Road, Austin, TX 78757",
  city: "Austin",
  postcode: "78757",
  website: "https://reynoldshvac.com",
  country: 'US',
  state: 'TX',
  trade: "gas-hvac",
  businessType: "llc",
  teamSize: 'small',
  vatScheme: 'standard', // US has no VAT — 'standard' is the no-op default
  // Federal EIN format XX-XXXXXXX
  registrationNumber: "75-1234567",
  // R74: ACH bank details (US analogue of IBAN/BIC)
  routingNumber: "111000025", // Bank of America Texas routing
  bankAccountNumber: "1234567890123",
  invoicePrefix: "INV",
  quotePrefix: "EST",
  defaultPaymentTerms: 14,
  serviceAreaRadius: 30,
  certifications: [
    "EPA 608 (HVAC)",
    "NATE (HVAC)",
    "OSHA 30",
    "State Contractor License — TX TACLA85432C",
  ],
  enabledPaymentMethods: ['credit_card', 'apple_pay'],
};

// Germany is the beachhead (docs/GO_TO_MARKET_PLAN.md), but the default seed
// profile above carries NO country — and ~53 surfaces read
// `businessProfile?.country ?? 'NL'`. So the German demo contractor rendered
// Dutch currency ("€ 760" rather than "760 €") and, worse, every DE-gated
// surface stayed hidden: the German VAT card in geld.tsx and the XRechnung /
// ZUGFeRD paths all test `businessProfile?.country === 'DE'`. The market whose
// e-invoice mandate IS the wedge could not be demonstrated at all.
//
// Same mechanism as US_BUSINESS_PROFILE: swapped in on user-change when
// getCurrentCountry() is 'DE'. Kleinunternehmer is deliberately NOT used —
// §19 UStG would suppress VAT entirely and hide the very surfaces this exists
// to make reachable.
export const DE_BUSINESS_PROFILE: BusinessProfile = {
  isComplete: true,
  completenessPercent: 100,
  businessName: "Bergmann Sanitär & Heizung GmbH",
  email: "kontakt@bergmann-shk.de",
  phone: "+49 221 5550142",
  address: "Aachener Straße 128, 50674 Köln",
  city: "Köln",
  postcode: "50674",
  website: "https://bergmann-shk.de",
  country: 'DE',
  trade: "plumbing",
  businessType: "gmbh",
  teamSize: 'small',
  vatScheme: 'standard',
  // Handelsregisternummer + USt-IdNr. (DE + 9 digits) — the formats
  // business-settings validates against for DE.
  registrationNumber: "HRB 84521",
  vatNumber: "DE812345678",
  invoicePrefix: "RE",
  quotePrefix: "AN",
  defaultPaymentTerms: 14,
  serviceAreaRadius: 30,
  certifications: [
    "Meisterbrief SHK",
    "Eintrag Handwerksrolle Anlage A",
    "Fachbetrieb nach §19l WHG",
  ],
};
