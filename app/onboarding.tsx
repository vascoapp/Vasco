// =============================================================================
// ONBOARDING — Cal AI-style 14-step progressive onboarding
// =============================================================================
// Steps: Welcome → Language → Country → Trade → Goals → Challenges → Team Size
//        → Business Type → Registration → Certifications → Service Area
//        → AI Demo → Plan Selection → Review
// =============================================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Alert,
  Image,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import i18n from '../src/i18n/i18n';
import { useAuth, type Country, type Language } from '../src/context/AuthContext';
import { useAppState } from '../src/state/AppState';
import { DEMO_MODE } from '../src/config/demo';
import { SemanticColors, Palette } from '../src/theme/colors';
import { DK } from '../src/theme/draftkings';
import { SafeArea, Spacing } from '../src/theme/spacing';
import { getDefaultLanguage } from '../src/i18n/formatting';
import { getPaymentDisplayForCountry, getPaymentBrandColor } from '../src/config/paymentMethods';
import { listUsStates } from '../src/data/usSalesTax';

// R74 US foundation: state picker options for onboarding step 9. Alphabetical
// by full name (matches listUsStates default sort) so chips read predictably.
const US_STATE_OPTIONS = listUsStates();
import { FadeIn } from '../src/components/shared/FadeIn';
import { GradientButton } from '../src/components/shared/GradientButton';
import { hapticSuccess } from '../src/utils/haptics';
import { isValidKvKNumber, isValidVATNumber } from '../src/utils/validation';
import { GRID, RADIUS, TYPE } from '../src/theme/tabStyles';
import { TIERS, type SubscriptionTier } from '../src/services/subscriptionService';
import { emitOnboardingCompleted } from '../src/intelligence/dataCollector';


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

// solo / small (1-5) get Pro as the right-sized tier; medium / large (6+) need
// the Contractor tier for crew seats + team features. Used at the plan step to
// pre-select the recommended tier and move the "RECOMMENDED FOR YOU" badge so
// a 10-person crew lead isn't shown Free's 5-job limit as the headline option.
// Aannemers (multi-trade renovation GCs, selectedTrades.length >= 2) always
// need the Contractor tier even when team size says "solo" — project
// coordination + subcontractor seats are the value drivers, not headcount.
const recommendedTierForTeam = (
  size: string | null,
  tradeCount = 1,
): SubscriptionTier => {
  if (tradeCount >= 2) return 'contractor';
  if (size === 'medium' || size === 'large') return 'contractor';
  return 'pro';
};

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
  // R74 US foundation: most US trades operate as sole proprietorships
  // (no incorporation) or LLCs. S-corps are common for >$60k operators.
  US: [
    { key: 'soleProprietor', label: 'Sole Proprietor' },
    { key: 'llc', label: 'LLC' },
    { key: 'sCorp', label: 'S-Corp' },
  ],
};

// R66 round 43: per-field input-time validators. Closes the deferred half
// of R39 — pre-R43 onboarding accepted any string (`123.456.789.B.01` for
// btw, `12345` for kvk, `BAD-VAT` for ustId), and the typo only surfaced
// at first invoice attempt via R34/R39's readiness gate. Now caught at
// onBlur so the user fixes it with full context. Validation is non-blocking
// (Continue still works — the gate at invoice-send remains the hard stop).
type RegFieldValidator = (value: string) => boolean;
// R119: added optional `placeholder` (literal example) so the reg-field
// inputs stop showing the placeholder "..." which testers couldn't parse.
type RegFieldDef = { key: string; i18nKey: string; validate?: RegFieldValidator; errorKey?: string; placeholder?: string };

