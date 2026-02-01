const fs = require('fs');
const path = require('path');

const colorsPath = path.join(__dirname, '..', 'src', 'theme', 'colors.ts');
const content = fs.readFileSync(colorsPath, 'utf8');

const colorMap = {};
const colorRegex = /['"]?([A-Za-z0-9_-]+)['"]?\s*:\s*'(#(?:[0-9a-fA-F]{6}))'/g;
let match;

while ((match = colorRegex.exec(content)) !== null) {
  const key = match[1];
  const value = match[2];
  colorMap[key] = value;
}

const toRgb = (hex) => {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [r, g, b];
};

const luminance = (hex) => {
  const [r, g, b] = toRgb(hex).map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrastRatio = (fg, bg) => {
  const L1 = luminance(fg);
  const L2 = luminance(bg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
};

const pairs = [
  ['text-primary', 'background'],
  ['text-primary', 'surface'],
  ['text-primary', 'surfaceElevated'],
  ['text-secondary', 'background'],
  ['text-secondary', 'surface'],
  ['text-secondary', 'surfaceElevated'],
  ['text-disabled', 'background'],
  ['text-disabled', 'surface'],
  ['text-disabled', 'surfaceElevated'],
  ['accentDeep', 'surface'],
  ['accentMuted', 'surface'],
  ['accentSoft', 'surface'],
];

const results = [];

pairs.forEach(([fgKey, bgKey]) => {
  const fg = colorMap[fgKey] || colorMap[fgKey.replace('-', '')];
  const bg = colorMap[bgKey] || colorMap[bgKey.replace('-', '')];
  if (!fg || !bg) return;
  const ratio = contrastRatio(fg, bg);
  results.push({
    fgKey,
    bgKey,
    fg,
    bg,
    ratio,
    pass: ratio >= 4.5,
  });
});

const line = (char = '-') => char.repeat(72);
console.log(line());
console.log('WCAG 2.1 AA Contrast Audit (>= 4.5:1)');
console.log(line());
results.forEach((row) => {
  const status = row.pass ? 'PASS' : 'FAIL';
  console.log(
    `${status}  ${row.fgKey} on ${row.bgKey}  ${row.ratio.toFixed(2)}  (${row.fg} / ${row.bg})`
  );
});
console.log(line());
