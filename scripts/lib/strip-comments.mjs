/**
 * Comment stripper for the Node scripts, mirroring `src/utils/stripComments.ts`.
 *
 * Two copies exist because the scripts are plain `.mjs` and cannot import the
 * TypeScript one. They are pinned together by
 * `src/utils/__tests__/stripComments.test.ts`, which transpiles the TS version
 * and asserts both produce identical output for every file in `app/` and
 * `src/` — so this cannot quietly drift into the bug it exists to avoid.
 *
 * See the TS file for the full history. In short: the obvious
 * `replace(/\/\*[\s\S]*?\*\//g, '')` cannot tell a comment from a string, so a
 * MIME wildcard (`'image/*'`) opens a phantom comment that eats real code, and
 * a regex literal ending `\/` + `/` reads as a line comment that eats the rest
 * of its line.
 */

const REGEX_PRECEDING_KEYWORDS =
  /\b(return|typeof|instanceof|in|of|new|delete|void|case|do|else|yield|await)\s*$/;

const KEYWORD_TAIL = 32;

function regexCanStartHere(prev, emitted) {
  if (prev === '') return true;
  if (!/[)\]}A-Za-z0-9_$]/.test(prev)) return true;
  const tail = emitted.slice(-KEYWORD_TAIL);
  const m = REGEX_PRECEDING_KEYWORDS.exec(tail);
  if (!m) return false;
  if (m.index === 0 && emitted.length > KEYWORD_TAIL) return false;
  return true;
}

export function stripComments(src) {
  let out = '';
  let i = 0;
  let prev = '';
  const emit = (s) => {
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

    if (c === '/' && regexCanStartHere(prev, out)) {
      emit(c);
      i += 1;
      let inClass = false;
      while (i < src.length) {
        const d = src[i];
        if (d === '\n') break;
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
