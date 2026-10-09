// =============================================================================
// COMPLIANCE SERVICE
// =============================================================================
// Compliance and regulatory management for Dutch contractors
// =============================================================================

import { localDateKey } from '../utils/dateKey';
import { trackUserAction } from '../intelligence/intelligenceEngine';
import { complianceKnowledgeBase } from '../data/complianceKnowledgeBase';
import { registerSingletonReset } from './singletonReset';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pushLibraryItem, deleteLibraryItem, syncLibraryList } from './userLibrarySync';
import { getAuthedUserId } from '../lib/currentUser';
import { MS_PER_DAY } from '../utils/timeConstants';
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

// =============================================================================
// PERSISTENCE (decision 3a, 2026-10-09)
// =============================================================================
// Certificates, insurance policies and licences were held in memory only and
// nothing could add one, so the expiry watch (complianceAgentService) watched
// an empty list. They now live on the device (offline cache) and in the
// account (`user_library`, kind 'compliance_item'), one item each.

export type TrackedItemType = 'license' | 'certification' | 'insurance';

const ITEMS_KEY = '@vasco_compliance_items';

/** Days before expiry at which an item reads "expiring soon" (= the agent's D-30). */
export const EXPIRING_SOON_DAYS = 30;

/**
 * Status follows the DATE. It used to be a stored field, so an item saved as
 * "valid" stayed valid after its expiry. An expiry date means "valid through
 * that day" — the sheet stores the END of the typed day.
 */
export function expiryStatus(expiry: Date, now: Date = new Date()): 'valid' | 'expiring_soon' | 'expired' {
  const ms = expiry.getTime() - now.getTime();
  if (!Number.isFinite(ms)) return 'valid';
  if (ms < 0) return 'expired';
  if (ms < EXPIRING_SOON_DAYS * MS_PER_DAY) return 'expiring_soon';
  return 'valid';
}

/** Statuses the contractor sets; everything else is derived from the expiry. */
const MANUAL_STATUSES = new Set(['pending_renewal', 'suspended', 'cancelled']);

type StoredItem = { id: string; itemType: TrackedItemType; updatedAt?: string } & Record<string, unknown>;

const DATE_FIELDS = ['issueDate', 'expiryDate', 'startDate', 'endDate'] as const;

function serialize(itemType: TrackedItemType, item: License | Certification | InsurancePolicy, updatedAt?: string): StoredItem {
  const out: StoredItem = { ...(item as unknown as Record<string, unknown>), id: item.id, itemType };
  for (const f of DATE_FIELDS) {
    const v = out[f];
    if (v instanceof Date) out[f] = v.toISOString();
  }
  if (updatedAt) out.updatedAt = updatedAt;
  return out;
}

function revive(stored: StoredItem): Record<string, unknown> {
  const out: Record<string, unknown> = { ...stored };
  for (const f of DATE_FIELDS) {
    if (typeof out[f] === 'string') out[f] = new Date(out[f] as string);
  }
  return out;
}

/** What the add/edit sheet hands over — the same five facts for every type. */
export interface TrackedItemInput {
  id?: string;
  type: TrackedItemType;
  name: string;
  issuer?: string;
  number?: string;
  expiryDate: Date;
}

class ComplianceService {
  private static instance: ComplianceService;
  private hydrated: Promise<void> | null = null;
  /** Bumped on every account change: a load from before it must not land. */
  private generation = 0;
  /** The account whose items have been merged into this device's copy. */
  private syncedFor: string | null = null;
  /** updatedAt per item id — the account sync keeps the newer copy. */
  private updatedAt: Map<string, string> = new Map();
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
        inst.hydrated = null;
        inst.generation += 1;
        inst.syncedFor = null;
        inst.updatedAt = new Map();
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

  // ─── Persistence ──────────────────────────────────────────────────────────

  private allStored(): StoredItem[] {
    const at = (id: string) => this.updatedAt.get(id);
    return [
      ...this.licenses.map((l) => serialize('license', l, at(l.id))),
      ...this.certifications.map((c) => serialize('certification', c, at(c.id))),
      ...this.insurancePolicies.map((p) => serialize('insurance', p, at(p.id))),
    ];
  }

  private applyStored(items: StoredItem[]): void {
    this.licenses = [];
    this.certifications = [];
    this.insurancePolicies = [];
    this.updatedAt = new Map();
    for (const it of items) {
      if (it.updatedAt) this.updatedAt.set(it.id, it.updatedAt);
      const { itemType, updatedAt: _u, ...rest } = revive(it) as StoredItem;
      if (itemType === 'license') this.licenses.push(rest as unknown as License);
      else if (itemType === 'certification') this.certifications.push(rest as unknown as Certification);
      else if (itemType === 'insurance') this.insurancePolicies.push(rest as unknown as InsurancePolicy);
    }
  }

