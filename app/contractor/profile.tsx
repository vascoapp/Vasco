// =============================================================================
// PROFIEL - Contractor Profile & Settings Page
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Share, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import i18n from '../../src/i18n/i18n';
import { Palette, SemanticColors } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useAuth } from '../../src/context/AuthContext';
import { isDemoMode } from '../../src/context/AuthContext';
import { useAppState } from '../../src/state/AppState';
import { DKLabel } from '../../src/components/shared/DKLabel';
import {
  loadSubscription,
  TIERS,
  type SubscriptionState,
  type SubscriptionTier,
  type BillingCycle,
} from '../../src/services/subscriptionService';
import { startBillingPortal, startSubscriptionCheckout } from '../../src/services/billingService';
import { exportAllData } from '../../src/services/dataExportService';
import { useCreditsSummary } from '../../src/services/subscriptionCreditsService';
import {
  loadQuoteTonePreset,
  saveQuoteTonePreset,
  type QuoteTone,
} from '../../src/services/sowGeneratorService';

const LANG_OPTIONS = [
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
];

type IconName = keyof typeof Ionicons.glyphMap;

// Country-specific registration label
const getRegistrationLabel = (country?: string) => {
  switch (country) {
    case 'NL': return 'KvK';
    case 'DE': return 'Handelsregister';
    case 'FR': return 'SIRET';
    case 'ES': return 'NIF';
    case 'IT': return 'Partita IVA';
    case 'UK': return 'Companies House';
    default: return 'Registration';
  }
};

// Integration status
interface IntegrationItem {
  id: string;
  name: string;
  icon: IconName;
  connected: boolean;
  route?: string;
}


