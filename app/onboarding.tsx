import { useState, useCallback, useRef } from 'react';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TOTAL_STEPS = 8;

const TRADES = ['plumbing', 'electrical', 'gas', 'painting', 'carpentry', 'general', 'other'] as const;

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

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, updateUser } = useAuth();

  const [step, setStep] = useState(1);
  const [country, setCountry] = useState<Country | null>(null);
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [regFields, setRegFields] = useState<Record<string, string>>({});
  const [selectedCerts, setSelectedCerts] = useState<string[]>([]);
  const [postcode, setPostcode] = useState('');
  const [radius, setRadius] = useState(25);
  const [language, setLanguage] = useState<Language>(
    (i18n.language as Language) || 'en'
  );
  const [submitting, setSubmitting] = useState(false);

  const toggleTrade = (trade: string) => {
    setSelectedTrades((prev) =>
      prev.includes(trade) ? prev.filter((t) => t !== trade) : [...prev, trade]
    );
  };

  const toggleCert = (cert: string) => {
    setSelectedCerts((prev) =>
      prev.includes(cert) ? prev.filter((c) => c !== cert) : [...prev, cert]
    );
  };

  const canProceed = useCallback(() => {
    switch (step) {
      case 2: return country !== null;
      case 3: return selectedTrades.length > 0;
      case 4: return businessType !== null;
      default: return true;
    }
  }, [step, country, selectedTrades, businessType]);

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
        businessType,
        registrationFields: regFields,
        certifications: selectedCerts,
        postcode,
        serviceRadius: radius,
        completedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem('@vasco_onboarding', JSON.stringify(onboardingData));

      // Persist user profile to AsyncStorage so it survives app restart
      const userUpdates = {
        trade: selectedTrades[0],
        country: country ?? undefined,
        language,
        onboardingComplete: true,
      };
      updateUser(userUpdates);
      await AsyncStorage.setItem('@vasco_user_profile', JSON.stringify(userUpdates)).catch(() => {});

      i18n.changeLanguage(language);

      // Seed data for new users — so screens aren't empty
      const tradeLabel = selectedTrades[0] ?? 'general';
      const seedJobTitle = tradeLabel === 'plumbing'
        ? t('onboarding.seedJobPlumbing', 'Boiler maintenance')
        : tradeLabel === 'electrical'
          ? t('onboarding.seedJobElectrical', 'Fuse box replacement')
          : t('onboarding.seedJobGeneral', 'Example job');
      const seedJobs = [
        { id: `j-seed-1`, title: seedJobTitle, customerId: null, description: t('onboarding.seedJobDescription', 'Example job — delete or edit this'), status: 'lead' as const, trade: tradeLabel, priority: 'normal' as const, photos: [], notes: [], timeEntries: [], materials: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
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
      case 1:
        return (
          <View style={styles.centeredContent}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>V</Text>
            </View>
            <Text style={styles.welcomeTitle}>{t('onboarding.welcome')}</Text>
            <Text style={styles.welcomeSubtitle}>{t('onboarding.subtitle')}</Text>
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              onPress={handleNext}
            >
              <Text style={styles.primaryButtonText}>{t('onboarding.getStarted')}</Text>
            </Pressable>
          </View>
        );

      case 2:
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
                    setLanguage(getDefaultLanguage(c.code));
                  }}
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

      case 3:
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

      case 4:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{t('onboarding.businessType')}</Text>
            <View style={styles.optionGrid}>
              {(BUSINESS_TYPES[country!] || []).map((bt) => (
                <Pressable
                  key={bt.key}
                  style={[styles.optionCard, businessType === bt.key && styles.optionSelected]}
                  onPress={() => setBusinessType(bt.key)}
                >
                  <Text style={[styles.optionLabel, businessType === bt.key && styles.optionLabelSelected]}>
                    {t(`onboarding.businessTypes.${bt.key}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        );

      case 5:
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

      case 6: {
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

            {/* Compliance info card */}
            <View style={styles.complianceInfoCard}>
              <Ionicons name="shield-checkmark-outline" size={18} color={Palette.hermesOrange} style={{ marginTop: 1 }} />
              <Text style={styles.complianceInfoText}>
                {t('onboarding.complianceInfo', 'Vasco monitors your certifications and warns on expiry. You also receive notifications for VAT deadlines and insurance.')}
              </Text>
            </View>
          </View>
        );
      }

      case 7:
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

      case 8: {
        const countryLabel = COUNTRIES.find(c => c.code === country);
        const langLabel = LANGUAGES.find(l => l.code === language);
        const reviewItems = [
          { label: t('onboarding.selectCountry', 'Land'), value: countryLabel ? `${countryLabel.flag} ${countryLabel.label}` : '-' },
          { label: t('onboarding.selectTrade', 'Vakgebied'), value: selectedTrades.map(tr => t(`onboarding.trades.${tr}`)).join(', ') || '-' },
          { label: t('onboarding.businessType', 'Bedrijfsvorm'), value: businessType ? t(`onboarding.businessTypes.${businessType}`) : '-' },
          { label: t('onboarding.serviceArea', 'Werkgebied'), value: postcode ? `${postcode} (${radius} km)` : '-' },
          { label: t('onboarding.certifications', 'Certificeringen'), value: selectedCerts.length > 0 ? selectedCerts.join(', ') : '-' },
          { label: t('onboarding.language', 'Taal'), value: langLabel ? `${langLabel.flag} ${langLabel.label}` : '-' },
        ];
        return (
          <View style={styles.stepContent}>
            <View style={styles.reviewHeader}>
              <Ionicons name="checkmark-circle" size={48} color={SemanticColors.feedbackSuccess} />
              <Text style={styles.stepTitle}>{t('onboarding.complete', 'Helemaal klaar!')}</Text>
              <Text style={styles.stepSubtitle}>{t('onboarding.completeDesc', 'Controleer je gegevens')}</Text>
            </View>
            <View style={styles.reviewCard}>
              {reviewItems.map((item, i) => (
                <View key={item.label} style={[styles.reviewRow, i < reviewItems.length - 1 && styles.reviewRowBorder]}>
                  <Text style={styles.reviewLabel}>{item.label}</Text>
                  <Text style={styles.reviewValue} numberOfLines={2}>{item.value}</Text>
                </View>
              ))}
            </View>
            {/* Settings hint */}
            <View style={styles.settingsHint}>
              <Ionicons name="information-circle-outline" size={16} color={SemanticColors.textTertiary} />
              <Text style={styles.settingsHintText}>
                {t('onboarding.settingsHint', 'You can set up integrations, notifications and templates later via Compliance.')}
              </Text>
            </View>

            {/* Language switcher inline */}
            <View style={styles.langRow}>
              {LANGUAGES.map((lang) => (
                <Pressable
                  key={lang.code}
                  style={[styles.langChip, language === lang.code && styles.langChipSelected]}
                  onPress={() => { setLanguage(lang.code); i18n.changeLanguage(lang.code); }}
                >
                  <Text style={styles.langFlag}>{lang.flag}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        );
      }

      default:
        return null;
    }
  };

  return (
    <View style={styles.screen}>
      {step > 1 && (
        <View style={styles.header}>
          <Pressable onPress={handleBack} hitSlop={8} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
          </Pressable>
          <Text style={styles.stepText}>
            {t('onboarding.step', { current: step, total: TOTAL_STEPS })}
          </Text>
          {step >= 5 && step < TOTAL_STEPS && (
            <Pressable onPress={handleNext} hitSlop={8}>
              <Text style={styles.skipText}>{t('common.skip')}</Text>
            </Pressable>
          )}
          {(step < 5 || step === TOTAL_STEPS) && <View style={{ width: 50 }} />}
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
            >
              <Text style={styles.primaryButtonText}>{t('common.next')}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SafeArea.top,
    paddingHorizontal: SafeArea.side,
    paddingBottom: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: SemanticColors.textSecondary,
  },
  skipText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Palette.hermesOrange,
  },
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 12,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SemanticColors.borderDefault,
  },
  stepDotActive: {
    width: 24,
    backgroundColor: Palette.hermesOrange,
  },
  stepDotDone: {
    backgroundColor: Palette.pastelOrange,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SafeArea.side,
  },
  centeredContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingBottom: 80,
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
    fontFamily: 'Manrope_800ExtraBold',
    color: Palette.white,
  },
  welcomeTitle: {
    fontSize: 30,
    fontFamily: 'Manrope_800ExtraBold',
    color: SemanticColors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  welcomeSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
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
    fontFamily: 'Manrope_700Bold',
    color: SemanticColors.textPrimary,
    letterSpacing: -0.3,
  },
  stepSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
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
    borderRadius: 14,
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
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: SemanticColors.textPrimary,
  },
  optionLabelSelected: {
    color: Palette.hermesOrange,
    fontFamily: 'Inter_600SemiBold',
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
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: SemanticColors.textPrimary,
  },
  tradeChipTextSelected: {
    color: Palette.hermesOrange,
    fontFamily: 'Inter_600SemiBold',
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: SemanticColors.textPrimary,
  },
  optionalTag: {
    color: SemanticColors.textTertiary,
    fontFamily: 'Inter_400Regular',
  },
  textInput: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: SemanticColors.textPrimary,
  },
  radiusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  radiusChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
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
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: SemanticColors.textSecondary,
  },
  radiusChipTextSelected: {
    color: Palette.hermesOrange,
    fontFamily: 'Inter_600SemiBold',
  },
  paymentPreview: {
    marginTop: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  paymentPreviewLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
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
    borderRadius: 10,
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
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: SemanticColors.textPrimary,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: SemanticColors.textTertiary,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  complianceInfoCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
  },
  complianceInfoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
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
    borderRadius: 14,
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
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: SemanticColors.textSecondary,
  },
  reviewValue: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: SemanticColors.textPrimary,
    textAlign: 'right',
    maxWidth: '55%',
  },
  settingsHint: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  settingsHintText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: SemanticColors.textTertiary,
    lineHeight: 17,
  },
  langRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  langChip: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: SemanticColors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langChipSelected: {
    borderColor: Palette.hermesOrange,
    backgroundColor: `${Palette.hermesOrange}08`,
  },
  langFlag: {
    fontSize: 22,
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
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: Palette.white,
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
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
