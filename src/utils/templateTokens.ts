// =============================================================================
// Message-template variables as WORDS a builder reads — "[klant]", not
// "{{customer}}" (emulator walk 2026-09-28: the editor showed English code
// variables in curly braces to a Dutch plumber).
// =============================================================================
// Storage keeps {{customer}}: resolveTemplate fills that at send time and
// saved templates already use it. Only the screen shows words, and turns them
// back into tokens when the template is saved.

export const TEMPLATE_TOKENS = [
  'customer', 'amount', 'date', 'jobTitle', 'invoiceId', 'daysOverdue', 'contractorName',
] as const;
export type TemplateToken = typeof TEMPLATE_TOKENS[number];

/** The word shown for a token, e.g. label('customer') → "klant". */
export type TokenLabel = (token: TemplateToken) => string;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** "{{customer}}" → "[klant]" for display, sharing and editing. */
export function tokensToWords(text: string, label: TokenLabel): string {
  return TEMPLATE_TOKENS.reduce(
    (out, tok) => out.replace(new RegExp(`\\{\\{\\s*${tok}\\s*\\}\\}`, 'g'), `[${label(tok)}]`),
    text,
  );
}

/** "[klant]" → "{{customer}}" when saving (case-insensitive). Unknown brackets stay. */
export function wordsToTokens(text: string, label: TokenLabel): string {
  return TEMPLATE_TOKENS.reduce(
    (out, tok) => out.replace(new RegExp(`\\[\\s*${escape(label(tok))}\\s*\\]`, 'gi'), `{{${tok}}}`),
    text,
  );
}
