// =============================================================================
// COMPLIANCE SERVICE
// =============================================================================
// Compliance and regulatory management for Dutch contractors
// =============================================================================

import { localDateKey } from '../utils/dateKey';
import { trackUserAction } from '../intelligence/intelligenceEngine';
import { complianceKnowledgeBase } from '../data/complianceKnowledgeBase';
import { registerSingletonReset } from './singletonReset';
import type {
  CountryCode,
  LanguageCode,
  TradeCompliance,
  RegistryCheck,
} from '../domain/complianceKnowledge';

const COUNTRY_LANGUAGE: Record<CountryCode, LanguageCode> = {
  UK: 'en', NL: 'nl', DE: 'de', FR: 'fr', ES: 'es', IT: 'it',
};

// =============================================================================
// TYPES
// =============================================================================

export interface License {
  id: string;
  name: string;
  type: LicenseType;
  licenseNumber: string;
  issuingAuthority: string;
  issueDate: Date;
  expiryDate: Date;
  status: 'valid' | 'expiring_soon' | 'expired' | 'pending_renewal';
  renewalCost?: number;
  documentUrl?: string;
  notes?: string;
  requiredFor: string[];
  autoRenew: boolean;
}

export type LicenseType =
  | 'business'
  | 'trade'
  | 'environmental'
  | 'safety'
  | 'insurance'
  | 'professional';

export interface Certification {
  id: string;
  name: string;
  category: CertificationCategory;
  holderId: string;
  holderName: string;
  holderType: 'company' | 'employee';
  certificationNumber: string;
  issuingBody: string;
  issueDate: Date;
  expiryDate: Date;
  status: 'valid' | 'expiring_soon' | 'expired' | 'suspended';
  renewalRequirements?: string;
  trainingHoursRequired?: number;
  documentUrl?: string;
}

export type CertificationCategory =
  | 'technical'
  | 'safety'
  | 'environmental'
  | 'quality'
  | 'industry_specific';

export interface SafetyChecklist {
  id: string;
  name: string;
  jobType: string;
  items: SafetyChecklistItem[];
  version: string;
  lastUpdated: Date;
  mandatoryForJobs: boolean;
  completionRequired: boolean;
}

export interface SafetyChecklistItem {
  id: string;
  description: string;
  category: 'ppe' | 'equipment' | 'environment' | 'procedure' | 'documentation';
  required: boolean;
  helpText?: string;
}

export interface SafetyChecklistCompletion {
  id: string;
  checklistId: string;
  checklistName: string;
  jobId: string;
  jobName: string;
  completedBy: string;
  completedByName: string;
  completedAt: Date;
  itemStatuses: { itemId: string; checked: boolean; notes?: string }[];
  signature?: string;
  location?: { latitude: number; longitude: number };
  allItemsChecked: boolean;
}

export interface RegulatoryUpdate {
  id: string;
  title: string;
  category: 'legislation' | 'standard' | 'guideline' | 'industry_news';
  source: string;
  publishDate: Date;
  effectiveDate?: Date;
  summary: string;
  fullContent?: string;
  affectedAreas: string[];
  actionRequired: boolean;
  actionDescription?: string;
  actionDeadline?: Date;
  read: boolean;
  bookmarked: boolean;
  url?: string;
}

export interface InsurancePolicy {
  id: string;
  type: InsuranceType;
  name: string;
  provider: string;
  policyNumber: string;
  coverage: number;
  deductible: number;
  premium: number;
  premiumFrequency: 'monthly' | 'quarterly' | 'yearly';
  startDate: Date;
  endDate: Date;
  status: 'active' | 'expiring_soon' | 'expired' | 'cancelled';
  autoRenew: boolean;
  contactPerson?: string;
  contactPhone?: string;
  documentUrl?: string;
}

export type InsuranceType =
  | 'liability'
  | 'professional'
  | 'vehicle'
  | 'equipment'
  | 'workers_comp'
  | 'property';

