// =============================================================================
// BACKGROUND JOB SCHEDULER — EVE-style continuous AI monitoring
// =============================================================================
// Central orchestrator that runs audits on schedule:
// - Hourly: invoice audit, schedule conflicts, cert expiry
// - 6-hourly: quote pricing audit, supplier anomalies, action queue
// - Daily: cohort benchmarks, template suggestions, morning briefing
// =============================================================================

import { formatMoney, formatMoney2 } from '../i18n/formatting';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { populateQueue, addToQueue, queueEntityLabel } from '../services/aiActionQueueService';
import { evaluateTriggers } from '../services/workflowPackService';
import { calibrateModels } from './mlModels';
import { validateWorkflowState } from '../services/workflowValidatorService';
import { getSeasonalContext } from './tradeContext';
import { MS_PER_DAY } from '../utils/timeConstants';
import {
  daysOverdue as invoiceDaysOverdue,
  daysUntilDue as invoiceDaysUntilDue,
} from '../utils/invoiceDue';
import { loadOnboardingPreferences } from '../services/onboardingPreferencesService';
import { loadSubscription, getTierLimits } from '../services/subscriptionService';
import i18n from '../i18n/i18n';
import { todayKey } from '../utils/dateKey';

const SCHEDULER_KEY = '@vasco_scheduler_state';
const BRIEFING_KEY = '@vasco_morning_briefing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditFinding {
  id: string;
  type: 'invoice_error' | 'schedule_conflict' | 'cert_expiring' | 'quote_anomaly' | 'margin_issue' | 'payment_overdue' | 'compliance_gap';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  entityId?: string;        // ID of the job/invoice/quote
  entityType?: string;      // 'job' | 'invoice' | 'quote'
  suggestedAction?: string; // What the contractor should do
  detectedAt: string;
}

export interface MorningBriefing {
  date: string;
  auditsRun: number;
  itemsChecked: { invoices: number; quotes: number; jobs: number; certs: number };
  findings: AuditFinding[];
  actionsQueued: number;
  generatedAt: string;
  personalSummary: string;        // Personalized 1-liner
  tradeContext?: string;           // Trade-specific note
  proactiveAlerts: string[];       // Forward-looking warnings
}

interface SchedulerState {
  lastHourlyRun: string;
  lastSixHourlyRun: string;
  lastDailyRun: string;
  totalAuditsRun: number;
}

// ---------------------------------------------------------------------------
// Audit functions
// ---------------------------------------------------------------------------

function auditInvoices(invoices: any[]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const now = new Date();

  // Check for overdue invoices
  for (const inv of invoices) {
    if (inv.status === 'sent' || inv.status === 'overdue') {
      const dueDate = inv.dueDate ? new Date(inv.dueDate) : null;
      if (dueDate && dueDate < now) {
        // Calendar days via the shared helper — Math.ceil over the raw gap
        // reported 15 for a 14-day-old invoice for most of the day, and this
        // number drives the severity thresholds below.
        const daysOverdue = invoiceDaysOverdue(inv as any, now) ?? 0;
        findings.push({
          id: `audit-inv-${inv.id}`,
          type: 'payment_overdue',
          severity: daysOverdue > 30 ? 'critical' : daysOverdue > 14 ? 'warning' : 'info',
          // Human label, never the row id — this title surfaces in the audit
          // findings list the contractor reads ("Factuur inv-seed-1 …").
          title: `Factuur ${queueEntityLabel(inv) || 'zonder referentie'} is ${daysOverdue} dagen achterstallig`,
          description: `${formatMoney((inv.amount ?? 0))} uitstaand`,
          entityId: inv.id,
          entityType: 'invoice',
          suggestedAction: daysOverdue > 14 ? 'Telefonisch opvolgen' : 'Herinnering sturen',
          detectedAt: now.toISOString(),
        });
      }
    }
  }

  // Check for duplicate amounts (same amount within 7 days)
  const recentInvoices = invoices.filter((i: any) => {
    const created = new Date(i.createdAt || i.lastUpdated || '');
    return now.getTime() - created.getTime() < 7 * MS_PER_DAY;
  });
  const amountMap = new Map<number, any[]>();
  for (const inv of recentInvoices) {
    const amount = inv.amount ?? inv.total ?? 0;
    const group = amountMap.get(amount) ?? [];
    group.push(inv);
    amountMap.set(amount, group);
  }
  for (const [amount, group] of amountMap) {
    if (group.length > 1 && amount > 0) {
      findings.push({
        id: `audit-dup-${group[0].id}`,
        type: 'invoice_error',
        severity: 'warning',
        title: `Mogelijke dubbele factuur: ${formatMoney(amount)}`,
        description: `${group.length} facturen met hetzelfde bedrag binnen 7 dagen`,
        entityId: group[0].id,
        entityType: 'invoice',
        suggestedAction: 'Controleer of dit een dubbele factuur is',
        detectedAt: now.toISOString(),
      });
    }
  }

  return findings;
}

