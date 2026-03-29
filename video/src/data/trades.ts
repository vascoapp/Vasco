// =============================================================================
// TRADE DATA — Shared between video templates and main app
// =============================================================================

export type Trade = 'plumbing' | 'electrical' | 'gas' | 'painting' | 'carpentry' | 'roofing' | 'tiling' | 'plastering' | 'flooring' | 'insulation' | 'solar' | 'glazing' | 'landscaping' | 'general';

export interface TradeInfo {
  id: Trade;
  emoji: string;
  labelEN: string;
  labelNL: string;
  labelDE: string;
  labelFR: string;
  labelES: string;
  labelIT: string;
  color: string;
}

export const TRADES: TradeInfo[] = [
  { id: 'plumbing', emoji: '🔧', labelEN: 'Plumbing', labelNL: 'Loodgieter', labelDE: 'Klempner', labelFR: 'Plomberie', labelES: 'Fontanería', labelIT: 'Idraulica', color: '#3B82F6' },
  { id: 'electrical', emoji: '⚡', labelEN: 'Electrical', labelNL: 'Elektricien', labelDE: 'Elektriker', labelFR: 'Électricité', labelES: 'Electricidad', labelIT: 'Elettricista', color: '#F59E0B' },
  { id: 'gas', emoji: '🔥', labelEN: 'Gas / HVAC', labelNL: 'Gas / CV', labelDE: 'Gas / Heizung', labelFR: 'Gaz / CVC', labelES: 'Gas / HVAC', labelIT: 'Gas / HVAC', color: '#EF4444' },
  { id: 'painting', emoji: '🎨', labelEN: 'Painting', labelNL: 'Schilder', labelDE: 'Maler', labelFR: 'Peinture', labelES: 'Pintura', labelIT: 'Pittura', color: '#8B5CF6' },
  { id: 'carpentry', emoji: '🪚', labelEN: 'Carpentry', labelNL: 'Timmerman', labelDE: 'Zimmermann', labelFR: 'Menuiserie', labelES: 'Carpintería', labelIT: 'Falegnameria', color: '#A16207' },
  { id: 'roofing', emoji: '🏠', labelEN: 'Roofing', labelNL: 'Dakdekker', labelDE: 'Dachdecker', labelFR: 'Couvreur', labelES: 'Tejados', labelIT: 'Coperture', color: '#DC2626' },
  { id: 'tiling', emoji: '🔲', labelEN: 'Tiling', labelNL: 'Tegelzetter', labelDE: 'Fliesenleger', labelFR: 'Carreleur', labelES: 'Alicatador', labelIT: 'Piastrellista', color: '#06B6D4' },
  { id: 'plastering', emoji: '🧱', labelEN: 'Plastering', labelNL: 'Stukadoor', labelDE: 'Stuckateur', labelFR: 'Plâtrier', labelES: 'Yesero', labelIT: 'Intonacatore', color: '#D97706' },
  { id: 'flooring', emoji: '🪵', labelEN: 'Flooring', labelNL: 'Vloerenlegger', labelDE: 'Bodenleger', labelFR: 'Solier', labelES: 'Solador', labelIT: 'Pavimentista', color: '#65A30D' },
  { id: 'insulation', emoji: '🧊', labelEN: 'Insulation', labelNL: 'Isolatiemonteur', labelDE: 'Dämmungsmonteur', labelFR: 'Isolateur', labelES: 'Aislador', labelIT: 'Coibentatore', color: '#0891B2' },
  { id: 'solar', emoji: '☀️', labelEN: 'Solar / PV', labelNL: 'Zonnepanelen', labelDE: 'Solar', labelFR: 'Solaire', labelES: 'Solar', labelIT: 'Solare', color: '#F97316' },
  { id: 'glazing', emoji: '🪟', labelEN: 'Glazing', labelNL: 'Glaszetter', labelDE: 'Glaser', labelFR: 'Vitrier', labelES: 'Cristalero', labelIT: 'Vetraio', color: '#64748B' },
  { id: 'landscaping', emoji: '🌿', labelEN: 'Landscaping', labelNL: 'Hovenier', labelDE: 'Gärtner', labelFR: 'Paysagiste', labelES: 'Paisajista', labelIT: 'Giardiniere', color: '#16A34A' },
  { id: 'general', emoji: '🏗️', labelEN: 'General', labelNL: 'Aannemer', labelDE: 'Bauunternehmer', labelFR: 'Entrepreneur', labelES: 'Constructor', labelIT: 'Imprenditore', color: '#6366F1' },
];

export function getTradeLabel(trade: Trade, lang: string): string {
  const t = TRADES.find(tr => tr.id === trade);
  if (!t) return trade;
  const key = `label${lang.toUpperCase()}` as keyof TradeInfo;
  return (t[key] as string) ?? t.labelEN;
}

export type Language = 'EN' | 'NL' | 'DE' | 'FR' | 'ES' | 'IT';

export const COUNTRIES: { code: Language; flag: string; label: string }[] = [
  { code: 'EN', flag: '🇬🇧', label: 'United Kingdom' },
  { code: 'NL', flag: '🇳🇱', label: 'Nederland' },
  { code: 'DE', flag: '🇩🇪', label: 'Deutschland' },
  { code: 'FR', flag: '🇫🇷', label: 'France' },
  { code: 'ES', flag: '🇪🇸', label: 'España' },
  { code: 'IT', flag: '🇮🇹', label: 'Italia' },
];
