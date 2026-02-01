// =============================================================================
// INVOICE EXTRACTOR SERVICE
// =============================================================================
// Extracts product and pricing data from supplier invoices/receipts
// Feeds data into the pricing intelligence moat
// =============================================================================

import { pricingApi, PriceObservation } from '../api/pricingApi';
import { trackUserAction } from '../intelligence/intelligenceEngine';

// ============================================
// TYPES
// ============================================

export interface ExtractedLineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  confidence: number;

  // Extracted/inferred details
  productName?: string;
  brand?: string;
  sku?: string;
  category?: string;
}

export interface ExtractedInvoice {
  id: string;

  // Document info
  documentType: 'invoice' | 'receipt' | 'quote' | 'order' | 'unknown';
  documentNumber?: string;
  documentDate?: string;

  // Supplier info
  supplierName?: string;
  supplierId?: string;
  supplierAddress?: string;
  supplierVatNumber?: string;

  // Totals
  subtotal?: number;
  vatAmount?: number;
  vatRate?: number;
  total?: number;
  currency: string;

  // Line items
  lineItems: ExtractedLineItem[];

  // Extraction metadata
  rawText: string;
  extractionConfidence: number;
  extractedAt: string;
  sourceUri: string;
}

export interface ExtractionResult {
  success: boolean;
  invoice?: ExtractedInvoice;
  errors: string[];
  warnings: string[];

  // Pricing moat results
  priceObservationsCreated: number;
  materialsResolved: number;
}

// ============================================
// SUPPLIER PATTERNS
// ============================================

interface SupplierPattern {
  id: string;
  name: string;
  patterns: RegExp[];
  lineItemPattern?: RegExp;
  dateFormats: string[];
}

const KNOWN_SUPPLIERS: SupplierPattern[] = [
  {
    id: 'hornbach_nl',
    name: 'Hornbach',
    patterns: [/hornbach/i, /hornbach\.nl/i],
    dateFormats: ['DD-MM-YYYY', 'DD/MM/YYYY'],
  },
  {
    id: 'praxis_nl',
    name: 'Praxis',
    patterns: [/praxis/i, /praxis\.nl/i],
    dateFormats: ['DD-MM-YYYY'],
  },
  {
    id: 'gamma_nl',
    name: 'Gamma',
    patterns: [/gamma/i, /gamma\.nl/i],
    dateFormats: ['DD-MM-YYYY'],
  },
  {
    id: 'technische_unie_nl',
    name: 'Technische Unie',
    patterns: [/technische\s*unie/i, /tu\s*\d+/i],
    dateFormats: ['DD-MM-YYYY'],
  },
  {
    id: 'bouwmaat_nl',
    name: 'Bouwmaat',
    patterns: [/bouwmaat/i],
    dateFormats: ['DD-MM-YYYY'],
  },
  {
    id: 'sanitairwinkel_nl',
    name: 'Sanitairwinkel',
    patterns: [/sanitairwinkel/i],
    dateFormats: ['DD-MM-YYYY'],
  },
];

// ============================================
// INVOICE EXTRACTOR SERVICE
// ============================================

class InvoiceExtractorService {
  // -----------------------------------------
  // Main Extraction
  // -----------------------------------------

  /**
   * Extract invoice data from text (from OCR or PDF parsing)
   */
  async extractFromText(
    text: string,
    sourceUri: string
  ): Promise<ExtractionResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 1. Detect document type
      const documentType = this.detectDocumentType(text);

      // 2. Identify supplier
      const supplier = this.identifySupplier(text);

      // 3. Extract header info
      const headerInfo = this.extractHeaderInfo(text, supplier);

      // 4. Extract line items
      const lineItems = this.extractLineItems(text, supplier);

      if (lineItems.length === 0) {
        warnings.push('No line items could be extracted');
      }

      // 5. Calculate totals
      const totals = this.extractTotals(text, lineItems);