function auditQuotes(quotes: any[]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const now = new Date();

  // Stale quotes (sent > 14 days, no response)
  for (const q of quotes) {
    if (q.status === 'sent') {
      const sentDate = new Date(q.lastUpdated || q.createdAt || '');
      const daysSinceSent = Math.ceil((now.getTime() - sentDate.getTime()) / MS_PER_DAY);
      if (daysSinceSent > 14) {
        findings.push({
          id: `audit-quote-${q.id}`,
          type: 'quote_anomaly',
          severity: 'warning',
          title: `Offerte ${queueEntityLabel(q) || 'zonder referentie'} al ${daysSinceSent} dagen zonder reactie`,
          description: `${formatMoney((q.amount ?? 0))} · ${q.customer || 'Onbekende klant'}`,
          entityId: q.id,
          entityType: 'quote',
          suggestedAction: 'Opvolging sturen of archiveren',
          detectedAt: now.toISOString(),
        });
      }
    }
  }

  return findings;
}

function auditJobs(jobs: any[]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const now = new Date();

  // Completed jobs without invoices
  for (const job of jobs) {
    if ((job.status === 'completed' || job.status === 'gereed') && !job.invoiceId) {
      findings.push({
        id: `audit-job-${job.id}`,
        type: 'margin_issue',
        severity: 'info',
        title: `Klus "${job.title}" afgerond maar niet gefactureerd`,
        description: `${formatMoney((job.quotedAmount ?? 0))} omzet wacht op facturatie`,
        entityId: job.id,
        entityType: 'job',
        suggestedAction: 'Factuur aanmaken',
        detectedAt: now.toISOString(),
      });
    }
  }

  // Schedule conflict detection — check for overlapping jobs
  const scheduledJobs = jobs.filter((j: any) =>
    (j.status === 'scheduled' || j.status === 'in-progress' || j.status === 'ingepland' || j.status === 'bezig') &&
    j.scheduledDate
  );
  for (let i = 0; i < scheduledJobs.length; i++) {
    for (let k = i + 1; k < scheduledJobs.length; k++) {
      const a = scheduledJobs[i];
      const b = scheduledJobs[k];
      if (a.scheduledDate !== b.scheduledDate) continue;
      // Same day — check time overlap
      const aStart = toMinutes(a.scheduledStartTime || '09:00');
      const aEnd = toMinutes(a.scheduledEndTime || addHours(a.scheduledStartTime || '09:00', a.estimatedDuration || 2));
      const bStart = toMinutes(b.scheduledStartTime || '09:00');
      const bEnd = toMinutes(b.scheduledEndTime || addHours(b.scheduledStartTime || '09:00', b.estimatedDuration || 2));
      if (aStart < bEnd && bStart < aEnd) {
        findings.push({
          id: `audit-conflict-${a.id}-${b.id}`,
          type: 'schedule_conflict',
          severity: 'warning',
          title: `Overlap: "${a.title}" en "${b.title}"`,
          description: `${a.scheduledDate} ${a.scheduledStartTime || '09:00'}-${a.scheduledEndTime || addHours(a.scheduledStartTime || '09:00', a.estimatedDuration || 2)} ↔ ${b.scheduledStartTime || '09:00'}-${b.scheduledEndTime || addHours(b.scheduledStartTime || '09:00', b.estimatedDuration || 2)}`,
          entityId: a.id,
          entityType: 'job',
          suggestedAction: 'Verplaats één van de klussen',
          detectedAt: now.toISOString(),
        });
      }
    }
  }

  return findings;
}

