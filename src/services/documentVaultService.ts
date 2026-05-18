// =============================================================================
// DOCUMENT VAULT SERVICE
// =============================================================================
// Secure document management for contracts, warranties, photos, and compliance
// Smart categorization, expiry tracking, and quick sharing
// =============================================================================

import { trackUserAction } from '../intelligence/intelligenceEngine';

// ============================================
// TYPES
// ============================================

export interface Document {
  id: string;
  name: string;
  type: DocumentType;
  category: DocumentCategory;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  projectId?: string;
  customerId?: string;
  uploadedAt: string;
  modifiedAt: string;
  expiresAt?: string;
  tags: string[];
  metadata: Record<string, any>;
  shared: boolean;
  sharedWith?: string[];
  version: number;
  previousVersions?: string[];
}

export type DocumentType =
  | 'contract'
  | 'quote'
  | 'invoice'
  | 'warranty'
  | 'certification'
  | 'insurance'
  | 'permit'
  | 'photo_before'
  | 'photo_after'
  | 'photo_progress'
  | 'receipt'
  | 'specification'
  | 'floor_plan'
  | 'other';

export type DocumentCategory =
  | 'project'
  | 'financial'
  | 'legal'
  | 'compliance'
  | 'media'
  | 'reference';

export interface DocumentFolder {
  id: string;
  name: string;
  parentId?: string;
  color?: string;
  icon?: string;
  documentCount: number;
  createdAt: string;
}

export interface DocumentSearch {
  query?: string;
  type?: DocumentType;
  category?: DocumentCategory;
  projectId?: string;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
  expiringWithinDays?: number;
}

export interface ExpiringDocument {
  document: Document;
  daysUntilExpiry: number;
  urgency: 'critical' | 'warning' | 'info';
  actionRequired: string;
}

export interface DocumentStats {
  totalDocuments: number;
  totalSize: number;
  byType: Record<DocumentType, number>;
  byCategory: Record<DocumentCategory, number>;
  recentUploads: number;
  expiringCount: number;
}

