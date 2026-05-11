// ---------------------------------------------------------------------------
// VascoApp KPI Dashboard — types, demo data, and Supabase queries
// ---------------------------------------------------------------------------

import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

// ─── Funnel Types ──────────────────────────────────────────────────────────

export interface FunnelMetrics {
  landingViews: number;
  signups: number;
  onboarded: number;
  firstJob: number;
  firstQuote: number;
  firstInvoice: number;
  invoicePaid: number;
  subscribed: number;
}

// ─── User Metrics ──────────────────────────────────────────────────────────

export interface UserMetrics {
  totalUsers: number;
  contractors: number;
  aannemers: number;
  siteLeads: number;
  activeThisWeek: number;
  activeThisMonth: number;
  newThisWeek: number;
  newThisMonth: number;
  onboardingCompletionRate: number;
  churnRate: number; // monthly %
  retentionRate: number; // monthly %
}

export interface UsersByTrade {
  trade: string;
  count: number;
  percentage: number;
  avgRevenue: number;
}

// ─── Financial KPIs ────────────────────────────────────────────────────────

export interface FinancialKPIs {
  mrr: number;            // Monthly Recurring Revenue
  arr: number;            // Annual Recurring Revenue
  arpu: number;           // Average Revenue Per User
  ltv: number;            // Lifetime Value
  cac: number;            // Customer Acquisition Cost
  ltvCacRatio: number;
  totalInvoicesSent: number;
  totalInvoicesPaid: number;
  invoicePaymentRate: number;
  totalInvoiceValue: number;
  totalPaidValue: number;
  avgInvoiceSize: number;
  avgPaymentTime: number; // days
  subscriptionRevenue: number;
  transactionRevenue: number;
}

// ─── Market Breakdown ──────────────────────────────────────────────────────

export interface MarketMetrics {
  market: string;
  flag: string;
  users: number;
  activeUsers: number;
  jobs: number;
  invoicesSent: number;
  revenue: number;
  mrr: number;
  growthRate: number; // month-over-month %
}

// ─── Daily Revenue ─────────────────────────────────────────────────────────

export interface DailyRevenue {
  date: string;
  subscriptionRevenue: number;
  transactionRevenue: number;
  totalRevenue: number;
  newUsers: number;
}

// ─── Job Metrics ───────────────────────────────────────────────────────────

export interface JobMetrics {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  avgJobValue: number;
  totalQuotesSent: number;
  quoteConversionRate: number;
  avgQuoteToJobDays: number;
}

// ─── Developer Hub Types ───────────────────────────────────────────────────

export interface BugReport {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  status: "open" | "in_progress" | "resolved" | "closed";
  reportedBy: string;
  reportedAt: string;
  assignee: string;
  platform: "ios" | "android" | "web" | "api";
  description: string;
}

export interface LatencyMetric {
  endpoint: string;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  requestsPerMin: number;
}

export interface UserSuggestion {
  id: string;
  title: string;
  description: string;
  votes: number;
  status: "new" | "under_review" | "planned" | "in_progress" | "shipped" | "declined";
  submittedBy: string;
  submittedAt: string;
  category: "feature" | "improvement" | "integration" | "ux" | "performance";
}

export interface DeployStatus {
  version: string;
  environment: "production" | "staging" | "development";
  deployedAt: string;
  status: "healthy" | "degraded" | "down";
  uptime: number; // percentage
  lastIncident: string;
}

export interface CronJobHealth {
  jobName: string;
  schedule: string;
  active: boolean;
  lastStatus: "succeeded" | "failed" | "running" | null;
  lastStart: string | null;
  lastEnd: string | null;
  totalRuns: number;
}

export interface DeveloperHubData {
  bugs: BugReport[];
  latency: LatencyMetric[];
  suggestions: UserSuggestion[];
  deploys: DeployStatus[];
  errorRate24h: number;
  avgResponseTime: number;
  totalApiCalls24h: number;
  uptimePercent: number;
  cron: CronJobHealth[];
  cronExpected: number; // number of vasco-* schedules that should be registered
}

// ─── Monetization Metrics ───────────────────────────────────────────────────

export interface SubscriptionMetrics {
  gratisUsers: number;
  contractorUsers: number;
  trialUsers: number;
  conversionRate: number;        // gratis → paid %
  trialConversionRate: number;   // trial → paid %
  monthlyChurn: number;          // %
  annualVsMonthly: number;       // % on annual
  subscriptionMRR: number;
  seatRevenue: number;           // extra seats MRR
  totalSeatsUsed: number;
}

export interface PaymentProcessingMetrics {
  totalTransactions: number;
  totalVolume: number;
  totalMollieFees: number;
  totalVascoFees: number;
  vascoMargin: number;
  avgMarginPerTx: number;
  topMethods: { method: string; count: number; volume: number; margin: number }[];
}

export interface SupplierBacklinkMetrics {
  totalClicks: number;
  totalConversions: number;
  conversionRate: number;
  totalOrderValue: number;
  totalCommission: number;
  topSuppliers: { name: string; clicks: number; conversions: number; commission: number }[];
  topCategories: { category: string; clicks: number; commission: number }[];
}

export interface ComplianceRevenueMetrics {
  usersWithCompliance: number;
  complianceUpsellRate: number;  // % of gratis users who upgrade for compliance
  revenueByCountry: { country: string; flag: string; users: number; revenue: number }[];
  eInvoiceUsage: { format: string; count: number }[];
  totalComplianceRevenue: number;
}

