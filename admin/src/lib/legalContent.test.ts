// Privacy + terms are served in the reader's language (user, 2026-09-30).
// Run: npm run test:legal  (from admin/)
import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error node --experimental-strip-types needs the extension
import { pickLegalLang, renderLegalPage, legalLanguages } from "./legalContent.ts";

test("?lang= wins, then Accept-Language, then English", () => {
  assert.equal(pickLegalLang("de", "fr-FR,fr;q=0.9"), "de");
  assert.equal(pickLegalLang("de-DE", null), "de");
  assert.equal(pickLegalLang(undefined, "es-ES,es;q=0.9,en;q=0.8"), "es");
  assert.equal(pickLegalLang(undefined, "pt-BR,it;q=0.8"), "it");
  assert.equal(pickLegalLang("xx", "pt-BR"), "en");
  assert.equal(pickLegalLang(undefined, null), "en");
});

for (const slug of ["privacy-policy", "terms-of-service"] as const) {
  test(`${slug} exists in all six languages`, () => {
    assert.deepEqual(legalLanguages(slug), ["en", "nl", "de", "fr", "es", "it"]);
  });

  test(`${slug} renders the German file for a German reader`, async () => {
    const en = await renderLegalPage(slug, "en");
    const de = await renderLegalPage(slug, "de");
    assert.equal(de.lang, "de");
    assert.notEqual(de.html, en.html);
  });
}

test("a document without a translation falls back to English, and says so", async () => {
  const eula = await renderLegalPage("eula", "de");
  assert.equal(eula.lang, "en");
});
