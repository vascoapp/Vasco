// Payment-method marks are readable on the dark panel (DK panel #14181F).
// UK walk, 2026-10-08: the "Card" row was #1A1A1A on #14181F — invisible.
// WCAG non-text contrast: 3:1.
import { PAYMENT_BRAND_COLORS } from '../paymentMethods';

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

it('every brand colour has 3:1 against the panel', () => {
  const low = Object.entries(PAYMENT_BRAND_COLORS)
    .filter(([, c]) => /^#[0-9a-f]{6}$/i.test(c) && contrast(c, '#14181F') < 3)
    .map(([n, c]) => `${n} ${c} ${contrast(c, '#14181F').toFixed(2)}`);
  expect(low).toEqual([]);
});
