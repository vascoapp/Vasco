// =============================================================================
// THE customer form — add and edit, used everywhere a customer is entered
// =============================================================================
// There were three forms, each missing what another had (#365):
//   - Klanten (bedrijf.tsx) — basic fields only; lifted into this sheet on
//     2026-09-22 so the quote builder and maintenance could reuse it;
//   - customer-crm.tsx — the Free-plan client limit, email/phone validation,
//     input sanitising and the duplicate check;
//   - (modals)/customers.tsx — VAT id, province (ES/IT), the Italian
//     e-invoice fields, country-aware examples and the only EDIT path.
// So a customer added from a quote skipped the plan limit and the duplicate
// check, and one added in Klanten could never be given a VAT id there. This
// is the union of all three; the others are gone.
//
// Keyboard: the device-verified #343 shape — KAV on iOS, the measured inset as
// paddingBottom, and the sheet SCROLLS (an Italian customer has eleven fields;
// a capped sheet needs a ScrollView, not padding).
// =============================================================================

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Modal, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { DK } from '../../theme/draftkings';
import { TYPE, GRID } from '../../theme/tabStyles';
import { SemanticColors } from '../../theme/colors';
import { useAppState } from '../../state/AppState';
import { useAuth } from '../../context/AuthContext';
import { hapticSuccess } from '../../utils/haptics';
import { useKeyboardInset } from '../../hooks/useKeyboardInset';
import { isValidEmail, isValidPhone, sanitizeInput } from '../../utils/validation';
import { findDuplicates } from '../../services/customerDedupService';
import { logError } from '../../utils/errorHandler';
import type { Customer } from '../../domain/customers';
import { DKLabel } from './DKLabel';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Add mode: the id `addCustomer` returned (final online, temp offline). */
  onAdded?: (customerId: string) => void;
  /** Edit mode: the customer to edit. Every shown field is written, blanks
   *  included — clearing a wrong post code must actually clear it. */
  customer?: Customer;
  onSaved?: () => void;
}

/** Example values per market, shown as placeholders (not as defaults). */
function examples(country: string) {
  const pick = <T,>(m: Record<string, T>, fallback: T): T => m[country] ?? fallback;
  return {
    email: pick({ US: 'info@example.com', UK: 'info@example.co.uk', DE: 'info@beispiel.de', FR: 'info@exemple.fr', ES: 'info@ejemplo.es', IT: 'info@esempio.it' }, 'info@dejong.nl'),
    phone: pick({ US: '(555) 123-4567', UK: '+44 20 7946 0958', DE: '+49 30 12345678', FR: '+33 6 12 34 56 78', ES: '+34 600 123 456', IT: '+39 333 1234567' }, '+31 6 12345678'),
    address: pick({ US: '123 Main St', UK: '10 Downing Street', DE: 'Unter den Linden 1', FR: '1 rue de Rivoli', ES: 'Calle Mayor 1', IT: 'Via Roma 1' }, 'Keizersgracht 100'),
    postcode: pick({ NL: '1012 AB', DE: '10115', FR: '75001', ES: '28001', IT: '20100', UK: 'SW1A 1AA' }, '78701'),
    city: pick({ DE: 'Berlin', FR: 'Paris', ES: 'Madrid', IT: 'Milano', UK: 'London', US: 'Austin' }, 'Amsterdam'),
    vat: pick({ DE: 'DE123456789', FR: 'FR12345678901', ES: 'ESB12345678', IT: 'IT12345678901', UK: 'GB123456789' }, 'NL123456789B01'),
  };
}

/**
 * Module-level on purpose. Declared inside the component it would be a NEW
 * component type every render, remounting its TextInput on each keystroke —
 * the keyboard would drop after every letter.
 */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      {children}
    </View>
  );
}

