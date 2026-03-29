#!/usr/bin/env tsx
// =============================================================================
// BRIEF → VIDEO BRIDGE — Connects admin brief generator to video pipeline
// =============================================================================
// Takes a BriefTemplate JSON (from admin/src/lib/briefs.ts) and converts it
// into Remotion-compatible video scripts. This is the personalization layer.
//
// The admin brief generator uses REAL UGC performance data:
//   - topHooks: actual hooks that performed best (by retention rate)
//   - topFormats: which video formats get most watch time
//   - topVideos: inspiration from your best performers
//
// This script maps that data into template props so every video is
// personalized based on what's ACTUALLY working in your content.
//
// Usage:
//   npx tsx scripts/brief-to-video.ts --brief brief.json --trade plumbing
//   npx tsx scripts/brief-to-video.ts --brief brief.json --trade solar --replicate
// =============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { TRADES, getTradeLabel, type Trade, type Language } from '../src/data/trades';

// ─── Brief Template Interface (mirrors admin/src/lib/briefs.ts) ────────────

interface BriefTemplate {
  id: string;
  title: string;
  podLanguage: string;
  hookOptions: string[];           // Top 3 hooks by retention
  format: string;                  // Best-performing format
  conceptCluster: string;
  dosAndDonts: { dos: string[]; donts: string[] };
  duration: string;
  cta: string;
  inspiration: string[];           // Top videos with view counts
  keyMessages: string[];
}

// ─── Template Mapping ───────────────────────────────────────────────────────

interface VideoScript {
  templateId: string;
  props: Record<string, unknown>;
  outputFilename: string;
  language: string;
  trade: string;
  personalizedFrom: string;        // Brief ID — for tracking
}

function briefToDidYouKnow(brief: BriefTemplate, trade: Trade): VideoScript {
  const tradeInfo = TRADES.find(t => t.id === trade)!;
  const lang = brief.podLanguage as Language;

  return {
    templateId: 'DidYouKnow',
    props: {
      // Use the TOP PERFORMING hook from the brief (data-driven, not hardcoded)
      hookText: brief.hookOptions[0] ?? 'Did you know?',
      tradeEmoji: tradeInfo.emoji,
      tradeName: getTradeLabel(trade, lang),
      tradeColor: tradeInfo.color,
      // Key message becomes the stat
      statValue: brief.keyMessages[0]?.match(/\d+%?/)?.[0] ?? '73%',
      statLabel: brief.keyMessages[0] ?? brief.hookOptions[0] ?? '',
      // CTA from brief
      factText: brief.keyMessages.slice(0, 2).join('. ') || brief.cta,
      ctaText: brief.cta || 'Download — free',
      ctaSubtext: '',
      language: lang,
    },
    outputFilename: `dyk_${trade}_${lang.toLowerCase()}_${brief.id}.mp4`,
    language: lang,
    trade,
    personalizedFrom: brief.id,
  };
}

function briefToEveSays(brief: BriefTemplate, trade: Trade): VideoScript {
  const tradeInfo = TRADES.find(t => t.id === trade)!;
  const lang = brief.podLanguage as Language;

  return {
    templateId: 'EveSays',
    props: {
      tipTitle: brief.hookOptions[0] ?? 'Pro tip',
      tipBody: brief.keyMessages.join(' ') || brief.dosAndDonts.dos.slice(0, 2).join('. '),
      tradeEmoji: tradeInfo.emoji,
      tradeName: getTradeLabel(trade, lang),
      ctaText: brief.cta || 'Try it free',
      language: lang,
    },
    outputFilename: `eve_${trade}_${lang.toLowerCase()}_${brief.id}.mp4`,
    language: lang,
    trade,
    personalizedFrom: brief.id,
  };
}

