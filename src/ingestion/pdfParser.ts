import * as FileSystem from 'expo-file-system';
import { decode as atob } from 'base-64';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf';

export async function parsePdfText(uri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const data = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));

  const pdf = await getDocument({ data, disableWorker: true }).promise;
  let text = '';

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    text += `${pageText}\n`;
  }

  return text;
}
