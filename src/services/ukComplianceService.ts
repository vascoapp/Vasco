/**
 * UK Compliance Service
 *
 * Handles UK-specific compliance requirements:
 * 1. Companies House verification
 * 2. VAT (MTD) tracking and returns
 * 3. CIS (Construction Industry Scheme)
 * 4. Trade certifications: Gas Safe, Part P, CSCS, OFTEC, F-Gas
 * 5. Insurance verification
 * 6. Compliance gates for work blocking
 *
 * a16z Sphere pattern: "Compliance as executable workflow logic"
 */

import { localDateKey, todayKey } from '../utils/dateKey';
import { useState, useEffect, useCallback } from 'react';
import {
  CompaniesHouseRegistration,
  CompaniesHouseAlert,
  UKVATRegistration,
  UKVATReturn,
  UKVATCalculation,
  UKVATPeriod,
  CISRegistration,
  CISPayment,
  CISMonthlyReturn,
  GasSafeRegistration,
  GasSafeCompetency,
  GasSafeApplianceCategory,
  PartPRegistration,
  PartPSchemeProvider,
  CSCSCard,
  OFTECRegistration,
  FGasRegistration,
  UKInsurance,
  UKComplianceDashboard,
  UKComplianceAlert,
  UKComplianceDeadline,
  UKComplianceGate,
  UKComplianceRequirement,
  UK_COMPLIANCE_GATES,
  UKInvoiceComplianceCheck,
  UKInvoiceComplianceIssue,
  UK_VAT_INVOICE_REQUIREMENTS,
  UK_REVERSE_CHARGE_STATEMENT,
} from '../types/uk-compliance';

// ============================================
// MOCK DATA - Replace with real API calls
// ============================================

const MOCK_COMPANIES_HOUSE: CompaniesHouseRegistration = {
  companyNumber: '12345678',
  companyName: 'Premier Construction Ltd',
  tradingName: 'Premier Build',
  companyType: 'private-limited-company',
  registeredAddress: {
    addressLine1: '123 Business Park',
    addressLine2: 'Industrial Estate',
    city: 'Manchester',
    county: 'Greater Manchester',
    postcode: 'M1 2AB',
    country: 'England',
  },
  companyStatus: 'active',
  incorporationDate: '2015-03-15',
  lastAccountsDate: '2023-03-31',
  nextAccountsDue: '2024-12-31',
  lastConfirmationStatementDate: '2024-01-15',
  nextConfirmationStatementDue: '2025-01-15',
  sicCodes: [
    { code: '41201', description: 'Construction of commercial buildings' },
    { code: '43290', description: 'Other construction installation' },
  ],
  directors: [
    {
      name: 'John Smith',
      role: 'director',
      appointedOn: '2015-03-15',
      nationality: 'British',
      occupation: 'Company Director',
    },
  ],
  verificationStatus: 'verified',
  lastVerified: new Date().toISOString(),
};

const MOCK_VAT_REGISTRATION: UKVATRegistration = {
  vatNumber: 'GB123456789',
  isActive: true,
  registrationDate: '2016-01-01',
  lastVerified: new Date().toISOString(),
  mtdEnrolled: true,
  mtdSoftwareConnected: true,
  mtdSoftwareName: 'Vasco',
  filingFrequency: 'quarterly',
  accountingPeriodEnd: '03-31',
  nextFilingDeadline: '2024-05-07',
  flatRateScheme: false,
  cashAccountingScheme: false,
  annualAccountingScheme: false,
  currentTurnover: 850000,
  vatThreshold: 90000,
};

const MOCK_GAS_SAFE: GasSafeRegistration = {
  id: 'gs-001',
  registrationNumber: '1234567',
  holderType: 'business',
  businessName: 'Premier Heating Services',
  competencies: [
    { code: 'CCN1', description: 'Core Gas Safety', category: 'domestic' },
    { code: 'CKR1', description: 'Cookers', category: 'domestic' },
    { code: 'CENWAT1', description: 'Central Heating Wet', category: 'domestic' },
    { code: 'HTR1', description: 'Gas Fires', category: 'domestic' },
  ],
  appliances: [
    'cooker-hob-domestic',
    'space-heater-domestic',
    'water-heater-domestic',
    'central-heating-domestic',
    'pipework-domestic',
  ],
  status: 'valid',
  issueDate: '2023-04-01',
  expiryDate: '2024-03-31',
  daysUntilExpiry: 45,
  lastVerified: new Date().toISOString(),
  verificationStatus: 'verified',
  publicRegisterUrl: 'https://www.gassaferegister.co.uk/find-an-engineer/',
};