function briefToComplianceAlert(brief: BriefTemplate, trade: Trade): VideoScript {
  const tradeInfo = TRADES.find(t => t.id === trade)!;
  const lang = brief.podLanguage as Language;

  // Extract compliance-relevant info from brief key messages
  return {
    templateId: 'ComplianceAlert',
    props: {
      countryFlag: lang === 'NL' ? '🇳🇱' : lang === 'DE' ? '🇩🇪' : lang === 'FR' ? '🇫🇷' : lang === 'ES' ? '🇪🇸' : lang === 'IT' ? '🇮🇹' : '🇬🇧',
      countryName: lang === 'NL' ? 'Nederland' : lang === 'DE' ? 'Deutschland' : lang === 'FR' ? 'France' : lang === 'ES' ? 'España' : lang === 'IT' ? 'Italia' : 'United Kingdom',
      regulationName: brief.keyMessages[0] ?? 'Certification Renewal',
      deadlineText: brief.keyMessages[1] ?? 'Check your expiry date',
      daysLeft: 45,
      consequence: brief.keyMessages[2] ?? 'Fines + work stoppage',
      tradeEmoji: tradeInfo.emoji,
      tradeName: getTradeLabel(trade, lang),
      ctaText: brief.cta || 'Never miss a deadline',
      language: lang,
    },
    outputFilename: `compliance_${trade}_${lang.toLowerCase()}_${brief.id}.mp4`,
    language: lang,
    trade,
    personalizedFrom: brief.id,
  };
}

// ─── Format → Template Mapping ──────────────────────────────────────────────

function mapFormatToTemplates(format: string): string[] {
  const mapping: Record<string, string[]> = {
    'before-after': ['DidYouKnow', 'EveSays'],           // Before/after format → fact + tip
    'tutorial': ['EveSays'],                               // Tutorial → tip template
    'day-in-life': ['DidYouKnow', 'EveSays'],            // Day in life → fact + tip
    'tool-review': ['PriceCheck', 'DidYouKnow'],         // Tool review → price comparison + fact
    'transformation': ['DidYouKnow'],                      // Transformation → fact
    'tip': ['EveSays'],                                    // Direct tip → EVE Says
    'compliance': ['ComplianceAlert'],                     // Compliance → alert
  };
  return mapping[format] ?? ['DidYouKnow', 'EveSays'];
}

// ─── Main ───────────────────────────────────────────────────────────────────

export function convertBriefToScripts(brief: BriefTemplate, trade: Trade): VideoScript[] {
  const templates = mapFormatToTemplates(brief.format);
  const scripts: VideoScript[] = [];

  for (const tpl of templates) {
    switch (tpl) {
      case 'DidYouKnow': scripts.push(briefToDidYouKnow(brief, trade)); break;
      case 'EveSays': scripts.push(briefToEveSays(brief, trade)); break;
      case 'ComplianceAlert': scripts.push(briefToComplianceAlert(brief, trade)); break;
    }
  }

  return scripts;
}

// ─── CLI ────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const getArg = (flag: string) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };

  const briefPath = getArg('--brief');
  const trade = (getArg('--trade') ?? 'plumbing') as Trade;
  const replicate = args.includes('--replicate');
  const outputDir = getArg('--out') ?? 'out/from-brief';

  if (!briefPath) {
    console.error('Usage: npx tsx scripts/brief-to-video.ts --brief <path.json> --trade <trade> [--replicate]');
    process.exit(1);
  }

  const brief: BriefTemplate = JSON.parse(fs.readFileSync(briefPath, 'utf8'));
  console.log(`\n🎬 Converting brief "${brief.title}" to video scripts\n`);
  console.log(`  Format: ${brief.format}`);
  console.log(`  Hooks: ${brief.hookOptions.join(' | ')}`);
  console.log(`  Trade: ${trade}`);
  console.log(`  Replicate: ${replicate ? 'YES (6 languages)' : 'NO (single language)'}\n`);

  const outPath = path.resolve(__dirname, '..', outputDir);
  fs.mkdirSync(outPath, { recursive: true });

  const languages: Language[] = replicate
    ? ['EN', 'NL', 'DE', 'FR', 'ES', 'IT']
    : [brief.podLanguage as Language];

  let total = 0;
  for (const lang of languages) {
    const localBrief = { ...brief, podLanguage: lang };
    const scripts = convertBriefToScripts(localBrief, trade);
    for (const script of scripts) {
      const filePath = path.join(outPath, `${script.outputFilename.replace('.mp4', '.json')}`);
      fs.writeFileSync(filePath, JSON.stringify(script, null, 2));
      console.log(`  ✅ ${script.templateId} (${lang}) → ${path.basename(filePath)}`);
      total++;
    }
  }

  console.log(`\n📦 ${total} personalized scripts generated from brief "${brief.id}"`);
}
