// =============================================================================
// ONBOARDING — Cal AI-style 14-step progressive onboarding
// =============================================================================
// Steps: Welcome → Language → Country → Trade → Goals → Challenges → Team Size
//        → Business Type → Registration → Certifications → Service Area
//        → AI Demo → Plan Selection → Review
// =============================================================================

import { useState, useCallback } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import i18n from '../src/i18n/i18n';
import { useAuth, type Country, type Language } from '../src/context/AuthContext';
import { SemanticColors, Palette } from '../src/theme/colors';
import { SafeArea, Spacing } from '../src/theme/spacing';
import { getDefaultLanguage } from '../src/i18n/formatting';
import { getPaymentDisplayForCountry, getPaymentBrandColor } from '../src/config/paymentMethods';
import { FadeIn } from '../src/components/shared/FadeIn';
import { GradientButton } from '../src/components/shared/GradientButton';
import { hapticSuccess } from '../src/utils/haptics';
import { GRID, RADIUS, TYPE } from '../src/theme/tabStyles';
import { TIERS, type SubscriptionTier } from '../src/services/subscriptionService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TOTAL_STEPS = 14;

const TRADES = ['plumbing', 'electrical', 'gas', 'painting', 'carpentry', 'roofing', 'tiling', 'plastering', 'flooring', 'insulation', 'solar', 'glazing', 'landscaping', 'general', 'other'] as const;

const GOALS = ['more_jobs', 'faster_payments', 'less_admin', 'grow_team', 'stay_compliant', 'better_quotes'] as const;
const CHALLENGES = ['quoting', 'invoicing', 'scheduling', 'compliance', 'finding_work', 'paperwork'] as const;

const GOAL_ICONS: Record<string, string> = {
  more_jobs: 'briefcase',
  faster_payments: 'cash',
  less_admin: 'time',
  grow_team: 'people',
  stay_compliant: 'shield-checkmark',
  better_quotes: 'document-text',
};

const CHALLENGE_ICONS: Record<string, string> = {
  quoting: 'document-text',
  invoicing: 'receipt',
  scheduling: 'calendar',
  compliance: 'shield',
  finding_work: 'search',
  paperwork: 'documents',
};

const TEAM_SIZES = [
  { key: 'solo', icon: 'person' },
  { key: 'small', icon: 'people' },
  { key: 'medium', icon: 'people-circle' },
  { key: 'large', icon: 'business' },
] as const;

const BUSINESS_TYPES: Record<Country, { key: string; label: string }[]> = {
  NL: [
    { key: 'eenmanszaak', label: 'Eenmanszaak' },
    { key: 'vof', label: 'VOF' },
    { key: 'bv', label: 'BV' },
  ],
  UK: [
    { key: 'soleTrader', label: 'Sole Trader' },
    { key: 'partnership', label: 'Partnership' },
    { key: 'limited', label: 'Ltd' },
  ],
  DE: [
    { key: 'einzelunternehmen', label: 'Einzelunternehmen' },
    { key: 'gbr', label: 'GbR' },
    { key: 'gmbh', label: 'GmbH' },
  ],
  FR: [
    { key: 'autoEntrepreneur', label: 'Auto-entrepreneur' },
    { key: 'eirl', label: 'EIRL' },
    { key: 'sarl', label: 'SARL' },
  ],
  ES: [
    { key: 'autonomo', label: 'Autónomo' },
    { key: 'sl', label: 'S.L.' },
    { key: 'sa', label: 'S.A.' },
  ],
  IT: [
    { key: 'dittaIndividuale', label: 'Ditta individuale' },
    { key: 'srl', label: 'S.r.l.' },
    { key: 'snc', label: 'S.n.c.' },
  ],
};

const REG_FIELDS: Record<Country, { key: string; i18nKey: string }[]> = {
  NL: [
    { key: 'kvk', i18nKey: 'onboarding.fields.kvk' },
    { key: 'btw', i18nKey: 'onboarding.fields.btw' },
  ],
  UK: [
    { key: 'companiesHouse', i18nKey: 'onboarding.fields.companiesHouse' },
    { key: 'vatNumber', i18nKey: 'onboarding.fields.vatNumber' },
    { key: 'paye', i18nKey: 'onboarding.fields.paye' },
  ],
  DE: [
    { key: 'handelsregister', i18nKey: 'onboarding.fields.handelsregister' },
    { key: 'ustId', i18nKey: 'onboarding.fields.ustId' },
    { key: 'steuernummer', i18nKey: 'onboarding.fields.steuernummer' },
  ],
  FR: [
    { key: 'siret', i18nKey: 'onboarding.fields.siret' },
    { key: 'tvaIntra', i18nKey: 'onboarding.fields.tvaIntra' },
  ],
  ES: [
    { key: 'nif', i18nKey: 'onboarding.fields.nif' },
    { key: 'iae', i18nKey: 'onboarding.fields.iae' },
  ],
  IT: [
    { key: 'partitaIva', i18nKey: 'onboarding.fields.partitaIva' },
    { key: 'cameraCommercio', i18nKey: 'onboarding.fields.cameraCommercio' },
  ],
};

