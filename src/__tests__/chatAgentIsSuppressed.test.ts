/**
 * @jest-environment node
 */
// The Kantoorhulp chat agent (app/contractor/ai-chat.tsx) is suppressed —
// user's decision 2026-09-28, emulator walk. Gated, not deleted (dormant rule,
// 2026-09-24): the route is dormant, so the root layout redirects it even from
// a deep link, and its only entry point (the AI tab chip) stays behind the
// office_bot kill switch, which is off.
import fs from 'fs';
import path from 'path';
import { isDormantRoute } from '../config/dormant';
import { stripComments } from '../utils/stripComments';

describe('chat agent suppressed', () => {
  it('its route is dormant (deep links included)', () => {
    expect(isDormantRoute(['contractor', 'ai-chat'])).toBe(true);
  });

  it('the kill switch that gates its entry point is off', () => {
    const src = stripComments(fs.readFileSync(path.resolve(__dirname, '../services/featureFlagService.ts'), 'utf8'));
    expect(src).toMatch(/\boffice_bot:\s*false\b/);
  });

  it('every link to it in a reachable screen sits behind that switch', () => {
    const ai = stripComments(fs.readFileSync(path.resolve(__dirname, '../../app/(contractor)/ai.tsx'), 'utf8'));
    const links = [...ai.matchAll(/\/contractor\/ai-chat/g)];
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) {
      const before = ai.slice(Math.max(0, l.index! - 300), l.index!);
      expect(before).toMatch(/officeBotEnabled\s*&&/);
    }
  });
});
