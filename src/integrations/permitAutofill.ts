// =============================================================================
// PERMIT APPLICATION AUTO-FILL — NL + DE (R246)
// =============================================================================
// Government permit forms still take 30-90 minutes per application because
// contractors retype the same business data into every field. Auto-fill
// from the businessProfile cuts this to <5 minutes.
//
// This module ships the field-mapping registry. Each permit has a known set
// of input field labels (or DOM ids when scraped); we map businessProfile
// keys to those fields. The actual form submission happens via the
// government portal — we hand the contractor a pre-filled URL or downloadable
// JSON they paste into the portal.
// =============================================================================

export type PermitCountry = 'NL' | 'DE';

export interface PermitDefinition {
  id: string;
  country: PermitCountry;
  title: string;
  authority: string;
  portalUrl: string;
  description: string;
  fieldMapping: Record<string, BusinessProfileKey>;
  estimatedMinutesSaved: number;
}

type BusinessProfileKey =
  | 'businessName' | 'tradeName' | 'kvkNumber' | 'hrbNumber' | 'vatNumber'
  | 'iban' | 'streetAddress' | 'postcode' | 'city' | 'country'
  | 'phone' | 'email' | 'website'
  | 'ownerFirstName' | 'ownerLastName' | 'ownerBsn' | 'ownerEmail';

export interface PrefilledPermit {
  permit: PermitDefinition;
  filledFields: Record<string, string>;
  missingFields: string[];
  portalUrlWithParams?: string;
}

// ---------------------------------------------------------------------------
// Permit registry — top 5 most-applied for NL + DE small contractors
// ---------------------------------------------------------------------------

export const PERMITS: PermitDefinition[] = [
  // 🇳🇱 NL
  {
    id: 'nl_omgevingsvergunning',
    country: 'NL',
    title: 'Omgevingsvergunning (bouwen, slopen, kappen)',
    authority: 'Gemeente via Omgevingsloket',
    portalUrl: 'https://www.omgevingsloket.nl/',
    description: 'Bouw-, sloop-, of kapvergunning aanvragen via gemeente.',
    fieldMapping: {
      'aanvrager_bedrijfsnaam': 'businessName',
      'aanvrager_kvk': 'kvkNumber',
      'aanvrager_adres': 'streetAddress',
      'aanvrager_postcode': 'postcode',
      'aanvrager_plaats': 'city',
      'aanvrager_telefoon': 'phone',
      'aanvrager_email': 'email',
      'btw_nummer': 'vatNumber',
    },
    estimatedMinutesSaved: 35,
  },
  {
    id: 'nl_zzp_btw_aangifte',
    country: 'NL',
    title: 'BTW-aangifte (Belastingdienst)',
    authority: 'Belastingdienst',
    portalUrl: 'https://www.belastingdienst.nl/wps/wcm/connect/nl/btw/btw',
    description: 'Kwartaal-BTW-aangifte voor ZZP en MKB.',
    fieldMapping: {
      'btw_id': 'vatNumber',
      'bedrijfsnaam': 'businessName',
      'iban': 'iban',
    },
    estimatedMinutesSaved: 15,
  },
  {
    id: 'nl_kvk_inschrijving_wijziging',
    country: 'NL',
    title: 'KvK Inschrijving / Wijziging',
    authority: 'Kamer van Koophandel',
    portalUrl: 'https://www.kvk.nl/inschrijven-en-wijzigen/',
    description: 'Bedrijf inschrijven of wijzigingen doorgeven.',
    fieldMapping: {
      'handelsnaam': 'tradeName',
      'kvk_nummer': 'kvkNumber',
      'adres': 'streetAddress',
      'postcode': 'postcode',
      'plaats': 'city',
      'telefoon': 'phone',
      'eigenaar_voornaam': 'ownerFirstName',
      'eigenaar_achternaam': 'ownerLastName',
      'bsn': 'ownerBsn',
    },
    estimatedMinutesSaved: 25,
  },
  {
    id: 'nl_arbo_riek',
    country: 'NL',
    title: 'RI&E + Plan van Aanpak (Arbowet)',
    authority: 'Inspectie SZW',
    portalUrl: 'https://www.rie.nl/',
    description: 'Risico-inventarisatie en evaluatie + actieplan.',
    fieldMapping: {
      'bedrijfsnaam': 'businessName',
      'kvk': 'kvkNumber',
      'adres': 'streetAddress',
      'contactpersoon_naam': 'ownerFirstName',
      'contactpersoon_email': 'ownerEmail',
    },
    estimatedMinutesSaved: 20,
  },
  {
    id: 'nl_vca_certificering',
    country: 'NL',
    title: 'VCA Certificering aanvraag',
    authority: 'Examencentrum (VCA / SSVV)',
    portalUrl: 'https://www.vca-online.nl/',
    description: 'VCA*/VCA** certificering voor bouwsector.',
    fieldMapping: {
      'bedrijfsnaam': 'businessName',
      'kvk': 'kvkNumber',
      'adres': 'streetAddress',
      'postcode': 'postcode',
      'contact_email': 'email',
    },
    estimatedMinutesSaved: 30,
  },

  // 🇩🇪 DE
  {
    id: 'de_handwerkskarte',
    country: 'DE',
    title: 'Handwerkskarte / Eintragung Handwerksrolle',
    authority: 'Handwerkskammer',
    portalUrl: 'https://www.zdh.de/',
    description: 'Eintragung in die Handwerksrolle.',
    fieldMapping: {
      'firmenname': 'businessName',
      'hrb_nummer': 'hrbNumber',
      'ust_id': 'vatNumber',
      'strasse': 'streetAddress',
      'plz': 'postcode',
      'ort': 'city',
      'telefon': 'phone',
      'email': 'email',
    },
    estimatedMinutesSaved: 30,
  },
  {
    id: 'de_baugenehmigung',
    country: 'DE',
    title: 'Baugenehmigung',
    authority: 'Bauamt der Gemeinde',
    portalUrl: 'https://www.serviceportal.bayern.de/',  // Bayern as example
    description: 'Antrag auf Baugenehmigung beim Bauamt.',
    fieldMapping: {
      'antragsteller_firma': 'businessName',
      'antragsteller_hrb': 'hrbNumber',
      'antragsteller_strasse': 'streetAddress',
      'antragsteller_plz': 'postcode',
      'antragsteller_ort': 'city',
      'antragsteller_telefon': 'phone',
    },
    estimatedMinutesSaved: 45,
  },
  {
    id: 'de_ust_voranmeldung',
    country: 'DE',
    title: 'Umsatzsteuer-Voranmeldung (ELSTER)',
    authority: 'Finanzamt via ELSTER',
    portalUrl: 'https://www.elster.de/',
    description: 'Monatliche / quartalsweise USt-Voranmeldung.',
    fieldMapping: {
      'ust_id': 'vatNumber',
      'firmenname': 'businessName',
      'iban': 'iban',
    },
    estimatedMinutesSaved: 15,
  },
  {
    id: 'de_gewerbeanmeldung',
    country: 'DE',
    title: 'Gewerbeanmeldung / Gewerbeummeldung',
    authority: 'Gewerbeamt der Gemeinde',
    portalUrl: 'https://service.bund.de/',
    description: 'An-, Um- oder Abmeldung eines Gewerbes.',
    fieldMapping: {
      'gewerbename': 'tradeName',
      'inhaber_vorname': 'ownerFirstName',
      'inhaber_nachname': 'ownerLastName',
      'gewerbeadresse': 'streetAddress',
      'plz': 'postcode',
      'ort': 'city',
    },
    estimatedMinutesSaved: 20,
  },
  {
    id: 'de_sokabau_meldung',
    country: 'DE',
    title: 'SOKA-BAU Meldung',
    authority: 'Urlaubs- und Lohnausgleichskasse der Bauwirtschaft',
    portalUrl: 'https://www.soka-bau.de/',
    description: 'Pflichtmeldung für Bauunternehmen.',
    fieldMapping: {
      'firmenname': 'businessName',
      'hrb': 'hrbNumber',
      'ust_id': 'vatNumber',
      'iban': 'iban',
      'adresse': 'streetAddress',
    },
    estimatedMinutesSaved: 25,
  },
];

