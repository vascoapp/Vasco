// Where the app can be installed. ONE place: every "Join the beta" button on
// the homepages reads this. Flip `live` the day a store actually serves the
// app to the public — before that the public link is a dead end (App Store:
// not approved; Play: internal testing only), so a button pointing at it
// would promise a download that does not exist. While neither is live the
// buttons fall back to the beta email.
//
// ⚠️ Flipping `live` also makes the "not in the App Store or Google Play yet"
// copy false — marketingContent.test fails until that copy changes with it.

export type Store = "ios" | "android";

export const STORES: Record<Store, { live: boolean; url: string }> = {
  ios: { live: false, url: "https://apps.apple.com/app/id6770312723" },
  android: { live: false, url: "https://play.google.com/store/apps/details?id=com.vascobuild.app" },
};

export const BETA_MAILTO = "mailto:hello@vascobuild.com?subject=Vasco%20waitlist";

export const anyStoreLive = (): boolean => STORES.ios.live || STORES.android.live;

/** A single button (nav, plan cards): the store section when a store is live, else the beta email. */
export const primaryCtaHref = (): string => (anyStoreLive() ? "#download" : BETA_MAILTO);
