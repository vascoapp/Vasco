// =============================================================================
// CUSTOMER PORTFOLIO FILTER
// =============================================================================
// Pure helpers for filtering + sorting the klanten list. Keeps the UI layer
// declarative and testable.
// =============================================================================

import type { Customer, Job, Invoice } from '../types/contractor';
import { scoreAllCustomers, type CustomerProfile, type CustomerTag } from './customerTaggingService';

export type SortBy = 'ltv_desc' | 'ltv_asc' | 'name' | 'recent' | 'risk';
export type FilterTag = CustomerTag | 'all';

export interface EnrichedCustomer {
  customer: Customer;
  profile: CustomerProfile;
}

export function enrich(customers: Customer[], jobs: Job[], invoices: Invoice[]): EnrichedCustomer[] {
  const profiles = scoreAllCustomers(customers, jobs, invoices);
  return customers.map((c) => ({ customer: c, profile: profiles.get(c.id)! }));
}

export function filterByTag(rows: EnrichedCustomer[], tag: FilterTag): EnrichedCustomer[] {
  if (tag === 'all') return rows;
  return rows.filter((r) => r.profile.tag === tag);
}

export function searchByName(rows: EnrichedCustomer[], query: string): EnrichedCustomer[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => r.customer.name.toLowerCase().includes(q) || (r.customer.email ?? '').toLowerCase().includes(q));
}

export function sortBy(rows: EnrichedCustomer[], how: SortBy): EnrichedCustomer[] {
  const copy = [...rows];
  switch (how) {
    case 'ltv_desc': return copy.sort((a, b) => b.profile.lifetimeValue - a.profile.lifetimeValue);
    case 'ltv_asc':  return copy.sort((a, b) => a.profile.lifetimeValue - b.profile.lifetimeValue);
    case 'name':     return copy.sort((a, b) => a.customer.name.localeCompare(b.customer.name));
    case 'recent':   return copy.sort((a, b) => a.profile.lastActivityDays - b.profile.lastActivityDays);
    case 'risk':     return copy.sort((a, b) => {
      // Risky first, then inactive, then the rest by on-time ascending
      const rank: Record<CustomerTag, number> = { risky: 0, inactive: 1, new: 2, loyal: 3, vip: 4 };
      return rank[a.profile.tag] - rank[b.profile.tag] || a.profile.onTimeRate - b.profile.onTimeRate;
    });
  }
}

export interface TagCount { tag: FilterTag; count: number }

export function tagCounts(rows: EnrichedCustomer[]): TagCount[] {
  const all: FilterTag[] = ['all', 'vip', 'loyal', 'new', 'risky', 'inactive'];
  const counts = new Map<FilterTag, number>();
  counts.set('all', rows.length);
  for (const r of rows) counts.set(r.profile.tag, (counts.get(r.profile.tag) ?? 0) + 1);
  return all.map((tag) => ({ tag, count: counts.get(tag) ?? 0 }));
}
