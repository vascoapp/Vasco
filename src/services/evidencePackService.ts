// =============================================================================
// EVIDENCE PACK SERVICE
// =============================================================================
// Assembles and delivers complete handover packages for job completion
// Implements the "Evidence Pack & Handover Orchestration" feature (a16z E8)
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { trackUserAction } from '../intelligence/intelligenceEngine';
import type {
  EvidencePack,
  HandoverPackage,
  EvidenceItem,
  EvidenceType,
  ChecklistCategory,
  Job,
  Customer,
} from '../types/contractor';
import { documentVaultService, type Document } from './documentVaultService';
import { warrantyManagerService } from './warrantyManagerService';

// ============================================
// TYPES
// ============================================

export interface AssembleOptions {
  includePhotos?: boolean;
  includeWarranties?: boolean;
  includeCertificates?: boolean;
  includeChecklists?: boolean;
  includeReceipts?: boolean;
}

export interface PackValidationResult {
  isValid: boolean;
  isComplete: boolean;
  missingRequired: string[];
  warnings: string[];
  completionPercentage: number;
}

export interface ComplianceCheckResult {
  status: 'compliant' | 'partial' | 'non-compliant';
  checks: {
    id: string;
    name: string;
    required: boolean;
    passed: boolean;
    message?: string;
  }[];
  overallScore: number;
}

export interface HandoverPDFOptions {
  includePhotos?: boolean;
  includeChecklists?: boolean;
  includeWarranties?: boolean;
  includeCertificates?: boolean;
  includeFinancialSummary?: boolean;
  branding?: {
    logoUri?: string;
    primaryColor?: string;
    companyName?: string;
  };
}

export interface PortalLinkOptions {
  expiresInDays?: number;
  requiresPassword?: boolean;
  allowDownload?: boolean;
  notifyOnView?: boolean;
}

// ============================================
// DEFAULT CHECKLISTS BY TRADE
// ============================================

const DEFAULT_CHECKLISTS: Record<string, ChecklistCategory[]> = {
  default: [
    {
      id: 'work',
      name: 'Work Completion',
      items: [
        { id: 'work-1', label: 'All quoted work completed', required: true, completed: false, photoRequired: false },
        { id: 'work-2', label: 'Customer walkthrough done', required: true, completed: false, photoRequired: false },
        { id: 'work-3', label: 'Final inspection passed', required: false, completed: false, photoRequired: false },
      ],
    },
    {
      id: 'quality',
      name: 'Quality Check',
      items: [
        { id: 'quality-1', label: 'Work meets quality standards', required: true, completed: false, photoRequired: true },
        { id: 'quality-2', label: 'No visible defects', required: true, completed: false, photoRequired: false },
        { id: 'quality-3', label: 'Materials match specifications', required: false, completed: false, photoRequired: false },
      ],
    },
    {
      id: 'safety',
      name: 'Safety',
      items: [
        { id: 'safety-1', label: 'Site left safe', required: true, completed: false, photoRequired: false },
        { id: 'safety-2', label: 'All utilities functioning', required: true, completed: false, photoRequired: false },
      ],
    },
    {
      id: 'cleanup',
      name: 'Site Cleanup',
      items: [
        { id: 'cleanup-1', label: 'Work area cleaned', required: true, completed: false, photoRequired: true },
        { id: 'cleanup-2', label: 'Debris removed', required: true, completed: false, photoRequired: false },
        { id: 'cleanup-3', label: 'Tools and materials removed', required: false, completed: false, photoRequired: false },
      ],
    },
  ],
  painter: [
    {
      id: 'prep',
      name: 'Preparation',
      items: [
        { id: 'prep-1', label: 'All surfaces properly prepped', required: true, completed: false, photoRequired: false },
        { id: 'prep-2', label: 'Primer applied where needed', required: true, completed: false, photoRequired: false },
      ],
    },
    {
      id: 'finish',
      name: 'Finish Quality',
      items: [
        { id: 'finish-1', label: 'Even coat coverage', required: true, completed: false, photoRequired: true },
        { id: 'finish-2', label: 'Clean edges and lines', required: true, completed: false, photoRequired: true },
        { id: 'finish-3', label: 'No drips or runs', required: true, completed: false, photoRequired: false },
        { id: 'finish-4', label: 'Color matches specification', required: true, completed: false, photoRequired: false },
      ],
    },
  ],
  plumber: [
    {
      id: 'installation',
      name: 'Installation',
      items: [
        { id: 'install-1', label: 'All connections tested', required: true, completed: false, photoRequired: false },
        { id: 'install-2', label: 'No leaks detected', required: true, completed: false, photoRequired: true },
        { id: 'install-3', label: 'Water pressure tested', required: true, completed: false, photoRequired: false },
      ],
    },
    {
      id: 'compliance',
      name: 'Compliance',
      items: [
        { id: 'comply-1', label: 'Building regulations met', required: true, completed: false, photoRequired: false },
        { id: 'comply-2', label: 'Backflow prevention installed', required: false, completed: false, photoRequired: false },
      ],
    },
  ],
  electrician: [
    {
      id: 'installation',
      name: 'Installation',
      items: [
        { id: 'install-1', label: 'All circuits tested', required: true, completed: false, photoRequired: false },
        { id: 'install-2', label: 'RCD protection verified', required: true, completed: false, photoRequired: true },
        { id: 'install-3', label: 'Earth continuity tested', required: true, completed: false, photoRequired: false },
      ],
    },
    {
      id: 'certification',
      name: 'Certification',
      items: [
        { id: 'cert-1', label: 'Electrical certificate issued', required: true, completed: false, photoRequired: false },
        { id: 'cert-2', label: 'Minor works certificate (if applicable)', required: false, completed: false, photoRequired: false },
      ],
    },
  ],
};

