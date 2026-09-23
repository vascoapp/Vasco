import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AddCustomerSheet } from '../../src/components/shared/AddCustomerSheet';
import { Screen } from '../../src/components/Screen';
import { useAppState } from '../../src/state/AppState';
import { SemanticColors } from '../../src/theme/colors';
import { Radius } from '../../src/theme/radius';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';

// The customer list. Adding and editing happen in the shared AddCustomerSheet;
// the country-aware examples, VAT id and market fields moved there (#365).
export default function CustomersScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { customers } = useAppState();
  // `?id=` opens this form on an EXISTING customer. There was no edit path at
  // all: updateCustomer had zero callers, so a customer created without a post
  // code, province or tax id could never be given one, and every e-invoice
  // export for them refused with "some details are missing" and no way out.
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const editing = editId ? customers.find((c) => c.id === editId) : undefined;
  // The form itself is the shared AddCustomerSheet (#365) — add AND edit,
  // with the plan limit, validation, duplicate check and every market's
  // e-invoice fields. `?id=` opens it straight on that customer.
  const [showForm, setShowForm] = useState(!!editId);

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

          {/* Add — the form opens as the shared sheet. */}
          {editId ? null : (
            <Pressable onPress={() => setShowForm(true)} style={styles.addBtn} accessibilityRole="button">
              <Ionicons name="add-circle-outline" size={20} color={SemanticColors.actionPrimary} />
              <Text style={{ color: SemanticColors.actionPrimary, fontWeight: '600' }}>{t('customersModal.addCustomer', 'Add customer')}</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <AddCustomerSheet
        visible={showForm && (!editId || !!editing)}
        customer={editing}
        // Editing arrived from another screen: closing returns there.
        onClose={() => (editId ? router.back() : setShowForm(false))}
      />
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
  },
});