// ============================================
// SERVICE CLASS
// ============================================

class UKComplianceService {
  // ----------------------------------------
  // COMPANIES HOUSE
  // ----------------------------------------

  async verifyCompaniesHouse(companyNumber: string): Promise<CompaniesHouseRegistration> {
    // In production, call Companies House API
    // https://developer.company-information.service.gov.uk/
    await this.simulateApiDelay();

    return {
      ...MOCK_COMPANIES_HOUSE,
      companyNumber,
      lastVerified: new Date().toISOString(),
      verificationStatus: 'verified',
    };
  }

  async getCompaniesHouseAlerts(registration: CompaniesHouseRegistration): Promise<CompaniesHouseAlert[]> {
    const alerts: CompaniesHouseAlert[] = [];
    const now = new Date();

    // Check accounts deadline
    if (registration.nextAccountsDue) {
      const accountsDue = new Date(registration.nextAccountsDue);
      const daysUntil = Math.ceil((accountsDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntil < 0) {
        alerts.push({
          type: 'accounts-overdue',
          message: `Annual accounts are ${Math.abs(daysUntil)} days overdue`,
          detectedAt: now.toISOString(),
          deadline: registration.nextAccountsDue,
          severity: 'critical',
        });
      } else if (daysUntil < 30) {
        alerts.push({
          type: 'filing-due',
          message: `Annual accounts due in ${daysUntil} days`,
          detectedAt: now.toISOString(),
          deadline: registration.nextAccountsDue,
          severity: 'warning',
        });
      }
    }

    // Check confirmation statement
    if (registration.nextConfirmationStatementDue) {
      const csDue = new Date(registration.nextConfirmationStatementDue);
      const daysUntil = Math.ceil((csDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntil < 0) {
        alerts.push({
          type: 'confirmation-statement-overdue',
          message: `Confirmation statement is ${Math.abs(daysUntil)} days overdue`,
          detectedAt: now.toISOString(),
          deadline: registration.nextConfirmationStatementDue,
          severity: 'critical',
        });
      } else if (daysUntil < 14) {
        alerts.push({
          type: 'filing-due',
          message: `Confirmation statement due in ${daysUntil} days`,
          detectedAt: now.toISOString(),
          deadline: registration.nextConfirmationStatementDue,
          severity: 'warning',
        });
      }
    }

    return alerts;
  }

  // ----------------------------------------
  // VAT
  // ----------------------------------------

  async getVATRegistration(vatNumber: string): Promise<UKVATRegistration> {
    await this.simulateApiDelay();
    return {
      ...MOCK_VAT_REGISTRATION,
      vatNumber,
      lastVerified: new Date().toISOString(),
    };
  }

  calculateVATReturn(
    sales: { amount: number; rate: 0 | 5 | 20 }[],
    purchases: { amount: number; vatAmount: number }[],
    reverseCharge?: { outputs: number; inputs: number }
  ): UKVATCalculation {
    const salesStandardRate = sales.filter(s => s.rate === 20).reduce((sum, s) => sum + s.amount, 0);
    const salesReducedRate = sales.filter(s => s.rate === 5).reduce((sum, s) => sum + s.amount, 0);
    const salesZeroRate = sales.filter(s => s.rate === 0).reduce((sum, s) => sum + s.amount, 0);

    const vatOwedStandard = salesStandardRate * 0.20;
    const vatOwedReduced = salesReducedRate * 0.05;
    const totalVatOwed = vatOwedStandard + vatOwedReduced;

    const purchasesExclVat = purchases.reduce((sum, p) => sum + p.amount, 0);
    const vatReclaimed = purchases.reduce((sum, p) => sum + p.vatAmount, 0);

    return {
      salesStandardRate,
      salesReducedRate,
      salesZeroRate,
      vatOwedStandard,
      vatOwedReduced,
      totalVatOwed,
      purchasesExclVat,
      vatReclaimed,
      reverseChargeOutputs: reverseCharge?.outputs,
      reverseChargeInputs: reverseCharge?.inputs,
      vatBalance: totalVatOwed - vatReclaimed + (reverseCharge?.outputs || 0) - (reverseCharge?.inputs || 0),
    };
  }

  async generateVATReturn(period: UKVATPeriod, calculation: UKVATCalculation): Promise<UKVATReturn> {
    await this.simulateApiDelay();

    return {
      id: `vat-${Date.now()}`,
      period,
      calculation,
      box1: calculation.totalVatOwed,
      box2: 0, // EC acquisitions (post-Brexit minimal)
      box3: calculation.totalVatOwed,
      box4: calculation.vatReclaimed,
      box5: calculation.vatBalance,
      box6: calculation.salesStandardRate + calculation.salesReducedRate + calculation.salesZeroRate,
      box7: calculation.purchasesExclVat,
      box8: 0, // EC supplies
      box9: 0, // EC acquisitions
      status: 'draft',
      paymentStatus: 'pending',
      invoicesIncluded: [],
      expensesIncluded: [],
    };
  }

  getNextVATPeriod(registration: UKVATRegistration): UKVATPeriod {
    const now = new Date();
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const periodStart = new Date(now.getFullYear(), currentQuarter * 3, 1);
    const periodEnd = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0);

    // VAT deadline is 1 month and 7 days after period end
    const filingDeadline = new Date(periodEnd);
    filingDeadline.setMonth(filingDeadline.getMonth() + 1);
    filingDeadline.setDate(filingDeadline.getDate() + 7);

    return {
      periodType: 'quarter',
      periodStart: localDateKey(periodStart),
      periodEnd: localDateKey(periodEnd),
      filingDeadline: localDateKey(filingDeadline),
      paymentDeadline: localDateKey(filingDeadline),
      status: now < filingDeadline ? 'upcoming' : 'overdue',
    };
  }

  // ----------------------------------------
  // CIS
  // ----------------------------------------

  async verifyCISSubcontractor(utr: string): Promise<CISRegistration> {
    await this.simulateApiDelay();

    // In production, call HMRC CIS API
    return {
      utr,
      registrationStatus: 'registered',
      verificationNumber: `V${Date.now()}`,
      deductionRate: 20,
      isContractor: false,
      contractorVerificationActive: false,
      isSubcontractor: true,
      lastVerified: new Date().toISOString(),
    };
  }

  calculateCISDeduction(grossAmount: number, materialsAmount: number, deductionRate: 0 | 20 | 30): CISPayment {
    const taxableAmount = grossAmount - materialsAmount;
    const cisDeduction = taxableAmount * (deductionRate / 100);
    const netPayment = grossAmount - cisDeduction;

    return {
      id: `cis-${Date.now()}`,
      contractorUtr: '',
      subcontractorUtr: '',
      subcontractorName: '',
      paymentDate: todayKey(),
      grossAmount,
      materialsDeduction: materialsAmount,
      cisDeduction,
      netPayment,
      verificationNumber: '',
      deductionRateApplied: deductionRate,
    };
  }

  // ----------------------------------------
  // GAS SAFE
  // ----------------------------------------

  async verifyGasSafe(registrationNumber: string): Promise<GasSafeRegistration> {
    await this.simulateApiDelay();

    // In production, call Gas Safe Register API
    return {
      ...MOCK_GAS_SAFE,
      registrationNumber,
      lastVerified: new Date().toISOString(),
      verificationStatus: 'verified',
    };
  }

  canPerformGasWork(
    registration: GasSafeRegistration,
    workType: string,
    applianceType: GasSafeApplianceCategory
  ): { allowed: boolean; reason?: string } {
    if (registration.status !== 'valid') {
      return { allowed: false, reason: 'Gas Safe registration is not valid' };
    }

    if (registration.daysUntilExpiry <= 0) {
      return { allowed: false, reason: 'Gas Safe registration has expired' };
    }

    if (!registration.appliances.includes(applianceType)) {
      return {
        allowed: false,
        reason: `Not registered for ${applianceType.replace(/-/g, ' ')}`
      };
    }

    return { allowed: true };
  }

  // ----------------------------------------
  // PART P (ELECTRICAL)
  // ----------------------------------------

  async verifyPartP(schemeProvider: PartPSchemeProvider, membershipNumber: string): Promise<PartPRegistration> {
    await this.simulateApiDelay();

    return {
      id: `partp-${Date.now()}`,
      schemeProvider,
      schemeProviderRef: membershipNumber,
      holderType: 'business',
      businessName: 'Premier Electrical Services',
      competencies: [
        {
          category: 'domestic',
          scope: ['installation', 'testing-inspection', 'periodic-inspection'],
        },
      ],
      status: 'valid',
      memberSince: '2018-01-01',
      currentPeriodStart: '2024-01-01',
      currentPeriodEnd: '2024-12-31',
      daysUntilRenewal: 300,
      lastVerified: new Date().toISOString(),
      verificationStatus: 'verified',
      hasRequiredInsurance: true,
      insuranceExpiryDate: '2024-12-31',
    };
  }

  isNotifiableElectricalWork(workDescription: string, location: string): boolean {
    const notifiableKeywords = [
      'new circuit',
      'consumer unit',
      'fuse box',
      'distribution board',
      'kitchen',
      'bathroom',
      'wet room',
      'shower room',
      'garden',
      'outdoor',
      'external',
      'swimming pool',
      'sauna',
      'solar',
      'pv',
      'ev charger',
      'electric vehicle',
      'floor heating',
      'underfloor heating',
    ];

    const lowerWork = workDescription.toLowerCase();
    const lowerLocation = location.toLowerCase();

    return notifiableKeywords.some(
      keyword => lowerWork.includes(keyword) || lowerLocation.includes(keyword)
    );
  }

  // ----------------------------------------
  // CSCS
  // ----------------------------------------

  async verifyCSCS(cardNumber: string): Promise<CSCSCard> {
    await this.simulateApiDelay();

    return {
      id: `cscs-${Date.now()}`,
      cardNumber,
      cardType: 'skilled-worker',
      cardColour: 'blue',
      holderName: 'John Smith',
      occupation: 'Electrician',
      qualifications: [
        {
          title: 'NVQ Level 3 Electrical Installation',
          level: '3',
          awardingBody: 'City & Guilds',
          achievedDate: '2019-06-15',
        },
      ],
      healthAndSafetyTest: {
        testType: 'citb',
        passDate: '2023-01-15',
        expiryDate: '2028-01-15',
      },
      status: 'valid',
      issueDate: '2023-01-20',
      expiryDate: '2028-01-20',
      daysUntilExpiry: 1400,
      lastVerified: new Date().toISOString(),
      verificationStatus: 'verified',
    };
  }

  // ----------------------------------------
  // OFTEC
  // ----------------------------------------

  async verifyOFTEC(registrationNumber: string): Promise<OFTECRegistration> {
    await this.simulateApiDelay();

    return {
      id: `oftec-${Date.now()}`,
      registrationNumber,
      holderType: 'business',
      businessName: 'Premier Oil Heating',
      scopes: ['OFT10-105', 'OFT10-600A', 'OFT10-600B'],
      status: 'valid',
      issueDate: '2023-01-01',
      expiryDate: '2024-12-31',
      daysUntilExpiry: 300,
      lastVerified: new Date().toISOString(),
      verificationStatus: 'verified',
    };
  }

  // ----------------------------------------
  // F-GAS
  // ----------------------------------------

  async verifyFGas(companyRegistrationNumber: string): Promise<FGasRegistration> {
    await this.simulateApiDelay();

    return {
      id: `fgas-${Date.now()}`,
      companyRegistrationNumber,
      certificationType: 'category-1',
      companyName: 'Premier HVAC Ltd',
      certifiedPersonnel: [
        {
          name: 'Mike Johnson',
          certificateNumber: 'FG123456',
          category: 'category-1',
          issueDate: '2022-03-01',
          expiryDate: '2027-03-01',
          status: 'valid',
        },
      ],
      status: 'valid',
      issueDate: '2022-03-01',
      expiryDate: '2027-03-01',
      daysUntilExpiry: 1000,
      certificationBody: 'REFCOM',
      lastVerified: new Date().toISOString(),
      verificationStatus: 'verified',
    };
  }

  // ----------------------------------------
  // INSURANCE
  // ----------------------------------------

  async getInsuranceStatus(policies: UKInsurance[]): Promise<{
    valid: UKInsurance[];
    expiringSoon: UKInsurance[];
    expired: UKInsurance[];
    hasEmployersLiability: boolean;
    hasPublicLiability: boolean;
  }> {
    const now = new Date();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    const valid: UKInsurance[] = [];
    const expiringSoon: UKInsurance[] = [];
    const expired: UKInsurance[] = [];

    for (const policy of policies) {
      const expiryDate = new Date(policy.endDate);
      const daysUntil = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      policy.daysUntilExpiry = daysUntil;

      if (daysUntil < 0) {
        policy.status = 'expired';
        expired.push(policy);
      } else if (daysUntil < 30) {
        policy.status = 'expiring-soon';
        expiringSoon.push(policy);
      } else {
        policy.status = 'active';
        valid.push(policy);
      }
    }

    return {
      valid,
      expiringSoon,
      expired,
      hasEmployersLiability: [...valid, ...expiringSoon].some(p => p.type === 'employers-liability'),
      hasPublicLiability: [...valid, ...expiringSoon].some(p => p.type === 'public-liability'),
    };
  }

  // ----------------------------------------
  // COMPLIANCE GATES
  // ----------------------------------------

  async checkComplianceGate(
    workType: keyof typeof UK_COMPLIANCE_GATES,
    certifications: {
      gasSafe?: GasSafeRegistration;
      partP?: PartPRegistration;
      cscs?: CSCSCard;
      oftec?: OFTECRegistration;
      fgas?: FGasRegistration;
      insurance?: UKInsurance[];
    }
  ): Promise<UKComplianceGate> {
    const requirements = UK_COMPLIANCE_GATES[workType] || [];
    const checkedRequirements: UKComplianceRequirement[] = [];
    const blockedReasons: string[] = [];

    for (const req of requirements) {
      const checked = { ...req };

      switch (req.type) {
        case 'gas-safe':
          if (certifications.gasSafe?.status === 'valid') {
            checked.currentStatus = 'valid';
          } else if (certifications.gasSafe) {
            checked.currentStatus = 'expired';
            blockedReasons.push('Gas Safe registration is expired');
          } else {
            checked.currentStatus = 'missing';
            blockedReasons.push('Gas Safe registration required');
          }
          break;

        case 'part-p':
          if (certifications.partP?.status === 'valid') {
            checked.currentStatus = 'valid';
          } else if (certifications.partP) {
            checked.currentStatus = 'expired';
            blockedReasons.push('Part P registration is expired');
          } else {
            checked.currentStatus = 'missing';
            blockedReasons.push('Part P registration required');
          }
          break;

        case 'cscs':
          if (certifications.cscs?.status === 'valid') {
            checked.currentStatus = 'valid';
          } else if (certifications.cscs) {
            checked.currentStatus = 'expired';
            blockedReasons.push('CSCS card is expired');
          } else {
            checked.currentStatus = 'missing';
            blockedReasons.push('CSCS card required');
          }
          break;

        case 'oftec':
          if (certifications.oftec?.status === 'valid') {
            checked.currentStatus = 'valid';
          } else if (certifications.oftec) {
            checked.currentStatus = 'expired';
            blockedReasons.push('OFTEC registration is expired');
          } else {
            checked.currentStatus = 'missing';
            blockedReasons.push('OFTEC registration required');
          }
          break;

        case 'fgas':
          if (certifications.fgas?.status === 'valid') {
            checked.currentStatus = 'valid';
          } else if (certifications.fgas) {
            checked.currentStatus = 'expired';
            blockedReasons.push('F-Gas certification is expired');
          } else {
            checked.currentStatus = 'missing';
            blockedReasons.push('F-Gas certification required');
          }
          break;

        case 'insurance':
          const hasValidPL = certifications.insurance?.some(
            i => i.type === 'public-liability' && i.status === 'active'
          );
          if (hasValidPL) {
            checked.currentStatus = 'valid';
          } else if (certifications.insurance?.some(i => i.type === 'public-liability')) {
            checked.currentStatus = 'expired';
            blockedReasons.push('Public liability insurance is expired');
          } else {
            checked.currentStatus = 'missing';
            blockedReasons.push('Public liability insurance required');
          }
          break;
      }

      checkedRequirements.push(checked);
    }

    const passedAll = checkedRequirements.every(
      r => !r.required || r.currentStatus === 'valid'
    );

    return {
      gateId: `gate-${workType}-${Date.now()}`,
      tradeType: workType,
      workType,
      requirements: checkedRequirements,
      passedAll,
      blockedReasons,
    };
  }

  // ----------------------------------------
  // COMPLIANCE DASHBOARD
  // ----------------------------------------

  async getComplianceDashboard(
    companiesHouse?: CompaniesHouseRegistration,
    vat?: UKVATRegistration,
    cis?: CISRegistration,
    gasSafe?: GasSafeRegistration,
    partP?: PartPRegistration,
    cscs?: CSCSCard,
    oftec?: OFTECRegistration,
    fgas?: FGasRegistration,
    insurance?: UKInsurance[]
  ): Promise<UKComplianceDashboard> {
    const alerts: UKComplianceAlert[] = [];
    const upcomingDeadlines: UKComplianceDeadline[] = [];
    let score = 100;

    // Companies House status
    let companiesHouseStatus: UKComplianceDashboard['companiesHouseStatus'] = 'not-applicable';
    if (companiesHouse) {
      const chAlerts = await this.getCompaniesHouseAlerts(companiesHouse);
      companiesHouseStatus = chAlerts.some(a => a.severity === 'critical')
        ? 'filings-overdue'
        : companiesHouse.verificationStatus === 'verified'
        ? 'verified'
        : 'needs-verification';

      if (companiesHouseStatus === 'filings-overdue') score -= 15;

      for (const alert of chAlerts) {
        alerts.push({
          id: `ch-${Date.now()}-${Math.random()}`,
          severity: alert.severity,
          category: 'companies-house',
          title: alert.type.replace(/-/g, ' '),
          message: alert.message,
          actionRequired: alert.severity !== 'info',
          dueDate: alert.deadline,
          createdAt: alert.detectedAt,
        });
      }
    }

    // VAT status
    let vatStatus: UKComplianceDashboard['vatStatus'] = 'not-registered';
    if (vat) {
      const vatPeriod = this.getNextVATPeriod(vat);
      vatStatus = vatPeriod.status === 'overdue' ? 'overdue' : 'up-to-date';

      if (vatStatus === 'overdue') {
        score -= 20;
        alerts.push({
          id: `vat-overdue-${Date.now()}`,
          severity: 'critical',
          category: 'vat',
          title: 'VAT Return Overdue',
          message: `VAT return for period ending ${vatPeriod.periodEnd} is overdue`,
          actionRequired: true,
          dueDate: vatPeriod.filingDeadline,
          createdAt: new Date().toISOString(),
        });
      }

      upcomingDeadlines.push({
        id: `vat-deadline-${Date.now()}`,
        type: 'vat-return',
        title: `VAT Return Q${Math.floor(new Date(vatPeriod.periodEnd).getMonth() / 3) + 1}`,
        deadline: vatPeriod.filingDeadline,
        daysUntil: Math.ceil((new Date(vatPeriod.filingDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        status: vatPeriod.status === 'overdue' ? 'overdue' : 'upcoming',
      });
    }

    // CIS status
    let cisStatus: UKComplianceDashboard['cisStatus'] = 'not-applicable';
    if (cis?.isContractor) {
      const cisDeadline = new Date();
      cisDeadline.setDate(19);
      if (cisDeadline < new Date()) {
        cisDeadline.setMonth(cisDeadline.getMonth() + 1);
      }
      cisStatus = 'up-to-date';

      upcomingDeadlines.push({
        id: `cis-deadline-${Date.now()}`,
        type: 'cis-return',
        title: 'CIS Monthly Return',
        deadline: localDateKey(cisDeadline),
        daysUntil: Math.ceil((cisDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        status: 'upcoming',
      });
    }

    // Trade certifications
    const checkCert = (
      cert: { status: string; daysUntilExpiry: number; expiryDate: string } | undefined,
      category: UKComplianceAlert['category'],
      name: string
    ): 'valid' | 'expiring-soon' | 'expired' | 'not-applicable' => {
      if (!cert) return 'not-applicable';

      if (cert.status === 'expired' || cert.daysUntilExpiry <= 0) {
        score -= 10;
        alerts.push({
          id: `${category}-expired-${Date.now()}`,
          severity: 'critical',
          category,
          title: `${name} Expired`,
          message: `Your ${name} has expired and must be renewed immediately`,
          actionRequired: true,
          createdAt: new Date().toISOString(),
        });
        return 'expired';
      }

      if (cert.daysUntilExpiry <= 30) {
        score -= 5;
        alerts.push({
          id: `${category}-expiring-${Date.now()}`,
          severity: 'warning',
          category,
          title: `${name} Expiring Soon`,
          message: `Your ${name} expires in ${cert.daysUntilExpiry} days`,
          actionRequired: true,
          dueDate: cert.expiryDate,
          createdAt: new Date().toISOString(),
        });

        upcomingDeadlines.push({
          id: `${category}-renewal-${Date.now()}`,
          type: 'certification-renewal',
          title: `${name} Renewal`,
          deadline: cert.expiryDate,
          daysUntil: cert.daysUntilExpiry,
          status: 'due-soon',
        });
        return 'expiring-soon';
      }

      return 'valid';
    };

    const gasSafeStatus = checkCert(gasSafe, 'gas-safe', 'Gas Safe Registration');
    const partPStatus = checkCert(partP ? { status: partP.status, daysUntilExpiry: partP.daysUntilRenewal, expiryDate: partP.currentPeriodEnd } : undefined, 'part-p', 'Part P Registration');
    const cscsStatus = checkCert(cscs, 'cscs', 'CSCS Card');
    const oftecStatus = checkCert(oftec, 'oftec', 'OFTEC Registration');
    const fgasStatus = checkCert(fgas, 'fgas', 'F-Gas Certification');

    // Insurance
    const insuranceStatus = insurance
      ? await this.getInsuranceStatus(insurance)
      : { valid: [], expiringSoon: [], expired: [], hasEmployersLiability: false, hasPublicLiability: false };

    if (insuranceStatus.expired.length > 0) {
      score -= insuranceStatus.expired.length * 10;
    }
    if (!insuranceStatus.hasPublicLiability) {
      score -= 15;
      alerts.push({
        id: `insurance-pl-missing-${Date.now()}`,
        severity: 'critical',
        category: 'insurance',
        title: 'Public Liability Insurance Missing',
        message: 'You must have valid public liability insurance to work',
        actionRequired: true,
        createdAt: new Date().toISOString(),
      });
    }

    // Overall status
    const status: UKComplianceDashboard['status'] =
      score < 50 ? 'critical' :
      score < 80 ? 'action-required' :
      'compliant';

    return {
      overallScore: Math.max(0, score),
      status,
      companiesHouseStatus,
      companiesHouseLastVerified: companiesHouse?.lastVerified,
      nextFilingDue: companiesHouse?.nextAccountsDue,
      vatStatus,
      nextVatDeadline: vat ? this.getNextVATPeriod(vat).filingDeadline : undefined,
      cisStatus,
      gasSafeStatus,
      partPStatus,
      cscsStatus,
      oftecStatus,
      fgasStatus,
      insuranceValid: insuranceStatus.valid.length,
      insuranceExpiringSoon: insuranceStatus.expiringSoon.length,
      insuranceExpired: insuranceStatus.expired.length,
      employersLiabilityValid: insuranceStatus.hasEmployersLiability,
      alerts,
      upcomingDeadlines: upcomingDeadlines.sort((a, b) => a.daysUntil - b.daysUntil),
    };
  }

  // ----------------------------------------
  // INVOICE COMPLIANCE CHECK
  // ----------------------------------------

  checkInvoiceCompliance(invoice: {
    invoiceNumber?: string;
    invoiceDate?: string;
    supplyDate?: string;
    sellerName?: string;
    sellerAddress?: string;
    sellerVat?: string;
    buyerName?: string;
    buyerAddress?: string;
    buyerVat?: string;
    lineItems?: { description: string; quantity: number; unitPrice: number; vatRate: number }[];
    totalExclVat?: number;
    vatAmount?: number;
    totalInclVat?: number;
    isReverseCharge?: boolean;
    reverseChargeStatement?: string;
  }): UKInvoiceComplianceCheck {
    const issues: UKInvoiceComplianceIssue[] = [];

    for (const req of UK_VAT_INVOICE_REQUIREMENTS) {
      const value = invoice[req.field as keyof typeof invoice];

      if (req.required && (value === undefined || value === null || value === '')) {
        issues.push({
          field: req.field,
          issue: 'missing',
          message: `${req.description} is required`,
          severity: 'error',
          legalReference: 'VAT Regulations 1995, Regulation 14',
        });
      }
    }

    // Check reverse charge statement
    if (invoice.isReverseCharge && !invoice.reverseChargeStatement?.includes('Reverse Charge')) {
      issues.push({
        field: 'reverseChargeStatement',
        issue: 'missing',
        message: 'Domestic Reverse Charge statement required',
        severity: 'error',
        legalReference: 'VAT Notice 735',
      });
    }

    // Check VAT number format
    if (invoice.sellerVat && !invoice.sellerVat.match(/^GB\d{9}$/)) {
      issues.push({
        field: 'sellerVat',
        issue: 'format-error',
        message: 'VAT number should be in format GB123456789',
        severity: 'warning',
      });
    }

    return {
      invoiceId: invoice.invoiceNumber || 'unknown',
      isCompliant: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      checkedAt: new Date().toISOString(),
    };
  }

  // ----------------------------------------
  // HELPERS
  // ----------------------------------------

  private async simulateApiDelay(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 100));
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const ukComplianceService = new UKComplianceService();

// ============================================
// REACT HOOKS
// ============================================

export function useUKComplianceDashboard(
  companiesHouse?: CompaniesHouseRegistration,
  vat?: UKVATRegistration,
  cis?: CISRegistration,
  gasSafe?: GasSafeRegistration,
  partP?: PartPRegistration,
  cscs?: CSCSCard,
  oftec?: OFTECRegistration,
  fgas?: FGasRegistration,
  insurance?: UKInsurance[]
) {
  const [dashboard, setDashboard] = useState<UKComplianceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await ukComplianceService.getComplianceDashboard(
        companiesHouse, vat, cis, gasSafe, partP, cscs, oftec, fgas, insurance
      );
      setDashboard(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load compliance dashboard'));
    } finally {
      setLoading(false);
    }
  }, [companiesHouse, vat, cis, gasSafe, partP, cscs, oftec, fgas, insurance]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { dashboard, loading, error, refresh };
}

export function useGasSafeVerification(registrationNumber?: string) {
  const [registration, setRegistration] = useState<GasSafeRegistration | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const verify = useCallback(async (regNumber: string) => {
    setLoading(true);
    try {
      const result = await ukComplianceService.verifyGasSafe(regNumber);
      setRegistration(result);
      setError(null);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to verify Gas Safe registration'));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (registrationNumber) {
      verify(registrationNumber);
    }
  }, [registrationNumber, verify]);

  return { registration, loading, error, verify };
}

export function useComplianceGate(
  workType: keyof typeof UK_COMPLIANCE_GATES,
  certifications: Parameters<typeof ukComplianceService.checkComplianceGate>[1]
) {
  const [gate, setGate] = useState<UKComplianceGate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const check = useCallback(async () => {
    setLoading(true);
    try {
      const result = await ukComplianceService.checkComplianceGate(workType, certifications);
      setGate(result);
      setError(null);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to check compliance gate'));
      return null;
    } finally {
      setLoading(false);
    }
  }, [workType, certifications]);

  useEffect(() => {
    check();
  }, [check]);

  return { gate, loading, error, check };
}

export function useVATReturn(registration?: UKVATRegistration) {
  const [currentPeriod, setCurrentPeriod] = useState<UKVATPeriod | null>(null);

  useEffect(() => {
    if (registration) {
      setCurrentPeriod(ukComplianceService.getNextVATPeriod(registration));
    }
  }, [registration]);

  const calculateReturn = useCallback(
    (
      sales: { amount: number; rate: 0 | 5 | 20 }[],
      purchases: { amount: number; vatAmount: number }[],
      reverseCharge?: { outputs: number; inputs: number }
    ) => {
      return ukComplianceService.calculateVATReturn(sales, purchases, reverseCharge);
    },
    []
  );

  const generateReturn = useCallback(
    async (calculation: UKVATCalculation) => {
      if (!currentPeriod) return null;
      return ukComplianceService.generateVATReturn(currentPeriod, calculation);
    },
    [currentPeriod]
  );

  return { currentPeriod, calculateReturn, generateReturn };
}
