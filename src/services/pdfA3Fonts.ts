/**
 * The TrueType bytes the PDF/A-3 hybrid embeds (src/integrations/pdfA3Invoice.ts).
 *
 * PDF/A requires every font embedded; the bundled Inter TTFs — the same files
 * the app already loads for its UI, OFL-licensed — are read back as bytes via
 * expo-asset (JS-only: expo-asset ships inside every Expo build, so this stays
 * on the OTA channel). Read once per session.
 */
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import type { PdfA3Fonts } from '../integrations/pdfA3Invoice';

let cached: Promise<PdfA3Fonts> | null = null;

async function bytesOf(moduleId: number): Promise<Uint8Array> {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) throw new Error('font asset has no local file');
  return new File(uri).bytes();
}

export function loadPdfA3Fonts(): Promise<PdfA3Fonts> {
  if (!cached) {
    cached = (async () => ({
      regular: await bytesOf(require('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf')),
      bold: await bytesOf(require('@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf')),
    }))();
    // A failed read must not poison every later export of the session.
    cached.catch(() => { cached = null; });
  }
  return cached;
}
