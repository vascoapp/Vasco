// =============================================================================
// DOCUMENT INTELLIGENCE SERVICE
// =============================================================================
// OCR/VLM extraction for receipts, invoices, contracts, permits
// a16z Reducto pattern: "Documents are the bottleneck"
// =============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  IntelligentDocument,
  DocumentType,
  ProcessingStatus,
  ExtractedDocumentData,
  ExtractedReceipt,
  ExtractedSupplierInvoice,
  ComplianceFlag,
  DocumentProcessingRequest,
  DocumentProcessingResult,
  DocumentSuggestedAction,
  DocumentFilter,
  DocumentStats,
} from '../types/document-intelligence';

// ============================================
// MOCK DATA
// ============================================

const MOCK_DOCUMENTS: IntelligentDocument[] = [
  // Recent receipt
  {
    id: 'doc_1',
    sourceUri: 'file:///receipts/verfwinkel_2025_01_28.jpg',
    sourceType: 'camera',
    originalFilename: 'verfwinkel_bon.jpg',
    mimeType: 'image/jpeg',
    fileSize: 1245000,
    documentType: 'receipt',
    classificationConfidence: 94,
    status: 'completed',
    processedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    extractedData: {
      type: 'receipt',
      vendorName: 'Verfwinkel.nl',
      vendorAddress: 'Industrieweg 45, 1234 AB Amsterdam',
      vendorVatNumber: 'NL123456789B01',
      transactionDate: '2025-01-28',
      transactionTime: '14:32',
      receiptNumber: 'R2025-4521',
      lineItems: [
        {
          description: 'Sigma S2U Nova Satin RAL 9010',
          quantity: 10,
          unitPrice: 45.0,
          total: 450.0,
          sku: 'SIG-S2U-9010-10L',
          matchedMaterialId: 'mat_1',
          matchedMaterialName: 'Sigma S2U Nova Satin',
          matchConfidence: 96,
        },
        {
          description: 'Schuurpapier K180 (pak 50st)',
          quantity: 2,
          unitPrice: 12.5,
          total: 25.0,
          sku: 'SCH-K180-50',
        },
        {
          description: 'Schilderstape 38mm x 50m',
          quantity: 5,
          unitPrice: 4.5,
          total: 22.5,
          sku: 'TAPE-38-50',
        },
      ],
      subtotal: 497.5,
      vatAmount: 104.48,
      vatRate: 21,
      total: 601.98,
      currency: 'EUR',
      paymentMethod: 'pin',
      cardLastFour: '4521',
      suggestedCategory: 'materials',
    } as ExtractedReceipt,
    linkedEntityType: 'job',
    linkedEntityId: 'job_1',
    autoLinked: true,
    linkConfidence: 88,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    createdBy: 'contractor_1',
  },
  // Supplier invoice
  {
    id: 'doc_2',
    sourceUri: 'file:///invoices/bouwmaat_factuur_2025_01.pdf',
    sourceType: 'email',
    originalFilename: 'Factuur_BM2025-1234.pdf',
    mimeType: 'application/pdf',
    fileSize: 245000,
    documentType: 'supplier-invoice',
    classificationConfidence: 98,
    status: 'completed',
    processedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    extractedData: {
      type: 'supplier-invoice',
      supplierName: 'Bouwmaat B.V.',
      supplierAddress: 'Bouwlaan 123, 5678 CD Rotterdam',
      supplierVatNumber: 'NL987654321B02',
      supplierKvkNumber: '12345678',
      supplierIban: 'NL91ABNA0417164300',
      invoiceNumber: 'BM2025-1234',
      invoiceDate: '2025-01-25',
      dueDate: '2025-02-25',
      orderReference: 'ORD-2025-089',
      lineItems: [
        {
          description: 'Elektrisch gereedschap - Bosch slijptol',
          quantity: 1,
          unit: 'stuk',
          unitPrice: 189.0,
          vatRate: 21,
          total: 228.69,
          articleNumber: 'BOSCH-GWS-750',
        },
        {
          description: 'Schuurschijven set (100 stuks)',
          quantity: 2,
          unit: 'pak',
          unitPrice: 34.5,
          vatRate: 21,
          total: 83.49,
          articleNumber: 'SCH-SET-100',
        },
      ],
      subtotal: 258.0,
      vatBreakdown: [{ rate: 21, taxableAmount: 258.0, vatAmount: 54.18 }],
      totalVat: 54.18,
      total: 312.18,
      currency: 'EUR',
      paymentTerms: 'Betaling binnen 30 dagen',
      iban: 'NL91ABNA0417164300',
      paymentReference: 'BM2025-1234',
    } as ExtractedSupplierInvoice,
    autoLinked: false,
    complianceFlags: [],
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'contractor_1',
  },
  // Pending document
  {
    id: 'doc_3',
    sourceUri: 'file:///scans/bon_hornbach.jpg',
    sourceType: 'camera',
    originalFilename: 'IMG_20250128_162345.jpg',
    mimeType: 'image/jpeg',
    fileSize: 2100000,
    documentType: 'receipt',
    classificationConfidence: 78,
    status: 'needs-review',
    processedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    extractedData: {
      type: 'receipt',
      vendorName: 'Hornbach',
      transactionDate: '2025-01-28',
      lineItems: [
        { description: 'Diverse artikelen (niet leesbaar)', total: 156.78 },
      ],
      total: 156.78,
      currency: 'EUR',
      suggestedCategory: 'materials',
    } as ExtractedReceipt,
    autoLinked: false,
    complianceFlags: [
      {
        type: 'missing-field',
        severity: 'warning',
        message: 'BTW-nummer leverancier niet gevonden',
        field: 'vendorVatNumber',
        suggestedAction: 'Controleer bon en voeg BTW-nummer handmatig toe',
      },
    ],
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    createdBy: 'contractor_1',
  },
  // Certification document
  {
    id: 'doc_4',
    sourceUri: 'file:///certificates/vca_certificate_2025.pdf',
    sourceType: 'upload',
    originalFilename: 'VCA_Certificaat_2025.pdf',
    mimeType: 'application/pdf',
    fileSize: 890000,
    documentType: 'certification',
    classificationConfidence: 99,
    status: 'completed',
    processedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    extractedData: {
      type: 'certification',
      certificationName: 'VCA VOL',
      certificationBody: 'SSVV',
      certificationNumber: 'VCA-2025-78542',
      holderName: 'Jan van der Berg',
      holderType: 'individual',
      issueDate: '2025-01-15',
      expiryDate: '2028-01-15',
      isValid: true,
      scope: ['Veilig werken op hoogte', 'Algemene veiligheid'],
      renewalRequired: true,
      renewalDeadline: '2027-10-15',
    },
    linkedEntityType: 'customer',
    linkedEntityId: 'contractor_1',
    autoLinked: true,
    linkConfidence: 100,
    complianceFlags: [],
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'contractor_1',
  },
];

