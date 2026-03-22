import { useRouter } from 'expo-router';
import { useState, useCallback, useMemo } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Screen } from '../../src/components/Screen';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppState } from '../../src/state/AppState';
import { useAuth } from '../../src/context/AuthContext';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PROVIDERS, type AccountingProvider } from '../../src/integrations/accounting';
import { Radius } from '../../src/theme/radius';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';

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
  const [saving, setSaving] = useState(false);

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

    const contactFields: FieldDef[] = [
      { label: t('customers.contact', 'Adres'), value: address, onChange: setAddress, placeholder: 'Keizersgracht 100, Amsterdam', multiline: true },
      { label: 'Email', value: email, onChange: setEmail, placeholder: 'info@bedrijf.nl', keyboardType: 'email-address' as const },
      { label: t('customers.contact', 'Telefoon'), value: phone, onChange: setPhone, placeholder: country === 'UK' ? '+44 20 1234 5678' : country === 'DE' ? '+49 30 1234567' : '+31 6 12345678', keyboardType: 'phone-pad' as const },
    ];

    return [...common, ...countryFields, ...contactFields];
  }, [country, businessName, kvkNumber, vatNumber, registrationNumber, address, email, phone, t]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateBusinessProfile({
        businessName: businessName.trim(),
        kvkNumber: kvkNumber.trim(),
        vatNumber: vatNumber.trim(),
        registrationNumber: registrationNumber.trim(),
        address: address.trim(),
        email: email.trim(),
        phone: phone.trim(),
        country,
      });
      router.back();
    } catch (err) {
      console.warn('[BusinessSettings] Save failed:', err);
      Alert.alert(t('common.error', 'Error'), t('common.retry', 'Probeer opnieuw'));
    } finally {
      setSaving(false);
    }
  }, [businessName, kvkNumber, vatNumber, registrationNumber, address, email, phone, country, updateBusinessProfile, router, t]);

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
  actions: {
    gap: Spacing.sm,
  },
});
