export type BuildOSRole = 'cfo' | 'coo' | 'site';

export const buildOSOverview = {
  title: 'BuildOS Europe',
  subtitle: 'AI operating system for CRE development in UK, NL, DE.',
  highlights: [
    'System of action, not a dashboard.',
    'Documents to structured truth with audit trails.',
    'Country modules encode permits, tax, and compliance.',
  ],
};

export const buildOSPillars = [
  {
    title: 'Document intelligence',
    detail: 'Contracts, permits, invoices, RFIs → structured records.',
    metric: '98% extraction confidence',
  },
  {
    title: 'Compliance execution',
    detail: 'Permit clocks, tax rules, ESG gates by country.',
    metric: '4 gating risks tracked',
  },
  {
    title: 'ROI control plane',
    detail: 'Live IRR/NPV, cost-to-complete, variance alerts.',
    metric: '2.4% margin protected',
  },
];

export const buildOSProjects = [
  { id: 'proj-uk-001', name: 'London Mixed-Use', country: 'UK' },
  { id: 'proj-nl-002', name: 'Amsterdam Zuidas', country: 'NL' },
  { id: 'proj-de-003', name: 'Frankfurt FOUR', country: 'DE' },
];

export const roleDashboards: Record<
  BuildOSRole,
  {
    label: string;
    kpis: { label: string; value: string }[];
    actions: { title: string; subtitle: string; why: string; impact: string; tag: string }[];
    insights: { title: string; detail: string }[];
    performance: { label: string; value: number; max: number; note: string }[];
    agent: { status: string; lastTrained: string; readiness: string };
    charts: {
      actionMix: { label: string; value: number; color: string }[];
      eventMix: { label: string; value: number; color: string }[];
    };
  }
