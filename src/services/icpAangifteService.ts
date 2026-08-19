// =============================================================================
// NL ICP-AANGIFTE (Intra-community supply declaration) — R250
// =============================================================================
// When a NL contractor sells to a B2B customer in another EU country with a
// valid VAT number, the sale is 0% VAT (verlegd) BUT must be reported per
// quarter via Opgaaf intracommunautaire prestaties (ICP) to the Belastingdienst.
//
// This service aggregates qualifying transactions per quarter and produces:
//   - JSON summary (counterparty VAT, country, total goods, total services)
//   - Plain-text report contractor pastes into the ICP portal
//
// Direct API submission to Belastingdienst requires PKIoverheid certificate +
// formal SBR partner registration — not feasible without first paying users.
// This service prepares the data; the contractor uploads it.
// =============================================================================

import { isSmallBusinessExempt } from '../domain/business';
import { localDateKey } from '../utils/dateKey';

export interface IcpInvoiceLike {
  id: string;
  customerVatNumber?: string;
  customerCountry?: string;            // ISO-2
  customerName?: string;
  amount: number;                       // net (excl. VAT)
  vatAmount?: number;                   // 0 for verlegd
  isService?: boolean;                  // services vs goods affects ICP rubric
  invoiceDate?: string;
  reverseCharged?: boolean;             // 'BTW verlegd'
}

export interface IcpQuarter {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  startDate: string;                    // ISO date
  endDate: string;
}

export interface IcpRow {
  customerVatNumber: string;
  customerCountry: string;
  customerName: string;
  totalGoods: number;
  totalServices: number;
  totalReverseCharged: number;
  invoiceCount: number;
}

export interface IcpReport {
  quarter: IcpQuarter;
  contractorVatNumber: string;
  contractorName: string;
  rows: IcpRow[];
  totalNet: number;
  totalGoods: number;
  totalServices: number;
  invoiceCount: number;
  warnings: string[];
}

const EU_COUNTRIES = new Set([
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT',
  'LV','LT','LU','MT','PL','PT','RO','SK','SI','ES','SE',
]);

export function quarterFromDate(d: Date): IcpQuarter {
  const month = d.getUTCMonth();
  const q = (Math.floor(month / 3) + 1) as 1 | 2 | 3 | 4;
  const year = d.getUTCFullYear();
  const startMonth = (q - 1) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 0));
  return {
    year, quarter: q,
    startDate: localDateKey(start),
    endDate: localDateKey(end),
  };
}

/** True when this invoice is an intra-community supply that belongs in ICP. */
export function isIcpEligible(invoice: IcpInvoiceLike, contractorCountry: string): boolean {
  if (!invoice.customerVatNumber || !invoice.customerCountry) return false;
  const cc = invoice.customerCountry.toUpperCase();
  if (cc === contractorCountry.toUpperCase()) return false;
  if (!EU_COUNTRIES.has(cc)) return false;
  if (!invoice.reverseCharged && (invoice.vatAmount ?? 0) > 0) return false;
  return true;
}

export function buildIcpReport(input: {
  invoices: IcpInvoiceLike[];
  contractorCountry: string;
  contractorVatNumber: string;
  contractorName: string;
  vatScheme?: 'standard' | 'small_business_NL_KOR' | 'small_business_DE_kleinunternehmer';
  quarter: IcpQuarter;
}): IcpReport {
  const warnings: string[] = [];
  if (isSmallBusinessExempt({ vatScheme: input.vatScheme })) {
    warnings.push('Contractor is on the small-business scheme; ICP-aangifte is normally not required.');
  }

  const start = new Date(input.quarter.startDate).getTime();
  const end = new Date(input.quarter.endDate).getTime() + 86400000;

  const eligible = input.invoices.filter((inv) => {
    if (!isIcpEligible(inv, input.contractorCountry)) return false;
    const t = inv.invoiceDate ? new Date(inv.invoiceDate).getTime() : 0;
    return t >= start && t < end;
  });

  const byKey = new Map<string, IcpRow>();
  for (const inv of eligible) {
    const key = `${inv.customerCountry}|${inv.customerVatNumber}`;
    let row = byKey.get(key);
    if (!row) {
      row = {
        customerVatNumber: inv.customerVatNumber!,
        customerCountry: inv.customerCountry!.toUpperCase(),
        customerName: inv.customerName ?? '(unknown)',
        totalGoods: 0, totalServices: 0, totalReverseCharged: 0, invoiceCount: 0,
      };
      byKey.set(key, row);
    }
    if (inv.isService) row.totalServices += inv.amount;
    else row.totalGoods += inv.amount;
    if (inv.reverseCharged) row.totalReverseCharged += inv.amount;
    row.invoiceCount += 1;
  }

  const rows = Array.from(byKey.values()).sort((a, b) =>
    (b.totalGoods + b.totalServices) - (a.totalGoods + a.totalServices),
  );
  const totalGoods = rows.reduce((s, r) => s + r.totalGoods, 0);
  const totalServices = rows.reduce((s, r) => s + r.totalServices, 0);

  return {
    quarter: input.quarter,
    contractorVatNumber: input.contractorVatNumber,
    contractorName: input.contractorName,
    rows,
    totalNet: totalGoods + totalServices,
    totalGoods,
    totalServices,
    invoiceCount: eligible.length,
    warnings,
  };
}

export function formatIcpReport(report: IcpReport): string {
  const lines = [
    `ICP-aangifte ${report.quarter.year} Q${report.quarter.quarter}`,
    `Periode: ${report.quarter.startDate} → ${report.quarter.endDate}`,
    `Aangever: ${report.contractorName} (${report.contractorVatNumber})`,
    ``,
    `Totaal goederen:   €${report.totalGoods.toFixed(2)}`,
    `Totaal diensten:   €${report.totalServices.toFixed(2)}`,
    `Totaal netto:      €${report.totalNet.toFixed(2)}`,
    `Aantal facturen:   ${report.invoiceCount}`,
    ``,
    `Per afnemer:`,
    ...report.rows.map((r) =>
      `  ${r.customerCountry} ${r.customerVatNumber}  ${r.customerName}` +
      `\n    goederen: €${r.totalGoods.toFixed(2)} · diensten: €${r.totalServices.toFixed(2)}` +
      ` · facturen: ${r.invoiceCount}`,
    ),
  ];
  if (report.warnings.length > 0) {
    lines.push('', 'Waarschuwingen:');
    for (const w of report.warnings) lines.push(`  - ${w}`);
  }
  return lines.join('\n');
}
