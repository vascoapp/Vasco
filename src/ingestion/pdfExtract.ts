import { ExtractedDocument } from './pdfSchema';

const toNumber = (value: string) =>
  Number(value.replace(/\./g, '').replace(',', '.'));

const guessDocType = (text: string): 'quote' | 'invoice' => {
  const lower = text.toLowerCase();
  if (lower.includes('invoice') || lower.includes('factuur')) {
    return 'invoice';
  }
  return 'quote';
};

export function extractDocumentFromText(text: string): ExtractedDocument {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const docType = guessDocType(text);

  const totalMatch = text.match(/(?:total|totaal)[^0-9]*([0-9][0-9.,]+)/i);
  const taxMatch = text.match(/(?:btw|vat)[^0-9]*([0-9][0-9.,]+)/i);

  const total = totalMatch ? toNumber(totalMatch[1]) : 0;
  const taxTotal = taxMatch ? toNumber(taxMatch[1]) : 0;
  const subtotal = total > 0 ? Math.max(total - taxTotal, 0) : 0;

  const lineItems = lines
    .map((line) => {
      const isTotal = /total|totaal|btw|vat/i.test(line);
      if (isTotal) return null;
      const match = line.match(/(.+?)\s+€?\s*([0-9][0-9.,]+)/);
      if (!match) return null;
      const description = match[1].trim();
      const unitPrice = toNumber(match[2]);
      if (!description || !unitPrice) return null;
      return {
        description,
        quantity: 1,
        unitPrice,
        totalPrice: unitPrice,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return {
    source: 'pdf',
    docType,
    lineItems,
    subtotal,
    taxTotal,
    total,
    currency: 'EUR',
  };
}
