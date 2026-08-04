// =============================================================================
// SITE ASSETS — the equipment a contractor keeps coming back to
// =============================================================================
// ServiceTitan sells serviced-asset history: the boiler at this address, its
// age, what has been done to it, when it is next due. It is genuinely useful on
// arrival — "what did we do here last time?" — and it is the thing a customer
// asks about when the unit finally fails.
//
// The reason most contractors never have it is capture. An empty asset register
// asks you to type in a serial number for every property you have ever visited,
// before it gives you anything back, so it stays empty and the feature dies.
//
// So this does not start empty. Repeated jobs at the SAME ADDRESS are already
// evidence that something there needs servicing, and the app has that history.
// `proposeAssets` turns it into candidates — "you have been to Prinsengracht 123
// three times, what is it you service there?" — and the contractor confirms or
// ignores. AI prepares, human decides: the EVE pattern this app is built on.
//
// A proposal is NOT an asset. Nothing is written until the contractor confirms
// one, because inventing "Boiler at Prinsengracht 123" from a job called
// "Lekkage reparatie" would be a guess presented as a record, and a wrong
// service record is worse than no service record.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppState } from '../state/AppState';

const ASSETS_KEY = '@vasco_site_assets';

/** Repeat visits to one address before it is worth asking what is there. */
export const MIN_VISITS_TO_PROPOSE = 2;

export type SiteAssetCategory =
  | 'heating'
  | 'water'
  | 'electrical'
  | 'ventilation'
  | 'roof'
  | 'exterior'
  | 'other';

export interface SiteAsset {
  id: string;
  customerId: string;
  /** Normalised address key — the thing that makes it the same site. */
  siteKey: string;
  /** Human-readable address as it was last seen on a job. */
  siteLabel: string;
  /** What it is: "CV-ketel Remeha Avanta", "Dakgoot voorzijde". */
  name: string;
  category: SiteAssetCategory;
  /** Free text: model, serial, position. Optional — most will carry none. */
  details?: string;
  /** ISO date. Optional: the contractor often did not install it. */
  installedAt?: string;
  /** Months between services, when the contractor sets one. */
  serviceIntervalMonths?: number;
  createdAt: string;
  updatedAt: string;
}

/** A site the history suggests is worth registering. Never persisted. */
export interface SiteAssetProposal {
  customerId: string;
  customerName: string;
  siteKey: string;
  siteLabel: string;
  visits: number;
  lastVisit: string;
  /** Job titles seen at this address — the contractor's own words, unedited. */
  recentWork: string[];
}

// ---------------------------------------------------------------------------
// Address identity
// ---------------------------------------------------------------------------

/**
 * Key that decides whether two jobs happened at the same place.
 *
 * Street plus postcode, lowercased and stripped of punctuation and spacing.
 * City is left out deliberately: it is the field most often abbreviated or
 * misspelled ("s-Hertogenbosch" / "Den Bosch"), and a postcode already pins the
 * locality. House number stays in the street line, which is what separates
 * number 12 from number 14 on the same street.
 */
