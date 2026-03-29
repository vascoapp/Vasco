// =============================================================================
// HOOK LIBRARY — Top-performing hooks for video templates
// =============================================================================
// Organized by format type. Based on VascoApp UGC performance data.
// Each hook has multilingual variants for EU6 pod replication.
// =============================================================================

export interface Hook {
  id: string;
  format: 'did_you_know' | 'price_check' | 'before_after' | 'tip' | 'compliance';
  text: Record<string, string>; // Keyed by language code
  retentionRate: number;        // 0-1, historical performance
}

export const HOOKS: Hook[] = [
  // ─── Did You Know ─────────────────────────────────────────────
  {
    id: 'dyk-1',
    format: 'did_you_know',
    text: {
      EN: 'Did you know? 73% of contractors lose money on quotes',
      NL: 'Wist je dat? 73% van aannemers verliest geld op offertes',
      DE: 'Wusstest du? 73% der Handwerker verlieren Geld bei Angeboten',
      FR: 'Le saviez-vous ? 73% des artisans perdent de l\'argent sur les devis',
      ES: '¿Sabías que? El 73% de los contratistas pierde dinero en presupuestos',
      IT: 'Lo sapevi? Il 73% degli artigiani perde soldi sui preventivi',
    },
    retentionRate: 0.42,
  },
  {
    id: 'dyk-2',
    format: 'did_you_know',
    text: {
      EN: 'The average plumber spends 8 hours/week on admin',
      NL: 'De gemiddelde loodgieter besteedt 8 uur/week aan administratie',
      DE: 'Der durchschnittliche Klempner verbringt 8 Stunden/Woche mit Verwaltung',
      FR: 'Le plombier moyen passe 8h/semaine en administratif',
      ES: 'El fontanero promedio dedica 8 horas/semana a la administración',
      IT: 'L\'idraulico medio dedica 8 ore/settimana all\'amministrazione',
    },
    retentionRate: 0.38,
  },
  {
    id: 'dyk-3',
    format: 'did_you_know',
    text: {
      EN: 'Solar installers who quote within 24h win 3x more jobs',
      NL: 'Zonnepaneel installateurs die binnen 24u offreren winnen 3x meer klussen',
      DE: 'Solarinstallateure die innerhalb von 24h anbieten gewinnen 3x mehr Aufträge',
      FR: 'Les installateurs solaires qui devisent dans les 24h gagnent 3x plus de chantiers',
      ES: 'Los instaladores solares que cotizan en 24h ganan 3x más trabajos',
      IT: 'Gli installatori solari che preventivano entro 24h vincono 3x più lavori',
    },
    retentionRate: 0.45,
  },

  // ─── Price Check ──────────────────────────────────────────────
  {
    id: 'pc-1',
    format: 'price_check',
    text: {
      EN: 'Are you overpaying for materials? Let\'s check...',
      NL: 'Betaal je te veel voor materialen? Laten we checken...',
      DE: 'Zahlst du zu viel für Material? Lass uns prüfen...',
      FR: 'Payez-vous trop cher vos matériaux ? Vérifions...',
      ES: '¿Estás pagando de más por los materiales? Vamos a ver...',
      IT: 'Stai pagando troppo per i materiali? Controlliamo...',
    },
    retentionRate: 0.44,
  },

  // ─── Tips ─────────────────────────────────────────────────────
  {
    id: 'tip-1',
    format: 'tip',
    text: {
      EN: 'This one trick gets me paid 2 weeks faster',
      NL: 'Met deze truc word ik 2 weken sneller betaald',
      DE: 'Mit diesem Trick werde ich 2 Wochen schneller bezahlt',
      FR: 'Cette astuce me fait payer 2 semaines plus vite',
      ES: 'Este truco me hace cobrar 2 semanas antes',
      IT: 'Questo trucco mi fa pagare 2 settimane prima',
    },
    retentionRate: 0.47,
  },

  // ─── Compliance ───────────────────────────────────────────────
  {
    id: 'comp-1',
    format: 'compliance',
    text: {
      EN: 'This certification expires next month. Are you ready?',
      NL: 'Dit certificaat verloopt volgende maand. Ben je voorbereid?',
      DE: 'Diese Zertifizierung läuft nächsten Monat ab. Bist du bereit?',
      FR: 'Cette certification expire le mois prochain. Êtes-vous prêt ?',
      ES: 'Esta certificación vence el próximo mes. ¿Estás preparado?',
      IT: 'Questa certificazione scade il mese prossimo. Sei pronto?',
    },
    retentionRate: 0.36,
  },
];

export function getHooksForFormat(format: Hook['format']): Hook[] {
  return HOOKS.filter(h => h.format === format).sort((a, b) => b.retentionRate - a.retentionRate);
}