      // 6. Build invoice object
      const invoice: ExtractedInvoice = {
        id: `extract_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        documentType,
        documentNumber: headerInfo.documentNumber,
        documentDate: headerInfo.documentDate,
        supplierName: supplier?.name || headerInfo.supplierName,
        supplierId: supplier?.id,
        subtotal: totals.subtotal,
        vatAmount: totals.vatAmount,
        vatRate: totals.vatRate,
        total: totals.total,
        currency: 'EUR',
        lineItems,
        rawText: text,
        extractionConfidence: this.calculateOverallConfidence(lineItems, supplier),
        extractedAt: new Date().toISOString(),
        sourceUri,
      };

      // 7. Feed into pricing moat
      const moatResults = await this.feedPricingMoat(invoice);

      // Track extraction event
      trackUserAction('invoice_extracted', {
        documentType,
        supplierId: supplier?.id,
        supplierName: supplier?.name,
        lineItemCount: lineItems.length,
        totalAmount: totals.total,
        priceObservationsCreated: moatResults.observationsCreated,
      });

      return {
        success: true,
        invoice,
        errors,
        warnings,
        priceObservationsCreated: moatResults.observationsCreated,
        materialsResolved: moatResults.materialsResolved,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);

      return {
        success: false,
        errors,
        warnings,
        priceObservationsCreated: 0,
        materialsResolved: 0,
      };
    }
  }

  // -----------------------------------------
  // Document Type Detection
  // -----------------------------------------

  private detectDocumentType(text: string): ExtractedInvoice['documentType'] {
    const textLower = text.toLowerCase();

    if (textLower.includes('factuur') || textLower.includes('invoice')) {
      return 'invoice';
    }
    if (textLower.includes('kassabon') || textLower.includes('receipt') || textLower.includes('bon')) {
      return 'receipt';
    }
    if (textLower.includes('offerte') || textLower.includes('quote') || textLower.includes('quotation')) {
      return 'quote';
    }
    if (textLower.includes('bestelling') || textLower.includes('order')) {
      return 'order';
    }

    return 'unknown';
  }

  // -----------------------------------------
  // Supplier Identification
  // -----------------------------------------

  private identifySupplier(text: string): SupplierPattern | null {
    for (const supplier of KNOWN_SUPPLIERS) {
      for (const pattern of supplier.patterns) {
        if (pattern.test(text)) {
          return supplier;
        }
      }
    }
    return null;
  }

  // -----------------------------------------
  // Header Extraction
  // -----------------------------------------

  private extractHeaderInfo(text: string, supplier: SupplierPattern | null): {
    documentNumber?: string;
    documentDate?: string;
    supplierName?: string;
  } {
    const result: {
      documentNumber?: string;
      documentDate?: string;
      supplierName?: string;
    } = {};

    // Extract document number
    const docNumPatterns = [
      /(?:factuur|invoice|bon)[\s#:]*([A-Z0-9\-]+)/i,
      /(?:nr|no|number)[\s.:]*([A-Z0-9\-]+)/i,
      /#\s*(\d+)/,
    ];

    for (const pattern of docNumPatterns) {
      const match = text.match(pattern);
      if (match) {
        result.documentNumber = match[1];
        break;
      }
    }

    // Extract date
    const datePatterns = [
      /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
      /(\d{1,2}\s+(?:jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec)[a-z]*\s+\d{2,4})/i,
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        result.documentDate = match[1];
        break;
      }
    }

    // Extract supplier name if not already identified
    if (!supplier) {
      // Look for company indicators
      const companyPatterns = [
        /([A-Z][A-Za-z\s]+(?:B\.?V\.?|N\.?V\.?|BV|NV|VOF))/,
        /^([A-Z][A-Za-z\s]{3,30})$/m,
      ];

      for (const pattern of companyPatterns) {
        const match = text.match(pattern);
        if (match) {
          result.supplierName = match[1].trim();
          break;
        }
      }
    }

    return result;
  }

  // -----------------------------------------
  // Line Item Extraction
  // -----------------------------------------

  private extractLineItems(text: string, supplier: SupplierPattern | null): ExtractedLineItem[] {
    const items: ExtractedLineItem[] = [];

    // Generic line item patterns
    const linePatterns = [
      // Description followed by quantity, unit price, total
      /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(?:st|stuk|m|m2|l|kg|pcs?)?\s+[€$]?\s*(\d+(?:[.,]\d+)?)\s+[€$]?\s*(\d+(?:[.,]\d+)?)/gim,
      // Description with price at end
      /^(.+?)\s+[€$]\s*(\d+(?:[.,]\d+)?)/gim,
      // Quantity x price format
      /(\d+)\s*[xX]\s*(.+?)\s+[€$]?\s*(\d+(?:[.,]\d+)?)/gim,
    ];

    for (const pattern of linePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const item = this.parseLineItemMatch(match);
        if (item && item.unitPrice > 0) {
          items.push(item);
        }
      }

      // If we found items with this pattern, don't try others
      if (items.length > 0) break;
    }

    // Deduplicate by description similarity
    return this.deduplicateItems(items);
  }

  private parseLineItemMatch(match: RegExpExecArray): ExtractedLineItem | null {
    try {
      const groups = match.slice(1);

      // Try to parse based on captured groups
      if (groups.length >= 4) {
        // Full format: description, quantity, unit price, total
        const description = groups[0].trim();
        const quantity = this.parseNumber(groups[1]);
        const unitPrice = this.parseNumber(groups[2]);
        const totalPrice = this.parseNumber(groups[3]);

        if (quantity > 0 && unitPrice > 0) {
          return this.createLineItem(description, quantity, unitPrice, totalPrice);
        }
      } else if (groups.length >= 2) {
        // Simple format: description, price
        const description = groups[0].trim();
        const price = this.parseNumber(groups[1]);

        if (price > 0) {
          return this.createLineItem(description, 1, price, price);
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private createLineItem(
    description: string,
    quantity: number,
    unitPrice: number,
    totalPrice: number
  ): ExtractedLineItem {
    // Infer product details from description
    const { productName, brand, category } = this.inferProductDetails(description);

    // Detect unit from description
    const unit = this.detectUnit(description);

    return {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      description,
      quantity,
      unit,
      unitPrice,
      totalPrice: totalPrice || quantity * unitPrice,
      confidence: this.calculateItemConfidence(description, unitPrice),
      productName,
      brand,
      category,
    };
  }

  private parseNumber(str: string): number {
    if (!str) return 0;
    // Handle European number format (comma as decimal separator)
    const normalized = str.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? 0 : num;
  }

  private detectUnit(description: string): string {
    const descLower = description.toLowerCase();

    if (descLower.includes('m2') || descLower.includes('m²')) return 'm2';
    if (descLower.includes(' m ') || descLower.match(/\d+\s*m$/)) return 'm';
    if (descLower.includes(' l ') || descLower.includes('liter')) return 'l';
    if (descLower.includes(' kg ') || descLower.includes('kilo')) return 'kg';
    if (descLower.includes('stuk') || descLower.includes('stuks')) return 'piece';

    return 'piece';
  }

  private inferProductDetails(description: string): {
    productName?: string;
    brand?: string;
    category?: string;
  } {
    const result: { productName?: string; brand?: string; category?: string } = {};

    // Common brands to look for
    const brands = [
      'Grohe', 'Hansgrohe', 'Geberit', 'Villeroy', 'Duravit',
      'Flexa', 'Sikkens', 'Dulux', 'Sigma',
      'Philips', 'Niko', 'Jung', 'Busch',
      'Bosch', 'Makita', 'DeWalt', 'Milwaukee',
    ];

    for (const brand of brands) {
      if (description.toLowerCase().includes(brand.toLowerCase())) {
        result.brand = brand;
        break;
      }
    }

    // Clean up product name (remove codes, prices)
    result.productName = description
      .replace(/[A-Z0-9]{6,}/g, '') // Remove long codes
      .replace(/€\s*[\d.,]+/g, '') // Remove prices
      .replace(/\s+/g, ' ')
      .trim();

    // Infer category
    result.category = this.inferCategory(description);

    return result;
  }

  private inferCategory(description: string): string | undefined {
    const descLower = description.toLowerCase();

    // Paint
    if (descLower.match(/verf|paint|latex|primer|lak/)) return 'paint';

    // Tiles
    if (descLower.match(/tegel|tile|vloertegel|wandtegel/)) return 'tiles';

    // Plumbing
    if (descLower.match(/kraan|tap|wc|toilet|wastafel|douche|bad|pvc|buis|fitting/)) return 'plumbing';

    // Electrical
    if (descLower.match(/schakelaar|stopcontact|kabel|lamp|led|fitting|zekering/)) return 'electrical';

    // Wood
    if (descLower.match(/hout|plank|balk|multiplex|mdf|spaanplaat/)) return 'wood';

    // Fasteners
    if (descLower.match(/schroef|bout|moer|plug|anker|nagel/)) return 'fasteners';

    // Tools
    if (descLower.match(/boor|zaag|hamer|schroevendraaier|tang|sleutel/)) return 'tools';

    return undefined;
  }

  private calculateItemConfidence(description: string, price: number): number {
    let confidence = 0.5;

    // Has brand → higher confidence
    if (this.inferProductDetails(description).brand) confidence += 0.15;

    // Has category → higher confidence
    if (this.inferCategory(description)) confidence += 0.1;

    // Reasonable price range → higher confidence
    if (price > 0.5 && price < 10000) confidence += 0.1;

    // Description length (not too short, not too long)
    if (description.length > 10 && description.length < 100) confidence += 0.1;

    return Math.min(confidence, 1);
  }

  private deduplicateItems(items: ExtractedLineItem[]): ExtractedLineItem[] {
    const seen = new Map<string, ExtractedLineItem>();

    for (const item of items) {
      const key = `${item.description.toLowerCase()}_${item.unitPrice}`;
      const existing = seen.get(key);

      if (!existing || item.confidence > existing.confidence) {
        seen.set(key, item);
      }
    }

    return Array.from(seen.values());
  }

  // -----------------------------------------
  // Totals Extraction
  // -----------------------------------------

  private extractTotals(text: string, lineItems: ExtractedLineItem[]): {
    subtotal?: number;
    vatAmount?: number;
    vatRate?: number;
    total?: number;
  } {
    const result: {
      subtotal?: number;
      vatAmount?: number;
      vatRate?: number;
      total?: number;
    } = {};

    // Try to extract from text
    const totalPattern = /(?:totaal|total|te betalen|amount due)[:\s]*[€$]?\s*([\d.,]+)/i;
    const subtotalPattern = /(?:subtotaal|subtotal|excl\.?\s*btw)[:\s]*[€$]?\s*([\d.,]+)/i;
    const vatPattern = /(?:btw|vat|tax)\s*(?:\(?\s*(\d+)\s*%?\s*\)?)?[:\s]*[€$]?\s*([\d.,]+)/i;

    const totalMatch = text.match(totalPattern);
    if (totalMatch) {
      result.total = this.parseNumber(totalMatch[1]);
    }

    const subtotalMatch = text.match(subtotalPattern);
    if (subtotalMatch) {
      result.subtotal = this.parseNumber(subtotalMatch[1]);
    }

    const vatMatch = text.match(vatPattern);
    if (vatMatch) {
      if (vatMatch[1]) result.vatRate = parseInt(vatMatch[1], 10);
      if (vatMatch[2]) result.vatAmount = this.parseNumber(vatMatch[2]);
    }

    // Calculate from line items if not found
    if (!result.subtotal && lineItems.length > 0) {
      result.subtotal = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
    }

    if (!result.total && result.subtotal) {
      const vatRate = result.vatRate || 21;
      result.vatAmount = result.subtotal * (vatRate / 100);
      result.total = result.subtotal + result.vatAmount;
    }

    return result;
  }

  // -----------------------------------------
  // Pricing Moat Integration
  // -----------------------------------------

  private async feedPricingMoat(invoice: ExtractedInvoice): Promise<{
    observationsCreated: number;
    materialsResolved: number;
  }> {
    let observationsCreated = 0;
    let materialsResolved = 0;

    if (!invoice.supplierId || invoice.lineItems.length === 0) {
      return { observationsCreated, materialsResolved };
    }

    const observations: Omit<PriceObservation, 'id'>[] = [];

    for (const item of invoice.lineItems) {
      // Skip items without valid price
      if (item.unitPrice <= 0) continue;

      // Generate material ID
      const materialId = this.generateMaterialId(item);

      observations.push({
        materialId,
        materialName: item.productName || item.description,
        supplierId: invoice.supplierId,
        supplierName: invoice.supplierName || 'Unknown',
        price: item.unitPrice,
        currency: invoice.currency,
        unit: item.unit,
        observedAt: invoice.documentDate || invoice.extractedAt,
        source: 'invoice',
        confidence: item.confidence,
      });
    }

    // Bulk import to pricing API
    if (observations.length > 0) {
      try {
        const result = await pricingApi.bulkImportPrices(observations);
        observationsCreated = result.imported;
        // In production, would also count resolved materials
        materialsResolved = Math.floor(result.imported * 0.8); // Estimate
      } catch (error) {
        console.error('Failed to import prices:', error);
      }
    }

    return { observationsCreated, materialsResolved };
  }

  private generateMaterialId(item: ExtractedLineItem): string {
    const parts = [
      item.category || 'unknown',
      item.brand?.toLowerCase().replace(/\s+/g, '_'),
      (item.productName || item.description)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .substring(0, 30),
    ].filter(Boolean);

    return parts.join('_');
  }

  // -----------------------------------------
  // Confidence Calculation
  // -----------------------------------------

  private calculateOverallConfidence(
    lineItems: ExtractedLineItem[],
    supplier: SupplierPattern | null
  ): number {
    let confidence = 0.3;

    // Known supplier → higher confidence
    if (supplier) confidence += 0.2;

    // Line items found → higher confidence
    if (lineItems.length > 0) {
      confidence += 0.2;

      // Average line item confidence
      const avgItemConfidence = lineItems.reduce((sum, item) => sum + item.confidence, 0) / lineItems.length;
      confidence += avgItemConfidence * 0.3;
    }

    return Math.min(confidence, 1);
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const invoiceExtractor = new InvoiceExtractorService();

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Quick extract from text
 */
export async function extractInvoice(text: string, sourceUri: string = 'manual'): Promise<ExtractionResult> {
  return invoiceExtractor.extractFromText(text, sourceUri);
}

/**
 * Extract from mock PDF text (for demo)
 */
export async function extractFromPdfUri(uri: string): Promise<ExtractionResult> {
  // In production, would use actual PDF parsing
  // For now, use mock text from pdfParser
  const { parsePdfText } = await import('./pdfParser');
  const text = await parsePdfText(uri);
  return invoiceExtractor.extractFromText(text, uri);
}
