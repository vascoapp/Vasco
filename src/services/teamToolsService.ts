// =============================================================================
// TEAM TOOLS SERVICE — Contractor & Team features
// =============================================================================
// Worker scorecards, van stock/inventory, change orders, punch lists,
// and membership enrollment. Available only for contractor and team roles.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── 1. WORKER PERFORMANCE SCORECARDS ──────────────────────────────────────

export interface WorkerScorecard {
  workerId: string;
  workerName: string;
  period: string;                 // "2026-03" (month)
  jobsCompleted: number;
  totalRevenue: number;
  avgTicketSize: number;
  onTimeRate: number;             // % arrived within 15min of scheduled
  customerRating: number;         // avg 1-5
  reviewCount: number;
  hoursWorked: number;
  efficiency: number;             // revenue / hour
  membershipsEnrolled: number;
  callbackRate: number;           // % of jobs with callback within 30 days
}

export interface ScorecardComparison {
  workers: WorkerScorecard[];
  teamAvg: {
    avgTicket: number;
    onTimeRate: number;
    customerRating: number;
    efficiency: number;
  };
  topPerformer: string;
  improvementNeeded: string;
}

export function generateDemoScorecards(): WorkerScorecard[] {
  return [
    { workerId: 'w1', workerName: 'Jan van der Berg', period: '2026-03', jobsCompleted: 24, totalRevenue: 18400, avgTicketSize: 767, onTimeRate: 92, customerRating: 4.8, reviewCount: 12, hoursWorked: 168, efficiency: 109.5, membershipsEnrolled: 3, callbackRate: 4 },
    { workerId: 'w2', workerName: 'Bas de Groot', period: '2026-03', jobsCompleted: 18, totalRevenue: 12600, avgTicketSize: 700, onTimeRate: 85, customerRating: 4.5, reviewCount: 8, hoursWorked: 160, efficiency: 78.8, membershipsEnrolled: 1, callbackRate: 8 },
    { workerId: 'w3', workerName: 'Tom Bakker', period: '2026-03', jobsCompleted: 21, totalRevenue: 15200, avgTicketSize: 724, onTimeRate: 88, customerRating: 4.6, reviewCount: 10, hoursWorked: 172, efficiency: 88.4, membershipsEnrolled: 2, callbackRate: 5 },
  ];
}

export function compareScorecards(cards: WorkerScorecard[]): ScorecardComparison {
  const avg = {
    avgTicket: cards.reduce((s, c) => s + c.avgTicketSize, 0) / cards.length,
    onTimeRate: cards.reduce((s, c) => s + c.onTimeRate, 0) / cards.length,
    customerRating: cards.reduce((s, c) => s + c.customerRating, 0) / cards.length,
    efficiency: cards.reduce((s, c) => s + c.efficiency, 0) / cards.length,
  };
  const sorted = [...cards].sort((a, b) => b.efficiency - a.efficiency);
  return {
    workers: cards,
    teamAvg: avg,
    topPerformer: sorted[0]?.workerName || '',
    improvementNeeded: sorted[sorted.length - 1]?.workerName || '',
  };
}

// ─── 2. VAN STOCK / SIMPLE INVENTORY ───────────────────────────────────────

export interface VanStockItem {
  id: string;
  name: string;
  sku?: string;
  category: string;              // 'fittings', 'pipe', 'wire', 'tools', etc.
  quantity: number;
  minQuantity: number;           // Alert threshold
  unitPrice: number;
  supplierId?: string;
  lastRestocked: string;
}

export interface VanStock {
  workerId: string;
  workerName: string;
  items: VanStockItem[];
  lastAudit: string;
  totalValue: number;
}

const VAN_STOCK_KEY = '@vasco_van_stock';

