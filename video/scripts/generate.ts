#!/usr/bin/env tsx
// =============================================================================
// VIDEO SCRIPT GENERATOR — Brief → Script → Remotion Props
// =============================================================================
// Takes a brief from the admin dashboard and generates Remotion-compatible
// props for each template. Can be called from CLI or from admin UI.
//
// Usage:
//   npx tsx scripts/generate.ts --template did-you-know --trade plumbing --lang EN
//   npx tsx scripts/generate.ts --template all --trade solar --lang NL
// =============================================================================

import { TRADES, getTradeLabel, type Trade, type Language } from '../src/data/trades';
import { getHooksForFormat, type Hook } from '../src/data/hooks';
import * as fs from 'fs';
import * as path from 'path';

// ─── Types ──────────────────────────────────────────────────────────────────

interface VideoScript {
  templateId: string;
  props: Record<string, unknown>;
  outputFilename: string;
  language: Language;
  trade: Trade;
  estimatedDurationSec: number;
}

interface GenerateOptions {
  template: 'did-you-know' | 'price-check' | 'before-after' | 'eve-says' | 'compliance-alert' | 'all';
  trade: Trade;
  language: Language;
  outputDir?: string;
}

// ─── Trade Facts Database ───────────────────────────────────────────────────

const TRADE_FACTS: Record<string, Array<{ stat: string; label: Record<string, string>; fact: Record<string, string> }>> = {
  plumbing: [
    { stat: '73%', label: { EN: 'of contractors undercharge on quotes', NL: 'van aannemers rekent te weinig op offertes', DE: 'der Handwerker berechnen zu wenig', FR: 'des artisans sous-facturent les devis', ES: 'de contratistas cobran de menos', IT: 'degli artigiani sottofatturano' }, fact: { EN: 'Vasco AI analyzes 14,000+ contractor quotes to suggest optimal pricing for your market.', NL: 'Vasco AI analyseert 14.000+ offertes om de optimale prijs voor jouw markt te bepalen.', DE: 'Vasco KI analysiert 14.000+ Angebote um den optimalen Preis für Ihren Markt vorzuschlagen.', FR: 'Vasco IA analyse 14 000+ devis pour suggérer le prix optimal.', ES: 'Vasco IA analiza 14.000+ presupuestos para sugerir el precio óptimo.', IT: 'Vasco IA analizza 14.000+ preventivi per suggerire il prezzo ottimale.' } },
    { stat: '8h', label: { EN: 'per week spent on admin by the average plumber', NL: 'per week aan administratie door de gemiddelde loodgieter', DE: 'pro Woche für Verwaltung beim durchschnittlichen Klempner', FR: 'par semaine en admin pour le plombier moyen', ES: 'semanales en administración del fontanero promedio', IT: 'settimanali in amministrazione per l\'idraulico medio' }, fact: { EN: 'Vasco automates invoicing, quote follow-ups, and payment reminders. Get 8 hours back every week.', NL: 'Vasco automatiseert facturatie, offerte-opvolging en betalingsherinneringen. Krijg 8 uur per week terug.', DE: 'Vasco automatisiert Rechnungen, Angebotsnachverfolgung und Zahlungserinnerungen.', FR: 'Vasco automatise facturation, suivi des devis et rappels de paiement.', ES: 'Vasco automatiza facturación, seguimiento de presupuestos y recordatorios de pago.', IT: 'Vasco automatizza fatturazione, follow-up preventivi e promemoria pagamento.' } },
  ],
  solar: [
    { stat: '3x', label: { EN: 'more jobs won when quoting within 24h', NL: 'meer klussen gewonnen bij offerte binnen 24u', DE: 'mehr Aufträge bei Angebot innerhalb 24h', FR: 'plus de chantiers gagnés avec devis sous 24h', ES: 'más trabajos ganados cotizando en 24h', IT: 'più lavori vinti con preventivo entro 24h' }, fact: { EN: 'Speed wins in solar. Vasco generates professional quotes from photos in under 5 minutes.', NL: 'Snelheid wint bij zonnepanelen. Vasco genereert professionele offertes vanuit fotos in minder dan 5 minuten.', DE: 'Geschwindigkeit gewinnt bei Solar. Vasco erstellt professionelle Angebote aus Fotos in unter 5 Minuten.', FR: 'La vitesse gagne en solaire. Vasco génère des devis pro à partir de photos en moins de 5 min.', ES: 'La velocidad gana en solar. Vasco genera presupuestos profesionales desde fotos en menos de 5 min.', IT: 'La velocità vince nel solare. Vasco genera preventivi professionali da foto in meno di 5 min.' } },
  ],
  roofing: [
    { stat: '€1,200', label: { EN: 'saved per year on materials with better sourcing', NL: 'bespaard per jaar op materialen met slimmer inkopen', DE: 'pro Jahr gespart bei Material durch besseren Einkauf', FR: 'économisés par an sur les matériaux', ES: 'ahorrados al año en materiales', IT: 'risparmiati all\'anno sui materiali' }, fact: { EN: 'Vasco\'s purchasing agent compares 36 suppliers and finds the best deals near you — automatically.', NL: 'Vasco\'s inkoopagent vergelijkt 36 leveranciers en vindt de beste deals bij jou in de buurt — automatisch.', DE: 'Vascos Einkaufsagent vergleicht 36 Lieferanten und findet die besten Angebote in Ihrer Nähe.', FR: 'L\'agent d\'achat Vasco compare 36 fournisseurs et trouve les meilleures offres près de chez vous.', ES: 'El agente de compras Vasco compara 36 proveedores y encuentra las mejores ofertas cerca de ti.', IT: 'L\'agente acquisti Vasco confronta 36 fornitori e trova le migliori offerte vicino a te.' } },
  ],
};

