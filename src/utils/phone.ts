// Phone numbers for wa.me links — the ONE normaliser (moved from
// workflowPackService so whatsappService and the screens share it).
// R66r49 #6 (WhatsApp deep-link): country → E.164 country code. wa.me
// expects digits-only including country code, so a NL contractor's
// customer with phone "06 12345678" becomes "31612345678".
const COUNTRY_DIAL: Record<string, string> = {
  UK: '44', NL: '31', DE: '49', FR: '33', ES: '34', IT: '39',
};

export function toE164(phone: string | undefined, contractorCountry?: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D+/g, '');
  if (!digits) return null;
  // Written with + or 00: already international, whatever the contractor's
  // country — an Italian contractor's Dutch customer (+31…) must not become
  // +39 31…, and a short +49 89 12345 must not get a second 49 (review
  // 2026-09-24).
  if (phone.trim().startsWith('+')) return digits;
  if (digits.startsWith('00')) return digits.slice(2);               // 0031… → 31…
  // Unknown country: a national number cannot be dialled — it used to be
  // read as DUTCH, so a German customer's 0151… became +31 151… (sweep
  // 2026-09-23, D3). Length cannot tell: a German national number is 12 digits.
  const dial = contractorCountry ? COUNTRY_DIAL[contractorCountry] : undefined;
  if (!dial) return null;
  // Typed without + but with the country code (long enough to be one).
  if (digits.startsWith(dial) && digits.length > 10) return digits;
  // Italian numbers KEEP their leading 0 after +39 (Rome is +39 06…).
  if (contractorCountry === 'IT') return dial + digits;
  if (digits.startsWith('0')) return dial + digits.slice(1);          // 0612… → 3161…
  return digits.length <= 10 ? dial + digits : digits;
}

