#!/usr/bin/env bash
# Renders App Store screenshot stills in both EN and NL tagline variants.
# Both share the same Dutch app interior (since the app is Dutch UI in NL).
#
# Output:
#   out/app-store/1-vandaag-en.png   out/app-store/1-vandaag-nl.png
#   out/app-store/2-quote-en.png     out/app-store/2-quote-nl.png
#   ... etc.

set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p out/app-store

render() {
  local id="$1"
  local locale="$2"
  local file="$3"
  local props="$4"
  echo "→ $id ($locale) → $file"
  npx remotion still src/index.ts "$id" "out/app-store/$file" \
    --frame=0 \
    --props="$props" 2>&1 | tail -1
}

# --- English ---
render AppStoreVandaag en 1-vandaag-en.png '{"tagline":"Your admin,\non autopilot.","subTagline":"Quotes, jobs, invoices, follow-up — Vasco runs them in the background."}'
render AppStoreQuote   en 2-quote-en.png   '{"tagline":"Three options.\nThe customer picks.\nYou win.","subTagline":"Tiered quotes backed by cohort data — see which one 67% of plumbers pick."}'
render AppStoreGeld    en 3-geld-en.png    '{"tagline":"Stop chasing\nlate payers.","subTagline":"Vasco sends reminders + escalates automatically. You get paid."}'
render AppStorePhoto   en 4-photo-en.png   '{"tagline":"Photo in.\nQuote out.\n8 seconds.","subTagline":"Snap the job. Vasco reads the materials and drafts the lines."}'
render AppStoreVat     en 5-vat-en.png     '{"tagline":"VAT return.\nDone in\n3 minutes.","subTagline":"Vasco sorts every line by rubriek and exports to Moneybird, DATEV, Pennylane."}'

# --- Dutch (interior strings come from STRINGS['nl'] in screenshotStrings.ts) ---
render AppStoreVandaag nl 1-vandaag-nl.png '{"tagline":"AI doet je admin.\nJij doet je werk.","subTagline":"Offertes, planning, facturen — Vasco regelt de rest.","locale":"nl"}'
render AppStoreQuote   nl 2-quote-nl.png   '{"tagline":"Drie keuzes.\nKlant kiest.\nJij wint.","subTagline":"Tiered offertes met cohort-data: zien wat 67% van loodgieters kiest.","locale":"nl"}'
render AppStoreGeld    nl 3-geld-nl.png    '{"tagline":"Stop met\nachterna\nbellen.","subTagline":"Vasco stuurt herinneringen + escaleert automatisch. Jij krijgt betaald.","locale":"nl"}'
render AppStorePhoto   nl 4-photo-nl.png   '{"tagline":"Foto in.\nOfferte uit.\n8 seconden.","subTagline":"Maak een foto van de klus. Vasco leest het materiaal + maakt regels.","locale":"nl"}'
render AppStoreVat     nl 5-vat-nl.png     '{"tagline":"BTW-aangifte.\nKlaar in\n3 minuten.","subTagline":"Vasco rangschikt per rubriek + exporteert naar Moneybird, DATEV, Pennylane.","locale":"nl"}'

# --- US English (interior strings come from STRINGS['en-US'] in
# screenshotStrings.ts — Mike Reynolds HVAC sample data, $ amounts,
# Estimate terminology, MM/DD dates, US states in sales-tax breakdown) ---
render AppStoreVandaag us 1-vandaag-us.png '{"tagline":"Your admin,\non autopilot.","subTagline":"Estimates, jobs, invoices, follow-up — Vasco runs them in the background.","locale":"en-US"}'
render AppStoreQuote   us 2-quote-us.png   '{"tagline":"Three options.\nThe customer picks.\nYou win.","subTagline":"Tiered estimates backed by cohort data — see which one 67% of HVAC pros pick.","locale":"en-US"}'
render AppStoreGeld    us 3-geld-us.png    '{"tagline":"Stop chasing\nlate payers.","subTagline":"Vasco sends reminders + escalates automatically. You get paid.","locale":"en-US"}'
render AppStorePhoto   us 4-photo-us.png   '{"tagline":"Photo in.\nEstimate out.\n8 seconds.","subTagline":"Snap the job. Vasco reads the parts and drafts the line items.","locale":"en-US"}'
render AppStoreVat     us 5-vat-us.png     '{"tagline":"Sales tax prep.\nDone in\n3 minutes.","subTagline":"Vasco breaks tax out by state + exports to QuickBooks, Xero, FreshBooks.","locale":"en-US"}'

echo
echo "Done. PNGs in video/out/app-store/"
ls -1 out/app-store/*-{en,nl,us}.png 2>/dev/null