export function siteKeyFor(address?: { street?: string; postcode?: string }): string | null {
  const street = (address?.street ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const postcode = (address?.postcode ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!street && !postcode) return null;
  // A postcode alone is not a site — Dutch postcodes cover a side of a street,
  // so it would merge neighbours into one asset.
  if (!street) return null;
  return `${street}|${postcode}`;
}

/**
 * Site key from a single free-text address line — the shape Customer.address
 * has. Same normalisation as siteKeyFor so a customer-level and a job-level
 * address for the same place do not produce two different sites.
 *
 * There is no postcode component to separate out of a free-text line, so the
 * whole string is the key. That makes it coarser than the structured version:
 * two properties for one customer collapse into one site unless the job itself
 * carries an address. Coarse and correct beats precise and wrong.
 */
export function siteKeyFromText(address?: string): string | null {
  const norm = (address ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return norm ? `${norm}|` : null;
}

// ---------------------------------------------------------------------------
// Proposals
// ---------------------------------------------------------------------------

export interface ProposalJob {
  customerId?: string | null;
  title: string;
  status: string;
  completedAt?: string;
  updatedAt?: string;
  /**
   * Where the work happened.
   *
   * Almost always absent in practice: `addJob(title)` is the only in-app
   * job-creation path and passes no address, so this is populated for
   * imported jobs and little else. `fallbackAddress` below is what makes the
   * feature work on the data that exists — checked before building on the
   * field, not after (learnings #109).
   */
  address?: { street?: string; postcode?: string; city?: string };
  /** The customer's own address, used when the job carries none. */
  fallbackAddress?: string;
}

const DONE = new Set(['completed', 'invoiced', 'paid']);

/**
 * Sites visited more than once that have no asset registered yet.
 *
 * Sorted by visit count: the place you have been five times is a better
 * question than the place you have been twice.
 */
export function proposeAssets(
  jobs: ProposalJob[],
  existing: SiteAsset[],
  customerName: (id: string) => string | undefined,
): SiteAssetProposal[] {
  const known = new Set(existing.map((a) => `${a.customerId}::${a.siteKey}`));
  const bySite = new Map<string, SiteAssetProposal>();

  for (const job of jobs) {
    if (!job.customerId) continue;
    if (!DONE.has(job.status)) continue;
    const siteKey = siteKeyFor(job.address) ?? siteKeyFromText(job.fallbackAddress);
    if (!siteKey) continue;
    if (known.has(`${job.customerId}::${siteKey}`)) continue;

    const name = customerName(job.customerId);
    // Without a name we cannot say who the question is about, and a raw id is
    // not an answer.
    if (!name) continue;

    const when = job.completedAt ?? job.updatedAt ?? '';
    const mapKey = `${job.customerId}::${siteKey}`;
    const entry = bySite.get(mapKey);
    if (entry) {
      entry.visits += 1;
      if (when > entry.lastVisit) entry.lastVisit = when;
      if (entry.recentWork.length < 3 && !entry.recentWork.includes(job.title)) {
        entry.recentWork.push(job.title);
      }
    } else {
      bySite.set(mapKey, {
        customerId: job.customerId,
        customerName: name,
        siteKey,
        siteLabel:
          [job.address?.street, job.address?.city].filter(Boolean).join(', ') ||
          (job.fallbackAddress ?? ''),
        visits: 1,
        lastVisit: when,
        recentWork: [job.title],
      });
    }
  }

  return [...bySite.values()]
    .filter((p) => p.visits >= MIN_VISITS_TO_PROPOSE)
    .sort((a, b) => b.visits - a.visits);
}

/** Work done at one site, newest first — the "what did we do here?" answer. */
export function historyForSite(jobs: ProposalJob[], customerId: string, siteKey: string): ProposalJob[] {
  return jobs
    .filter((j) => j.customerId === customerId && DONE.has(j.status)
      && (siteKeyFor(j.address) ?? siteKeyFromText(j.fallbackAddress)) === siteKey)
    .sort((a, b) => (b.completedAt ?? b.updatedAt ?? '').localeCompare(a.completedAt ?? a.updatedAt ?? ''));
}

/**
 * When the next service is due, or null when the contractor has not said how
 * often it should happen. Null rather than a default interval: a guessed
 * service schedule on someone else's boiler is a claim we cannot support.
 */
export function nextServiceDue(asset: SiteAsset, lastVisitIso: string | undefined): string | null {
  if (!asset.serviceIntervalMonths || !lastVisitIso) return null;
  const last = new Date(lastVisitIso);
  if (Number.isNaN(last.getTime())) return null;
  const due = new Date(last);
  due.setMonth(due.getMonth() + asset.serviceIntervalMonths);
  return due.toISOString();
}

export function newAsset(customerId: string, siteKey: string, siteLabel: string): SiteAsset {
  const now = new Date().toISOString();
  return {
    id: `sa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    customerId,
    siteKey,
    siteLabel,
    name: '',
    category: 'other',
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export async function loadAssets(): Promise<SiteAsset[]> {
  try {
    const raw = await AsyncStorage.getItem(ASSETS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveAssets(assets: SiteAsset[]): Promise<void> {
  await AsyncStorage.setItem(ASSETS_KEY, JSON.stringify(assets)).catch(() => {});
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useSiteAssets() {
  const [assets, setAssets] = useState<SiteAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAssets()
      .then(setAssets)
      .finally(() => setLoading(false));
  }, []);

  const refresh = useCallback(async () => setAssets(await loadAssets()), []);

  const upsert = useCallback(async (asset: SiteAsset) => {
    // Re-read rather than trusting this hook's snapshot: another screen may
    // have registered an asset since this one mounted.
    const all = await loadAssets();
    const now = new Date().toISOString();
    const exists = all.some((a) => a.id === asset.id);
    const next = exists
      ? all.map((a) => (a.id === asset.id ? { ...asset, createdAt: a.createdAt, updatedAt: now } : a))
      : [...all, { ...asset, createdAt: now, updatedAt: now }];
    setAssets(next);
    await saveAssets(next);
  }, []);

  const remove = useCallback(async (id: string) => {
    const all = await loadAssets();
    const next = all.filter((a) => a.id !== id);
    setAssets(next);
    await saveAssets(next);
  }, []);

  return { assets, loading, refresh, upsert, remove };
}

/** Assets and proposals for one customer. */
export function useCustomerSiteAssets(customerId: string) {
  const { jobs, customers } = useAppState();
  const { assets, loading, refresh, upsert, remove } = useSiteAssets();

  const mine = useMemo(() => assets.filter((a) => a.customerId === customerId), [assets, customerId]);

  const customerAddress = customers.find((c) => c.id === customerId)?.address;

  const withFallback = useMemo(
    () =>
      jobs
        .filter((j) => j.customerId === customerId)
        .map((j) => ({ ...(j as unknown as ProposalJob), fallbackAddress: customerAddress })),
    [jobs, customerId, customerAddress],
  );

  const proposals = useMemo(
    () => proposeAssets(withFallback, assets, (id) => customers.find((c) => c.id === id)?.name),
    [withFallback, assets, customers],
  );

  return { assets: mine, proposals, loading, refresh, upsert, remove };
}
