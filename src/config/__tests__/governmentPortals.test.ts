/**
 * A contractor must never be shown another country's tax office.
 *
 * The certificates screen rendered DUTCH_GOVERNMENT_PORTALS ungated, so every
 * non-NL contractor was linked to KVK and the Belastingdienst with Dutch
 * descriptions. All six sets already existed; only the wiring was missing.
 */
import { governmentPortalsFor } from '../governmentPortals';
import type { Country } from '../../i18n/formatting';

const EU: Country[] = ['NL', 'DE', 'FR', 'ES', 'IT', 'UK'];

describe('every EU market gets its own portals', () => {
  it.each(EU)('%s has a non-empty set', (c) => {
    expect(governmentPortalsFor(c).length).toBeGreaterThan(0);
  });

  it('gives each country a DISTINCT set — no silent fallback to NL', () => {
    const firstNames = EU.map((c) => governmentPortalsFor(c)[0].name);
    expect(new Set(firstNames).size).toBe(EU.length);
  });

  it('routes each market to its actual tax authority', () => {
    const nameOf = (c: Country) => governmentPortalsFor(c).map((p) => p.name).join(' ');
    expect(nameOf('NL')).toContain('KVK');
    expect(nameOf('DE')).toContain('ELSTER');
    expect(nameOf('FR')).toContain('URSSAF');
    expect(nameOf('ES')).toContain('Agencia Tributaria');
    expect(nameOf('IT')).toContain('Agenzia delle Entrate');
    expect(nameOf('UK')).toContain('HMRC');
  });

  it('never leaks a Dutch portal into another country', () => {
    for (const c of EU.filter((x) => x !== 'NL')) {
      const blob = governmentPortalsFor(c).map((p) => `${p.name} ${p.description} ${p.url}`).join(' ');
      expect(blob).not.toContain('KVK');
      expect(blob).not.toContain('Belastingdienst');
      expect(blob).not.toContain('.nl');
    }
  });

  it('every portal has a usable https URL', () => {
    for (const c of EU) {
      for (const p of governmentPortalsFor(c)) {
        expect(p.url).toMatch(/^https:\/\//);
        expect(p.name.length).toBeGreaterThan(0);
        expect(p.description.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('absence is honest', () => {
  it('US has no set, so the section hides rather than showing Dutch links', () => {
    expect(governmentPortalsFor('US')).toEqual([]);
  });

  it('an undefined country falls back to NL rather than crashing', () => {
    expect(governmentPortalsFor(undefined).length).toBeGreaterThan(0);
  });
});