export interface MonetizationData {
  subscriptions: SubscriptionMetrics;
  payments: PaymentProcessingMetrics;
  backlinks: SupplierBacklinkMetrics;
  compliance: ComplianceRevenueMetrics;
  totalMRR: number;
  mrrBreakdown: { source: string; amount: number; percentage: number }[];
}

// ─── Dashboard Data ────────────────────────────────────────────────────────

export interface KPIDashboardData {
  funnel: FunnelMetrics;
  users: UserMetrics;
  usersByTrade: UsersByTrade[];
  financial: FinancialKPIs;
  markets: MarketMetrics[];
  revenueTimeline: DailyRevenue[];
  jobs: JobMetrics;
  monetization: MonetizationData;
  period: { from: string; to: string; days: number };
}

// ─── UGC Types (from template) ─────────────────────────────────────────────

export type VideoClassification = "pending" | "fail" | "average" | "hit";

export interface UGCVideo {
  id: string;
  videoId: string;
  accountId: string;
  creatorName: string;
  creatorHandle: string;
  datePosted: string;
  niche: string;
  format: string;
  hookText: string;
  hookType: string;
  conceptCluster: string;
  country: string;
  views2h: number;
  views12h: number;
  views24h: number;
  viewsTotal: number;
  hookRetentionRate: number;
  avgWatchTime: number;
  completionRate: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  installs: number;
  revenueCents: number;
  classification: VideoClassification;
  costCents: number;
  videoUrl: string;
  thumbnailUrl: string;
  notes: string;
}

export interface HookAnalysis {
  hookText: string;
  hookType: string;
  videoCount: number;
  avgRetention: number;
  avgViews: number;
  avgShares: number;
}

export interface FormatAnalysis {
  format: string;
  videoCount: number;
  avgWatchTime: number;
  avgCompletionRate: number;
  avgViews: number;
}

export interface ConceptCluster {
  cluster: string;
  videoCount: number;
  avgViews: number;
  bestVideoViews: number;
  hitRate: number;
}

export interface UGCDashboardData {
  videos: UGCVideo[];
  production: {
    totalVideos: number;
    videosThisPeriod: number;
    costPerVideo: number;
    avgTimeToPublish: number;
    videosPerAccount: Record<string, number>;
    videosPerCreator: Record<string, number>;
  };
  creative: {
    avgHookRetention: number;
    avgWatchTime: number;
    avgCompletionRate: number;
    avgEngagementRate: number;
    avgAmplificationRate: number;
    totalShares: number;
    totalSaves: number;
  };
  business: {
    avgCTR: number;
    totalInstalls: number;
    avgConversionRate: number;
    revenuePerVideo: number;
    avgCPA: number;
    avgROAS: number;
  };
  hookAnalysis: HookAnalysis[];
  formatAnalysis: FormatAnalysis[];
  conceptClusters: ConceptCluster[];
  topPerformers: UGCVideo[];
  classificationBreakdown: Record<VideoClassification, number>;
  period: { from: string; to: string; days: number };
}

// ─── Swipe File Types ──────────────────────────────────────────────────────

export interface SwipeFileEntry {
  id: string;
  url: string;
  platform: string;
  hookText: string;
  hookType: string;
  format: string;
  niche: string;
  whyItWorks: string;
  tags: string[];
  estimatedViews: number;
  savedBy: string;
  isCompetitor: boolean;
  sourceAccount: string;
  createdAt: string;
}

export interface SwipeFileData {
  entries: SwipeFileEntry[];
  byHookType: Record<string, number>;
  byFormat: Record<string, number>;
  totalEntries: number;
}

// ─── Account Tracking Types ────────────────────────────────────────────────

export interface TikTokAccount {
  id: string;
  handle: string;
  platform: string;
  language: string;
  description: string;
  followers: number;
  isActive: boolean;
  totalVideos: number;
  totalViews: number;
  avgViews: number;
  hitRate: number;
  bestFormat: string;
  bestHookType: string;
  engagementRate: number;
}

export interface AccountAnalytics {
  accounts: TikTokAccount[];
  totalAccounts: number;
  totalFollowers: number;
  bestPerformingAccount: string;
  formatComparison: Record<string, Record<string, { videos: number; avgViews: number }>>;
}

// ─── Boost/Spark Ads Types ─────────────────────────────────────────────────

export interface BoostMetrics {
  totalBoosted: number;
  totalSpend: number;
  totalBoostedViews: number;
  totalBoostedClicks: number;
  totalBoostedInstalls: number;
  avgCPM: number;
  avgCPC: number;
  avgCPI: number;
  organicROI: number;
  boostedROI: number;
  boostedVideos: Array<{
    videoId: string;
    hookText: string;
    organicViews: number;
    boostedViews: number;
    spend: number;
    installs: number;
    revenue: number;
    roas: number;
  }>;
}

// ─── Creator Row ───────────────────────────────────────────────────────────

export interface CreatorRow {
  name: string;
  handle: string;
  language: string;
  affiliateCode: string;
  scans: number;
  activations: number;
  completions: number;
  purchases: number;
  revenue: number;
  conversionRate: number;
  netROI: number;
  kitsSent: number;
  cogsPerKit: number;
  affiliatePayoutPct: number;
}

// ─── Demo Data ─────────────────────────────────────────────────────────────

