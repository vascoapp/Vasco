// =============================================================================
// PURCHASE ORDER SERVICE
// =============================================================================
// PO creation, numbering, status tracking, and supplier integration
// =============================================================================

import { DEMO_MODE } from '../config/demo';
import { useState, useEffect, useCallback } from 'react';
import { trackUserAction } from '../intelligence/intelligenceEngine';
import { MS_PER_DAY } from '../utils/timeConstants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerSingletonReset } from './singletonReset';
import { getCurrentCountry } from '../lib/currentUser';
import { getStandardVatRate, type BusinessProfile } from '../domain/business';

// =============================================================================
// TYPES
// =============================================================================

export type POStatus = 'draft' | 'submitted' | 'confirmed' | 'shipped' | 'delivered' | 'invoiced' | 'cancelled';

export interface PurchaseOrderItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  materialId?: string;
  jobId?: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  status: POStatus;
  items: PurchaseOrderItem[];
  subtotal: number;
  vatAmount: number;
  total: number;
  vatRate: number;
  jobId?: string;
  jobTitle?: string;
  notes?: string;
  expectedDelivery?: Date;
  actualDelivery?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface POStats {
  totalOrders: number;
  pendingOrders: number;
  pendingValue: number;
  deliveredThisMonth: number;
  totalSpentThisMonth: number;
}

// =============================================================================
// MOCK DATA
// =============================================================================

const now = new Date();