export function AddCustomerSheet({ visible, onClose, onAdded, customer, onSaved }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const { customers, addCustomer, updateCustomer, businessProfile } = useAppState();
  const kbInset = useKeyboardInset();
  // The business profile outranks the account (CLAUDE.md).
  const country = businessProfile?.country ?? user?.country ?? 'NL';
  const needsProvince = country === 'ES' || country === 'IT';
  const isItaly = country === 'IT';
  const ex = examples(country);
  const editing = !!customer;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  // Address, then post code and city as SEPARATE fields: a German e-invoice is
  // invalid without the buyer's (BR-DE-8/9), and a free-text line cannot be
  // split reliably (#339).
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [city, setCity] = useState('');
  const [vatId, setVatId] = useState('');
  // Required of the buyer by Facturae (ES) and FatturaPA (IT); for Italy also
  // the codice fiscale and the SDI routing — a 7-character code or a PEC.
  const [province, setProvince] = useState('');
  const [taxId, setTaxId] = useState('');
  const [sdiCode, setSdiCode] = useState('');
  const [pec, setPec] = useState('');
  const [saving, setSaving] = useState(false);

  // Prefill when editing — keyed on the id so a background refresh does not
  // overwrite what the contractor is typing.
  useEffect(() => {
    if (!customer || !visible) return;
    setName(customer.name ?? '');
    setEmail(customer.email ?? '');
    setPhone(customer.phone ?? '');
    setAddress(customer.address ?? '');
    setPostcode(customer.postcode ?? '');
    setCity(customer.city ?? '');
    setVatId(customer.vatId ?? '');
    setProvince(customer.province ?? '');
    setTaxId(customer.taxId ?? '');
    setSdiCode(customer.einvoiceRouting ?? '');
    setPec(customer.einvoiceEmail ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id, visible]);

  const reset = () => {
    setName(''); setEmail(''); setPhone(''); setAddress(''); setPostcode(''); setCity('');
    setVatId(''); setProvince(''); setTaxId(''); setSdiCode(''); setPec('');
  };

  const handleSave = useCallback(async () => {
    const cleanName = sanitizeInput(name);
    if (!cleanName || saving) return;
    const cleanEmail = sanitizeInput(email);
    const cleanPhone = sanitizeInput(phone);
    if (cleanEmail && !isValidEmail(cleanEmail)) {
      Alert.alert(t('common.error', 'Error'), t('validation.invalidEmail', 'Please enter a valid email address'));
      return;
    }
    if (cleanPhone && !isValidPhone(cleanPhone)) {
      Alert.alert(t('common.error', 'Error'), t('validation.invalidPhone', 'Please enter a valid phone number'));
      return;
    }
    const structured = {
      postcode: sanitizeInput(postcode),
      city: sanitizeInput(city),
      vatId: sanitizeInput(vatId).toUpperCase(),
      ...(needsProvince ? { province: sanitizeInput(province) } : {}),
      ...(isItaly ? {
        taxId: sanitizeInput(taxId).toUpperCase(),
        einvoiceRouting: sanitizeInput(sdiCode).toUpperCase(),
        einvoiceEmail: sanitizeInput(pec),
      } : {}),
    };
    const cleanAddress = sanitizeInput(address);

    if (customer) {
      setSaving(true);
      try {
        await updateCustomer(customer.id, {
          name: cleanName, email: cleanEmail, phone: cleanPhone, address: cleanAddress, ...structured,
        });
        hapticSuccess();
        onSaved?.();
        onClose();
      } catch (err) {
        logError('CustomerForm', err);
        Alert.alert(t('common.error', 'Error'), t('customersModal.saveFailed', 'Could not save customer.'));
      } finally {
        setSaving(false);
      }
      return;
    }

    // Free-plan client limit — every add path goes through here now, so the
    // quote builder and maintenance can no longer step around it (#365).
    try {
      const { loadSubscription, canAddClient } = await import('../../services/subscriptionService');
      const sub = await loadSubscription();
      const gate = canAddClient(sub, customers.length);
      if (!gate.allowed) {
        Alert.alert(
          t('billing.upgradeRequired', 'Upgrade required'),
          gate.reason ?? t('contractor.customers.limitReached', 'You have reached your client limit on this plan.'),
          [
            { text: t('common.cancel', 'Cancel'), style: 'cancel' },
            { text: t('billing.viewPlans', 'View plans'), onPress: () => { onClose(); router.push('/contractor/profile' as any); } },
          ],
        );
        return;
      }
    } catch {}

    const commit = async () => {
      setSaving(true);
      try {
        const orUndefined = (o: Record<string, string>) =>
          Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v || undefined]));
        const id = await addCustomer(cleanName, cleanEmail || undefined, cleanPhone || undefined, cleanAddress || undefined, orUndefined(structured));
        hapticSuccess();
        reset();
        onAdded?.(id);
        onClose();
      } catch (err) {
        logError('CustomerForm', err);
        Alert.alert(t('common.error', 'Error'), t('customersModal.saveFailed', 'Could not save customer.'));
      } finally {
        setSaving(false);
      }
    };

    const dupes = findDuplicates({ name: cleanName, email: cleanEmail || undefined, phone: cleanPhone || undefined }, customers as any);
    if (dupes.length > 0) {
      const top = dupes[0];
      Alert.alert(
        t('contractor.customers.possibleDuplicate', 'Possible duplicate'),
        `${top.existing.name}\n${top.reasons.join(' · ')}`,
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          { text: t('contractor.customers.addAnyway', 'Add anyway'), onPress: () => { void commit(); } },
        ],
      );
      return;
    }
    await commit();
  }, [name, email, phone, address, postcode, city, vatId, province, taxId, sdiCode, pec, saving, customer,
    needsProvince, isItaly, customers, addCustomer, updateCustomer, onAdded, onSaved, onClose, router, t]);

  const disabled = !name.trim() || saving;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView enabled={Platform.OS === 'ios'} behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={s.overlay} onPress={onClose}>
          <Pressable style={[s.sheet, kbInset ? { paddingBottom: kbInset + GRID.md } : null]} onPress={(e) => e.stopPropagation()}>
            <View style={s.handle} />
            <DKLabel style={s.title}>
              {editing ? t('customersModal.editCustomer', 'Edit customer') : t('dk.actions.newCustomer', 'New customer')}
            </DKLabel>
            <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
              <Field label={t('customersModal.fieldName', 'Name *')}>
                <TextInput style={s.input} value={name} onChangeText={setName} placeholder={t('customers.namePlaceholder', 'Customer name')} placeholderTextColor={SemanticColors.placeholder} autoFocus={!editing} />
              </Field>
              <Field label={t('customersModal.fieldEmail', 'Email')}>
                <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder={ex.email} placeholderTextColor={SemanticColors.placeholder} keyboardType="email-address" autoCapitalize="none" />
              </Field>
              <Field label={t('customersModal.fieldPhone', 'Phone')}>
                <TextInput style={s.input} value={phone} onChangeText={setPhone} placeholder={ex.phone} placeholderTextColor={SemanticColors.placeholder} keyboardType="phone-pad" />
              </Field>
              <Field label={t('customersModal.fieldAddress', 'Address')}>
                <TextInput style={s.input} value={address} onChangeText={setAddress} placeholder={ex.address} placeholderTextColor={SemanticColors.placeholder} />
              </Field>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Field label={t('customersModal.fieldPostcode', 'Post code')}>
                    <TextInput style={s.input} value={postcode} onChangeText={setPostcode} placeholder={ex.postcode} placeholderTextColor={SemanticColors.placeholder} />
                  </Field>
                </View>
                <View style={{ flex: 2 }}>
                  <Field label={t('customersModal.fieldCity', 'City')}>
                    <TextInput style={s.input} value={city} onChangeText={setCity} placeholder={ex.city} placeholderTextColor={SemanticColors.placeholder} />
                  </Field>
                </View>
              </View>
              <Field label={t('customersModal.fieldVatId', 'VAT number (business customers)')}>
                <TextInput style={s.input} value={vatId} onChangeText={setVatId} autoCapitalize="characters" placeholder={ex.vat} placeholderTextColor={SemanticColors.placeholder} />
              </Field>
              {needsProvince && (
                <Field label={t('customersModal.fieldProvince', 'Province')}>
                  <TextInput style={s.input} value={province} onChangeText={setProvince} autoCapitalize={isItaly ? 'characters' : 'words'} placeholder={isItaly ? 'MI' : 'Madrid'} placeholderTextColor={SemanticColors.placeholder} />
                </Field>
              )}
              {isItaly && (
                <>
                  <Field label={t('customersModal.fieldTaxIdIt', 'Codice fiscale (Italy)')}>
                    <TextInput style={s.input} value={taxId} onChangeText={setTaxId} autoCapitalize="characters" placeholder="RSSMRA80A01F205X" placeholderTextColor={SemanticColors.placeholder} />
                  </Field>
                  <Field label={t('customersModal.fieldSdiCode', 'SDI recipient code (Italy)')}>
                    <TextInput style={s.input} value={sdiCode} onChangeText={setSdiCode} autoCapitalize="characters" maxLength={7} placeholder="0000000" placeholderTextColor={SemanticColors.placeholder} />
                  </Field>
                  <Field label={t('customersModal.fieldPec', 'PEC address (Italy)')}>
                    <TextInput style={s.input} value={pec} onChangeText={setPec} autoCapitalize="none" keyboardType="email-address" placeholder="nome@pec.it" placeholderTextColor={SemanticColors.placeholder} />
                  </Field>
                </>
              )}
            </ScrollView>
            <Pressable style={[s.submit, disabled && { opacity: 0.5 }]} onPress={handleSave} disabled={disabled} accessibilityRole="button">
              <LinearGradient colors={[DK.colors.primaryDark, DK.colors.primary, DK.colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <DKLabel style={s.submitText}>
                {saving
                  ? t('customersModal.saving', 'Saving…')
                  : editing ? t('customersModal.saveCustomer', 'Save customer') : t('dk.actions.addCustomer', 'Add customer')}
              </DKLabel>
            </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: SemanticColors.surfaceOverlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: DK.colors.panel,
    borderTopLeftRadius: DK.radius.card, borderTopRightRadius: DK.radius.card,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: DK.colors.border,
    padding: GRID.lg - 4, paddingBottom: GRID.xl + 8, gap: GRID.sm,
    // Capped: eleven Italian fields must scroll, not push the button off-screen.
    maxHeight: '88%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: DK.colors.border, alignSelf: 'center', marginBottom: GRID.sm },
  title: { fontFamily: DK.type.display900, fontSize: TYPE.titleSize, color: DK.colors.text, letterSpacing: 1.8 },
  scroll: { flexGrow: 0 },
  scrollContent: { gap: GRID.sm, paddingBottom: GRID.xs },
  field: { gap: 4 },
  // Form labels are WHITE (user, 2026-09-22) — and needed: "10115" alone reads
  // like a value, beside "Post code" it reads as an example.
  label: { fontFamily: DK.type.body500, fontSize: TYPE.labelSize, color: DK.colors.text },
  row: { flexDirection: 'row', gap: GRID.sm },
  input: {
    backgroundColor: DK.colors.panel2,
    borderRadius: DK.radius.button,
    borderWidth: 1, borderColor: DK.colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: TYPE.bodySize,
    fontFamily: DK.type.body500,
    color: DK.colors.text,
  },
  submit: {
    borderRadius: DK.radius.button,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: GRID.xs,
  },
  submitText: { fontFamily: DK.type.display900, fontSize: TYPE.captionSize, color: DK.colors.text, letterSpacing: 1.4 },
});
