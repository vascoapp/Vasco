// =============================================================================
// EXPENSE SERVICE
// =============================================================================
// Categorized expense tracking with tax deduction support
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { emitBusinessEvent } from '../intelligence/dataCollector';
import { recordMetricSnapshot } from '../intelligence/learningStorage';
import { getCurrentUserId, getCurrentTrade, getCurrentCountry } from '../lib/currentUser';
import { registerSingletonReset } from './singletonReset';
import { MS_PER_DAY } from '../utils/timeConstants';
import { isSupabaseConfigured } from '../lib/supabase';
import { logWarn } from '../utils/errorHandler';
import type { ExpenseRow } from '../lib/database.types';

// R44: persistence — expenses are an in-memory singleton + now AsyncStorage
// for cross-restart durability. Without this every contractor lost all
// receipt-scanned + manually-entered expenses on app restart, breaking VAT
// prep + cashflow + supplier-negotiation derivations.
const EXPENSES_STORAGE_KEY = '@vasco_expenses';

async function persistExpenses(expenses: Expense[]): Promise<void> {
  try {
    // Date objects need serialization
    const serialized = expenses.map((e) => ({
      ...e,
      date: e.date instanceof Date ? e.date.toISOString() : e.date,
    }));
    await AsyncStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(serialized));
  } catch {
    // Silent — never block UI
  }
}

// R66 round 14: BE persistence helpers. Expenses are tax records (NL
// Belastingdienst Art. 52 AWR / DE GoBD §147 HGB) and AsyncStorage-only is
// not durable enough — uninstall, OS migration, device swap = full data
// loss. BE is now source of truth; AsyncStorage stays as offline cache.
function expenseToRowPayload(expense: Expense): Omit<ExpenseRow, 'id' | 'user_id' | 'created_at' | 'updated_at'> & { id?: string } {
  return {
    id: expense.id,
    description: expense.description,
    category: expense.category,
    amount: expense.amount,
    vat_amount: expense.vatAmount,
    vat_rate: expense.vatRate,
    expense_date: expense.date instanceof Date ? expense.date.toISOString() : expense.date,
    supplier: expense.supplier ?? null,
    receipt_url: expense.receiptUrl ?? null,
    job_id: expense.jobId ?? null,
    job_title: expense.jobTitle ?? null,
    deductible: expense.deductible,
    deduction_percentage: expense.deductionPercentage,
    notes: expense.notes ?? null,
  };
}

function expenseRowToExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    description: row.description,
    category: row.category as ExpenseCategory,
    amount: Number(row.amount),
    vatAmount: Number(row.vat_amount),
    vatRate: Number(row.vat_rate),
    date: new Date(row.expense_date),
    supplier: row.supplier ?? undefined,
    receiptUrl: row.receipt_url ?? undefined,
    jobId: row.job_id ?? undefined,
    jobTitle: row.job_title ?? undefined,
    deductible: row.deductible,
    deductionPercentage: Number(row.deduction_percentage),
    notes: row.notes ?? undefined,
  };
}

