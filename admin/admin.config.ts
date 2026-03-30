// ═══════════════════════════════════════════════════════════════════════════
// VASCO ADMIN DASHBOARD CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

export const APP_CONFIG = {
  // ─── Branding ──────────────────────────────────────────────────────────
  name: "VascoApp",
  shortName: "V",
  tagline: "AI-Native Construction Trades Platform",
  domain: "app.vasco.eu",
  contactEmail: "hello@vasco.eu",

  // ─── Colors ────────────────────────────────────────────────────────────
  colors: {
    primary: "#E35205",      // Hermes Orange
    secondary: "#1E3A8A",    // Deep blue
    navy: "#0D1B2A",         // Dark text / sidebar active
    text: "#333333",         // Body text
  },

  // ─── Auth ──────────────────────────────────────────────────────────────
  adminPin: "2026",

  // ─── Supabase ──────────────────────────────────────────────────────────
  supabase: {
    url: "REPLACE_WITH_SUPABASE_URL",
    anonKey: "REPLACE_WITH_SUPABASE_ANON_KEY",
  },

  // ─── KPI Funnel (Contractor Journey) ──────────────────────────────────
  funnel: [
    { id: "page_view", label: "Landing Views" },
    { id: "signup", label: "Signups" },
    { id: "onboarding_complete", label: "Onboarded" },
    { id: "first_job", label: "First Job Created" },
    { id: "first_quote", label: "First Quote Sent" },
    { id: "first_invoice", label: "First Invoice" },
    { id: "invoice_paid", label: "Invoice Paid" },
    { id: "subscription", label: "Subscribed" },
  ],

  // ─── User Types ───────────────────────────────────────────────────────
  userTypes: [
    { id: "contractor", label: "Contractor (Solo)", icon: "hammer" },
    { id: "aannemer", label: "Aannemer (GC)", icon: "business" },
    { id: "sitelead", label: "Site Lead", icon: "construct" },
  ],

  // ─── Trades ───────────────────────────────────────────────────────────
  trades: [
    "Plumbing", "Electrical", "Gas", "Painting",
    "Carpentry", "Tiling", "Roofing", "HVAC",
    "Masonry", "Demolition", "Landscaping", "General",
  ],

  // ─── Markets (EU6) ────────────────────────────────────────────────────
  markets: [
    { id: "nl", name: "Netherlands", currency: "EUR", flag: "🇳🇱" },
    { id: "de", name: "Germany", currency: "EUR", flag: "🇩🇪" },
    { id: "fr", name: "France", currency: "EUR", flag: "🇫🇷" },
    { id: "es", name: "Spain", currency: "EUR", flag: "🇪🇸" },
    { id: "it", name: "Italy", currency: "EUR", flag: "🇮🇹" },
    { id: "uk", name: "United Kingdom", currency: "GBP", flag: "🇬🇧" },
  ],

  // ─── UGC / Content ────────────────────────────────────────────────────
  classification: {
    hitMinViews: 20000,
    hitMinRetention: 0.4,
    hitMinShares: 50,
    averageMinViews: 5000,
  },

  formats: ["before-after", "tool-review", "day-in-life", "project-showcase", "tutorial", "testimonial"],
  hookTypes: ["transformation", "problem-solution", "challenge", "behind-scenes", "tip", "myth-busting"],
  conceptClusters: ["contractor-life", "project-showcase", "before-after", "tool-tips", "business-growth", "compliance-tips"],

  // ─── Pods (EU6 market pods) ───────────────────────────────────────────
  pods: [
    { id: "nl", name: "NL Pod", language: "NL", color: "#E35205" },
    { id: "de", name: "DE Pod", language: "DE", color: "#1E3A8A" },
    { id: "fr", name: "FR Pod", language: "FR", color: "#10B981" },
    { id: "es", name: "ES Pod", language: "ES", color: "#8B5CF6" },
    { id: "it", name: "IT Pod", language: "IT", color: "#EC4899" },
    { id: "uk", name: "UK Pod", language: "EN", color: "#F59E0B" },
  ],

  // ─── TikTok Accounts ──────────────────────────────────────────────────
  accounts: [
    { handle: "@vasco.eu", language: "EN" },
    { handle: "@vasco.nl", language: "NL" },
    { handle: "@vasco.de", language: "DE" },
    { handle: "@vasco.fr", language: "FR" },
    { handle: "@vasco.es", language: "ES" },
    { handle: "@vasco.it", language: "IT" },
  ],

  // ─── Pipeline Stages ───────────────────────────────────────────────────
  pipelineStages: [
    { id: "idea", label: "Idea", color: "bg-gray-100 text-gray-600" },
    { id: "scripted", label: "Scripted", color: "bg-blue-100 text-blue-700" },
    { id: "filming", label: "Filming", color: "bg-purple-100 text-purple-700" },
    { id: "editing", label: "Editing", color: "bg-amber-100 text-amber-700" },
    { id: "ready", label: "Ready", color: "bg-cyan-100 text-cyan-700" },
    { id: "posted", label: "Posted", color: "bg-emerald-100 text-emerald-700" },
    { id: "tracking", label: "Tracking", color: "bg-rose-100 text-rose-700" },
  ],

  // ─── Commission Defaults ───────────────────────────────────────────────
  defaultCommissionPct: 15,
  defaultCOGSCents: 0,

  // ─── Sidebar Navigation ───────────────────────────────────────────────
  modules: {
    overview: true,
    kpiDashboard: true,
    financial: true,
    users: true,
    developerHub: true,
    ugcAnalytics: true,
    accounts: true,
    sparkAds: true,
    swipeFile: true,
    pipeline: true,
    pods: true,
    creators: true,
    briefGenerator: true,
    commissions: true,
    weeklyReports: true,
    contentMachine: true,
  },
};