> = {
  cfo: {
    label: 'CFO Control Plane',
    kpis: [
      { label: 'IRR delta', value: '+45 bps' },
      { label: 'Cost to complete', value: 'EUR 24.8M' },
      { label: 'Forecast accuracy', value: '92%' },
      { label: 'S106/CIL risk', value: 'EUR 1.2M' },
    ],
    actions: [
      {
        title: 'Approve change order with guardrails',
        subtitle: 'Contract CO-1289',
        why: 'Similar orders averaged 3.4% cost delta',
        impact: 'Protects margin +0.6%',
        tag: 'CFO',
      },
      {
        title: 'Generate lender draw pack',
        subtitle: 'Week 31 reporting',
        why: 'New invoices and schedule updates ready',
        impact: 'Cuts close time 2 days',
        tag: 'FIN',
      },
      {
        title: 'Update UK tax exposure',
        subtitle: 'Business rates revaluation 2026',
        why: 'Rateable value uplift flagged',
        impact: 'Avoids budget drift',
        tag: 'TAX',
      },
    ],
    insights: [
      { title: 'Variance watchlist', detail: '3 packages trending above plan.' },
      { title: 'Cash runway', detail: '24 weeks at current burn.' },
    ],
    performance: [
      { label: 'Approved', value: 24, max: 30, note: 'Change orders' },
      { label: 'Pending', value: 6, max: 30, note: 'Needs review' },
      { label: 'Rejected', value: 3, max: 30, note: 'Risk avoided' },
    ],
    agent: {
      status: 'CFO agent active',
      lastTrained: '2 days ago',
      readiness: 'High confidence',
    },
    charts: {
      actionMix: [
        { label: 'Approve', value: 62, color: '#E66A00' },
        { label: 'Review', value: 24, color: '#FF9433' },
        { label: 'Reject', value: 14, color: '#FF3B30' },
      ],
      eventMix: [
        { label: 'Contracts', value: 40, color: '#2ECC71' },
        { label: 'Invoices', value: 35, color: '#FFB266' },
        { label: 'Permits', value: 25, color: '#FF3B30' },
      ],
    },
  },
  coo: {
    label: 'COO Delivery Control',
    kpis: [
      { label: 'Schedule variance', value: '-2.1 wks' },
      { label: 'Permit clock', value: '6/8 weeks' },
      { label: 'Procurement risk', value: 'Low' },
      { label: 'Change order cycle', value: '8 days' },
    ],
    actions: [
      {
        title: 'Escalate facade package',
        subtitle: 'Lead time risk',
        why: 'Supplier slot slipping by 10 days',
        impact: 'Recovers 1.2 weeks',
        tag: 'COO',
      },
      {
        title: 'Resequence fit-out phases',
        subtitle: 'Level 04 to 06',
        why: 'RFI backlog concentrated in MEP',
        impact: 'Protects handover date',
        tag: 'OPS',
      },
    ],
    insights: [
      { title: 'Permit gating', detail: 'NL extended procedure risk flagged.' },
      { title: 'Quality risk', detail: 'Defect rate up 0.8% in core works.' },
    ],
    performance: [
      { label: 'On track', value: 12, max: 16, note: 'Schedule phases' },
      { label: 'At risk', value: 3, max: 16, note: 'Needs resequence' },
      { label: 'Delayed', value: 1, max: 16, note: 'Escalated' },
    ],
    agent: {
      status: 'COO agent active',
      lastTrained: '5 days ago',
      readiness: 'Moderate confidence',
    },
    charts: {
      actionMix: [
        { label: 'On track', value: 70, color: '#2ECC71' },
        { label: 'Buffer', value: 18, color: '#FF9433' },
        { label: 'Replan', value: 12, color: '#FF3B30' },
      ],
      eventMix: [
        { label: 'Procurement', value: 38, color: '#E66A00' },
        { label: 'Schedule', value: 34, color: '#2ECC71' },
        { label: 'Quality', value: 28, color: '#FFB266' },
      ],
    },
  },
  site: {
    label: 'Site Lead Copilot',
    kpis: [
      { label: 'Safety ratio', value: '3%' },
      { label: 'RFI aging', value: '6 days' },
      { label: 'Defect closure', value: '5 days' },
      { label: 'Constraints cleared', value: '18' },
    ],
    actions: [
      {
        title: 'Resolve safety near-miss',
        subtitle: 'Access walkway',
        why: 'Repeated incidents in last 7 days',
        impact: 'Reduces stop risk',
        tag: 'SAFE',
      },
      {
        title: 'Summarize daily log',
        subtitle: 'Photos + blockers',
        why: 'Auto-ready for COO review',
        impact: 'Saves 45 min',
        tag: 'SITE',
      },
    ],
    insights: [
      { title: 'Progress confidence', detail: '92% plan adherence this week.' },
      { title: 'RFI hotspot', detail: 'Core MEP coordination cluster.' },
    ],
    performance: [
      { label: 'Safety', value: 2, max: 10, note: 'Events this week' },
      { label: 'Delays', value: 3, max: 10, note: 'Logged' },
      { label: 'Progress', value: 8, max: 10, note: 'Reports filed' },
    ],
    agent: {
      status: 'Site agent active',
      lastTrained: '1 day ago',
      readiness: 'High confidence',
    },
    charts: {
      actionMix: [
        { label: 'Acknowledge', value: 46, color: '#2ECC71' },
        { label: 'Review', value: 32, color: '#FF9433' },
        { label: 'Escalate', value: 22, color: '#FF3B30' },
      ],
      eventMix: [
        { label: 'Safety', value: 30, color: '#FF3B30' },
        { label: 'Delay', value: 35, color: '#E66A00' },
        { label: 'Progress', value: 35, color: '#2ECC71' },
      ],
    },
  },
};

export const documentIntelligence = [
  {
    title: 'Permit decision pack',
    detail: 'Planning authority response received',
    confidence: '96%',
    updated: '2h ago',
  },
  {
    title: 'Change order CO-1289',
    detail: 'Scope variation parsed',
    confidence: '93%',
    updated: '1d ago',
  },
  {
    title: 'Monthly draw summary',
    detail: 'Invoices + schedule deltas linked',
    confidence: '98%',
    updated: '3d ago',
  },
];

export const countryModules = [
  {
    title: 'United Kingdom',
    detail: 'Planning clocks (8/13 weeks), S106/CIL tracker, business rates model.',
    signal: '2 major apps approaching 13-week target',
  },
  {
    title: 'Netherlands',
    detail: 'Omgevingswet workflows, 8-week vs 6-month procedures, label C gating.',
    signal: 'Extended procedure risk flagged',
  },
  {
    title: 'Germany',
    detail: 'State variance, permit completeness checks, GEG compliance artifacts.',
    signal: 'GEG evidence pack missing 1 item',
  },
];

export const systemOfAction = [
  'Ingest contracts, permits, invoices, schedules.',
  'Normalize into project genome objects.',
  'Compute KPIs and deltas continuously.',
  'Generate actions with citations and approvals.',
];

export const auditTrail = [
  { title: 'CFO approval', detail: 'Change order CO-1289 approved', time: 'Today' },
  { title: 'COO escalation', detail: 'Facade package risk flagged', time: 'Yesterday' },
  { title: 'Site lead log', detail: 'Safety near-miss recorded', time: '2d ago' },
];
