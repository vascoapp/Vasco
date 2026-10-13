// The marketing homepages are the first thing Google and a contractor read.
// Until 2026-10-12 the site showed July mock-ups that said "Your admin, on
// autopilot" and "VAT return. Done in 3 minutes", and the live description
// still promised "3.5% per paid invoice" — none of it true, none of it caught,
// because nothing here looked at the copy or the images.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
// @ts-expect-error node --experimental-strip-types needs the extension
import { content, type Locale } from "./marketing-content.ts";
// @ts-expect-error node --experimental-strip-types needs the extension
import { HOME_LANGUAGES } from "./homeAlternates.ts";
import { stripComments } from "../../../scripts/lib/strip-comments.mjs";

const ADMIN = path.resolve(import.meta.dirname, "../..");
const ROUTES: Record<Locale, string> = { en: "/", nl: "/nl", de: "/de", "en-US": "/us" };
const locales = Object.keys(content) as Locale[];

test("every homepage exists, is in the sitemap and names the others", () => {
  const sitemap = stripComments(fs.readFileSync(path.join(ADMIN, "src/app/sitemap.ts"), "utf8"));
  const langUrls = Object.values(HOME_LANGUAGES) as string[];
  for (const l of locales) {
    const route = ROUTES[l];
    assert.ok(route, `${l} has no route`);
    const file = route === "/" ? "src/app/page.tsx" : `src/app${route}/page.tsx`;
    const src = stripComments(fs.readFileSync(path.join(ADMIN, file), "utf8"));
    assert.match(src, /languages: HOME_LANGUAGES/, `${file} must use the shared language list`);
    const url = `https://vascobuild.com${route === "/" ? "" : route}`;
    assert.ok(langUrls.includes(url), `${url} missing from HOME_LANGUAGES`);
    if (route !== "/") assert.ok(sitemap.includes(`\${BASE_URL}${route}\``), `${route} missing from the sitemap`);
  }
});

test("every screenshot on the page is a file that exists", () => {
  const code: Record<Locale, string> = { en: "en", nl: "nl", de: "de", "en-US": "us" };
  for (const l of locales) {
    const keys = ["today", "ipad-today", ...content[l].features.items.map((f) => f.screen)];
    for (const k of keys) {
      const f = `screenshots/app-${code[l]}-${k}.webp`;
      assert.ok(fs.existsSync(path.join(ADMIN, "public", f)), `${l}: ${f} does not exist`);
    }
  }
  // The component builds the same paths.
  const home = fs.readFileSync(path.join(ADMIN, "src/components/MarketingHome.tsx"), "utf8");
  assert.match(home, /\/screenshots\/app-\$\{SHOT_CODE\[locale\]\}-\$\{key\}\.webp/);
});

test("prices are the app's own (src/services/subscriptionService.ts)", () => {
  const svc = fs.readFileSync(path.join(ADMIN, "../src/services/subscriptionService.ts"), "utf8");
  const tier = (name: string) => {
    const block = svc.slice(svc.indexOf(`  ${name}: {`));
    return {
      monthly: Number(block.match(/monthlyPrice: (\d+)/)![1]),
      annual: Number(block.match(/annualMonthlyPrice: (\d+)/)![1]),
    };
  };
  const pro = tier("pro");
  const contractor = tier("contractor");
  for (const l of locales) {
    const [, p, c] = content[l].pricing.plans;
    const num = (s = "") => (s.match(/\d+/) ?? [""])[0];
    assert.equal(num(p.price), String(pro.monthly), `${l} Pro monthly`);
    assert.equal(num(p.annual), String(pro.annual), `${l} Pro annual`);
    assert.equal(num(c.price), String(contractor.monthly), `${l} Contractor monthly`);
    assert.equal(num(c.annual), String(contractor.annual), `${l} Contractor annual`);
  }
});

test("no claim the product cannot back", () => {
  for (const l of locales) {
    const text = JSON.stringify(content[l]);
    // A per-invoice fee was cancelled (memory/payments-monetization-2026-08.md).
    assert.doesNotMatch(text, /\d\s?[.,]\s?\d\s?%/, `${l}: a percentage fee`);
    // LLM features are off in production.
    assert.doesNotMatch(text, /\b(AI|KI|IA)\b|künstliche Intelligenz|intelligenza artificiale/, `${l}: an AI claim`);
    // Vasco prepares; the contractor sends. Nothing runs on its own.
    assert.doesNotMatch(text, /autopilot|automatic|automatisch|automatique|automático/i, `${l}: an automation claim`);
    // Vasco does not file tax returns.
    assert.doesNotMatch(text, /done in \d|in \d minut/i, `${l}: a filing-time claim`);
  }
});

test("German speaks to the reader as Sie", () => {
  assert.doesNotMatch(JSON.stringify(content.de), /\b(du|dein|deine|deinen|deinem|dich|dir)\b/i);
});

// @ts-expect-error node --experimental-strip-types needs the extension
import { STORES, anyStoreLive } from "./stores.ts";

test("every install button goes through the store switch (lib/stores.ts)", () => {
  const home = stripComments(fs.readFileSync(path.join(ADMIN, "src/components/MarketingHome.tsx"), "utf8"));
  assert.doesNotMatch(home, /mailto:hello@vascobuild\.com\?subject=Vasco%20waitlist/, "a raw waitlist link bypasses the switch");
  assert.ok((home.match(/<StoreButtons /g) ?? []).length >= 2, "hero + final CTA render StoreButtons");
  assert.match(STORES.ios.url, /^https:\/\/apps\.apple\.com\/app\/id\d+$/);
  assert.match(STORES.android.url, /^https:\/\/play\.google\.com\/store\/apps\/details\?id=com\.vascobuild\.app$/);
});

test("the store copy says what the switch says", () => {
  const notYet = /not in the App Store|nog niet in de App Store|noch nicht im App Store|Not from the stores yet|Nog niet uit de stores|Noch nicht aus den Stores/;
  for (const l of locales) {
    const text = JSON.stringify(content[l]);
    if (anyStoreLive()) assert.doesNotMatch(text, notYet, `${l}: says "not in the stores" while a store is live`);
    else assert.doesNotMatch(text, /available on the App Store|im App Store erhältlich|beschikbaar in de App Store/i, `${l}: claims a store that is not live`);
  }
});
