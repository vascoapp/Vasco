// The "new customer" sheet — one form, used wherever a customer is created.
//
// Lifted verbatim out of the Klanten tab (app/(contractor)/bedrijf.tsx) so the
// quote builder can use the SAME form when a contractor starts a quote with no
// customer (TestFlight, 2026-09-22: a first-time user filled in an entire quote
// and was only then told it had no customer, with no way to add one there).
// The keyboard handling is the device-verified #343 shape: KAV on iOS, the
// measured inset as paddingBottom, never an `undefined` in the style array.

import { useCallback, useState } from 'react';
import { View, StyleSheet, Pressable, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { DK } from '../../theme/draftkings';
import { useAppState } from '../../state/AppState';
import { hapticSuccess } from '../../utils/haptics';
import { useKeyboardInset } from '../../hooks/useKeyboardInset';
import { DKLabel } from './DKLabel';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** The id `addCustomer` returned — the final id online, the temp id offline
   *  (the write queue remaps it; see fkRepair). */
  onAdded?: (customerId: string) => void;
}

export function AddCustomerSheet({ visible, onClose, onAdded }: Props) {
  const { t } = useTranslation();
  const { addCustomer } = useAppState();
  const kbInset = useKeyboardInset();
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  // Address was not captured here at all, only in the enterprise-tab customer
  // modal that a contractor never sees. Without it the app holds no location
  // for anyone a contractor adds, which quietly disables directions-to-job and
  // any per-site history.
  const [newAddress, setNewAddress] = useState('');
  // Post code + city: a German e-invoice is invalid without the buyer's
  // (BR-DE-8/9), and one free-text line cannot be split reliably (#339).
  const [newPostcode, setNewPostcode] = useState('');
  const [newCity, setNewCity] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAddCustomer = useCallback(async () => {
    if (!newName.trim() || saving) return;
    setSaving(true);
    try {
      const id = await addCustomer(
        newName.trim(),
        newEmail.trim() || undefined,
        newPhone.trim() || undefined,
        newAddress.trim() || undefined,
        { postcode: newPostcode.trim() || undefined, city: newCity.trim() || undefined },
      );
      hapticSuccess();
      setNewName(''); setNewEmail(''); setNewPhone(''); setNewAddress(''); setNewPostcode(''); setNewCity('');
      onAdded?.(id);
      onClose();
    } finally {
      setSaving(false);
    }
  }, [newName, newEmail, newPhone, newAddress, newPostcode, newCity, saving, addCustomer, onAdded, onClose]);

  const disabled = !newName.trim() || saving;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView enabled={Platform.OS === 'ios'} behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={s.modalOverlay} onPress={onClose}>
          <Pressable style={[s.modalSheet, kbInset ? { paddingBottom: kbInset + 16 } : null]} onPress={(e) => e.stopPropagation()}>
            <View style={s.modalHandle} />
            <DKLabel style={s.modalTitle}>{t('dk.actions.newCustomer', 'New customer')}</DKLabel>
            <TextInput style={s.modalInput} value={newName} onChangeText={setNewName} placeholder={t('customers.namePlaceholder', 'Customer name')} placeholderTextColor={DK.colors.textMuted} autoFocus />
            <TextInput style={s.modalInput} value={newEmail} onChangeText={setNewEmail} placeholder={t('customers.emailPlaceholder', 'Email')} placeholderTextColor={DK.colors.textMuted} keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={s.modalInput} value={newPhone} onChangeText={setNewPhone} placeholder={t('customers.phonePlaceholder', 'Phone')} placeholderTextColor={DK.colors.textMuted} keyboardType="phone-pad" />
            <TextInput style={s.modalInput} value={newAddress} onChangeText={setNewAddress} placeholder={t('customers.addressPlaceholder', 'Address')} placeholderTextColor={DK.colors.textMuted} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput style={[s.modalInput, { flex: 1 }]} value={newPostcode} onChangeText={setNewPostcode} placeholder={t('contractor.customers.postcodePlaceholder', 'Post code')} placeholderTextColor={DK.colors.textMuted} />
              <TextInput style={[s.modalInput, { flex: 2 }]} value={newCity} onChangeText={setNewCity} placeholder={t('contractor.customers.cityPlaceholder', 'City')} placeholderTextColor={DK.colors.textMuted} />
            </View>
            <Pressable style={[s.modalSubmit, disabled && { opacity: 0.5 }]} onPress={handleAddCustomer} disabled={disabled}>
              <LinearGradient colors={[DK.colors.primaryDark, DK.colors.primary, DK.colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <DKLabel style={s.modalSubmitText}>{t('dk.actions.addCustomer', 'Add customer')}</DKLabel>
            </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: DK.colors.panel,
    borderTopLeftRadius: DK.radius.card, borderTopRightRadius: DK.radius.card,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: DK.colors.border,
    padding: 20, paddingBottom: 40, gap: 10,
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: DK.colors.border, alignSelf: 'center', marginBottom: 8 },
  modalTitle: { fontFamily: DK.type.display900, fontSize: 16, color: DK.colors.text, letterSpacing: 1.8 },
  modalInput: {
    backgroundColor: DK.colors.panel2,
    borderRadius: DK.radius.button,
    borderWidth: 1, borderColor: DK.colors.border,
    paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15,
    fontFamily: DK.type.body500,
    color: DK.colors.text,
  },
  modalSubmit: {
    borderRadius: DK.radius.button,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 4,
  },
  modalSubmitText: { fontFamily: DK.type.display900, fontSize: 13, color: '#FFFFFF', letterSpacing: 1.4 },
});
