// =============================================================================
// DUTCH COMPLIANCE SERVICE
// =============================================================================
// Netherlands-specific compliance: BTW, KvK, certifications, insurance
// a16z Sphere pattern: "Compliance as executable workflow logic"
// =============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  KvKRegistration,
  KvKAlert,
  BtwRegistration,
  BtwPeriod,
  BtwCalculation,
  BtwFiling,
  DutchCertification,
  DutchCertificationType,
  DutchInsurance,
  DutchInsuranceType,
  ComplianceDashboard,
  ComplianceAlert,
  ComplianceDeadline,
  InvoiceComplianceCheck,
  InvoiceComplianceIssue,
  BTW_RATES,
  DUTCH_INVOICE_REQUIREMENTS,
} from '../types/dutch-compliance';

// ============================================
// MOCK DATA
// ============================================

const MOCK_KVK: KvKRegistration = {
  kvkNumber: '12345678',
  businessName: 'Van der Berg Schilderwerken',
  tradeName: 'Van der Berg Schilders',
  legalForm: 'eenmanszaak',
  visitingAddress: {
    street: 'Ambachtsweg',
    houseNumber: '42',
    postalCode: '1234 AB',
    city: 'Amsterdam',
    country: 'NL',
  },
  status: 'active',
  registrationDate: '2018-03-15',
  lastVerified: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  mainActivity: { code: '43.34.1', description: 'Schilderen', isMain: true },
  secondaryActivities: [
    { code: '43.39.1', description: 'Stukadoren', isMain: false },
  ],
  authorizedRepresentatives: [
    {
      name: 'Jan van der Berg',
      role: 'eigenaar',
      authorizedIndividually: true,
    },
  ],
  verificationStatus: 'verified',
  alerts: [],
};

const MOCK_BTW: BtwRegistration = {
  btwNumber: 'NL123456789B01',
  isActive: true,
  registrationDate: '2018-03-15',
  lastVerified: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  viesVerified: true,
  viesVerificationDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  filingFrequency: 'quarterly',
  nextFilingDeadline: '2025-04-30',
  kleineOndernemersRegeling: false,
  icpReporting: false,
};

const MOCK_BTW_PERIODS: BtwPeriod[] = [
  {
    periodType: 'quarter',
    periodStart: '2025-01-01',
    periodEnd: '2025-03-31',
    filingDeadline: '2025-04-30',
    paymentDeadline: '2025-04-30',
    status: 'upcoming',
  },
  {
    periodType: 'quarter',
    periodStart: '2024-10-01',
    periodEnd: '2024-12-31',
    filingDeadline: '2025-01-31',
    paymentDeadline: '2025-01-31',
    status: 'filed',
  },
];

const MOCK_CERTIFICATIONS: DutchCertification[] = [
  {
    id: 'cert_1',
    type: 'vca-vol',
    name: 'VCA VOL',
    issuingBody: 'SSVV',
    certificateNumber: 'VCA-2025-78542',
    holderType: 'individual',
    holderName: 'Jan van der Berg',
    issueDate: '2025-01-15',
    expiryDate: '2028-01-15',
    status: 'valid',
    daysUntilExpiry: 1082,
    renewalRequired: true,
    renewalLeadTimeDays: 90,
    documentUri: 'file:///certificates/vca_2025.pdf',
    documentVerified: true,
    requiredForTrades: ['painter', 'general-contractor'],
    legalBasis: 'VCA-norm',
  },
  {
    id: 'cert_2',
    type: 'bhv',
    name: 'BHV Certificaat',
    issuingBody: 'NIBHV',
    certificateNumber: 'BHV-2024-12345',
    holderType: 'individual',
    holderName: 'Jan van der Berg',
    issueDate: '2024-06-01',
    expiryDate: '2025-06-01',
    status: 'valid',
    daysUntilExpiry: 123,
    renewalRequired: true,
    renewalLeadTimeDays: 60,
    renewalProcess: {
      steps: [
        { order: 1, description: 'Herhalingscursus boeken', status: 'pending' },
        { order: 2, description: 'Cursus volgen (1 dag)', status: 'pending' },
        { order: 3, description: 'Certificaat ontvangen', status: 'pending' },
      ],
      estimatedCost: 175,
      estimatedDuration: '1 dag',
    },
    documentVerified: true,
    requiredForTrades: ['painter', 'electrician', 'plumber'],
    legalBasis: 'Arbowet',
  },
  {
    id: 'cert_3',
    type: 'ehbo',
    name: 'EHBO Diploma',
    issuingBody: 'Het Oranje Kruis',
    certificateNumber: 'EHBO-2023-98765',
    holderType: 'individual',
    holderName: 'Jan van der Berg',
    issueDate: '2023-03-15',
    expiryDate: '2025-03-15',
    status: 'expiring-soon',
    daysUntilExpiry: 45,
    renewalRequired: true,
    renewalLeadTimeDays: 30,
    renewalProcess: {
      steps: [
        { order: 1, description: 'Herhalingscursus boeken', status: 'pending' },
        { order: 2, description: 'Cursus volgen (4 uur)', status: 'pending' },
        { order: 3, description: 'Examen afleggen', status: 'pending' },
      ],
      estimatedCost: 85,
      estimatedDuration: '1 avond',
    },
    documentVerified: true,
    requiredForTrades: [],
  },
];

