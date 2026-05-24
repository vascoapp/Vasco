import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { logError } from '../../src/utils/errorHandler';
import { Screen } from '../../src/components/Screen';
import { useAppState } from '../../src/state/AppState';
import { useAuth } from '../../src/context/AuthContext';
import { SemanticColors } from '../../src/theme/colors';
import { Radius } from '../../src/theme/radius';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';

// R118: every visible string in this modal was hardcoded English (alerts,
// section titles, field labels, placeholders, buttons). Wrapped all of
// them in t() and added country-aware example values for the email /
// phone / address placeholders — was Dutch-format only.
export default function CustomersScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const country = user?.country ?? 'NL';
  const router = useRouter();
  const { customers, addCustomer } = useAppState();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  const emailExample = country === 'US' ? 'info@example.com'
    : country === 'UK' ? 'info@example.co.uk'
    : country === 'DE' ? 'info@beispiel.de'
    : country === 'FR' ? 'info@exemple.fr'
    : country === 'ES' ? 'info@ejemplo.es'
    : country === 'IT' ? 'info@esempio.it'
    : 'info@dejong.nl';
  const phoneExample = country === 'US' ? '(555) 123-4567'
    : country === 'UK' ? '+44 20 7946 0958'
    : country === 'DE' ? '+49 30 12345678'
    : country === 'FR' ? '+33 6 12 34 56 78'
    : country === 'ES' ? '+34 600 123 456'
    : country === 'IT' ? '+39 333 1234567'
    : '+31 6 12345678';
  const addressExample = country === 'US' ? '123 Main St, Austin TX 78701'
    : country === 'UK' ? '10 Downing Street, London'
    : country === 'DE' ? 'Unter den Linden 1, Berlin'
    : country === 'FR' ? '1 rue de Rivoli, Paris'
    : country === 'ES' ? 'Calle Mayor 1, Madrid'
    : country === 'IT' ? 'Via Roma 1, Milano'
    : 'Keizersgracht 100, Amsterdam';

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert(
        t('customersModal.missingName', 'Missing name'),
        t('customersModal.missingNameBody', 'Enter a customer name.'),
      );
      return;
    }
    setSaving(true);
    try {
      await addCustomer(
        name.trim(),
        email.trim() || undefined,
        phone.trim() || undefined,
        address.trim() || undefined,
      );
      setName('');
      setEmail('');
      setPhone('');
      setAddress('');
      setShowForm(false);
    } catch (err) {
      logError('Customers', err);
      Alert.alert(
        t('common.error', 'Error'),
        t('customersModal.saveFailed', 'Could not save customer.'),
      );
    } finally {
      setSaving(false);
    }
  }, [name, email, phone, address, addCustomer, t]);

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={Typography.title}>{t('customersModal.title', 'Customers')}</Text>
            <Text style={Typography.muted}>{t('customersModal.count', '{{count}} customers', { count: customers.length })}</Text>
          </View>

          {/* Customer List */}
          {customers.length > 0 ? (
            <View style={styles.card}>
              {customers.map((customer, index) => (
                <View
                  key={customer.id}
                  style={[styles.customerRow, index > 0 && styles.customerRowBorder]}
                >
                  <View style={styles.avatarSmall}>
                    <Text style={styles.avatarSmallText}>
                      {customer.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={Typography.body}>{customer.name}</Text>
                    {customer.email && (
                      <Text style={[Typography.muted, { fontSize: 12 }]}>{customer.email}</Text>
                    )}
                    {customer.phone && (
                      <Text style={[Typography.muted, { fontSize: 12 }]}>{customer.phone}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={Typography.muted}>{t('customersModal.emptyState', 'No customers yet. Add your first customer below.')}</Text>
            </View>
          )}

          {/* Add Customer Form */}
          {showForm ? (
            <View style={[styles.card, { borderColor: SemanticColors.actionPrimary }]}>
              <Text style={Typography.subtitle}>{t('customersModal.newCustomer', 'New customer')}</Text>
              <View style={styles.fieldColumn}>
                <Text style={Typography.muted}>{t('customersModal.fieldName', 'Name *')}</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder={t('customersModal.namePlaceholder', 'e.g. De Jong')}
                  placeholderTextColor={SemanticColors.textSecondary}
                  autoFocus
                />
              </View>
              <View style={styles.fieldColumn}>
                <Text style={Typography.muted}>{t('customersModal.fieldEmail', 'Email')}</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder={emailExample}
                  placeholderTextColor={SemanticColors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.fieldColumn}>
                <Text style={Typography.muted}>{t('customersModal.fieldPhone', 'Phone')}</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder={phoneExample}
                  placeholderTextColor={SemanticColors.textSecondary}
                  keyboardType="phone-pad"
                />
              </View>
              <View style={styles.fieldColumn}>
                <Text style={Typography.muted}>{t('customersModal.fieldAddress', 'Address')}</Text>
                <TextInput
                  style={styles.input}
                  value={address}
                  onChangeText={setAddress}
                  placeholder={addressExample}
                  placeholderTextColor={SemanticColors.textSecondary}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    label={saving
                      ? t('customersModal.saving', 'Saving…')
                      : t('customersModal.saveCustomer', 'Save customer')}
                    onPress={handleSave}
                  />
                </View>
                <Pressable
                  onPress={() => setShowForm(false)}
                  style={styles.cancelBtn}
                >
                  <Text style={{ color: SemanticColors.textSecondary }}>{t('common.cancel', 'Cancel')}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setShowForm(true)} style={styles.addBtn}>
              <Ionicons name="add-circle-outline" size={20} color={SemanticColors.actionPrimary} />
              <Text style={{ color: SemanticColors.actionPrimary, fontWeight: '600' }}>{t('customersModal.addCustomer', 'Add customer')}</Text>
            </Pressable>
          )}
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
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  customerRowBorder: {
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
  avatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SemanticColors.actionPrimary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSmallText: {
    color: SemanticColors.actionPrimary,
    fontSize: 13,
    fontWeight: '700',
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
  },
  cancelBtn: {
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
});