function generateDemoRevenueTimeline(days: number): DailyRevenue[] {
  const timeline: DailyRevenue[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 86400000);
    const dayOfWeek = date.getDay();
    const weekdayMultiplier = dayOfWeek === 0 || dayOfWeek === 6 ? 0.6 : 1;
    const growthFactor = 1 + (days - i) * 0.008;
    const subRev = Math.round((280 + Math.random() * 120) * weekdayMultiplier * growthFactor);
    const txnRev = Math.round((150 + Math.random() * 200) * weekdayMultiplier * growthFactor);
    timeline.push({
      date: date.toISOString().slice(0, 10),
      subscriptionRevenue: subRev,
      transactionRevenue: txnRev,
      totalRevenue: subRev + txnRev,
      newUsers: Math.round((8 + Math.random() * 12) * weekdayMultiplier * growthFactor),
    });
  }
  return timeline;
}

function getDemoData(days: number): KPIDashboardData {
  const now = new Date();
  const from = new Date(now.getTime() - days * 86400000);
  const scaleFactor = days / 30;

  const funnel: FunnelMetrics = {
    landingViews: Math.round(18400 * scaleFactor),
    signups: Math.round(2860 * scaleFactor),
    onboarded: Math.round(1890 * scaleFactor),
    firstJob: Math.round(1240 * scaleFactor),
    firstQuote: Math.round(870 * scaleFactor),
    firstInvoice: Math.round(620 * scaleFactor),
    invoicePaid: Math.round(480 * scaleFactor),
    subscribed: Math.round(310 * scaleFactor),
  };

  const users: UserMetrics = {
    totalUsers: 14280,
    contractors: 9840,
    aannemers: 2890,
    siteLeads: 1550,
    activeThisWeek: 4320,
    activeThisMonth: 8760,
    newThisWeek: Math.round(186 * (days / 30)),
    newThisMonth: Math.round(720 * (days / 30)),
    onboardingCompletionRate: 66.1,
    churnRate: 4.2,
    retentionRate: 95.8,
  };

  const usersByTrade: UsersByTrade[] = [
    { trade: "Plumbing", count: 3210, percentage: 22.5, avgRevenue: 4200 },
    { trade: "Electrical", count: 2640, percentage: 18.5, avgRevenue: 4800 },
    { trade: "Painting", count: 2070, percentage: 14.5, avgRevenue: 3100 },
    { trade: "Carpentry", count: 1710, percentage: 12.0, avgRevenue: 3800 },
    { trade: "Tiling", count: 1280, percentage: 9.0, avgRevenue: 3400 },
    { trade: "HVAC", count: 1140, percentage: 8.0, avgRevenue: 5200 },
    { trade: "Roofing", count: 856, percentage: 6.0, avgRevenue: 4600 },
    { trade: "Gas", count: 571, percentage: 4.0, avgRevenue: 4900 },
    { trade: "Masonry", count: 428, percentage: 3.0, avgRevenue: 3600 },
    { trade: "Other", count: 375, percentage: 2.5, avgRevenue: 2800 },
  ];

  const financial: FinancialKPIs = {
    mrr: 38400,
    arr: 460800,
    arpu: 29.50,
    ltv: 708,
    cac: 42,
    ltvCacRatio: 16.9,
    totalInvoicesSent: Math.round(8420 * scaleFactor),
    totalInvoicesPaid: Math.round(6340 * scaleFactor),
    invoicePaymentRate: 75.3,
    totalInvoiceValue: Math.round(2840000 * scaleFactor),
    totalPaidValue: Math.round(2120000 * scaleFactor),
    avgInvoiceSize: 337,
    avgPaymentTime: 18.4,
    subscriptionRevenue: Math.round(38400 * scaleFactor),
    transactionRevenue: Math.round(12600 * scaleFactor),
  };

  const markets: MarketMetrics[] = [
    { market: "Netherlands", flag: "🇳🇱", users: 4840, activeUsers: 3120, jobs: 8420, invoicesSent: 3180, revenue: 14200, mrr: 12800, growthRate: 8.2 },
    { market: "Germany", flag: "🇩🇪", users: 3620, activeUsers: 2180, jobs: 5840, invoicesSent: 2240, revenue: 11400, mrr: 9600, growthRate: 12.4 },
    { market: "France", flag: "🇫🇷", users: 2180, activeUsers: 1340, jobs: 3420, invoicesSent: 1280, revenue: 6800, mrr: 5800, growthRate: 15.1 },
    { market: "United Kingdom", flag: "🇬🇧", users: 1640, activeUsers: 980, jobs: 2680, invoicesSent: 960, revenue: 5200, mrr: 4400, growthRate: 18.6 },
    { market: "Spain", flag: "🇪🇸", users: 1120, activeUsers: 640, jobs: 1840, invoicesSent: 620, revenue: 3400, mrr: 3200, growthRate: 22.3 },
    { market: "Italy", flag: "🇮🇹", users: 880, activeUsers: 500, jobs: 1380, invoicesSent: 480, revenue: 2600, mrr: 2600, growthRate: 25.8 },
  ];

  const jobs: JobMetrics = {
    totalJobs: Math.round(23580 * scaleFactor),
    activeJobs: 4820,
    completedJobs: Math.round(18760 * scaleFactor),
    avgJobValue: 2840,
    totalQuotesSent: Math.round(12400 * scaleFactor),
    quoteConversionRate: 68.4,
    avgQuoteToJobDays: 4.2,
  };

  // ─── Monetization Demo Data ─────────────────────────────────────────────

  const subscriptions: SubscriptionMetrics = {
    gratisUsers: 11200,
    contractorUsers: 3080,
    trialUsers: 420,
    conversionRate: 21.6,
    trialConversionRate: 58.3,
    monthlyChurn: 3.8,
    annualVsMonthly: 64,
    subscriptionMRR: 38400,
    seatRevenue: 4200,
    totalSeatsUsed: 5840,
  };

  const payments: PaymentProcessingMetrics = {
    totalTransactions: Math.round(6340 * scaleFactor),
    totalVolume: Math.round(2120000 * scaleFactor),
    totalMollieFees: Math.round(14840 * scaleFactor),
    totalVascoFees: Math.round(19600 * scaleFactor),
    vascoMargin: Math.round(4760 * scaleFactor),
    avgMarginPerTx: 0.75,
    topMethods: [
      { method: "iDEAL", count: Math.round(2840 * scaleFactor), volume: Math.round(920000 * scaleFactor), margin: Math.round(511 * scaleFactor) },
      { method: "Credit Card", count: Math.round(1680 * scaleFactor), volume: Math.round(680000 * scaleFactor), margin: Math.round(4080 * scaleFactor) },
      { method: "SEPA", count: Math.round(980 * scaleFactor), volume: Math.round(340000 * scaleFactor), margin: Math.round(196 * scaleFactor) },
      { method: "SOFORT", count: Math.round(420 * scaleFactor), volume: Math.round(120000 * scaleFactor), margin: Math.round(84 * scaleFactor) },
      { method: "PayPal", count: Math.round(280 * scaleFactor), volume: Math.round(42000 * scaleFactor), margin: Math.round(210 * scaleFactor) },
      { method: "Klarna", count: Math.round(140 * scaleFactor), volume: Math.round(18000 * scaleFactor), margin: Math.round(92 * scaleFactor) },
    ],
  };

  const backlinks: SupplierBacklinkMetrics = {
    totalClicks: Math.round(8420 * scaleFactor),
    totalConversions: Math.round(640 * scaleFactor),
    conversionRate: 7.6,
    totalOrderValue: Math.round(148000 * scaleFactor),
    totalCommission: Math.round(5180 * scaleFactor),
    topSuppliers: [
      { name: "Technische Unie", clicks: Math.round(1840 * scaleFactor), conversions: Math.round(142 * scaleFactor), commission: Math.round(1394 * scaleFactor) },
      { name: "Wurth", clicks: Math.round(1420 * scaleFactor), conversions: Math.round(118 * scaleFactor), commission: Math.round(850 * scaleFactor) },
      { name: "Toolstation", clicks: Math.round(1280 * scaleFactor), conversions: Math.round(156 * scaleFactor), commission: Math.round(663 * scaleFactor) },
      { name: "Hilti", clicks: Math.round(680 * scaleFactor), conversions: Math.round(38 * scaleFactor), commission: Math.round(319 * scaleFactor) },
      { name: "Engelbert Strauss", clicks: Math.round(920 * scaleFactor), conversions: Math.round(98 * scaleFactor), commission: Math.round(706 * scaleFactor) },
      { name: "Rexel", clicks: Math.round(780 * scaleFactor), conversions: Math.round(48 * scaleFactor), commission: Math.round(461 * scaleFactor) },
    ],
    topCategories: [
      { category: "Materials", clicks: Math.round(4320 * scaleFactor), commission: Math.round(2840 * scaleFactor) },
      { category: "Tools", clicks: Math.round(2180 * scaleFactor), commission: Math.round(1120 * scaleFactor) },
      { category: "Workwear", clicks: Math.round(920 * scaleFactor), commission: Math.round(706 * scaleFactor) },
      { category: "Insurance", clicks: Math.round(480 * scaleFactor), commission: Math.round(384 * scaleFactor) },
      { category: "Rental", clicks: Math.round(320 * scaleFactor), commission: Math.round(86 * scaleFactor) },
      { category: "Certification", clicks: Math.round(200 * scaleFactor), commission: Math.round(44 * scaleFactor) },
    ],
  };

  const compliance: ComplianceRevenueMetrics = {
    usersWithCompliance: 2640,
    complianceUpsellRate: 18.4,
    revenueByCountry: [
      { country: "Netherlands", flag: "🇳🇱", users: 840, revenue: 12600 },
      { country: "Germany", flag: "🇩🇪", users: 680, revenue: 12240 },
      { country: "France", flag: "🇫🇷", users: 420, revenue: 6720 },
      { country: "Italy", flag: "🇮🇹", users: 310, revenue: 5270 },
      { country: "Spain", flag: "🇪🇸", users: 240, revenue: 3360 },
      { country: "United Kingdom", flag: "🇬🇧", users: 150, revenue: 2250 },
    ],
    eInvoiceUsage: [
      { format: "FatturaPA", count: 4200 },
      { format: "XRechnung", count: 3180 },
      { format: "ZUGFeRD", count: 2840 },
      { format: "Factur-X", count: 1960 },
      { format: "UBL/Peppol", count: 1420 },
      { format: "Facturae", count: 980 },
      { format: "MTD", count: 640 },
    ],
    totalComplianceRevenue: 42440,
  };

  const subscriptionMRR = subscriptions.subscriptionMRR + subscriptions.seatRevenue;
  const paymentMRR = Math.round(payments.vascoMargin / (scaleFactor || 1));
  const backlinkMRR = Math.round(backlinks.totalCommission / (scaleFactor || 1));
  const complianceMRR = Math.round(compliance.totalComplianceRevenue / 12);
  const totalMRR = subscriptionMRR + paymentMRR + backlinkMRR + complianceMRR;

  const monetization: MonetizationData = {
    subscriptions,
    payments,
    backlinks,
    compliance,
    totalMRR,
    mrrBreakdown: [
      { source: "Subscriptions", amount: subscriptionMRR, percentage: Math.round((subscriptionMRR / totalMRR) * 100) },
      { source: "Payment Processing", amount: paymentMRR, percentage: Math.round((paymentMRR / totalMRR) * 100) },
      { source: "Supplier Backlinks", amount: backlinkMRR, percentage: Math.round((backlinkMRR / totalMRR) * 100) },
      { source: "Compliance Packs", amount: complianceMRR, percentage: Math.round((complianceMRR / totalMRR) * 100) },
    ],
  };

  return {
    funnel,
    users,
    usersByTrade,
    financial,
    markets,
    revenueTimeline: generateDemoRevenueTimeline(days),
    jobs,
    monetization,
    period: { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10), days },
  };
}