function addHours(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMin = (h || 9) * 60 + (m || 0) + hours * 60;
  const newH = Math.min(23, Math.floor(totalMin / 60));
  const newM = totalMin % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

/** Convert "HH:MM" to minutes since midnight for robust time comparison */
function toMinutes(time: string): number {
  const parts = time.split(':').map(Number);
  const h = parts[0] ?? 9;
  const m = parts[1] ?? 0;
  return (isNaN(h) ? 9 : h) * 60 + (isNaN(m) ? 0 : m);
}

function auditCerts(certs: any[]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const now = new Date();
  const dayMs = MS_PER_DAY;

  for (const cert of certs) {
    if (!cert || !cert.expiryDate) continue;
    const expiry = new Date(cert.expiryDate).getTime();
    if (isNaN(expiry)) continue;
    const daysLeft = Math.ceil((expiry - now.getTime()) / dayMs);

    if (daysLeft < 0) {
      findings.push({
        id: `audit-cert-expired-${cert.id || cert.name}`,
        type: 'cert_expiring',
        severity: 'critical',
        title: `${cert.name || cert.type || 'Certificaat'} is verlopen`,
        description: `${Math.abs(daysLeft)} dagen geleden verlopen`,
        suggestedAction: 'Direct vernieuwen',
        detectedAt: now.toISOString(),
      });
    } else if (daysLeft <= 30) {
      findings.push({
        id: `audit-cert-expiring-${cert.id || cert.name}`,
        type: 'cert_expiring',
        severity: daysLeft <= 7 ? 'critical' : 'warning',
        title: `${cert.name || cert.type || 'Certificaat'} verloopt over ${daysLeft} dagen`,
        description: cert.issuedBy || cert.authority || '',
        suggestedAction: daysLeft <= 7 ? 'Dringend vernieuwen' : 'Vernieuwing plannen',
        detectedAt: now.toISOString(),
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Trade-specific context tips (rotated daily)
// ---------------------------------------------------------------------------

const TRADE_TIPS: Record<string, Record<string, string[]>> = {
  plumbing: {
    NL: [
      'KIWA audit season starts in Q2 — ensure certifications are current',
      'New Scios Scope 8 requirements take effect soon — review gas work procedures',
      'Water quality regulations tightening — check backflow prevention compliance',
      'Winter freeze risk: remind customers about pipe insulation services',
      'Legionella prevention checks due for commercial clients this quarter',
    ],
    DE: [
      'VDE standard update effective April 2026 — review compliance',
      'DVGW certification renewal window opens next month',
      'Trinkwasserverordnung updates — check installation standards',
      'Energy efficiency rebates available for heat pump installations',
      'Handwerkskammer continuing education credits due this year',
    ],
    FR: [
      'RGE qualification renewal — check your Qualibat status',
      'New RT2020 thermal regulations affect plumbing installations',
      'MaPrimeRénov subsidies updated — inform customers about savings',
      'Assurance Décennale policy renewal window approaching',
      'Consuel certification process updated — review requirements',
    ],
    ES: [
      'RITE regulation updates for thermal installations — review compliance',
      'Comunidad Autónoma license renewal period — check expiry dates',
      'Energy efficiency certificate requirements updated for new builds',
      'Water scarcity regulations — promote water-saving fixtures to clients',
      'Seguro de Responsabilidad Civil renewal — compare provider rates',
    ],
    IT: [
      'DM 37/08 compliance audit season — prepare documentation',
      'Superbonus 110% deadline approaching — inform eligible customers',
      'DURC validity check — ensure contributions are current',
      'Camera di Commercio annual fee due this quarter',
      'New ENEA requirements for energy-related installations',
    ],
    UK: [
      'Unvented hot water certificate renewal due — book assessment',
      'Building Regulation Part G updates for water efficiency',
      'Water Supply Regulations compliance check recommended',
      'Gas Safe Register annual renewal — prepare documentation',
      'WRAS product approval list updated — check specified materials',
    ],
  },
  electrical: {
    NL: [
      'NEN 1010 standard update — review latest amendments',
      'Inspection certification renewal window opening soon',
      'Solar panel installation demand rising — consider expanding services',
      'EV charger installation certification increasingly required',
      'Smart home integration skills in high demand this quarter',
    ],
    DE: [
      'VDE standard update effective April 2026 — review compliance',
      'Elektrofachkraft re-certification due — schedule training',
      'Photovoltaik installation boom — ensure mounting certifications current',
      'E-Mobilität Wallbox demand increasing — get ADAC-certified',
      'Handwerkskammer Meisterbrief continuing education credits due',
    ],
    FR: [
      'Consuel certification process updated this quarter',
      'Habilitation Electrique renewal — schedule refresher training',
      'Linky smart meter installations creating service opportunities',
      'RGE qualification increasingly required for renovation subsidies',
      'IRVE certification for EV charging installations in demand',
    ],
    ES: [
      'REBT regulation update — review low-voltage installation requirements',
      'Certificado Instalador Electricista renewal period approaching',
      'Self-consumption solar installations booming — get certified',
      'Smart metering creating new maintenance contract opportunities',
      'Industrial electrical safety audit season — prepare documentation',
    ],
    IT: [
      'CEI standard updates — review latest normative changes',
      'DM 37/08 Lettera A compliance documentation review recommended',
      'Superbonus driving electrical renovation demand',
      'EV charging point installation certification increasingly required',
      'Prosumer solar installations growing — expand PV competencies',
    ],
    UK: [
      'Part P Building Regulations amendment — review changes',
      'NICEIC/ELECSA annual assessment approaching — prepare portfolio',
      '18th Edition Wiring Regulations Amendment 2 in effect',
      'EV chargepoint installation demand rising — OZEV grant still available',
      'Solar PV and battery storage MCS certification in high demand',
    ],
  },
  gas: {
    NL: [
      'F-gassen certification renewal — check STEK registration',
      'Scios Scope 8 audit season — prepare documentation',
      'Heat pump transition subsidies available — expand service offerings',
      'Annual boiler maintenance season approaching — schedule capacity',
      'New hydrogen-ready boiler standards under development',
    ],
    DE: [
      'DVGW certification renewal window opens next month',
      'GEG (Gebäudeenergiegesetz) requirements affecting gas installations',
      'Heat pump priority in new builds — diversify certifications',
      'Annual Schornsteinfeger coordination — schedule inspections',
      'TRGI update — review gas installation technical rules',
    ],
    FR: [
      'Qualigaz certification renewal period approaching',
      'RGE PG qualification increasingly required for subsidized work',
      'MaPrimeRénov pushing heat pump transitions — get QualiPAC certified',
      'Annual gas safety inspection season — optimize scheduling',
      'New RE2020 affecting gas installation in new construction',
    ],
    ES: [
      'Gas installation category A/B/C license renewal — check dates',
      'Annual gas inspection obligations — coordinate with distributors',
      'Natural gas to heat pump transition subsidies available',
      'RITE thermal installation regulations updated',
      'Comunidad Autónoma gas installer card renewal period',
    ],
    IT: [
      'DM 37/08 gas installation compliance review recommended',
      'Annual boiler maintenance obligations — plan customer outreach',
      'Superbonus for condensing boiler replacements still available',
      'CIG (Comitato Italiano Gas) technical standards updated',
      'UNI 7129 gas installation standard — review latest revision',
    ],
    UK: [
      'Gas Safe Register annual renewal — prepare CPD evidence',
      'ACS reassessment due — book with approved assessment centre',
      'Boiler Plus legislation — ensure compliance on all installations',
      'Heat pump competency framework — consider diversification training',
      'Smart meter gas module installations creating opportunities',
    ],
  },
  painting: {
    NL: [
      'VOC regulations tightening — switch to compliant products',
      'Exterior painting season starting — schedule capacity',
      'Lead paint regulations for pre-1960 buildings — ensure compliance',
      'Sustainability certifications gaining client interest',
      'New RAL color standards available — update your system',
    ],
    DE: [
      'TRGS 610 hazardous substance handling — refresh training',
      'Malermeister continuing education credits due this year',
      'VOC emission limits updated for interior coatings',
      'Heritage building restoration projects increasing — get certified',
      'BG Bau safety requirements updated for scaffolding work',
    ],
    FR: [
      'Diagnostic plomb (lead) requirements for pre-1949 buildings',
      'Qualibat certification for painting — review renewal dates',
      'REP (Extended Producer Responsibility) for paint packaging active',
      'MaPrimeRénov includes exterior insulation-painting combos',
      'New NF standards for paint performance — update specifications',
    ],
    ES: [
      'Prevención de Riesgos Laborales training renewal — schedule update',
      'Lead paint assessment requirements for historic buildings',
      'VOC regulations aligning with EU standards — check product compliance',
      'Summer exterior painting season — prepare scheduling capacity',
      'Sustainability certification demand growing among commercial clients',
    ],
    IT: [
      'CAM (Environmental Minimum Criteria) affecting public tender paint specs',
      'Albo Artigiani annual renewal — prepare documentation',
      'Lead paint regulations for pre-1992 buildings — ensure compliance',
      'Restoration and conservation certifications in high demand',
      'Safety training (RSPP) renewal period — schedule update',
    ],
    UK: [
      'CSCS card renewal — ensure on-site competency card is valid',
      'COSHH assessment requirements for paint products — review annually',
      'Heritage painting qualifications increasingly requested by clients',
      'Lead paint risk assessment mandatory for pre-1960 properties',
      'PAS 6000 for paint application standards — review compliance',
    ],
  },
  carpentry: {
    NL: [
      'FSC/PEFC wood sourcing requirements tightening for tenders',
      'Bouwbesluit updates affecting structural timber work',
      'Fire safety requirements for timber-frame construction updated',
      'Timber frame construction demand rising — expand capacity',
      'CE marking for structural timber products — verify supplier compliance',
    ],
    DE: [
      'Zimmermeister continuing education — schedule credits',
      'DIN 68800 wood protection standard updated — review changes',
      'KfW energy efficiency subsidies for timber renovation',
      'Holzbau (timber construction) boom — get structural certification',
      'BG Bau fall protection requirements for roof carpentry updated',
    ],
    FR: [
      'DTU 31.2 timber frame construction standard — review updates',
      'RE2020 favoring timber construction — position for growth',
      'Qualibat charpente qualification — check renewal date',
      'Wood treatment product regulations updated — verify compliance',
      'MaPrimeRénov for timber-frame insulation creating demand',
    ],
    ES: [
      'CTE (Código Técnico de Edificación) timber section updates',
      'Fire resistance requirements for timber in multi-story buildings',
      'Sustainable forestry certification gaining importance in tenders',
      'Prevención de Riesgos Laborales training renewal for woodworking',
      'AITIM (timber association) training programs — expand skills',
    ],
    IT: [
      'NTC 2018 seismic requirements for timber structures',
      'CAM sustainable wood sourcing for public projects — get certified',
      'Superbonus for timber-frame energy upgrades still available',
      'CLT (Cross Laminated Timber) skills increasingly demanded',
      'Safety training for woodworking machinery — schedule renewal',
    ],
    UK: [
      'CSCS card renewal — maintain site competency',
      'BS 5268 / Eurocode 5 structural timber — review standard changes',
      'Fire safety requirements updated for timber-frame buildings',
      'Modern Methods of Construction (MMC) timber skills in demand',
      'Heritage carpentry qualifications increasingly valued by clients',
    ],
  },
};

function getTradeContextTip(trade: string, country: string): string | undefined {
  const tradeLower = trade.toLowerCase();
  const tips = TRADE_TIPS[tradeLower]?.[country] ?? TRADE_TIPS[tradeLower]?.['NL'];
  if (!tips || tips.length === 0) return undefined;
  // Rotate daily based on day-of-year
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / MS_PER_DAY);
  return tips[dayOfYear % tips.length];
}

// ---------------------------------------------------------------------------
// Morning Briefing
// ---------------------------------------------------------------------------

export async function generateMorningBriefing(context: {
  invoices: any[];
  quotes: any[];
  jobs: any[];
  certs?: any[];
  country?: string;
  trade?: string;
}): Promise<MorningBriefing> {
  const invoiceFindings = auditInvoices(context.invoices);
  const quoteFindings = auditQuotes(context.quotes);
  const jobFindings = auditJobs(context.jobs);
  const certFindings = auditCerts(context.certs ?? []);

  // Workflow validator — batch check for systemic issues
  const validatorWarnings = validateWorkflowState({
    jobs: context.jobs,
    invoices: context.invoices,
    quotes: context.quotes,
    country: context.country ?? 'NL',
  });
  const validatorFindings: AuditFinding[] = validatorWarnings.map(w => ({
    id: `validator-${w.code}`,
    type: 'compliance_gap' as const,
    severity: 'warning' as const,
    title: w.message,
    description: w.message,
    detectedAt: new Date().toISOString(),
  }));

  const allFindings = [...invoiceFindings, ...quoteFindings, ...jobFindings, ...certFindings, ...validatorFindings]
    .sort((a, b) => {
      const sev = { critical: 0, warning: 1, info: 2 };
      return (sev[a.severity] ?? 2) - (sev[b.severity] ?? 2);
    });

  // Also populate AI action queue
  const actionsQueued = await populateQueue({
    completedJobs: context.jobs.filter(j => j.status === 'completed'),
    overdueInvoices: context.invoices.filter(i => i.status === 'overdue'),
    sentQuotes: context.quotes.filter(q => q.status === 'sent'),
    expiringCerts: [],
    // Forward the full context — without these, ~7 proactive queue types
    // (progress_note, reorder_materials, satisfaction_survey, permit_check,
    // supplier_comparison, schedule_suggestion, annual maintenance_due) read
    // `context.allJobs ?? []` = empty and could never be produced.
    allJobs: context.jobs,
    allInvoices: context.invoices,
    allQuotes: context.quotes,
    // (customers not in generateMorningBriefing's context — the main daily
    // populateQueue call at getContext() below forwards them; here the queue
    // items just render without a customer name, still produced.)
    country: context.country,
  });

  // ── Build personalSummary ──
  const totalChecked = context.invoices.length + context.quotes.length + context.jobs.length + (context.certs ?? []).length;
  const criticalCount = allFindings.filter(f => f.severity === 'critical').length;
  const tradeName = context.trade || 'contractor';
  let personalSummary: string;
  if (criticalCount > 0) {
    const topCritical = allFindings.find(f => f.severity === 'critical');
    const amountMatch = topCritical?.description?.match(/€[\d.,]+/);
    const amountStr = amountMatch ? ` (${amountMatch[0]})` : '';
    personalSummary = `Checked ${context.invoices.length} invoices, ${context.quotes.length} quotes, ${context.jobs.length} jobs. Found ${criticalCount} critical${amountStr} and ${allFindings.length - criticalCount} other findings.`;
  } else if (allFindings.length > 0) {
    personalSummary = `Checked ${totalChecked} items. ${allFindings.length} findings — nothing critical. Your ${tradeName} business is running smoothly.`;
  } else {
    personalSummary = `All clear — ${totalChecked} items checked, no issues found.`;
  }

  // ── Build proactiveAlerts (forward-looking) ──
  const proactiveAlerts: string[] = [];
  const now2 = new Date();

  // Invoices approaching due date (within 3 days)
  for (const inv of context.invoices) {
    if (inv.status !== 'sent') continue;
    const dueDate = inv.dueDate ? new Date(inv.dueDate) : null;
    if (!dueDate) continue;
    const daysUntilDue = invoiceDaysUntilDue(inv as any, now2) ?? 0;
    if (daysUntilDue > 0 && daysUntilDue <= 3) {
      proactiveAlerts.push(`Invoice ${inv.id} (${formatMoney((inv.amount ?? 0))}) due in ${daysUntilDue} day${daysUntilDue > 1 ? 's' : ''}`);
    }
  }

  // Jobs starting in next 2 days without materials ordered
  for (const job of context.jobs) {
    if (job.status !== 'scheduled' && job.status !== 'ingepland') continue;
    const startDate = new Date(job.scheduledDate || job.startDate || '');
    if (isNaN(startDate.getTime())) continue;
    const daysUntilStart = Math.ceil((startDate.getTime() - now2.getTime()) / MS_PER_DAY);
    if (daysUntilStart > 0 && daysUntilStart <= 2) {
      const hasMaterials = (job.materials ?? []).length > 0;
      const materialsOrdered = job.materialsOrdered ?? false;
      if (hasMaterials && !materialsOrdered) {
        proactiveAlerts.push(`"${job.title}" starts in ${daysUntilStart} day${daysUntilStart > 1 ? 's' : ''} — materials not yet ordered`);
      }
    }
  }

  // Certs expiring within 14 days
  for (const cert of (context.certs ?? [])) {
    if (!cert?.expiryDate) continue;
    const expiry = new Date(cert.expiryDate).getTime();
    if (isNaN(expiry)) continue;
    const daysLeft = Math.ceil((expiry - now2.getTime()) / MS_PER_DAY);
    if (daysLeft > 0 && daysLeft <= 14) {
      proactiveAlerts.push(`${cert.name || 'Certificate'} expires in ${daysLeft} days`);
    }
  }

  // Quotes expiring within 7 days
  for (const q of context.quotes) {
    if (q.status !== 'sent') continue;
    const validUntil = q.validUntil ? new Date(q.validUntil).getTime() : 0;
    if (!validUntil) continue;
    const daysLeft = Math.ceil((validUntil - now2.getTime()) / MS_PER_DAY);
    if (daysLeft > 0 && daysLeft <= 7) {
      proactiveAlerts.push(`Quote for ${q.customer || q.id} (${formatMoney((q.amount ?? 0))}) expires in ${daysLeft} days`);
    }
  }

  // ── Build tradeContext — seasonal awareness from tradeContext service ──
  const seasonalTip = getSeasonalContext(tradeName, context.country ?? 'NL');
  const legacyTip = getTradeContextTip(tradeName, context.country ?? 'NL');
  const tradeContext = seasonalTip || legacyTip;

  const briefing: MorningBriefing = {
    date: todayKey(),
    auditsRun: 4, // invoices, quotes, jobs, certs
    itemsChecked: {
      invoices: context.invoices.length,
      quotes: context.quotes.length,
      jobs: context.jobs.length,
      certs: (context.certs ?? []).length,
    },
    findings: allFindings.slice(0, 10), // Top 10 findings
    actionsQueued,
    generatedAt: new Date().toISOString(),
    personalSummary,
    tradeContext,
    proactiveAlerts: proactiveAlerts.slice(0, 5),
  };

  await AsyncStorage.setItem(BRIEFING_KEY, JSON.stringify(briefing));
  return briefing;
}

export async function getMorningBriefing(): Promise<MorningBriefing | null> {
  try {
    const raw = await AsyncStorage.getItem(BRIEFING_KEY);
    if (!raw) return null;
    const briefing: MorningBriefing = JSON.parse(raw);
    // Only return if from today
    const today = todayKey();
    if (briefing.date === today) return briefing;
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Background scheduler
// ---------------------------------------------------------------------------

let schedulerTimer: ReturnType<typeof setInterval> | null = null;

export function startBackgroundJobScheduler(
  getContext: () => { invoices: any[]; quotes: any[]; jobs: any[]; customers?: any[]; country?: string },
): void {
  if (schedulerTimer) return;

  // Run morning briefing immediately on first start
  const ctx = getContext();
  generateMorningBriefing(ctx).catch(() => {});

  // R14.4: also kick the gated tick once immediately on start. Without this,
  // a contractor who opens the app briefly (< 30 min) never sees any of the
  // 6-hourly / daily blocks fire — populateQueue, evaluateTriggers, EVE live
  // actions, and ML calibration all wait for the first setInterval tick.
  // The internal state.lastXRun gates ensure we don't re-run blocks that
  // already ran recently.
  runScheduledTick(getContext).catch(() => {});

  // Check every 30 minutes if any scheduled jobs are due
  schedulerTimer = setInterval(() => { runScheduledTick(getContext).catch(() => {}); }, 30 * 60 * 1000);
}

// R14.4: extracted from the setInterval body so it can also fire once on start.
async function runScheduledTick(
  getContext: () => { invoices: any[]; quotes: any[]; jobs: any[]; customers?: any[]; country?: string },
): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(SCHEDULER_KEY);
      const state: SchedulerState = raw ? JSON.parse(raw) : {
        lastHourlyRun: '',
        lastSixHourlyRun: '',
        lastDailyRun: '',
        totalAuditsRun: 0,
      };

      const now = new Date();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      // Shortened from 6h → 2h so evening/late-day events (e.g. invoice overdue
      // at 18:00) don't wait until tomorrow to fire dunning triggers.
      const sixHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const halfDayAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();

      const context = getContext();

      // Hourly: invoice audit
      if (!state.lastHourlyRun || state.lastHourlyRun < hourAgo) {
        auditInvoices(context.invoices); // Results stored via morning briefing
        state.lastHourlyRun = now.toISOString();
        state.totalAuditsRun++;
      }

      // 6-hourly: quote audit + action queue + trigger evaluation
      if (!state.lastSixHourlyRun || state.lastSixHourlyRun < sixHoursAgo) {
        auditQuotes(context.quotes);
        await populateQueue({
          completedJobs: context.jobs.filter((j: any) => j.status === 'completed'),
          overdueInvoices: context.invoices.filter((i: any) => i.status === 'overdue'),
          sentQuotes: context.quotes.filter((q: any) => q.status === 'sent'),
          expiringCerts: [],
          allJobs: context.jobs,
          allInvoices: context.invoices,
          allQuotes: context.quotes,
          customers: context.customers,
          country: context.country,
        });
        // Evaluate workflow pack triggers against real data
        await evaluateTriggers({
          invoices: context.invoices,
          quotes: context.quotes,
          jobs: context.jobs,
          customers: context.customers ?? [],
        }).catch(() => {});
        state.lastSixHourlyRun = now.toISOString();
        state.totalAuditsRun++;
      }

      // Daily (or whenever briefing is >12h old): full morning briefing + ML
      // calibration + purchasing agent. Previously this fired only if it had
      // been a full 24h, so users opening the app mid-afternoon could see
      // overnight-stale data.
      if (!state.lastDailyRun || state.lastDailyRun < halfDayAgo) {
        await generateMorningBriefing(context);
        // EVE three-agent workforce status — run once per daily block so
        // the Analyst can surface cross-cutting insights (churn, margin drift).
        try {
          // Convert the live snapshot into concrete EveAction items and stream
          // them into the AI action queue so they surface in VascoCard alongside
          // the generator-emitted items.
          const { buildLiveActions } = await import('../services/eveLiveActionService');
          const { addToQueue } = await import('../services/aiActionQueueService');
          type QueueItemType = import('../services/aiActionQueueService').QueueItemType;
          const actions = buildLiveActions({
            jobs: context.jobs ?? [],
            quotes: context.quotes ?? [],
            invoices: context.invoices ?? [],
            customers: context.customers ?? [],
          });
          // R294: type mapping fixes:
          //   - compliance_gap (auditor on overdue invoice) was mapped to
          //     draft_reminder which is SHAREABLE — Approve would open Share
          //     sheet with contractor-internal text ("€450 outstanding —
          //     final notice recommended") and send it to the customer.
          //     Now maps to late_payment_risk_alert which deep-links to
          //     /invoices/{id} via R286 executor — contractor uses the real
          //     reminder flow with gateReminderSend (R287).
          //   - pricing_insight (analyst on low win rate) was 'general' —
          //     not a valid QueueItemType, fell through executor default
          //     to no-op. Now low_win_alert (informational, also no-op when
          //     no quoteId, but at least classifies correctly).
          const mapType = (t: string): QueueItemType => {
            if (t === 'draft_invoice') return 'draft_invoice';
            if (t === 'compliance_gap') return 'late_payment_risk_alert';
            if (t === 'pricing_insight') return 'low_win_alert';
            // R302+R304: shareable trigger types — all map to existing queue
            // types whose executor branch opens Share with preparedData.template.
            if (t === 'progress_update') return 'progress_note';
            if (t === 'draft_followup') return 'draft_followup';
            if (t === 'job_handover') return 'job_handover';
            if (t === 'satisfaction_survey') return 'satisfaction_survey';
            return 'low_win_alert'; // safe informational fallback
          };
          for (const a of actions) {
            const pd = a.preparedData as any;
            // Stable entityKey — MUST NOT fall back to `a.id`. buildLiveActions
            // mints ids via `${prefix}-${Date.now()}-${random}`, so an id-based
            // key made every daily run look like a brand-new entity: the queue's
            // sibling-merge then bumped the count badge instead of deduping, and
            // the same three invoices read as "11× Incasso" after a few logins.
            // Quote-derived actions (draft_followup, quote_sent) and the
            // win-rate insight carry no jobId/invoiceId, which is exactly the
            // set that inflated. quoteId covers the former; the latter is a
            // singleton per type, so the type alone is its stable identity.
            const entityId = pd?.jobId ?? pd?.invoiceId ?? pd?.quoteId ?? 'singleton';
            await addToQueue({
              type: mapType(a.type),
              title: a.title,
              description: a.description,
              preparedData: a.preparedData,
              actionLabel: a.actionLabel,
              estimatedImpact: a.impact,
              expiresAt: a.expiresAt,
              entityKey: `eve-${a.type}-${entityId}`,
              sourceGeneratorId: `eve-${a.agentType}`,
            });
          }
        } catch {}
        // Calibrate ML models from accumulated prediction/actual pairs
        await calibrateModels().catch(() => {});

        // Compliance agent — scan licenses/certs/insurance for 30/14/7/1-day
        // expiry, upsert idempotent alerts, queue cert_renewal actions.
        try {
          const { scan } = await import('../services/complianceAgentService');
          await scan().catch(() => {});
        } catch {}

        // Purchasing Agent — daily price drop check (Pro+ only)
        try {
          const sub = await loadSubscription();
          const limits = getTierLimits(sub.tier);
          if (limits.hasPurchasingAgent) {
            const prefs = await loadOnboardingPreferences();
            const trade = prefs.trades[0] ?? 'general';
            const country = prefs.country ?? 'NL';
            const { runScheduledPurchasingAgent } = await import('../services/purchasingAgentService');
            const purchasingResults = await runScheduledPurchasingAgent({
              trade,
              country,
              postcode: prefs.postcode || '1012',
              upcomingJobs: context.jobs
                .filter((j: any) => j.status === 'scheduled' || j.status === 'accepted')
                .slice(0, 10)
                .map((j: any) => ({ id: j.id, title: j.title, materials: j.materials })),
            });

            const t = i18n.t.bind(i18n);

            // Queue price drop alerts
            for (const drop of purchasingResults.priceDrops.slice(0, 3)) {
              await addToQueue({
                type: 'price_alert',
                // R66r46: alert semantic shifted from "price fell" (Math.random
                // noise pre-R46) to "you're paying X% above cohort median".
                title: t('purchasing.cohortGap', { defaultValue: '{{material}} — {{percent}}% above cohort median', material: drop.materialName, percent: drop.dropPercent }),
                description: t('purchasing.cohortGapDesc', { defaultValue: 'Your last buy {{user}} · cohort median {{median}} ({{cohort}})', user: formatMoney2(drop.previousPrice), median: formatMoney2(drop.currentPrice), cohort: drop.supplier.name }),
                preparedData: { type: 'cohort_gap', ...drop, affiliateUrl: drop.affiliateUrl },
                actionLabel: t('purchasing.findCheaper', 'Find a cheaper supplier'),
                estimatedImpact: `${formatMoney((drop.previousPrice - drop.currentPrice))} ${t('purchasing.savingPotential', 'saving potential per unit')}`,
                expiresAt: drop.expiresAt,
                sourceGeneratorId: `purchasing_drop_${drop.materialName}`,
              }).catch(() => {});
            }

            // Queue bulk opportunity
            if (purchasingResults.bulkOpportunity) {
              const bulk = purchasingResults.bulkOpportunity;
              await addToQueue({
                type: 'bulk_purchase',
                title: t('purchasing.bulkSaving', { defaultValue: 'Bulk order saves {{amount}}', amount: formatMoney(bulk.savingsAmount) }),
                description: t('purchasing.bulkDesc', { defaultValue: '{{count}} materials across {{jobs}} jobs — order together at {{supplier}}', count: bulk.materials.length, jobs: bulk.materials.reduce((s: number, m: any) => s + m.jobIds.length, 0), supplier: bulk.bestSupplier.name }),
                preparedData: { type: 'bulk_opportunity', ...bulk },
                actionLabel: t('purchasing.createBulkOrder', 'Create bulk order'),
                estimatedImpact: `${formatMoney(bulk.savingsAmount)} (${bulk.savingsPercent}%)`,
                expiresAt: new Date(Date.now() + 7 * MS_PER_DAY).toISOString(),
                sourceGeneratorId: 'purchasing_bulk',
              }).catch(() => {});
            }

            // Queue seasonal advice
            if (purchasingResults.seasonalAdvice) {
              const advice = purchasingResults.seasonalAdvice;
              await addToQueue({
                type: 'price_alert',
                title: advice.suggestedAction,
                description: advice.advice,
                preparedData: { type: 'seasonal_stock_up', ...advice },
                actionLabel: t('purchasing.viewDetails', 'View details'),
                estimatedImpact: t('purchasing.seasonalSavings', 'Pre-season pricing'),
                expiresAt: new Date(Date.now() + 30 * MS_PER_DAY).toISOString(),
                sourceGeneratorId: 'purchasing_seasonal',
              }).catch(() => {});
            }
          }
        } catch {}

        // R15.4: spawn jobs for due service agreements (recurringJobService —
        // the older service powering /contractor/service-agreements). The
        // service has had `checkAndGenerateDueJobs` since R246 but zero
        // callers — agreements created via the Werk tab "Recurring contract"
        // entry sat in AsyncStorage and never produced a real job. Now we
        // run the check daily and queue a maintenance_due item per spawned
        // job so the contractor approves the actual creation.
        try {
          const { checkAndGenerateDueJobs } = await import('../services/recurringJobService');
          const { addToQueue } = await import('../services/aiActionQueueService');
          const { dueAgreements, generatedJobs } = await checkAndGenerateDueJobs();
          const tt = i18n.t.bind(i18n);
          for (let i = 0; i < dueAgreements.length; i++) {
            const ag = dueAgreements[i];
            const jobData = generatedJobs[i];
            await addToQueue({
              type: 'maintenance_due',
              title: tt('automation.serviceAgreementDue', { defaultValue: '{{title}} due — {{customer}}', title: ag.jobTitle, customer: ag.customerName }),
              description: tt('automation.serviceAgreementSpawned', { defaultValue: 'Service agreement ({{frequency}}) spawned a new job. Approve to add it.', frequency: ag.frequency }),
              preparedData: {
                serviceAgreementId: ag.id,
                spawnedJobData: jobData,
                customerId: ag.customerId,
                customerName: ag.customerName,
              },
              actionLabel: tt('automation.scheduleMaintenance', 'Schedule'),
              estimatedImpact: tt('automation.recurringRevenue', 'Recurring revenue'),
              expiresAt: new Date(Date.now() + 14 * MS_PER_DAY).toISOString(),
              sourceGeneratorId: `service_agreement_${ag.id}`,
            }).catch(() => {});
          }
        } catch {}

        state.lastDailyRun = now.toISOString();
        state.totalAuditsRun++;
      }

      await AsyncStorage.setItem(SCHEDULER_KEY, JSON.stringify(state));
    } catch {}
}

export function stopBackgroundJobScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

/** Returns when the scheduler last ran any check, or null if never */
export async function getLastCheckedAt(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(SCHEDULER_KEY);
    if (!raw) return null;
    const state: SchedulerState = JSON.parse(raw);
    // Return the most recent of the three run timestamps
    const timestamps = [state.lastHourlyRun, state.lastSixHourlyRun, state.lastDailyRun].filter(Boolean);
    if (timestamps.length === 0) return null;
    return timestamps.sort().pop() || null;
  } catch {
    return null;
  }
}