const CERTS: Record<string, Record<Country, string[]>> = {
  plumbing: { NL: ['Uneto-VNI'], UK: ['CIPHE', 'WaterSafe'], DE: ['Meisterbrief Sanitär'], FR: ['Qualibat'], ES: ['Carnet instalador'], IT: ['Abilitazione idraulica'] },
  electrical: { NL: ['Uneto-VNI', 'NEN 1010'], UK: ['NICEIC', 'Part P', 'NAPIT'], DE: ['Meisterbrief Elektro'], FR: ['Qualifelec'], ES: ['REBT autorizado'], IT: ['DM 37/08'] },
  gas: { NL: ['STEK', 'F-gassen'], UK: ['Gas Safe'], DE: ['F-Gase Zertifikat'], FR: ['QualiPAC', 'RGE'], ES: ['Carnet gas'], IT: ['F-Gas cert.'] },
  painting: { NL: ['BKB erkend'], UK: ['PDA'], DE: ['Meisterbrief Maler'], FR: ['Qualibat'], ES: ['Cualificación prof.'], IT: ['SOA'] },
  carpentry: { NL: ['SKH'], UK: ['FIRA Gold'], DE: ['Meisterbrief Tischler'], FR: ['Qualibat'], ES: ['Cualificación prof.'], IT: ['SOA'] },
  roofing: { NL: ['BIKUDAK', 'VEB erkend'], UK: ['NFRC', 'CSCS'], DE: ['Meisterbrief Dachdecker'], FR: ['Qualibat Couverture', 'RGE'], ES: ['TPC Cubiertas'], IT: ['SOA'] },
  tiling: { NL: ['NOA erkend'], UK: ['TTA', 'NVQ Tiling'], DE: ['Meisterbrief Fliesen'], FR: ['Qualibat'], ES: ['Cualificación prof.'], IT: ['SOA'] },
  plastering: { NL: ['NOA erkend'], UK: ['NVQ Plastering'], DE: ['Meisterbrief Stuckateur'], FR: ['Qualibat'], ES: ['Cualificación prof.'], IT: ['SOA'] },
  flooring: { NL: ['KOMO', 'NOA erkend'], UK: ['NICF', 'FITA'], DE: ['Meisterbrief Bodenleger'], FR: ['Qualibat'], ES: ['Cualificación prof.'], IT: ['SOA'] },
  insulation: { NL: ['KIWA BRL', 'ISOVER partner'], UK: ['NIA', 'PAS 2030', 'TrustMark'], DE: ['Energieberater'], FR: ['RGE Isolation', 'Qualibat'], ES: ['Certificación IDAE'], IT: ['Cert. Superbonus'] },
  solar: { NL: ['SCIOS', 'NEN 1010', 'Zonnekeur'], UK: ['MCS', 'NAPIT', 'RECC'], DE: ['Elektrofachkraft Solar'], FR: ['QualiPV', 'RGE'], ES: ['REBT', 'Baja tensión'], IT: ['DM 37/08', 'CEI 0-21'] },
  glazing: { NL: ['KIWA', 'NEN-EN 12150'], UK: ['GGF', 'FENSA'], DE: ['Meisterbrief Glaser'], FR: ['Qualibat Vitrerie'], ES: ['Cualificación prof.'], IT: ['SOA'] },
  landscaping: { NL: ['VHG erkend', 'Groenkeur'], UK: ['BALI', 'City & Guilds'], DE: ['Meisterbrief Gärtner'], FR: ['Qualipaysage'], ES: ['Cualificación Jardinería'], IT: ['Albo Artigiani'] },
  general: { NL: ['VCA'], UK: ['CSCS', 'CITB'], DE: ['SCC'], FR: ['CACES', 'Habilitation'], ES: ['TPC'], IT: ['DURC', 'SOA'] },
  other: { NL: ['VCA'], UK: ['CSCS'], DE: ['SCC'], FR: ['CACES'], ES: ['TPC'], IT: ['DURC'] },
};