// The TIERS table in subscriptionService carries English name/tagline strings.
// Full translations already existed under onboarding.plan*Desc — they were just
// never wired up, so a Dutch contractor saw "Full AI power — Vasco pays for
// itself" on their subscription card. Map tier -> existing locale key.
const TIER_NAME_KEY: Record<string, string> = {
  free: 'onboarding.planFree', pro: 'onboarding.planPro', contractor: 'onboarding.planContractor',
};
const TIER_DESC_KEY: Record<string, string> = {
  free: 'onboarding.planFreeDesc', pro: 'onboarding.planProDesc', contractor: 'onboarding.planContractorDesc',
};

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, updateUser, logout } = useAuth();
  const { jobs, customers, invoices, businessProfile, moneybirdConnected, mollieConnected } = useAppState();
  const currentLang = LANG_OPTIONS.find(l => l.code === i18n.language) ?? LANG_OPTIONS[0];

  const [subscription, setSubscription] = useState<SubscriptionState | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual');
  const [checkoutLoading, setCheckoutLoading] = useState<SubscriptionTier | null>(null);
  // R62: tone preset for quote SOW generator. Cold-start is 'friendly'
  // until the contractor picks otherwise; persisted on business_settings.
  const [quoteTone, setQuoteTone] = useState<QuoteTone>('friendly');

  // R18.1: surface available credits (months of free subscription earned via
  // R8.3 referral activations) above the tier cards. Was visible only on
  // /contractor/referrals — a contractor with credits going to upgrade had
  // no way to know their charge would be offset.
  const { summary: credits } = useCreditsSummary(user?.id ?? null);

  useEffect(() => {
    let active = true;
    loadSubscription().then(s => { if (active) setSubscription(s); });
    loadQuoteTonePreset().then(t => { if (active) setQuoteTone(t); });
    return () => { active = false; };
  }, []);

  const handleUpgrade = async (tier: SubscriptionTier) => {
    if (tier === 'free') return;
    if (isDemoMode) {
      Alert.alert(
        t('profile.demoMode', 'Demo mode'),
        t('profile.demoUpgradeBlocked', 'Upgrades are disabled in demo mode. Sign up for a real account to subscribe.'),
      );
      return;
    }
    setCheckoutLoading(tier);
    try {
      const result = await startSubscriptionCheckout(tier, billingCycle === 'annual' ? 'yearly' : 'monthly');
      if (!result.ok) {
        Alert.alert(
          t('profile.upgradeError', 'Could not start upgrade'),
          result.error ?? t('profile.upgradeErrorDesc', 'Please try again or contact support.'),
        );
      } else {
        const fresh = await loadSubscription();
        setSubscription(fresh);
      }
    } finally {
      setCheckoutLoading(null);
    }
  };

  // Opens the Stripe Customer Portal so the contractor can change plan, update
  // card, cancel, or download past invoices. Single autonomous reach to the
  // service; surface errors as Alert.
  const [portalLoading, setPortalLoading] = useState(false);
  const handleManageSubscription = async () => {
    if (isDemoMode) {
      Alert.alert(
        t('profile.demoMode', 'Demo mode'),
        t('profile.demoUpgradeBlocked', 'Upgrades are disabled in demo mode. Sign up for a real account to subscribe.'),
      );
      return;
    }
    setPortalLoading(true);
    try {
      const result = await startBillingPortal();
      if (!result.ok) {
        Alert.alert(
          t('profile.manageSubError', 'Could not open billing portal'),
          result.error ?? t('profile.upgradeErrorDesc', 'Please try again or contact support.'),
        );
      }
    } finally {
      setPortalLoading(false);
    }
  };

  // Contractor Score
  const contractorScore = useMemo(() => {
    const totalJobs = jobs.length;
    const completedJobs = jobs.filter((j: any) => j.status === 'completed' || j.status === 'gereed').length;
    const completionRate = totalJobs > 0 ? completedJobs / totalJobs : 0;
    const onTimeJobs = jobs.filter((j: any) => {
      if (j.status !== 'completed' && j.status !== 'gereed') return false;
      if (!j.completedAt || !j.endDate) return true;
      return new Date(j.completedAt) <= new Date(j.endDate);
    }).length;
    // null, not 1. `: 1` meant "no completed jobs = perfectly on time", and
    // since onTimeRate carries 35 of the 100 score points, a brand-new
    // contractor with zero jobs was shown "Aannemer Score 35/100" and
    // "Op-tijd percentage 100%" — both derived entirely from that placeholder.
    const onTimeRate = completedJobs > 0 ? onTimeJobs / completedJobs : null;
    const customerJobCount = new Map<string, number>();
    jobs.forEach((j: any) => {
      if (j.customerId) customerJobCount.set(j.customerId, (customerJobCount.get(j.customerId) ?? 0) + 1);
    });
    const repeatCustomers = Array.from(customerJobCount.values()).filter(c => c >= 2).length;
    const totalCustomersWithJobs = customerJobCount.size;
    const repeatRate = totalCustomersWithJobs > 0 ? repeatCustomers / totalCustomersWithJobs : null;
    // A score needs finished work to describe. With none, there is no
    // performance record yet — the screen says so instead of inventing one.
    const score = completedJobs > 0
      ? Math.round(completionRate * 40 + (onTimeRate ?? 0) * 35 + (repeatRate ?? 0) * 25)
      : null;
    return {
      score: score === null ? null : Math.min(score, 100),
      completionRate: totalJobs > 0 ? Math.round(completionRate * 100) : null,
      onTimeRate: onTimeRate === null ? null : Math.round(onTimeRate * 100),
      repeatRate: repeatRate === null ? null : Math.round(repeatRate * 100),
    };
  }, [jobs]);

  const userName = user?.name || 'User';
  const userInitials = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const userTrade = user?.trade ? t(`onboarding.trades.${user.trade}`, user.trade) : t('profile.contractor', 'Contractor');
  const country = user?.country ?? 'NL';

  // R9.2: surface device-calendar sync state. Was only reachable via a one-time
  // prompt in schedule.tsx — users who tapped "later" lost the entry forever.
  const [calendarConnected, setCalendarConnected] = useState(false);
  useEffect(() => {
    let active = true;
    import('../../src/services/calendarSyncService')
      .then(({ getCalendarSyncSettings }) => getCalendarSyncSettings())
      .then(s => { if (active) setCalendarConnected(!!s.enabled && !!s.calendarId); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // Integrations
  // R110: country-aware. Pre-R110 a Texas HVAC contractor saw "Mollie"
  // and "Moneybird" listed as connectable integrations even though both
  // reject US bank accounts at OAuth time. Mollie is EU/UK only;
  // Moneybird is NL/DE only. US contractors see QuickBooks + Stripe;
  // EU contractors keep Mollie + Moneybird + Xero.
  const isUS = country === 'US';
  const integrations: IntegrationItem[] = isUS
    ? [
        { id: 'stripe', name: 'Stripe', icon: 'card', connected: false },
        { id: 'quickbooks', name: 'QuickBooks', icon: 'calculator', connected: false },
        { id: 'xero', name: 'Xero', icon: 'cloud', connected: false },
        { id: 'calendar', name: t('profile.deviceCalendar', 'Device calendar'), icon: 'calendar', connected: calendarConnected, route: '/contractor/calendar-settings' },
      ]
    : [
        { id: 'mollie', name: 'Mollie', icon: 'card', connected: mollieConnected, route: '/(modals)/mollie' },
        { id: 'moneybird', name: 'Moneybird', icon: 'calculator', connected: moneybirdConnected, route: '/(modals)/moneybird' },
        { id: 'xero', name: 'Xero', icon: 'cloud', connected: false },
        { id: 'stripe', name: 'Stripe', icon: 'card-outline', connected: false },
        { id: 'calendar', name: t('profile.deviceCalendar', 'Device calendar'), icon: 'calendar', connected: calendarConnected, route: '/contractor/calendar-settings' },
      ];

  // R62: tone preset picker. Backed by `business_settings.quote_tone`
  // (column added in 20260505000001_sow_columns.sql). Saves on each pick;
  // failure-soft so a Supabase miss leaves the local pick visible until
  // next refresh.
  const handleQuoteToneSwitch = () => {
    const tones: { value: QuoteTone; label: string; subtitle: string }[] = [
      {
        value: 'friendly',
        label: t('profile.quoteToneFriendly', 'Friendly'),
        subtitle: t('profile.quoteToneFriendlyDesc', 'Warm, plain language. First-name basis.'),
      },
      {
        value: 'formal',
        label: t('profile.quoteToneFormal', 'Formal'),
        subtitle: t('profile.quoteToneFormalDesc', 'Precise, no contractions. Full names.'),
      },
      {
        value: 'detailed',
        label: t('profile.quoteToneDetailed', 'Detailed'),
        subtitle: t('profile.quoteToneDetailedDesc', 'Lists every assumption and step.'),
      },
      {
        value: 'concise',
        label: t('profile.quoteToneConcise', 'Concise'),
        subtitle: t('profile.quoteToneConciseDesc', 'Tight prose. No filler.'),
      },
    ];
    Alert.alert(
      t('profile.quoteTone', 'Quote tone'),
      t('profile.quoteToneDesc', 'How AI-generated scope text should sound.'),
      [
        ...tones.map(opt => ({
          text: `${opt.label} — ${opt.subtitle}`,
          onPress: () => {
            setQuoteTone(opt.value);
            saveQuoteTonePreset(opt.value).catch(() => {});
          },
        })),
        { text: t('common.cancel', 'Cancel'), style: 'cancel' as const },
      ],
    );
  };

  const handleLanguageSwitch = () => {
    Alert.alert(
      t('profile.language', 'Language'),
      undefined,
      LANG_OPTIONS.map(lang => ({
        text: `${lang.flag} ${lang.label}`,
        onPress: () => {
          i18n.changeLanguage(lang.code);
          updateUser({ language: lang.code as any });
        },
      })),
    );
  };

  const handleLogout = () => {
    Alert.alert(t('profile.logout', 'Logout'), t('common.confirm', 'Are you sure?'), [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      { text: t('profile.logout', 'Logout'), style: 'destructive', onPress: () => { logout(); router.replace('/login'); } },
    ]);
  };

  const [exporting, setExporting] = useState(false);

  const handleExportData = async () => {
    // GDPR Art. 20: ship the actual records, not a summary with counts.
    // exportAllData merges the local cache with the user's Supabase rows.
    if (exporting) return;
    setExporting(true);
    try {
      const result = await exportAllData('json', {
        userId: user?.id,
        email: user?.email,
      });
      if (!result.success) {
        Alert.alert(
          t('profile.exportFailed', 'Export failed'),
          t('profile.exportFailedDesc', 'Could not build your data export. Please try again, or contact privacy@vascobuild.com.'),
        );
      }
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('profile.deleteAccount', 'Delete my account'),
      t('profile.deleteAccountWarning', 'This will permanently delete your account and all data. Financial records will be anonymized per EU retention law. This cannot be undone.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('profile.deleteConfirm', 'Delete permanently'),
          style: 'destructive',
          onPress: async () => {
            // GDPR Art. 17: persist the deletion request so the backend worker
            // erases the user's data within 30 days. If the insert fails we
            // must NOT claim deletion was scheduled.
            let submitted = true;
            try {
              const { supabase, isSupabaseConfigured } = await import('../../src/lib/supabase');
              if (isSupabaseConfigured) {
                const { data: { user: authUser } } = await supabase.auth.getUser();
                if (authUser) {
                  const { error: insErr } = await (supabase.from('account_deletion_requests' as any) as any)
                    .insert({ user_id: authUser.id, status: 'pending' });
                  if (insErr) {
                    submitted = false;
                  } else {
                    // R66 round 41: fire-and-forget drain immediately so the
                    // request processes within seconds (instead of waiting
                    // for the daily cron). Same pattern as accountDeletionService.
                    try { supabase.functions.invoke('drain-account-deletions', { body: {} }).catch(() => {}); } catch {}
                  }
                } else {
                  submitted = false;
                }
              }
              // Demo mode: no backend to call; local logout clears AsyncStorage.
            } catch {
              submitted = false;
            }
            if (!submitted) {
              Alert.alert(
                t('profile.deletionFailed', 'Could not submit request'),
                t('profile.deletionFailedDesc', 'Your request did not reach our servers. Check your internet and try again, or contact support.'),
              );
              return;
            }
            Alert.alert(
              t('profile.deletionScheduled', 'Account deletion requested'),
              t('profile.deletionScheduledDesc', 'Your data will be removed within 30 days. You will receive a confirmation email.'),
              [{ text: t('common.ok', 'OK'), onPress: () => { logout(); router.replace('/login'); } }],
            );
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('profile.title', 'Profile')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userInitials}</Text>
          </View>
          <Text style={styles.nameText}>{userName}</Text>
          <Text style={styles.roleText}>{userTrade}</Text>
        </View>

        {/* Contractor Score */}
        <View style={styles.sectionWrap}>
          <DKLabel style={styles.sectionLabel}>{t('profile.performance', 'PERFORMANCE')}</DKLabel>
          <View style={styles.card}>
            <View style={styles.scoreHeader}>
              <Ionicons name="trophy" size={20} color={Palette.hermesOrange} />
              <Text style={styles.scoreTitle}>{t('profile.contractorScore', 'Contractor Score')}</Text>
              <Text style={styles.scoreValue}>
                {contractorScore.score === null ? '—' : `${contractorScore.score}/100`}
              </Text>
            </View>
            <View style={styles.scoreBreakdown}>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreMetricLabel}>{t('profile.completionRate', 'Completion rate')}</Text>
                <Text style={styles.scoreMetric}>{contractorScore.completionRate === null ? '—' : `${contractorScore.completionRate}%`}</Text>
              </View>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreMetricLabel}>{t('profile.onTimeRate', 'On-time rate')}</Text>
                <Text style={styles.scoreMetric}>{contractorScore.onTimeRate === null ? '—' : `${contractorScore.onTimeRate}%`}</Text>
              </View>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreMetricLabel}>{t('profile.repeatCustomers', 'Repeat customers')}</Text>
                <Text style={styles.scoreMetric}>{contractorScore.repeatRate === null ? '—' : `${contractorScore.repeatRate}%`}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Plan Section — R8.2: was the missing upgrade UI for every tier-gate prompt */}
        {subscription && (
          <View style={styles.sectionWrap}>
            <DKLabel style={styles.sectionLabel}>{t('profile.plan', 'PLAN')}</DKLabel>
            <View style={styles.card}>
              <View style={styles.planCurrentRow}>
                <View style={styles.rowIcon}>
                  <Ionicons name="star" size={18} color={Palette.hermesOrange} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{t(TIER_NAME_KEY[subscription.tier] ?? '', TIERS[subscription.tier].name)}</Text>
                  <Text style={styles.planTagline}>{t(TIER_DESC_KEY[subscription.tier] ?? '', TIERS[subscription.tier].tagline)}</Text>
                </View>
                {subscription.tier === 'free' ? (
                  <View style={styles.freeBadge}>
                    <Text style={styles.freeBadgeText}>{t('profile.planFreeBadge', 'FREE')}</Text>
                  </View>
                ) : (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>{t('profile.planActive', 'ACTIVE')}</Text>
                  </View>
                )}
              </View>

              {subscription.tier !== 'free' && Platform.OS !== 'ios' && (
                <Pressable
                  style={styles.manageSubRow}
                  onPress={handleManageSubscription}
                  disabled={portalLoading}
                  accessibilityRole="button"
                  accessibilityLabel={t('profile.manageSubscription', 'Manage subscription')}
                >
                  <View style={styles.rowIcon}>
                    <Ionicons name="card" size={18} color={Palette.hermesOrange} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>
                      {portalLoading
                        ? t('profile.opening', 'Opening checkout…')
                        : t('profile.manageSubscription', 'Manage subscription')}
                    </Text>
                    <Text style={styles.planTagline}>
                      {t('profile.manageSubDesc', 'Update card, change plan, or cancel')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={SemanticColors.textTertiary} />
                </Pressable>
              )}

              {/* iOS: no in-app purchase or external-checkout link-out (App Store
                  guideline 3.1.1). Subscriptions are sold on the web; show a
                  non-interactive note instead of a tappable purchase link. */}
                {Platform.OS === 'ios' && (
                <View style={styles.iosBillingNote}>
                  <Ionicons name="globe-outline" size={16} color={SemanticColors.textTertiary} />
                  <Text style={styles.iosBillingNoteText}>
                    {subscription.tier === 'free'
                      ? t('profile.iosBillingNoteFree', 'Manage your plan and upgrade at vascobuild.com')
                      : t('profile.iosBillingNotePaid', 'Manage or cancel your subscription at vascobuild.com')}
                  </Text>
                </View>
              )}

              {subscription.tier !== 'contractor' && Platform.OS !== 'ios' && (
                <View style={styles.planUpgradeBlock}>
                  {/* R18.1: credits banner — visible when the contractor has
                      earned R8.3 referral credits. The actual offset happens
                      in the Stripe/Mollie webhook via redeemCredits, so this
                      is a "your charge will be reduced" promise. */}
                  {credits && credits.availableMonths > 0 && (
                    <View style={styles.creditsBanner}>
                      <Ionicons name="gift" size={16} color={Palette.hermesOrange} />
                      <Text style={styles.creditsBannerText}>
                        {t('profile.creditsAvailable', {
                          defaultValue: '{{count}} month(s) of free subscription ready — applied automatically at checkout.',
                          count: credits.availableMonths,
                        })}
                      </Text>
                    </View>
                  )}
                  <View style={styles.cycleToggle}>
                    <Pressable
                      style={[styles.cycleOption, billingCycle === 'monthly' && styles.cycleOptionActive]}
                      onPress={() => setBillingCycle('monthly')}
                    >
                      <Text style={[styles.cycleOptionText, billingCycle === 'monthly' && styles.cycleOptionTextActive]}>
                        {t('profile.billingMonthly', 'Monthly')}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.cycleOption, billingCycle === 'annual' && styles.cycleOptionActive]}
                      onPress={() => setBillingCycle('annual')}
                    >
                      <Text style={[styles.cycleOptionText, billingCycle === 'annual' && styles.cycleOptionTextActive]}>
                        {t('profile.billingAnnualSave', 'Annual · save')}
                      </Text>
                    </Pressable>
                  </View>

                  {(['pro', 'contractor'] as SubscriptionTier[])
                    .filter(t2 => t2 !== subscription.tier)
                    .filter(t2 => {
                      const order: SubscriptionTier[] = ['free', 'pro', 'contractor'];
                      return order.indexOf(t2) > order.indexOf(subscription.tier);
                    })
                    .map(t2 => {
                      const cfg = TIERS[t2];
                      const price = billingCycle === 'annual' ? cfg.annualMonthlyPrice : cfg.monthlyPrice;
                      const isPopular = t2 === 'pro';
                      return (
                        <Pressable
                          key={t2}
                          style={[styles.tierCard, isPopular && styles.tierCardPopular]}
                          onPress={() => handleUpgrade(t2)}
                          disabled={checkoutLoading !== null}
                        >
                          {isPopular && (
                            <View style={styles.popularBadge}>
                              <Text style={styles.popularBadgeText}>{t('profile.popular', 'MOST POPULAR')}</Text>
                            </View>
                          )}
                          <View style={styles.tierCardHeader}>
                            <Text style={styles.tierName}>{t(TIER_NAME_KEY[t2] ?? '', cfg.name)}</Text>
                            <Text style={styles.tierPrice}>
                              €{price}
                              <Text style={styles.tierPriceUnit}>/{t('profile.perMonth', 'mo')}</Text>
                            </Text>
                          </View>
                          <Text style={styles.tierTagline}>{t(TIER_DESC_KEY[t2] ?? '', cfg.tagline)}</Text>
                          <View style={styles.tierCta}>
                            <Text style={styles.tierCtaText}>
                              {checkoutLoading === t2
                                ? t('profile.opening', 'Opening checkout…')
                                : t('profile.upgradeTo', 'Upgrade to {{name}}', { name: cfg.name })}
                            </Text>
                            <Ionicons name="arrow-forward" size={16} color={Palette.white} />
                          </View>
                        </Pressable>
                      );
                    })}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Account Section */}
        <View style={styles.sectionWrap}>
          <DKLabel style={styles.sectionLabel}>{t('profile.account', 'ACCOUNT')}</DKLabel>
          <View style={styles.card}>
            <SettingsRow icon="person" label={t('profile.name', 'Name')} value={user?.name ?? ''} />
            <SettingsRow icon="mail" label={t('profile.email', 'Email')} value={user?.email ?? ''} border />
            <SettingsRow icon="business" label={t('profile.companyName', 'Company')} value={user?.company ?? ''} border />
            <SettingsRow icon="construct" label={t('profile.trade', 'Trade')} value={userTrade} border />
            <SettingsRow icon="flag" label={t('profile.country', 'Country')} value={country} border />
          </View>
        </View>

        {/* Business Section */}
        <View style={styles.sectionWrap}>
          <DKLabel style={styles.sectionLabel}>{t('profile.business', 'BUSINESS')}</DKLabel>
          <View style={styles.card}>
            <SettingsRow
              icon="document-text"
              label={getRegistrationLabel(country)}
              value={businessProfile.kvkNumber || businessProfile.registrationNumber || t('profile.notSet', 'Not set')}
              onPress={() => router.push('/(modals)/business-settings' as any)}
            />
            <SettingsRow
              icon="receipt"
              label={t('profile.vatNumber', 'VAT number')}
              value={businessProfile.vatNumber || t('profile.notSet', 'Not set')}
              border
              onPress={() => router.push('/(modals)/business-settings' as any)}
            />
            <SettingsRow
              icon="location"
              label={t('profile.address', 'Address')}
              value={businessProfile.address || t('profile.notSet', 'Not set')}
              border
              onPress={() => router.push('/(modals)/business-settings' as any)}
            />
            <SettingsRow
              icon="briefcase"
              label={t('profile.businessType', 'Business type')}
              value={businessProfile.businessType || t('profile.notSet', 'Not set')}
              border
              onPress={() => router.push('/(modals)/business-settings' as any)}
            />
            <SettingsRow
              icon="receipt-outline"
              label={t('profile.vatScheme', 'VAT scheme')}
              value={
                businessProfile.vatScheme === 'small_business_NL_KOR' ? 'KOR'
                : businessProfile.vatScheme === 'small_business_DE_kleinunternehmer' ? 'Kleinunternehmer'
                : t('profile.vatStandard', 'Standard')
              }
              border
              onPress={() => router.push('/contractor/vat-and-audit' as any)}
            />
            <SettingsRow
              icon="shield-checkmark-outline"
              label={t('profile.auditTrail', 'Audit trail')}
              // GoBD is a German standard — naming it to a Dutch/French/… user is
              // confusing. The mechanism (hash-chained immutable log) IS GoBD-style,
              // so keep the strong "GoBD-conform" claim for DE and show a neutral,
              // plain-language description everywhere else.
              value={country === 'DE'
                ? t('profile.auditTrailValueGobd', 'GoBD-compliant')
                : t('profile.auditTrailValue', 'Tamper-proof')}
              border
              onPress={() => router.push('/contractor/vat-and-audit' as any)}
            />
            {/* R62: quote-tone preset for the SOW generator (Package D). */}
            <SettingsRow
              icon="create-outline"
              label={t('profile.quoteTone', 'Quote tone')}
              value={
                quoteTone === 'formal' ? t('profile.quoteToneFormal', 'Formal')
                : quoteTone === 'detailed' ? t('profile.quoteToneDetailed', 'Detailed')
                : quoteTone === 'concise' ? t('profile.quoteToneConcise', 'Concise')
                : t('profile.quoteToneFriendly', 'Friendly')
              }
              border
              onPress={handleQuoteToneSwitch}
            />
            {/* R267: maintenance contracts moved to Werk tab → New job → "Recurring contract" */}
          </View>
        </View>

        {/* Integrations */}
        <View style={styles.sectionWrap}>
          <DKLabel style={styles.sectionLabel}>{t('profile.integrations', 'INTEGRATIONS')}</DKLabel>
          <View style={styles.card}>
            {integrations.map((item, idx) => (
              <Pressable
                key={item.id}
                style={[styles.row, idx > 0 && styles.rowBorder]}
                onPress={() => {
                  if (item.route) router.push(item.route as any);
                  else Alert.alert(item.name, t('profile.comingSoon', 'Coming soon'));
                }}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name={item.icon} size={18} color={Palette.hermesOrange} />
                </View>
                <Text style={styles.rowLabel}>{item.name}</Text>
                <View style={[styles.statusBadge, item.connected ? styles.statusConnected : styles.statusDisconnected]}>
                  <View style={[styles.statusDot, { backgroundColor: item.connected ? SemanticColors.feedbackSuccess : SemanticColors.textTertiary }]} />
                  <Text style={[styles.statusText, { color: item.connected ? SemanticColors.feedbackSuccess : SemanticColors.textTertiary }]}>
                    {item.connected ? t('profile.connected', 'Connected') : t('profile.notConnected', 'Not connected')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Settings */}
        <View style={styles.sectionWrap}>
          <DKLabel style={styles.sectionLabel}>{t('profile.settings', 'SETTINGS')}</DKLabel>
          <View style={styles.card}>
            <Pressable testID="profile-language-row" style={styles.row} onPress={handleLanguageSwitch}>
              <View style={styles.rowIcon}>
                <Ionicons name="language" size={18} color={Palette.hermesOrange} />
              </View>
              <Text style={styles.rowLabel}>{t('profile.language', 'Language')}</Text>
              <Text style={styles.rowValue}>{currentLang.flag} {currentLang.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
            </Pressable>
            <Pressable
              style={[styles.row, styles.rowBorder]}
              onPress={() => router.push('/contractor/notifications' as any)}
            >
              <View style={styles.rowIcon}>
                <Ionicons name="notifications" size={18} color={Palette.hermesOrange} />
              </View>
              <Text style={styles.rowLabel}>{t('profile.notifications', 'Notifications')}</Text>
              <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
            </Pressable>
            <Pressable
              style={[styles.row, styles.rowBorder]}
              onPress={() => router.push('/contractor/legal' as any)}
            >
              <View style={styles.rowIcon}>
                <Ionicons name="shield-checkmark" size={18} color={Palette.hermesOrange} />
              </View>
              <Text style={styles.rowLabel}>{t('profile.privacyTerms', 'Privacy & terms')}</Text>
              <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
            </Pressable>
            {/* R229: referrals entry */}
            <Pressable
              style={[styles.row, styles.rowBorder]}
              onPress={() => router.push('/contractor/referrals' as any)}
            >
              <View style={styles.rowIcon}>
                <Ionicons name="people" size={18} color={Palette.hermesOrange} />
              </View>
              <Text style={styles.rowLabel}>{t('referrals.entryLabel', 'Invite contractors')}</Text>
              <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
            </Pressable>
          </View>
        </View>

        {/* Data & Privacy */}
        <View style={styles.sectionWrap}>
          <DKLabel style={styles.sectionLabel}>{t('profile.dataPrivacy', 'DATA & PRIVACY')}</DKLabel>
          <View style={styles.card}>
            <Pressable style={styles.row} onPress={handleExportData}>
              <View style={styles.rowIcon}>
                <Ionicons name="download-outline" size={18} color={Palette.hermesOrange} />
              </View>
              <Text style={styles.rowLabel}>{t('profile.exportData', 'Export my data')}</Text>
              <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
            </Pressable>
            <Pressable style={[styles.row, styles.rowBorder]} onPress={handleDeleteAccount}>
              <View style={[styles.rowIcon, { backgroundColor: SemanticColors.feedbackError + '0C' }]}>
                <Ionicons name="trash-outline" size={18} color={SemanticColors.feedbackError} />
              </View>
              <Text style={[styles.rowLabel, { color: SemanticColors.feedbackError }]}>{t('profile.deleteAccount', 'Delete my account')}</Text>
              <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
            </Pressable>
          </View>
        </View>

        {/* Logout */}
        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color={SemanticColors.feedbackError} />
          <Text style={styles.logoutText}>{t('profile.logout', 'Logout')}</Text>
        </Pressable>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.versionText}>Vasco v1.0.0</Text>
          {isDemoMode && (
            <View style={styles.demoBadge}>
              <Ionicons name="flask" size={12} color={Palette.hermesOrange} />
              <Text style={styles.demoText}>{t('profile.demoMode', 'Demo mode')}</Text>
            </View>
          )}
        </View>

        {/* GDPR Retention Notice */}
        <View style={styles.retentionNotice}>
          <Ionicons name="shield-checkmark-outline" size={14} color={SemanticColors.textTertiary} />
          <Text style={styles.retentionText}>
            {t('profile.retentionNotice', 'Retention: Invoices 7 years · Contracts 7 years · Customer data 2 years · Personnel data 5 years')}
          </Text>
        </View>

        <View style={{ height: 140 }} />
      </ScrollView>
    </View>
  );
}

// Reusable row component
function SettingsRow({
  icon,
  label,
  value,
  border,
  onPress,
}: {
  icon: IconName;
  label: string;
  value?: string;
  border?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable style={[styles.row, border && styles.rowBorder]} onPress={onPress} disabled={!onPress}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={Palette.hermesOrange} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SafeArea.side,
    paddingTop: SafeArea.top,
    paddingBottom: GRID.sm + 4,
  },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: SafeArea.side, gap: GRID.lg - 4 },
  avatarSection: { alignItems: 'center', paddingVertical: Spacing.lg },
  avatar: {
    width: 72, height: 72, borderRadius: RADIUS.full + 8,
    backgroundColor: Palette.hermesOrange, alignItems: 'center', justifyContent: 'center',
    shadowColor: Palette.hermesOrange,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 6,
  },
  avatarText: { fontSize: TYPE.displaySize - 4, fontFamily: TYPE.displayFamily, color: Palette.white },
  nameText: { fontSize: TYPE.sectionSize + 2, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary, marginTop: GRID.sm + 4 },
  roleText: { fontSize: TYPE.captionSize, color: SemanticColors.textTertiary, marginTop: GRID.xs },
  sectionWrap: { gap: GRID.sm },
  sectionLabel: { fontSize: TYPE.labelSize, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textTertiary, letterSpacing: 0.8, paddingHorizontal: GRID.xs },
  card: {
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: GRID.sm + 4 },
  rowBorder: { borderTopWidth: 1, borderTopColor: SemanticColors.borderDefault },
  rowIcon: {
    width: 32, height: 32, borderRadius: RADIUS.md,
    backgroundColor: Palette.hermesOrange + '0C', alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textPrimary },
  rowValue: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textTertiary, marginRight: GRID.xs, maxWidth: 180 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.xs,
    paddingHorizontal: GRID.sm, paddingVertical: GRID.xs,
    borderRadius: RADIUS.sm,
  },
  statusConnected: { backgroundColor: SemanticColors.feedbackSuccess + '10' },
  statusDisconnected: { backgroundColor: SemanticColors.surfaceSecondary },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: TYPE.tinySize, fontFamily: TYPE.tinyFamily },
  scoreHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10,
    borderBottomWidth: 1, borderBottomColor: SemanticColors.borderDefault,
  },
  scoreTitle: { flex: 1, fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  scoreValue: { fontSize: TYPE.titleSize, fontFamily: 'Archivo_800ExtraBold', color: Palette.hermesOrange },
  scoreBreakdown: { paddingHorizontal: 14, paddingVertical: 10, gap: GRID.sm },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreMetricLabel: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary },
  scoreMetric: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: GRID.sm,
    paddingVertical: 14, backgroundColor: SemanticColors.feedbackErrorBg, borderRadius: RADIUS.md,
  },
  logoutText: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.feedbackError },
  appInfo: { alignItems: 'center', gap: GRID.sm, marginTop: GRID.xs },
  versionText: { fontSize: TYPE.labelSize, fontFamily: TYPE.labelFamily, color: SemanticColors.textTertiary },
  demoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.xs,
    paddingHorizontal: GRID.sm, paddingVertical: GRID.xs,
    backgroundColor: Palette.hermesOrange + '10', borderRadius: RADIUS.sm,
  },
  demoText: { fontSize: TYPE.tinySize, fontFamily: TYPE.tinyFamily, color: Palette.hermesOrange },
  retentionNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: GRID.sm,
    paddingHorizontal: GRID.xs,
  },
  retentionText: {
    flex: 1,
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.tinyFamily,
    color: SemanticColors.textTertiary,
    lineHeight: 16,
  },
  planCurrentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: GRID.sm + 4,
  },
  manageSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: GRID.sm + 4,
    gap: GRID.sm + 4,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  planTagline: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.tinyFamily,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  freeBadge: {
    paddingHorizontal: GRID.sm,
    paddingVertical: GRID.xs,
    borderRadius: RADIUS.sm,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  freeBadgeText: {
    fontSize: TYPE.tinySize,
    fontFamily: 'Archivo_800ExtraBold',
    color: SemanticColors.textTertiary,
    letterSpacing: 0.8,
  },
  activeBadge: {
    paddingHorizontal: GRID.sm,
    paddingVertical: GRID.xs,
    borderRadius: RADIUS.sm,
    backgroundColor: SemanticColors.feedbackSuccess + '15',
  },
  activeBadgeText: {
    fontSize: TYPE.tinySize,
    fontFamily: 'Archivo_800ExtraBold',
    color: SemanticColors.feedbackSuccess,
    letterSpacing: 0.8,
  },
  creditsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    backgroundColor: Palette.hermesOrange + '14',
    borderWidth: 1,
    borderColor: Palette.hermesOrange + '40',
    borderRadius: RADIUS.md,
    paddingVertical: GRID.sm,
    paddingHorizontal: GRID.md,
  },
  creditsBannerText: {
    flex: 1,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textPrimary,
    lineHeight: 18,
  },
  planUpgradeBlock: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: GRID.sm,
    gap: GRID.sm + 4,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  iosBillingNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: GRID.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  iosBillingNoteText: {
    flex: 1,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
    lineHeight: 18,
  },
  cycleToggle: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: 3,
  },
  cycleOption: {
    flex: 1,
    paddingVertical: GRID.sm,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
  },
  cycleOptionActive: {
    backgroundColor: SemanticColors.surfacePrimary,
  },
  cycleOptionText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
  },
  cycleOptionTextActive: {
    color: SemanticColors.textPrimary,
    fontFamily: TYPE.titleFamily,
  },
  tierCard: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.lg,
    padding: 14,
    gap: GRID.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  tierCardPopular: {
    borderColor: Palette.hermesOrange,
    shadowColor: Palette.hermesOrange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    right: 14,
    paddingHorizontal: GRID.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    backgroundColor: Palette.hermesOrange,
  },
  popularBadgeText: {
    fontSize: TYPE.tinySize - 1,
    fontFamily: 'Archivo_900Black',
    color: Palette.white,
    letterSpacing: 1,
  },
  tierCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  tierName: {
    fontSize: TYPE.titleSize,
    fontFamily: 'Archivo_800ExtraBold',
    color: SemanticColors.textPrimary,
  },
  tierPrice: {
    fontSize: TYPE.titleSize + 2,
    fontFamily: 'Archivo_900Black',
    color: SemanticColors.textPrimary,
  },
  tierPriceUnit: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
  },
  tierTagline: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textSecondary,
  },
  tierCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.sm,
    paddingVertical: GRID.sm + 2,
    backgroundColor: Palette.hermesOrange,
    borderRadius: RADIUS.md,
    marginTop: GRID.xs,
  },
  tierCtaText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: Palette.white,
  },
});
