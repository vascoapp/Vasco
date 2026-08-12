/**
 * The job-detail quick-action buttons are ~85pt wide and sit four to a row.
 *
 * They originally rendered `jobs.photo` / `jobForms.fillIn` / `jobs.onMyWay`,
 * which are full action SENTENCES — "Formulier invullen", "Remplir le
 * formulaire", "Ich bin unterwegs". English defaults in the code read "Photo"
 * and "Form", so nothing looked wrong while reading the source; on a Dutch
 * device the labels wrapped to three lines and clipped. Same class as the
 * login CTA that shipped cut to "Account aanmake": the base locale fits and
 * every other one does not.
 *
 * `jobs.quick*` are deliberately NOUNS. This pins that — a translator or a
 * future edit that expands one back into a phrase fails here rather than on a
 * contractor's phone. The full sentences remain correct as accessibility
 * labels and alert titles, so nothing is lost by keeping the captions terse.
 */
import de from '../locales/de.json';
import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import itLocale from '../locales/it.json';
import nl from '../locales/nl.json';

const LOCALES: Record<string, any> = { en, nl, de, fr, es, it: itLocale };

const COMPACT_KEYS = [
  'quickPhoto',
  'quickForm',
  'quickOnMyWay',
  'quickDone',
  'quickFeedback',
] as const;

// "On my way" / "En camino" / "In arrivo" are the longest legitimate values and
// sit at 9. 14 leaves room for a reasonable translation while still rejecting a
// sentence — "Formulier invullen" (18) and "Remplir le formulaire" (21) both
// fail, which is the regression this guards.
const MAX_CAPTION_LENGTH = 14;

describe('job quick-action captions stay compact in every locale', () => {
  it.each(Object.keys(LOCALES))('%s', (loc) => {
    const jobs = LOCALES[loc].jobs;
    expect(jobs).toBeDefined();

    for (const key of COMPACT_KEYS) {
      const value = jobs[key];
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
      // A caption is one word, occasionally two. Never a clause.
      expect(value.length).toBeLessThanOrEqual(MAX_CAPTION_LENGTH);
    }
  });

  it('is shorter than the full action sentence it replaced', () => {
    // The point of the split: if these ever converge, the caption has grown
    // back into the sentence and the buttons clip again.
    for (const loc of Object.keys(LOCALES)) {
      const l = LOCALES[loc];
      expect(l.jobs.quickPhoto.length).toBeLessThan(l.jobs.photo.length);
      expect(l.jobs.quickForm.length).toBeLessThan(l.jobForms.fillIn.length);
    }
  });
});