const LANGUAGES: { code: Language; flag: string; label: string }[] = [
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'nl', flag: '🇳🇱', label: 'Nederlands' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
  { code: 'fr', flag: '🇫🇷', label: 'Français' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
  { code: 'it', flag: '🇮🇹', label: 'Italiano' },
];

const COUNTRIES: { code: Country; flag: string; label: string }[] = [
  { code: 'UK', flag: '🇬🇧', label: 'United Kingdom' },
  { code: 'NL', flag: '🇳🇱', label: 'Nederland' },
  { code: 'DE', flag: '🇩🇪', label: 'Deutschland' },
  { code: 'FR', flag: '🇫🇷', label: 'France' },
  { code: 'ES', flag: '🇪🇸', label: 'España' },
  { code: 'IT', flag: '🇮🇹', label: 'Italia' },
];

// AI demo insights personalized by trade
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDemoInsights(trade: string, goals: string[], t: any): { icon: string; title: string; subtitle: string }[] {
  const insights: { icon: string; title: string; subtitle: string }[] = [];

  if (goals.includes('faster_payments')) {
    insights.push({ icon: 'cash', title: t('onboarding.aiInsight.payments', 'Payment reminders'), subtitle: t('onboarding.aiInsight.paymentsDesc', 'Auto-send reminders for overdue invoices') });
  }
  if (goals.includes('better_quotes')) {
    insights.push({ icon: 'document-text', title: t('onboarding.aiInsight.quotes', 'Smart quote pricing'), subtitle: t('onboarding.aiInsight.quotesDesc', 'AI suggests prices based on local market data') });
  }
  if (goals.includes('less_admin')) {
    insights.push({ icon: 'sparkles', title: t('onboarding.aiInsight.automation', 'Auto-invoicing'), subtitle: t('onboarding.aiInsight.automationDesc', 'Generate invoices from completed jobs in one tap') });
  }
  if (goals.includes('stay_compliant')) {
    insights.push({ icon: 'shield-checkmark', title: t('onboarding.aiInsight.compliance', 'Certificate tracking'), subtitle: t('onboarding.aiInsight.complianceDesc', 'Alerts before your certifications expire') });
  }
  if (goals.includes('more_jobs')) {
    insights.push({ icon: 'trending-up', title: t('onboarding.aiInsight.leads', 'Lead scoring'), subtitle: t('onboarding.aiInsight.leadsDesc', 'Prioritize leads most likely to convert') });
  }

  // Always have at least 3
  if (insights.length < 3) {
    insights.push({ icon: 'time', title: t('onboarding.aiInsight.schedule', 'Smart scheduling'), subtitle: t('onboarding.aiInsight.scheduleDesc', 'Optimize your route and job order daily') });
  }
  if (insights.length < 3) {
    insights.push({ icon: 'analytics', title: t('onboarding.aiInsight.insights', 'Business insights'), subtitle: t('onboarding.aiInsight.insightsDesc', 'Weekly reports on revenue, jobs, and trends') });
  }

  return insights.slice(0, 4);
}

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, updateUser } = useAuth();

  const [step, setStep] = useState(1);
  const [language, setLanguage] = useState<Language>(
    (i18n.language as Language) || 'en'
  );
  const [country, setCountry] = useState<Country | null>(null);
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [selectedChallenges, setSelectedChallenges] = useState<string[]>([]);
  const [teamSize, setTeamSize] = useState<string | null>(null);
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [regFields, setRegFields] = useState<Record<string, string>>({});
  const [selectedCerts, setSelectedCerts] = useState<string[]>([]);
  const [postcode, setPostcode] = useState('');
  const [radius, setRadius] = useState(25);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionTier>('free');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [submitting, setSubmitting] = useState(false);

  const handleDemoMode = useCallback(async () => {
    try {
      hapticSuccess();
      const onboardingData = {
        country: 'NL' as Country,
        language: 'en' as Language,
        trades: ['plumbing'],
        goals: ['less_admin', 'faster_payments'],
        challenges: ['quoting'],
        teamSize: 'solo',
        businessType: 'eenmanszaak',
        registrationFields: {},
        certifications: [],
        postcode: '1012 AB',
        serviceRadius: 25,
        selectedPlan: 'free' as SubscriptionTier,
        completedAt: new Date().toISOString(),
        demoMode: true,
      };
      await AsyncStorage.setItem('@vasco_onboarding', JSON.stringify(onboardingData));
      const userUpdates = {
        trade: 'plumbing',
        country: 'NL' as Country | undefined,
        language: 'en' as Language,
        onboardingComplete: true,
      };
      updateUser(userUpdates);
      await AsyncStorage.setItem('@vasco_user_profile', JSON.stringify(userUpdates)).catch(() => {});
      router.replace('/(contractor)');
    } catch (err) {
      if (__DEV__) console.error('Demo mode failed:', err);
    }
  }, [router, updateUser]);

  const toggleTrade = (trade: string) => {
    setSelectedTrades((prev) =>
      prev.includes(trade) ? prev.filter((t) => t !== trade) : [...prev, trade]
    );
  };

  const toggleGoal = (goal: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  };

  const toggleChallenge = (challenge: string) => {
    setSelectedChallenges((prev) =>
      prev.includes(challenge) ? prev.filter((c) => c !== challenge) : [...prev, challenge]
    );
  };

  const toggleCert = (cert: string) => {
    setSelectedCerts((prev) =>
      prev.includes(cert) ? prev.filter((c) => c !== cert) : [...prev, cert]
    );
  };

  const canProceed = useCallback(() => {
    switch (step) {
      case 2: return true; // language — always valid (has default)
      case 3: return country !== null;
      case 4: return selectedTrades.length > 0;
      case 5: return selectedGoals.length > 0;
      case 6: return selectedChallenges.length > 0;
      case 7: return teamSize !== null;
      case 8: return businessType !== null;
      default: return true;
    }
  }, [step, country, selectedTrades, selectedGoals, selectedChallenges, teamSize, businessType]);

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      hapticSuccess();
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleComplete = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const onboardingData = {
        country,
        language,
        trades: selectedTrades,
        goals: selectedGoals,
        challenges: selectedChallenges,
        teamSize,
        businessType,
        registrationFields: regFields,
        certifications: selectedCerts,
        postcode,
        serviceRadius: radius,
        selectedPlan,
        billingCycle,
        completedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem('@vasco_onboarding', JSON.stringify(onboardingData));
      await AsyncStorage.setItem('@vasco_subscription', JSON.stringify({ tier: selectedPlan, billingCycle }));

      // Persist tier selection server-side so the user can't downgrade by
      // reinstalling the app and the web admin can report real tier metrics.
      try {
        const { isSupabaseConfigured, supabase } = await import('../src/lib/supabase');
        if (isSupabaseConfigured) {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser) {
            await (supabase.from('subscriptions' as any) as any).upsert({
              user_id: authUser.id,
              tier: selectedPlan,
              billing_cycle: billingCycle,
              status: selectedPlan === 'free' ? 'active' : 'trialing',
              trial_ends_at: selectedPlan === 'free' ? null : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });
          }
        }
      } catch {
        // Non-blocking: local AsyncStorage copy is still the source of truth in demo mode
      }

      const userUpdates = {
        trade: selectedTrades[0],
        country: country ?? undefined,
        language,
        onboardingComplete: true,
      };
      updateUser(userUpdates);
      await AsyncStorage.setItem('@vasco_user_profile', JSON.stringify(userUpdates)).catch(() => {});

      i18n.changeLanguage(language);

      // Seed data for new users
      const tradeLabel = selectedTrades[0] ?? 'general';
      const seedJobTitle = tradeLabel === 'plumbing'
        ? t('onboarding.seedJobPlumbing', 'Boiler maintenance')
        : tradeLabel === 'electrical'
          ? t('onboarding.seedJobElectrical', 'Fuse box replacement')
          : t('onboarding.seedJobGeneral', 'Example job');
      const seedJobs = [
        { id: 'j-seed-1', title: seedJobTitle, customerId: null, description: t('onboarding.seedJobDescription', 'Example job — delete or edit this'), status: 'lead' as const, trade: tradeLabel, priority: 'normal' as const, photos: [], notes: [], timeEntries: [], materials: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ];
      const seedCustomers = [
        { id: 'c-seed-1', name: t('onboarding.seedCustomer', 'Example customer'), email: '', phone: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ];
      await AsyncStorage.setItem('@vasco_jobs', JSON.stringify(seedJobs)).catch(() => {});
      await AsyncStorage.setItem('@vasco_customers', JSON.stringify(seedCustomers)).catch(() => {});

      hapticSuccess();
      router.replace('/(contractor)');
    } catch (err) {
      if (__DEV__) console.error('Onboarding completion failed:', err);
      Alert.alert(
        t('common.error', 'Error'),
        t('onboarding.completionError', 'Something went wrong. Please try again.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepRow}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.stepDot,
            i + 1 === step && styles.stepDotActive,
            i + 1 < step && styles.stepDotDone,
          ]}
        />
      ))}
    </View>
  );

  const renderStep = () => {
    switch (step) {
      // ─── Step 1: Welcome ────────────────────────────────────────────
      case 1:
        return (
          <View style={styles.centeredContent}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>V</Text>
            </View>
            <Text style={styles.welcomeTitle}>{t('onboarding.welcome')}</Text>
            <Text style={styles.welcomeSubtitle}>{t('onboarding.subtitle')}</Text>

            <View style={styles.valuePropsContainer}>
              <View style={styles.valuePropCard}>
                <View style={[styles.valuePropIcon, { backgroundColor: Palette.hermesOrange + '12' }]}>
                  <Ionicons name="sparkles" size={20} color={Palette.hermesOrange} />
                </View>
                <View style={styles.valuePropContent}>
                  <Text style={styles.valuePropTitle}>{t('onboarding.valueProp1Title', 'AI that works for you')}</Text>
                  <Text style={styles.valuePropSubtitle}>{t('onboarding.valueProp1Desc', 'Vasco prepares quotes, reminders, and invoices automatically')}</Text>
                </View>
              </View>
              <View style={styles.valuePropCard}>
                <View style={[styles.valuePropIcon, { backgroundColor: SemanticColors.feedbackSuccessBg }]}>
                  <Ionicons name="cash" size={20} color={SemanticColors.feedbackSuccess} />
                </View>
                <View style={styles.valuePropContent}>
                  <Text style={styles.valuePropTitle}>{t('onboarding.valueProp2Title', 'Get paid faster')}</Text>
                  <Text style={styles.valuePropSubtitle}>{t('onboarding.valueProp2Desc', 'Payment links, automated reminders, overdue tracking')}</Text>
                </View>
              </View>
              <View style={styles.valuePropCard}>
                <View style={[styles.valuePropIcon, { backgroundColor: SemanticColors.feedbackInfoBg }]}>
                  <Ionicons name="shield-checkmark" size={20} color={SemanticColors.feedbackInfo} />
                </View>
                <View style={styles.valuePropContent}>
                  <Text style={styles.valuePropTitle}>{t('onboarding.valueProp3Title', 'Stay compliant')}</Text>
                  <Text style={styles.valuePropSubtitle}>{t('onboarding.valueProp3Desc', 'Permits, certificates, EU regulations — all tracked')}</Text>
                </View>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              onPress={handleNext}
              accessibilityRole="button"
            >
              <Text style={styles.primaryButtonText}>{t('onboarding.getStarted')}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.demoButton, pressed && styles.pressed]}
              onPress={handleDemoMode}
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.tryDemo', 'Try with Demo Data')}
            >
              <Ionicons name="play-circle-outline" size={18} color={Palette.hermesOrange} />
              <Text style={styles.demoButtonText}>{t('onboarding.tryDemo', 'Try with Demo Data')}</Text>
            </Pressable>
          </View>
        );

      // ─── Step 2: Language ───────────────────────────────────────────
      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{t('onboarding.selectLanguage', 'Choose your language')}</Text>
            <View style={styles.optionGrid}>
              {LANGUAGES.map((lang) => (
                <Pressable
                  key={lang.code}
                  style={[styles.optionCard, language === lang.code && styles.optionSelected]}
                  onPress={() => { setLanguage(lang.code); i18n.changeLanguage(lang.code); }}
                  accessibilityRole="button"
                >
                  <Text style={styles.optionFlag}>{lang.flag}</Text>
                  <Text style={[styles.optionLabel, language === lang.code && styles.optionLabelSelected]}>
                    {lang.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        );

      // ─── Step 3: Country ────────────────────────────────────────────
      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{t('onboarding.selectCountry')}</Text>
            <View style={styles.optionGrid}>
              {COUNTRIES.map((c) => (
                <Pressable
                  key={c.code}
                  style={[styles.optionCard, country === c.code && styles.optionSelected]}
                  onPress={() => {
                    setCountry(c.code);
                    if (!language || language === 'en') {
                      const defaultLang = getDefaultLanguage(c.code);
                      setLanguage(defaultLang);
                      i18n.changeLanguage(defaultLang);
                    }
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.optionFlag}>{c.flag}</Text>
                  <Text style={[styles.optionLabel, country === c.code && styles.optionLabelSelected]}>
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {country && (
              <View style={styles.paymentPreview}>
                <Text style={styles.paymentPreviewLabel}>
                  {t('onboarding.availablePaymentMethods', 'Available payment methods in {{country}}:', { country: COUNTRIES.find(c => c.code === country)?.label ?? country })}
                </Text>
                <View style={styles.paymentBadgeRow}>
                  {getPaymentDisplayForCountry(country).map((pm) => {
                    const brandColor = getPaymentBrandColor(pm.name);
                    return (
                      <View key={pm.name} style={[styles.paymentBadge, { borderColor: brandColor + '25' }]}>
                        <View style={[styles.paymentDot, { backgroundColor: brandColor }]} />
                        <Text style={styles.paymentBadgeText}>{pm.name}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        );

      // ─── Step 4: Trade ──────────────────────────────────────────────
      case 4:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{t('onboarding.selectTrade')}</Text>
            <Text style={styles.stepSubtitle}>{t('onboarding.selectMultiple')}</Text>
            <View style={styles.tradeGrid}>
              {TRADES.map((trade) => (
                <Pressable
                  key={trade}
                  style={[styles.tradeChip, selectedTrades.includes(trade) && styles.tradeChipSelected]}
                  onPress={() => toggleTrade(trade)}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.tradeChipText,
                      selectedTrades.includes(trade) && styles.tradeChipTextSelected,
                    ]}
                  >
                    {t(`onboarding.trades.${trade}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        );

      // ─── Step 5: Goals ──────────────────────────────────────────────
      case 5:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{t('onboarding.goals')}</Text>
            <Text style={styles.stepSubtitle}>{t('onboarding.goalsDesc')}</Text>
            <View style={styles.optionGrid}>
              {GOALS.map((goal) => (
                <Pressable
                  key={goal}
                  style={[styles.goalCard, selectedGoals.includes(goal) && styles.goalCardSelected]}
                  onPress={() => toggleGoal(goal)}
                  accessibilityRole="button"
                >
                  <View style={[styles.goalIcon, selectedGoals.includes(goal) && styles.goalIconSelected]}>
                    <Ionicons
                      name={GOAL_ICONS[goal] as any}
                      size={20}
                      color={selectedGoals.includes(goal) ? Palette.hermesOrange : SemanticColors.textSecondary}
                    />
                  </View>
                  <Text style={[styles.goalText, selectedGoals.includes(goal) && styles.goalTextSelected]}>
                    {t(`onboarding.goals.${goal}`)}
                  </Text>
                  {selectedGoals.includes(goal) && (
                    <Ionicons name="checkmark-circle" size={20} color={Palette.hermesOrange} />
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        );

      // ─── Step 6: Challenges ─────────────────────────────────────────
      case 6:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{t('onboarding.challenge')}</Text>
            <Text style={styles.stepSubtitle}>{t('onboarding.challengeDesc')}</Text>
            <View style={styles.optionGrid}>
              {CHALLENGES.map((challenge) => (
                <Pressable
                  key={challenge}
                  style={[styles.goalCard, selectedChallenges.includes(challenge) && styles.goalCardSelected]}
                  onPress={() => toggleChallenge(challenge)}
                  accessibilityRole="button"
                >
                  <View style={[styles.goalIcon, selectedChallenges.includes(challenge) && styles.goalIconSelected]}>
                    <Ionicons
                      name={CHALLENGE_ICONS[challenge] as any}
                      size={20}
                      color={selectedChallenges.includes(challenge) ? Palette.hermesOrange : SemanticColors.textSecondary}
                    />
                  </View>
                  <Text style={[styles.goalText, selectedChallenges.includes(challenge) && styles.goalTextSelected]}>
                    {t(`onboarding.challenges.${challenge}`)}
                  </Text>
                  {selectedChallenges.includes(challenge) && (
                    <Ionicons name="checkmark-circle" size={20} color={Palette.hermesOrange} />
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        );

      // ─── Step 7: Team Size ──────────────────────────────────────────
      case 7:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{t('onboarding.teamSize')}</Text>
            <View style={styles.optionGrid}>
              {TEAM_SIZES.map((size) => (
                <Pressable
                  key={size.key}
                  style={[styles.teamCard, teamSize === size.key && styles.teamCardSelected]}
                  onPress={() => setTeamSize(size.key)}
                  accessibilityRole="button"
                >
                  <View style={[styles.teamIcon, teamSize === size.key && styles.teamIconSelected]}>
                    <Ionicons
                      name={size.icon as any}
                      size={24}
                      color={teamSize === size.key ? Palette.hermesOrange : SemanticColors.textSecondary}
                    />
                  </View>
                  <View style={styles.teamTextGroup}>
                    <Text style={[styles.teamTitle, teamSize === size.key && styles.teamTitleSelected]}>
                      {t(`onboarding.teamSizes.${size.key}`)}
                    </Text>
                    <Text style={styles.teamDesc}>
                      {t(`onboarding.teamSizes.${size.key}Desc`)}
                    </Text>
                  </View>
                  {teamSize === size.key && (
                    <Ionicons name="checkmark-circle" size={22} color={Palette.hermesOrange} />
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        );

      // ─── Step 8: Business Type ──────────────────────────────────────
      case 8:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{t('onboarding.businessType')}</Text>
            <View style={styles.optionGrid}>
              {(BUSINESS_TYPES[country!] || []).map((bt) => (
                <Pressable
                  key={bt.key}
                  style={[styles.optionCard, businessType === bt.key && styles.optionSelected]}
                  onPress={() => setBusinessType(bt.key)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.optionLabel, businessType === bt.key && styles.optionLabelSelected]}>
                    {t(`onboarding.businessTypes.${bt.key}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        );

      // ─── Step 9: Registration ───────────────────────────────────────
      case 9:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{t('onboarding.registration')}</Text>
            <Text style={styles.stepSubtitle}>{t('onboarding.registrationDesc')}</Text>
            {(REG_FIELDS[country!] || []).map((field) => (
              <View key={field.key} style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {t(field.i18nKey)} <Text style={styles.optionalTag}>({t('common.optional')})</Text>
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={regFields[field.key] || ''}
                  onChangeText={(v) => setRegFields((prev) => ({ ...prev, [field.key]: v }))}
                  placeholder="..."
                  placeholderTextColor={SemanticColors.textTertiary}
                />
              </View>
            ))}
          </View>
        );

      // ─── Step 10: Certifications ───────────────────────────────────
      case 10: {
        const availableCerts = selectedTrades.flatMap(
          (trade) => CERTS[trade]?.[country!] || []
        );
        const uniqueCerts = [...new Set(availableCerts)];
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{t('onboarding.certifications')}</Text>
            <Text style={styles.stepSubtitle}>{t('onboarding.certificationsDesc')}</Text>
            {uniqueCerts.length > 0 ? (
              <View style={styles.tradeGrid}>
                {uniqueCerts.map((cert) => (
                  <Pressable
                    key={cert}
                    style={[styles.tradeChip, selectedCerts.includes(cert) && styles.tradeChipSelected]}
                    onPress={() => toggleCert(cert)}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.tradeChipText,
                        selectedCerts.includes(cert) && styles.tradeChipTextSelected,
                      ]}
                    >
                      {cert}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>{t('common.noData')}</Text>
            )}
            <View style={styles.complianceInfoCard}>
              <Ionicons name="shield-checkmark-outline" size={18} color={Palette.hermesOrange} style={{ marginTop: 1 }} />
              <Text style={styles.complianceInfoText}>
                {t('onboarding.complianceInfo', 'Vasco monitors your certifications and warns on expiry. You also receive notifications for VAT deadlines and insurance.')}
              </Text>
            </View>
          </View>
        );
      }

      // ─── Step 11: Service Area ─────────────────────────────────────
      case 11:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{t('onboarding.serviceArea')}</Text>
            <Text style={styles.stepSubtitle}>{t('onboarding.serviceAreaDesc')}</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('onboarding.postcode')}</Text>
              <TextInput
                style={styles.textInput}
                value={postcode}
                onChangeText={setPostcode}
                placeholder="1234 AB"
                placeholderTextColor={SemanticColors.textTertiary}
                autoCapitalize="characters"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {t('onboarding.radius')}: {radius} km
              </Text>
              <View style={styles.radiusRow}>
                {[10, 25, 50, 75, 100].map((r) => (
                  <Pressable
                    key={r}
                    style={[styles.radiusChip, radius === r && styles.radiusChipSelected]}
                    onPress={() => setRadius(r)}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[styles.radiusChipText, radius === r && styles.radiusChipTextSelected]}
                    >
                      {r} km
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        );

      // ─── Step 12: AI Demo ──────────────────────────────────────────
      case 12: {
        const demoInsights = getDemoInsights(selectedTrades[0] ?? 'general', selectedGoals, t);
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{t('onboarding.aiDemo')}</Text>
            <Text style={styles.stepSubtitle}>{t('onboarding.aiDemoDesc')}</Text>

            <View style={styles.aiDemoContainer}>
              {demoInsights.map((insight, i) => (
                <View key={i} style={styles.aiDemoCard}>
                  <View style={styles.aiDemoIconContainer}>
                    <Ionicons name={insight.icon as any} size={22} color={Palette.hermesOrange} />
                  </View>
                  <View style={styles.aiDemoContent}>
                    <Text style={styles.aiDemoTitle}>{insight.title}</Text>
                    <Text style={styles.aiDemoSubtitle}>{insight.subtitle}</Text>
                  </View>
                  <View style={styles.aiDemoBadge}>
                    <Ionicons name="sparkles" size={12} color={Palette.hermesOrange} />
                    <Text style={styles.aiDemoBadgeText}>AI</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.aiDemoNote}>
              <Ionicons name="information-circle-outline" size={16} color={SemanticColors.textTertiary} />
              <Text style={styles.aiDemoNoteText}>
                {t('onboarding.aiDemoNote')}
              </Text>
            </View>
          </View>
        );
      }

      // ─── Step 13: Plan Selection ───────────────────────────────────
      case 13: {
        const freeTier = TIERS.free;
        const advancedTier = TIERS.advanced;
        const proTier = TIERS.pro;
        const contractorTier = TIERS.contractor;

        const plans: { id: SubscriptionTier; name: string; price: number; annualPrice: number; badge?: string; features: { text: string; highlight?: boolean }[] }[] = [
          {
            id: 'free',
            name: 'Free',
            price: 0,
            annualPrice: 0,
            features: [
              { text: `${freeTier.limits.maxActiveJobs} ${t('common.jobs', 'jobs')}` },
              { text: `${freeTier.limits.maxQuotesPerMonth} ${t('common.quotesMonth', 'quotes/month')}` },
              { text: `${freeTier.limits.maxAiInsightsPerMonth} AI ${t('common.insights', 'insights')}` },
            ],
          },
          {
            id: 'advanced',
            name: 'Advanced',
            price: advancedTier.monthlyPrice,
            annualPrice: advancedTier.annualMonthlyPrice,
            badge: 'POPULAR',
            features: [
              { text: `${advancedTier.limits.maxActiveJobs} ${t('common.jobs', 'jobs')}`, highlight: true },
              { text: t('common.paymentProcessing', 'Payment processing'), highlight: true },
              { text: 'EVE AI', highlight: true },
              { text: t('common.quoteTemplates', 'Quote templates'), highlight: true },
            ],
          },
          {
            id: 'pro',
            name: 'Pro',
            price: proTier.monthlyPrice,
            annualPrice: proTier.annualMonthlyPrice,
            badge: 'BEST VALUE',
            features: [
              { text: t('common.unlimited', 'Unlimited') + ' ' + t('common.jobs', 'jobs'), highlight: true },
              { text: t('common.fullAi', 'Full AI suite'), highlight: true },
              { text: t('common.purchasingAgent', 'Purchasing agent'), highlight: true },
              { text: t('common.benchmarking', 'Benchmarking'), highlight: true },
            ],
          },
          {
            id: 'contractor',
            name: 'Contractor',
            price: contractorTier.monthlyPrice,
            annualPrice: contractorTier.annualMonthlyPrice,
            features: [
              { text: t('common.teamFeatures', 'Team features'), highlight: true },
              { text: `${contractorTier.limits.maxTeamSeats} ${t('common.seats', 'seats')}`, highlight: true },
              { text: t('common.dedicatedSupport', 'Dedicated support'), highlight: true },
              { text: t('common.apiWhiteLabel', 'API + white-label'), highlight: true },
            ],
          },
        ];

        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{t('onboarding.choosePlan')}</Text>
            <Text style={styles.stepSubtitle}>{t('onboarding.choosePlanDesc')}</Text>

            {/* Billing toggle */}
            <View style={styles.billingToggle}>
              <Pressable
                style={[styles.billingOption, billingCycle === 'monthly' && styles.billingOptionActive]}
                onPress={() => setBillingCycle('monthly')}
                accessibilityRole="button"
              >
                <Text style={[styles.billingOptionText, billingCycle === 'monthly' && styles.billingOptionTextActive]}>
                  {t('onboarding.monthly')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.billingOption, billingCycle === 'annual' && styles.billingOptionActive]}
                onPress={() => setBillingCycle('annual')}
                accessibilityRole="button"
              >
                <Text style={[styles.billingOptionText, billingCycle === 'annual' && styles.billingOptionTextActive]}>
                  {t('onboarding.annual')}
                </Text>
                <View style={styles.saveBadge}>
                  <Text style={styles.saveBadgeText}>-26%</Text>
                </View>
              </Pressable>
            </View>

            {/* Plan cards */}
            {plans.map((plan) => {
              const displayPrice = billingCycle === 'annual' ? plan.annualPrice : plan.price;
              const isSelected = selectedPlan === plan.id;
              const hasBadge = !!plan.badge;

              return (
                <Pressable
                  key={plan.id}
                  style={[styles.planCard, hasBadge && styles.planCardPro, isSelected && styles.planCardSelected]}
                  onPress={() => setSelectedPlan(plan.id)}
                  accessibilityRole="button"
                >
                  {hasBadge && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularBadgeText}>{plan.badge}</Text>
                    </View>
                  )}
                  <View style={styles.planHeader}>
                    <Text style={styles.planName}>{plan.name}</Text>
                    {displayPrice === 0 ? (
                      <Text style={styles.planPrice}>€0</Text>
                    ) : (
                      <View style={styles.planPriceRow}>
                        <Text style={styles.planPriceLarge}>€{displayPrice}</Text>
                        <Text style={styles.planPricePeriod}>/mo</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.planFeatures}>
                    {plan.features.map((f, i) => (
                      <PlanFeature key={i} text={f.text} highlight={f.highlight} />
                    ))}
                  </View>
                  {isSelected && (
                    <View style={styles.planCheckmark}>
                      <Ionicons name="checkmark-circle" size={24} color={Palette.hermesOrange} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        );
      }

      // ─── Step 14: Review ───────────────────────────────────────────
      case 14: {
        const countryLabel = COUNTRIES.find(c => c.code === country);
        const langLabel = LANGUAGES.find(l => l.code === language);
        const reviewItems = [
          { label: t('onboarding.selectCountry', 'Country'), value: countryLabel ? `${countryLabel.flag} ${countryLabel.label}` : '-' },
          { label: t('onboarding.selectTrade', 'Trade'), value: selectedTrades.map(tr => t(`onboarding.trades.${tr}`)).join(', ') || '-' },
          { label: t('onboarding.businessType', 'Business type'), value: businessType ? t(`onboarding.businessTypes.${businessType}`) : '-' },
          { label: t('onboarding.teamSize', 'Team size'), value: teamSize ? t(`onboarding.teamSizes.${teamSize}`) : '-' },
          { label: t('onboarding.serviceArea', 'Service area'), value: postcode ? `${postcode} (${radius} km)` : '-' },
          { label: t('onboarding.certifications', 'Certifications'), value: selectedCerts.length > 0 ? selectedCerts.join(', ') : '-' },
          { label: t('onboarding.language', 'Language'), value: langLabel ? `${langLabel.flag} ${langLabel.label}` : '-' },
          { label: t('onboarding.choosePlan', 'Plan'), value: selectedPlan === 'free' ? 'Free' : `${TIERS[selectedPlan].name} (€${billingCycle === 'annual' ? TIERS[selectedPlan].annualMonthlyPrice : TIERS[selectedPlan].monthlyPrice}/mo)` },
        ];
        return (
          <View style={styles.stepContent}>
            <View style={styles.reviewHeader}>
              <Ionicons name="checkmark-circle" size={48} color={SemanticColors.feedbackSuccess} />
              <Text style={styles.stepTitle}>{t('onboarding.complete', 'All set!')}</Text>
              <Text style={styles.stepSubtitle}>{t('onboarding.completeDesc', 'Your Vasco account is ready')}</Text>
            </View>
            <View style={styles.reviewCard}>
              {reviewItems.map((item, i) => (
                <View key={item.label} style={[styles.reviewRow, i < reviewItems.length - 1 && styles.reviewRowBorder]}>
                  <Text style={styles.reviewLabel}>{item.label}</Text>
                  <Text style={styles.reviewValue} numberOfLines={2}>{item.value}</Text>
                </View>
              ))}
            </View>
            <View style={styles.settingsHint}>
              <Ionicons name="information-circle-outline" size={16} color={SemanticColors.textTertiary} />
              <Text style={styles.settingsHintText}>
                {t('onboarding.settingsHint', 'You can set up integrations, notifications and templates later via Compliance.')}
              </Text>
            </View>
          </View>
        );
      }

      default:
        return null;
    }
  };

  // Steps where Skip is allowed (optional data: reg, certs, service area, AI demo)
  const skippableSteps = [9, 10, 11, 12];

  return (
    <View style={styles.screen}>
      {step > 1 && (
        <View style={styles.header}>
          <Pressable onPress={handleBack} hitSlop={8} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
          </Pressable>
          <Text style={styles.stepText}>
            {t('onboarding.step', { current: step, total: TOTAL_STEPS })}
          </Text>
          {skippableSteps.includes(step) ? (
            <Pressable onPress={handleNext} hitSlop={8} accessibilityRole="button">
              <Text style={styles.skipText}>{t('common.skip')}</Text>
            </Pressable>
          ) : (
            <View style={{ width: 50 }} />
          )}
        </View>
      )}

      {step > 1 && renderStepIndicator()}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <FadeIn key={step} delay={0} duration={300}>
          {renderStep()}
        </FadeIn>
      </ScrollView>

      {step > 1 && (
        <View style={styles.footer}>
          {step === TOTAL_STEPS ? (
            <GradientButton label={t('onboarding.startUsing')} onPress={handleComplete} disabled={submitting} />
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                styles.fullWidth,
                !canProceed() && styles.buttonDisabled,
                pressed && canProceed() && styles.pressed,
              ]}
              onPress={handleNext}
              disabled={!canProceed()}
              accessibilityRole="button"
            >
              <Text style={styles.primaryButtonText}>{t('common.next')}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Plan Feature Row ─────────────────────────────────────────────────────────
function PlanFeature({ text, highlight }: { text: string; highlight?: boolean }) {
  return (
    <View style={styles.planFeatureRow}>
      <Ionicons
        name="checkmark"
        size={16}
        color={highlight ? Palette.hermesOrange : SemanticColors.textTertiary}
      />
      <Text style={[styles.planFeatureText, highlight && styles.planFeatureHighlight]}>
        {text}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
    paddingTop: SafeArea.top,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SafeArea.side,
    paddingBottom: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textSecondary,
  },
  skipText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.labelFamily,
    color: Palette.hermesOrange,
  },
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    paddingBottom: 12,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: SemanticColors.borderDefault,
  },
  stepDotActive: {
    width: 20,
    backgroundColor: Palette.hermesOrange,
  },
  stepDotDone: {
    backgroundColor: Palette.pastelOrange,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SafeArea.side,
    paddingBottom: GRID.xl,
  },
  centeredContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.md,
    paddingBottom: GRID.xl,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logoText: {
    fontSize: 40,
    fontFamily: TYPE.displayFamily,
    color: Palette.white,
  },
  welcomeTitle: {
    fontSize: 30,
    fontFamily: TYPE.displayFamily,
    color: SemanticColors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  welcomeSubtitle: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  stepContent: {
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  stepTitle: {
    fontSize: 22,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    letterSpacing: -0.3,
  },
  stepSubtitle: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textSecondary,
    marginTop: -8,
  },
  optionGrid: {
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 2,
    borderColor: SemanticColors.borderDefault,
    borderRadius: RADIUS.lg,
    padding: 18,
  },
  optionSelected: {
    borderColor: Palette.hermesOrange,
    backgroundColor: `${Palette.hermesOrange}08`,
  },
  optionFlag: {
    fontSize: 28,
  },
  optionLabel: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textPrimary,
  },
  optionLabelSelected: {
    color: Palette.hermesOrange,
    fontFamily: TYPE.titleFamily,
  },
  tradeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tradeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 1.5,
    borderColor: SemanticColors.borderDefault,
  },
  tradeChipSelected: {
    borderColor: Palette.hermesOrange,
    backgroundColor: `${Palette.hermesOrange}12`,
  },
  tradeChipText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textPrimary,
  },
  tradeChipTextSelected: {
    color: Palette.hermesOrange,
    fontFamily: TYPE.titleFamily,
  },

  // ─── Goals / Challenges cards ─────────────────────────────────────
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 2,
    borderColor: SemanticColors.borderDefault,
    borderRadius: RADIUS.lg,
    padding: 16,
  },
  goalCardSelected: {
    borderColor: Palette.hermesOrange,
    backgroundColor: `${Palette.hermesOrange}08`,
  },
  goalIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalIconSelected: {
    backgroundColor: `${Palette.hermesOrange}15`,
  },
  goalText: {
    flex: 1,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textPrimary,
  },
  goalTextSelected: {
    color: Palette.hermesOrange,
    fontFamily: TYPE.titleFamily,
  },

  // ─── Team Size cards ──────────────────────────────────────────────
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 2,
    borderColor: SemanticColors.borderDefault,
    borderRadius: RADIUS.lg,
    padding: 18,
  },
  teamCardSelected: {
    borderColor: Palette.hermesOrange,
    backgroundColor: `${Palette.hermesOrange}08`,
  },
  teamIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamIconSelected: {
    backgroundColor: `${Palette.hermesOrange}15`,
  },
  teamTextGroup: {
    flex: 1,
    gap: 2,
  },
  teamTitle: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  teamTitleSelected: {
    color: Palette.hermesOrange,
  },
  teamDesc: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textSecondary,
  },

  // ─── AI Demo ──────────────────────────────────────────────────────
  aiDemoContainer: {
    gap: GRID.sm,
    marginTop: GRID.xs,
  },
  aiDemoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  aiDemoIconContainer: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: `${Palette.hermesOrange}12`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiDemoContent: {
    flex: 1,
    gap: 2,
  },
  aiDemoTitle: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  aiDemoSubtitle: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textSecondary,
  },
  aiDemoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: `${Palette.hermesOrange}12`,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  aiDemoBadgeText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
    color: Palette.hermesOrange,
  },
  aiDemoNote: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: 12,
    marginTop: GRID.xs,
  },
  aiDemoNoteText: {
    flex: 1,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textTertiary,
    lineHeight: 17,
  },

  // ─── Plan Selection ───────────────────────────────────────────────
  billingToggle: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: 4,
    marginBottom: GRID.xs,
  },
  billingOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
  },
  billingOptionActive: {
    backgroundColor: SemanticColors.surfacePrimary,
  },
  billingOptionText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textSecondary,
  },
  billingOptionTextActive: {
    color: SemanticColors.textPrimary,
    fontFamily: TYPE.titleFamily,
  },
  saveBadge: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  saveBadgeText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.feedbackSuccess,
  },
  planCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 2,
    borderColor: SemanticColors.borderDefault,
    borderRadius: RADIUS.lg,
    padding: 20,
    gap: 8,
    position: 'relative',
  },
  planCardPro: {
    borderColor: `${Palette.hermesOrange}40`,
  },
  planCardSelected: {
    borderColor: Palette.hermesOrange,
    backgroundColor: `${Palette.hermesOrange}05`,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planName: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  planPrice: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textSecondary,
  },
  planPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  planPriceLarge: {
    fontSize: 24,
    fontFamily: TYPE.displayFamily,
    color: Palette.hermesOrange,
  },
  planPricePeriod: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textSecondary,
  },
  planDesc: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textSecondary,
  },
  planFeatures: {
    gap: 6,
    marginTop: 4,
  },
  planFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planFeatureText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textSecondary,
  },
  planFeatureHighlight: {
    color: SemanticColors.textPrimary,
    fontFamily: TYPE.labelFamily,
  },
  planCheckmark: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    right: 16,
    backgroundColor: Palette.hermesOrange,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    zIndex: 1,
  },
  popularBadgeText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
    color: Palette.white,
    letterSpacing: 0.5,
  },

  // ─── Shared form elements ─────────────────────────────────────────
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textPrimary,
  },
  optionalTag: {
    color: SemanticColors.textTertiary,
    fontFamily: TYPE.bodyFamily,
  },
  textInput: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    borderRadius: RADIUS.md,
    padding: 14,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
  },
  radiusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  radiusChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 1.5,
    borderColor: SemanticColors.borderDefault,
    alignItems: 'center',
  },
  radiusChipSelected: {
    borderColor: Palette.hermesOrange,
    backgroundColor: `${Palette.hermesOrange}12`,
  },
  radiusChipText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textSecondary,
  },
  radiusChipTextSelected: {
    color: Palette.hermesOrange,
    fontFamily: TYPE.titleFamily,
  },
  paymentPreview: {
    marginTop: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: 14,
    gap: 10,
  },
  paymentPreviewLabel: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textSecondary,
  },
  paymentBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  paymentDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  paymentBadgeText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textPrimary,
  },
  emptyText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  complianceInfoCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: 14,
    marginTop: 4,
  },
  complianceInfoText: {
    flex: 1,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textSecondary,
    lineHeight: 19,
  },
  reviewHeader: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  reviewCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  reviewRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SemanticColors.borderDefault,
  },
  reviewLabel: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textSecondary,
  },
  reviewValue: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    textAlign: 'right',
    maxWidth: '55%',
  },
  settingsHint: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: 12,
    marginTop: 4,
  },
  settingsHintText: {
    flex: 1,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textTertiary,
    lineHeight: 17,
  },
  valuePropsContainer: {
    width: '100%',
    gap: GRID.sm,
    marginTop: GRID.md,
    marginBottom: GRID.md,
  },
  valuePropCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
  },
  valuePropIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valuePropContent: {
    flex: 1,
    gap: 2,
  },
  valuePropTitle: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  valuePropSubtitle: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textSecondary,
  },
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.sm,
    paddingVertical: GRID.md,
    paddingHorizontal: GRID.xl,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: Palette.hermesOrange,
    backgroundColor: Palette.hermesOrange + '08',
  },
  demoButtonText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: Palette.hermesOrange,
  },
  footer: {
    paddingHorizontal: SafeArea.side,
    paddingBottom: SafeArea.bottom + 8,
    paddingTop: 12,
  },
  primaryButton: {
    backgroundColor: Palette.hermesOrange,
    paddingVertical: 16,
    paddingHorizontal: Spacing.lg,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: Palette.white,
    fontSize: 17,
    fontFamily: TYPE.titleFamily,
  },
  fullWidth: {
    width: '100%',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
});
