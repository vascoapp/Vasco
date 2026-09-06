/**
 * formalRegister.test.ts — the T/V-distinction guard.
 *
 * DE and FR address the contractor FORMALLY (Sie / vous); NL, ES and IT address
 * them informally (je / tú / tu). That was swept once by hand (`e94c326`,
 * 138 strings) with NO detector behind it — so when the localized auth emails
 * were written afterwards in `supabase/functions/_shared/authEmailTemplates.ts`,
 * they came out entirely in `du` and `tu` and nothing noticed for six weeks.
 *
 * That file is the reason this test reads TWO sources. It lives under
 * `supabase/functions/` — a Deno tree outside `src/` and `app/` — so every
 * grep-the-app sweep is structurally blind to it, and it renders the FIRST
 * email a German Handwerker ever receives from Vasco. Germany is the beachhead.
 *
 * It is parsed as TEXT rather than imported: the Deno module is not in jest's
 * transform path, and the strings are what we are asserting on anyway.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../..');

type Register = 'formal' | 'informal';

/**
 * Build a word-matcher for a set of pronouns.
 *
 * NOT `\b`: JavaScript's word boundary is defined over [A-Za-z0-9_] only, so
 * an accented letter counts as a NON-word character and manufactures a
 * boundary in the middle of a word. `/\btes\b/` matches inside French
 * "êtes", and `/\btu\b/` inside "vertu". Both would be reported as informal
 * in text that is perfectly formal. Latin-1 letters are added to the class on
 * both sides instead.
 */
const L = 'A-Za-z\u00C0-\u024F';
function words(...forms: string[]): RegExp {
  return new RegExp(`(?<![${L}])(?:${forms.join('|')})(?![${L}])`, 'i');
}

/** Pronoun/possessive markers that identify the register a string is written in. */
const MARKERS: Record<string, { formal: RegExp; informal: RegExp; register: Register }> = {
  de: {
    // German capitalises the formal pronouns; `sie` (she/they) is NOT formal,
    // so these two stay case-SENSITIVE where the lowercase form is a real word.
    formal: new RegExp(`(?<![${L}])(?:Sie|Ihre|Ihren|Ihrem|Ihres|Ihr|Ihnen)(?![${L}])`),
    informal: words('du', 'dein', 'deine', 'deinen', 'deinem', 'deiner', 'deines', 'dich', 'dir'),
    register: 'formal',
  },
  fr: {
    formal: words('vous', 'votre', 'vos'),
    informal: words('tu', 'ton', 'ta', 'tes', 'toi'),
    register: 'formal',
  },
  nl: { formal: words('uw'), informal: words('je', 'jij', 'jouw'), register: 'informal' },
  es: { formal: words('usted'), informal: words('t\u00fa', 'tus', 'ti'), register: 'informal' },
  it: { formal: words('Lei', 'suoi'), informal: words('tu', 'tuo', 'tua', 'tuoi'), register: 'informal' },
};

/**
 * Informal IMPERATIVES — the class a pronoun-only sweep cannot see.
 *
 * German "Tippen Sie" vs "Tippe" and French "Réessayez" vs "Réessaie" carry the
 * register in the VERB, with no pronoun anywhere in the string. 14 German and 0
 * French strings were still informal after the pronoun sweep for exactly this
 * reason. Only the formal-language locales need this: nl/es/it are informal by
 * design, so a bare-stem imperative is correct there.
 */
const IMPERATIVES: Record<string, RegExp> = {
  // `Versuche` is omitted from this list on purpose — it is also the plural
  // noun "attempts" ("Zu viele Versuche."), so it is matched separately below
  // only when an object follows, which the noun reading never takes.
  de: new RegExp(
    [
      words('Tippe', 'Klicke', 'Wähle', 'Kopiere', 'Ignoriere', 'Gib', 'Trage', 'Öffne',
            'Erstelle', 'Füge', 'Sende', 'Prüfe', 'Mach', 'Koordiniere',
            'Verfolge', 'Halte', 'Fordere').source,
      `(?<![${L}])[Vv]ersuche(?=\\s+(?:es|eine|einen|ein)\\b)`,
    ].join('|'),
    'i',
  ),
  // NO `fr` entry, deliberately. In French the informal imperative and the
  // third-person singular indicative are HOMOGRAPHS: "Vérifie" is both "check!"
  // and "(he/she/it) checks". The app is full of the latter — "Vasco vérifie
  // automatiquement…", "Utilise un ballon d'eau chaude" — and a regex cannot
  // tell them apart without parsing for a subject. Probing anyway produced 6
  // hits and 0 real defects, which is how a detector earns a blanket mute.
  // German has no such collision (imperative "Gib" vs indicative "gibt"), so
  // the check is kept where it can actually be trusted.
};
/**
 * Keys whose match is a homograph, not a register slip. Each needs a reason —
 * an unexplained entry here is how a real defect gets parked forever.
 */