// ============================================
// SERVICE CLASS
// ============================================

class DocumentIntelligenceService {
  private documents: Map<string, IntelligentDocument> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    MOCK_DOCUMENTS.forEach((d) => this.documents.set(d.id, d));
  }

  // -----------------------------------------
  // Document Management
  // -----------------------------------------

  getDocuments(filter?: DocumentFilter): IntelligentDocument[] {
    let docs = Array.from(this.documents.values());

    if (filter?.documentType?.length) {
      docs = docs.filter((d) => filter.documentType!.includes(d.documentType));
    }
    if (filter?.status?.length) {
      docs = docs.filter((d) => filter.status!.includes(d.status));
    }
    if (filter?.dateFrom) {
      docs = docs.filter((d) => d.createdAt >= filter.dateFrom!);
    }
    if (filter?.dateTo) {
      docs = docs.filter((d) => d.createdAt <= filter.dateTo!);
    }
    if (filter?.linkedEntityType) {
      docs = docs.filter((d) => d.linkedEntityType === filter.linkedEntityType);
    }
    if (filter?.hasComplianceFlags) {
      docs = docs.filter((d) => d.complianceFlags && d.complianceFlags.length > 0);
    }
    if (filter?.searchText) {
      const search = filter.searchText.toLowerCase();
      docs = docs.filter((d) => {
        const data = d.extractedData as any;
        return (
          d.originalFilename?.toLowerCase().includes(search) ||
          data?.vendorName?.toLowerCase().includes(search) ||
          data?.supplierName?.toLowerCase().includes(search)
        );
      });
    }

    return docs.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getDocumentById(id: string): IntelligentDocument | undefined {
    return this.documents.get(id);
  }

  getRecentDocuments(limit: number = 10): IntelligentDocument[] {
    return this.getDocuments().slice(0, limit);
  }

  getDocumentsNeedingReview(): IntelligentDocument[] {
    return this.getDocuments({ status: ['needs-review'] });
  }

  // -----------------------------------------
  // Document Processing
  // -----------------------------------------

  async processDocument(
    request: DocumentProcessingRequest
  ): Promise<DocumentProcessingResult> {
    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Create new document
    const newDoc: IntelligentDocument = {
      id: `doc_${Date.now()}`,
      sourceUri: request.sourceUri,
      sourceType: request.sourceType,
      mimeType: 'image/jpeg',
      fileSize: 1500000,
      documentType: request.suggestedType || 'receipt',
      classificationConfidence: 85,
      status: 'completed',
      processedAt: new Date().toISOString(),
      extractedData: this.simulateExtraction(request.suggestedType || 'receipt'),
      autoLinked: request.autoLink || false,
      linkedEntityId: request.jobId,
      linkedEntityType: request.jobId ? 'job' : undefined,
      createdAt: new Date().toISOString(),
      createdBy: 'contractor_1',
    };

    this.documents.set(newDoc.id, newDoc);
    this.notifyListeners();

    const suggestedActions: DocumentSuggestedAction[] = [];

    if (newDoc.documentType === 'receipt') {
      suggestedActions.push({
        type: 'create-expense',
        title: 'Uitgave registreren',
        description: 'Voeg toe aan administratie als materiaalkosten',
        payload: { amount: (newDoc.extractedData as ExtractedReceipt).total },
        confidence: 90,
      });
    }

    return {
      document: newDoc,
      suggestedActions,
      timeSavedMinutes: 15,
    };
  }

  private simulateExtraction(type: DocumentType): ExtractedDocumentData {
    if (type === 'receipt') {
      return {
        type: 'receipt',
        vendorName: 'Onbekende leverancier',
        transactionDate: new Date().toISOString().split('T')[0],
        lineItems: [],
        total: 0,
        currency: 'EUR',
        suggestedCategory: 'materials',
      } as ExtractedReceipt;
    }

    return {
      type: 'receipt',
      vendorName: '',
      transactionDate: '',
      lineItems: [],
      total: 0,
      currency: 'EUR',
    } as ExtractedReceipt;
  }

  // -----------------------------------------
  // Document Linking
  // -----------------------------------------

  linkDocument(
    documentId: string,
    entityType: 'job' | 'customer' | 'expense' | 'material',
    entityId: string
  ): boolean {
    const doc = this.documents.get(documentId);
    if (!doc) return false;

    doc.linkedEntityType = entityType;
    doc.linkedEntityId = entityId;
    doc.autoLinked = false;

    this.notifyListeners();
    return true;
  }

  unlinkDocument(documentId: string): boolean {
    const doc = this.documents.get(documentId);
    if (!doc) return false;

    doc.linkedEntityType = undefined;
    doc.linkedEntityId = undefined;
    doc.autoLinked = false;

    this.notifyListeners();
    return true;
  }

  // -----------------------------------------
  // Stats & Analytics
  // -----------------------------------------

  getStats(): DocumentStats {
    const docs = Array.from(this.documents.values());

    const byType: Record<DocumentType, number> = {
      receipt: 0,
      'supplier-invoice': 0,
      'customer-invoice': 0,
      quote: 0,
      contract: 0,
      permit: 0,
      certification: 0,
      warranty: 0,
      insurance: 0,
      photo: 0,
      email: 0,
      unknown: 0,
    };

    const byStatus: Record<ProcessingStatus, number> = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      'needs-review': 0,
    };

    docs.forEach((d) => {
      byType[d.documentType]++;
      byStatus[d.status]++;
    });

    const completed = docs.filter((d) => d.status === 'completed');
    const withFlags = docs.filter((d) => d.complianceFlags && d.complianceFlags.length > 0);

    // Calculate expiring documents
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringDocs = docs.filter((d) => {
      const data = d.extractedData as any;
      if (data?.expiryDate) {
        const expiry = new Date(data.expiryDate);
        return expiry > now && expiry <= thirtyDaysFromNow;
      }
      return false;
    });

    return {
      totalDocuments: docs.length,
      byType,
      byStatus,
      avgProcessingTimeMs: 2500,
      totalProcessed: completed.length,
      successRate: docs.length > 0 ? (completed.length / docs.length) * 100 : 0,
      totalTimeSavedMinutes: completed.length * 15,
      avgTimeSavedPerDocument: 15,
      documentsWithFlags: withFlags.length,
      expiringWithin30Days: expiringDocs.length,
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

export const documentIntelligenceService = new DocumentIntelligenceService();

// ============================================
// REACT HOOKS
// ============================================

export function useDocumentIntelligence(filter?: DocumentFilter) {
  const [documents, setDocuments] = useState<IntelligentDocument[]>(() =>
    documentIntelligenceService.getDocuments(filter)
  );

  useEffect(() => {
    const unsubscribe = documentIntelligenceService.subscribe(() => {
      setDocuments(documentIntelligenceService.getDocuments(filter));
    });
    return unsubscribe;
  }, [JSON.stringify(filter)]);

  const processDocument = useCallback(async (request: DocumentProcessingRequest) => {
    return documentIntelligenceService.processDocument(request);
  }, []);

  const linkDocument = useCallback(
    (documentId: string, entityType: 'job' | 'customer' | 'expense' | 'material', entityId: string) => {
      return documentIntelligenceService.linkDocument(documentId, entityType, entityId);
    },
    []
  );

  return { documents, processDocument, linkDocument };
}

export function useDocumentsNeedingReview() {
  const [documents, setDocuments] = useState<IntelligentDocument[]>(() =>
    documentIntelligenceService.getDocumentsNeedingReview()
  );

  useEffect(() => {
    const unsubscribe = documentIntelligenceService.subscribe(() => {
      setDocuments(documentIntelligenceService.getDocumentsNeedingReview());
    });
    return unsubscribe;
  }, []);

  return documents;
}

export function useDocumentStats() {
  const [stats, setStats] = useState<DocumentStats>(() =>
    documentIntelligenceService.getStats()
  );

  useEffect(() => {
    const unsubscribe = documentIntelligenceService.subscribe(() => {
      setStats(documentIntelligenceService.getStats());
    });
    return unsubscribe;
  }, []);

  return stats;
}

export function useRecentDocuments(limit: number = 10) {
  const [documents, setDocuments] = useState<IntelligentDocument[]>(() =>
    documentIntelligenceService.getRecentDocuments(limit)
  );

  useEffect(() => {
    const unsubscribe = documentIntelligenceService.subscribe(() => {
      setDocuments(documentIntelligenceService.getRecentDocuments(limit));
    });
    return unsubscribe;
  }, [limit]);

  return documents;
}