async function loadPersistedExpenses(): Promise<Expense[]> {
  try {
    const raw = await AsyncStorage.getItem(EXPENSES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((e: any) => ({ ...e, date: new Date(e.date) }));
  } catch {
    return [];
  }
}

// =============================================================================
// TYPES
// =============================================================================

export type ExpenseCategory = 'materiaal' | 'voertuig' | 'gereedschap' | 'kantoor' | 'verzekering' | 'opleiding' | 'reis' | 'overig';

export interface Expense {
  id: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  vatAmount: number;
  vatRate: number;
  date: Date;
  supplier?: string;
  receiptUrl?: string;
  jobId?: string;
  jobTitle?: string;
  deductible: boolean;
  deductionPercentage: number; // 0-100
  notes?: string;
}

export interface ExpenseStats {
  totalThisMonth: number;
  totalThisYear: number;
  deductibleThisYear: number;
  vatReclaimable: number;
  byCategory: { category: ExpenseCategory; amount: number; count: number }[];
}

export const EXPENSE_CATEGORIES: { id: ExpenseCategory; label: string; icon: string; deductionDefault: number }[] = [
  { id: 'materiaal', label: 'Materiaal', icon: 'cube-outline', deductionDefault: 100 },
  { id: 'voertuig', label: 'Voertuig', icon: 'car-outline', deductionDefault: 75 },
  { id: 'gereedschap', label: 'Gereedschap', icon: 'construct-outline', deductionDefault: 100 },
  { id: 'kantoor', label: 'Kantoor', icon: 'desktop-outline', deductionDefault: 100 },
  { id: 'verzekering', label: 'Verzekering', icon: 'shield-outline', deductionDefault: 100 },
  { id: 'opleiding', label: 'Opleiding', icon: 'school-outline', deductionDefault: 100 },
  { id: 'reis', label: 'Reiskosten', icon: 'train-outline', deductionDefault: 100 },
  { id: 'overig', label: 'Overig', icon: 'ellipsis-horizontal-outline', deductionDefault: 50 },
];

// =============================================================================
// MOCK DATA
// =============================================================================

const now = new Date();
const dayMs = MS_PER_DAY;

const mockExpenses: Expense[] = [
  { id: 'exp-1', description: 'Koperen buis 22mm', category: 'materiaal', amount: 125, vatAmount: 26.25, vatRate: 21, date: new Date(now.getTime() - dayMs), supplier: 'Technische Unie', jobId: 'j-1', jobTitle: 'CV-ketel onderhoud', deductible: true, deductionPercentage: 100 },
  { id: 'exp-2', description: 'Diesel tankbeurt', category: 'voertuig', amount: 95, vatAmount: 19.95, vatRate: 21, date: new Date(now.getTime() - 2 * dayMs), deductible: true, deductionPercentage: 75 },
  { id: 'exp-3', description: 'Accuboormachine Makita', category: 'gereedschap', amount: 289, vatAmount: 60.69, vatRate: 21, date: new Date(now.getTime() - 5 * dayMs), supplier: 'Toolstation', deductible: true, deductionPercentage: 100 },
  { id: 'exp-4', description: 'VCA Herhalingsexamen', category: 'opleiding', amount: 175, vatAmount: 0, vatRate: 0, date: new Date(now.getTime() - 10 * dayMs), supplier: 'SSVV', deductible: true, deductionPercentage: 100 },
  { id: 'exp-5', description: 'Bedrijfsverzekering Q1', category: 'verzekering', amount: 540, vatAmount: 0, vatRate: 0, date: new Date(now.getTime() - 15 * dayMs), supplier: 'Interpolis', deductible: true, deductionPercentage: 100 },
  { id: 'exp-6', description: 'Warmtepomp onderdelen', category: 'materiaal', amount: 350, vatAmount: 73.50, vatRate: 21, date: new Date(now.getTime() - 3 * dayMs), supplier: 'Breman', jobId: 'j-2', jobTitle: 'Warmtepomp installatie', deductible: true, deductionPercentage: 100 },
  { id: 'exp-7', description: 'Parkeerkosten klant', category: 'reis', amount: 12, vatAmount: 0, vatRate: 0, date: new Date(now.getTime() - dayMs), deductible: true, deductionPercentage: 100 },
];

// =============================================================================
// SERVICE
// =============================================================================

type ExpenseListener = () => void;

class ExpenseService {
  private static instance: ExpenseService;
  private listeners: Set<ExpenseListener> = new Set();
  // R26: was seeded with 7 fake expenses (`Koperen buis 22mm` /
  // `Accuboormachine Makita` / `VCA Herhalingsexamen` / etc.) — every
  // contractor's vat-prep BTW return + cashflow card showed those phantom
  // costs as their own. Now starts empty; real expenses flow in via
  // addExpense (used by the receipt scanner pipeline + manual entry).
  // The mockExpenses export below is kept for tests via __seedMockData.
  private expenses: Expense[] = [];
  // R44: AsyncStorage hydration — expenses now survive app restart. Without
  // this every contractor lost all receipt-scanned + manually-entered
  // expenses on cold-start.
  private hydrated = false;

  static getInstance(): ExpenseService {
    if (!ExpenseService.instance) {
      ExpenseService.instance = new ExpenseService();
      ExpenseService.instance.hydrate();
      // R47/R48: clear in-memory expenses on logout + re-hydrate on user
      // change. Singleton survives across sessions, so without this user A's
      // expenses would leak into user B's view on the same device until B
      // writes. Routed through registerSingletonReset for centralized wiring.
      registerSingletonReset((userId) => {
        ExpenseService.instance.expenses = [];
        ExpenseService.instance.hydrated = false;
        ExpenseService.instance.notify();
        if (userId) ExpenseService.instance.hydrate();
      });
    }
    return ExpenseService.instance;
  }

  private async hydrate(): Promise<void> {
    if (this.hydrated) return;
    // R66 round 14: BE is the source of truth (tax-record retention). Try
    // BE first; on failure or unconfigured Supabase, fall back to the
    // AsyncStorage cache so offline cold starts still see expenses.
    if (isSupabaseConfigured) {
      try {
        const { listExpenses } = await import('../lib/dataProvider');
        const rows = await listExpenses();
        this.expenses = rows.map(expenseRowToExpense);
        this.hydrated = true;
        this.notify();
        // Refresh AsyncStorage cache from authoritative BE state.
        persistExpenses(this.expenses).catch(() => {});
        return;
      } catch (err) {
        logWarn('expenseService', `BE hydrate failed, falling back to AsyncStorage: ${err}`);
      }
    }
    const persisted = await loadPersistedExpenses();
    if (persisted.length > 0) {
      this.expenses = persisted;
      this.notify();
    }
    this.hydrated = true;
  }

  /** @internal Test-only mock seeder. */
  __seedMockData(): void {
    this.expenses = [...mockExpenses];
    this.notify();
  }

  subscribe(listener: ExpenseListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void { this.listeners.forEach(l => l()); }

  getExpenses(category?: ExpenseCategory): Expense[] {
    const list = category ? this.expenses.filter(e => e.category === category) : this.expenses;
    return list.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  addExpense(expense: Omit<Expense, 'id'>): Expense {
    // R52 contract: optimistic temp id → swap to BE uuid on persist success;
    // queue payload on persist fail. Post-create housekeeping runs on the
    // FINAL id regardless of branch.
    const tempId = `exp-${Date.now()}`;
    const newExp: Expense = { ...expense, id: tempId };
    this.expenses.unshift(newExp);
    this.notify();
    persistExpenses(this.expenses).catch(() => {});
    // R66 round 14: BE persist with offline-queue fallback. Expenses are
    // tax records — must reach BE for 7-year retention compliance.
    if (isSupabaseConfigured) {
      (async () => {
        try {
          const { createExpense } = await import('../lib/dataProvider');
          const row = await createExpense(expenseToRowPayload(newExp));
          // Swap temp id for BE-assigned uuid.
          this.expenses = this.expenses.map((e) => (e.id === tempId ? { ...e, id: row.id } : e));
          this.notify();
          persistExpenses(this.expenses).catch(() => {});
        } catch (err) {
          logWarn('expenseService', `addExpense persist failed, queueing: ${err}`);
          try {
            const { queueWrite } = await import('./offlineWriteQueue');
            await queueWrite({
              table: 'expenses',
              op: 'insert',
              payload: { id: tempId, ...expenseToRowPayload(newExp) },
            });
          } catch {}
        }
      })();
    }
    // AI data collector — expense event (fires under tempId; the moat keys
    // by event id, not expense id, so a later id swap doesn't desync it).
    emitBusinessEvent(getCurrentUserId(), {
      eventType: 'expense_added',
      entityType: 'material',
      entityId: newExp.id,
      payload: { amount: newExp.amount, category: newExp.category, supplier: newExp.supplier, jobId: newExp.jobId, vatRate: newExp.vatRate },
      trade: getCurrentTrade() || 'general',
      country: getCurrentCountry() || 'NL',
    }).catch(() => {});
    // Track total expenses for calibration
    const yearTotal = this.expenses.reduce((s, e) => s + e.amount, 0);
    recordMetricSnapshot('marginLeakage', yearTotal).catch(() => {});
    return newExp;
  }

  deleteExpense(id: string): void {
    this.expenses = this.expenses.filter(e => e.id !== id);
    persistExpenses(this.expenses).catch(() => {});
    this.notify();
    // R66 round 14: BE delete with offline-queue fallback.
    if (isSupabaseConfigured) {
      (async () => {
        try {
          const { deleteExpense: dbDeleteExpense } = await import('../lib/dataProvider');
          await dbDeleteExpense(id);
        } catch (err) {
          logWarn('expenseService', `deleteExpense persist failed, queueing: ${err}`);
          try {
            const { queueWrite } = await import('./offlineWriteQueue');
            await queueWrite({ table: 'expenses', op: 'delete', rowId: id });
          } catch {}
        }
      })();
    }
  }

  getStats(): ExpenseStats {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const thisMonth = this.expenses.filter(e => e.date >= monthStart);
    const thisYear = this.expenses.filter(e => e.date >= yearStart);

    const deductible = thisYear.filter(e => e.deductible).reduce((sum, e) => sum + (e.amount * e.deductionPercentage / 100), 0);
    const vatReclaim = thisYear.reduce((sum, e) => sum + e.vatAmount, 0);

    const catMap = new Map<ExpenseCategory, { amount: number; count: number }>();
    thisYear.forEach(e => {
      const entry = catMap.get(e.category) ?? { amount: 0, count: 0 };
      entry.amount += e.amount;
      entry.count++;
      catMap.set(e.category, entry);
    });

    return {
      totalThisMonth: thisMonth.reduce((sum, e) => sum + e.amount, 0),
      totalThisYear: thisYear.reduce((sum, e) => sum + e.amount, 0),
      deductibleThisYear: Math.round(deductible),
      vatReclaimable: Math.round(vatReclaim * 100) / 100,
      byCategory: Array.from(catMap.entries())
        .map(([category, data]) => ({ category, ...data }))
        .sort((a, b) => b.amount - a.amount),
    };
  }
}

export const expenseService = ExpenseService.getInstance();

// =============================================================================
// HOOKS
// =============================================================================

export function useExpenses(category?: ExpenseCategory) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setExpenses(expenseService.getExpenses(category));
    setLoading(false);
    return expenseService.subscribe(() => setExpenses(expenseService.getExpenses(category)));
  }, [category]);

  const add = useCallback((expense: Omit<Expense, 'id'>) => expenseService.addExpense(expense), []);
  const remove = useCallback((id: string) => expenseService.deleteExpense(id), []);

  return { expenses, loading, add, remove };
}

export function useExpenseStats() {
  const [stats, setStats] = useState<ExpenseStats>(expenseService.getStats());
  useEffect(() => expenseService.subscribe(() => setStats(expenseService.getStats())), []);
  return stats;
}
