// BuildOS Document Ingestion Service
// Handles document classification, extraction, and processing for CRE documents

import type {
  CREDocumentType,
  ClassificationResult,
  CREExtractionResult,
  ExtractedPaymentCert,
  ExtractedChangeOrder,
  ExtractedContract,
  ExtractedPermit,
  ExtractedInvoice,
  ExtractedSiteReport,
  ExtractedQSValuation,
  ExtractedInsurance,
  ExtractionMeta,
} from './buildosSchema';
import type { Currency } from '../types/buildos';

// ============================================
// DOCUMENT CLASSIFIER
// ============================================

const DOCUMENT_KEYWORDS: Record<CREDocumentType, string[]> = {
  'payment-application': ['payment application', 'interim application', 'valuation', 'claim'],
  'payment-certificate': ['payment certificate', 'interim certificate', 'certified amount'],
  'change-order': ['change order', 'variation instruction', 'architect instruction'],
  'variation-order': ['variation order', 'VO', 'scope change', 'compensation event'],
  'contract': ['agreement', 'contract sum', 'jct', 'fidic', 'nec', 'conditions of contract'],
  'subcontract': ['subcontract', 'sub-contract', 'domestic subcontractor'],
  'professional-appointment': ['appointment', 'professional services', 'fee proposal', 'scope of services'],
  'permit-application': ['planning application', 'omgevingsvergunning', 'bouwvergunning', 'building control'],
  'permit-decision': ['planning permission', 'approval notice', 'decision notice', 'conditions attached'],
  'site-report': ['daily report', 'site diary', 'progress report', 'work completed'],
  'qs-valuation': ['qs valuation', 'quantity surveyor', 'measured works', 'bill of quantities'],
  'invoice': ['invoice', 'factuur', 'rechnung', 'tax invoice', 'vat invoice'],
  'insurance-certificate': ['insurance certificate', 'certificate of insurance', 'car policy', 'professional indemnity'],
  'bond': ['performance bond', 'advance payment bond', 'retention bond'],
  unknown: [],
};

export function classifyDocument(text: string): ClassificationResult {
  const lowerText = text.toLowerCase();
  const scores: { type: CREDocumentType; score: number }[] = [];

  for (const [docType, keywords] of Object.entries(DOCUMENT_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        score += keyword.split(' ').length; // Weight multi-word matches higher
      }
    }
    if (score > 0) {
      scores.push({ type: docType as CREDocumentType, score });
    }
  }

  scores.sort((a, b) => b.score - a.score);

  if (scores.length === 0) {
    return { docType: 'unknown', confidence: 0 };
  }

  const topScore = scores[0];
  const maxPossible = DOCUMENT_KEYWORDS[topScore.type].reduce(
    (sum, kw) => sum + kw.split(' ').length,
    0
  );
  const confidence = Math.min(1, topScore.score / Math.max(maxPossible, 1));

  return {
    docType: topScore.type,
    confidence,
    alternativeTypes: scores.slice(1, 3).map((s) => ({
      type: s.type,
      confidence: Math.min(1, s.score / Math.max(maxPossible, 1)),
    })),
  };
}

// ============================================
// EXTRACTION UTILITIES
// ============================================