const MOCK_INSURANCE: DutchInsurance[] = [
  {
    id: 'ins_1',
    type: 'aansprakelijkheid',
    provider: 'Interpolis',
    policyNumber: 'AVB-2024-123456',
    coverageDescription: 'Aansprakelijkheidsverzekering Bedrijven',
    coverageAmount: 2500000,
    deductible: 500,
    startDate: '2024-01-01',
    endDate: '2025-01-01',
    status: 'active',
    daysUntilExpiry: 335,
    premiumAmount: 485,
    premiumFrequency: 'yearly',
    nextPaymentDate: '2025-01-01',
    claimPhone: '0800-1234',
    claimEmail: 'schade@interpolis.nl',
    documentUri: 'file:///insurance/avb_2024.pdf',
  },
  {
    id: 'ins_2',
    type: 'wagenpark',
    provider: 'ANWB',
    policyNumber: 'AUTO-2024-789012',
    coverageDescription: 'WA + Beperkt Casco',
    coverageAmount: 1000000,
    deductible: 250,
    startDate: '2024-06-01',
    endDate: '2025-06-01',
    status: 'active',
    daysUntilExpiry: 123,
    premiumAmount: 89,
    premiumFrequency: 'monthly',
    nextPaymentDate: '2025-02-01',
    documentUri: 'file:///insurance/auto_2024.pdf',
  },
];

// ============================================
// LATE PAYMENT INTEREST (Wet Betalingstermijnen)
// ============================================

export const DUTCH_LATE_PAYMENT_RATES = {
  commercial: 0.08, // 8% for B2B (wettelijke handelsrente)
  consumer: 0.02,   // 2% for B2C (wettelijke rente)
};

export function calculateLatePaymentInterest(
  amount: number,
  daysOverdue: number,
  type: 'commercial' | 'consumer' = 'commercial',
): { interest: number; dailyRate: number; total: number } {
  const annualRate = DUTCH_LATE_PAYMENT_RATES[type];
  const dailyRate = annualRate / 365;
  const interest = amount * dailyRate * daysOverdue;
  return {
    interest: Math.round(interest * 100) / 100,
    dailyRate: Math.round(dailyRate * 10000) / 10000,
    total: Math.round((amount + interest) * 100) / 100,
  };
}

// ============================================
// GOVERNMENT PORTALS
// ============================================

export const DUTCH_GOVERNMENT_PORTALS = {
  omgevingsloket: { name: 'Omgevingsloket', url: 'https://www.omgevingsloket.nl', description: 'Vergunningen aanvragen en checken' },
  mijnOverheid: { name: 'MijnOverheid', url: 'https://mijn.overheid.nl', description: 'Persoonlijke overheidsberichten' },
  kvk: { name: 'KVK', url: 'https://www.kvk.nl', description: 'Handelsregister en bedrijfsgegevens' },
  belastingdienst: { name: 'Belastingdienst', url: 'https://www.belastingdienst.nl', description: 'BTW-aangifte en belastingen' },
  rvo: { name: 'RVO', url: 'https://www.rvo.nl', description: 'Subsidies en regelingen' },
  inspectie: { name: 'Inspectie SZW', url: 'https://www.nlarbeidsinspectie.nl', description: 'Arbeidsinspectie en veiligheid' },
};

// ============================================
// SERVICE CLASS
// ============================================