const REG_FIELDS: Record<Country, RegFieldDef[]> = {
  NL: [
    { key: 'kvk', i18nKey: 'onboarding.fields.kvk', validate: (v) => isValidKvKNumber(v.trim()), errorKey: 'profile.kvkFormatInvalid', placeholder: '12345678' },
    { key: 'btw', i18nKey: 'onboarding.fields.btw', validate: (v) => isValidVATNumber(v.trim()), errorKey: 'profile.vatFormatInvalid', placeholder: 'NL123456789B01' },
  ],
  UK: [
    { key: 'companiesHouse', i18nKey: 'onboarding.fields.companiesHouse', placeholder: '01234567' },
    { key: 'vatNumber', i18nKey: 'onboarding.fields.vatNumber', validate: (v) => isValidVATNumber(v.trim()), errorKey: 'profile.vatFormatInvalid', placeholder: 'GB123456789' },
    { key: 'paye', i18nKey: 'onboarding.fields.paye', placeholder: '123/AB12345' },
  ],
  DE: [
    { key: 'handelsregister', i18nKey: 'onboarding.fields.handelsregister', placeholder: 'HRB 12345' },
    { key: 'ustId', i18nKey: 'onboarding.fields.ustId', validate: (v) => isValidVATNumber(v.trim()), errorKey: 'profile.vatFormatInvalid', placeholder: 'DE123456789' },
    { key: 'steuernummer', i18nKey: 'onboarding.fields.steuernummer', placeholder: '12/345/67890' },
  ],
  FR: [
    { key: 'siret', i18nKey: 'onboarding.fields.siret', placeholder: '123 456 789 00012' },
    { key: 'tvaIntra', i18nKey: 'onboarding.fields.tvaIntra', validate: (v) => isValidVATNumber(v.trim()), errorKey: 'profile.vatFormatInvalid', placeholder: 'FR12345678901' },
  ],
  ES: [
    { key: 'nif', i18nKey: 'onboarding.fields.nif', validate: (v) => isValidVATNumber(v.trim()), errorKey: 'profile.vatFormatInvalid', placeholder: 'ES12345678A' },
    { key: 'iae', i18nKey: 'onboarding.fields.iae', placeholder: '5045' },
  ],
  IT: [
    { key: 'partitaIva', i18nKey: 'onboarding.fields.partitaIva', validate: (v) => isValidVATNumber(v.trim()), errorKey: 'profile.vatFormatInvalid', placeholder: 'IT12345678901' },
    { key: 'cameraCommercio', i18nKey: 'onboarding.fields.cameraCommercio', placeholder: 'MI-1234567' },
  ],
  // R74 US foundation: EIN (federal Employer Identification Number) is the
  // tax-side identifier for LLCs / S-corps; sole proprietors typically use
  // their SSN but EIN is universal. State licensing handled separately in
  // Phase 1 of the US expansion plan.
  US: [
    { key: 'ein', i18nKey: 'onboarding.fields.ein', placeholder: '12-3456789' },
    { key: 'stateLicense', i18nKey: 'onboarding.fields.stateLicense', placeholder: 'TX-12345' },
  ],
};

// VAT format hints surfaced in the error message — same shape as R39's
// vatFormatExample helper but inlined here to avoid a circular import
// chain (utils → onboarding → utils).
const VAT_EXAMPLE: Record<Country, string> = {
  NL: 'NL123456789B01',
  DE: 'DE123456789',
  FR: 'FR12345678901',
  ES: 'ESA12345678',
  IT: 'IT12345678901',
  UK: 'GB123456789',
  // R74 US foundation: no VAT — placeholder shown as EIN format hint when
  // the validator path falls through for US.
  US: '12-3456789',
};

