// =============================================================================
// SUPPLIER BACKLINK SERVICE — Affiliate revenue from product ordering
// =============================================================================
// Connects contractors to trade-specific suppliers with tracked affiliate links.
// Revenue: commission on purchases made through Vasco backlinks.
// Suppliers pay 2-8% referral commission on orders placed via the app.
// =============================================================================

import type { Country } from '../context/AuthContext';

// ─── Supplier Types ────────────────────────────────────────────────────────

export interface Supplier {
  id: string;
  name: string;
  logo: string;
  category: SupplierCategory;
  countries: Country[];
  trades: string[];
  commissionRate: number;         // % earned by Vasco per order
  avgOrderValue: number;          // EUR typical order
  deliveryDays: string;           // "1-2 days", "Same day"
  url: string;                    // Base URL (affiliate params added)
  affiliateParam: string;         // URL param for tracking
  featured: boolean;
  rating: number;                 // 1-5
  description: string;
}

export type SupplierCategory =
  | 'materials'
  | 'tools'
  | 'workwear'
  | 'vehicles'
  | 'insurance'
  | 'certification'
  | 'software'
  | 'rental';

// ─── Supplier Directory ────────────────────────────────────────────────────

export const SUPPLIERS: Supplier[] = [
  // Materials
  { id: 'technische-unie', name: 'Technische Unie', logo: 'build', category: 'materials', countries: ['NL'], trades: ['plumbing', 'electrical', 'gas', 'general'], commissionRate: 3.5, avgOrderValue: 280, deliveryDays: '1-2 days', url: 'https://technischeunie.nl', affiliateParam: 'ref=vasco', featured: true, rating: 4.5, description: 'Largest technical wholesaler in the Netherlands' },
  { id: 'rexel', name: 'Rexel', logo: 'flash', category: 'materials', countries: ['NL', 'DE', 'FR', 'ES', 'IT', 'UK'], trades: ['electrical'], commissionRate: 3.0, avgOrderValue: 320, deliveryDays: '1-2 days', url: 'https://rexel.com', affiliateParam: 'partner=vasco', featured: true, rating: 4.3, description: 'Global electrical supplies distribution' },
  { id: 'saint-gobain', name: 'Saint-Gobain', logo: 'cube', category: 'materials', countries: ['FR', 'NL', 'DE', 'ES', 'IT', 'UK'], trades: ['general', 'masonry', 'roofing', 'insulation', 'glazing'], commissionRate: 2.5, avgOrderValue: 450, deliveryDays: '2-3 days', url: 'https://saint-gobain.com', affiliateParam: 'aff=vasco', featured: true, rating: 4.4, description: 'Building materials and insulation' },
  { id: 'wurth', name: 'Wurth', logo: 'construct', category: 'materials', countries: ['DE', 'NL', 'FR', 'ES', 'IT', 'UK'], trades: ['general', 'carpentry', 'electrical', 'plumbing', 'roofing', 'tiling', 'insulation', 'solar'], commissionRate: 4.0, avgOrderValue: 180, deliveryDays: '1-2 days', url: 'https://wurth.com', affiliateParam: 'ref=vasco', featured: true, rating: 4.6, description: 'Fastening and assembly materials' },
  { id: 'travis-perkins', name: 'Travis Perkins', logo: 'business', category: 'materials', countries: ['UK'], trades: ['general', 'carpentry', 'roofing', 'masonry'], commissionRate: 3.0, avgOrderValue: 340, deliveryDays: '1-2 days', url: 'https://travisperkins.co.uk', affiliateParam: 'aff=vasco', featured: true, rating: 4.2, description: "UK's largest building materials supplier" },
  { id: 'bricoman', name: 'Bricoman', logo: 'build', category: 'materials', countries: ['FR', 'IT', 'ES'], trades: ['general', 'painting', 'tiling', 'plastering', 'flooring', 'roofing'], commissionRate: 3.5, avgOrderValue: 220, deliveryDays: '1-3 days', url: 'https://bricoman.fr', affiliateParam: 'ref=vasco', featured: false, rating: 4.0, description: 'Professional building materials' },

  // Tools
  { id: 'toolstation', name: 'Toolstation', logo: 'hammer', category: 'tools', countries: ['NL', 'UK', 'FR'], trades: ['general', 'plumbing', 'electrical', 'carpentry', 'painting', 'roofing', 'tiling', 'plastering', 'flooring', 'insulation', 'solar', 'glazing', 'landscaping'], commissionRate: 5.0, avgOrderValue: 85, deliveryDays: 'Same day', url: 'https://toolstation.com', affiliateParam: 'aff=vasco', featured: true, rating: 4.4, description: 'Power tools, hand tools, and accessories' },
  { id: 'hilti', name: 'Hilti', logo: 'hammer', category: 'tools', countries: ['NL', 'DE', 'FR', 'ES', 'IT', 'UK'], trades: ['general', 'electrical', 'masonry', 'roofing', 'solar'], commissionRate: 2.0, avgOrderValue: 420, deliveryDays: '2-3 days', url: 'https://hilti.com', affiliateParam: 'partner=vasco', featured: true, rating: 4.8, description: 'Professional power tools and fastening systems' },
  { id: 'screwfix', name: 'Screwfix', logo: 'construct', category: 'tools', countries: ['UK'], trades: ['general', 'plumbing', 'electrical', 'carpentry'], commissionRate: 4.5, avgOrderValue: 65, deliveryDays: 'Same day', url: 'https://screwfix.com', affiliateParam: 'ref=vasco', featured: true, rating: 4.3, description: 'UK trade supplies — click and collect' },

  // Workwear
  { id: 'engelbert-strauss', name: 'Engelbert Strauss', logo: 'shirt', category: 'workwear', countries: ['DE', 'NL', 'FR', 'ES', 'IT', 'UK'], trades: ['general'], commissionRate: 6.0, avgOrderValue: 120, deliveryDays: '2-3 days', url: 'https://engelbert-strauss.com', affiliateParam: 'ref=vasco', featured: true, rating: 4.7, description: 'Professional workwear and safety equipment' },
  { id: 'snickers', name: 'Snickers Workwear', logo: 'shirt', category: 'workwear', countries: ['NL', 'DE', 'UK'], trades: ['general'], commissionRate: 5.5, avgOrderValue: 95, deliveryDays: '2-3 days', url: 'https://snickersworkwear.com', affiliateParam: 'aff=vasco', featured: false, rating: 4.5, description: 'Scandinavian workwear for trades' },

  // Insurance
  { id: 'hiscox', name: 'Hiscox', logo: 'shield', category: 'insurance', countries: ['UK', 'DE', 'FR', 'ES'], trades: ['general'], commissionRate: 8.0, avgOrderValue: 480, deliveryDays: 'Instant', url: 'https://hiscox.com', affiliateParam: 'ref=vasco', featured: true, rating: 4.1, description: 'Trade insurance — public liability, tools, van' },
  { id: 'allianz-trade', name: 'Allianz Trade', logo: 'shield', category: 'insurance', countries: ['DE', 'FR', 'IT', 'ES', 'NL'], trades: ['general'], commissionRate: 7.0, avgOrderValue: 520, deliveryDays: 'Instant', url: 'https://allianz-trade.com', affiliateParam: 'partner=vasco', featured: true, rating: 4.2, description: 'Business insurance for EU contractors' },

  // Tool Rental
  { id: 'boels', name: 'Boels Rental', logo: 'car', category: 'rental', countries: ['NL', 'DE', 'UK'], trades: ['general', 'demolition', 'landscaping'], commissionRate: 4.0, avgOrderValue: 180, deliveryDays: 'Same day', url: 'https://boels.com', affiliateParam: 'ref=vasco', featured: true, rating: 4.3, description: 'Equipment rental — excavators, scaffolding, tools' },

  // Certification
  { id: 'ssvv', name: 'SSVV (VCA)', logo: 'ribbon', category: 'certification', countries: ['NL'], trades: ['general'], commissionRate: 5.0, avgOrderValue: 150, deliveryDays: 'Varies', url: 'https://ssvv.nl', affiliateParam: 'ref=vasco', featured: false, rating: 4.0, description: 'VCA safety certification courses' },

  // ─── Roofing Suppliers ────────────────────────────────────────────────
  { id: 'monier', name: 'Monier / BMI', logo: 'home', category: 'materials', countries: ['NL', 'DE', 'FR', 'IT', 'UK'], trades: ['roofing'], commissionRate: 3.0, avgOrderValue: 850, deliveryDays: '3-5 days', url: 'https://bmigroup.com', affiliateParam: 'ref=vasco', featured: true, rating: 4.5, description: 'Market leader in roof tiles and flat roofing systems' },
  { id: 'derbigum', name: 'Derbigum', logo: 'layers', category: 'materials', countries: ['NL', 'DE', 'FR', 'UK'], trades: ['roofing'], commissionRate: 3.5, avgOrderValue: 620, deliveryDays: '3-5 days', url: 'https://derbigum.com', affiliateParam: 'ref=vasco', featured: false, rating: 4.3, description: 'Flat roofing membranes and EPDM systems' },

  // ─── Tiling Suppliers ─────────────────────────────────────────────────
  { id: 'weber', name: 'Weber (Saint-Gobain)', logo: 'grid', category: 'materials', countries: ['NL', 'DE', 'FR', 'ES', 'IT', 'UK'], trades: ['tiling', 'plastering', 'flooring'], commissionRate: 3.0, avgOrderValue: 280, deliveryDays: '2-3 days', url: 'https://weber.nl', affiliateParam: 'ref=vasco', featured: true, rating: 4.4, description: 'Tile adhesives, grouts, renders, and floor screeds' },
  { id: 'mosa', name: 'Mosa Tiles', logo: 'grid', category: 'materials', countries: ['NL', 'DE', 'FR', 'UK'], trades: ['tiling'], commissionRate: 2.5, avgOrderValue: 520, deliveryDays: '5-7 days', url: 'https://mosa.com', affiliateParam: 'partner=vasco', featured: false, rating: 4.6, description: 'Premium ceramic wall and floor tiles, made in NL' },

  // ─── Insulation Suppliers ─────────────────────────────────────────────
  { id: 'rockwool', name: 'Rockwool', logo: 'thermometer', category: 'materials', countries: ['NL', 'DE', 'FR', 'ES', 'IT', 'UK'], trades: ['insulation', 'roofing'], commissionRate: 3.0, avgOrderValue: 480, deliveryDays: '2-4 days', url: 'https://rockwool.com', affiliateParam: 'ref=vasco', featured: true, rating: 4.5, description: 'Stone wool insulation for walls, roofs, and floors' },
  { id: 'knauf-insulation', name: 'Knauf Insulation', logo: 'thermometer', category: 'materials', countries: ['NL', 'DE', 'FR', 'ES', 'IT', 'UK'], trades: ['insulation'], commissionRate: 3.0, avgOrderValue: 420, deliveryDays: '2-4 days', url: 'https://knaufinsulation.com', affiliateParam: 'ref=vasco', featured: true, rating: 4.4, description: 'Glass and rock mineral wool, PIR boards' },
  { id: 'recticel', name: 'Recticel Insulation', logo: 'thermometer', category: 'materials', countries: ['NL', 'DE', 'FR', 'UK'], trades: ['insulation', 'roofing'], commissionRate: 3.5, avgOrderValue: 550, deliveryDays: '3-5 days', url: 'https://recticelinsulation.com', affiliateParam: 'ref=vasco', featured: false, rating: 4.3, description: 'PIR insulation boards for roofs and floors' },

  // ─── Solar Suppliers ──────────────────────────────────────────────────
  { id: 'solarwatt', name: 'SolarWatt', logo: 'sunny', category: 'materials', countries: ['NL', 'DE', 'FR'], trades: ['solar'], commissionRate: 2.5, avgOrderValue: 2200, deliveryDays: '5-10 days', url: 'https://solarwatt.com', affiliateParam: 'partner=vasco', featured: true, rating: 4.6, description: 'German solar panels with 30-year warranty' },
  { id: 'enphase', name: 'Enphase Energy', logo: 'sunny', category: 'materials', countries: ['NL', 'DE', 'FR', 'ES', 'IT', 'UK'], trades: ['solar'], commissionRate: 2.0, avgOrderValue: 1800, deliveryDays: '3-7 days', url: 'https://enphase.com', affiliateParam: 'ref=vasco', featured: true, rating: 4.7, description: 'Micro-inverters and energy monitoring systems' },
  { id: 'k2-systems', name: 'K2 Systems', logo: 'sunny', category: 'materials', countries: ['NL', 'DE', 'FR', 'ES', 'IT', 'UK'], trades: ['solar'], commissionRate: 4.0, avgOrderValue: 650, deliveryDays: '3-5 days', url: 'https://k2-systems.com', affiliateParam: 'ref=vasco', featured: false, rating: 4.4, description: 'Solar mounting systems for all roof types' },

  // ─── Glazing Suppliers ────────────────────────────────────────────────
  { id: 'pilkington', name: 'Pilkington (NSG)', logo: 'browsers', category: 'materials', countries: ['NL', 'DE', 'FR', 'ES', 'IT', 'UK'], trades: ['glazing'], commissionRate: 2.5, avgOrderValue: 680, deliveryDays: '5-10 days', url: 'https://pilkington.com', affiliateParam: 'ref=vasco', featured: true, rating: 4.4, description: 'Float glass, insulating glass units, safety glass' },
  { id: 'velux', name: 'VELUX', logo: 'browsers', category: 'materials', countries: ['NL', 'DE', 'FR', 'ES', 'IT', 'UK'], trades: ['glazing', 'roofing'], commissionRate: 3.0, avgOrderValue: 520, deliveryDays: '5-7 days', url: 'https://velux.com', affiliateParam: 'partner=vasco', featured: true, rating: 4.6, description: 'Roof windows, skylights, and blinds' },

  // ─── Landscaping Suppliers ────────────────────────────────────────────
  { id: 'gamma-tuin', name: 'GAMMA Tuin', logo: 'leaf', category: 'materials', countries: ['NL'], trades: ['landscaping'], commissionRate: 5.0, avgOrderValue: 180, deliveryDays: '1-3 days', url: 'https://gamma.nl', affiliateParam: 'ref=vasco', featured: true, rating: 4.1, description: 'Garden materials, fencing, paving' },
  { id: 'jonk-bv', name: 'Jonk BV', logo: 'leaf', category: 'materials', countries: ['NL'], trades: ['landscaping'], commissionRate: 3.5, avgOrderValue: 450, deliveryDays: '2-5 days', url: 'https://jonk.nl', affiliateParam: 'ref=vasco', featured: false, rating: 4.3, description: 'Professional landscaping materials and natural stone' },
  { id: 'marshalls', name: 'Marshalls', logo: 'leaf', category: 'materials', countries: ['UK'], trades: ['landscaping'], commissionRate: 3.0, avgOrderValue: 380, deliveryDays: '3-5 days', url: 'https://marshalls.co.uk', affiliateParam: 'ref=vasco', featured: true, rating: 4.4, description: 'UK market leader in natural stone and concrete paving' },

  // ─── Flooring Suppliers ───────────────────────────────────────────────
  { id: 'quick-step', name: 'Quick-Step', logo: 'albums', category: 'materials', countries: ['NL', 'DE', 'FR', 'ES', 'IT', 'UK'], trades: ['flooring'], commissionRate: 3.0, avgOrderValue: 320, deliveryDays: '3-5 days', url: 'https://quick-step.com', affiliateParam: 'ref=vasco', featured: true, rating: 4.5, description: 'Laminate, vinyl, and engineered wood flooring' },
  { id: 'forbo', name: 'Forbo Flooring', logo: 'albums', category: 'materials', countries: ['NL', 'DE', 'FR', 'UK'], trades: ['flooring'], commissionRate: 3.0, avgOrderValue: 280, deliveryDays: '3-7 days', url: 'https://forbo.com', affiliateParam: 'ref=vasco', featured: false, rating: 4.3, description: 'Marmoleum, vinyl, and carpet tiles for professionals' },
];

