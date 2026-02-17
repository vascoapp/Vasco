import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
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
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Screen } from '../../src/components/Screen';
import { useAppState } from '../../src/state/AppState';
import { SemanticColors } from '../../src/theme/colors';
import { Radius } from '../../src/theme/radius';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';

export default function BusinessSettingsScreen() {
  const router = useRouter();
  const { businessProfile, updateBusinessProfile } = useAppState();

  const [businessName, setBusinessName] = useState(businessProfile.businessName ?? '');
  const [kvkNumber, setKvkNumber] = useState(businessProfile.kvkNumber ?? '');
  const [vatNumber, setVatNumber] = useState(businessProfile.vatNumber ?? '');
  const [address, setAddress] = useState(businessProfile.address ?? '');
  const [email, setEmail] = useState(businessProfile.email ?? '');
  const [phone, setPhone] = useState(businessProfile.phone ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateBusinessProfile({
        businessName: businessName.trim(),
        kvkNumber: kvkNumber.trim(),
        vatNumber: vatNumber.trim(),
        address: address.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });
      router.back();
    } catch (err) {
      console.warn('[BusinessSettings] Save failed:', err);
      Alert.alert('Error', 'Could not save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [businessName, kvkNumber, vatNumber, address, email, phone, updateBusinessProfile, router]);

  const fields = [
    { label: 'Business name', value: businessName, onChange: setBusinessName, placeholder: 'e.g. Schilder & Zonen B.V.' },
    { label: 'KVK number', value: kvkNumber, onChange: setKvkNumber, placeholder: '12345678', keyboardType: 'number-pad' as const },
    { label: 'BTW number', value: vatNumber, onChange: setVatNumber, placeholder: 'NL123456789B01' },
    { label: 'Address', value: address, onChange: setAddress, placeholder: 'Keizersgracht 100, Amsterdam', multiline: true },
    { label: 'Email', value: email, onChange: setEmail, placeholder: 'info@bedrijf.nl', keyboardType: 'email-address' as const },
    { label: 'Phone', value: phone, onChange: setPhone, placeholder: '+31 6 12345678', keyboardType: 'phone-pad' as const },
  ];

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
            <Text style={Typography.title}>Business settings</Text>
            <Text style={Typography.muted}>
              {percent}% complete · {filled}/{fields.length} fields filled
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

          <View style={styles.actions}>
            <PrimaryButton
              label={saving ? 'Saving...' : 'Save settings'}
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
  actions: {
    gap: Spacing.sm,
  },
});
