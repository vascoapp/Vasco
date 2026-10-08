// A message to a customer is signed by the business that sends it.
//
// The sign-off templates end in "Kind regards" / "Met vriendelijke groet" and
// nothing under it — the customer could not tell who wrote (German walk W100
// fixed it for the quote link only; the UK walk, 2026-10-08, found the
// follow-up draft unsigned). Every drafted customer message goes through here.
import { getCurrentBusinessName } from '../lib/currentUser';

export function signCustomerMessage(body: string, senderName?: string | null): string {
  const sender = (senderName ?? getCurrentBusinessName())?.trim();
  if (!sender) return body;
  if (body.trimEnd().endsWith(sender)) return body;
  return `${body.trimEnd()}\n${sender}`;
}