export async function loadVanStock(workerId: string): Promise<VanStock> {
  try {
    const raw = await AsyncStorage.getItem(`${VAN_STOCK_KEY}_${workerId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { workerId, workerName: '', items: [], lastAudit: '', totalValue: 0 };
}

export async function saveVanStock(stock: VanStock): Promise<void> {
  stock.totalValue = stock.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  await AsyncStorage.setItem(`${VAN_STOCK_KEY}_${stock.workerId}`, JSON.stringify(stock));
}

export async function useFromStock(
  workerId: string,
  itemId: string,
  quantity: number,
  jobId?: string,
): Promise<{ success: boolean; remaining: number; lowStock: boolean }> {
  const stock = await loadVanStock(workerId);
  const item = stock.items.find((i) => i.id === itemId);
  if (!item || item.quantity < quantity) return { success: false, remaining: item?.quantity ?? 0, lowStock: true };

  item.quantity -= quantity;
  await saveVanStock(stock);
  return { success: true, remaining: item.quantity, lowStock: item.quantity <= item.minQuantity };
}

export function getLowStockItems(stock: VanStock): VanStockItem[] {
  return stock.items.filter((i) => i.quantity <= i.minQuantity);
}

// ─── 3. CHANGE ORDER WORKFLOW (Aannemer/Teams) ────────────────────────────

export type ChangeOrderStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'completed';

export interface ChangeOrder {
  id: string;
  jobId: string;
  jobTitle: string;
  title: string;
  description: string;
  reason: 'customer_request' | 'site_conditions' | 'design_change' | 'regulatory' | 'other';
  costImpact: number;            // EUR (positive = increase)
  scheduleImpact: number;        // days (positive = delay)
  status: ChangeOrderStatus;
  requestedBy: string;
  approvedBy?: string;
  createdAt: string;
  approvedAt?: string;
  attachments: string[];          // Photo/doc URIs
  signatureId?: string;           // Linked signature record
}

const CHANGE_ORDERS_KEY = '@vasco_change_orders';

export async function loadChangeOrders(jobId?: string): Promise<ChangeOrder[]> {
  try {
    const raw = await AsyncStorage.getItem(CHANGE_ORDERS_KEY);
    const orders: ChangeOrder[] = raw ? JSON.parse(raw) : [];
    return jobId ? orders.filter((o) => o.jobId === jobId) : orders;
  } catch {
    return [];
  }
}

export async function saveChangeOrder(order: ChangeOrder): Promise<void> {
  try {
    const orders = await loadChangeOrders();
    const idx = orders.findIndex((o) => o.id === order.id);
    if (idx >= 0) orders[idx] = order;
    else orders.unshift(order);
    await AsyncStorage.setItem(CHANGE_ORDERS_KEY, JSON.stringify(orders));
  } catch {}
}

export function createChangeOrder(
  jobId: string,
  jobTitle: string,
  title: string,
  description: string,
  reason: ChangeOrder['reason'],
  costImpact: number,
  scheduleImpact: number,
  requestedBy: string,
): ChangeOrder {
  return {
    id: `co_${Date.now()}`,
    jobId, jobTitle, title, description, reason,
    costImpact, scheduleImpact,
    status: 'draft',
    requestedBy,
    createdAt: new Date().toISOString(),
    attachments: [],
  };
}

// ─── 4. PUNCH LIST / SNAG LIST (Aannemer/Teams) ──────────────────────────

export type PunchItemStatus = 'open' | 'in_progress' | 'fixed' | 'verified';

export interface PunchItem {
  id: string;
  description: string;
  location: string;              // "Bedroom 2", "Kitchen", etc.
  photoUri?: string;
  assignedTo?: string;
  status: PunchItemStatus;
  priority: 'high' | 'medium' | 'low';
  createdAt: string;
  fixedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface PunchList {
  id: string;
  jobId: string;
  jobTitle: string;
  items: PunchItem[];
  createdAt: string;
  completedAt?: string;
  customerSignatureId?: string;
  status: 'active' | 'completed';
}

const PUNCH_LISTS_KEY = '@vasco_punch_lists';

export async function loadPunchList(jobId: string): Promise<PunchList | null> {
  try {
    const raw = await AsyncStorage.getItem(PUNCH_LISTS_KEY);
    const lists: PunchList[] = raw ? JSON.parse(raw) : [];
    return lists.find((l) => l.jobId === jobId) || null;
  } catch {
    return null;
  }
}

export async function savePunchList(list: PunchList): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PUNCH_LISTS_KEY);
    const lists: PunchList[] = raw ? JSON.parse(raw) : [];
    const idx = lists.findIndex((l) => l.id === list.id);
    if (idx >= 0) lists[idx] = list;
    else lists.unshift(list);
    await AsyncStorage.setItem(PUNCH_LISTS_KEY, JSON.stringify(lists));
  } catch {}
}

export function createPunchList(jobId: string, jobTitle: string): PunchList {
  return {
    id: `pl_${Date.now()}`,
    jobId, jobTitle,
    items: [],
    createdAt: new Date().toISOString(),
    status: 'active',
  };
}

export function addPunchItem(
  list: PunchList,
  description: string,
  location: string,
  priority: PunchItem['priority'] = 'medium',
  photoUri?: string,
  assignedTo?: string,
): PunchList {
  const item: PunchItem = {
    id: `pi_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    description, location, photoUri, assignedTo,
    status: 'open', priority,
    createdAt: new Date().toISOString(),
  };
  return { ...list, items: [...list.items, item] };
}

export function getPunchListProgress(list: PunchList): { total: number; fixed: number; verified: number; percentage: number } {
  const total = list.items.length;
  const fixed = list.items.filter((i) => i.status === 'fixed' || i.status === 'verified').length;
  const verified = list.items.filter((i) => i.status === 'verified').length;
  return { total, fixed, verified, percentage: total > 0 ? Math.round((verified / total) * 100) : 100 };
}

// ─── 5. MEMBERSHIP ON-SITE ENROLLMENT ──────────────────────────────────────

export interface MembershipPlan {
  id: string;
  name: string;
  description: string;
  pricePerYear: number;
  includes: string[];
  trade: string;
  visitFrequency: string;        // "annual", "biannual", "quarterly"
}

export interface MembershipEnrollment {
  id: string;
  customerId: string;
  customerName: string;
  planId: string;
  planName: string;
  startDate: string;
  renewalDate: string;
  pricePerYear: number;
  status: 'active' | 'pending_payment' | 'expired' | 'cancelled';
  enrolledByWorker: string;
  enrolledAtJob: string;
  signatureId?: string;
}

const MEMBERSHIPS_KEY = '@vasco_memberships';

export const DEFAULT_MEMBERSHIP_PLANS: MembershipPlan[] = [
  { id: 'boiler-annual', name: 'Annual Boiler Service', description: 'Annual boiler inspection, safety check, and cleaning', pricePerYear: 149, includes: ['Full boiler inspection', 'Safety check + CO test', 'Filter cleaning', 'Efficiency report', '10% off repairs'], trade: 'plumbing', visitFrequency: 'annual' },
  { id: 'electrical-check', name: 'Electrical Safety Check', description: 'Annual electrical installation inspection (EICR)', pricePerYear: 189, includes: ['Full installation test', 'EICR report', 'Socket + switch check', 'Consumer unit inspection', 'Priority booking'], trade: 'electrical', visitFrequency: 'annual' },
  { id: 'hvac-biannual', name: 'HVAC Maintenance Plan', description: 'Bi-annual HVAC maintenance: pre-summer and pre-winter', pricePerYear: 249, includes: ['2x annual visits', 'Filter replacement', 'Refrigerant check', 'Performance optimization', '15% off repairs'], trade: 'hvac', visitFrequency: 'biannual' },
  { id: 'general-maintenance', name: 'Home Maintenance Plan', description: 'Quarterly general maintenance visit', pricePerYear: 349, includes: ['4x annual visits', 'Plumbing check', 'Electrical check', 'Minor repairs included', 'Priority emergency response'], trade: 'general', visitFrequency: 'quarterly' },
];

export async function loadMemberships(): Promise<MembershipEnrollment[]> {
  try {
    const raw = await AsyncStorage.getItem(MEMBERSHIPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function enrollMembership(
  customerId: string,
  customerName: string,
  plan: MembershipPlan,
  enrolledByWorker: string,
  enrolledAtJob: string,
  signatureId?: string,
): Promise<MembershipEnrollment> {
  const enrollment: MembershipEnrollment = {
    id: `mem_${Date.now()}`,
    customerId, customerName,
    planId: plan.id, planName: plan.name,
    startDate: new Date().toISOString(),
    renewalDate: new Date(Date.now() + 365 * 86400000).toISOString(),
    pricePerYear: plan.pricePerYear,
    status: 'pending_payment',
    enrolledByWorker, enrolledAtJob, signatureId,
  };

  const memberships = await loadMemberships();
  memberships.unshift(enrollment);
  await AsyncStorage.setItem(MEMBERSHIPS_KEY, JSON.stringify(memberships));
  return enrollment;
}

export async function getMembershipStats(): Promise<{
  totalActive: number;
  totalRevenue: number;
  avgPlanValue: number;
  byTrade: Record<string, number>;
  renewalsDue30: number;
}> {
  const memberships = await loadMemberships();
  const active = memberships.filter((m) => m.status === 'active');
  const totalRevenue = active.reduce((s, m) => s + m.pricePerYear, 0);
  const byTrade: Record<string, number> = {};

  const plans = DEFAULT_MEMBERSHIP_PLANS;
  for (const m of active) {
    const plan = plans.find((p) => p.id === m.planId);
    if (plan) byTrade[plan.trade] = (byTrade[plan.trade] || 0) + 1;
  }

  const in30Days = new Date(Date.now() + 30 * 86400000).toISOString();
  const renewalsDue = active.filter((m) => m.renewalDate <= in30Days).length;

  return {
    totalActive: active.length,
    totalRevenue,
    avgPlanValue: active.length > 0 ? Math.round(totalRevenue / active.length) : 0,
    byTrade,
    renewalsDue30: renewalsDue,
  };
}