function getDemoDeveloperHubData(): DeveloperHubData {
  const now = new Date();

  const bugs: BugReport[] = [
    { id: "BUG-001", title: "Invoice PDF export fails for German locale", severity: "critical", status: "in_progress", reportedBy: "aannemer@vasco.dev", reportedAt: "2026-03-27", assignee: "Backend Team", platform: "api", description: "PDF generation throws when Umlaut characters are in company name" },
    { id: "BUG-002", title: "Push notifications not received on iOS 18.4", severity: "high", status: "open", reportedBy: "contractor@vasco.dev", reportedAt: "2026-03-27", assignee: "Mobile Team", platform: "ios", description: "Silent push works but user-visible notifications don't appear" },
    { id: "BUG-003", title: "Calendar sync duplicates events after timezone change", severity: "high", status: "open", reportedBy: "site@vasco.dev", reportedAt: "2026-03-26", assignee: "Mobile Team", platform: "ios", description: "Travelling between NL and DE causes calendar events to duplicate" },
    { id: "BUG-004", title: "Slow query on contractor dashboard (>3s)", severity: "medium", status: "in_progress", reportedBy: "Internal", reportedAt: "2026-03-25", assignee: "Backend Team", platform: "api", description: "Dashboard query joins too many tables, needs optimization" },
    { id: "BUG-005", title: "Quote template preview blank on Android 14", severity: "medium", status: "open", reportedBy: "contractor@vasco.dev", reportedAt: "2026-03-26", assignee: "Mobile Team", platform: "android", description: "WebView rendering issue on certain Samsung devices" },
    { id: "BUG-006", title: "Offline mode loses unsaved job notes", severity: "high", status: "resolved", reportedBy: "contractor@vasco.dev", reportedAt: "2026-03-22", assignee: "Mobile Team", platform: "ios", description: "When going offline mid-edit, notes are not queued for sync" },
    { id: "BUG-007", title: "Mollie webhook timeout on peak hours", severity: "medium", status: "resolved", reportedBy: "Internal", reportedAt: "2026-03-20", assignee: "Backend Team", platform: "api", description: "Webhook processing exceeds 10s timeout during lunch peak" },
    { id: "BUG-008", title: "Dark mode: orange text unreadable on cards", severity: "low", status: "open", reportedBy: "contractor@vasco.dev", reportedAt: "2026-03-24", assignee: "Design Team", platform: "ios", description: "hermesOrange on dark cards has insufficient contrast ratio" },
    { id: "BUG-009", title: "E-invoice validation rejects valid FatturaPA XML", severity: "critical", status: "resolved", reportedBy: "IT contractor", reportedAt: "2026-03-18", assignee: "Backend Team", platform: "api", description: "Schema validation too strict on optional fields" },
    { id: "BUG-010", title: "Memory leak in photo gallery after 50+ images", severity: "medium", status: "open", reportedBy: "Internal", reportedAt: "2026-03-25", assignee: "Mobile Team", platform: "android", description: "Image cache not freed when navigating away from gallery" },
  ];

  const latency: LatencyMetric[] = [
    { endpoint: "GET /api/dashboard", p50: 142, p95: 380, p99: 820, errorRate: 0.2, requestsPerMin: 245 },
    { endpoint: "GET /api/jobs", p50: 88, p95: 210, p99: 450, errorRate: 0.1, requestsPerMin: 480 },
    { endpoint: "POST /api/invoices", p50: 234, p95: 560, p99: 1200, errorRate: 0.8, requestsPerMin: 120 },
    { endpoint: "GET /api/quotes", p50: 96, p95: 240, p99: 520, errorRate: 0.1, requestsPerMin: 310 },
    { endpoint: "POST /api/ai/analyze", p50: 1840, p95: 3200, p99: 5400, errorRate: 1.2, requestsPerMin: 85 },
    { endpoint: "GET /api/customers", p50: 72, p95: 180, p99: 340, errorRate: 0.1, requestsPerMin: 390 },
    { endpoint: "POST /api/payments/webhook", p50: 56, p95: 120, p99: 280, errorRate: 0.3, requestsPerMin: 95 },
    { endpoint: "GET /api/compliance", p50: 168, p95: 420, p99: 890, errorRate: 0.4, requestsPerMin: 62 },
    { endpoint: "POST /api/photos/upload", p50: 890, p95: 2100, p99: 4200, errorRate: 1.5, requestsPerMin: 45 },
    { endpoint: "GET /api/intelligence", p50: 320, p95: 780, p99: 1600, errorRate: 0.6, requestsPerMin: 180 },
  ];

  const suggestions: UserSuggestion[] = [
    { id: "SUG-001", title: "Recurring invoice automation", description: "Auto-generate and send recurring invoices for maintenance contracts", votes: 284, status: "planned", submittedBy: "NL Contractor", submittedAt: "2026-02-15", category: "feature" },
    { id: "SUG-002", title: "Multi-language quote templates", description: "Allow sending quotes in client's preferred language", votes: 217, status: "in_progress", submittedBy: "DE Aannemer", submittedAt: "2026-02-20", category: "feature" },
    { id: "SUG-003", title: "WhatsApp integration for client comms", description: "Send job updates and invoices via WhatsApp Business API", votes: 196, status: "under_review", submittedBy: "ES Contractor", submittedAt: "2026-03-01", category: "integration" },
    { id: "SUG-004", title: "Better photo before/after comparison", description: "Side-by-side slider for project before/after photos", votes: 168, status: "shipped", submittedBy: "FR Contractor", submittedAt: "2026-01-10", category: "ux" },
    { id: "SUG-005", title: "Bulk invoice export for accountant", description: "Export all monthly invoices as a ZIP with summary CSV", votes: 152, status: "planned", submittedBy: "NL Aannemer", submittedAt: "2026-02-28", category: "feature" },
    { id: "SUG-006", title: "GPS time tracking on job sites", description: "Auto clock-in/out based on geofence around job address", votes: 143, status: "under_review", submittedBy: "UK Site Lead", submittedAt: "2026-03-05", category: "feature" },
    { id: "SUG-007", title: "Material cost calculator", description: "Built-in calculator that estimates material costs by trade and region", votes: 128, status: "new", submittedBy: "IT Contractor", submittedAt: "2026-03-12", category: "feature" },
    { id: "SUG-008", title: "Faster app startup time", description: "App takes 4-5 seconds to load on older Android devices", votes: 112, status: "in_progress", submittedBy: "DE Contractor", submittedAt: "2026-03-08", category: "performance" },
    { id: "SUG-009", title: "DATEV integration improvements", description: "Auto-export bookings to DATEV format for German tax advisors", votes: 98, status: "planned", submittedBy: "DE Aannemer", submittedAt: "2026-02-25", category: "integration" },
    { id: "SUG-010", title: "Dark mode support", description: "Full dark mode for outdoor use in bright conditions", votes: 94, status: "new", submittedBy: "ES Contractor", submittedAt: "2026-03-15", category: "ux" },
    { id: "SUG-011", title: "Subcontractor management", description: "Assign and track subcontractors per job with their own portal", votes: 87, status: "under_review", submittedBy: "FR Aannemer", submittedAt: "2026-03-10", category: "feature" },
    { id: "SUG-012", title: "Offline invoice creation", description: "Create invoices without internet and sync later", votes: 76, status: "shipped", submittedBy: "UK Contractor", submittedAt: "2026-01-20", category: "improvement" },
  ];

  const deploys: DeployStatus[] = [
    { version: "2.4.1", environment: "production", deployedAt: "2026-03-28T08:30:00Z", status: "healthy", uptime: 99.94, lastIncident: "2026-03-20T14:22:00Z" },
    { version: "2.5.0-rc.3", environment: "staging", deployedAt: "2026-03-28T10:15:00Z", status: "healthy", uptime: 99.8, lastIncident: "2026-03-27T09:45:00Z" },
    { version: "2.5.0-dev.47", environment: "development", deployedAt: "2026-03-28T11:02:00Z", status: "healthy", uptime: 98.2, lastIncident: "2026-03-28T06:30:00Z" },
  ];

  // Demo cron data — production fills via get_cron_health() RPC.
  // Names + schedules mirror supabase/cron.sql exactly (10 vasco-* jobs).
  const cron: CronJobHealth[] = [
    { jobName: "vasco-weekly-digest", schedule: "0 8 * * 1", active: true, lastStatus: "succeeded", lastStart: "2026-03-24T08:00:01Z", lastEnd: "2026-03-24T08:00:09Z", totalRuns: 12 },
    { jobName: "vasco-stale-draft-cleanup", schedule: "0 3 * * *", active: true, lastStatus: "succeeded", lastStart: "2026-03-28T03:00:00Z", lastEnd: "2026-03-28T03:00:03Z", totalRuns: 87 },
    { jobName: "vasco-drain-account-deletions", schedule: "0 1 * * *", active: true, lastStatus: "succeeded", lastStart: "2026-03-28T01:00:00Z", lastEnd: "2026-03-28T01:00:02Z", totalRuns: 87 },
    { jobName: "vasco-daily-push-digest", schedule: "0 17 * * *", active: true, lastStatus: "succeeded", lastStart: "2026-03-27T17:00:01Z", lastEnd: "2026-03-27T17:00:05Z", totalRuns: 87 },
    { jobName: "vasco-churn-winback", schedule: "0 9 * * 1", active: true, lastStatus: "succeeded", lastStart: "2026-03-24T09:00:01Z", lastEnd: "2026-03-24T09:00:11Z", totalRuns: 12 },
    { jobName: "vasco-grant-referral-credits", schedule: "0 2 * * *", active: true, lastStatus: "succeeded", lastStart: "2026-03-28T02:00:00Z", lastEnd: "2026-03-28T02:00:04Z", totalRuns: 87 },
    { jobName: "vasco-weekly-retrain-models", schedule: "0 5 * * 0", active: true, lastStatus: "succeeded", lastStart: "2026-03-23T05:00:01Z", lastEnd: "2026-03-23T05:12:14Z", totalRuns: 12 },
    { jobName: "vasco-train-extra-models", schedule: "0 4 * * 0", active: true, lastStatus: "succeeded", lastStart: "2026-03-23T04:00:01Z", lastEnd: "2026-03-23T04:08:22Z", totalRuns: 12 },
    { jobName: "vasco-refresh-generator-approval-rates", schedule: "30 3 * * *", active: true, lastStatus: "succeeded", lastStart: "2026-03-28T03:30:00Z", lastEnd: "2026-03-28T03:30:02Z", totalRuns: 87 },
    { jobName: "vasco-pack-trigger-tick", schedule: "0 9 * * *", active: true, lastStatus: "succeeded", lastStart: "2026-03-28T09:00:00Z", lastEnd: "2026-03-28T09:00:14Z", totalRuns: 87 },
  ];

  return {
    bugs,
    latency,
    suggestions,
    deploys,
    errorRate24h: 0.42,
    avgResponseTime: 186,
    totalApiCalls24h: 847200,
    uptimePercent: 99.94,
    cron,
    cronExpected: 10,
  };
}