export interface AuditRecord {
  id: string;
  type: 'internal' | 'external' | 'certification';
  name: string;
  date: Date;
  auditor: string;
  scope: string[];
  findings: AuditFinding[];
  overallResult: 'pass' | 'pass_with_observations' | 'fail';
  nextAuditDate?: Date;
  documentUrl?: string;
}

export interface AuditFinding {
  id: string;
  severity: 'critical' | 'major' | 'minor' | 'observation';
  description: string;
  area: string;
  correctiveAction?: string;
  deadline?: Date;
  status: 'open' | 'in_progress' | 'closed';
}

export interface ComplianceAlert {
  id: string;
  type: 'license_expiry' | 'certification_expiry' | 'insurance_expiry' | 'audit_due' | 'regulation_change' | 'action_required';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  relatedItemId?: string;
  relatedItemType?: string;
  dueDate?: Date;
  createdAt: Date;
  acknowledged: boolean;
  resolvedAt?: Date;
}

export interface ComplianceStats {
  totalLicenses: number;
  validLicenses: number;
  expiringLicenses: number;
  expiredLicenses: number;
  totalCertifications: number;
  validCertifications: number;
  expiringCertifications: number;
  totalInsurancePolicies: number;
  activeInsurance: number;
  unreadRegulatory: number;
  openFindings: number;
  complianceScore: number;
}

// =============================================================================
// MOCK DATA
// =============================================================================

const mockLicenses: License[] = [
  {
    id: 'lic-1',
    name: 'KvK Inschrijving',
    type: 'business',
    licenseNumber: '12345678',
    issuingAuthority: 'Kamer van Koophandel',
    issueDate: new Date('2018-01-15'),
    expiryDate: new Date('2099-12-31'),
    status: 'valid',
    documentUrl: undefined,
    notes: 'Onbeperkt geldig',
    requiredFor: ['Alle zakelijke activiteiten'],
    autoRenew: false,
  },
  {
    id: 'lic-2',
    name: 'Erkend Installateur Gas',
    type: 'trade',
    licenseNumber: 'GAS-2023-5678',
    issuingAuthority: 'Kiwa',
    issueDate: new Date('2023-06-01'),
    expiryDate: new Date('2024-06-01'),
    status: 'expiring_soon',
    renewalCost: 450,
    requiredFor: ['Gasinstallaties', 'CV-ketels'],
    autoRenew: true,
  },
  {
    id: 'lic-3',
    name: 'STEK F-gassen Certificaat',
    type: 'environmental',
    licenseNumber: 'STEK-2022-9012',
    issuingAuthority: 'STEK',
    issueDate: new Date('2022-03-15'),
    expiryDate: new Date('2027-03-15'),
    status: 'valid',
    renewalCost: 350,
    requiredFor: ['Airconditioning', 'Warmtepompen'],
    autoRenew: true,
  },
  {
    id: 'lic-4',
    name: 'VCA** Certificaat',
    type: 'safety',
    licenseNumber: 'VCA-2023-3456',
    issuingAuthority: 'SSVV',
    issueDate: new Date('2023-01-10'),
    expiryDate: new Date('2026-01-10'),
    status: 'valid',
    renewalCost: 1200,
    requiredFor: ['Alle werkzaamheden op locatie'],
    autoRenew: true,
  },
];

