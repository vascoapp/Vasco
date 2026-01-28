import { ExtractedDocument } from './pdfSchema';
import { extractedPdfHistory } from '../data/mockExtractedDocs';

export function ingestPdfStub(): ExtractedDocument[] {
  return extractedPdfHistory.map((entry) => entry.document);
}
