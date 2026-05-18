// =============================================================================
// MOCK CUSTOMER PORTAL DATA
// =============================================================================
// Sample data for customer-facing decision portal
// =============================================================================

import type {
  CustomerAccessToken,
  CustomerPortalData,
  CustomerShareSettings,
} from '../types/customerPortal';

// ============================================
// MOCK ACCESS TOKENS
// ============================================

export const MOCK_ACCESS_TOKENS: CustomerAccessToken[] = [
  {
    id: 'token_1',
    trackerId: 'tracker_1',
    customerId: 'cust_vandenberg',
    accessCode: 'VDB24A',
    accessUrl: 'https://vascobuild.com/c/VDB24A',
    expiresAt: '2027-03-15T23:59:59Z',
    isActive: true,
    createdAt: '2026-01-15T09:00:00Z',
    lastAccessedAt: '2026-02-08T14:22:00Z',
    accessCount: 12,
    canViewPrices: true,
    canAddNotes: true,
    canUploadPhotos: true,
  },
];

// ============================================
// MOCK CUSTOMER PORTAL DATA
// ============================================

export const MOCK_CUSTOMER_PORTAL: CustomerPortalData = {
  accessToken: 'VDB24A',

  // Project info
  projectName: 'Badkamer Renovatie',
  contractorName: 'Thomas de Vries',
  contractorCompany: 'De Vries Bouw & Renovatie',
  contractorPhone: '+31 6 9876 5432',

  // Timeline
  projectStartDate: '2026-02-15',
  estimatedCompletionDate: '2026-03-15',
  currentPhase: 'planning',

  // Summary
  totalDecisions: 11,
  completedDecisions: 9,
  overdueDecisions: 2,

  // Payment — Mollie/Stripe handles method selection on their hosted checkout
  paymentLink: 'https://checkout.mollie.com/example-session-id',
  paymentStatus: 'pending',
  quoteAmount: 8500,
  depositAmount: 4250,
  paidAmount: 0,
  paymentMethods: [
    { name: 'iDEAL', icon: 'card-outline' },
    { name: 'PayPal', icon: 'logo-paypal' },
    { name: 'Credit Card', icon: 'card-outline' },
    { name: 'Klarna', icon: 'pricetag-outline' },
    { name: 'Apple Pay', icon: 'logo-apple' },
  ],
  contractorCountry: 'NL',

  // Branding
  accentColor: '#E85D04',

  // Categories with decisions
  categories: [
    {
      id: 'cat_1',
      name: 'Sanitair & Kranen',
      description: 'Keuzes voor toilet, wastafel, douche en kranen',
      icon: 'water',
      phase: 'rough_in',
      dueDate: '2024-02-05',
      isOverdue: true,
      completedCount: 3,
      totalCount: 4,
      items: [
        {
          id: 'dec_1',
          name: 'Toilet Type',
          description: 'Kies tussen een hangend of staand toilet',
          helpText: 'Een hangend toilet is makkelijker schoon te maken maar kost meer. Een staand toilet is de traditionele optie.',
          inputType: 'select',
          options: [
            {
              value: 'wall_hung',
              label: 'Hangend toilet',
              description: 'Modern, makkelijk schoon te maken',
              priceImpact: 200,
              imageUrl: 'https://example.com/wall-hung.jpg',
            },
            {
              value: 'floor_standing',
              label: 'Staand toilet',
              description: 'Traditioneel, lagere kosten',
              priceImpact: 0,
            },
            {
              value: 'back_to_wall',
              label: 'Back-to-wall',
              description: 'Verborgen stortbak',
              priceImpact: 150,
            },
          ],
          priority: 'critical',
          whyItMatters: 'Dit bepaalt waar de leidingen komen. We moeten dit weten voor de ruwbouw begint.',
          status: 'decided',
          value: 'wall_hung',
          dueDate: '2026-02-05',
          isOverdue: false,
          decidedAt: '2026-01-22T15:30:00Z',
        },
        {
          id: 'dec_2',
          name: 'Wastafel Type',
          description: 'Kies het type wastafel',
          inputType: 'select',
          // R66 round 45: enriched with stockStatus + leadTimeDays so the
          // customer-portal UX shows real supply context (NL renovations
          // queue 6-12 weeks out — delivery is real decision input).
          options: [
            { value: 'pedestal', label: 'Op zuil', priceImpact: 0, stockStatus: 'in_stock', leadTimeDays: 3, basePriceLabel: 'Inclusief' },
            { value: 'wall_mounted', label: 'Wandmontage', priceImpact: 50, stockStatus: 'in_stock', leadTimeDays: 5 },
            { value: 'vanity_unit', label: 'Badkamermeubel met opbergruimte', priceImpact: 250, stockStatus: 'low_stock', leadTimeDays: 14 },
            { value: 'countertop', label: 'Opzetwastafel', priceImpact: 150, stockStatus: 'order_only', leadTimeDays: 21 },
          ],
          priority: 'critical',
          whyItMatters: 'Badkamermeubels hebben 2-3 weken levertijd.',
          status: 'decided',
          value: 'vanity_unit',
          dueDate: '2026-02-05',
          isOverdue: false,
          decidedAt: '2026-01-22T15:32:00Z',
        },
        {
          id: 'dec_3',
          name: 'Douche of Bad?',
          description: 'Wilt u een douche, bad, of beide?',
          inputType: 'select',
          options: [
            { value: 'shower_only', label: 'Alleen douche', priceImpact: 0, stockStatus: 'in_stock', leadTimeDays: 2, basePriceLabel: 'Standaard' },
            { value: 'bath_only', label: 'Alleen bad', priceImpact: 100, stockStatus: 'in_stock', leadTimeDays: 7 },
            { value: 'bath_shower', label: 'Bad met douche erboven', priceImpact: 150, stockStatus: 'low_stock', leadTimeDays: 10 },
            { value: 'separate', label: 'Apart bad en douche', priceImpact: 400, stockStatus: 'special_order', leadTimeDays: 28 },
          ],
          priority: 'critical',
          whyItMatters: 'Dit bepaalt de hele indeling van de badkamer.',
          status: 'decided',
          value: 'bath_shower',
          dueDate: '2026-02-05',
          isOverdue: false,
          decidedAt: '2026-01-22T15:35:00Z',
        },
        {
          id: 'dec_4',
          name: 'Kraan Afwerking',
          description: 'Welke kleur/afwerking voor de kranen?',
          inputType: 'select',
          options: [
            { value: 'chrome', label: 'Chroom', priceImpact: 0 },
            { value: 'brushed_nickel', label: 'Geborsteld nikkel', priceImpact: 50 },
            { value: 'matte_black', label: 'Mat zwart', priceImpact: 75 },
            { value: 'brass', label: 'Messing/Goud', priceImpact: 100 },
          ],
          priority: 'important',
          whyItMatters: 'Kranen kunnen 2-3 weken levertijd hebben.',
          status: 'pending',
          dueDate: '2026-02-05',
          isOverdue: true,
        },
      ],
    },
    {
      id: 'cat_2',
      name: 'Tegels',
      description: 'Vloer- en wandtegels selecteren',
      icon: 'grid',
      phase: 'installation',
      dueDate: '2024-02-05',
      isOverdue: true,
      completedCount: 2,
      totalCount: 4,
      items: [
        {
          id: 'dec_5',
          name: 'Vloertegel',
          description: 'Kies uw vloertegel (stuur een foto of link)',
          helpText: 'Let op de anti-slip waarde voor badkamervloeren. R10 of hoger is aanbevolen.',
          inputType: 'photo',
          priority: 'critical',
          whyItMatters: 'Tegels hebben vaak 2-4 weken levertijd.',
          status: 'decided',
          value: 'Terrazzo Grijs 60x60',
          photoUrls: ['https://example.com/tile1.jpg'],
          dueDate: '2026-02-05',
          isOverdue: false,
          decidedAt: '2026-01-25T11:00:00Z',
          linkedProductId: 'prod_terrazzo_grey',
          linkedProductName: 'Terrazzo Grijs 60x60cm',
          linkedProductUrl: 'https://tegeldepot.nl/terrazzo-grijs',
        },
        {
          id: 'dec_6',
          name: 'Wandtegel',
          description: 'Kies uw wandtegel (stuur een foto of link)',
          inputType: 'photo',
          priority: 'critical',
          whyItMatters: 'Tegels hebben vaak 2-4 weken levertijd.',
          status: 'pending',
          dueDate: '2026-02-05',
          isOverdue: true,
        },
        {
          id: 'dec_7',
          name: 'Tegelhoogte Wand',
          description: 'Hoe hoog moeten de wandtegels komen?',
          inputType: 'select',
          options: [
            { value: 'splashback', label: 'Alleen spatrand (60cm)', priceImpact: -200 },
            { value: 'half_wall', label: 'Halve wand (120cm)', priceImpact: 0 },
            { value: 'full_height', label: 'Tot plafond', priceImpact: 300 },
          ],
          priority: 'important',
          whyItMatters: 'We moeten de juiste hoeveelheid tegels bestellen.',
          status: 'decided',
          value: 'full_height',
          dueDate: '2026-02-05',
          isOverdue: false,
          decidedAt: '2026-01-25T11:05:00Z',
        },
        {
          id: 'dec_8',
          name: 'Voegkleur',
          description: 'Welke kleur voegen bij de tegels?',
          inputType: 'select',
          options: [
            { value: 'white', label: 'Wit', priceImpact: 0 },
            { value: 'grey', label: 'Grijs', priceImpact: 0 },
            { value: 'black', label: 'Zwart', priceImpact: 10 },
            { value: 'match', label: 'Kleur van de tegel', priceImpact: 20 },
          ],
          priority: 'optional',
          whyItMatters: 'Dit kan tijdens het tegelwerk nog beslist worden.',
          status: 'pending',
          dueDate: '2026-02-12',
          isOverdue: false,
        },
      ],
    },
    {
      id: 'cat_3',
      name: 'Elektra',
      description: 'Verlichting en stopcontacten',
      icon: 'flash',
      phase: 'rough_in',
      dueDate: '2024-02-10',
      isOverdue: false,
      completedCount: 2,
      totalCount: 3,
      items: [
        {
          id: 'dec_9',
          name: 'Spiegelverlichting',
          description: 'Welk type verlichting bij de spiegel?',
          inputType: 'select',
          options: [
            { value: 'none', label: 'Geen spiegellamp', priceImpact: -50 },
            { value: 'above', label: 'Lamp boven spiegel', priceImpact: 0 },
            { value: 'sides', label: 'Lampen aan zijkanten', priceImpact: 50 },
            { value: 'backlit', label: 'Spiegel met ingebouwde LED', priceImpact: 150 },
          ],
          priority: 'important',
          whyItMatters: 'De elektricien moet dit weten voor de ruwbouw.',
          status: 'decided',
          value: 'backlit',
          dueDate: '2026-02-10',
          isOverdue: false,
          decidedAt: '2026-01-28T09:15:00Z',
        },
        {
          id: 'dec_10',
          name: 'Vloerverwarming',
          description: 'Wilt u elektrische vloerverwarming in de badkamer?',
          inputType: 'boolean',
          priority: 'important',
          whyItMatters: 'Dit moet geïnstalleerd worden voordat de tegels gelegd worden.',
          status: 'decided',
          value: true,
          dueDate: '2026-02-10',
          isOverdue: false,
          decidedAt: '2026-01-28T09:18:00Z',
        },
        {
          id: 'dec_11',
          name: 'Afzuiging Locatie',
          description: 'Waar moet de afzuiger komen?',
          inputType: 'select',
          options: [
            { value: 'ceiling', label: 'Plafond', priceImpact: 0 },
            { value: 'wall', label: 'Muur', priceImpact: 0 },
            { value: 'window', label: 'Raam', priceImpact: -30 },
          ],
          priority: 'important',
          whyItMatters: 'Dit bepaalt waar de afvoerbuizen komen.',
          status: 'pending',
          dueDate: '2026-02-10',
          isOverdue: false,
        },
      ],
    },
    // Payment is handled via PaymentSection — not a decision category
  ],
};