const ALLOWED: Record<string, string> = {
  // French "ton" = TONE (the noun), not the informal possessive. This setting
  // lets the contractor choose how THEIR OWN quote addresses THEIR customer;
  // "Tutoiement" is the name of the informal option, so it is content, not copy.
  'fr:profile.quoteTone': '"Ton du devis" = tone of the quote (noun)',
  'fr:profile.quoteToneFriendlyDesc': '"Ton chaleureux" = warm tone; names the tutoiement option',
  // "Ich prüfe/sende" is first-person indicative in a smart reply the
  // contractor sends to their own customer, where "I" is the correct voice.
  'de:smartReply.inbound.when': 'first-person "Ich prüfe" in a reply the contractor sends',
  'de:smartReply.inbound.price': 'first-person "Ich sende" in a reply the contractor sends',
};

/** The register we must NOT find, per locale. */
function forbidden(loc: string): RegExp {
  const m = MARKERS[loc];
  return m.register === 'formal' ? m.informal : m.formal;
}

function flatten(obj: unknown, prefix = '', out: [string, string][] = []): [string, string][] {
  if (typeof obj === 'string') out.push([prefix, obj]);
  else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  }
  return out;
}

describe('formal/informal register is consistent per locale', () => {
  // ── Source 1: the app's own locale files ────────────────────────────────
  describe.each(['de', 'fr'] as const)('app locale %s (must be formal)', (loc) => {
    const entries = flatten(
      JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n/locales', `${loc}.json`), 'utf8')),
    );

    it('has enough strings to be a real scan', () => {
      expect(entries.length).toBeGreaterThan(1000);
    });

    it('contains no informal second-person pronouns', () => {
      const bad = entries.filter(
        ([k, v]) => forbidden(loc).test(v) && !(`${loc}:${k}` in ALLOWED),
      );
      expect(bad.map(([k, v]) => `${k} = ${v}`).join('\n')).toBe('');
    });

    // Only locales with a trustworthy probe — see the IMPERATIVES comment for
    // why French is absent. `test.skip` rather than a silent no-op so the
    // omission stays visible in the runner output.
    const hasProbe = loc in IMPERATIVES;
    (hasProbe ? it : it.skip)('contains no informal imperatives', () => {
      const bad = entries.filter(
        ([k, v]) => IMPERATIVES[loc].test(v) && !(`${loc}:${k}` in ALLOWED),
      );
      expect(bad.map(([k, v]) => `${k} = ${v}`).join('\n')).toBe('');
    });
  });

  // ── Source 2: the Deno auth-email templates (the blind spot) ────────────
  describe('supabase/functions/_shared/authEmailTemplates.ts', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'supabase/functions/_shared/authEmailTemplates.ts'),
      'utf8',
    );

    /**
     * Pull the string literals out of one locale's block in the STRINGS map.
     *
     * Line-anchored on purpose. A naive /'([^']*)'/g scan is WRONG here: French
     * copy is full of apostrophes ("Vous n'avez pas…") sitting inside
     * double-quoted literals, and each one opens a bogus single-quoted match
     * that runs on to the next apostrophe — swallowing whole `key: '…'` lines
     * on the way. That hole let a `tu`-form French subject through this very
     * test. Every string in STRINGS is one `key: '…'` per line, so anchoring to
     * the line is both correct and simple.
     */
    function localeStrings(loc: string): string[] {
      const block = new RegExp(`\\n  ${loc}: \\{([\\s\\S]*?)\\n  \\},\\n`).exec(src);
      if (!block) throw new Error(`locale block '${loc}' not found — did STRINGS get restructured?`);
      const out: string[] = [];
      for (const line of block[1].split('\n')) {
        const m = /^\s*\w+:\s*(['"])(.*)\1,\s*$/.exec(line);
        if (m) out.push(m[2]);
      }
      return out;
    }

    it.each(Object.keys(MARKERS))('%s uses the same register as the app', (loc) => {
      const strings = localeStrings(loc);
      // Sanity: the block must actually have been found and be non-trivial,
      // or an empty match would make this test vacuously pass.
      expect(strings.length).toBeGreaterThan(20);

      const bad = strings.filter((s) => forbidden(loc).test(s));
      expect(bad.join('\n')).toBe('');

      // ...and the verb form, for the two locales where it carries register.
      if (IMPERATIVES[loc]) {
        const badVerbs = strings.filter((s) => IMPERATIVES[loc].test(s));
        expect(badVerbs.join('\n')).toBe('');
      }
    });

    it('every locale in the app is present in the email templates', () => {
      for (const loc of [...Object.keys(MARKERS), 'en']) {
        expect(new RegExp(`\\n  ${loc}: \\{`).test(src)).toBe(true);
      }
    });
  });
});