export interface ShareLink {
  id: string;
  documentId: string;
  url: string;
  expiresAt: string;
  accessCount: number;
  maxAccess?: number;
  password?: boolean;
  createdAt: string;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  type: DocumentType;
  description: string;
  fields: Array<{
    name: string;
    type: 'text' | 'date' | 'number' | 'signature';
    required: boolean;
  }>;
  previewUrl: string;
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_DOCUMENTS: Document[] = [
  {
    id: 'doc_1',
    name: 'Offerte_DeVries_Schilderwerk.pdf',
    type: 'quote',
    category: 'financial',
    mimeType: 'application/pdf',
    size: 245000,
    url: 'https://example.com/docs/1.pdf',
    projectId: 'proj_1',
    customerId: 'cust_1',
    uploadedAt: '2025-01-15T10:30:00',
    modifiedAt: '2025-01-15T10:30:00',
    tags: ['offerte', 'schilderwerk', '2025'],
    metadata: { quotedAmount: 2450 },
    shared: true,
    sharedWith: ['cust_1'],
    version: 1,
  },
  {
    id: 'doc_2',
    name: 'Contract_Badkamerrenovatie_Jansen.pdf',
    type: 'contract',
    category: 'legal',
    mimeType: 'application/pdf',
    size: 380000,
    url: 'https://example.com/docs/2.pdf',
    projectId: 'proj_2',
    customerId: 'cust_2',
    uploadedAt: '2025-01-10T14:00:00',
    modifiedAt: '2025-01-10T14:00:00',
    tags: ['contract', 'badkamer', 'getekend'],
    metadata: { signedDate: '2025-01-10', contractValue: 8500 },
    shared: true,
    sharedWith: ['cust_2'],
    version: 1,
  },
  {
    id: 'doc_3',
    name: 'VCA_Certificaat_2024.pdf',
    type: 'certification',
    category: 'compliance',
    mimeType: 'application/pdf',
    size: 125000,
    url: 'https://example.com/docs/3.pdf',
    uploadedAt: '2024-06-01T09:00:00',
    modifiedAt: '2024-06-01T09:00:00',
    expiresAt: '2025-06-01',
    tags: ['certificaat', 'vca', 'veiligheid'],
    metadata: { issuer: 'VCA Nederland', certificateNumber: 'VCA-2024-12345' },
    shared: false,
    version: 1,
  },
  {
    id: 'doc_4',
    name: 'Bedrijfsverzekering_2025.pdf',
    type: 'insurance',
    category: 'compliance',
    mimeType: 'application/pdf',
    size: 520000,
    url: 'https://example.com/docs/4.pdf',
    uploadedAt: '2025-01-02T11:00:00',
    modifiedAt: '2025-01-02T11:00:00',
    expiresAt: '2026-01-01',
    tags: ['verzekering', 'aansprakelijkheid', '2025'],
    metadata: { insurer: 'Allianz', policyNumber: 'POL-2025-67890', coverage: 500000 },
    shared: false,
    version: 1,
  },
  {
    id: 'doc_5',
    name: 'Badkamer_voor_renovatie.jpg',
    type: 'photo_before',
    category: 'media',
    mimeType: 'image/jpeg',
    size: 2400000,
    url: 'https://example.com/photos/5.jpg',
    thumbnailUrl: 'https://example.com/photos/5_thumb.jpg',
    projectId: 'proj_2',
    customerId: 'cust_2',
    uploadedAt: '2025-01-08T08:30:00',
    modifiedAt: '2025-01-08T08:30:00',
    tags: ['foto', 'voor', 'badkamer'],
    metadata: { location: 'Badkamer begane grond' },
    shared: false,
    version: 1,
  },
  {
    id: 'doc_6',
    name: 'Badkamer_na_renovatie.jpg',
    type: 'photo_after',
    category: 'media',
    mimeType: 'image/jpeg',
    size: 2800000,
    url: 'https://example.com/photos/6.jpg',
    thumbnailUrl: 'https://example.com/photos/6_thumb.jpg',
    projectId: 'proj_2',
    customerId: 'cust_2',
    uploadedAt: '2025-01-28T16:00:00',
    modifiedAt: '2025-01-28T16:00:00',
    tags: ['foto', 'na', 'badkamer', 'afgerond'],
    metadata: { location: 'Badkamer begane grond' },
    shared: true,
    sharedWith: ['cust_2'],
    version: 1,
  },
  {
    id: 'doc_7',
    name: 'Garantiebewijs_sanitair.pdf',
    type: 'warranty',
    category: 'legal',
    mimeType: 'application/pdf',
    size: 95000,
    url: 'https://example.com/docs/7.pdf',
    projectId: 'proj_2',
    customerId: 'cust_2',
    uploadedAt: '2025-01-28T16:30:00',
    modifiedAt: '2025-01-28T16:30:00',
    expiresAt: '2030-01-28',
    tags: ['garantie', 'sanitair', '5jaar'],
    metadata: { warrantyPeriod: '5 jaar', products: ['Toilet', 'Wastafel', 'Douche'] },
    shared: true,
    sharedWith: ['cust_2'],
    version: 1,
  },
];

const MOCK_FOLDERS: DocumentFolder[] = [
  { id: 'folder_1', name: 'Projecten 2025', color: '#3B82F6', documentCount: 15, createdAt: '2025-01-01' },
  { id: 'folder_2', name: 'Certificaten', color: '#10B981', documentCount: 5, createdAt: '2024-01-01' },
  { id: 'folder_3', name: 'Verzekeringen', color: '#F59E0B', documentCount: 3, createdAt: '2024-01-01' },
  { id: 'folder_4', name: 'Templates', color: '#8B5CF6', documentCount: 8, createdAt: '2024-01-01' },
];

const MOCK_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'tpl_1',
    name: 'Standaard Offerte',
    type: 'quote',
    description: 'Professionele offerte template met itemlijst',
    fields: [
      { name: 'Klantnaam', type: 'text', required: true },
      { name: 'Projectomschrijving', type: 'text', required: true },
      { name: 'Startdatum', type: 'date', required: false },
      { name: 'Totaalbedrag', type: 'number', required: true },
    ],
    previewUrl: 'https://example.com/templates/quote.png',
  },
  {
    id: 'tpl_2',
    name: 'Aannemingsovereenkomst',
    type: 'contract',
    description: 'Juridisch gecontroleerde aannemingsovereenkomst',
    fields: [
      { name: 'Klantnaam', type: 'text', required: true },
      { name: 'Projectadres', type: 'text', required: true },
      { name: 'Aanneemsom', type: 'number', required: true },
      { name: 'Handtekening opdrachtgever', type: 'signature', required: true },
    ],
    previewUrl: 'https://example.com/templates/contract.png',
  },
  {
    id: 'tpl_3',
    name: 'Garantiebewijs',
    type: 'warranty',
    description: 'Garantieverklaring voor uitgevoerd werk',
    fields: [
      { name: 'Klantnaam', type: 'text', required: true },
      { name: 'Werkzaamheden', type: 'text', required: true },
      { name: 'Garantieperiode', type: 'text', required: true },
      { name: 'Einddatum garantie', type: 'date', required: true },
    ],
    previewUrl: 'https://example.com/templates/warranty.png',
  },
];

