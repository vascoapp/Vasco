/**
 * Budget PDF Export Service — generates a Dutch PDF report of approved
 * budget optimizations and shares it via the system share sheet.
 * Uses expo-print + expo-sharing.
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { LineOptimization, ScenarioResult, CategoryOptimization } from './budgetOptimizerService';

// ── Number formatting (Dutch) ──────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

const riskLabel = (risk: 'low' | 'medium' | 'high') => {
  switch (risk) {
    case 'low': return 'Laag';
    case 'medium': return 'Middel';
    case 'high': return 'Hoog';
  }
};

const riskColor = (risk: 'low' | 'medium' | 'high') => {
  switch (risk) {
    case 'low': return '#34C759';
    case 'medium': return '#FF9500';
    case 'high': return '#FF3B30';
  }
};

// ── HTML Template ──────────────────────────────────────────

function buildHtml(
  projectName: string,
  scenario: ScenarioResult,
  approvedOptimizations: LineOptimization[],
): string {
  const today = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const totalApprovedSavings = approvedOptimizations.reduce((s, o) => s + o.savings, 0);

  // Category breakdown from approved optimizations
  const catMap = new Map<string, { count: number; savings: number }>();
  for (const opt of approvedOptimizations) {
    const entry = catMap.get(opt.category) ?? { count: 0, savings: 0 };
    entry.count += 1;
    entry.savings += opt.savings;
    catMap.set(opt.category, entry);
  }
  const categories = Array.from(catMap.entries())
    .sort((a, b) => b[1].savings - a[1].savings);

  const optimizationRows = approvedOptimizations
    .map(
      (opt) => `
    <tr>
      <td style="font-weight:600">${opt.costCode}</td>
      <td>${opt.description}</td>
      <td>${opt.category}</td>
      <td style="text-align:right">\u20AC${fmt(opt.currentTotal)}</td>
      <td style="text-align:right">\u20AC${fmt(opt.suggestedTotal)}</td>
      <td style="text-align:right;color:#34C759;font-weight:600">\u20AC${fmt(opt.savings)}</td>
      <td style="text-align:center">
        <span style="background:${riskColor(opt.risk)}22;color:${riskColor(opt.risk)};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">
          ${riskLabel(opt.risk)}
        </span>
      </td>
    </tr>`,
    )
    .join('\n');

  const categoryRows = categories
    .map(
      ([name, { count, savings }]) => `
    <tr>
      <td>${name}</td>
      <td style="text-align:center">${count}</td>
      <td style="text-align:right;color:#34C759;font-weight:600">\u20AC${fmt(savings)}</td>
    </tr>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; padding: 32px; font-size: 13px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 3px solid #E35205; padding-bottom: 16px; }
    .header h1 { font-size: 22px; font-weight: 700; color: #1a1a1a; }
    .header .subtitle { font-size: 14px; color: #666; margin-top: 4px; }
    .header .date { font-size: 12px; color: #999; text-align: right; }
    .summary-grid { display: flex; gap: 16px; margin-bottom: 24px; }
    .summary-item { flex: 1; background: #f8f8f8; border-radius: 8px; padding: 16px; text-align: center; }
    .summary-item .value { font-size: 20px; font-weight: 700; color: #1a1a1a; }
    .summary-item .label { font-size: 11px; color: #666; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .summary-item.savings .value { color: #34C759; }
    h2 { font-size: 16px; font-weight: 700; margin: 24px 0 12px; color: #1a1a1a; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #f0f0f0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #666; text-align: left; padding: 8px 10px; }
    td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 12px; }
    tr:last-child td { border-bottom: none; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; text-align: center; font-size: 11px; color: #999; }
    .accent { color: #E35205; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Budget Optimalisatie Rapport</h1>
      <div class="subtitle">${projectName} \u2014 ${scenario.label}</div>
    </div>
    <div class="date">${today}</div>
  </div>

  <div class="summary-grid">
    <div class="summary-item">
      <div class="value">\u20AC${fmt(scenario.totalBudget)}</div>
      <div class="label">Origineel budget</div>
    </div>
    <div class="summary-item">
      <div class="value">\u20AC${fmt(scenario.totalBudget - totalApprovedSavings)}</div>
      <div class="label">Geoptimaliseerd budget</div>
    </div>
    <div class="summary-item savings">
      <div class="value">\u20AC${fmt(totalApprovedSavings)}</div>
      <div class="label">Totale besparing</div>
    </div>
    <div class="summary-item savings">
      <div class="value">${scenario.totalBudget > 0 ? fmtPct((totalApprovedSavings / scenario.totalBudget) * 100) : '0%'}</div>
      <div class="label">Besparing %</div>
    </div>
  </div>

  <h2>Goedgekeurde Optimalisaties (${approvedOptimizations.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Code</th>
        <th>Omschrijving</th>
        <th>Categorie</th>
        <th style="text-align:right">Huidig</th>
        <th style="text-align:right">Voorstel</th>
        <th style="text-align:right">Besparing</th>
        <th style="text-align:center">Risico</th>
      </tr>
    </thead>
    <tbody>
      ${optimizationRows}
    </tbody>
  </table>

  <h2>Categorie Overzicht</h2>
  <table>
    <thead>
      <tr>
        <th>Categorie</th>
        <th style="text-align:center"># Optimalisaties</th>
        <th style="text-align:right">Totale besparing</th>
      </tr>
    </thead>
    <tbody>
      ${categoryRows}
    </tbody>
  </table>

  <div class="footer">
    Gegenereerd door <span class="accent">Vasco Budget Optimizer</span> \u2014 ${today}
  </div>
</body>
</html>`;
}

// ── Export function ─────────────────────────────────────────

export async function exportBudgetPdf(
  projectName: string,
  scenario: ScenarioResult,
  approvedOptimizations: LineOptimization[],
): Promise<void> {
  const html = buildHtml(projectName, scenario, approvedOptimizations);

  const { uri } = await Print.printToFileAsync({ html });

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `Budget Optimalisatie — ${projectName}`,
    UTI: 'com.adobe.pdf',
  });
}
