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

// ─── FR / ES / IT demo profiles ──────────────────────────────────────────────
// Not markets we sell into yet — these exist so the harness can WALK them.
// 44 surfaces read `businessProfile?.country ?? 'NL'` and 72 read
// `user?.country`, so without a profile carrying the country every walk takes
// the NL branch and every country-gated surface is invisible. That is exactly
// how five countries ended up being shown the Dutch tax office (learnings #168)
// and how the German demo shipped Dutch job names.
//
// Registration/VAT numbers follow each country's real FORMAT (SIRET 14 digits,
// CIF letter+8, Partita IVA 11 digits) because format validators run on them —
// they are not claims about a real company.

// The identifiers below are checksum-VALID, not merely well-shaped. They were
// not: the FR SIRET failed Luhn, the ES CIF failed its control digit and the IT
// partita IVA failed its check digit — all three would now be refused by
// `checkInvoiceReadiness`, which is the right answer for a real contractor and
// the wrong one for the demo these markets are screenshotted from.
export const FR_BUSINESS_PROFILE: BusinessProfile = {
  isComplete: true,
  completenessPercent: 100,
  businessName: "Plomberie Moreau SARL",
  email: "contact@plomberie-moreau.fr",
  phone: "+33 1 55 50 14 20",
  address: "24 Rue des Artisans, 69003 Lyon",
  city: "Lyon",
  postcode: "69003",
  website: "https://plomberie-moreau.fr",
  country: 'FR',
  trade: "plumbing",
  businessType: "sarl",
  teamSize: 'small',
  vatScheme: 'standard',
  registrationNumber: "81234567800013", // SIRET — 14 digits, Luhn-valid (…19 was not)
  vatNumber: "FR81812345678",
  invoicePrefix: "FA",
  quotePrefix: "DE",
  defaultPaymentTerms: 30,
  serviceAreaRadius: 30,
  certifications: [
    "RGE QualiPAC",
    "Qualibat 5312",
    "Assurance décennale",
  ],
};

export const ES_BUSINESS_PROFILE: BusinessProfile = {
  isComplete: true,
  completenessPercent: 100,
  businessName: "Fontanería Serrano S.L.",
  email: "info@fontaneria-serrano.es",
  phone: "+34 91 555 0142",
  address: "Calle Mayor 87, 28013 Madrid",
  city: "Madrid",
  postcode: "28013",
  website: "https://fontaneria-serrano.es",
  country: 'ES',
  trade: "plumbing",
  businessType: "sl",
  teamSize: 'small',
  vatScheme: 'standard',
  registrationNumber: "B12345674", // CIF — letter + 7 digits + control (…8 failed it)
  vatNumber: "ESB12345674",
  invoicePrefix: "FAC",
  quotePrefix: "PRE",
  defaultPaymentTerms: 30,
  serviceAreaRadius: 30,
  certifications: [
    "Carné de Instalador de Gas categoría B",
    "Licencia de Actividad",
    "Seguro de Responsabilidad Civil",
  ],
};

export const IT_BUSINESS_PROFILE: BusinessProfile = {
  isComplete: true,
  completenessPercent: 100,
  businessName: "Idraulica Ferrari S.r.l.",
  email: "info@idraulicaferrari.it",
  phone: "+39 02 5550 142",
  address: "Via Garibaldi 42, 20121 Milano",
  city: "Milano",
  postcode: "20121",
  website: "https://idraulicaferrari.it",
  country: 'IT',
  trade: "plumbing",
  businessType: "srl",
  teamSize: 'small',
  vatScheme: 'standard',
  registrationNumber: "MI-1234567", // REA
  vatNumber: "IT12345678903", // Partita IVA — 11 digits, check digit valid (…01 was not)
  invoicePrefix: "FT",
  quotePrefix: "PRV",
  defaultPaymentTerms: 30,
  serviceAreaRadius: 30,
  certifications: [
    "DM 37/08 Lettera A — Impianti Idraulici",
    "Iscrizione Camera di Commercio",
    "Assicurazione RC Professionale",
  ],
};