// Default facts for trades without specific data
const DEFAULT_FACTS = TRADE_FACTS.plumbing;

// ─── CTA Translations ───────────────────────────────────────────────────────

const CTA: Record<string, Record<string, string>> = {
  download: { EN: 'Download Vasco — free', NL: 'Download Vasco — gratis', DE: 'Vasco herunterladen — kostenlos', FR: 'Télécharger Vasco — gratuit', ES: 'Descargar Vasco — gratis', IT: 'Scarica Vasco — gratis' },
  deals: { EN: 'Vasco finds the best deals', NL: 'Vasco vindt de beste deals', DE: 'Vasco findet die besten Angebote', FR: 'Vasco trouve les meilleures offres', ES: 'Vasco encuentra las mejores ofertas', IT: 'Vasco trova le migliori offerte' },
  compliance: { EN: 'Never miss a deadline', NL: 'Mis nooit een deadline', DE: 'Nie wieder eine Frist verpassen', FR: 'Ne ratez plus aucune échéance', ES: 'Nunca pierdas un plazo', IT: 'Non perdere mai una scadenza' },
  invoicing: { EN: 'Let EVE handle your invoicing', NL: 'Laat EVE je facturatie regelen', DE: 'Lass EVE deine Rechnungen erledigen', FR: 'Laissez EVE gérer vos factures', ES: 'Deja que EVE gestione tus facturas', IT: 'Lascia che EVE gestisca le tue fatture' },
};

// ─── Script Generator Functions ─────────────────────────────────────────────

function generateDidYouKnow(trade: Trade, lang: Language): VideoScript {
  const facts = TRADE_FACTS[trade] ?? DEFAULT_FACTS;
  const fact = facts[Math.floor(Math.random() * facts.length)];
  const tradeInfo = TRADES.find(t => t.id === trade)!;
  const hook = getHooksForFormat('did_you_know')[0];

  return {
    templateId: 'DidYouKnow',
    props: {
      hookText: hook?.text[lang] ?? hook?.text.EN ?? fact.label[lang] ?? fact.label.EN,
      tradeEmoji: tradeInfo.emoji,
      tradeName: getTradeLabel(trade, lang),
      tradeColor: tradeInfo.color,
      statValue: fact.stat,
      statLabel: fact.label[lang] ?? fact.label.EN,
      factText: fact.fact[lang] ?? fact.fact.EN,
      ctaText: CTA.download[lang] ?? CTA.download.EN,
      ctaSubtext: '',
      language: lang,
    },
    outputFilename: `did-you-know_${trade}_${lang.toLowerCase()}.mp4`,
    language: lang,
    trade,
    estimatedDurationSec: 21,
  };
}