// ============================================
// SERVICE CLASS
// ============================================

class DocumentVaultService {
  private documents: Map<string, Document> = new Map();
  private folders: Map<string, DocumentFolder> = new Map();
  private shareLinks: Map<string, ShareLink> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    // R31: dropped MOCK_DOCUMENTS + MOCK_FOLDERS seed (was injecting fake
    // documents into every contractor's vault). DocumentVault component is
    // currently un-mounted but the singleton is exported — any future
    // consumer would inherit empty state. Test setups call __seedMockData.
  }

  /** @internal Test-only mock seeder. */
  __seedMockData(): void {
    MOCK_DOCUMENTS.forEach((d) => this.documents.set(d.id, d));
    MOCK_FOLDERS.forEach((f) => this.folders.set(f.id, f));
  }

  // -----------------------------------------
  // Document Operations
  // -----------------------------------------

  getDocuments(search?: DocumentSearch): Document[] {
    let docs = Array.from(this.documents.values());

    if (search?.query) {
      const q = search.query.toLowerCase();
      docs = docs.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (search?.type) docs = docs.filter((d) => d.type === search.type);
    if (search?.category) docs = docs.filter((d) => d.category === search.category);
    if (search?.projectId) docs = docs.filter((d) => d.projectId === search.projectId);
    if (search?.customerId) docs = docs.filter((d) => d.customerId === search.customerId);
    if (search?.tags) {
      docs = docs.filter((d) => search.tags!.some((t) => d.tags.includes(t)));
    }
    if (search?.expiringWithinDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + search.expiringWithinDays);
      docs = docs.filter((d) => d.expiresAt && new Date(d.expiresAt) <= cutoff);
    }

    return docs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }

  getDocument(documentId: string): Document | undefined {
    return this.documents.get(documentId);
  }

  uploadDocument(doc: Omit<Document, 'id' | 'uploadedAt' | 'modifiedAt' | 'version'>): Document {
    const newDoc: Document = {
      ...doc,
      id: `doc_${Date.now()}`,
      uploadedAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      version: 1,
    };
    this.documents.set(newDoc.id, newDoc);
    this.notifyListeners();
    trackUserAction('document_uploaded', { type: doc.type, category: doc.category });
    return newDoc;
  }

  updateDocument(documentId: string, updates: Partial<Document>): void {
    const doc = this.documents.get(documentId);
    if (doc) {
      Object.assign(doc, updates, { modifiedAt: new Date().toISOString() });
      this.notifyListeners();
      trackUserAction('document_updated', { documentId });
    }
  }

  deleteDocument(documentId: string): void {
    this.documents.delete(documentId);
    this.notifyListeners();
    trackUserAction('document_deleted', { documentId });
  }

  // -----------------------------------------
  // Expiring Documents
  // -----------------------------------------

  getExpiringDocuments(withinDays: number = 30): ExpiringDocument[] {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(now.getDate() + withinDays);

    return this.getDocuments()
      .filter((doc) => doc.expiresAt && new Date(doc.expiresAt) <= cutoff)
      .map((doc) => {
        const expiryDate = new Date(doc.expiresAt!);
        const daysUntilExpiry = Math.ceil(
          (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        let urgency: ExpiringDocument['urgency'] = 'info';
        let actionRequired = 'Vernieuw voor verloopdatum';

        if (daysUntilExpiry <= 0) {
          urgency = 'critical';
          actionRequired = 'VERLOPEN - Direct actie vereist!';
        } else if (daysUntilExpiry <= 7) {
          urgency = 'critical';
          actionRequired = 'Verloopt deze week - Vernieuw nu!';
        } else if (daysUntilExpiry <= 30) {
          urgency = 'warning';
          actionRequired = 'Verloopt binnenkort - Plan vernieuwing';
        }

        return { document: doc, daysUntilExpiry, urgency, actionRequired };
      })
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }

  // -----------------------------------------
  // Sharing
  // -----------------------------------------

  createShareLink(documentId: string, options?: { expiresInDays?: number; maxAccess?: number; password?: string }): ShareLink {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (options?.expiresInDays || 7));

    const shareLink: ShareLink = {
      id: `share_${Date.now()}`,
      documentId,
      url: `https://vascobuild.com/share/${Date.now()}`,
      expiresAt: expiresAt.toISOString(),
      accessCount: 0,
      maxAccess: options?.maxAccess,
      password: !!options?.password,
      createdAt: new Date().toISOString(),
    };

    this.shareLinks.set(shareLink.id, shareLink);
    trackUserAction('share_link_created', { documentId });
    return shareLink;
  }

  shareWithCustomer(documentId: string, customerId: string): void {
    const doc = this.documents.get(documentId);
    if (doc) {
      doc.shared = true;
      doc.sharedWith = doc.sharedWith || [];
      if (!doc.sharedWith.includes(customerId)) {
        doc.sharedWith.push(customerId);
      }
      this.notifyListeners();
      trackUserAction('document_shared', { documentId, customerId });
    }
  }

  // -----------------------------------------
  // Folders
  // -----------------------------------------

  getFolders(): DocumentFolder[] {
    return Array.from(this.folders.values());
  }

  createFolder(name: string, color?: string): DocumentFolder {
    const folder: DocumentFolder = {
      id: `folder_${Date.now()}`,
      name,
      color,
      documentCount: 0,
      createdAt: new Date().toISOString(),
    };
    this.folders.set(folder.id, folder);
    this.notifyListeners();
    return folder;
  }

  // -----------------------------------------
  // Templates
  // -----------------------------------------

  getTemplates(): DocumentTemplate[] {
    return MOCK_TEMPLATES;
  }

  // -----------------------------------------
  // Statistics
  // -----------------------------------------

  getStats(): DocumentStats {
    const docs = this.getDocuments();
    const byType: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    let totalSize = 0;

    docs.forEach((doc) => {
      byType[doc.type] = (byType[doc.type] || 0) + 1;
      byCategory[doc.category] = (byCategory[doc.category] || 0) + 1;
      totalSize += doc.size;
    });

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const recentUploads = docs.filter((d) => new Date(d.uploadedAt) >= oneWeekAgo).length;

    return {
      totalDocuments: docs.length,
      totalSize,
      byType: byType as Record<DocumentType, number>,
      byCategory: byCategory as Record<DocumentCategory, number>,
      recentUploads,
      expiringCount: this.getExpiringDocuments(30).length,
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

export const documentVaultService = new DocumentVaultService();

// ============================================
// REACT HOOKS
// ============================================

import { useState, useEffect, useCallback, useMemo } from 'react';

export function useDocuments(search?: DocumentSearch) {
  const [documents, setDocuments] = useState<Document[]>(() =>
    documentVaultService.getDocuments(search)
  );

  useEffect(() => {
    setDocuments(documentVaultService.getDocuments(search));
    const unsubscribe = documentVaultService.subscribe(() => {
      setDocuments(documentVaultService.getDocuments(search));
    });
    return unsubscribe;
  }, [search?.query, search?.type, search?.category, search?.projectId, search?.customerId]);

  const upload = useCallback(
    (doc: Omit<Document, 'id' | 'uploadedAt' | 'modifiedAt' | 'version'>) => {
      return documentVaultService.uploadDocument(doc);
    },
    []
  );

  const deleteDoc = useCallback((documentId: string) => {
    documentVaultService.deleteDocument(documentId);
  }, []);

  const share = useCallback((documentId: string, customerId: string) => {
    documentVaultService.shareWithCustomer(documentId, customerId);
  }, []);

  return { documents, upload, deleteDoc, share };
}

export function useExpiringDocuments(withinDays: number = 30) {
  const [expiring, setExpiring] = useState<ExpiringDocument[]>(() =>
    documentVaultService.getExpiringDocuments(withinDays)
  );

  useEffect(() => {
    setExpiring(documentVaultService.getExpiringDocuments(withinDays));
    const unsubscribe = documentVaultService.subscribe(() => {
      setExpiring(documentVaultService.getExpiringDocuments(withinDays));
    });
    return unsubscribe;
  }, [withinDays]);

  return expiring;
}

export function useDocumentStats() {
  const [stats, setStats] = useState<DocumentStats>(() => documentVaultService.getStats());

  useEffect(() => {
    const unsubscribe = documentVaultService.subscribe(() => {
      setStats(documentVaultService.getStats());
    });
    return unsubscribe;
  }, []);

  return stats;
}

export function useDocumentFolders() {
  const [folders, setFolders] = useState<DocumentFolder[]>(() => documentVaultService.getFolders());

  useEffect(() => {
    const unsubscribe = documentVaultService.subscribe(() => {
      setFolders(documentVaultService.getFolders());
    });
    return unsubscribe;
  }, []);

  const createFolder = useCallback((name: string, color?: string) => {
    return documentVaultService.createFolder(name, color);
  }, []);

  return { folders, createFolder };
}

export function useDocumentTemplates() {
  return useMemo(() => documentVaultService.getTemplates(), []);
}