const mockCertifications: Certification[] = [
  {
    id: 'cert-1',
    name: 'VCA Basis',
    category: 'safety',
    holderId: 'tm-1',
    holderName: 'Jan de Vries',
    holderType: 'employee',
    certificationNumber: 'VCA-2022-67890',
    issuingBody: 'SSVV',
    issueDate: new Date('2022-02-01'),
    expiryDate: new Date('2032-02-01'),
    status: 'valid',
  },
  {
    id: 'cert-2',
    name: 'F-gassen Categorie I',
    category: 'environmental',
    holderId: 'tm-1',
    holderName: 'Jan de Vries',
    holderType: 'employee',
    certificationNumber: 'FGAS-2021-12345',
    issuingBody: 'STEK',
    issueDate: new Date('2021-05-10'),
    expiryDate: new Date('2026-05-10'),
    status: 'valid',
    trainingHoursRequired: 8,
  },
  {
    id: 'cert-3',
    name: 'VCA Basis',
    category: 'safety',
    holderId: 'tm-2',
    holderName: 'Pieter Bakker',
    holderType: 'employee',
    certificationNumber: 'VCA-2021-11111',
    issuingBody: 'SSVV',
    issueDate: new Date('2021-08-15'),
    expiryDate: new Date('2031-08-15'),
    status: 'valid',
  },
  {
    id: 'cert-4',
    name: 'EHBO Diploma',
    category: 'safety',
    holderId: 'tm-1',
    holderName: 'Jan de Vries',
    holderType: 'employee',
    certificationNumber: 'EHBO-2022-5555',
    issuingBody: 'Het Rode Kruis',
    issueDate: new Date('2022-09-01'),
    expiryDate: new Date('2024-09-01'),
    status: 'expiring_soon',
    renewalRequirements: 'Herhalingscursus 4 uur',
  },
];

const mockSafetyChecklists: SafetyChecklist[] = [
  {
    id: 'sc-1',
    name: 'Werkplek Veiligheid - CV Installatie',
    jobType: 'cv_installation',
    items: [
      { id: 'sci-1', description: 'Veiligheidsschoenen gedragen', category: 'ppe', required: true },
      { id: 'sci-2', description: 'Werkhandschoenen beschikbaar', category: 'ppe', required: true },
      { id: 'sci-3', description: 'Veiligheidsbril bij nodig', category: 'ppe', required: false },
      { id: 'sci-4', description: 'Gasdetector gecontroleerd en werkend', category: 'equipment', required: true },
      { id: 'sci-5', description: 'Brandblusser binnen bereik', category: 'equipment', required: true },
      { id: 'sci-6', description: 'Werkgebied afgezet/afgeschermd', category: 'environment', required: true },
      { id: 'sci-7', description: 'Ventilatie aanwezig', category: 'environment', required: true },
      { id: 'sci-8', description: 'Klant geïnformeerd over werkzaamheden', category: 'procedure', required: true },
      { id: 'sci-9', description: 'Nooduitgang bekend', category: 'procedure', required: true },
      { id: 'sci-10', description: 'Werkvergunning indien van toepassing', category: 'documentation', required: false },
    ],
    version: '2.1',
    lastUpdated: new Date('2024-01-01'),
    mandatoryForJobs: true,
    completionRequired: true,
  },
  {
    id: 'sc-2',
    name: 'Hoogte Werkzaamheden',
    jobType: 'height_work',
    items: [
      { id: 'sci-11', description: 'Valbeveiliging gecontroleerd', category: 'ppe', required: true },
      { id: 'sci-12', description: 'Ladder/steiger geïnspecteerd', category: 'equipment', required: true },
      { id: 'sci-13', description: 'Weerscondities gecontroleerd', category: 'environment', required: true },
      { id: 'sci-14', description: 'Werkgebied onder afgezet', category: 'environment', required: true },
      { id: 'sci-15', description: 'Tweede persoon aanwezig bij > 2.5m', category: 'procedure', required: true },
    ],
    version: '1.3',
    lastUpdated: new Date('2023-11-15'),
    mandatoryForJobs: true,
    completionRequired: true,
  },
];

