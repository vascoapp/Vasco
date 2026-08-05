/**
 * Financial Auditor Components
 *
 * Components for the Financial Auditor feature that:
 * 1. Verifies invoices against budgets/contracts/POs
 * 2. Detects unnecessary spending
 * 3. Detects overpayments
 */

export { FinancialAuditorDashboard, FinancialAuditorDashboard as FinancialAuditDashboard } from './FinancialAuditorDashboard';

// Re-export hooks from service for convenience
export {
  useFinancialAuditFindings,
  useInvoiceVerification,
  useUnnecessarySpendAnalysis,
  useOverpaymentAnalysis,
  useBudgetReconciliation,
  useFinancialAuditStats,
} from '../../services/financialAuditorService';
