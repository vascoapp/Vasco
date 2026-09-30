/**
 * Give a printed PDF the document's own name before anyone receives it.
 *
 * `Print.printToFileAsync` writes to a random cache name, and that name IS the
 * attachment: the customer's mail and WhatsApp showed the German invoice
 * RE-2026-0087 as "4b190e6c-420d-4d2f-bb86-5faf7dd4ea2f.pdf" (emulator,
 * 2026-09-30). A file they cannot find again by its number is one they pay
 * late or not at all.
 *
 * Never throws: a failed rename still shares the document, just badly named.
 * Guard: src/__tests__/sharedPdfsCarryTheDocumentNumber.test.ts.
 */
import { File, Paths } from 'expo-file-system';

/** "RE-2026-0087" → "RE-2026-0087.pdf". Only what a file system refuses goes. */
export function pdfFileName(documentNumber: string): string {
  const safe = String(documentNumber ?? '')
    .replace(/[\\/:*?"<>|\s]+/g, '-')
    .replace(/^[-.]+|-+$/g, '');
  return `${safe || 'document'}.pdf`;
}

export function nameThePdf(uri: string, documentNumber: string): string {
  try {
    const target = new File(Paths.cache, pdfFileName(documentNumber));
    // The same document shared twice: the older copy is stale.
    if (target.exists) target.delete();
    const printed = new File(uri);
    printed.move(target);
    return printed.uri;
  } catch {
    return uri;
  }
}