// ============================================
// MOCK SHARE SETTINGS
// ============================================

export const MOCK_SHARE_SETTINGS: CustomerShareSettings = {
  requireAccessCode: true,
  accessCodeExpiry: 30,
  showPriceImpacts: true,
  showTimeline: true,
  showContractorContact: true,
  useCompanyBranding: true,
  companyLogo: undefined,
  accentColor: '#E85D04',
  welcomeMessage: 'Welkom! Hier kunt u uw keuzes voor het project doorgeven.',
  notifyOnDecision: true,
  notifyOnAccess: false,
  autoReminders: true,
  reminderDaysBefore: [7, 3, 1],
};

// ============================================
// HELPER FUNCTIONS
// ============================================

// R35: was unconditionally returning the MOCK_CUSTOMER_PORTAL fixture for the
// `VDB24A` magic access code in production. A real customer typing any other
// code would get null (correct — no fake data). But the magic code surfaced
// fake "Thomas de Vries / Badkamer Renovatie / Familie van den Berg" demo
// content in production builds too. Now fenced behind DEMO_MODE so production
// always returns null until a real `quote_access_tokens` BE lookup is wired
// (publicQuotePortalService already exists for the signed-token /accept/
// flow; the access-code portal needs a parallel BE table).
import { DEMO_MODE } from '../config/demo';

export function getPortalByAccessCode(code: string): CustomerPortalData | null {
  if (DEMO_MODE && code.toUpperCase() === 'VDB24A') {
    return MOCK_CUSTOMER_PORTAL;
  }
  return null;
}

export function validateAccessCode(code: string): boolean {
  if (!DEMO_MODE) return false; // Production: no access codes resolve until BE wired
  const token = MOCK_ACCESS_TOKENS.find(
    (t) => t.accessCode.toUpperCase() === code.toUpperCase()
  );
  if (!token) return false;
  if (!token.isActive) return false;
  if (new Date(token.expiresAt) < new Date()) return false;
  return true;
}

export function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