class DutchComplianceService {
  private kvk: KvKRegistration = MOCK_KVK;
  private btw: BtwRegistration = MOCK_BTW;
  private btwPeriods: BtwPeriod[] = MOCK_BTW_PERIODS;
  private certifications: Map<string, DutchCertification> = new Map();
  private insurance: Map<string, DutchInsurance> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    MOCK_CERTIFICATIONS.forEach((c) => this.certifications.set(c.id, c));
    MOCK_INSURANCE.forEach((i) => this.insurance.set(i.id, i));
  }

  // -----------------------------------------
  // KvK Management
  // -----------------------------------------

  getKvKRegistration(): KvKRegistration {
    return this.kvk;
  }

  async verifyKvK(): Promise<{ success: boolean; alerts: KvKAlert[] }> {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    this.kvk.lastVerified = new Date().toISOString();
    this.kvk.verificationStatus = 'verified';
    this.notifyListeners();

    return { success: true, alerts: [] };
  }

  // -----------------------------------------
  // BTW Management
  // -----------------------------------------

  getBtwRegistration(): BtwRegistration {
    return this.btw;
  }

  getBtwPeriods(): BtwPeriod[] {
    return this.btwPeriods;
  }

  getCurrentBtwPeriod(): BtwPeriod | undefined {
    const now = new Date();
    return this.btwPeriods.find((p) => {
      const start = new Date(p.periodStart);
      const end = new Date(p.periodEnd);
      return now >= start && now <= end;
    });
  }

  calculateBtw(invoices: { amount: number; vatRate: number }[], expenses: { amount: number; vatAmount: number }[]): BtwCalculation {
    let salesExclBtw21 = 0;
    let salesExclBtw9 = 0;
    let salesExclBtw0 = 0;

    invoices.forEach((inv) => {
      if (inv.vatRate === 21) salesExclBtw21 += inv.amount;
      else if (inv.vatRate === 9) salesExclBtw9 += inv.amount;
      else salesExclBtw0 += inv.amount;
    });

    const btwOwed21 = salesExclBtw21 * 0.21;
    const btwOwed9 = salesExclBtw9 * 0.09;
    const totalBtwOwed = btwOwed21 + btwOwed9;

    const purchasesExclBtw = expenses.reduce((sum, e) => sum + e.amount, 0);
    const btwPaid = expenses.reduce((sum, e) => sum + e.vatAmount, 0);

    return {
      salesExclBtw21,
      salesExclBtw9,
      salesExclBtw0,
      btwOwed21,
      btwOwed9,
      totalBtwOwed,
      purchasesExclBtw,
      btwPaid,
      btwBalance: totalBtwOwed - btwPaid,
    };
  }

  validateBtwNumber(btwNumber: string): { valid: boolean; formatted?: string; error?: string } {
    // Dutch BTW number format: NL + 9 digits + B + 2 digits
    const pattern = /^NL\d{9}B\d{2}$/;
    const cleaned = btwNumber.replace(/\s/g, '').toUpperCase();

    if (pattern.test(cleaned)) {
      return { valid: true, formatted: cleaned };
    }

    return { valid: false, error: 'Ongeldig BTW-nummer formaat. Verwacht: NL123456789B01' };
  }

  // -----------------------------------------
  // Certifications
  // -----------------------------------------

  getCertifications(): DutchCertification[] {
    return Array.from(this.certifications.values()).sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }

  getCertificationById(id: string): DutchCertification | undefined {
    return this.certifications.get(id);
  }

  getExpiringCertifications(withinDays: number = 90): DutchCertification[] {
    return this.getCertifications().filter((c) => c.daysUntilExpiry <= withinDays && c.daysUntilExpiry > 0);
  }

  getExpiredCertifications(): DutchCertification[] {
    return this.getCertifications().filter((c) => c.daysUntilExpiry <= 0);
  }

  // -----------------------------------------
  // Insurance
  // -----------------------------------------

  getInsurance(): DutchInsurance[] {
    return Array.from(this.insurance.values()).sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }

  getInsuranceById(id: string): DutchInsurance | undefined {
    return this.insurance.get(id);
  }

  getExpiringInsurance(withinDays: number = 60): DutchInsurance[] {
    return this.getInsurance().filter((i) => i.daysUntilExpiry <= withinDays && i.daysUntilExpiry > 0);
  }

  // -----------------------------------------
  // Invoice Compliance
  // -----------------------------------------

  checkInvoiceCompliance(invoice: {
    invoiceNumber?: string;
    invoiceDate?: string;
    sellerName?: string;
    sellerAddress?: string;
    sellerKvk?: string;
    sellerBtw?: string;
    buyerName?: string;
    buyerAddress?: string;
    lineItems?: { description: string; quantity: number; unitPrice: number; btwRate: number }[];
    btwAmount?: number;
    totalAmount?: number;
  }): InvoiceComplianceCheck {
    const issues: InvoiceComplianceIssue[] = [];

    // Check required fields
    if (!invoice.invoiceNumber) {
      issues.push({
        field: 'invoiceNumber',
        issue: 'missing',
        message: 'Factuurnummer ontbreekt',
        severity: 'error',
        legalReference: 'Art. 35a Wet OB',
      });
    }

    if (!invoice.invoiceDate) {
      issues.push({
        field: 'invoiceDate',
        issue: 'missing',
        message: 'Factuurdatum ontbreekt',
        severity: 'error',
        legalReference: 'Art. 35a Wet OB',
      });
    }

    if (!invoice.sellerName || !invoice.sellerAddress) {
      issues.push({
        field: 'sellerDetails',
        issue: 'missing',
        message: 'Naam en/of adres leverancier ontbreekt',
        severity: 'error',
        legalReference: 'Art. 35a Wet OB',
      });
    }

    if (!invoice.sellerBtw) {
      issues.push({
        field: 'sellerBtw',
        issue: 'missing',
        message: 'BTW-nummer leverancier ontbreekt',
        severity: 'warning',
      });
    } else {
      const validation = this.validateBtwNumber(invoice.sellerBtw);
      if (!validation.valid) {
        issues.push({
          field: 'sellerBtw',
          issue: 'invalid',
          message: 'BTW-nummer leverancier ongeldig',
          severity: 'error',
        });
      }
    }

    if (!invoice.sellerKvk) {
      issues.push({
        field: 'sellerKvk',
        issue: 'missing',
        message: 'KvK-nummer leverancier ontbreekt',
        severity: 'warning',
      });
    }

    if (!invoice.buyerName || !invoice.buyerAddress) {
      issues.push({
        field: 'buyerDetails',
        issue: 'missing',
        message: 'Naam en/of adres afnemer ontbreekt',
        severity: 'error',
        legalReference: 'Art. 35a Wet OB',
      });
    }

    if (!invoice.lineItems || invoice.lineItems.length === 0) {
      issues.push({
        field: 'lineItems',
        issue: 'missing',
        message: 'Geen regels op factuur',
        severity: 'error',
      });
    }

    if (invoice.btwAmount === undefined) {
      issues.push({
        field: 'btwAmount',
        issue: 'missing',
        message: 'BTW-bedrag ontbreekt',
        severity: 'error',
        legalReference: 'Art. 35a Wet OB',
      });
    }

    return {
      invoiceId: invoice.invoiceNumber || 'unknown',
      isCompliant: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
      checkedAt: new Date().toISOString(),
    };
  }

  // -----------------------------------------
  // Dashboard
  // -----------------------------------------

  getComplianceDashboard(): ComplianceDashboard {
    const certs = this.getCertifications();
    const insurance = this.getInsurance();
    const alerts: ComplianceAlert[] = [];
    const deadlines: ComplianceDeadline[] = [];

    // KvK status
    const kvkDaysSinceVerified = Math.floor(
      (Date.now() - new Date(this.kvk.lastVerified).getTime()) / (1000 * 60 * 60 * 24)
    );
    const kvkStatus = kvkDaysSinceVerified > 30 ? 'needs-verification' : 'verified';

    if (kvkStatus === 'needs-verification') {
      alerts.push({
        id: 'alert_kvk_verify',
        severity: 'warning',
        category: 'kvk',
        title: 'KvK verificatie nodig',
        message: `KvK-gegevens zijn ${kvkDaysSinceVerified} dagen geleden gecontroleerd`,
        actionRequired: true,
        actionLabel: 'Verifieer nu',
        createdAt: new Date().toISOString(),
      });
    }

    // BTW status
    const btwPeriod = this.getCurrentBtwPeriod();
    let btwStatus: 'up-to-date' | 'filing-due' | 'overdue' = 'up-to-date';
    if (btwPeriod) {
      const deadline = new Date(btwPeriod.filingDeadline);
      const daysUntilDeadline = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      if (daysUntilDeadline < 0) {
        btwStatus = 'overdue';
        alerts.push({
          id: 'alert_btw_overdue',
          severity: 'critical',
          category: 'btw',
          title: 'BTW-aangifte te laat!',
          message: `Deadline was ${Math.abs(daysUntilDeadline)} dagen geleden`,
          actionRequired: true,
          actionLabel: 'Nu indienen',
          dueDate: btwPeriod.filingDeadline,
          createdAt: new Date().toISOString(),
        });
      } else if (daysUntilDeadline <= 14) {
        btwStatus = 'filing-due';
        alerts.push({
          id: 'alert_btw_due',
          severity: 'warning',
          category: 'btw',
          title: 'BTW-aangifte binnenkort',
          message: `Nog ${daysUntilDeadline} dagen tot deadline`,
          actionRequired: true,
          actionLabel: 'Voorbereiden',
          dueDate: btwPeriod.filingDeadline,
          createdAt: new Date().toISOString(),
        });
      }

      deadlines.push({
        id: 'deadline_btw',
        type: 'btw-filing',
        title: `BTW-aangifte Q${Math.ceil((new Date(btwPeriod.periodStart).getMonth() + 1) / 3)}`,
        deadline: btwPeriod.filingDeadline,
        daysUntil: daysUntilDeadline,
        status: daysUntilDeadline < 0 ? 'overdue' : daysUntilDeadline <= 14 ? 'due-soon' : 'upcoming',
      });
    }

    // Certifications
    const expiringSoon = certs.filter((c) => c.status === 'expiring-soon' || c.daysUntilExpiry <= 60);
    const expired = certs.filter((c) => c.daysUntilExpiry <= 0);

    expiringSoon.forEach((cert) => {
      if (cert.daysUntilExpiry > 0) {
        alerts.push({
          id: `alert_cert_${cert.id}`,
          severity: cert.daysUntilExpiry <= 30 ? 'warning' : 'info',
          category: 'certification',
          title: `${cert.name} verloopt binnenkort`,
          message: `Nog ${cert.daysUntilExpiry} dagen geldig`,
          actionRequired: true,
          actionLabel: 'Verlengen',
          dueDate: cert.expiryDate,
          createdAt: new Date().toISOString(),
        });

        deadlines.push({
          id: `deadline_cert_${cert.id}`,
          type: 'certification-renewal',
          title: `${cert.name} verlengen`,
          deadline: cert.expiryDate,
          daysUntil: cert.daysUntilExpiry,
          status: cert.daysUntilExpiry <= 30 ? 'due-soon' : 'upcoming',
          linkedEntityId: cert.id,
        });
      }
    });

    expired.forEach((cert) => {
      alerts.push({
        id: `alert_cert_expired_${cert.id}`,
        severity: 'critical',
        category: 'certification',
        title: `${cert.name} verlopen!`,
        message: 'Certificaat is niet meer geldig',
        actionRequired: true,
        actionLabel: 'Vernieuwen',
        createdAt: new Date().toISOString(),
      });
    });

    // Insurance
    const expiringInsurance = insurance.filter((i) => i.daysUntilExpiry <= 60);
    expiringInsurance.forEach((ins) => {
      if (ins.daysUntilExpiry > 0) {
        alerts.push({
          id: `alert_ins_${ins.id}`,
          severity: ins.daysUntilExpiry <= 30 ? 'warning' : 'info',
          category: 'insurance',
          title: `${ins.type === 'aansprakelijkheid' ? 'Aansprakelijkheidsverzekering' : ins.type} verloopt`,
          message: `Nog ${ins.daysUntilExpiry} dagen`,
          actionRequired: true,
          actionLabel: 'Verlengen',
          dueDate: ins.endDate,
          createdAt: new Date().toISOString(),
        });

        deadlines.push({
          id: `deadline_ins_${ins.id}`,
          type: 'insurance-renewal',
          title: `Verzekering verlengen`,
          deadline: ins.endDate,
          daysUntil: ins.daysUntilExpiry,
          status: ins.daysUntilExpiry <= 30 ? 'due-soon' : 'upcoming',
          linkedEntityId: ins.id,
        });
      }
    });

    // Calculate overall score
    const errorCount = alerts.filter((a) => a.severity === 'critical').length;
    const warningCount = alerts.filter((a) => a.severity === 'warning').length;
    const overallScore = Math.max(0, 100 - errorCount * 25 - warningCount * 10);

    return {
      overallScore,
      status: errorCount > 0 ? 'critical' : warningCount > 0 ? 'action-required' : 'compliant',
      kvkStatus,
      kvkLastVerified: this.kvk.lastVerified,
      btwStatus,
      nextBtwDeadline: btwPeriod?.filingDeadline,
      certificationsValid: certs.filter((c) => c.status === 'valid').length,
      certificationsExpiringSoon: expiringSoon.length,
      certificationsExpired: expired.length,
      insuranceActive: insurance.filter((i) => i.status === 'active').length,
      insuranceExpiringSoon: expiringInsurance.filter((i) => i.daysUntilExpiry > 0).length,
      insuranceExpired: insurance.filter((i) => i.daysUntilExpiry <= 0).length,
      alerts: alerts.sort((a, b) => {
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }),
      upcomingDeadlines: deadlines.sort((a, b) => a.daysUntil - b.daysUntil),
    };
  }

  // -----------------------------------------
  // Subscription
  // -----------------------------------------

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((l) => l());
  }
}

