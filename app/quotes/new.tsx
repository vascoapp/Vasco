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
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Screen } from '../../src/components/Screen';
import { InlineInsight, VascoInsightCard } from '../../src/components/shared/VascoInsightCard';
import { useAppState } from '../../src/state/AppState';
import { useInlineInsight, useVascoGuidance } from '../../src/services/vascoGuidanceService';
import { QuoteLineItem } from '../../src/domain/lineItems';
import { SemanticColors } from '../../src/theme/colors';
import { Radius } from '../../src/theme/radius';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';

export default function NewQuoteScreen() {
  const router = useRouter();
  const { addQuote, customers, quotes } = useAppState();

  const [customer, setCustomer] = useState('');
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [job, setJob] = useState('');

  // AI guidance — context key changes based on form state
  const contextKey = customer ? 'customer' : 'form';
  const inlineInsight = useInlineInsight('contractor', 'quote-new', contextKey);
  const insights = useVascoGuidance('contractor', 'quote-new');
  const topInsight = insights.length > 0 ? insights[0] : null;
  const [items, setItems] = useState<QuoteLineItem[]>([
    { id: `li-${Date.now()}`, description: '', quantity: 1, unitPrice: 0 },
  ]);
  const [saving, setSaving] = useState(false);

  const total = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  const updateItem = useCallback((index: number, field: keyof QuoteLineItem, value: string) => {
    setItems((prev) => {
      const updated = [...prev];
      if (field === 'description') {
        updated[index] = { ...updated[index], description: value };
      } else if (field === 'quantity') {
        updated[index] = { ...updated[index], quantity: Math.max(1, parseInt(value, 10) || 1) };
      } else if (field === 'unitPrice') {
        updated[index] = { ...updated[index], unitPrice: parseFloat(value) || 0 };
      }
      return updated;
    });
  }, []);

  const addLineItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      { id: `li-${Date.now()}`, description: '', quantity: 1, unitPrice: 0 },
    ]);
  }, []);

  const removeLineItem = useCallback((index: number) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }, []);

  const handleSave = useCallback(async () => {
    if (saving) return;
    if (!customer.trim()) {
      Alert.alert('Missing customer', 'Enter a customer name.');
      return;
    }
    if (!job.trim()) {
      Alert.alert('Missing job', 'Enter a job description.');
      return;
    }
    const validItems = items.filter((i) => i.description.trim());
    if (validItems.length === 0) {
      Alert.alert('No line items', 'Add at least one line item with a description.');
      return;
    }
    const itemTotal = validItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    if (itemTotal <= 0) {
      Alert.alert('Invalid amount', 'Quote total must be greater than zero. Check your line item prices.');
      return;
    }

    // Tier gate — free users see an upgrade prompt when they hit their monthly quote cap.
    try {
      const { loadSubscription, canCreateQuote } = await import('../../src/services/subscriptionService');
      const sub = await loadSubscription();
      const gate = canCreateQuote(sub);
      if (!gate.allowed) {
        Alert.alert(
          'Upgrade required',
          gate.reason,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'View plans', onPress: () => router.push('/contractor/profile' as any) },
          ],
        );
        return;
      }
    } catch {}

    // R304: validator gate — checks for duplicate quotes (same customer + amount
    // within 7 days), zero-priced items, missing VAT config. Errors show
    // "Send anyway" override; warnings show "Continue".
    const { gateQuoteValidation } = await import('../../src/services/quoteValidationGate');
    const ok = await gateQuoteValidation(
      { customer: customer.trim(), amount: itemTotal, lineItems: validItems },
      quotes,
    );
    if (!ok) return;

    setSaving(true);
    try {
      const quoteId = await addQuote(customer.trim(), job.trim(), validItems);
      router.replace(`/quotes/${quoteId}`);
    } catch (err) {
      console.warn('[NewQuote] Save failed:', err);
      Alert.alert('Error', 'Could not save quote. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [customer, job, items, addQuote, router]);

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={Typography.title}>New quote</Text>
            <Text style={Typography.muted}>Draft-first · Save time</Text>
          </View>

          {inlineInsight && (
            <InlineInsight
              icon={inlineInsight.icon as any}
              message={inlineInsight.message}
              actionLabel={inlineInsight.actionLabel}
              actionRoute={inlineInsight.actionRoute}
            />
          )}
          {topInsight && (
            <VascoInsightCard insight={topInsight} compact showSource />
          )}

          {/* Customer & Job */}
          <View style={styles.card}>
            <Text style={Typography.subtitle}>Customer & job</Text>
            <View style={styles.fieldColumn}>
              <Text style={Typography.muted}>Customer name</Text>
              <Pressable onPress={() => customers.length > 0 && setShowCustomerPicker(!showCustomerPicker)}>
                <TextInput
                  style={styles.input}
                  value={customer}
                  onChangeText={(v) => { setCustomer(v); setShowCustomerPicker(false); }}
                  placeholder={customers.length > 0 ? 'Type or pick a customer' : 'e.g. De Jong'}
                  placeholderTextColor={SemanticColors.textSecondary}
                />
              </Pressable>
              {showCustomerPicker && customers.length > 0 && (
                <View style={styles.pickerDropdown}>
                  {customers
                    .filter((c) => !customer || c.name.toLowerCase().includes(customer.toLowerCase()))
                    .slice(0, 5)
                    .map((c) => (
                      <Pressable
                        key={c.id}
                        style={styles.pickerOption}
                        onPress={() => { setCustomer(c.name); setShowCustomerPicker(false); }}
                      >
                        <Text style={Typography.body}>{c.name}</Text>
                        {c.email && <Text style={[Typography.muted, { fontSize: 11 }]}>{c.email}</Text>}
                      </Pressable>
                    ))}
                </View>
              )}
            </View>
            <View style={styles.fieldColumn}>
              <Text style={Typography.muted}>Job description</Text>
              <TextInput
                style={styles.input}
                value={job}
                onChangeText={setJob}
                placeholder="e.g. Interior repaint"
                placeholderTextColor={SemanticColors.textSecondary}
              />
            </View>
          </View>

          {/* Line Items */}
          <View style={styles.card}>
            <Text style={Typography.subtitle}>Line items</Text>
            {items.map((item, index) => (
              <View key={item.id} style={styles.lineItem}>
                <View style={styles.lineItemHeader}>
                  <Text style={[Typography.muted, { fontSize: 12 }]}>Item {index + 1}</Text>
                  {items.length > 1 && (
                    <Pressable onPress={() => removeLineItem(index)} hitSlop={8}>
                      <Text style={{ color: SemanticColors.feedbackError, fontSize: 13 }}>Remove</Text>
                    </Pressable>
                  )}
                </View>
                <TextInput
                  style={styles.input}
                  value={item.description}
                  onChangeText={(v) => updateItem(index, 'description', v)}
                  placeholder="Description"
                  placeholderTextColor={SemanticColors.textSecondary}
                />
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[Typography.muted, { fontSize: 12 }]}>Qty</Text>
                    <TextInput
                      style={styles.input}
                      value={String(item.quantity)}
                      onChangeText={(v) => updateItem(index, 'quantity', v)}
                      keyboardType="number-pad"
                      placeholderTextColor={SemanticColors.textSecondary}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                    <Text style={[Typography.muted, { fontSize: 12 }]}>Unit price (€)</Text>
                    <TextInput
                      style={styles.input}
                      value={item.unitPrice ? String(item.unitPrice) : ''}
                      onChangeText={(v) => updateItem(index, 'unitPrice', v)}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={SemanticColors.textSecondary}
                    />
                  </View>
                </View>
              </View>
            ))}
            <Pressable onPress={addLineItem} style={styles.addItemBtn}>
              <Text style={{ color: SemanticColors.actionPrimary, fontWeight: '600' }}>+ Add line item</Text>
            </Pressable>
          </View>

          {/* Total */}
          <View style={styles.card}>
            <View style={styles.totalRow}>
              <Text style={Typography.subtitle}>Total</Text>
              <Text style={[Typography.subtitle, { color: SemanticColors.actionPrimary }]}>
                €{total.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <PrimaryButton
              label={saving ? 'Saving...' : 'Save draft'}
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
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
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
  lineItem: {
    gap: 6,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  lineItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
  },
  addItemBtn: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  pickerDropdown: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: SemanticColors.actionPrimary + '40',
    overflow: 'hidden',
  },
  pickerOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actions: {
    gap: Spacing.sm,
  },
});