// R74 US foundation: US certs are national bodies (NATE/EPA) + state
// contractor licenses. Per-state license lookup added in Phase 2 of the
// US expansion plan; for onboarding we surface the most-common ones.
const CERTS: Record<string, Record<Country, string[]>> = {
  plumbing: { NL: ['Uneto-VNI'], UK: ['CIPHE', 'WaterSafe'], DE: ['Meisterbrief Sanitär'], FR: ['Qualibat'], ES: ['Carnet instalador'], IT: ['Abilitazione idraulica'], US: ['Master Plumber License', 'Backflow Cert', 'Medical Gas Cert'] },
  electrical: { NL: ['Uneto-VNI', 'NEN 1010'], UK: ['NICEIC', 'Part P', 'NAPIT'], DE: ['Meisterbrief Elektro'], FR: ['Qualifelec'], ES: ['REBT autorizado'], IT: ['DM 37/08'], US: ['Master Electrician License', 'NEC certified', 'OSHA 30'] },
  gas: { NL: ['STEK', 'F-gassen'], UK: ['Gas Safe'], DE: ['F-Gase Zertifikat'], FR: ['QualiPAC', 'RGE'], ES: ['Carnet gas'], IT: ['F-Gas cert.'], US: ['EPA 608', 'NATE', 'HVAC Excellence'] },
  painting: { NL: ['BKB erkend'], UK: ['PDA'], DE: ['Meisterbrief Maler'], FR: ['Qualibat'], ES: ['Cualificación prof.'], IT: ['SOA'], US: ['EPA RRP (Lead-Safe)', 'PDCA'] },
  carpentry: { NL: ['SKH'], UK: ['FIRA Gold'], DE: ['Meisterbrief Tischler'], FR: ['Qualibat'], ES: ['Cualificación prof.'], IT: ['SOA'], US: ['NAHB CGR', 'OSHA 10'] },
  roofing: { NL: ['BIKUDAK', 'VEB erkend'], UK: ['NFRC', 'CSCS'], DE: ['Meisterbrief Dachdecker'], FR: ['Qualibat Couverture', 'RGE'], ES: ['TPC Cubiertas'], IT: ['SOA'], US: ['GAF Master Elite', 'CertainTeed SELECT ShingleMaster', 'OSHA Fall Protection'] },
  tiling: { NL: ['NOA erkend'], UK: ['TTA', 'NVQ Tiling'], DE: ['Meisterbrief Fliesen'], FR: ['Qualibat'], ES: ['Cualificación prof.'], IT: ['SOA'], US: ['CTEF', 'NTCA'] },
  plastering: { NL: ['NOA erkend'], UK: ['NVQ Plastering'], DE: ['Meisterbrief Stuckateur'], FR: ['Qualibat'], ES: ['Cualificación prof.'], IT: ['SOA'], US: ['EPA RRP (Lead-Safe)'] },
  flooring: { NL: ['KOMO', 'NOA erkend'], UK: ['NICF', 'FITA'], DE: ['Meisterbrief Bodenleger'], FR: ['Qualibat'], ES: ['Cualificación prof.'], IT: ['SOA'], US: ['NWFA Certified', 'INSTALL'] },
  insulation: { NL: ['KIWA BRL', 'ISOVER partner'], UK: ['NIA', 'PAS 2030', 'TrustMark'], DE: ['Energieberater'], FR: ['RGE Isolation', 'Qualibat'], ES: ['Certificación IDAE'], IT: ['Cert. Superbonus'], US: ['BPI', 'RESNET'] },
  solar: { NL: ['SCIOS', 'NEN 1010', 'Zonnekeur'], UK: ['MCS', 'NAPIT', 'RECC'], DE: ['Elektrofachkraft Solar'], FR: ['QualiPV', 'RGE'], ES: ['REBT', 'Baja tensión'], IT: ['DM 37/08', 'CEI 0-21'], US: ['NABCEP', 'OSHA 10'] },
  glazing: { NL: ['KIWA', 'NEN-EN 12150'], UK: ['GGF', 'FENSA'], DE: ['Meisterbrief Glaser'], FR: ['Qualibat Vitrerie'], ES: ['Cualificación prof.'], IT: ['SOA'], US: ['NACC', 'AAMA InstallationMasters'] },
  landscaping: { NL: ['VHG erkend', 'Groenkeur'], UK: ['BALI', 'City & Guilds'], DE: ['Meisterbrief Gärtner'], FR: ['Qualipaysage'], ES: ['Cualificación Jardinería'], IT: ['Albo Artigiani'], US: ['NALP Landscape Industry Certified', 'EPA WaterSense'] },
  general: { NL: ['VCA'], UK: ['CSCS', 'CITB'], DE: ['SCC'], FR: ['CACES', 'Habilitation'], ES: ['TPC'], IT: ['DURC', 'SOA'], US: ['State Contractor License', 'OSHA 30'] },
  other: { NL: ['VCA'], UK: ['CSCS'], DE: ['SCC'], FR: ['CACES'], ES: ['TPC'], IT: ['DURC'], US: ['OSHA 10'] },
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
  { code: 'US', flag: '🇺🇸', label: 'United States' },
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
  const { updateBusinessProfile } = useAppState();

  const onboardingStartRef = useRef(Date.now());
  const [step, setStep] = useState(1);
  const [language, setLanguage] = useState<Language>(
    (i18n.language as Language) || 'en'
  );
  const [country, setCountry] = useState<Country | null>(null);
  // R74 US foundation: required when country === 'US' for sales-tax
  // lookup + state-license routing. Ignored otherwise.
  const [usState, setUsState] = useState<string | null>(null);
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [selectedChallenges, setSelectedChallenges] = useState<string[]>([]);
  const [teamSize, setTeamSize] = useState<string | null>(null);
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [regFields, setRegFields] = useState<Record<string, string>>({});
  // R66 round 43: only show validation errors after the field is blurred
  // — typing-time errors are noisy and dismissive while the user is mid-
  // entry. Map of regField key → "user has finished typing this once".
  const [regFieldsTouched, setRegFieldsTouched] = useState<Record<string, boolean>>({});
  const [selectedCerts, setSelectedCerts] = useState<string[]>([]);
  const [postcode, setPostcode] = useState('');
  const [radius, setRadius] = useState(25);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionTier>('free');
  // Tracks whether the user has manually picked a tier on step 13. We only
  // auto-set the recommendation while this is still false — once they choose,
  // we never overwrite their explicit selection on re-entry.
  const [planManuallyPicked, setPlanManuallyPicked] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [submitting, setSubmitting] = useState(false);

  // Resume on mount: if the user already got partway through and backgrounded
  // the app, restore them to the same step with their partial answers.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('@vasco_onboarding_progress');
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (typeof saved.step === 'number' && saved.step > 1 && saved.step <= 14) setStep(saved.step);
        if (saved.language) setLanguage(saved.language);
        if (saved.country) setCountry(saved.country);
        if (saved.usState) setUsState(saved.usState);
        if (saved.trades) setSelectedTrades(saved.trades);
        if (saved.goals) setSelectedGoals(saved.goals);
        if (saved.challenges) setSelectedChallenges(saved.challenges);
        if (saved.teamSize) setTeamSize(saved.teamSize);
        if (saved.businessType) setBusinessType(saved.businessType);
        if (saved.regFields) setRegFields(saved.regFields);
        if (saved.certs) setSelectedCerts(saved.certs);
        if (saved.postcode) setPostcode(saved.postcode);
        if (typeof saved.radius === 'number') setRadius(saved.radius);
        if (saved.plan) {
          setSelectedPlan(saved.plan);
          setPlanManuallyPicked(true);
        }
        if (saved.billingCycle) setBillingCycle(saved.billingCycle);
      } catch {}
    })();
  }, []);

  // Pre-select the right-sized tier when the user lands on step 13 — unless
  // they've already manually picked one. Solo/small default to Pro; medium/large
  // default to Contractor. Replaces the old static 'free' default which was
  // wrong for every team larger than one.
  useEffect(() => {
    if (step !== 13 || planManuallyPicked) return;
    setSelectedPlan(recommendedTierForTeam(teamSize));
  }, [step, teamSize, planManuallyPicked]);

  // Persist progress on every step change so backgrounding never loses work
  useEffect(() => {
    AsyncStorage.setItem('@vasco_onboarding_progress', JSON.stringify({
      step, language, country, usState, trades: selectedTrades, goals: selectedGoals,
      challenges: selectedChallenges, teamSize, businessType, regFields,
      certs: selectedCerts, postcode, radius, plan: selectedPlan, billingCycle,
    })).catch(() => {});
  }, [step, language, country, usState, selectedTrades, selectedGoals, selectedChallenges,
      teamSize, businessType, regFields, selectedCerts, postcode, radius, selectedPlan, billingCycle]);

  // Gate cert step for regulated trades (electrical/plumbing/gas). User cannot
  // proceed past the cert step without selecting at least one cert.
  const REGULATED_TRADES = ['electrical', 'plumbing', 'gas'];
  const needsCertification = selectedTrades.some((t) => REGULATED_TRADES.includes(t));

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
      await AsyncStorage.setItem('@vasco_user_profile', JSON.stringify({ ...userUpdates, userId: user?.id })).catch(() => {});
      AsyncStorage.removeItem('@vasco_onboarding_progress').catch(() => {});
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
      // R66r52: step 9 (registration fields) is optional overall, but if a
      // contractor types anything in BTW/KvK/IBAN, the format must validate.
      // Was soft-warning only (R47); the gate at first-invoice-send (R39)
      // still catches everything, but blocking here too prevents the
      // contractor walking into the rest of onboarding under the impression
      // that their tax IDs are accepted.
      case 9: {
        // R74: US contractors must pick their state before reg fields —
        // gates EIN/state-license + downstream sales-tax routing.
        if (country === 'US' && !usState) return false;
        const fields = REG_FIELDS[country!] || [];
        for (const f of fields) {
          const v = (regFields[f.key] || '').trim();
          if (v.length > 0 && f.validate && !f.validate(v)) return false;
        }
        return true;
      }
      case 10: return !needsCertification || selectedCerts.length > 0;
      default: return true;
    }
  }, [step, country, selectedTrades, selectedGoals, selectedChallenges, teamSize, businessType, regFields, needsCertification, selectedCerts]);

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

      // R109: derive isAannemer from multi-trade selection. CLAUDE.md
      // defines aannemer as "coordinates multiple trades per project
      // (renovation GC)". If the user picked 2+ trades in onboarding,
      // they're an aannemer and should see the Projects tab + multi-trade
      // quote builder. Single-trade contractors see the streamlined
      // (contractor) view. Was previously NEVER set for real signups
      // — only the demo aannemer@vasco.dev account had it true —
      // meaning every werk.tsx `!!user?.isAannemer` gate evaluated false
      // for every real user.
      const isAannemer = selectedTrades.length > 1;

      const userUpdates = {
        trade: selectedTrades[0],
        country: country ?? undefined,
        language,
        onboardingComplete: true,
        isAannemer,
      };
      updateUser(userUpdates);
      await AsyncStorage.setItem('@vasco_user_profile', JSON.stringify({ ...userUpdates, userId: user?.id })).catch(() => {});
      AsyncStorage.removeItem('@vasco_onboarding_progress').catch(() => {});

      // R108: persist onboarding completion + country/trade/language to
      // Supabase user_metadata. Local AsyncStorage alone is per-device —
      // if the contractor reinstalls or signs in on a second device the
      // onboarding flow would otherwise re-fire. user_metadata travels
      // with the auth session, so the cold-start AuthContext.getSession
      // resolver picks it up and the redirect lands on /(contractor)
      // instead of /onboarding.
      try {
        const { isSupabaseConfigured: cfg, supabase: sb } = await import('../src/lib/supabase');
        if (cfg) {
          await sb.auth.updateUser({
            data: {
              onboarding_complete: true,
              country: country ?? undefined,
              trade: selectedTrades[0],
              language,
              is_aannemer: isAannemer,
              // R109: teamSize captured so downstream UI can hide
              // worker/crew/payroll surfaces for solo contractors.
              team_size: teamSize ?? 'solo',
            },
          });
        }
      } catch {
        // Non-fatal: local AsyncStorage still has the flag.
      }

      // Push captured registration fields into AppState.businessProfile so
      // the invoice-send legal gate (R145) sees the real values on day one.
      try {
        const countryVatKey = country === 'NL' ? 'btw'
          : country === 'DE' ? 'ustIdNr'
          : country === 'FR' ? 'tva'
          : country === 'ES' ? 'nif'
          : country === 'IT' ? 'partitaIva'
          : country === 'UK' ? 'vatNumber'
          : 'vatNumber';
        const regRegKey = country === 'NL' ? 'kvk'
          : country === 'DE' ? 'hrb'
          : country === 'FR' ? 'siret'
          : country === 'UK' ? 'companyNumber'
          : country === 'ES' ? 'nif'
          : country === 'IT' ? 'codiceFiscale'
          : 'kvk';
        // R264: pre-apply confident VAT scheme so the contractor lands already
        // configured rather than discovering it in settings later. Only applies
        // when advisor.confident=true (NL eenmanszaak+solo or DE Einzel+solo).
        const { suggestVatScheme } = await import('../src/services/vatSchemeAdvisor');
        const advice = suggestVatScheme({ country, businessType, teamSize });
        const vatSchemeToApply = advice.confident ? advice.suggested : 'standard';

        await updateBusinessProfile({
          country: (country ?? undefined) as any,
          // R74 US foundation: state code threaded for sales-tax lookup +
          // state-license routing. Ignored for non-US countries.
          state: country === 'US' ? (usState ?? undefined) : undefined,
          trade: selectedTrades[0],
          businessType: businessType ?? undefined,
          teamSize: (teamSize as any) ?? undefined,
          vatScheme: vatSchemeToApply,
          businessName: regFields.businessName || regFields.companyName || regFields.tradeName,
          kvkNumber: regFields[regRegKey] || regFields.kvk,
          vatNumber: regFields[countryVatKey] || regFields.vatNumber,
          registrationNumber: regFields[regRegKey] || regFields.registrationNumber,
          address: regFields.address || regFields.businessAddress,
        });

        // Surface a one-shot toast so the contractor knows it was preset and
        // can change it if their turnover will exceed the threshold.
        if (advice.confident) {
          const toastKey = vatSchemeToApply === 'small_business_NL_KOR'
            ? 'onboarding.vatPresetKor'
            : 'onboarding.vatPresetKlein';
          Alert.alert(
            t('onboarding.vatPresetTitle', 'VAT scheme set'),
            t(toastKey, vatSchemeToApply === 'small_business_NL_KOR'
              ? 'Selected KOR — change in Settings if turnover will exceed €20.000.'
              : 'Selected Kleinunternehmer — change in Settings if turnover will exceed €22.000.'),
          );
        }
      } catch {}

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
      // Tell the Vandaag screen this contractor has not interacted with the
      // app yet — drives the simplified first-login hero. Cleared automatically
      // when they create their first quote / invoice / customer.
      await AsyncStorage.setItem('@vasco_first_login_pending', 'true').catch(() => {});

      // Analytics event: funnel — signup → onboarding completed → first quote → first invoice → first paid
      try {
        const { isSupabaseConfigured, supabase } = await import('../src/lib/supabase');
        const authUser = isSupabaseConfigured ? (await supabase.auth.getUser()).data.user : null;
        const uid = authUser?.id ?? `anon_${Date.now()}`;
        await emitOnboardingCompleted(uid, {
          country: country ?? 'unknown',
          trade: selectedTrades[0] ?? 'unknown',
          teamSize: teamSize ?? 'unknown',
          tierSelected: selectedPlan ?? 'free',
          stepsCompleted: TOTAL_STEPS,
          durationSeconds: Math.round((Date.now() - onboardingStartRef.current) / 1000),
        });
      } catch {}

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
            <View style={styles.logoWrap}>
              {/* R92: official VascoBuild logo. R119: resizeMode="contain"
                  so the icon's "VascoBuild" wordmark renders fully. */}
              <Image
                source={require('../assets/icon.png')}
                style={styles.logoContainer}
                resizeMode="contain"
                accessibilityLabel="VascoBuild"
              />
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
            {/* R119: gated behind DEMO_MODE so real signups don't see
                "Try with Demo Data". In production this button bypassed
                onboarding entirely and dumped the user straight into
                Vandaag with pre-seeded NL/plumbing context — a real
                contractor who tapped it ended up with someone else's
                trade and country. */}
            {DEMO_MODE ? (
              <Pressable
                style={({ pressed }) => [styles.demoButton, pressed && styles.pressed]}
                onPress={handleDemoMode}
                accessibilityRole="button"
                accessibilityLabel={t('onboarding.tryDemo', 'Try with Demo Data')}
              >
                <Ionicons name="play-circle-outline" size={18} color={Palette.hermesOrange} />
                <Text style={styles.demoButtonText}>{t('onboarding.tryDemo', 'Try with Demo Data')}</Text>
              </Pressable>
            ) : null}
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
            {/* R74: US state picker — sales-tax + state-license routing.
                R119: explicitly flag the state as required since the
                "(Optional)" tag on the EIN/state-license fields below
                made testers assume the whole step was skippable.
                canProceed() blocks Next when no state is selected. */}
            {country === 'US' ? (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {t('onboarding.fields.state', { defaultValue: 'State' })} <Text style={styles.requiredTag}>({t('common.required', 'Required')})</Text>
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID.sm }}>
                  {US_STATE_OPTIONS.map((s) => {
                    const selected = usState === s.code;
                    return (
                      <Pressable
                        key={s.code}
                        onPress={() => setUsState(s.code)}
                        style={[
                          styles.stateChip,
                          selected && styles.stateChipSelected,
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text style={[
                          styles.stateChipText,
                          selected && styles.stateChipTextSelected,
                        ]}>
                          {s.code}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
            {(REG_FIELDS[country!] || []).map((field) => {
              // R66 round 47: input-time validation per R43 staged foundation.
              // Only show error after onBlur so we don't nag mid-typing. Format
              // hint surfaces the country-specific example (NL123456789B01,
              // DE123456789, etc.) when the value is non-empty + malformed.
              const value = regFields[field.key] || '';
              const touched = regFieldsTouched[field.key] === true;
              const hasError = touched && value.trim().length > 0 && field.validate ? !field.validate(value) : false;
              const errorMsg = hasError && field.errorKey
                ? field.errorKey === 'profile.vatFormatInvalid'
                  ? t('profile.vatFormatInvalid', { defaultValue: 'VAT number format invalid (expected e.g. {{example}})', example: VAT_EXAMPLE[country!] })
                  : t(field.errorKey, { defaultValue: 'Format invalid' })
                : null;
              return (
                <View key={field.key} style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    {t(field.i18nKey)} <Text style={styles.optionalTag}>({t('common.optional')})</Text>
                  </Text>
                  <TextInput
                    style={[styles.textInput, hasError && styles.textInputError]}
                    value={value}
                    onChangeText={(v) => setRegFields((prev) => ({ ...prev, [field.key]: v }))}
                    onBlur={() => setRegFieldsTouched((prev) => ({ ...prev, [field.key]: true }))}
                    placeholder={field.placeholder ?? ''}
                    placeholderTextColor={SemanticColors.textTertiary}
                    autoCapitalize="characters"
                  />
                  {errorMsg ? <Text style={styles.fieldError}>{errorMsg}</Text> : null}
                </View>
              );
            })}
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
                placeholder={country === 'US' ? '90210' : country === 'UK' ? 'SW1A 1AA' : country === 'DE' ? '10115' : country === 'FR' ? '75001' : country === 'ES' ? '28013' : country === 'IT' ? '00184' : '1234 AB'}
                placeholderTextColor={SemanticColors.textTertiary}
                autoCapitalize="characters"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {/* R117: country-aware distance unit. US contractors think
                    in miles; everyone else in km. */}
                {t('onboarding.radius')}: {radius} {country === 'US' ? t('common.miles', 'mi') : t('common.km', 'km')}
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
                      {r} {country === 'US' ? t('common.miles', 'mi') : t('common.km', 'km')}
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
        const proTier = TIERS.pro;
        const contractorTier = TIERS.contractor;
        // Badge follows the teamSize-derived recommendation so a 10-person
        // crew lead sees "RECOMMENDED FOR YOU" on Contractor, not Pro.
        // Aannemer = 2+ trades selected → renovation GC → Contractor tier
        // is the right recommendation regardless of team size.
        const recommendedTier = recommendedTierForTeam(teamSize, selectedTrades.length);
        const isAannemerOnboarding = selectedTrades.length >= 2;
        const recommendedBadge = isAannemerOnboarding
          ? t('onboarding.bestForAannemers', 'BEST FOR AANNEMERS')
          : t('onboarding.recommendedForYou', 'RECOMMENDED FOR YOU');

        const plans: { id: SubscriptionTier; name: string; price: number; annualPrice: number; badge?: string; commission: string; features: { text: string; highlight?: boolean }[] }[] = [
          {
            id: 'free',
            name: 'Free',
            price: 0,
            annualPrice: 0,
            badge: recommendedTier === 'free' ? recommendedBadge : undefined,
            commission: '3.5%',
            features: [
              { text: `${freeTier.limits.maxActiveJobs} ${t('common.jobs', 'jobs')}` },
              { text: `${freeTier.limits.maxQuotesPerMonth} ${t('common.quotesMonth', 'quotes/month')}` },
              { text: '3.5% ' + t('common.perInvoice', 'per paid invoice') },
            ],
          },
          {
            id: 'pro',
            name: 'Pro',
            price: proTier.monthlyPrice,
            annualPrice: proTier.annualMonthlyPrice,
            badge: recommendedTier === 'pro' ? recommendedBadge : undefined,
            commission: '2%',
            features: [
              { text: t('common.unlimited', 'Unlimited') + ' ' + t('common.jobs', 'jobs'), highlight: true },
              { text: t('common.fullAi', 'Full AI suite'), highlight: true },
              { text: t('common.purchasingAgent', 'Purchasing agent'), highlight: true },
              { text: '2% ' + t('common.perInvoice', 'per paid invoice'), highlight: true },
            ],
          },
          {
            id: 'contractor',
            name: isAannemerOnboarding ? t('onboarding.contractorTierAannemer', 'Aannemer') : 'Contractor',
            price: contractorTier.monthlyPrice,
            annualPrice: contractorTier.annualMonthlyPrice,
            badge: recommendedTier === 'contractor' ? recommendedBadge : undefined,
            commission: '1%',
            features: isAannemerOnboarding
              ? [
                  { text: t('onboarding.featAannemerProjects', 'Multi-trade project boards'), highlight: true },
                  { text: t('onboarding.featAannemerSubs', 'Subcontractor coordination + seats'), highlight: true },
                  { text: t('onboarding.featAannemerQuote', 'Cross-trade quote builder'), highlight: true },
                  { text: '1% ' + t('common.perInvoice', 'per paid invoice'), highlight: true },
                ]
              : [
                  { text: t('common.teamFeatures', 'Team features'), highlight: true },
                  { text: `${contractorTier.limits.maxTeamSeats} ${t('common.seats', 'seats')}`, highlight: true },
                  // Was 'API + white-label'. Neither exists: there is no public
                  // API surface and no white-label theming anywhere in the app,
                  // and hasApiAccess/hasWhiteLabel have zero consumers. Selling
                  // them at EUR 69 is a promise the product cannot keep.
                  // Dedicated support and onboarding assistance are the two
                  // top-tier promises the operator can actually honour today.
                  { text: t('common.supportOnboarding', 'Dedicated support + onboarding'), highlight: true },
                  { text: '1% ' + t('common.perInvoice', 'per paid invoice'), highlight: true },
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
                  onPress={() => {
                    setSelectedPlan(plan.id);
                    setPlanManuallyPicked(true);
                  }}
                  accessibilityRole="button"
                >
                  {hasBadge && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularBadgeText}>{plan.badge}</Text>
                    </View>
                  )}
                  <View style={styles.planHeader}>
                    <Text style={styles.planName}>{plan.name}</Text>
                    {/* R117: country-aware currency. US contractors see $;
                        UK contractors see £; rest of EU sees €. Pricing
                        figures are still defined in EUR by subscriptionService
                        — converting numeric values is out of scope here. */}
                    {displayPrice === 0 ? (
                      <Text style={styles.planPrice}>{country === 'US' ? '$0' : country === 'UK' ? '£0' : '€0'}</Text>
                    ) : (
                      <View style={styles.planPriceRow}>
                        <Text style={styles.planPriceLarge}>{country === 'US' ? '$' : country === 'UK' ? '£' : '€'}{displayPrice}</Text>
                        <Text style={styles.planPricePeriod}>{t('onboarding.perMonth', '/mo')}</Text>
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
          // R117: country-aware unit + currency in the review summary.
          { label: t('onboarding.serviceArea', 'Service area'), value: postcode ? `${postcode} (${radius} ${country === 'US' ? t('common.miles', 'mi') : t('common.km', 'km')})` : '-' },
          { label: t('onboarding.certifications', 'Certifications'), value: selectedCerts.length > 0 ? selectedCerts.join(', ') : '-' },
          { label: t('onboarding.language', 'Language'), value: langLabel ? `${langLabel.flag} ${langLabel.label}` : '-' },
          { label: t('onboarding.choosePlan', 'Plan'), value: selectedPlan === 'free' ? 'Free' : `${TIERS[selectedPlan].name} (${country === 'US' ? '$' : country === 'UK' ? '£' : '€'}${billingCycle === 'annual' ? TIERS[selectedPlan].annualMonthlyPrice : TIERS[selectedPlan].monthlyPrice}${t('onboarding.perMonth', '/mo')})` },
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

      {/* R119: wrap the scroll in KeyboardAvoidingView so steps with
          TextInputs (step 9 reg fields, step 11 postcode) push above the
          keyboard. Pre-R119 the iOS keyboard covered the inputs entirely
          — users couldn't see what they were typing. iOS uses 'padding'
          behavior; Android relies on android:windowSoftInputMode in
          AndroidManifest which Expo sets to adjustResize by default. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <FadeIn key={step} delay={0} duration={300}>
            {renderStep()}
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>

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
    width: 24,
    backgroundColor: Palette.hermesOrange,
    shadowColor: Palette.hermesOrange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
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
  logoWrap: {
    marginBottom: 8,
    shadowColor: DK.colors.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 22,
    elevation: 10,
  },
  logoContainer: {
    // R119: borderRadius removed (was circular-clipping the VascoBuild
    // icon corners). R107 fixed this on login/signup/forgot/reset but
    // missed the welcome step of the onboarding flow.
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 40,
    fontFamily: 'Archivo_900Black',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  welcomeTitle: {
    fontSize: 32,
    fontFamily: 'Archivo_900Black',
    color: SemanticColors.textPrimary,
    textAlign: 'center',
    letterSpacing: -1,
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
    fontFamily: 'Archivo_900Black',
    color: SemanticColors.textPrimary,
    letterSpacing: -0.5,
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
    backgroundColor: `${Palette.hermesOrange}1A`,
    shadowColor: Palette.hermesOrange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
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
    backgroundColor: `${Palette.hermesOrange}22`,
    shadowColor: Palette.hermesOrange,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  tradeChipText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textPrimary,
  },
  // R74 US foundation: compact chip variant for the state picker — same
  // selected-state treatment as tradeChip, but narrower since we render
  // 51 of them (50 states + DC).
  stateChip: {
    minWidth: 56,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 1.5,
    borderColor: SemanticColors.borderDefault,
    alignItems: 'center',
  },
  stateChipSelected: {
    borderColor: Palette.hermesOrange,
    backgroundColor: `${Palette.hermesOrange}22`,
    shadowColor: Palette.hermesOrange,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  stateChipText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textPrimary,
    letterSpacing: 0.6,
  },
  stateChipTextSelected: {
    color: Palette.hermesOrange,
    fontFamily: TYPE.titleFamily,
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
    backgroundColor: `${Palette.hermesOrange}1A`,
    shadowColor: Palette.hermesOrange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
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
    backgroundColor: `${Palette.hermesOrange}1A`,
    shadowColor: Palette.hermesOrange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
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
  requiredTag: {
    color: Palette.hermesOrange,
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
  // R66 round 47: input-time validation states (R39 staged → wired)
  textInputError: {
    borderColor: SemanticColors.feedbackError,
  },
  fieldError: {
    fontSize: 12,
    color: SemanticColors.feedbackError,
    fontFamily: TYPE.bodyFamily,
    marginTop: 6,
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