export const dutchComplianceService = new DutchComplianceService();

// ============================================
// REACT HOOKS
// ============================================

export function useComplianceDashboard() {
  const [dashboard, setDashboard] = useState<ComplianceDashboard>(() =>
    dutchComplianceService.getComplianceDashboard()
  );

  useEffect(() => {
    const unsubscribe = dutchComplianceService.subscribe(() => {
      setDashboard(dutchComplianceService.getComplianceDashboard());
    });
    return unsubscribe;
  }, []);

  return dashboard;
}

export function useKvKRegistration() {
  const [kvk, setKvk] = useState<KvKRegistration>(() =>
    dutchComplianceService.getKvKRegistration()
  );

  useEffect(() => {
    const unsubscribe = dutchComplianceService.subscribe(() => {
      setKvk(dutchComplianceService.getKvKRegistration());
    });
    return unsubscribe;
  }, []);

  const verify = useCallback(async () => {
    return dutchComplianceService.verifyKvK();
  }, []);

  return { kvk, verify };
}

export function useBtwRegistration() {
  const [btw, setBtw] = useState<BtwRegistration>(() =>
    dutchComplianceService.getBtwRegistration()
  );
  const [periods, setPeriods] = useState<BtwPeriod[]>(() =>
    dutchComplianceService.getBtwPeriods()
  );

  useEffect(() => {
    const unsubscribe = dutchComplianceService.subscribe(() => {
      setBtw(dutchComplianceService.getBtwRegistration());
      setPeriods(dutchComplianceService.getBtwPeriods());
    });
    return unsubscribe;
  }, []);

  const currentPeriod = useMemo(() => dutchComplianceService.getCurrentBtwPeriod(), [periods]);

  const calculateBtw = useCallback(
    (invoices: { amount: number; vatRate: number }[], expenses: { amount: number; vatAmount: number }[]) => {
      return dutchComplianceService.calculateBtw(invoices, expenses);
    },
    []
  );

  return { btw, periods, currentPeriod, calculateBtw };
}

