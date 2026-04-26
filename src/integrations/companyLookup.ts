// =============================================================================
// COMPANY LOOKUP — KvK (NL) + Handelsregister (DE) (R245)
// =============================================================================
// B2B onboarding: contractor types a KvK / HRB number, app auto-fills the
// business name, address, and VAT registration. Cuts onboarding friction.
//
// NL: KvK Open Data API — public, no auth for the basic /naamgeving lookup.
//     For full data (visiting address, SBI codes), production needs a paid
//     KvK API key. The basic endpoint is enough for a name+address autofill.
//     Docs: https://developers.kvk.nl/
//
// DE: OffeneRegister.de — community-built scrape of Handelsregister, free.
//     Production should switch to the official Handelsregister.de API once
//     a Bundesanzeiger Verlag account is provisioned.
// =============================================================================

export interface CompanyLookupResult {
  found: boolean;
  registrationNumber: string;
  name?: string;
  legalForm?: string;
  address?: string;
  city?: string;
  postcode?: string;
  country: string;
  source: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// NL — KvK
// ---------------------------------------------------------------------------

const KVK_BASE = 'https://api.kvk.nl/api/v1';

export async function lookupKvk(
  kvkNumber: string,
  apiKey?: string,
): Promise<CompanyLookupResult> {
  const cleaned = kvkNumber.replace(/\D/g, '');
  if (cleaned.length !== 8) {
    return {
      found: false,
      registrationNumber: kvkNumber,
      country: 'NL',
      source: 'kvk',
      error: 'KvK number must be 8 digits',
    };
  }

  // Without an API key we can still hit the open public profile page on
  // kvk.nl — but that returns HTML and is fragile. Better to surface the
  // requirement clearly and let the caller decide.
  if (!apiKey) {
    return {
      found: false,
      registrationNumber: cleaned,
      country: 'NL',
      source: 'kvk',
      error: 'KvK API key not configured',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${KVK_BASE}/naamgeving/kvknummer/${cleaned}`, {
      headers: { apikey: apiKey, Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return {
        found: false,
        registrationNumber: cleaned,
        country: 'NL',
        source: 'kvk',
        error: `KvK ${res.status}`,
      };
    }
    const json = await res.json();
    return {
      found: true,
      registrationNumber: cleaned,
      name: json.naam ?? json.handelsnaam ?? undefined,
      legalForm: json.rechtsvorm ?? undefined,
      country: 'NL',
      source: 'kvk',
    };
  } catch (err) {
    clearTimeout(timeout);
    return {
      found: false,
      registrationNumber: cleaned,
      country: 'NL',
      source: 'kvk',
      error: String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// DE — Handelsregister via OffeneRegister.de
// ---------------------------------------------------------------------------

const OFFENEREGISTER_BASE = 'https://api.offeneregister.de/v0';

export async function lookupHandelsregister(hrbNumber: string): Promise<CompanyLookupResult> {
  const trimmed = hrbNumber.trim().toUpperCase();
  if (!trimmed) {
    return {
      found: false,
      registrationNumber: hrbNumber,
      country: 'DE',
      source: 'offeneregister',
      error: 'HRB number required',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(
      `${OFFENEREGISTER_BASE}/company/_search?q=${encodeURIComponent(trimmed)}`,
      {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);
    if (!res.ok) {
      return {
        found: false,
        registrationNumber: trimmed,
        country: 'DE',
        source: 'offeneregister',
        error: `OffeneRegister ${res.status}`,
      };
    }
    const json = await res.json();
    const hits = json?.hits?.hits ?? [];
    if (hits.length === 0) {
      return {
        found: false,
        registrationNumber: trimmed,
        country: 'DE',
        source: 'offeneregister',
      };
    }
    const top = hits[0]?._source ?? {};
    return {
      found: true,
      registrationNumber: trimmed,
      name: top.name ?? undefined,
      legalForm: top.legal_form ?? undefined,
      address: top.native_address ?? top.address ?? undefined,
      city: top.address_city ?? undefined,
      postcode: top.address_postal_code ?? undefined,
      country: 'DE',
      source: 'offeneregister',
    };
  } catch (err) {
    clearTimeout(timeout);
    return {
      found: false,
      registrationNumber: trimmed,
      country: 'DE',
      source: 'offeneregister',
      error: String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Unified entry — picks the right lookup by country
// ---------------------------------------------------------------------------

export async function lookupCompany(input: {
  country: string;
  registrationNumber: string;
  apiKey?: string;
}): Promise<CompanyLookupResult> {
  const country = input.country.toUpperCase();
  if (country === 'NL') return lookupKvk(input.registrationNumber, input.apiKey);
  if (country === 'DE') return lookupHandelsregister(input.registrationNumber);
  return {
    found: false,
    registrationNumber: input.registrationNumber,
    country,
    source: 'none',
    error: `Lookup not implemented for ${country}`,
  };
}