const mockRegulatoryUpdates: RegulatoryUpdate[] = [
  {
    id: 'ru-1',
    title: 'Nieuwe F-gassen verordening 2024',
    category: 'legislation',
    source: 'Rijksoverheid',
    publishDate: new Date('2024-01-15'),
    effectiveDate: new Date('2024-07-01'),
    summary: 'Aangescherpte regels voor het gebruik van F-gassen in koelinstallaties. Lagere GWP-limieten en nieuwe rapportageverplichtingen.',
    affectedAreas: ['Airconditioning', 'Warmtepompen', 'Koeling'],
    actionRequired: true,
    actionDescription: 'Controleer huidige installaties op compliance en plan eventuele vervangingen',
    actionDeadline: new Date('2024-06-15'),
    read: false,
    bookmarked: true,
  },
  {
    id: 'ru-2',
    title: 'Update NEN 1010 Elektrische Installaties',
    category: 'standard',
    source: 'NEN',
    publishDate: new Date('2024-01-10'),
    summary: 'Nieuwe editie van NEN 1010 met aanpassingen voor laadpalen en zonnepanelen.',
    affectedAreas: ['Elektrische installaties', 'Laadpalen', 'Zonnepanelen'],
    actionRequired: false,
    read: true,
    bookmarked: false,
  },
  {
    id: 'ru-3',
    title: 'Subsidieregeling ISDE 2024',
    category: 'guideline',
    source: 'RVO',
    publishDate: new Date('2024-01-05'),
    summary: 'Nieuwe subsidiebedragen voor warmtepompen en zonneboilers. Verhoogde bedragen voor hybride systemen.',
    affectedAreas: ['Warmtepompen', 'Zonneboilers', 'Hybride systemen'],
    actionRequired: false,
    read: false,
    bookmarked: false,
  },
];

const mockInsurancePolicies: InsurancePolicy[] = [
  {
    id: 'ins-1',
    type: 'liability',
    name: 'Bedrijfsaansprakelijkheid',
    provider: 'Interpolis',
    policyNumber: 'AVB-2023-12345',
    coverage: 2500000,
    deductible: 500,
    premium: 185,
    premiumFrequency: 'monthly',
    startDate: new Date('2023-01-01'),
    endDate: new Date('2024-12-31'),
    status: 'active',
    autoRenew: true,
  },
  {
    id: 'ins-2',
    type: 'professional',
    name: 'Beroepsaansprakelijkheid',
    provider: 'Interpolis',
    policyNumber: 'BAV-2023-67890',
    coverage: 500000,
    deductible: 1000,
    premium: 95,
    premiumFrequency: 'monthly',
    startDate: new Date('2023-01-01'),
    endDate: new Date('2024-12-31'),
    status: 'active',
    autoRenew: true,
  },
  {
    id: 'ins-3',
    type: 'vehicle',
    name: 'Bedrijfsauto WA + Casco',
    provider: 'Univé',
    policyNumber: 'AUTO-2023-11111',
    coverage: 100000,
    deductible: 250,
    premium: 125,
    premiumFrequency: 'monthly',
    startDate: new Date('2023-06-01'),
    endDate: new Date('2024-05-31'),
    status: 'expiring_soon',
    autoRenew: true,
  },
];

const mockAlerts: ComplianceAlert[] = [
  {
    id: 'ca-1',
    type: 'license_expiry',
    severity: 'high',
    title: 'Erkend Installateur Gas verloopt binnenkort',
    description: 'Uw gas-erkenning verloopt op 1 juni 2024. Start de verlengingsprocedure.',
    relatedItemId: 'lic-2',
    relatedItemType: 'license',
    dueDate: new Date('2024-06-01'),
    createdAt: new Date(),
    acknowledged: false,
  },
  {
    id: 'ca-2',
    type: 'certification_expiry',
    severity: 'medium',
    title: 'EHBO certificaat Jan de Vries verloopt',
    description: 'Het EHBO diploma van Jan de Vries verloopt op 1 september 2024.',
    relatedItemId: 'cert-4',
    relatedItemType: 'certification',
    dueDate: new Date('2024-09-01'),
    createdAt: new Date(),
    acknowledged: false,
  },
  {
    id: 'ca-3',
    type: 'regulation_change',
    severity: 'medium',
    title: 'Actie vereist: F-gassen verordening',
    description: 'Controleer installaties voor nieuwe F-gassen regelgeving per 1 juli 2024.',
    relatedItemId: 'ru-1',
    relatedItemType: 'regulatory',
    dueDate: new Date('2024-06-15'),
    createdAt: new Date(),
    acknowledged: false,
  },
];