export function useDutchCertifications() {
  const [certifications, setCertifications] = useState<DutchCertification[]>(() =>
    dutchComplianceService.getCertifications()
  );

  useEffect(() => {
    const unsubscribe = dutchComplianceService.subscribe(() => {
      setCertifications(dutchComplianceService.getCertifications());
    });
    return unsubscribe;
  }, []);

  const expiringSoon = useMemo(() => dutchComplianceService.getExpiringCertifications(), [certifications]);
  const expired = useMemo(() => dutchComplianceService.getExpiredCertifications(), [certifications]);

  return { certifications, expiringSoon, expired };
}

export function useDutchInsurance() {
  const [insurance, setInsurance] = useState<DutchInsurance[]>(() =>
    dutchComplianceService.getInsurance()
  );

  useEffect(() => {
    const unsubscribe = dutchComplianceService.subscribe(() => {
      setInsurance(dutchComplianceService.getInsurance());
    });
    return unsubscribe;
  }, []);

  const expiringSoon = useMemo(() => dutchComplianceService.getExpiringInsurance(), [insurance]);

  return { insurance, expiringSoon };
}

export function useInvoiceComplianceCheck() {
  const checkInvoice = useCallback((invoice: Parameters<typeof dutchComplianceService.checkInvoiceCompliance>[0]) => {
    return dutchComplianceService.checkInvoiceCompliance(invoice);
  }, []);

  return { checkInvoice };
}