// ============================================
// MOCK DATA
// ============================================

const MOCK_EVIDENCE_PACKS: EvidencePack[] = [
  {
    id: 'ep-1',
    jobId: 'job-1',
    contractorId: 'contractor-1',
    customerId: 'cust-1',
    jobTitle: 'Kitchen Painting',
    jobAddress: 'Hoofdstraat 45, Amsterdam',
    completionDate: '2025-01-28',
    photos: [
      {
        id: 'photo-1',
        type: 'photo_before',
        name: 'Kitchen before painting',
        uri: 'https://picsum.photos/800/600?random=1',
        thumbnailUri: 'https://picsum.photos/200/150?random=1',
        mimeType: 'image/jpeg',
        size: 2400000,
        capturedAt: '2025-01-20T08:00:00Z',
        capturedBy: 'contractor-1',
        verified: true,
      },
      {
        id: 'photo-2',
        type: 'photo_after',
        name: 'Kitchen after painting',
        uri: 'https://picsum.photos/800/600?random=2',
        thumbnailUri: 'https://picsum.photos/200/150?random=2',
        mimeType: 'image/jpeg',
        size: 2600000,
        capturedAt: '2025-01-28T16:00:00Z',
        capturedBy: 'contractor-1',
        verified: true,
      },
    ],
    documents: [],
    checklists: DEFAULT_CHECKLISTS.painter.map(cat => ({
      ...cat,
      items: cat.items.map(item => ({ ...item, completed: true })),
    })),
    warranties: [
      {
        id: 'war-1',
        type: 'workmanship',
        description: '2-year workmanship warranty',
        duration: '2 years',
        startDate: '2025-01-28',
        endDate: '2027-01-28',
        coverage: ['Paint peeling', 'Uneven coverage', 'Color fading'],
      },
    ],
    certificates: [],
    complianceStatus: 'complete',
    complianceChecks: [
      { id: 'check-1', name: 'Photo documentation', required: true, passed: true },
      { id: 'check-2', name: 'Customer walkthrough', required: true, passed: true },
      { id: 'check-3', name: 'Quality checklist', required: true, passed: true },
    ],
    totalPhotos: 2,
    requiredItemsComplete: 8,
    requiredItemsTotal: 8,
    completionPercentage: 100,
    status: 'ready',
    createdAt: '2025-01-28T10:00:00Z',
    updatedAt: '2025-01-28T16:30:00Z',
    assembledAt: '2025-01-28T16:30:00Z',
  },
];

const MOCK_HANDOVER_PACKAGES: HandoverPackage[] = [];

// ============================================
// SERVICE CLASS
// ============================================

type EvidencePackListener = () => void;

class EvidencePackService {
  private static instance: EvidencePackService;
  private listeners: Set<EvidencePackListener> = new Set();
  private evidencePacks: Map<string, EvidencePack> = new Map();
  private handoverPackages: Map<string, HandoverPackage> = new Map();