// =============================================================================
// SERVICE CLASS
// =============================================================================

type ComplianceListener = () => void;

class ComplianceService {
  private static instance: ComplianceService;
  private listeners: Set<ComplianceListener> = new Set();
  // R289: was seeded with [...mockLicenses / Certifications / Insurance / Alerts]
  // which meant complianceAgentService.scan() generated cert_renewal AI queue
  // items for a 2024-expired KvK and a VCA cert the contractor never owned.
  // Now starts empty in production; tests opt in via __seedMockData().
  private licenses: License[] = [];
  private certifications: Certification[] = [];
  private safetyChecklists: SafetyChecklist[] = [...mockSafetyChecklists];
  private checklistCompletions: SafetyChecklistCompletion[] = [];
  private regulatoryUpdates: RegulatoryUpdate[] = [];
  private insurancePolicies: InsurancePolicy[] = [];
  private alerts: ComplianceAlert[] = [];

  static getInstance(): ComplianceService {
    if (!ComplianceService.instance) {
      ComplianceService.instance = new ComplianceService();
      registerSingletonReset(() => {
        const inst = ComplianceService.instance;
        inst.licenses = [];
        inst.certifications = [];
        inst.safetyChecklists = [...mockSafetyChecklists];
        inst.checklistCompletions = [];
        inst.regulatoryUpdates = [];
        inst.insurancePolicies = [];
        inst.alerts = [];
        inst.listeners.forEach((l) => l());
      });
    }
    return ComplianceService.instance;
  }

  /** Test-only seed for the mock fixtures. Production must NEVER call this. */
  __seedMockData(): void {
    this.licenses = [...mockLicenses];
    this.certifications = [...mockCertifications];
    this.regulatoryUpdates = [...mockRegulatoryUpdates];
    this.insurancePolicies = [...mockInsurancePolicies];
    this.alerts = [...mockAlerts];
    this.notify();
  }

  subscribe(listener: ComplianceListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(listener => listener());
  }

  // Licenses
  getLicenses(): License[] {
    return this.licenses;
  }

  getLicense(id: string): License | undefined {
    return this.licenses.find(l => l.id === id);
  }

  addLicense(license: Omit<License, 'id'>): License {
    const newLicense: License = {
      ...license,
      id: `lic-${Date.now()}`,
    };
    this.licenses.push(newLicense);

    trackUserAction('license_added', {
      type: license.type,
      name: license.name,
    });

    this.notify();
    return newLicense;
  }

  updateLicense(id: string, updates: Partial<License>): License | undefined {
    const index = this.licenses.findIndex(l => l.id === id);
    if (index >= 0) {
      this.licenses[index] = { ...this.licenses[index], ...updates };
      this.notify();
      return this.licenses[index];
    }
    return undefined;
  }

  // Certifications
  getCertifications(holderId?: string): Certification[] {
    if (holderId) {
      return this.certifications.filter(c => c.holderId === holderId);
    }
    return this.certifications;
  }

  addCertification(cert: Omit<Certification, 'id'>): Certification {
    const newCert: Certification = {
      ...cert,
      id: `cert-${Date.now()}`,
    };
    this.certifications.push(newCert);

    trackUserAction('certification_added', {
      category: cert.category,
      name: cert.name,
      holderType: cert.holderType,
    });

    this.notify();
    return newCert;
  }

  // Safety Checklists
  getSafetyChecklists(jobType?: string): SafetyChecklist[] {
    if (jobType) {
      return this.safetyChecklists.filter(c => c.jobType === jobType);
    }
    return this.safetyChecklists;
  }