function generatePriceCheck(trade: Trade, lang: Language): VideoScript {
  const tradeInfo = TRADES.find(t => t.id === trade)!;
  const hook = getHooksForFormat('price_check')[0];

  return {
    templateId: 'PriceCheck',
    props: {
      hookText: hook?.text[lang] ?? hook?.text.EN ?? 'Are you overpaying for materials?',
      materialName: trade === 'insulation' ? 'PIR Insulation 120mm' : trade === 'roofing' ? 'Concrete Roof Tiles' : 'Standard Materials',
      supplierA: { name: 'Supplier A', price: 38.50 },
      supplierB: { name: 'Supplier B', price: 32.20 },
      savingsAmount: 6.30,
      savingsPercent: 16,
      ctaText: CTA.deals[lang] ?? CTA.deals.EN,
      language: lang,
    },
    outputFilename: `price-check_${trade}_${lang.toLowerCase()}.mp4`,
    language: lang,
    trade,
    estimatedDurationSec: 21,
  };
}

function generateEveSays(trade: Trade, lang: Language): VideoScript {
  const tradeInfo = TRADES.find(t => t.id === trade)!;
  const tips: Record<string, { title: Record<string, string>; body: Record<string, string> }> = {
    default: {
      title: { EN: 'Get paid 2 weeks faster', NL: 'Word 2 weken sneller betaald', DE: 'Werde 2 Wochen schneller bezahlt', FR: 'Soyez payé 2 semaines plus vite', ES: 'Cobra 2 semanas antes', IT: 'Pagato 2 settimane prima' },
      body: { EN: 'Send your invoice within 24 hours of completing the job. Contractors who invoice same-day get paid on average 14 days sooner. Vasco does this automatically.', NL: 'Verstuur je factuur binnen 24 uur na afronding. Aannemers die dezelfde dag factureren worden gemiddeld 14 dagen sneller betaald. Vasco doet dit automatisch.', DE: 'Senden Sie Ihre Rechnung innerhalb von 24 Stunden. Handwerker die am selben Tag fakturieren werden durchschnittlich 14 Tage schneller bezahlt.', FR: 'Envoyez votre facture dans les 24h. Les artisans qui facturent le jour même sont payés en moyenne 14 jours plus tôt.', ES: 'Envía tu factura en 24h. Los contratistas que facturan el mismo día cobran en promedio 14 días antes.', IT: 'Invia la fattura entro 24h. Gli artigiani che fatturano lo stesso giorno vengono pagati in media 14 giorni prima.' },
    },
  };
  const tip = tips.default;

  return {
    templateId: 'EveSays',
    props: {
      tipTitle: tip.title[lang] ?? tip.title.EN,
      tipBody: tip.body[lang] ?? tip.body.EN,
      tradeEmoji: tradeInfo.emoji,
      tradeName: getTradeLabel(trade, lang),
      ctaText: CTA.invoicing[lang] ?? CTA.invoicing.EN,
      language: lang,
    },
    outputFilename: `eve-says_${trade}_${lang.toLowerCase()}.mp4`,
    language: lang,
    trade,
    estimatedDurationSec: 16,
  };
}

function generateComplianceAlert(trade: Trade, lang: Language): VideoScript {
  const tradeInfo = TRADES.find(t => t.id === trade)!;
  // Map trade → most relevant compliance topic
  const complianceMap: Record<string, { flag: string; country: string; reg: string; deadline: string; days: number; consequence: string }> = {
    gas: { flag: '🇬🇧', country: 'United Kingdom', reg: 'Gas Safe Registration', deadline: 'Annual renewal required', days: 45, consequence: '£5,000 fine + criminal prosecution' },
    electrical: { flag: '🇩🇪', country: 'Deutschland', reg: 'Meisterbrief Elektro', deadline: 'Fortbildung prüfen', days: 90, consequence: 'Betriebsuntersagung' },
    solar: { flag: '🇳🇱', country: 'Nederland', reg: 'SCIOS Scope 12', deadline: 'Jaarlijkse herkeuring', days: 60, consequence: 'Geen installaties uitvoeren' },
    insulation: { flag: '🇫🇷', country: 'France', reg: 'RGE Qualification', deadline: 'Renouvellement tous les 4 ans', days: 120, consequence: 'Clients perdent accès aux subventions' },
    roofing: { flag: '🇳🇱', country: 'Nederland', reg: 'VCA VOL certificaat', deadline: 'Geldig voor 10 jaar', days: 180, consequence: 'Niet werken op bouwplaatsen' },
  };
  const compliance = complianceMap[trade] ?? complianceMap.gas;

  return {
    templateId: 'ComplianceAlert',
    props: {
      countryFlag: compliance.flag,
      countryName: compliance.country,
      regulationName: compliance.reg,
      deadlineText: compliance.deadline,
      daysLeft: compliance.days,
      consequence: compliance.consequence,
      tradeEmoji: tradeInfo.emoji,
      tradeName: getTradeLabel(trade, lang),
      ctaText: CTA.compliance[lang] ?? CTA.compliance.EN,
      language: lang,
    },
    outputFilename: `compliance-alert_${trade}_${lang.toLowerCase()}.mp4`,
    language: lang,
    trade,
    estimatedDurationSec: 21,
  };
}

