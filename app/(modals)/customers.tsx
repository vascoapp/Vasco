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
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Screen } from '../../src/components/Screen';
import { useAppState } from '../../src/state/AppState';
import { SemanticColors } from '../../src/theme/colors';
import { Radius } from '../../src/theme/radius';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';

export default function CustomersScreen() {
  const router = useRouter();
  const { customers, addCustomer } = useAppState();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Missing name', 'Enter a customer name.');
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
      console.warn('[Customers] Save failed:', err);
      Alert.alert('Error', 'Could not save customer.');
    } finally {
      setSaving(false);
    }
  }, [name, email, phone, address, addCustomer]);

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={Typography.title}>Customers</Text>
            <Text style={Typography.muted}>{customers.length} customers</Text>
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
              <Text style={Typography.muted}>No customers yet. Add your first customer below.</Text>
            </View>
          )}

          {/* Add Customer Form */}
          {showForm ? (
            <View style={[styles.card, { borderColor: SemanticColors.actionPrimary }]}>
              <Text style={Typography.subtitle}>New customer</Text>
              <View style={styles.fieldColumn}>
                <Text style={Typography.muted}>Name *</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. De Jong"
                  placeholderTextColor={SemanticColors.textSecondary}
                  autoFocus
                />
              </View>
              <View style={styles.fieldColumn}>
                <Text style={Typography.muted}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="info@dejong.nl"
                  placeholderTextColor={SemanticColors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.fieldColumn}>
                <Text style={Typography.muted}>Phone</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+31 6 12345678"
                  placeholderTextColor={SemanticColors.textSecondary}
                  keyboardType="phone-pad"
                />
              </View>
              <View style={styles.fieldColumn}>
                <Text style={Typography.muted}>Address</Text>
                <TextInput
                  style={styles.input}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Keizersgracht 100, Amsterdam"
                  placeholderTextColor={SemanticColors.textSecondary}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    label={saving ? 'Saving...' : 'Save customer'}
                    onPress={handleSave}
                  />
                </View>
                <Pressable
                  onPress={() => setShowForm(false)}
                  style={styles.cancelBtn}
                >
                  <Text style={{ color: SemanticColors.textSecondary }}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setShowForm(true)} style={styles.addBtn}>
              <Ionicons name="add-circle-outline" size={20} color={SemanticColors.actionPrimary} />
              <Text style={{ color: SemanticColors.actionPrimary, fontWeight: '600' }}>Add customer</Text>
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