  completeChecklist(
    checklistId: string,
    jobId: string,
    jobName: string,
    completedBy: string,
    completedByName: string,
    itemStatuses: { itemId: string; checked: boolean; notes?: string }[]
  ): SafetyChecklistCompletion {
    const checklist = this.safetyChecklists.find(c => c.id === checklistId);
    const allChecked = itemStatuses.every(s => s.checked);

    const completion: SafetyChecklistCompletion = {
      id: `scc-${Date.now()}`,
      checklistId,
      checklistName: checklist?.name || 'Onbekend',
      jobId,
      jobName,
      completedBy,
      completedByName,
      completedAt: new Date(),
      itemStatuses,
      allItemsChecked: allChecked,
    };

    this.checklistCompletions.push(completion);

    trackUserAction('safety_checklist_completed', {
      checklistId,
      jobId,
      allItemsChecked: allChecked,
    });

    this.notify();
    return completion;
  }

  getChecklistCompletions(jobId?: string): SafetyChecklistCompletion[] {
    if (jobId) {
      return this.checklistCompletions.filter(c => c.jobId === jobId);
    }
    return this.checklistCompletions;
  }

  // Regulatory Updates
  getRegulatoryUpdates(unreadOnly?: boolean): RegulatoryUpdate[] {
    if (unreadOnly) {
      return this.regulatoryUpdates.filter(u => !u.read);
    }
    return this.regulatoryUpdates;
  }

  markUpdateRead(id: string): void {
    const update = this.regulatoryUpdates.find(u => u.id === id);
    if (update) {
      update.read = true;

      trackUserAction('regulatory_update_read', { updateId: id });

      this.notify();
    }
  }

  toggleUpdateBookmark(id: string): void {
    const update = this.regulatoryUpdates.find(u => u.id === id);
    if (update) {
      update.bookmarked = !update.bookmarked;
      this.notify();
    }
  }

  // Insurance
  getInsurancePolicies(): InsurancePolicy[] {
    return this.insurancePolicies;
  }

  addInsurancePolicy(policy: Omit<InsurancePolicy, 'id'>): InsurancePolicy {
    const newPolicy: InsurancePolicy = {
      ...policy,
      id: `ins-${Date.now()}`,
    };
    this.insurancePolicies.push(newPolicy);

    trackUserAction('insurance_policy_added', {
      type: policy.type,
      provider: policy.provider,
    });

    this.notify();
    return newPolicy;
  }

  // Alerts
  getAlerts(): ComplianceAlert[] {
    return this.alerts.filter(a => !a.resolvedAt);
  }

  /** All alert ids including resolved — used by the compliance agent to skip
   * idempotent re-emission of the same (itemType, itemId, stage) tuple. */
  getAllAlertIds(): string[] {
    return this.alerts.map(a => a.id);
  }

  /** Upsert an alert. If id already exists this is a no-op (stage changed
   * alerts get distinct ids). Notifies subscribers on insert. */
  addAlert(alert: ComplianceAlert): void {
    if (this.alerts.some(a => a.id === alert.id)) return;
    this.alerts.push(alert);
    this.notify();
  }

  acknowledgeAlert(id: string): void {
    const alert = this.alerts.find(a => a.id === id);
    if (alert) {
      alert.acknowledged = true;
      this.notify();
    }
  }

  resolveAlert(id: string): void {
    const alert = this.alerts.find(a => a.id === id);
    if (alert) {
      alert.resolvedAt = new Date();
      this.notify();
    }
  }