// ---------------------------------------------------------------------------
// Auto-fill API
// ---------------------------------------------------------------------------

export interface BusinessProfileLike {
  businessName?: string;
  tradeName?: string;
  kvkNumber?: string;
  hrbNumber?: string;
  vatNumber?: string;
  iban?: string;
  streetAddress?: string;
  postcode?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  ownerFirstName?: string;
  ownerLastName?: string;
  ownerBsn?: string;
  ownerEmail?: string;
}

export function getPermitsForCountry(country: PermitCountry): PermitDefinition[] {
  return PERMITS.filter((p) => p.country === country);
}

export function getPermitById(id: string): PermitDefinition | null {
  return PERMITS.find((p) => p.id === id) ?? null;
}

export function autofillPermit(
  permit: PermitDefinition,
  profile: BusinessProfileLike,
): PrefilledPermit {
  const filled: Record<string, string> = {};
  const missing: string[] = [];

  for (const [fieldId, profileKey] of Object.entries(permit.fieldMapping)) {
    const value = (profile as any)[profileKey];
    if (typeof value === 'string' && value.trim().length > 0) {
      filled[fieldId] = value.trim();
    } else {
      missing.push(fieldId);
    }
  }

  // Build a ?param=value URL that some portals accept; not all do.
  const url = new URL(permit.portalUrl);
  for (const [k, v] of Object.entries(filled)) {
    url.searchParams.set(k, v);
  }

  return {
    permit,
    filledFields: filled,
    missingFields: missing,
    portalUrlWithParams: url.toString(),
  };
}

export function totalMinutesSaved(country: PermitCountry, perYear: Record<string, number>): number {
  let total = 0;
  for (const permit of getPermitsForCountry(country)) {
    const count = perYear[permit.id] ?? 0;
    total += count * permit.estimatedMinutesSaved;
  }
  return total;
}
