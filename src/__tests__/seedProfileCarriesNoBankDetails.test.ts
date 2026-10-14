/**
 * The Dutch seed profile is the INITIAL business profile of every dev/demo
 * build, and the hydrate merges a real account's saved profile OVER it
 * (`{ ...prev, ...saved }`). A field the seed carries that the account has not
 * saved yet therefore survives into the real account — an IBAN would be printed
 * on that contractor's invoices as where to pay.
 *
 * The store screenshots need an IBAN on the invoice's payment card, so it is
 * there in SCREENSHOT_MODE builds only (2026-10-14).
 */
describe('the seed profile carries no bank details outside a screenshot build', () => {
  const original = process.env.EXPO_PUBLIC_SCREENSHOT_MODE;
  afterEach(() => {
    if (original === undefined) delete process.env.EXPO_PUBLIC_SCREENSHOT_MODE;
    else process.env.EXPO_PUBLIC_SCREENSHOT_MODE = original;
  });

  const load = (screenshot: boolean) => {
    if (screenshot) process.env.EXPO_PUBLIC_SCREENSHOT_MODE = 'true';
    else delete process.env.EXPO_PUBLIC_SCREENSHOT_MODE;
    let profile: { iban?: string } | undefined;
    jest.isolateModules(() => {
      profile = require('../data/mockBusiness').businessProfile;
    });
    return profile!;
  };

  it('has no IBAN in a normal build', () => {
    expect(load(false).iban).toBeUndefined();
  });

  it('has one in a screenshot build, so the payment card is filled', () => {
    expect(load(true).iban).toMatch(/^NL\d{2}/);
  });
});