function getDemoUGCData(days: number): UGCDashboardData {
  const now = new Date();
  const from = new Date(now.getTime() - days * 86400000);

  const formats = ["before-after", "tool-review", "day-in-life", "project-showcase", "tutorial", "testimonial"];
  const hooks = [
    "This plumber made €12K in one week", "POV: your first solo renovation",
    "3 tools every electrician needs", "Before and after this kitchen remodel",
    "Why Dutch contractors use Vasco", "The invoice hack that saved my business",
    "Site lead morning routine", "How I grew my painting business 3x",
  ];
  const hookTypes = ["transformation", "problem-solution", "challenge", "behind-scenes", "tip", "myth-busting"];
  const clusters = ["contractor-life", "project-showcase", "before-after", "tool-tips", "business-growth", "compliance-tips"];
  const creators = [
    { name: "Bouwer Jan", handle: "@bouwer.jan", lang: "NL" },
    { name: "Elektro Max", handle: "@elektro.max", lang: "DE" },
    { name: "Peintre Pierre", handle: "@peintre.pierre", lang: "FR" },
    { name: "Plumber Pete", handle: "@plumber.pete", lang: "EN" },
    { name: "Fontanero Carlos", handle: "@fontanero.carlos", lang: "ES" },
    { name: "Idraulico Marco", handle: "@idraulico.marco", lang: "IT" },
  ];

  const videos: UGCVideo[] = Array.from({ length: 24 }, (_, i) => {
    const creator = creators[i % creators.length];
    const viewsTotal = Math.round(2000 + Math.random() * 80000);
    const retention = 0.15 + Math.random() * 0.45;
    const classification: VideoClassification =
      viewsTotal > 20000 && retention > 0.4 ? "hit" :
      viewsTotal > 5000 ? "average" : "fail";

    return {
      id: `v-${i}`,
      videoId: `tiktok-${3000 + i}`,
      accountId: `@vasco.${creator.lang.toLowerCase()}`,
      creatorName: creator.name,
      creatorHandle: creator.handle,
      datePosted: new Date(from.getTime() + Math.random() * days * 86400000).toISOString().slice(0, 10),
      niche: "construction",
      format: formats[i % formats.length],
      hookText: hooks[i % hooks.length],
      hookType: hookTypes[i % hookTypes.length],
      conceptCluster: clusters[i % clusters.length],
      country: creator.lang,
      views2h: Math.round(viewsTotal * 0.15),
      views12h: Math.round(viewsTotal * 0.45),
      views24h: Math.round(viewsTotal * 0.65),
      viewsTotal,
      hookRetentionRate: retention,
      avgWatchTime: Math.round(8 + Math.random() * 25),
      completionRate: 0.1 + Math.random() * 0.5,
      likes: Math.round(viewsTotal * (0.03 + Math.random() * 0.05)),
      comments: Math.round(viewsTotal * (0.005 + Math.random() * 0.01)),
      shares: Math.round(viewsTotal * (0.01 + Math.random() * 0.03)),
      saves: Math.round(viewsTotal * (0.008 + Math.random() * 0.02)),
      clicks: Math.round(viewsTotal * (0.02 + Math.random() * 0.04)),
      installs: Math.round(viewsTotal * 0.005),
      revenueCents: Math.round(viewsTotal * 0.02),
      classification,
      costCents: 0,
      videoUrl: "",
      thumbnailUrl: "",
      notes: "",
    };
  });

  const totalViews = videos.reduce((s, v) => s + v.viewsTotal, 0);
  const classificationBreakdown: Record<VideoClassification, number> = { hit: 0, average: 0, fail: 0, pending: 0 };
  for (const v of videos) classificationBreakdown[v.classification]++;

  return {
    videos,
    production: {
      totalVideos: videos.length,
      videosThisPeriod: videos.length,
      costPerVideo: 0,
      avgTimeToPublish: 3.2,
      videosPerAccount: {},
      videosPerCreator: {},
    },
    creative: {
      avgHookRetention: videos.reduce((s, v) => s + v.hookRetentionRate, 0) / videos.length,
      avgWatchTime: videos.reduce((s, v) => s + v.avgWatchTime, 0) / videos.length,
      avgCompletionRate: videos.reduce((s, v) => s + v.completionRate, 0) / videos.length,
      avgEngagementRate: totalViews > 0 ? videos.reduce((s, v) => s + v.likes + v.comments + v.shares, 0) / totalViews : 0,
      avgAmplificationRate: totalViews > 0 ? videos.reduce((s, v) => s + v.shares, 0) / totalViews : 0,
      totalShares: videos.reduce((s, v) => s + v.shares, 0),
      totalSaves: videos.reduce((s, v) => s + v.saves, 0),
    },
    business: {
      avgCTR: totalViews > 0 ? videos.reduce((s, v) => s + v.clicks, 0) / totalViews : 0,
      totalInstalls: videos.reduce((s, v) => s + v.installs, 0),
      avgConversionRate: 0.034,
      revenuePerVideo: videos.reduce((s, v) => s + v.revenueCents, 0) / videos.length / 100,
      avgCPA: 2.80,
      avgROAS: 4.2,
    },
    hookAnalysis: hookTypes.map((ht) => {
      const hvids = videos.filter((v) => v.hookType === ht);
      return {
        hookText: hooks[hookTypes.indexOf(ht)] ?? ht,
        hookType: ht,
        videoCount: hvids.length,
        avgRetention: hvids.length > 0 ? hvids.reduce((s, v) => s + v.hookRetentionRate, 0) / hvids.length : 0,
        avgViews: hvids.length > 0 ? hvids.reduce((s, v) => s + v.viewsTotal, 0) / hvids.length : 0,
        avgShares: hvids.length > 0 ? hvids.reduce((s, v) => s + v.shares, 0) / hvids.length : 0,
      };
    }),
    formatAnalysis: formats.map((f) => {
      const fvids = videos.filter((v) => v.format === f);
      return {
        format: f,
        videoCount: fvids.length,
        avgWatchTime: fvids.length > 0 ? fvids.reduce((s, v) => s + v.avgWatchTime, 0) / fvids.length : 0,
        avgCompletionRate: fvids.length > 0 ? fvids.reduce((s, v) => s + v.completionRate, 0) / fvids.length : 0,
        avgViews: fvids.length > 0 ? fvids.reduce((s, v) => s + v.viewsTotal, 0) / fvids.length : 0,
      };
    }),
    conceptClusters: clusters.map((c) => {
      const cvids = videos.filter((v) => v.conceptCluster === c);
      return {
        cluster: c,
        videoCount: cvids.length,
        avgViews: cvids.length > 0 ? cvids.reduce((s, v) => s + v.viewsTotal, 0) / cvids.length : 0,
        bestVideoViews: cvids.length > 0 ? Math.max(...cvids.map((v) => v.viewsTotal)) : 0,
        hitRate: cvids.length > 0 ? cvids.filter((v) => v.classification === "hit").length / cvids.length : 0,
      };
    }),
    topPerformers: [...videos].sort((a, b) => b.viewsTotal - a.viewsTotal).slice(0, 5),
    classificationBreakdown,
    period: { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10), days },
  };
}

