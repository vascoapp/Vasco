// =============================================================================
// AI COMMAND ROUTER — route AI bot intents to in-app screens (R98)
// =============================================================================
// Pure mapper from AiCommandResult → { path, label } used by the chat UI
// to render the "Open" CTA on assistant bubbles. Extracted from
// app/contractor/ai-chat.tsx so the params-encoding contract is
// independently testable.
//
// Action params land as query-string hints on the destination route.
// Destinations that don't consume them ignore the extras — safe additive
// change. Convention: `aiCustomer`, `aiAmount`, `aiDate`, `aiTime`,
// `aiTitle`, `aiIntent`, `q` (search seed).
// =============================================================================

import type { AiCommandResult } from './aiCommandService';

export interface AiRouteSpec {
  path: string;
  label: string;
}

export function buildQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return entries.length > 0 ? `?${entries.join('&')}` : '';
}

export function routeForIntent(result: AiCommandResult): AiRouteSpec | undefined {
  const p = result.action?.params ?? {};
  const qs = buildQueryString;
  switch (result.intent) {
    case 'create_invoice':
      return {
        path: `/(contractor)/geld${qs({ aiCustomer: p.customerName, aiAmount: p.amount, aiIntent: 'create_invoice' })}`,
        label: 'Open Money tab',
      };
    case 'schedule_job':
      return {
        path: `/contractor/drag-schedule${qs({ aiCustomer: p.customerName, aiDate: p.date, aiTime: p.time, aiTitle: p.title })}`,
        label: 'Open scheduler',
      };
    case 'list_overdue':
      return { path: '/(contractor)/geld?aiIntent=list_overdue', label: 'View overdue' };
    case 'query_revenue':
      return { path: '/hub/savings', label: 'See breakdown' };
    case 'send_reminder':
      return {
        path: `/(contractor)/geld${qs({ aiCustomer: p.customerName, aiIntent: 'send_reminder' })}`,
        label: 'Open Money tab',
      };
    case 'cancel_job':
      return {
        path: `/(contractor)/werk${qs({ aiCustomer: p.customerName, aiIntent: 'cancel_job' })}`,
        label: 'Open Work tab',
      };
    case 'query_job_status':
      return { path: '/(contractor)/werk?aiIntent=query_job_status', label: 'Open Work tab' };
    case 'find_customer':
      // customer-crm reads `q` from useLocalSearchParams and seeds the
      // search field, so the contractor lands with the right list
      // narrowed instead of a re-typed query.
      return {
        path: `/contractor/customer-crm${qs({ q: p.query })}`,
        label: 'Open Customers',
      };
    case 'weekly_summary':
      return { path: '/hub/savings', label: 'See breakdown' };
    default:
      return undefined;
  }
}