// ─── Backlink Generation ───────────────────────────────────────────────────

export interface BacklinkResult {
  supplier: Supplier;
  trackedUrl: string;
  estimatedCommission: number;    // EUR per typical order
}

export function generateBacklink(
  supplierId: string,
  userId: string,
): BacklinkResult | null {
  const supplier = SUPPLIERS.find((s) => s.id === supplierId);
  if (!supplier) return null;

  const trackedUrl = `${supplier.url}?${supplier.affiliateParam}&uid=${userId}&src=app`;
  const estimatedCommission = Math.round(supplier.avgOrderValue * (supplier.commissionRate / 100) * 100) / 100;

  return { supplier, trackedUrl, estimatedCommission };
}

// ─── Supplier Search ───────────────────────────────────────────────────────

export function getSuppliersByCountry(country: Country): Supplier[] {
  return SUPPLIERS.filter((s) => s.countries.includes(country));
}

export function getSuppliersByTrade(trade: string, country?: Country): Supplier[] {
  return SUPPLIERS.filter((s) =>
    s.trades.includes(trade) && (!country || s.countries.includes(country))
  );
}

export function getSuppliersByCategory(category: SupplierCategory, country?: Country): Supplier[] {
  return SUPPLIERS.filter((s) =>
    s.category === category && (!country || s.countries.includes(country))
  );
}