// Demo-only fixtures. A real install must not show purchase orders to
// suppliers the contractor never ordered from.
const DEMO_ORDERS: PurchaseOrder[] = [
  {
    id: 'po-1',
    poNumber: 'PO-2026-0042',
    supplierId: 'sup-1',
    supplierName: 'Technische Unie',
    status: 'confirmed',
    items: [
      { id: 'poi-1', description: 'Koperen buis 22mm (3m)', quantity: 10, unit: 'stuk', unitPrice: 12.50, total: 125.00 },
      { id: 'poi-2', description: 'Soldeerfittingen set', quantity: 2, unit: 'set', unitPrice: 35.00, total: 70.00 },
    ],
    subtotal: 195.00,
    vatRate: 21,
    vatAmount: 40.95,
    total: 235.95,
    jobId: 'j-1',
    jobTitle: 'CV-ketel onderhoud — Fam. de Groot',
    expectedDelivery: new Date(now.getTime() + 2 * MS_PER_DAY),
    createdAt: new Date(now.getTime() - 3 * MS_PER_DAY),
    updatedAt: new Date(now.getTime() - 1 * MS_PER_DAY),
  },
  {
    id: 'po-2',
    poNumber: 'PO-2026-0041',
    supplierId: 'sup-2',
    supplierName: 'Breman Installatiegroep',
    status: 'delivered',
    items: [
      { id: 'poi-3', description: 'Warmtepomp binnenunit', quantity: 1, unit: 'stuk', unitPrice: 2450.00, total: 2450.00 },
      { id: 'poi-4', description: 'Installatiekit warmtepomp', quantity: 1, unit: 'set', unitPrice: 185.00, total: 185.00 },
    ],
    subtotal: 2635.00,
    vatRate: 21,
    vatAmount: 553.35,
    total: 3188.35,
    jobId: 'j-2',
    jobTitle: 'Warmtepomp installatie — Bakkerij Jansen',
    expectedDelivery: new Date(now.getTime() - 2 * MS_PER_DAY),
    actualDelivery: new Date(now.getTime() - 1 * MS_PER_DAY),
    createdAt: new Date(now.getTime() - 10 * MS_PER_DAY),
    updatedAt: new Date(now.getTime() - 1 * MS_PER_DAY),
  },
  {
    id: 'po-3',
    poNumber: 'PO-2026-0040',
    supplierId: 'sup-1',
    supplierName: 'Technische Unie',
    status: 'draft',
    items: [
      { id: 'poi-5', description: 'Airco split-unit 3.5kW', quantity: 3, unit: 'stuk', unitPrice: 680.00, total: 2040.00 },
    ],
    subtotal: 2040.00,
    vatRate: 21,
    vatAmount: 428.40,
    total: 2468.40,
    notes: 'Levertijd controleren bij leverancier',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockOrders: PurchaseOrder[] = DEMO_MODE ? DEMO_ORDERS : [];

// =============================================================================
// SERVICE
// =============================================================================

type POListener = () => void;

/**
 * Where the contractor's purchase orders live between launches.
 *
 * There was nowhere: this service had no AsyncStorage and no Supabase at all
 * (sweep 2026-09-18), so every PO — and every status the contractor set on it —
 * died with the process, while the screen said "Bestelling verstuurd naar
 * {supplier}". Device-local for now; a PO is not yet a backend entity, and
 * inventing a table for it is a Schema Lock decision, not a bug fix.
 */
const PO_STORAGE_KEY = '@vasco_purchase_orders_v1';

class PurchaseOrderService {
  private static instance: PurchaseOrderService;
  private listeners: Set<POListener> = new Set();
  private orders: PurchaseOrder[] = [...mockOrders];
  private counter = 42;
  private hydrated = false;

  static getInstance(): PurchaseOrderService {
    if (!PurchaseOrderService.instance) {
      PurchaseOrderService.instance = new PurchaseOrderService();
      registerSingletonReset(() => {
        const inst = PurchaseOrderService.instance;
        inst.orders = [...mockOrders];
        inst.counter = 42;
        inst.hydrated = false;
        // The stored copy belongs to the account that just left (#344).
        void AsyncStorage.removeItem(PO_STORAGE_KEY).catch(() => {});
        inst.listeners.forEach((l) => l());
      });
    }
    return PurchaseOrderService.instance;
  }

  subscribe(listener: POListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(l => l());
    void this.persist();
  }

  /** Dates survive JSON as strings; revive them or every `.toLocaleDateString` throws. */
  private async hydrate(): Promise<void> {
    if (this.hydrated) return;
    this.hydrated = true;
    try {
      const raw = await AsyncStorage.getItem(PO_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { orders?: unknown; counter?: number };
      if (Array.isArray(parsed.orders)) {
        this.orders = (parsed.orders as PurchaseOrder[]).map((o) => ({
          ...o,
          createdAt: new Date(o.createdAt),
          updatedAt: new Date(o.updatedAt),
          expectedDelivery: o.expectedDelivery ? new Date(o.expectedDelivery) : o.expectedDelivery,
          actualDelivery: o.actualDelivery ? new Date(o.actualDelivery) : o.actualDelivery,
        }));
        if (typeof parsed.counter === 'number') this.counter = parsed.counter;
        this.listeners.forEach(l => l());
      }
    } catch {
      // Unreadable store: keep what is in memory rather than losing the session.
    }
  }

  private async persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(PO_STORAGE_KEY, JSON.stringify({ orders: this.orders, counter: this.counter }));
    } catch {
      // Non-fatal: the order is still on screen for this session.
    }
  }

  /** Called by the hook on mount — the orders are read before they are shown. */
  load(): Promise<void> { return this.hydrate(); }

  getOrders(status?: POStatus): PurchaseOrder[] {
    if (status) return this.orders.filter(o => o.status === status);
    return this.orders;
  }

  getOrder(id: string): PurchaseOrder | undefined {
    return this.orders.find(o => o.id === id);
  }

  createOrder(
    supplierId: string,
    supplierName: string,
    items: Omit<PurchaseOrderItem, 'id' | 'total'>[],
    jobId?: string,
    jobTitle?: string,
    notes?: string,
  ): PurchaseOrder {
    this.counter++;
    const lineItems: PurchaseOrderItem[] = items.map((item, idx) => ({
      ...item,
      id: `poi-${Date.now()}-${idx}`,
      total: item.quantity * item.unitPrice,
    }));
    const subtotal = lineItems.reduce((sum, li) => sum + li.total, 0);
    // R66r51: country-aware VAT (was NL 21% hardcoded).
    const vatRate = getStandardVatRate((getCurrentCountry() as BusinessProfile['country']) ?? 'NL');
    const vatAmount = Math.round(subtotal * vatRate / 100 * 100) / 100;

    const order: PurchaseOrder = {
      id: `po-${Date.now()}`,
      poNumber: `PO-${new Date().getFullYear()}-${String(this.counter).padStart(4, '0')}`,
      supplierId,
      supplierName,
      status: 'draft',
      items: lineItems,
      subtotal,
      vatRate,
      vatAmount,
      total: Math.round((subtotal + vatAmount) * 100) / 100,
      jobId,
      jobTitle,
      notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.orders.unshift(order);
    trackUserAction('material_purchased', { poNumber: order.poNumber, total: order.total });
    this.notify();
    return order;
  }

  updateStatus(id: string, status: POStatus): void {
    const order = this.orders.find(o => o.id === id);
    if (order) {
      order.status = status;
      order.updatedAt = new Date();
      if (status === 'delivered') {
        order.actualDelivery = new Date();
      }
      trackUserAction('material_purchased', { poNumber: order.poNumber, status });
      this.notify();
    }
  }

  submitOrder(id: string): void {
    this.updateStatus(id, 'submitted');
  }

  getStats(): POStats {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const pending = this.orders.filter(o => ['draft', 'submitted', 'confirmed', 'shipped'].includes(o.status));
    const deliveredThisMonth = this.orders.filter(o =>
      o.status === 'delivered' && o.actualDelivery && o.actualDelivery >= monthStart
    );

    return {
      totalOrders: this.orders.length,
      pendingOrders: pending.length,
      pendingValue: pending.reduce((sum, o) => sum + o.total, 0),
      deliveredThisMonth: deliveredThisMonth.length,
      totalSpentThisMonth: deliveredThisMonth.reduce((sum, o) => sum + o.total, 0),
    };
  }
}

export const purchaseOrderService = PurchaseOrderService.getInstance();

// =============================================================================
// HOOKS
// =============================================================================

export function usePurchaseOrders(status?: POStatus) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const unsub = purchaseOrderService.subscribe(() => setOrders(purchaseOrderService.getOrders(status)));
    // Read what was stored before showing anything: the orders used to live in
    // memory only, so a restart emptied the screen.
    void purchaseOrderService.load().then(() => {
      if (!alive) return;
      setOrders(purchaseOrderService.getOrders(status));
      setLoading(false);
    });
    return () => { alive = false; unsub(); };
  }, [status]);

  const create = useCallback(
    (supplierId: string, supplierName: string, items: Omit<PurchaseOrderItem, 'id' | 'total'>[], jobId?: string, jobTitle?: string, notes?: string) =>
      purchaseOrderService.createOrder(supplierId, supplierName, items, jobId, jobTitle, notes),
    [],
  );
  const submit = useCallback((id: string) => purchaseOrderService.submitOrder(id), []);
  const updateStatus = useCallback((id: string, s: POStatus) => purchaseOrderService.updateStatus(id, s), []);

  return { orders, loading, create, submit, updateStatus };
}

export function usePOStats() {
  const [stats, setStats] = useState<POStats>(purchaseOrderService.getStats());
  useEffect(() => purchaseOrderService.subscribe(() => setStats(purchaseOrderService.getStats())), []);
  return stats;
}