  constructor() {
    // R32: dropped MOCK_EVIDENCE_PACKS + MOCK_HANDOVER_PACKAGES seeds
    // (was injecting fixture evidence packs into every contractor's
    // handover singleton — would surface someone else's photos / hours /
    // materials if a consumer iterated `evidencePacks`). Real packs flow
    // in via `assembleEvidencePack()` from the handover wizard.
    // Test setups call __seedMockData.
  }

  /** @internal Test-only mock seeder. */
  __seedMockData(): void {
    MOCK_EVIDENCE_PACKS.forEach(pack => this.evidencePacks.set(pack.id, pack));
    MOCK_HANDOVER_PACKAGES.forEach(pkg => this.handoverPackages.set(pkg.id, pkg));
  }

  static getInstance(): EvidencePackService {
    if (!EvidencePackService.instance) {
      EvidencePackService.instance = new EvidencePackService();
    }
    return EvidencePackService.instance;
  }

  subscribe(listener: EvidencePackListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(l => l());
  }

  // ----------------------------------------
  // EVIDENCE PACK ASSEMBLY
  // ----------------------------------------

  /**
   * Assembles a complete evidence pack for a job
   * Bundles photos, checklists, warranties, and certificates
   */
  async assembleEvidencePack(
    jobId: string,
    contractorId: string,
    customerId: string,
    options: AssembleOptions = {}
  ): Promise<EvidencePack> {
    const {
      includePhotos = true,
      includeWarranties = true,
      includeCertificates = true,
      includeChecklists = true,
      includeReceipts = true,
    } = options;

    // Get job documents from vault
    const jobDocs = documentVaultService.getDocuments({ projectId: jobId });

    // Collect photos
    const photos: EvidenceItem[] = includePhotos
      ? jobDocs
          .filter(d => d.type.startsWith('photo_'))
          .map(d => this.documentToEvidenceItem(d))
      : [];

    // Collect documents
    const documents: EvidenceItem[] = jobDocs
      .filter(d => includeReceipts ? true : d.type !== 'receipt')
      .filter(d => !d.type.startsWith('photo_'))
      .map(d => this.documentToEvidenceItem(d));

    // Get warranties for this customer
    const warranties = includeWarranties
      ? warrantyManagerService.getWarranties().filter(w => w.customerId === customerId).map(w => ({
          id: w.id,
          type: w.warrantyType,
          description: `${w.equipmentName} warranty`,
          duration: this.calculateDuration(w.warrantyStart, w.warrantyEnd),
          startDate: w.warrantyStart.toISOString().split('T')[0],
          endDate: w.warrantyEnd.toISOString().split('T')[0],
          documentUri: w.documentUrl,
          coverage: w.coverage,
        }))
      : [];

    // Get default checklists
    const checklists = includeChecklists ? [...DEFAULT_CHECKLISTS.default] : [];

    // Calculate completion stats
    const allRequiredItems = checklists.flatMap(cat => cat.items.filter(i => i.required));
    const completedRequiredItems = allRequiredItems.filter(i => i.completed);

    const evidencePack: EvidencePack = {
      id: `ep-${Date.now()}`,
      jobId,
      contractorId,
      customerId,
      jobTitle: 'Job', // Would come from job data
      jobAddress: '', // Would come from job data
      completionDate: new Date().toISOString().split('T')[0],
      photos,
      documents,
      checklists,
      warranties,
      certificates: includeCertificates ? [] : [],
      complianceStatus: 'pending',
      complianceChecks: [],
      totalPhotos: photos.length,
      requiredItemsComplete: completedRequiredItems.length,
      requiredItemsTotal: allRequiredItems.length,
      completionPercentage: allRequiredItems.length > 0
        ? Math.round((completedRequiredItems.length / allRequiredItems.length) * 100)
        : 0,
      status: 'assembling',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.evidencePacks.set(evidencePack.id, evidencePack);
    trackUserAction('evidence_pack_assembled', { jobId, photoCount: photos.length });
    this.notify();

    return evidencePack;
  }

  /**
   * Gets an evidence pack by ID
   */
  getEvidencePack(packId: string): EvidencePack | undefined {
    return this.evidencePacks.get(packId);
  }

  /**
   * Gets evidence packs for a job
   */
  getEvidencePacksForJob(jobId: string): EvidencePack[] {
    return Array.from(this.evidencePacks.values()).filter(p => p.jobId === jobId);
  }

  /**
   * Updates an evidence pack
   */
  updateEvidencePack(packId: string, updates: Partial<EvidencePack>): void {
    const pack = this.evidencePacks.get(packId);
    if (pack) {
      Object.assign(pack, updates, { updatedAt: new Date().toISOString() });
      this.notify();
    }
  }

  /**
   * Adds a photo to an evidence pack
   */
  addPhotoTopack(packId: string, photo: Omit<EvidenceItem, 'id'>): void {
    const pack = this.evidencePacks.get(packId);
    if (pack) {
      const newPhoto: EvidenceItem = {
        ...photo,
        id: `photo-${Date.now()}`,
      };
      pack.photos.push(newPhoto);
      pack.totalPhotos = pack.photos.length;
      pack.updatedAt = new Date().toISOString();
      this.notify();
    }
  }

  /**
   * Updates a checklist item
   */
  updateChecklistItem(
    packId: string,
    categoryId: string,
    itemId: string,
    updates: { completed?: boolean; notes?: string; photoUri?: string }
  ): void {
    const pack = this.evidencePacks.get(packId);
    if (pack) {
      const category = pack.checklists.find(c => c.id === categoryId);
      if (category) {
        const item = category.items.find(i => i.id === itemId);
        if (item) {
          Object.assign(item, updates);
          if (updates.completed) {
            item.completedAt = new Date().toISOString();
          }
          // Recalculate completion stats
          const allRequired = pack.checklists.flatMap(c => c.items.filter(i => i.required));
          const completedRequired = allRequired.filter(i => i.completed);
          pack.requiredItemsComplete = completedRequired.length;
          pack.completionPercentage = allRequired.length > 0
            ? Math.round((completedRequired.length / allRequired.length) * 100)
            : 0;
          pack.updatedAt = new Date().toISOString();
          this.notify();
        }
      }
    }
  }

  // ----------------------------------------
  // VALIDATION
  // ----------------------------------------

  /**
   * Validates that an evidence pack has all required components
   */
  validatePackCompleteness(packId: string): PackValidationResult {
    const pack = this.evidencePacks.get(packId);
    if (!pack) {
      return {
        isValid: false,
        isComplete: false,
        missingRequired: ['Evidence pack not found'],
        warnings: [],
        completionPercentage: 0,
      };
    }

    const missingRequired: string[] = [];
    const warnings: string[] = [];

    // Check for photos
    if (pack.photos.length === 0) {
      missingRequired.push('At least one photo is required');
    } else if (pack.photos.filter(p => p.type === 'photo_after').length === 0) {
      warnings.push('No "after" photos found - consider adding completion photos');
    }

    // Check required checklist items
    const incompleteRequired = pack.checklists
      .flatMap(c => c.items)
      .filter(i => i.required && !i.completed);

    incompleteRequired.forEach(item => {
      missingRequired.push(`Checklist: ${item.label}`);
    });

    // Check photo requirements on checklist items
    pack.checklists
      .flatMap(c => c.items)
      .filter(i => i.photoRequired && !i.photoUri)
      .forEach(item => {
        warnings.push(`Photo recommended for: ${item.label}`);
      });

    // Check compliance
    const failedCompliance = pack.complianceChecks.filter(c => c.required && !c.passed);
    failedCompliance.forEach(check => {
      missingRequired.push(`Compliance: ${check.name}`);
    });

    return {
      isValid: missingRequired.length === 0,
      isComplete: missingRequired.length === 0 && warnings.length === 0,
      missingRequired,
      warnings,
      completionPercentage: pack.completionPercentage,
    };
  }

  /**
   * Checks regulatory compliance status
   */
  getPackComplianceStatus(packId: string): ComplianceCheckResult {
    const pack = this.evidencePacks.get(packId);
    if (!pack) {
      return {
        status: 'non-compliant',
        checks: [],
        overallScore: 0,
      };
    }

    const checks = [
      {
        id: 'photo-doc',
        name: 'Photo Documentation',
        required: true,
        passed: pack.photos.length >= 1,
        message: pack.photos.length >= 1 ? undefined : 'At least 1 photo required',
      },
      {
        id: 'before-after',
        name: 'Before/After Photos',
        required: false,
        passed: pack.photos.some(p => p.type === 'photo_before') && pack.photos.some(p => p.type === 'photo_after'),
        message: 'Before and after photos recommended for evidence',
      },
      {
        id: 'checklist-complete',
        name: 'Checklist Completion',
        required: true,
        passed: pack.completionPercentage === 100,
        message: pack.completionPercentage === 100 ? undefined : 'Complete all required checklist items',
      },
      {
        id: 'warranty-doc',
        name: 'Warranty Documentation',
        required: false,
        passed: pack.warranties.length > 0,
        message: 'Consider adding warranty documentation',
      },
    ];

    const requiredPassed = checks.filter(c => c.required && c.passed).length;
    const requiredTotal = checks.filter(c => c.required).length;
    const allPassed = checks.filter(c => c.passed).length;
    const overallScore = Math.round((allPassed / checks.length) * 100);

    let status: ComplianceCheckResult['status'] = 'compliant';
    if (requiredPassed < requiredTotal) {
      status = 'non-compliant';
    } else if (allPassed < checks.length) {
      status = 'partial';
    }

    return { status, checks, overallScore };
  }

  // ----------------------------------------
  // HANDOVER PACKAGE
  // ----------------------------------------

  /**
   * Creates a handover package from an evidence pack
   */
  createHandoverPackage(
    evidencePackId: string,
    customer: { id: string; name: string; email?: string; phone?: string },
    financials: { quotedAmount: number; finalAmount: number; currency: 'GBP' | 'EUR'; paymentStatus: 'pending' | 'partial' | 'paid' }
  ): HandoverPackage {
    const evidencePack = this.evidencePacks.get(evidencePackId);
    if (!evidencePack) {
      throw new Error('Evidence pack not found');
    }

    const includedDocuments = [
      ...evidencePack.photos.map(p => ({
        id: p.id,
        name: p.name,
        type: p.type,
        uri: p.uri,
        included: true,
      })),
      ...evidencePack.documents.map(d => ({
        id: d.id,
        name: d.name,
        type: d.type,
        uri: d.uri,
        included: true,
      })),
    ];

    const handoverPackage: HandoverPackage = {
      id: `hp-${Date.now()}`,
      evidencePackId,
      jobId: evidencePack.jobId,
      contractorId: evidencePack.contractorId,
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      title: `Handover: ${evidencePack.jobTitle}`,
      summary: `Completion documentation for ${evidencePack.jobTitle} at ${evidencePack.jobAddress}`,
      completionDate: evidencePack.completionDate,
      quotedAmount: financials.quotedAmount,
      finalAmount: financials.finalAmount,
      currency: financials.currency,
      paymentStatus: financials.paymentStatus,
      includedDocuments,
      portalAccessCount: 0,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.handoverPackages.set(handoverPackage.id, handoverPackage);
    trackUserAction('handover_package_created', { jobId: evidencePack.jobId });
    this.notify();

    return handoverPackage;
  }

  /**
   * Gets a handover package by ID
   */
  getHandoverPackage(packageId: string): HandoverPackage | undefined {
    return this.handoverPackages.get(packageId);
  }

  /**
   * Gets handover packages for a job
   */
  getHandoverPackagesForJob(jobId: string): HandoverPackage[] {
    return Array.from(this.handoverPackages.values()).filter(p => p.jobId === jobId);
  }

  // ----------------------------------------
  // PDF GENERATION
  // ----------------------------------------

  /**
   * Generates a PDF document for the handover package
   */
  async generateHandoverPDF(
    packageId: string,
    options: HandoverPDFOptions = {}
  ): Promise<string> {
    const pkg = this.handoverPackages.get(packageId);
    if (!pkg) {
      throw new Error('Handover package not found');
    }

    const evidencePack = this.evidencePacks.get(pkg.evidencePackId);
    if (!evidencePack) {
      throw new Error('Evidence pack not found');
    }

    // In a real implementation, this would use a PDF generation library
    // For now, we simulate the PDF generation
    const pdfUri = `https://vasco.app/pdf/${packageId}-${Date.now()}.pdf`;

    // Update package with PDF URI
    pkg.pdfUri = pdfUri;
    pkg.pdfGeneratedAt = new Date().toISOString();
    pkg.updatedAt = new Date().toISOString();

    trackUserAction('handover_pdf_generated', { packageId, jobId: pkg.jobId });
    this.notify();

    return pdfUri;
  }

  // ----------------------------------------
  // PORTAL LINK
  // ----------------------------------------

  /**
   * Creates a shareable customer portal link
   */
  createHandoverPortalLink(
    packageId: string,
    options: PortalLinkOptions = {}
  ): { url: string; expiresAt: string } {
    const { expiresInDays = 30 } = options;

    const pkg = this.handoverPackages.get(packageId);
    if (!pkg) {
      throw new Error('Handover package not found');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const portalLink = `https://vasco.app/handover/${packageId}?token=${Date.now().toString(36)}`;

    pkg.portalLink = portalLink;
    pkg.portalLinkExpiresAt = expiresAt.toISOString();
    pkg.updatedAt = new Date().toISOString();

    trackUserAction('handover_portal_link_created', { packageId, expiresInDays });
    this.notify();

    return {
      url: portalLink,
      expiresAt: expiresAt.toISOString(),
    };
  }

  // ----------------------------------------
  // CUSTOMER SIGN-OFF
  // ----------------------------------------

  /**
   * Records customer sign-off on the handover package
   */
  recordCustomerSignOff(
    packageId: string,
    signOff: {
      signatureUri?: string;
      signedByName: string;
      feedback?: string;
      rating?: number;
    }
  ): void {
    const pkg = this.handoverPackages.get(packageId);
    if (!pkg) {
      throw new Error('Handover package not found');
    }

    pkg.customerSignOff = {
      signed: true,
      signatureUri: signOff.signatureUri,
      signedAt: new Date().toISOString(),
      signedByName: signOff.signedByName,
      feedback: signOff.feedback,
      rating: signOff.rating,
    };
    pkg.status = 'signed';
    pkg.updatedAt = new Date().toISOString();

    trackUserAction('handover_customer_signed', { packageId, rating: signOff.rating });
    this.notify();
  }

  /**
   * Generates a completion certificate
   */
  generateCompletionCertificate(packageId: string): string {
    const pkg = this.handoverPackages.get(packageId);
    if (!pkg) {
      throw new Error('Handover package not found');
    }

    const certificateUri = `https://vasco.app/certificates/${packageId}-${Date.now()}.pdf`;

    pkg.completionCertificate = {
      id: `cert-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      documentUri: certificateUri,
      signedByContractor: false,
    };
    pkg.updatedAt = new Date().toISOString();

    trackUserAction('completion_certificate_generated', { packageId });
    this.notify();

    return certificateUri;
  }

  /**
   * Records contractor signature on completion certificate
   */
  signCompletionCertificate(packageId: string, signatureUri: string): void {
    const pkg = this.handoverPackages.get(packageId);
    if (!pkg || !pkg.completionCertificate) {
      throw new Error('Handover package or certificate not found');
    }

    pkg.completionCertificate.signedByContractor = true;
    pkg.completionCertificate.contractorSignatureUri = signatureUri;
    pkg.completionCertificate.contractorSignedAt = new Date().toISOString();
    pkg.updatedAt = new Date().toISOString();

    this.notify();
  }

  // ----------------------------------------
  // SEND HANDOVER
  // ----------------------------------------

  /**
   * Sends the handover package to the customer
   */
  async sendHandoverPackage(
    packageId: string,
    method: 'email' | 'sms' | 'whatsapp' | 'portal'
  ): Promise<void> {
    const pkg = this.handoverPackages.get(packageId);
    if (!pkg) {
      throw new Error('Handover package not found');
    }

    // Generate PDF if not already done
    if (!pkg.pdfUri) {
      await this.generateHandoverPDF(packageId);
    }

    // Create portal link if not already done
    if (!pkg.portalLink) {
      this.createHandoverPortalLink(packageId);
    }

    // Mark as sent
    pkg.status = 'sent';
    pkg.sentAt = new Date().toISOString();
    pkg.updatedAt = new Date().toISOString();

    trackUserAction('handover_package_sent', { packageId, method });
    this.notify();
  }

  // ----------------------------------------
  // UTILITY METHODS
  // ----------------------------------------

  private documentToEvidenceItem(doc: Document): EvidenceItem {
    return {
      id: doc.id,
      type: doc.type as EvidenceType,
      name: doc.name,
      uri: doc.url,
      thumbnailUri: doc.thumbnailUrl,
      mimeType: doc.mimeType,
      size: doc.size,
      capturedAt: doc.uploadedAt,
      capturedBy: 'unknown',
      verified: true,
      metadata: doc.metadata,
    };
  }

  private calculateDuration(start: Date, end: Date): string {
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);

    if (years > 0) {
      return months > 0 ? `${years} year${years > 1 ? 's' : ''} ${months} month${months > 1 ? 's' : ''}` : `${years} year${years > 1 ? 's' : ''}`;
    }
    return `${months} month${months > 1 ? 's' : ''}`;
  }
}

export const evidencePackService = EvidencePackService.getInstance();

// ============================================
// REACT HOOKS
// ============================================

export function useEvidencePack(packId: string | undefined) {
  const [pack, setPack] = useState<EvidencePack | undefined>(
    packId ? evidencePackService.getEvidencePack(packId) : undefined
  );
  const [validation, setValidation] = useState<PackValidationResult | null>(null);
  const [compliance, setCompliance] = useState<ComplianceCheckResult | null>(null);

  useEffect(() => {
    if (packId) {
      setPack(evidencePackService.getEvidencePack(packId));
      setValidation(evidencePackService.validatePackCompleteness(packId));
      setCompliance(evidencePackService.getPackComplianceStatus(packId));
    }
    return evidencePackService.subscribe(() => {
      if (packId) {
        setPack(evidencePackService.getEvidencePack(packId));
        setValidation(evidencePackService.validatePackCompleteness(packId));
        setCompliance(evidencePackService.getPackComplianceStatus(packId));
      }
    });
  }, [packId]);

  const updateChecklist = useCallback(
    (categoryId: string, itemId: string, updates: { completed?: boolean; notes?: string; photoUri?: string }) => {
      if (packId) {
        evidencePackService.updateChecklistItem(packId, categoryId, itemId, updates);
      }
    },
    [packId]
  );

  const addPhoto = useCallback(
    (photo: Omit<EvidenceItem, 'id'>) => {
      if (packId) {
        evidencePackService.addPhotoTopack(packId, photo);
      }
    },
    [packId]
  );

  return { pack, validation, compliance, updateChecklist, addPhoto };
}

export function useHandoverPackage(packageId: string | undefined) {
  const [pkg, setPkg] = useState<HandoverPackage | undefined>(
    packageId ? evidencePackService.getHandoverPackage(packageId) : undefined
  );

  useEffect(() => {
    if (packageId) {
      setPkg(evidencePackService.getHandoverPackage(packageId));
    }
    return evidencePackService.subscribe(() => {
      if (packageId) {
        setPkg(evidencePackService.getHandoverPackage(packageId));
      }
    });
  }, [packageId]);

  const generatePDF = useCallback(
    async (options?: HandoverPDFOptions) => {
      if (packageId) {
        return evidencePackService.generateHandoverPDF(packageId, options);
      }
      return null;
    },
    [packageId]
  );

  const createPortalLink = useCallback(
    (options?: PortalLinkOptions) => {
      if (packageId) {
        return evidencePackService.createHandoverPortalLink(packageId, options);
      }
      return null;
    },
    [packageId]
  );

  const recordSignOff = useCallback(
    (signOff: { signatureUri?: string; signedByName: string; feedback?: string; rating?: number }) => {
      if (packageId) {
        evidencePackService.recordCustomerSignOff(packageId, signOff);
      }
    },
    [packageId]
  );

  const send = useCallback(
    async (method: 'email' | 'sms' | 'whatsapp' | 'portal') => {
      if (packageId) {
        await evidencePackService.sendHandoverPackage(packageId, method);
      }
    },
    [packageId]
  );

  return { package: pkg, generatePDF, createPortalLink, recordSignOff, send };
}

export function useEvidencePacksForJob(jobId: string) {
  const [packs, setPacks] = useState<EvidencePack[]>(
    evidencePackService.getEvidencePacksForJob(jobId)
  );

  useEffect(() => {
    setPacks(evidencePackService.getEvidencePacksForJob(jobId));
    return evidencePackService.subscribe(() => {
      setPacks(evidencePackService.getEvidencePacksForJob(jobId));
    });
  }, [jobId]);

  const assemblePack = useCallback(
    async (contractorId: string, customerId: string, options?: AssembleOptions) => {
      return evidencePackService.assembleEvidencePack(jobId, contractorId, customerId, options);
    },
    [jobId]
  );

  return { packs, assemblePack };
}