function toNumber(value: string): number {
  const cleaned = value.replace(/[€£$,\s]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function extractDate(text: string, pattern: RegExp): string | undefined {
  const match = text.match(pattern);
  if (match) {
    // Normalize date format to ISO
    const dateStr = match[1];
    // Try common date formats
    const parts = dateStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (parts) {
      const [, d, m, y] = parts;
      const year = y.length === 2 ? `20${y}` : y;
      return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }
  return undefined;
}

function extractCurrency(text: string): Currency {
  if (text.includes('£')) return 'GBP';
  return 'EUR';
}

function createMeta(sourceFile: string, startTime: number): ExtractionMeta {
  return {
    extractedAt: new Date().toISOString(),
    processingTimeMs: Date.now() - startTime,
    confidence: 'medium',
    confidenceScore: 0.75,
    warnings: [],
    sourceFile,
  };
}

// ============================================
// MOCK EXTRACTION (Demo)
// ============================================

function extractPaymentCert(text: string, sourceFile: string): CREExtractionResult {
  const startTime = Date.now();

  const document: ExtractedPaymentCert = {
    docType: 'payment-certificate',
    certNumber: 5,
    period: 'January 2024',
    periodEnd: '2024-01-31',
    contractor: 'BuildRight Construction Ltd',
    projectRef: 'PRJ-UK-001',
    lines: [
      {
        costCode: '100',
        description: 'Preliminaries',
        contractSum: 250000,
        previousCertified: 200000,
        thisPeriod: 25000,
        cumulativeCertified: 225000,
        percentComplete: 90,
      },
      {
        costCode: '200',
        description: 'Substructure',
        contractSum: 1500000,
        previousCertified: 1350000,
        thisPeriod: 100000,
        cumulativeCertified: 1450000,
        percentComplete: 97,
      },
      {
        costCode: '300',
        description: 'Superstructure',
        contractSum: 3200000,
        previousCertified: 1920000,
        thisPeriod: 320000,
        cumulativeCertified: 2240000,
        percentComplete: 70,
      },
    ],
    grossValuation: 3915000,
    lessPreviousCerts: 3470000,
    netPayable: 445000,
    retentionHeld: 19575,
    retentionPercent: 5,
    vatAmount: 85085,
    totalDue: 510510,
    currency: extractCurrency(text),
    qsSigned: true,
    clientSigned: false,
  };

  return {
    document,
    meta: createMeta(sourceFile, startTime),
  };
}

function extractChangeOrder(text: string, sourceFile: string): CREExtractionResult {
  const startTime = Date.now();

  const document: ExtractedChangeOrder = {
    docType: 'change-order',
    coNumber: 'CO-2024-012',
    projectRef: 'PRJ-UK-001',
    contractRef: 'CON-001',
    contractor: 'BuildRight Construction Ltd',
    description: 'Additional fire stopping requirements to level 3 risers',
    reason: 'Building control comment requiring enhanced fire stopping specification',
    requestedBy: 'Architect',
    dateSubmitted: '2024-01-15',
    proposedCost: 45000,
    proposedTimeImpact: 5,
    currency: extractCurrency(text),
    status: 'pending',
    breakdown: [
      { category: 'Labour', amount: 18000 },
      { category: 'Materials', amount: 22000 },
      { category: 'Preliminaries', amount: 5000 },
    ],
  };

  return {
    document,
    meta: createMeta(sourceFile, startTime),
  };
}

function extractInvoice(text: string, sourceFile: string): CREExtractionResult {
  const startTime = Date.now();

  const document: ExtractedInvoice = {
    docType: 'invoice',
    invoiceNumber: 'INV-2024-0089',
    invoiceDate: '2024-01-20',
    dueDate: '2024-02-19',
    supplier: 'Quality Materials Ltd',
    project: 'Whitechapel Mixed-Use',
    costCode: '410',
    lines: [
      {
        description: 'Structural steel - Grade S355',
        quantity: 45,
        unitPrice: 1200,
        totalPrice: 54000,
      },
      {
        description: 'Steel fixings and connections',
        quantity: 1,
        unitPrice: 8500,
        totalPrice: 8500,
      },
      {
        description: 'Delivery and crane offload',
        quantity: 1,
        unitPrice: 2500,
        totalPrice: 2500,
      },
    ],
    subtotal: 65000,
    vatRate: 20,
    vatAmount: 13000,
    total: 78000,
    currency: extractCurrency(text),
    paymentDetails: {
      bankName: 'Barclays',
      iban: 'GB82 WEST 1234 5698 7654 32',
    },
  };

  return {
    document,
    meta: createMeta(sourceFile, startTime),
  };
}

function extractSiteReport(text: string, sourceFile: string): CREExtractionResult {
  const startTime = Date.now();

  const document: ExtractedSiteReport = {
    docType: 'site-report',
    reportDate: new Date().toISOString().split('T')[0],
    project: 'Whitechapel Mixed-Use Development',
    weather: 'Overcast, occasional light rain',
    temperature: 8,
    workforceCount: 85,
    hoursWorked: 680,
    workCompleted: [
      'Level 3 slab pour completed - 180m³',
      'M&E first fix ongoing floors 1-2',
      'Façade panels installed - north elevation 40%',
      'Lift shaft construction progressing',
    ],
    delaysEncountered: [
      'Crane standby due to wind speed 11:00-13:00',
    ],
    safetyObservations: [
      'All personnel wearing correct PPE',
      'Edge protection satisfactory',
      'Housekeeping good',
    ],
    deliveries: [
      { supplier: 'Ready Mix Ltd', description: 'Concrete C40 - 180m³' },
      { supplier: 'Steel Co', description: 'Rebar - 12 tonnes' },
    ],
    visitorsOnSite: [
      'Client representative - site walk',
      'Building control - inspection',
    ],
    photos: 24,
    preparedBy: 'John Smith, Site Manager',
  };

  return {
    document,
    meta: createMeta(sourceFile, startTime),
  };
}

// ============================================
// MAIN EXTRACTION FUNCTION
// ============================================

export async function extractDocument(
  text: string,
  sourceFile: string,
  forceType?: CREDocumentType
): Promise<CREExtractionResult | null> {
  const classification = forceType
    ? { docType: forceType, confidence: 1 }
    : classifyDocument(text);

  switch (classification.docType) {
    case 'payment-certificate':
    case 'payment-application':
      return extractPaymentCert(text, sourceFile);
    case 'change-order':
    case 'variation-order':
      return extractChangeOrder(text, sourceFile);
    case 'invoice':
      return extractInvoice(text, sourceFile);
    case 'site-report':
      return extractSiteReport(text, sourceFile);
    default:
      // For unhandled types, return basic invoice extraction
      return extractInvoice(text, sourceFile);
  }
}

// ============================================
// BATCH PROCESSING
// ============================================

export interface IngestionBatch {
  id: string;
  startedAt: string;
  completedAt?: string;
  files: {
    name: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    result?: CREExtractionResult;
    error?: string;
  }[];
  stats: {
    total: number;
    completed: number;
    failed: number;
  };
}

export function createBatch(fileNames: string[]): IngestionBatch {
  return {
    id: `batch-${Date.now()}`,
    startedAt: new Date().toISOString(),
    files: fileNames.map((name) => ({
      name,
      status: 'pending',
    })),
    stats: {
      total: fileNames.length,
      completed: 0,
      failed: 0,
    },
  };
}