// ─── Main Generator ─────────────────────────────────────────────────────────

export function generateScripts(options: GenerateOptions): VideoScript[] {
  const { template, trade, language } = options;
  const scripts: VideoScript[] = [];

  if (template === 'did-you-know' || template === 'all') scripts.push(generateDidYouKnow(trade, language));
  if (template === 'price-check' || template === 'all') scripts.push(generatePriceCheck(trade, language));
  if (template === 'eve-says' || template === 'all') scripts.push(generateEveSays(trade, language));
  if (template === 'compliance-alert' || template === 'all') scripts.push(generateComplianceAlert(trade, language));

  return scripts;
}

// ─── CLI Entry Point ────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const getArg = (flag: string) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };

  const template = (getArg('--template') ?? 'all') as GenerateOptions['template'];
  const trade = (getArg('--trade') ?? 'plumbing') as Trade;
  const language = (getArg('--lang') ?? 'EN') as Language;
  const outputDir = getArg('--out') ?? 'out/scripts';

  const smart = args.includes('--smart');
  const bootstrap = args.includes('--bootstrap');

  console.log(`\n🎬 Generating video scripts: template=${template}, trade=${trade}, lang=${language}${smart ? ' (SMART mode)' : ''}\n`);

  // Bootstrap: scan codebase to build knowledge base
  if (bootstrap) {
    const { bootstrapFromCodebase } = require('../src/data/learning') as typeof import('../src/data/learning');
    const projectRoot = path.resolve(__dirname, '../..');
    const knowledge = bootstrapFromCodebase(projectRoot);
    console.log(`  📚 Codebase scanned: ${knowledge.trades.length} trades, ${knowledge.supplierCount} suppliers, ${knowledge.quoteTemplateCount} quote templates, ${knowledge.languages.length} languages\n`);
  }

  // Smart mode: use learning engine recommendations
  if (smart) {
    const { getRecommendations, analyzePerformance } = require('../src/data/learning') as typeof import('../src/data/learning');
    analyzePerformance();
    const recs = getRecommendations(trade, language);
    if (recs.length > 0) {
      console.log(`  🧠 Learning engine recommendations:`);
      for (const rec of recs.slice(0, 3)) {
        console.log(`     ${rec.action.toUpperCase()}: ${rec.templateId} — ${rec.reason} (${(rec.confidence * 100).toFixed(0)}% confidence)`);
      }
      console.log('');
    }
  }

  const scripts = generateScripts({ template, trade, language });

  // Ensure output directory exists
  const outPath = path.resolve(__dirname, '..', outputDir);
  fs.mkdirSync(outPath, { recursive: true });

  for (const script of scripts) {
    const filePath = path.join(outPath, `${script.outputFilename.replace('.mp4', '.json')}`);
    fs.writeFileSync(filePath, JSON.stringify(script, null, 2));
    console.log(`  ✅ ${script.templateId} → ${filePath}`);
    console.log(`     Props: ${JSON.stringify(script.props).slice(0, 120)}...`);
    console.log(`     Output: ${script.outputFilename} (${script.estimatedDurationSec}s)\n`);
  }

  console.log(`\n📦 ${scripts.length} scripts generated in ${outPath}`);
  console.log(`\nTo render: npx remotion render Root <TemplateId> out/<filename>.mp4 --props=out/scripts/<script>.json`);
}
