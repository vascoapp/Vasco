import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useCallback, useEffect } from 'react';
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
  const router = useRouter();
  const { customers, addCustomer, updateCustomer, businessProfile } = useAppState();
  // The business profile outranks the account (CLAUDE.md).
  const country = businessProfile?.country ?? user?.country ?? 'NL';
  // `?id=` opens this form on an EXISTING customer. There was no edit path at
  // all: updateCustomer had zero callers, so a customer created without a post
  // code, province or tax id could never be given one, and every e-invoice
  // export for them refused with "some details are missing" and no way out.
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const editing = editId ? customers.find((c) => c.id === editId) : undefined;
  const [showForm, setShowForm] = useState(!!editId);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  // Post code and city are separate fields, not part of the address line,
  // because every structured e-invoice needs them as separate elements —
  // XRechnung BR-DE-8/9 require both outright, and a free-text line cannot be
  // split back into them reliably across six markets.
  const [postcode, setPostcode] = useState('');
  const [city, setCity] = useState('');
  const [vatId, setVatId] = useState('');
  // Market-specific fields the structured formats REQUIRE of the buyer:
  // province for Facturae (ES) and FatturaPA (IT); for Italy also the codice
  // fiscale and the SDI routing — a 7-character code, or a PEC address.
  const [province, setProvince] = useState('');
  const [taxId, setTaxId] = useState('');
  const [sdiCode, setSdiCode] = useState('');
  const [pec, setPec] = useState('');
  const [saving, setSaving] = useState(false);
  const needsProvince = country === 'ES' || country === 'IT';
  const isItaly = country === 'IT';

  // Prefill once when editing. Keyed on the id, not the customer object, so a
  // background refresh does not overwrite what the contractor is typing.
  useEffect(() => {
    if (!editing) return;
    setName(editing.name ?? '');
    setEmail(editing.email ?? '');
    setPhone(editing.phone ?? '');
    setAddress(editing.address ?? '');
    setPostcode(editing.postcode ?? '');
    setCity(editing.city ?? '');
    setVatId(editing.vatId ?? '');
    setProvince(editing.province ?? '');
    setTaxId(editing.taxId ?? '');
    setSdiCode(editing.einvoiceRouting ?? '');
    setPec(editing.einvoiceEmail ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id]);

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
  const postcodeExample = country === 'NL' ? '1012 AB'
    : country === 'DE' ? '10115'
    : country === 'FR' ? '75001'
    : country === 'ES' ? '28001'
    : country === 'IT' ? '20100'
    : country === 'UK' ? 'SW1A 1AA'
    : '78701';
  const cityExample = country === 'DE' ? 'Berlin'
    : country === 'FR' ? 'Paris'
    : country === 'ES' ? 'Madrid'
    : country === 'IT' ? 'Milano'
    : country === 'UK' ? 'London'
    : country === 'US' ? 'Austin'
    : 'Amsterdam';
  const vatExample = country === 'DE' ? 'DE123456789'
    : country === 'FR' ? 'FR12345678901'
    : country === 'ES' ? 'ESB12345678'
    : country === 'IT' ? 'IT12345678901'
    : country === 'UK' ? 'GB123456789'
    : 'NL123456789B01';
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
    // An `?id=` that does not resolve must never fall through to CREATING a
    // customer — that would silently duplicate the one being edited.
    if (editId && !editing) return;
    setSaving(true);
    try {
      const structured = {
        postcode: postcode.trim(),
        city: city.trim(),
        vatId: vatId.trim().toUpperCase(),
        ...(needsProvince ? { province: province.trim() } : {}),
        ...(isItaly ? { taxId: taxId.trim().toUpperCase(), einvoiceRouting: sdiCode.trim().toUpperCase(), einvoiceEmail: pec.trim() } : {}),
      };
      if (editing) {
        // Edit sends every shown field, blanks included: clearing a wrong post
        // code must actually clear it.
        await updateCustomer(editing.id, {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          address: address.trim(),
          ...structured,
        });
        router.back();
        return;
      }
      const orUndefined = (o: Record<string, string>) =>
        Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v || undefined]));
      await addCustomer(
        name.trim(),
        email.trim() || undefined,
        phone.trim() || undefined,
        address.trim() || undefined,
        orUndefined(structured),
      );
      setName('');
      setEmail('');
      setPhone('');
      setAddress('');
      setPostcode('');
      setCity('');
      setVatId('');
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
  }, [name, email, phone, address, postcode, city, vatId, province, taxId, sdiCode, pec, needsProvince, isItaly, editId, editing, addCustomer, updateCustomer, router, t]);

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={Typography.title}>
              {editing ? t('customersModal.editCustomer', 'Edit customer') : t('customersModal.title', 'Customers')}
            </Text>
            {!editing && (
              <Text style={Typography.muted}>{t('customersModal.count', '{{count}} customers', { count: customers.length })}</Text>
            )}
          </View>

          {editId && !editing ? (
            <View style={styles.card}>
              <Text style={Typography.muted}>{t('customersModal.notFound', 'This customer could not be found.')}</Text>
            </View>
          ) : null}

          {/* Customer List — not while editing one customer */}
          {editId ? null : customers.length > 0 ? (
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

          {/* Add / edit form */}
          {editId && !editing ? null : showForm ? (
            <View style={[styles.card, { borderColor: SemanticColors.actionPrimary }]}>
              {!editing && <Text style={Typography.subtitle}>{t('customersModal.newCustomer', 'New customer')}</Text>}
              <View style={styles.fieldColumn}>
                <Text style={Typography.muted}>{t('customersModal.fieldName', 'Name *')}</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder={t('customersModal.namePlaceholder', 'e.g. De Jong')}
                  placeholderTextColor={SemanticColors.placeholder}
                  autoFocus={!editing}
                />
              </View>
              <View style={styles.fieldColumn}>
                <Text style={Typography.muted}>{t('customersModal.fieldEmail', 'Email')}</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder={emailExample}
                  placeholderTextColor={SemanticColors.placeholder}
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
                  placeholderTextColor={SemanticColors.placeholder}
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
                  placeholderTextColor={SemanticColors.placeholder}
                />
              </View>
              {/* Post code and city on one row: they are read together and
                  each is short, so two full-width fields would push the save
                  button off a phone screen. */}
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={Typography.muted}>{t('customersModal.fieldPostcode', 'Post code')}</Text>
                  <TextInput
                    style={styles.input}
                    value={postcode}
                    onChangeText={setPostcode}
                    placeholder={postcodeExample}
                    placeholderTextColor={SemanticColors.placeholder}
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={Typography.muted}>{t('customersModal.fieldCity', 'City')}</Text>
                  <TextInput
                    style={styles.input}
                    value={city}
                    onChangeText={setCity}
                    placeholder={cityExample}
                    placeholderTextColor={SemanticColors.placeholder}
                  />
                </View>
              </View>
              <View style={styles.fieldColumn}>
                {/* Only a business customer has one, so it is labelled as
                    optional rather than looking like a required field a
                    consumer cannot answer. */}
                <Text style={Typography.muted}>{t('customersModal.fieldVatId', 'VAT number (business customers)')}</Text>
                <TextInput
                  style={styles.input}
                  value={vatId}
                  onChangeText={setVatId}
                  autoCapitalize="characters"
                  placeholder={vatExample}
                  placeholderTextColor={SemanticColors.placeholder}
                />
              </View>
              {needsProvince && (
                <View style={styles.fieldColumn}>
                  <Text style={Typography.muted}>{t('customersModal.fieldProvince', 'Province')}</Text>
                  <TextInput
                    style={styles.input}
                    value={province}
                    onChangeText={setProvince}
                    autoCapitalize={isItaly ? 'characters' : 'words'}
                    placeholder={isItaly ? 'MI' : 'Madrid'}
                    placeholderTextColor={SemanticColors.placeholder}
                  />
                </View>
              )}
              {isItaly && (
                <>
                  <View style={styles.fieldColumn}>
                    <Text style={Typography.muted}>{t('customersModal.fieldTaxIdIt', 'Codice fiscale (Italy)')}</Text>
                    <TextInput style={styles.input} value={taxId} onChangeText={setTaxId} autoCapitalize="characters"
                      placeholder="RSSMRA80A01F205X" placeholderTextColor={SemanticColors.placeholder} />
                  </View>
                  <View style={styles.fieldColumn}>
                    <Text style={Typography.muted}>{t('customersModal.fieldSdiCode', 'SDI recipient code (Italy)')}</Text>
                    <TextInput style={styles.input} value={sdiCode} onChangeText={setSdiCode} autoCapitalize="characters"
                      maxLength={7} placeholder="0000000" placeholderTextColor={SemanticColors.placeholder} />
                  </View>
                  <View style={styles.fieldColumn}>
                    <Text style={Typography.muted}>{t('customersModal.fieldPec', 'PEC address (Italy)')}</Text>
                    <TextInput style={styles.input} value={pec} onChangeText={setPec} autoCapitalize="none"
                      keyboardType="email-address" placeholder="nome@pec.it" placeholderTextColor={SemanticColors.placeholder} />
                  </View>
                </>
              )}
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
                  onPress={() => (editing ? router.back() : setShowForm(false))}
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
