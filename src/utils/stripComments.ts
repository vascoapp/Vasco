/**
 * Remove comments from TS/TSX source, without eating code.
 *
 * Every static detector in this repo starts by stripping comments so that prose
 * describing an old defect does not read as the defect. Six of them did it with
 * the obvious regex:
 *
 *     src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
 *
 * which is wrong, silently, and in the direction that makes a guard PASS.
 * `app/contractor/permits.tsx` passes a MIME wildcard to the document picker:
 *
 *     type: ['application/pdf', 'image/*'],
 *
 * That `/*` is inside a STRING, but the regex cannot tell, so it opens a
 * phantom block comment which runs to the next real close marker — deleting
 * 3,284 characters of live code, including all four of that file's
 * `Alert.alert` calls. Measured across the repo when this was written: **41
 * files lost more than 200 characters each**, and 11 `Alert.alert` calls (7 in
 * `ReceiptScanner.tsx`, 4 in `permits.tsx`) were invisible to every guard that
 * used the naive version. A detector that stops seeing its own subject reports
 * green forever.
 *
 * So this walks the source and only treats `//` and `/*` as comment openers
 * when genuinely outside a string or template literal.
 *
 * Regex literals are handled too, because dismissing them as theoretical was
 * wrong: `directions.test.ts` contains
 *
 *     expect(directionsUrl('x').fallback).toMatch(/^https:\/\//);
 *
 * whose closing `\/` + `/` reads as a line comment to a scanner that does not
 * know it is inside a regex — deleting the rest of the line, `);` included.
 * Checked against the TypeScript compiler by transpiling every file in `app/`
 * and `src/` before and after stripping and requiring identical emit: 6 of
 * 1,002 files broke this way before regex support, 0 after.
 *
 * Telling a regex from a division needs the parser state JS never made
 * lexable, so this uses the standard heuristic: a `/` opens a regex only where
 * an expression may begin — after an operator, an opening bracket, or a
 * keyword — never after a value.
 */

/** Keywords after which a `/` begins a regex, not a division. */
const REGEX_PRECEDING_KEYWORDS =
  /\b(return|typeof|instanceof|in|of|new|delete|void|case|do|else|yield|await)\s*$/;

/**
 * Longest keyword above is `instanceof` (10). A 32-character tail always
 * contains it plus the character before it, which is what `\b` needs to reject
 * `myreturn`. Testing the whole emitted string instead — the obvious way to
 * write this — makes an `$`-anchored regex re-scan everything produced so far
 * on every value-position slash: 6.1s over this codebase, versus 0.4s here.
 */
const KEYWORD_TAIL = 32;

/** After a value (`x`, `1`, `)`, `]`) a slash is division; otherwise a regex. */
function regexCanStartHere(prev: string, emitted: string): boolean {
  if (prev === '') return true;
  if (!/[)\]}A-Za-z0-9_$]/.test(prev)) return true;
  const tail = emitted.slice(-KEYWORD_TAIL);
  const m = REGEX_PRECEDING_KEYWORDS.exec(tail);
  if (!m) return false;
  // If the match begins at the cut, it may be the tail of a longer identifier
  // whose start we sliced away. Treat that as division — the conservative side,
  // since it only ever declines to enter regex mode.
  if (m.index === 0 && emitted.length > KEYWORD_TAIL) return false;
  return true;
}

export function stripComments(src: string): string {
  let out = '';
  let i = 0;
  /** Last non-whitespace character actually emitted — the lexer state. */
  let prev = '';
  // Called once per character, so it must not allocate or run a regex: doing
  // `s.replace(/\s+$/, '')` here cost 11.7 million regex calls over this
  // codebase and dominated the whole scan.
  const emit = (s: string) => {
    out += s;
    for (let k = s.length - 1; k >= 0; k -= 1) {
      const ch = s[k];
      if (ch !== ' ' && ch !== '\t' && ch !== '\n' && ch !== '\r') {
        prev = ch;
        return;
      }
    }
  };
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];

    // Strings and template literals pass through untouched, so a `/*` or `//`
    // inside one can never open a comment.
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      emit(c);
      i += 1;
      while (i < src.length) {
        if (src[i] === '\\') {
          emit(src[i] + (src[i + 1] ?? ''));
          i += 2;
          continue;
        }
        const ch = src[i];
        emit(ch);
        i += 1;
        if (ch === quote) break;
      }
      continue;
    }

    if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }

    if (c === '/' && next === '/') {
      const end = src.indexOf('\n', i);
      i = end === -1 ? src.length : end;
      continue;
    }

    // A regex literal. Its body may contain `//`, `/*` and quotes, none of
    // which mean anything here — which is exactly how the naive scanner lost
    // the tail of a line.
    if (c === '/' && regexCanStartHere(prev, out)) {
      emit(c);
      i += 1;
      let inClass = false;
      while (i < src.length) {
        const d = src[i];
        if (d === '\n') break; // unterminated — treat as ordinary text
        if (d === '\\') {
          emit(d + (src[i + 1] ?? ''));
          i += 2;
          continue;
        }
        if (d === '[') inClass = true;
        else if (d === ']') inClass = false;
        emit(d);
        i += 1;
        if (d === '/' && !inClass) break;
      }
      continue;
    }

    emit(c);
    i += 1;
  }
  return out;
}
