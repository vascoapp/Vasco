// =============================================================================
// LEAD MARKETPLACES — Werkspot (NL) + MyHammer (DE) + Houzz Pro (R245)
// =============================================================================
// Single biggest acquisition channel for solo contractors. Each platform
// pushes leads (job requests from homeowners) and accepts contractor quotes
// back. Production needs a partner-tier API agreement — for now this file
// scaffolds the unified contract so the rest of the app can consume it
// once any of the three are wired live.
//
// Werkspot:    https://api.werkspot.nl (private partner API)
// MyHammer:    https://api.my-hammer.de (private partner API)
// Houzz Pro:   https://www.houzz.com/api (private partner API)
//
// All three follow the same shape: list pending leads → place quote →
// receive booking confirmations webhook-style.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

export type LeadProvider = 'werkspot' | 'myhammer' | 'houzz';

export interface LeadProviderConfig {
  provider: LeadProvider;
  apiKey: string;
  partnerId?: string;
  webhookSecret?: string;
  connectedAt: string;
}

export interface MarketplaceLead {
  id: string;
  provider: LeadProvider;
  postedAt: string;
  trade: string;                  // mapped to Vasco's 15-trade enum
  description: string;
  customerName?: string;          // platform usually masks until contact
  postcode?: string;
  city?: string;
  budgetEur?: number;
  desiredStartDate?: string;
  competingQuotesCount?: number;
}

export interface LeadQuoteSubmission {
  leadId: string;
  provider: LeadProvider;
  amount: number;
  message: string;
  validUntil: string;
}

const STORAGE_KEY = '@vasco_lead_provider_configs';

async function getConfigs(): Promise<Record<LeadProvider, LeadProviderConfig | null>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { werkspot: null, myhammer: null, houzz: null };
}

export async function saveLeadProviderConfig(config: LeadProviderConfig): Promise<void> {
  const all = await getConfigs();
  all[config.provider] = config;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export async function clearLeadProviderConfig(provider: LeadProvider): Promise<void> {
  const all = await getConfigs();
  all[provider] = null;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export async function isLeadProviderConnected(provider: LeadProvider): Promise<boolean> {
  const all = await getConfigs();
  return !!all[provider]?.apiKey;
}

// ---------------------------------------------------------------------------
// Lead fetch — unified across providers
// ---------------------------------------------------------------------------
// Each provider's response shape is normalized into MarketplaceLead.

export async function fetchPendingLeads(provider?: LeadProvider): Promise<MarketplaceLead[]> {
  const all = await getConfigs();
  const providers: LeadProvider[] = provider ? [provider] : ['werkspot', 'myhammer', 'houzz'];
  const out: MarketplaceLead[] = [];

  for (const p of providers) {
    const cfg = all[p];
    if (!cfg) continue;
    try {
      const leads = await fetchProviderLeads(cfg);
      out.push(...leads);
    } catch {
      // Skip on error; other providers continue.
    }
  }
  return out;
}

async function fetchProviderLeads(cfg: LeadProviderConfig): Promise<MarketplaceLead[]> {
  // Production endpoints differ per provider. The shape below is the contract
  // that each provider's adapter must return — actual API URLs are gated
  // behind partner agreements.
  switch (cfg.provider) {
    case 'werkspot':
      // POST https://api.werkspot.nl/v1/leads — partner-only
      return [];
    case 'myhammer':
      // GET https://api.my-hammer.de/partner/v1/leads — partner-only
      return [];
    case 'houzz':
      // GET https://www.houzz.com/api/leads — partner-only
      return [];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Quote submission — push contractor's response back to the marketplace
// ---------------------------------------------------------------------------

export async function submitQuote(submission: LeadQuoteSubmission): Promise<{ success: boolean; externalQuoteId?: string; error?: string }> {
  const all = await getConfigs();
  const cfg = all[submission.provider];
  if (!cfg) return { success: false, error: `${submission.provider} not connected` };

  // Provider-specific submission. Each adapter implementation is gated until
  // the partner API agreement is in place + credentials provisioned.
  switch (submission.provider) {
    case 'werkspot':
    case 'myhammer':
    case 'houzz':
      return {
        success: false,
        error: `${submission.provider} quote submission not yet implemented — awaits partner API access`,
      };
    default:
      return { success: false, error: 'Unknown provider' };
  }
}

// ---------------------------------------------------------------------------
// Webhook signature verification — for inbound lead/booking events
// ---------------------------------------------------------------------------

export async function verifyWebhookSignature(
  provider: LeadProvider,
  rawBody: string,
  signatureHeader: string,
): Promise<boolean> {
  const all = await getConfigs();
  const cfg = all[provider];
  if (!cfg?.webhookSecret) return false;
  // HMAC-SHA256 verification — same pattern as the Stripe webhook.
  // Implementation deferred until per-provider header format confirmed.
  void rawBody;
  void signatureHeader;
  return false;
}