// ─── Fetch Functions ───────────────────────────────────────────────────────

export function isUsingDemoData(): boolean {
  return !isSupabaseConfigured();
}

export async function fetchKPIDashboardData(days: number = 30): Promise<KPIDashboardData> {
  if (!isSupabaseConfigured()) return getDemoData(days);
  try {
    const { fetchRevenueSnapshot } = await import('./revenue');
    const snap = await fetchRevenueSnapshot();
    const demo = getDemoData(days);
    // Overlay real numbers onto the demo scaffold so the UI stays complete
    // while the long-tail KPIs (funnel, retention) are still being built out.
    return {
      ...demo,
      financial: {
        ...demo.financial,
        mrr: snap.mrr,
      },
      users: {
        ...demo.users,
        totalUsers: snap.totalUsers,
      },
      markets: demo.markets.map((row) => ({
        ...row,
        users: snap.countryBreakdown[row.market] ?? row.users,
      })),
    };
  } catch {
    return getDemoData(days);
  }
}

export async function fetchDeveloperHubData(): Promise<DeveloperHubData> {
  const demo = getDemoDeveloperHubData();
  if (!isSupabaseConfigured()) return demo;

  // Overlay real cron health onto the demo scaffold. Bugs/latency/
  // suggestions/deploys are still demo-fed until those backing tables ship.
  try {
    const supabase = getSupabase();
    if (!supabase) return { ...demo, cron: [], cronExpected: 10 };
    const { data, error } = await supabase.rpc('get_cron_health' as never);
    if (error || !Array.isArray(data)) {
      return { ...demo, cron: [], cronExpected: 10 };
    }
    type RpcRow = {
      jobname: string;
      schedule: string;
      active: boolean;
      last_status: string | null;
      last_start: string | null;
      last_end: string | null;
      last_runs: number | string;
    };
    const cron: CronJobHealth[] = (data as RpcRow[]).map((row) => ({
      jobName: row.jobname,
      schedule: row.schedule,
      active: row.active,
      lastStatus: (row.last_status as CronJobHealth['lastStatus']) ?? null,
      lastStart: row.last_start,
      lastEnd: row.last_end,
      totalRuns: typeof row.last_runs === 'string' ? parseInt(row.last_runs, 10) : row.last_runs,
    }));
    return { ...demo, cron, cronExpected: 10 };
  } catch {
    return { ...demo, cron: [], cronExpected: 10 };
  }
}

export async function fetchUGCDashboardData(days: number = 30): Promise<UGCDashboardData> {
  if (!isSupabaseConfigured()) return getDemoUGCData(days);
  return getDemoUGCData(days);
}

export function exportCreatorsCSV(creators: CreatorRow[]): string {
  const headers = ["Name", "Handle", "Language", "Code", "Scans", "Activations", "Completions", "Purchases", "Revenue", "Conv%", "NetROI"];
  const rows = creators.map((c) => [c.name, c.handle, c.language, c.affiliateCode, c.scans, c.activations, c.completions, c.purchases, c.revenue, c.conversionRate, c.netROI]);
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export function exportUGCVideosCSV(videos: UGCVideo[]): string {
  const headers = ["Creator", "Hook", "Format", "Views", "Retention", "Shares", "Classification", "Date"];
  const rows = videos.map((v) => [v.creatorName, v.hookText, v.format, v.viewsTotal, (v.hookRetentionRate * 100).toFixed(1) + "%", v.shares, v.classification, v.datePosted]);
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
