/**
 * Format currency amounts consistently across the app.
 * Uses device locale for number formatting.
 */

/** Format as currency with symbol. Large amounts show no decimals, small amounts show 2. */
export function formatAmount(amount: number, symbol = '€'): string {
  if (Math.abs(amount) >= 1000) {
    return `${symbol}${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Format as unit price (always 2 decimals) */
export function formatUnitPrice(price: number, symbol = '€'): string {
  return `${symbol}${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Format percentage */
export function formatPercent(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}

/** Format with +/- sign for changes */
export function formatChange(value: number, symbol = '€'): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${formatAmount(value, symbol)}`;
}
