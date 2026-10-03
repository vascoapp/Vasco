/** Everyday matrix cell ES-b2b — see __matrix__/driver.ts. ONE cell per file (module-scoped AppState). */
import { runEverydayCell } from './driver';

jest.mock('expo-print', () => require('./mocks').printMock);
jest.mock('expo-file-system', () => require('./mocks').fileSystemMock);
jest.mock('expo-sharing', () => require('./mocks').sharingMock);
jest.mock('../src/integrations/pdfA3Invoice', () => ({ ...jest.requireActual('../src/integrations/pdfA3Invoice') }));
jest.mock('../src/services/pdfA3Fonts', () => ({ ...jest.requireActual('../src/services/pdfA3Fonts'), ...require('./mocks').pdfA3FontsMock }));

it('everyday case ES-b2b: from onboarding to the exported invoice', async () => {
  // The verdict is the validator half (npm run matrix); this only records.
  await runEverydayCell('ES', 'b2b');
});