  private async loadCache(): Promise<StoredItem[]> {
    try {
      const raw = await AsyncStorage.getItem(ITEMS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private persist(): void {
    AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(this.allStored())).catch(() => {});
  }

  /** Device copy first, then the account's (once per signed-in account). */
  async load(): Promise<void> {
    const gen = this.generation;
    if (!this.hydrated) {
      this.hydrated = (async () => {
        const cached = await this.loadCache();
        // Logout while the cache was read: these are the previous account's
        // items — applied now they would be uploaded into the next account.
        if (gen !== this.generation) return;
        // Something added before the cache answered must not be dropped.
        const added = this.allStored();
        const ids = new Set(added.map((x) => x.id));
        this.applyStored([...added, ...cached.filter((x) => !ids.has(x.id))]);
        this.notify();
      })();
    }
    await this.hydrated;
    const uid = getAuthedUserId();
    if (!uid || this.syncedFor === uid) return;
    if (gen !== this.generation) return;
    const merged = await syncLibraryList('compliance_item', async () => this.allStored());
    if (!merged || getAuthedUserId() !== uid || gen !== this.generation) return;
    this.syncedFor = uid;
    this.applyStored(merged);
    this.persist();
    this.notify();
  }

  /**
   * An edited or deleted item's alerts are FORGOTTEN, not resolved: the agent
   * skips any alert id it has seen (resolved ones included), so after fixing a
   * typo in the name the rescan queued nothing and the reminder was gone for
   * the session (review 2026-10-09).
   */
  private resolveAlertsFor(id: string): void {
    this.alerts = this.alerts.filter((a) => a.relatedItemId !== id);
  }

  private touch(itemType: TrackedItemType, item: License | Certification | InsurancePolicy): void {
    const now = new Date().toISOString();
    this.updatedAt.set(item.id, now);
    this.persist();
    void pushLibraryItem('compliance_item', item.id, serialize(itemType, item, now));
  }

  /** Status from the expiry date unless the contractor set one by hand. */
  private withStatus<T extends { status: string }>(item: T, expiry: Date, validLabel: string): T {
    if (MANUAL_STATUSES.has(item.status)) return item;
    const st = expiryStatus(expiry instanceof Date ? expiry : new Date(expiry));
    return { ...item, status: st === 'valid' ? validLabel : st };
  }

  /**
   * Add or edit a tracked item from the sheet. A changed TYPE moves the item
   * (same id) to the other list — a policy entered as a certificate by mistake
   * keeps its reminders.
   */
  saveTrackedItem(input: TrackedItemInput): { id: string; type: TrackedItemType } {
    // Time + random: a bare Date.now() gave two quick adds the SAME id, and the
    // second silently replaced the first.
    const id = input.id ?? `${input.type === 'license' ? 'lic' : input.type === 'insurance' ? 'ins' : 'cert'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const prevLicense = this.licenses.find((l) => l.id === id);
    const prevCert = this.certifications.find((c) => c.id === id);
    const prevPolicy = this.insurancePolicies.find((p) => p.id === id);
    this.licenses = this.licenses.filter((l) => l.id !== id);
    this.certifications = this.certifications.filter((c) => c.id !== id);
    this.insurancePolicies = this.insurancePolicies.filter((p) => p.id !== id);
    this.resolveAlertsFor(id);
    const issuer = input.issuer?.trim() ?? '';
    const number = input.number?.trim() ?? '';
    const now = new Date();
    if (input.type === 'license') {
      const item: License = {
        ...(prevLicense ?? { type: 'trade', issueDate: now, requiredFor: [], autoRenew: false }),
        id, name: input.name.trim(), licenseNumber: number, issuingAuthority: issuer,
        expiryDate: input.expiryDate, status: 'valid',
      } as License;
      this.licenses.push(item);
      this.touch('license', item);
    } else if (input.type === 'insurance') {
      const item: InsurancePolicy = {
        // Coverage/premium unknown = 0, which the insurance screen shows as "n/a".
        ...(prevPolicy ?? { type: 'liability', coverage: 0, deductible: 0, premium: 0, premiumFrequency: 'yearly', startDate: now, autoRenew: false }),
        id, name: input.name.trim(), provider: issuer, policyNumber: number,
        endDate: input.expiryDate, status: 'active',
      } as InsurancePolicy;
      this.insurancePolicies.push(item);
      this.touch('insurance', item);
    } else {
      const item: Certification = {
        ...(prevCert ?? { category: 'technical', holderId: 'company', holderName: '', holderType: 'company', issueDate: now }),
        id, name: input.name.trim(), certificationNumber: number, issuingBody: issuer,
        expiryDate: input.expiryDate, status: 'valid',
      } as Certification;
      this.certifications.push(item);
      this.touch('certification', item);
    }
    this.notify();
    return { id, type: input.type };
  }

  removeTrackedItem(id: string): void {
    const before = this.licenses.length + this.certifications.length + this.insurancePolicies.length;
    this.licenses = this.licenses.filter((l) => l.id !== id);
    this.certifications = this.certifications.filter((c) => c.id !== id);
    this.insurancePolicies = this.insurancePolicies.filter((p) => p.id !== id);
    if (this.licenses.length + this.certifications.length + this.insurancePolicies.length === before) return;
    this.updatedAt.delete(id);
    this.resolveAlertsFor(id);
    this.persist();
    void deleteLibraryItem('compliance_item', id);
    this.notify();
  }

  /** The item behind an id, whatever its type (for the renewal card). */
  findTrackedItem(id: string): { type: TrackedItemType; name: string; expiryDate: Date } | undefined {
    const l = this.licenses.find((x) => x.id === id);
    if (l) return { type: 'license', name: l.name, expiryDate: new Date(l.expiryDate) };
    const c = this.certifications.find((x) => x.id === id);
    if (c) return { type: 'certification', name: c.name, expiryDate: new Date(c.expiryDate) };
    const p = this.insurancePolicies.find((x) => x.id === id);
    if (p) return { type: 'insurance', name: p.name, expiryDate: new Date(p.endDate) };
    return undefined;
  }

  /** True once the device copy has been read (the card filter waits for it). */
  isLoaded(): boolean {
    return this.hydrated !== null;
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
    return this.licenses.map((l) => this.withStatus(l, l.expiryDate, 'valid'));
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
    this.touch('license', newLicense);

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
      this.touch('license', this.licenses[index]);
      this.notify();
      return this.licenses[index];
    }
    return undefined;
  }

  // Certifications
  getCertifications(holderId?: string): Certification[] {
    const all = this.certifications.map((c) => this.withStatus(c, c.expiryDate, 'valid'));
    return holderId ? all.filter(c => c.holderId === holderId) : all;
  }

  addCertification(cert: Omit<Certification, 'id'>): Certification {
    const newCert: Certification = {
      ...cert,
      id: `cert-${Date.now()}`,
    };
    this.certifications.push(newCert);
    this.touch('certification', newCert);

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
    return this.insurancePolicies.map((p) => this.withStatus(p, p.endDate, 'active'));
  }

  addInsurancePolicy(policy: Omit<InsurancePolicy, 'id'>): InsurancePolicy {
    const newPolicy: InsurancePolicy = {
      ...policy,
      id: `ins-${Date.now()}`,
    };
    this.insurancePolicies.push(newPolicy);
    this.touch('insurance', newPolicy);

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

    const licenses = this.getLicenses();
    const certifications = this.getCertifications();
    const policies = this.getInsurancePolicies();
    const validLicenses = licenses.filter(l => l.status === 'valid');
    const expiringLicenses = licenses.filter(l => l.status === 'expiring_soon');
    const expiredLicenses = licenses.filter(l => l.status === 'expired');

    const validCerts = certifications.filter(c => c.status === 'valid');
    const expiringCerts = certifications.filter(c => c.status === 'expiring_soon');

    const activeInsurance = policies.filter(p => p.status === 'active');
    const unreadRegulatory = this.regulatoryUpdates.filter(u => !u.read);

    // Calculate compliance score (simplified)
    const totalItems = this.licenses.length + this.certifications.length + this.insurancePolicies.length;
    const validItems = validLicenses.length + validCerts.length + activeInsurance.length;
    // Nothing tracked is not a score (0/0 was NaN).
    const complianceScore = totalItems > 0 ? Math.round((validItems / totalItems) * 100) : 0;

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
    complianceService.load().catch(() => {}).finally(() => setLoading(false));

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
    complianceService.load().catch(() => {}).finally(() => setLoading(false));

    return complianceService.subscribe(() => {
      setCertifications(complianceService.getCertifications(holderId));
    });
  }, [holderId]);

  const addCertification = useCallback((cert: Omit<Certification, 'id'>) => {
    return complianceService.addCertification(cert);
  }, []);

  return { certifications, loading, addCertification };
}

/**
 * After a change: the old renewal cards go, and a forced scan queues what the
 * NEW date needs (an item added 10 days before expiry warns now, not after the
 * scan's 6-hour throttle). Lazy imports — the agent and the queue import this
 * store.
 */
async function rescanAfterChange(itemId: string): Promise<void> {
  try {
    const { withdrawComplianceCards } = await import('./aiActionQueueService');
    await withdrawComplianceCards(itemId);
    const { scan } = await import('./complianceAgentService');
    await scan({ force: true });
  } catch { /* the daily scan catches up */ }
}

/** Add / edit / delete from the Compliance screen's sheet (decision 3a). */
export function useTrackedItems() {
  const save = useCallback((input: TrackedItemInput) => {
    const saved = complianceService.saveTrackedItem(input);
    void rescanAfterChange(saved.id);
    return saved;
  }, []);
  const remove = useCallback((id: string) => {
    complianceService.removeTrackedItem(id);
    void rescanAfterChange(id);
  }, []);
  return { save, remove };
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
    complianceService.load().catch(() => {}).finally(() => setLoading(false));

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