  // Stats
  getStats(): ComplianceStats {
    const now = new Date();

    const validLicenses = this.licenses.filter(l => l.status === 'valid');
    const expiringLicenses = this.licenses.filter(l => l.status === 'expiring_soon');
    const expiredLicenses = this.licenses.filter(l => l.status === 'expired');

    const validCerts = this.certifications.filter(c => c.status === 'valid');
    const expiringCerts = this.certifications.filter(c => c.status === 'expiring_soon');

    const activeInsurance = this.insurancePolicies.filter(p => p.status === 'active');
    const unreadRegulatory = this.regulatoryUpdates.filter(u => !u.read);

    // Calculate compliance score (simplified)
    const totalItems = this.licenses.length + this.certifications.length + this.insurancePolicies.length;
    const validItems = validLicenses.length + validCerts.length + activeInsurance.length;
    const complianceScore = Math.round((validItems / totalItems) * 100);

    return {
      totalLicenses: this.licenses.length,
      validLicenses: validLicenses.length,
      expiringLicenses: expiringLicenses.length,
      expiredLicenses: expiredLicenses.length,
      totalCertifications: this.certifications.length,
      validCertifications: validCerts.length,
      expiringCertifications: expiringCerts.length,
      totalInsurancePolicies: this.insurancePolicies.length,
      activeInsurance: activeInsurance.length,
      unreadRegulatory: unreadRegulatory.length,
      openFindings: 0,
      complianceScore,
    };
  }

  // Knowledge Base — Trade Requirements
  getAvailableTrades(country: CountryCode): { tradeId: string; tradeLabel: string; localizedLabel?: string }[] {
    const countryData = complianceKnowledgeBase.countries.find(c => c.country === country);
    if (!countryData) return [];
    const lang = COUNTRY_LANGUAGE[country];
    return countryData.trades.map(t => ({
      tradeId: t.tradeId,
      tradeLabel: t.tradeLabel,
      localizedLabel: t.tradeLabelLocalizations?.[lang] ?? t.tradeLabelLocalizations?.en,
    }));
  }

  getTradeCompliance(country: CountryCode, tradeId: string): TradeCompliance | undefined {
    const countryData = complianceKnowledgeBase.countries.find(c => c.country === country);
    return countryData?.trades.find(t => t.tradeId === tradeId);
  }

  getRegistryChecks(country: CountryCode): RegistryCheck[] {
    const countryData = complianceKnowledgeBase.countries.find(c => c.country === country);
    return countryData?.registryChecks ?? [];
  }

  // Expiry Calendar
  getExpiryCalendar(months: number = 6): { date: Date; items: { type: string; name: string; id: string }[] }[] {
    const now = new Date();
    const endDate = new Date(now.getFullYear(), now.getMonth() + months, now.getDate());
    const calendar: Map<string, { type: string; name: string; id: string }[]> = new Map();

    // Add licenses
    this.licenses.forEach(l => {
      if (l.expiryDate >= now && l.expiryDate <= endDate) {
        const dateKey = localDateKey(l.expiryDate);
        const items = calendar.get(dateKey) || [];
        items.push({ type: 'license', name: l.name, id: l.id });
        calendar.set(dateKey, items);
      }
    });

    // Add certifications
    this.certifications.forEach(c => {
      if (c.expiryDate >= now && c.expiryDate <= endDate) {
        const dateKey = localDateKey(c.expiryDate);
        const items = calendar.get(dateKey) || [];
        items.push({ type: 'certification', name: `${c.name} (${c.holderName})`, id: c.id });
        calendar.set(dateKey, items);
      }
    });

    // Add insurance
    this.insurancePolicies.forEach(p => {
      if (p.endDate >= now && p.endDate <= endDate) {
        const dateKey = localDateKey(p.endDate);
        const items = calendar.get(dateKey) || [];
        items.push({ type: 'insurance', name: p.name, id: p.id });
        calendar.set(dateKey, items);
      }
    });

    return Array.from(calendar.entries())
      .map(([date, items]) => ({ date: new Date(date), items }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const complianceService = ComplianceService.getInstance();

// =============================================================================
// REACT HOOKS
// =============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';

export function useLicenses() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLicenses(complianceService.getLicenses());
    setLoading(false);

    return complianceService.subscribe(() => {
      setLicenses(complianceService.getLicenses());
    });
  }, []);

  const addLicense = useCallback((license: Omit<License, 'id'>) => {
    return complianceService.addLicense(license);
  }, []);

  const updateLicense = useCallback((id: string, updates: Partial<License>) => {
    return complianceService.updateLicense(id, updates);
  }, []);

  return { licenses, loading, addLicense, updateLicense };
}

export function useCertifications(holderId?: string) {
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setCertifications(complianceService.getCertifications(holderId));
    setLoading(false);

    return complianceService.subscribe(() => {
      setCertifications(complianceService.getCertifications(holderId));
    });
  }, [holderId]);

  const addCertification = useCallback((cert: Omit<Certification, 'id'>) => {
    return complianceService.addCertification(cert);
  }, []);

  return { certifications, loading, addCertification };
}

