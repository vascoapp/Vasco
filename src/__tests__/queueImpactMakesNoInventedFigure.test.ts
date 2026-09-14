/**
 * @jest-environment node
 */
// A queue card's impact line may say what an action is FOR, not a figure
// nothing measured.
//
// "Speeds up payment by ~5 days" and "Increases acceptance rate by 20%" sat on
// every reminder and quote follow-up card in six languages — while the dunning
// pack's own copy of the same phrases (workflow.*) already said it without a
// number. Neither figure is computed anywhere (learnings #103, #312).
import fs from 'fs';
import path from 'path';

const KEYS = [
  'aiQueue.speedsUpPayment', 'aiQueue.increasesAcceptance',
  'workflow.speedsUpPayment', 'workflow.increasesAcceptance', 'workflow.savesTime',
  'workflow.customerSatisfaction', 'workflow.recurringWork', 'workflow.preventsDelay',
  'workflow.professionalFinish', 'workflow.buildsReputation', 'workflow.staysCompliant',
];

describe('queue impact phrases carry no invented figure', () => {
  for (const loc of ['en', 'nl', 'de', 'fr', 'es', 'it']) {
    it(loc, () => {
      const d = JSON.parse(fs.readFileSync(path.join(__dirname, '../i18n/locales', `${loc}.json`), 'utf8'));
      const withFigures = KEYS
        .map((k) => [k, k.split('.').reduce((o: any, p) => o?.[p], d)] as const)
        .filter(([, v]) => typeof v === 'string' && /\d/.test(v as string));
      expect(withFigures).toEqual([]);
    });
  }
});
