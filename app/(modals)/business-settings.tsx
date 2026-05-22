import { useRouter } from 'expo-router';
import { useState, useCallback, useMemo } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { logError } from '../../src/utils/errorHandler';
import { Screen } from '../../src/components/Screen';
import { Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAppState } from '../../src/state/AppState';
import { useAuth } from '../../src/context/AuthContext';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PROVIDERS, type AccountingProvider } from '../../src/integrations/accounting';
import { Radius } from '../../src/theme/radius';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';
import { isValidEmail, isValidPhone, isValidKvKNumber, isValidVATNumber, isValidIBAN, sanitizeInput } from '../../src/utils/validation';
import { getPaymentDisplayForCountry, getPaymentBrandColor } from '../../src/config/paymentMethods';
import { getMollieMethodsForCountry } from '../../src/config/paymentMethods';
import { STRIPE_METHODS_UK } from '../../src/config/paymentMethods';

type FieldDef = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'number-pad' | 'email-address' | 'phone-pad';
  multiline?: boolean;
};

export default function BusinessSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { businessProfile, updateBusinessProfile } = useAppState();
  const { user } = useAuth();
  const country = user?.country ?? 'NL';

  const [businessName, setBusinessName] = useState(businessProfile.businessName ?? '');
  const [kvkNumber, setKvkNumber] = useState(businessProfile.kvkNumber ?? '');
  const [vatNumber, setVatNumber] = useState(businessProfile.vatNumber ?? '');
  const [registrationNumber, setRegistrationNumber] = useState(businessProfile.registrationNumber ?? '');
  const [address, setAddress] = useState(businessProfile.address ?? '');
  const [email, setEmail] = useState(businessProfile.email ?? '');
  const [phone, setPhone] = useState(businessProfile.phone ?? '');
  // R66 NL launch: payment fields. Without IBAN every NL invoice goes
  // out with no bank details — customer can't pay.
  const [iban, setIban] = useState(businessProfile.iban ?? '');
  const [bic, setBic] = useState(businessProfile.bic ?? '');
  const [saving, setSaving] = useState(false);

  // Payment methods — get all available for the country, default all enabled
  const allPaymentMethods = useMemo(() => {
    if (country === 'UK') return STRIPE_METHODS_UK.map(m => String(m));
    return getMollieMethodsForCountry(country).methods;
  }, [country]);
  const paymentDisplay = useMemo(() => getPaymentDisplayForCountry(country), [country]);
  const [enabledPaymentMethods, setEnabledPaymentMethods] = useState<string[]>(
    businessProfile.enabledPaymentMethods ?? [...allPaymentMethods]
  );

  // Country-specific fields
  const fields = useMemo((): FieldDef[] => {
    const common: FieldDef[] = [
      { label: t('settings.business', 'Bedrijfsnaam'), value: businessName, onChange: setBusinessName, placeholder: 'Schilder & Zonen B.V.' },
    ];

    const countryFields: FieldDef[] = (() => {
      switch (country) {
        case 'NL':
          return [
            { label: t('onboarding.fields.kvk', 'KvK-nummer'), value: kvkNumber, onChange: setKvkNumber, placeholder: '12345678', keyboardType: 'number-pad' as const },
            { label: t('onboarding.fields.btw', 'BTW-nummer'), value: vatNumber, onChange: setVatNumber, placeholder: 'NL123456789B01' },
          ];
        case 'UK':
          return [
            { label: t('onboarding.fields.companiesHouse', 'Companies House No.'), value: registrationNumber, onChange: setRegistrationNumber, placeholder: '12345678' },
            { label: t('onboarding.fields.vatNumber', 'VAT Number'), value: vatNumber, onChange: setVatNumber, placeholder: 'GB123456789' },
          ];
        case 'DE':
          return [
            { label: t('onboarding.fields.handelsregister', 'Handelsregisternr.'), value: registrationNumber, onChange: setRegistrationNumber, placeholder: 'HRB 12345' },
            { label: t('onboarding.fields.ustId', 'USt-IdNr.'), value: vatNumber, onChange: setVatNumber, placeholder: 'DE123456789' },
            { label: t('onboarding.fields.steuernummer', 'Steuernummer'), value: kvkNumber, onChange: setKvkNumber, placeholder: '12/345/67890' },
          ];
        case 'FR':
          return [
            { label: t('onboarding.fields.siret', 'SIRET'), value: registrationNumber, onChange: setRegistrationNumber, placeholder: '123 456 789 00012' },
            { label: t('onboarding.fields.tvaIntra', 'N° TVA'), value: vatNumber, onChange: setVatNumber, placeholder: 'FR12345678901' },
          ];
        case 'ES':
          return [
            { label: t('onboarding.fields.nif', 'NIF/CIF'), value: registrationNumber, onChange: setRegistrationNumber, placeholder: '12345678A' },
            { label: t('onboarding.fields.iae', 'IAE'), value: kvkNumber, onChange: setKvkNumber, placeholder: '504.1' },
          ];
        case 'IT':
          return [
            { label: t('onboarding.fields.partitaIva', 'Partita IVA'), value: vatNumber, onChange: setVatNumber, placeholder: 'IT12345678901' },
            { label: t('onboarding.fields.cameraCommercio', 'Camera di Commercio'), value: registrationNumber, onChange: setRegistrationNumber, placeholder: 'REA MI-1234567' },
          ];
        default:
          return [];
      }
    })();

    // R16.4: was using `customers.contact` for BOTH Address and Phone labels
    // — that's a single i18n key that can't be both. The label that key
    // resolved to ("Contact" / "Contactgegevens") rendered for both fields.
    // Plus "Email" was hardcoded English. Plus the Dutch-only placeholders
    // ("Keizersgracht 100, Amsterdam" / "info@bedrijf.nl") were shown to
    // contractors in every country. Now uses dedicated keys + country-aware
    // address example.
    const addressPlaceholder =
      country === 'UK' ? '10 Downing Street, London' :
      country === 'DE' ? 'Hauptstr. 12, Berlin' :
      country === 'FR' ? '12 Rue de Rivoli, Paris' :
      country === 'ES' ? 'Calle Mayor 12, Madrid' :
      country === 'IT' ? 'Via Roma 12, Milano' :
      'Keizersgracht 100, Amsterdam';
    const emailPlaceholder =
      country === 'UK' ? 'info@business.co.uk' :
      country === 'DE' ? 'info@firma.de' :
      country === 'FR' ? 'info@entreprise.fr' :
      country === 'ES' ? 'info@empresa.es' :
      country === 'IT' ? 'info@azienda.it' :
      'info@bedrijf.nl';
    const contactFields: FieldDef[] = [
      { label: t('settings.address', 'Address'), value: address, onChange: setAddress, placeholder: addressPlaceholder, multiline: true },
      { label: t('settings.email', 'Email'), value: email, onChange: setEmail, placeholder: emailPlaceholder, keyboardType: 'email-address' as const },
      { label: t('settings.phone', 'Phone'), value: phone, onChange: setPhone, placeholder: country === 'UK' ? '+44 20 1234 5678' : country === 'DE' ? '+49 30 1234567' : country === 'FR' ? '+33 1 23 45 67 89' : country === 'ES' ? '+34 612 345 678' : country === 'IT' ? '+39 06 1234 5678' : '+31 6 12345678', keyboardType: 'phone-pad' as const },
    ];

    // R66 NL launch: payment fields the migration declared but UI never
    // exposed. NL contractors need IBAN; BIC is optional in EU SEPA.
    // Country-specific IBAN format hint avoids "what do I type here".
    const ibanPlaceholder =
      country === 'UK' ? 'GB29 NWBK 6016 1331 9268 19' :
      country === 'DE' ? 'DE89 3704 0044 0532 0130 00' :
      country === 'FR' ? 'FR14 2004 1010 0505 0001 3M02 606' :
      country === 'ES' ? 'ES91 2100 0418 4502 0005 1332' :
      country === 'IT' ? 'IT60 X054 2811 1010 0000 0123 456' :
      'NL91 ABNA 0417 1643 00';
    const paymentFields: FieldDef[] = [
      { label: t('settings.iban', 'IBAN'), value: iban, onChange: setIban, placeholder: ibanPlaceholder },
      { label: t('settings.bic', 'BIC / SWIFT'), value: bic, onChange: setBic, placeholder: country === 'NL' ? 'ABNANL2A' : country === 'DE' ? 'COBADEFFXXX' : '' },
    ];

    return [...common, ...countryFields, ...contactFields, ...paymentFields];
  }, [country, businessName, kvkNumber, vatNumber, registrationNumber, address, email, phone, iban, bic, t]);

  const handleSave = useCallback(async () => {
    // Sanitize all inputs
    const cleanEmail = sanitizeInput(email);
    const cleanPhone = sanitizeInput(phone);
    const cleanKvk = sanitizeInput(kvkNumber);
    const cleanVat = sanitizeInput(vatNumber);
    // R66: clean + validate IBAN/BIC. Strip spaces (visual grouping)
    // before validating since users typically paste with spaces in.
    const cleanIban = sanitizeInput(iban).replace(/\s/g, '').toUpperCase();
    const cleanBic = sanitizeInput(bic).replace(/\s/g, '').toUpperCase();

    // Validate email if provided
    if (cleanEmail && !isValidEmail(cleanEmail)) {
      Alert.alert(t('common.error', 'Error'), t('validation.invalidEmail', 'Please enter a valid email address'));
      return;
    }
    // Validate phone if provided
    if (cleanPhone && !isValidPhone(cleanPhone)) {
      Alert.alert(t('common.error', 'Error'), t('validation.invalidPhone', 'Please enter a valid phone number'));
      return;
    }
    // Validate KvK number if provided (NL only)
    if (cleanKvk && country === 'NL' && !isValidKvKNumber(cleanKvk)) {
      Alert.alert(t('common.error', 'Error'), t('validation.invalidKvK', 'KvK number must be 8 digits'));
      return;
    }
    // Validate VAT number if provided
    if (cleanVat && !isValidVATNumber(cleanVat)) {
      Alert.alert(t('common.error', 'Error'), t('validation.invalidVAT', 'Please enter a valid VAT number (e.g. NL123456789B01)'));
      return;
    }
    // R66 NL launch: validate IBAN — without this NL invoice PDFs
    // render whatever string the contractor typed in the bank-details
    // section. isValidIBAN was imported but never called pre-R66.
    if (cleanIban && !isValidIBAN(cleanIban)) {
      Alert.alert(t('common.error', 'Error'), t('validation.invalidIBAN', 'Please enter a valid IBAN (e.g. NL91 ABNA 0417 1643 00)'));
      return;
    }

    setSaving(true);
    try {
      await updateBusinessProfile({
        businessName: sanitizeInput(businessName).trim(),
        kvkNumber: cleanKvk.trim(),
        vatNumber: cleanVat.trim(),
        registrationNumber: sanitizeInput(registrationNumber).trim(),
        address: sanitizeInput(address).trim(),
        email: cleanEmail.trim(),
        phone: cleanPhone.trim(),
        // R66 NL launch: persist IBAN + BIC so the invoice PDF can render
        // them. updateBusinessProfile in AppState now writes these to
        // business_settings.iban / .bic via the upsertBusinessSettings call.
        iban: cleanIban,
        bic: cleanBic,
        country,
        enabledPaymentMethods,
      });
      router.back();
    } catch (err) {
      logError('BusinessSettings', err);
      Alert.alert(t('common.error', 'Error'), t('common.retry', 'Probeer opnieuw'));
    } finally {
      setSaving(false);
    }
  }, [businessName, kvkNumber, vatNumber, registrationNumber, address, email, phone, iban, bic, country, enabledPaymentMethods, updateBusinessProfile, router, t]);

  const filled = fields.filter((f) => f.value.trim()).length;
  const percent = Math.round((filled / fields.length) * 100);

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={Typography.title}>{t('settings.business', 'Bedrijfsgegevens')}</Text>
            <Text style={Typography.muted}>
              {percent}% · {filled}/{fields.length}
            </Text>
          </View>

          {/* Progress bar */}
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${percent}%` }]} />
          </View>

          <View style={styles.card}>
            {fields.map((field) => (
              <View key={field.label} style={styles.fieldColumn}>
                <Text style={Typography.muted}>{field.label}</Text>
                <TextInput
                  style={[styles.input, field.multiline && { minHeight: 60, textAlignVertical: 'top' }]}
                  value={field.value}
                  onChangeText={field.onChange}
                  placeholder={field.placeholder}
                  placeholderTextColor={SemanticColors.textSecondary}
                  keyboardType={field.keyboardType}
                  multiline={field.multiline}
                  maxLength={field.multiline ? 500 : 100}
                  autoCapitalize={field.keyboardType === 'email-address' ? 'none' : 'sentences'}
                />
              </View>
            ))}
          </View>

          {/* Accounting provider selection */}
          <View style={styles.card}>
            <Text style={[Typography.title, { marginBottom: 8 }]}>{t('settings.accounting', 'Boekhouding')}</Text>
            {PROVIDERS.filter(p => p.id !== 'none').slice(0, 6).map(provider => (
              <Pressable
                key={provider.id}
                style={styles.providerRow}
                onPress={() => Alert.alert(provider.name, provider.description + '\n\n' + provider.features.join(' · '))}
              >
                <Ionicons name={provider.icon as any} size={20} color={Palette.hermesOrange} />
                <View style={{ flex: 1 }}>
                  <Text style={Typography.body}>{provider.name}</Text>
                  <Text style={Typography.muted} numberOfLines={1}>{provider.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={SemanticColors.textSecondary} />
              </Pressable>
            ))}
          </View>

          {/* Payment methods toggles */}
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Ionicons name="shield-checkmark" size={18} color={SemanticColors.feedbackSuccess} />
              <Text style={[Typography.title, { flex: 1 }]}>{t('settings.paymentMethods', 'Payment Methods')}</Text>
            </View>
            <Text style={[Typography.muted, { marginBottom: 8 }]}>
              {t('settings.paymentMethodsDesc', 'Choose which payment methods your customers can use.')}
            </Text>
            {allPaymentMethods.map((method, idx) => {
              const display = paymentDisplay[idx];
              const methodName = display?.name ?? method;
              const brandColor = getPaymentBrandColor(methodName);
              const isEnabled = enabledPaymentMethods.includes(method);
              return (
                <View
                  key={method}
                  style={[
                    styles.paymentMethodRow,
                    idx === allPaymentMethods.length - 1 && { borderBottomWidth: 0 },
                  ]}
                  accessibilityLabel={`${isEnabled ? 'Disable' : 'Enable'} ${methodName}`}
                >
                  <View style={[styles.paymentMethodIcon, { backgroundColor: (isEnabled ? brandColor : SemanticColors.textTertiary) + '12' }]}>
                    <View style={[styles.paymentMethodDot, { backgroundColor: isEnabled ? brandColor : SemanticColors.textTertiary }]} />
                  </View>
                  <Text style={[Typography.body, { flex: 1, color: isEnabled ? SemanticColors.textPrimary : SemanticColors.textTertiary }]}>{methodName}</Text>
                  <Switch
                    value={isEnabled}
                    onValueChange={(val) => {
                      setEnabledPaymentMethods(prev =>
                        val ? [...prev, method] : prev.filter(m => m !== method)
                      );
                    }}
                    trackColor={{ false: SemanticColors.borderDefault, true: brandColor + '50' }}
                    thumbColor={isEnabled ? brandColor : SemanticColors.surfacePrimary}
                    accessibilityLabel={`Toggle ${methodName}`}
                  />
                </View>
              );
            })}
            <View style={styles.paymentSecurityFooter}>
              <Ionicons name="lock-closed" size={12} color={SemanticColors.textTertiary} />
              <Text style={styles.paymentSecurityText}>
                {country === 'UK' ? 'Powered by Stripe' : 'Powered by Mollie'} · PCI DSS compliant
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <PrimaryButton
              label={saving ? t('common.loading', 'Laden...') : t('common.save', 'Opslaan')}
              onPress={handleSave}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: 40,
  },
  header: {
    gap: Spacing.xs,
  },
  progressBg: {
    height: 6,
    backgroundColor: SemanticColors.borderDefault,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    backgroundColor: SemanticColors.actionPrimary,
    borderRadius: 3,
  },
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  fieldColumn: {
    gap: 4,
  },
  input: {
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: SemanticColors.textPrimary,
  },
  providerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  paymentMethodRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  paymentMethodIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  paymentMethodDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  paymentSecurityFooter: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingTop: 12,
  },
  paymentSecurityText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: SemanticColors.textTertiary,
  },
  actions: {
    gap: Spacing.sm,
  },
});