export function getFeaturedSuppliers(country: Country): Supplier[] {
  return SUPPLIERS.filter((s) => s.featured && s.countries.includes(country))
    .sort((a, b) => b.rating - a.rating);
}

// ─── Revenue Tracking ──────────────────────────────────────────────────────

export interface BacklinkClick {
  supplierId: string;
  userId: string;
  clickedAt: string;
  converted: boolean;
  orderValue: number;
  commission: number;
}

export interface BacklinkRevenueSummary {
  totalClicks: number;
  totalConversions: number;
  conversionRate: number;
  totalOrderValue: number;
  totalCommission: number;
  avgCommissionPerClick: number;
  topSuppliers: { supplierId: string; name: string; clicks: number; commission: number }[];
}

// Categories for UI display
export const SUPPLIER_CATEGORIES: { id: SupplierCategory; label: string; icon: string }[] = [
  { id: 'materials', label: 'Building Materials', icon: 'cube' },
  { id: 'tools', label: 'Tools & Equipment', icon: 'hammer' },
  { id: 'workwear', label: 'Workwear & Safety', icon: 'shirt' },
  { id: 'insurance', label: 'Trade Insurance', icon: 'shield' },
  { id: 'rental', label: 'Equipment Rental', icon: 'car' },
  { id: 'certification', label: 'Certifications', icon: 'ribbon' },
  { id: 'vehicles', label: 'Vehicles', icon: 'car' },
  { id: 'software', label: 'Software', icon: 'code' },
];
