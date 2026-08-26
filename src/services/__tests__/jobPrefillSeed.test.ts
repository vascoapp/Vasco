// =============================================================================
// THE PREFILL HEURISTIC SPEAKS SIX LANGUAGES, NOT ONE
// =============================================================================
// `seedHoursForTitle` used to be `/install|renovate|extension/i`,
// `/replace|repair|fix/i`, `/check|inspect|quote/i` — English only — matched
// against a title the contractor types in their OWN language. "Heizungswartung",
// "CV-ketel onderhoud" and "remplacement chaudière" matched nothing, so every
// non-English job fell to the flat 3-hour default and the duration predictor
// was seeded with no signal at all.
//
// That is the home-market-default shape (#148/#151/#155/#157) with a twist: the
// home market here was *English*, which is not one of the six markets this app
// ships to.
// =============================================================================

import { seedHoursForTitle } from '../jobPrefillService';

const LONG = 6;
const MEDIUM = 3;
const SHORT = 1;

describe('seedHoursForTitle — the six languages agree with each other', () => {
  it.each([
    ['en', 'Install new boiler', LONG],
    ['nl', 'Nieuwe cv-ketel installeren', LONG],
    ['de', 'Neue Heizung einbauen', LONG],
    ['fr', 'Installation d’une nouvelle chaudière', LONG],
    ['es', 'Instalación de caldera nueva', LONG],
    ['it', 'Installazione nuova caldaia', LONG],
  ])('%s: fitting something new is a long job', (_l, title, hours) => {
    expect(seedHoursForTitle(title)).toBe(hours);
  });

  it.each([
    ['en', 'Boiler repair', MEDIUM],
    ['nl', 'CV-ketel onderhoud', MEDIUM],
    ['de', 'Heizungswartung', MEDIUM],
    ['fr', 'Remplacement chaudière', MEDIUM],
    ['es', 'Reparación de caldera', MEDIUM],
    ['it', 'Riparazione caldaia', MEDIUM],
  ])('%s: a repair or a service is half a day', (_l, title, hours) => {
    expect(seedHoursForTitle(title)).toBe(hours);
  });

  it.each([
    ['en', 'Inspect the roof', SHORT],
    ['nl', 'Inspectie dak', SHORT],
    ['de', 'Dachbesichtigung', SHORT],
    ['fr', 'Contrôle de la toiture', SHORT],
    ['es', 'Inspección del tejado', SHORT],
    ['it', 'Ispezione del tetto', SHORT],
  ])('%s: looking at it is an hour', (_l, title, hours) => {
    expect(seedHoursForTitle(title)).toBe(hours);
  });

  it('reads a German compound, which is how German writes a job title', () => {
    // The whole reason stems are matched as substrings: there is no word
    // boundary between "Heizungs" and "wartung", and a `\b`-anchored list
    // would miss every compound a German contractor actually types.
    expect(seedHoursForTitle('Dachrinnenreparatur')).toBe(MEDIUM);
    expect(seedHoursForTitle('Badezimmersanierung')).toBe(LONG);
    expect(seedHoursForTitle('Heizungsüberprüfung')).toBe(SHORT);
  });

  it('does not fire on a short token buried in an unrelated word', () => {
    // Short tokens are word-boundary matched; long stems are not. "fit" is a
    // LONG word and sits inside "profit", so a naive substring match would
    // score this six hours instead of one. The assertion has to discriminate
    // between two DIFFERENT buckets to mean anything — comparing against the
    // 3-hour default proves nothing, because that is also what an unmatched
    // title returns.
    expect(seedHoursForTitle('Profit inspectie')).toBe(SHORT);
    // The word itself, standing alone, still matches.
    expect(seedHoursForTitle('Fit new radiator')).toBe(LONG);
  });

  it('word-boundaries respect accented letters, where \\b would not', () => {
    // JS `\b` is ASCII-only: it sees a boundary between "pr" and "üfen", so a
    // \b-anchored "prüfen" would match inside words it should not, and an
    // accented word at the start of a title could fail to match at all.
    expect(seedHoursForTitle('Contrôle chaudière')).toBe(SHORT);
    expect(seedHoursForTitle('Réparation toiture')).toBe(MEDIUM);
  });

  it('still defaults to half a day when nothing matches', () => {
    // The default is deliberately the SAME as the medium bucket: an unreadable
    // title should not produce a confident answer in either direction.
    expect(seedHoursForTitle('Familie Krüger')).toBe(MEDIUM);
    expect(seedHoursForTitle('')).toBe(MEDIUM);
  });

  it('carries no price — a prediction may not fill a field that asserts a fact', () => {
    // `LABOR_RATE` was a hardcoded table of invented €/hour rates served to
    // every contractor in every country, and `addJob` stamped its output into
    // `quotedAmount`. The table is gone with the field (#207); if this import
    // ever resolves again, the guess has come back.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('../jobPrefillService');
    expect(mod.LABOR_RATE).toBeUndefined();
  });
});
