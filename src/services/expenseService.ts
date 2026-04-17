// =============================================================================
// EXPENSE SERVICE
// =============================================================================
// Categorized expense tracking with tax deduction support
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { emitBusinessEvent } from '../intelligence/dataCollector';
import { recordMetricSnapshot } from '../intelligence/learningStorage';
import { getCurrentUserId } from '../lib/currentUser';
import { MS_PER_DAY } from '../utils/timeConstants';

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
  private expenses: Expense[] = [...mockExpenses];

  static getInstance(): ExpenseService {
    if (!ExpenseService.instance) {
      ExpenseService.instance = new ExpenseService();
    }
    return ExpenseService.instance;
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
    const newExp: Expense = { ...expense, id: `exp-${Date.now()}` };
    this.expenses.unshift(newExp);
    this.notify();
    // AI data collector — expense event
    emitBusinessEvent(getCurrentUserId(), {
      eventType: 'expense_added',
      entityType: 'material',
      entityId: newExp.id,
      payload: { amount: newExp.amount, category: newExp.category, supplier: newExp.supplier, jobId: newExp.jobId, vatRate: newExp.vatRate },
      trade: 'general',
    }).catch(() => {});
    // Track total expenses for calibration
    const yearTotal = this.expenses.reduce((s, e) => s + e.amount, 0);
    recordMetricSnapshot('marginLeakage', yearTotal).catch(() => {});
    return newExp;
  }

  deleteExpense(id: string): void {
    this.expenses = this.expenses.filter(e => e.id !== id);
    this.notify();
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
