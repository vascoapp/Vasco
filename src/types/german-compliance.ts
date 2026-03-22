// =============================================================================
// GERMAN COMPLIANCE TYPES
// =============================================================================
// Handwerker legal requirements: Handelsregister, Steuernummer, UStIdNr,
// Meisterpflicht, trade certifications, insurance, e-invoicing
// =============================================================================

// ---------------------------------------------------------------------------
// Business Registration
// ---------------------------------------------------------------------------

export interface HandelsregisterRegistration {
  hrNumber: string; // HRB 12345
  court: string; // Amtsgericht München
  legalForm: 'Einzelunternehmen' | 'GbR' | 'GmbH' | 'UG' | 'OHG' | 'KG' | 'AG';
  businessName: string;
  registeredAddress: string;
  registeredAt?: string;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Tax Registration
// ---------------------------------------------------------------------------

export interface GermanTaxRegistration {
  steuernummer: string; // 123/456/78901 (local tax office number)
  ustIdNr?: string; // DE123456789 (EU VAT ID)
  finanzamt: string; // Local tax office name
  steuerart: 'gewerblich' | 'freiberuflich';
  kleinunternehmerRegelung: boolean; // §19 UStG small business exemption
  istVersteuerung: boolean; // cash-based vs accrual accounting
  voranmeldungszeitraum: 'monatlich' | 'vierteljaehrlich' | 'jaehrlich';
}

export const GERMAN_VAT_RATES = {
  standard: 0.19, // 19%
  reduced: 0.07,  // 7% (food, books, certain services)
  zero: 0,        // 0% (exports, intra-EU)
} as const;

export const GERMAN_INVOICE_REQUIREMENTS = [
  'Vollständiger Name und Anschrift des Rechnungsstellers',
  'Vollständiger Name und Anschrift des Rechnungsempfängers',
  'Steuernummer oder USt-IdNr des Rechnungsstellers',
  'Ausstellungsdatum der Rechnung',
  'Fortlaufende Rechnungsnummer',
  'Menge und Art der Lieferung/Leistung',
  'Zeitpunkt der Lieferung/Leistung',
  'Nettobetrag (aufgeschlüsselt nach Steuersätzen)',
  'Angewandter Steuersatz (19% oder 7%)',
  'Steuerbetrag',
  'Bruttobetrag',
  'Hinweis bei Steuerbefreiung (§19 UStG)',
] as const;

// ---------------------------------------------------------------------------
// E-Invoicing (mandatory from 2025/2027)
// ---------------------------------------------------------------------------

export type EInvoiceFormat = 'XRechnung' | 'ZUGFeRD' | 'Peppol';

export interface EInvoiceConfig {
  format: EInvoiceFormat;
  leitweg_id?: string; // Required for B2G (government) invoices
  peppol_id?: string;
  zugferd_profile: 'MINIMUM' | 'BASIC' | 'COMFORT' | 'EXTENDED';
}

export const EINVOICE_TIMELINE = {
  receiving_mandatory: '2025-01-01', // Must accept e-invoices
  sending_above_800k: '2027-01-01', // Must send if revenue > €800K
  sending_all: '2028-01-01',        // All businesses must send
} as const;

// ---------------------------------------------------------------------------
// Trade Certifications (Meisterpflicht)
// ---------------------------------------------------------------------------

export type GermanCertificationType =
  | 'meisterbrief'           // Master craftsman certificate
  | 'gesellenbrief'          // Journeyman certificate
  | 'dvgw'                   // Gas/water installer certification
  | 'tuev'                   // TÜV safety inspection
  | 'vde'                    // Electrical safety
  | 'scc'                    // Safety Checklist Contractors (German VCA)
  | 'aevo'                   // Trainer qualification
  | 'befaehigungsnachweis'   // Qualification certificate
  | 'sachkundenachweis'      // Expert knowledge proof
  | 'energieberater'         // Energy advisor
  | 'schornsteinfeger'       // Chimney sweep license
  | 'asbestschein'           // Asbestos handling
  | 'erste_hilfe'            // First aid
  | 'brandschutzhelfer';     // Fire safety helper

export interface GermanCertification {
  type: GermanCertificationType;
  name: string;
  issuer: string; // HWK, IHK, TÜV, DVGW, etc.
  number?: string;
  issuedAt: string;
  expiresAt?: string;
  trade: string;
  isRequired: boolean; // Meisterpflicht trades require meisterbrief
}

// Trades requiring Meisterbrief (Anlage A der Handwerksordnung)
export const MEISTERPFLICHT_TRADES = [
  'Maurer und Betonbauer',
  'Zimmerer',
  'Dachdecker',
  'Straßenbauer',
  'Wärme-, Kälte- und Schallschutzisolierer',
  'Brunnenbauer',
  'Steinmetzen und Steinbildhauer',
  'Stuckateure',
  'Maler und Lackierer',
  'Gerüstbauer',
  'Schornsteinfeger',
  'Metallbauer',
  'Chirurgiemechaniker',
  'Karosserie- und Fahrzeugbauer',
  'Feinwerkmechaniker',
  'Zweiradmechaniker',
  'Kälteanlagenbauer',
  'Informationstechniker',
  'Kraftfahrzeugtechniker',
  'Installateur und Heizungsbauer',
  'Elektrotechniker',
  'Elektromaschinenbauer',
  'Tischler',
  'Boots- und Schiffbauer',
  'Seiler',
  'Bäcker',
  'Fleischer',
  'Augenoptiker',
  'Hörgeräteakustiker',
  'Orthopädietechniker',
  'Orthopädieschuhmacher',
  'Zahntechniker',
  'Friseure',
  'Glaser',
  'Glasbläser und Glasapparatebauer',
  'Mechaniker für Reifen- und Vulkanisationstechnik',
  'Klempner',
  'Behälter- und Apparatebauer',
  'Ofen- und Luftheizungsbauer',
  'Rolladen- und Sonnenschutztechniker',
  'Büchsenmacher',
  'Reetdachdecker',
  'Schilder- und Lichtreklamehersteller',
  'Böttcher',
] as const;

// ---------------------------------------------------------------------------
// Insurance (Versicherungen)
// ---------------------------------------------------------------------------

export type GermanInsuranceType =
  | 'betriebshaftpflicht'    // Business liability
  | 'berufshaftpflicht'      // Professional liability
  | 'berufsgenossenschaft'   // Workers' comp (BG Bau)
  | 'gewerbeversicherung'    // Business insurance bundle
  | 'kfz_versicherung'       // Vehicle insurance
  | 'rechtsschutz'           // Legal protection
  | 'berufsunfaehigkeit'     // Disability insurance
  | 'krankenversicherung'    // Health insurance
  | 'unfallversicherung'     // Accident insurance
  | 'bauherrenhaftpflicht';  // Construction owner liability

export interface GermanInsurance {
  type: GermanInsuranceType;
  provider: string;
  policyNumber: string;
  coverageAmount: number;
  annualPremium: number;
  validFrom: string;
  validUntil: string;
  bgBauMitgliedsnummer?: string; // BG Bau membership number
}

// BG Bau (Berufsgenossenschaft der Bauwirtschaft) — mandatory for construction
export const BG_BAU = {
  name: 'BG BAU - Berufsgenossenschaft der Bauwirtschaft',
  website: 'https://www.bgbau.de',
  phone: '+49 30 85781-0',
  description: 'Gesetzliche Unfallversicherung für die Bauwirtschaft',
} as const;

// ---------------------------------------------------------------------------
// Government Portals
// ---------------------------------------------------------------------------

export const GERMAN_GOVERNMENT_PORTALS = {
  elster: { name: 'ELSTER', url: 'https://www.elster.de', description: 'Steuererklärung und USt-Voranmeldung' },
  handwerksrolle: { name: 'Handwerksrolle', url: 'https://www.zdh.de', description: 'Handwerkskammer Registrierung' },
  ihk: { name: 'IHK', url: 'https://www.ihk.de', description: 'Industrie- und Handelskammer' },
  bgBau: { name: 'BG BAU', url: 'https://www.bgbau.de', description: 'Berufsgenossenschaft Bauwirtschaft' },
  bundesnetzagentur: { name: 'Bundesnetzagentur', url: 'https://www.bundesnetzagentur.de', description: 'Netzanschluss und Genehmigungen' },
  bafa: { name: 'BAFA', url: 'https://www.bafa.de', description: 'Förderprogramme und Energieberatung' },
} as const;

// ---------------------------------------------------------------------------
// Retention Periods (Aufbewahrungsfristen)
// ---------------------------------------------------------------------------

export const GERMAN_RETENTION_PERIODS = {
  rechnungen: 10 * 365,        // 10 years (§14b UStG)
  buchungsbelege: 10 * 365,    // 10 years (§257 HGB)
  geschaeftsbriefe: 6 * 365,   // 6 years (§257 HGB)
  vertraege: 10 * 365,         // 10 years
  lohnunterlagen: 6 * 365,     // 6 years
  steuererklaerungen: 10 * 365, // 10 years
} as const;
