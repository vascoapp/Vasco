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
// NL UBO register — Ultimate Beneficial Owner lookup (R250)
// ---------------------------------------------------------------------------
// Required for B2B onboarding under Wwft (anti-money-laundering act).
// The KvK UBO register is gated — full data needs a paid KvK API key with
// the UBO add-on. We expose a clean shape so the call site can decide
// whether to surface "verified", "unverified", or "lookup-required".

export interface UboRecord {
  fullName: string;
  natureOfControl: 'shareholding' | 'voting_rights' | 'other';
  percentage?: number;       // beneficial-ownership percentage when known
  pep: boolean;              // politically exposed person flag
  registeredAt?: string;     // ISO date when listed in UBO register
}

export interface UboLookupResult {
  found: boolean;
  kvkNumber: string;
  ubos: UboRecord[];
  source: 'kvk_ubo_api' | 'unavailable';
  error?: string;
  // Wwft due-diligence flags so the contractor can document compliance
  highRisk: boolean;
  jurisdiction: 'NL';
}

const KVK_UBO_BASE = 'https://api.kvk.nl/api/v1/uboregister';

export async function lookupNlUbo(kvkNumber: string, apiKey?: string): Promise<UboLookupResult> {
  const cleaned = kvkNumber.replace(/\D/g, '');
  if (cleaned.length !== 8) {
    return {
      found: false, kvkNumber: kvkNumber, ubos: [], source: 'unavailable',
      highRisk: false, jurisdiction: 'NL',
      error: 'KvK number must be 8 digits',
    };
  }
  if (!apiKey) {
    return {
      found: false, kvkNumber: cleaned, ubos: [], source: 'unavailable',
      highRisk: false, jurisdiction: 'NL',
      error: 'KvK UBO API key not configured',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(`${KVK_UBO_BASE}/${cleaned}`, {
      headers: { apikey: apiKey, Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return {
        found: false, kvkNumber: cleaned, ubos: [], source: 'kvk_ubo_api',
        highRisk: false, jurisdiction: 'NL', error: `KvK UBO ${res.status}`,
      };
    }
    const json = await res.json();
    const rawUbos = (json?.ubos ?? json?.results ?? []) as any[];
    const ubos: UboRecord[] = rawUbos.map((u) => ({
      fullName: String(u.fullName ?? u.naam ?? '(unknown)'),
      natureOfControl: (u.aardZeggenschap ?? u.nature ?? 'other') as UboRecord['natureOfControl'],
      percentage: typeof u.percentage === 'number' ? u.percentage : undefined,
      pep: Boolean(u.pep ?? u.politicallyExposed),
      registeredAt: u.registeredAt ?? undefined,
    }));
    const highRisk = ubos.some((u) => u.pep) || ubos.length === 0;
    return {
      found: ubos.length > 0,
      kvkNumber: cleaned, ubos,
      source: 'kvk_ubo_api',
      highRisk, jurisdiction: 'NL',
    };
  } catch (err) {
    clearTimeout(timeout);
    return {
      found: false, kvkNumber: cleaned, ubos: [], source: 'unavailable',
      highRisk: false, jurisdiction: 'NL', error: String(err),
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
