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
 * Not a full parser: a `/*` inside a REGEX literal (`/[/*]/`) would still fool
 * it. No such literal exists in this codebase, and the failure mode of adding
 * one is a false POSITIVE — a guard that shouts — not a silent blind spot.
 */
export function stripComments(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];

    // Strings and template literals pass through untouched, so a `/*` or `//`
    // inside one can never open a comment.
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      out += c;
      i += 1;
      while (i < src.length) {
        if (src[i] === '\\') {
          out += src[i] + (src[i + 1] ?? '');
          i += 2;
          continue;
        }
        out += src[i];
        if (src[i] === quote) {
          i += 1;
          break;
        }
        i += 1;
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

    out += c;
    i += 1;
  }
  return out;
}