export function useSafetyChecklists(jobType?: string) {
  const [checklists, setChecklists] = useState<SafetyChecklist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setChecklists(complianceService.getSafetyChecklists(jobType));
    setLoading(false);
  }, [jobType]);

  const completeChecklist = useCallback(
    (
      checklistId: string,
      jobId: string,
      jobName: string,
      completedBy: string,
      completedByName: string,
      itemStatuses: { itemId: string; checked: boolean; notes?: string }[]
    ) => {
      return complianceService.completeChecklist(
        checklistId,
        jobId,
        jobName,
        completedBy,
        completedByName,
        itemStatuses
      );
    },
    []
  );

  return { checklists, loading, completeChecklist };
}

export function useRegulatoryUpdates(unreadOnly?: boolean) {
  const [updates, setUpdates] = useState<RegulatoryUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUpdates(complianceService.getRegulatoryUpdates(unreadOnly));
    setLoading(false);

    return complianceService.subscribe(() => {
      setUpdates(complianceService.getRegulatoryUpdates(unreadOnly));
    });
  }, [unreadOnly]);

  const markRead = useCallback((id: string) => {
    complianceService.markUpdateRead(id);
  }, []);

  const toggleBookmark = useCallback((id: string) => {
    complianceService.toggleUpdateBookmark(id);
  }, []);

  return { updates, loading, markRead, toggleBookmark };
}

export function useInsurancePolicies() {
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPolicies(complianceService.getInsurancePolicies());
    setLoading(false);

    return complianceService.subscribe(() => {
      setPolicies(complianceService.getInsurancePolicies());
    });
  }, []);

  return { policies, loading };
}

export function useComplianceAlerts() {
  const [alerts, setAlerts] = useState<ComplianceAlert[]>([]);

  useEffect(() => {
    setAlerts(complianceService.getAlerts());

    return complianceService.subscribe(() => {
      setAlerts(complianceService.getAlerts());
    });
  }, []);

  const acknowledge = useCallback((id: string) => {
    complianceService.acknowledgeAlert(id);
  }, []);

  const resolve = useCallback((id: string) => {
    complianceService.resolveAlert(id);
  }, []);

  return { alerts, acknowledge, resolve };
}

export function useComplianceStats() {
  const [stats, setStats] = useState<ComplianceStats>(complianceService.getStats());

  useEffect(() => {
    return complianceService.subscribe(() => {
      setStats(complianceService.getStats());
    });
  }, []);

  return stats;
}

export function useExpiryCalendar(months: number = 6) {
  const [calendar, setCalendar] = useState(complianceService.getExpiryCalendar(months));

  useEffect(() => {
    setCalendar(complianceService.getExpiryCalendar(months));

    return complianceService.subscribe(() => {
      setCalendar(complianceService.getExpiryCalendar(months));
    });
  }, [months]);

  return calendar;
}

export function useTradeRequirements(country: CountryCode = 'NL') {
  const trades = useMemo(
    () => complianceService.getAvailableTrades(country),
    [country],
  );

  const getTradeCompliance = useCallback(
    (tradeId: string) => complianceService.getTradeCompliance(country, tradeId),
    [country],
  );

  const registryChecks = useMemo(
    () => complianceService.getRegistryChecks(country),
    [country],
  );

  return { trades, getTradeCompliance, registryChecks };
}
