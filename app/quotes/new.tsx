import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Screen } from '../../src/components/Screen';
import { InlineInsight, VascoInsightCard } from '../../src/components/shared/VascoInsightCard';
import { useAppState } from '../../src/state/AppState';
import { useAuth } from '../../src/context/AuthContext';
import { formatCurrency, type Country } from '../../src/i18n/formatting';
import { useInlineInsight, useVascoGuidance } from '../../src/services/vascoGuidanceService';
import { QuoteLineItem } from '../../src/domain/lineItems';
import { Pricebook } from '../../src/components/contractor';
import { recordUsage, type PricebookEntry, type PricebookVariantEntry } from '../../src/services/pricebookService';
import { logError } from '../../src/utils/errorHandler';
import { SemanticColors } from '../../src/theme/colors';
import { Radius } from '../../src/theme/radius';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';

export default function NewQuoteScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { addQuote, customers, quotes } = useAppState();
  const { user } = useAuth();
  const country = (user?.country ?? 'NL') as Country;

  // R17.2: track customer NAME for display + customer ID for addQuote.
  // Was previously single-string state — picking a customer set the NAME and
  // then addQuote stored that name as customer_id (same UUID/name confusion
  // pattern fixed in R9.3 / R12.2 / R14.1).
  const [customer, setCustomer] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
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

  const [showPricebook, setShowPricebook] = useState(false);

  // Pull a saved service onto the quote. This is what makes maintaining a
  // pricebook worth the contractor's time — without it the catalogue is a
  // screen you visit once.
  const addFromPricebook = useCallback((entry: PricebookEntry, variant?: PricebookVariantEntry) => {
    const unitPrice = variant?.price ?? entry.basePrice;
    const line: QuoteLineItem = {
      id: `li-${Date.now()}`,
      // The variant name alone ("Premium") means nothing on a customer's quote.
      description: variant ? `${entry.name} — ${variant.name}` : entry.name,
      quantity: 1,
      unitPrice,
    };
    setItems((prev) => {
      // Replace the trailing blank line rather than leaving it stranded above
      // the service the contractor just picked.
      const last = prev[prev.length - 1];
      const lastIsBlank = last && !last.description.trim() && !last.unitPrice;
      return lastIsBlank ? [...prev.slice(0, -1), line] : [...prev, line];
    });
    // Usage is what ranks the book by what they actually sell. Failing to
    // record it must never block the quote, so it is deliberately not awaited.
    recordUsage(entry.id).catch(() => {});
    setShowPricebook(false);
  }, []);

  const removeLineItem = useCallback((index: number) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }, []);

  const handleSave = useCallback(async () => {
    if (saving) return;
    if (!customer.trim()) {
      Alert.alert(t('quoteNew.missingCustomerTitle', 'Missing customer'), t('quoteNew.missingCustomerDesc', 'Enter a customer name.'));
      return;
    }
    if (!job.trim()) {
      Alert.alert(t('quoteNew.missingJobTitle', 'Missing job'), t('quoteNew.missingJobDesc', 'Enter a job description.'));
      return;
    }
    const validItems = items.filter((i) => i.description.trim());
    if (validItems.length === 0) {
      Alert.alert(t('quoteNew.noItemsTitle', 'No line items'), t('quoteNew.noItemsDesc', 'Add at least one line item with a description.'));
      return;
    }
    const itemTotal = validItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    if (itemTotal <= 0) {
      Alert.alert(t('quoteNew.invalidAmountTitle', 'Invalid amount'), t('quoteNew.invalidAmountDesc', 'Quote total must be greater than zero. Check your line item prices.'));
      return;
    }

    // Tier gate — free users see an upgrade prompt when they hit their monthly quote cap.
    // R52: count quotes created this calendar month from real AppState
    // (legacy `quotesUsedThisMonth` counter was never incremented).
    try {
      const { loadSubscription, canCreateQuote } = await import('../../src/services/subscriptionService');
      const sub = await loadSubscription();
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const quotesThisMonth = quotes.filter((q: any) => {
        const created = q.createdAt ? new Date(q.createdAt) : null;
        return created && created >= monthStart;
      }).length;
      const gate = canCreateQuote(sub, quotesThisMonth);
      if (!gate.allowed) {
        Alert.alert(
          t('billing.upgradeRequired', 'Upgrade required'),
          gate.reason,
          [
            { text: t('common.cancel', 'Cancel'), style: 'cancel' },
            { text: t('billing.viewPlans', 'View plans'), onPress: () => router.push('/contractor/profile' as any) },
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
      // R17.2: prefer the picked customer ID over the typed name. AppState.
      // addQuote stores the first arg as customer_id; passing the raw name
      // string broke quote → customer linkage everywhere.
      const customerArg = customerId ?? customer.trim();
      const quoteId = await addQuote(customerArg, job.trim(), validItems);
      router.replace(`/quotes/${quoteId}`);
    } catch (err) {
      logError('NewQuote', err);
      Alert.alert(t('common.error', 'Error'), t('quoteNew.saveFailed', 'Could not save quote. Please try again.'));
    } finally {
      setSaving(false);
    }
  }, [customer, customerId, job, items, addQuote, router, t, quotes, saving]);

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={Typography.title}>{t('quoteNew.title', 'New quote')}</Text>
            <Text style={Typography.muted}>{t('quoteNew.subtitle', 'Draft-first · Save time')}</Text>
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
            <Text style={Typography.subtitle}>{t('quoteNew.customerAndJob', 'Customer & job')}</Text>
            <View style={styles.fieldColumn}>
              <Text style={Typography.muted}>{t('quoteNew.customerName', 'Customer name')}</Text>
              <Pressable onPress={() => customers.length > 0 && setShowCustomerPicker(!showCustomerPicker)}>
                <TextInput
                  style={styles.input}
                  value={customer}
                  // R17.2: typing in the field clears the picked-customer id —
                  // user is editing freely, so we can't claim the row link any more.
                  onChangeText={(v) => { setCustomer(v); setCustomerId(null); setShowCustomerPicker(false); }}
                  placeholder={customers.length > 0 ? t('quoteNew.pickerPlaceholder', 'Type or pick a customer') : t('quoteNew.customerPlaceholder', 'e.g. De Jong')}
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
                        onPress={() => { setCustomer(c.name); setCustomerId(c.id); setShowCustomerPicker(false); }}
                      >
                        <Text style={Typography.body}>{c.name}</Text>
                        {c.email && <Text style={[Typography.muted, { fontSize: 11 }]}>{c.email}</Text>}
                      </Pressable>
                    ))}
                </View>
              )}
            </View>
            <View style={styles.fieldColumn}>
              <Text style={Typography.muted}>{t('quoteNew.jobDescription', 'Job description')}</Text>
              <TextInput
                style={styles.input}
                value={job}
                onChangeText={setJob}
                placeholder={t('quoteNew.jobPlaceholder', 'e.g. Interior repaint')}
                placeholderTextColor={SemanticColors.textSecondary}
              />
            </View>
          </View>

          {/* Line Items */}
          <View style={styles.card}>
            <Text style={Typography.subtitle}>{t('quoteNew.lineItems', 'Line items')}</Text>
            {items.map((item, index) => (
              <View key={item.id} style={styles.lineItem}>
                <View style={styles.lineItemHeader}>
                  <Text style={[Typography.muted, { fontSize: 12 }]}>{t('quoteNew.item', 'Item {{n}}', { n: index + 1 })}</Text>
                  {items.length > 1 && (
                    <Pressable onPress={() => removeLineItem(index)} hitSlop={8}>
                      <Text style={{ color: SemanticColors.feedbackError, fontSize: 13 }}>{t('quoteNew.remove', 'Remove')}</Text>
                    </Pressable>
                  )}
                </View>
                <TextInput
                  style={styles.input}
                  value={item.description}
                  onChangeText={(v) => updateItem(index, 'description', v)}
                  placeholder={t('quoteNew.descriptionPlaceholder', 'Description')}
                  placeholderTextColor={SemanticColors.textSecondary}
                />
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[Typography.muted, { fontSize: 12 }]}>{t('quoteNew.qty', 'Qty')}</Text>
                    <TextInput
                      style={styles.input}
                      value={String(item.quantity)}
                      onChangeText={(v) => updateItem(index, 'quantity', v)}
                      keyboardType="number-pad"
                      placeholderTextColor={SemanticColors.textSecondary}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                    <Text style={[Typography.muted, { fontSize: 12 }]}>{t('quoteNew.unitPrice', 'Unit price')}</Text>
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
            <View style={styles.addRow}>
              <Pressable onPress={addLineItem} style={[styles.addItemBtn, styles.addItemBtnFlex]}>
                <Text style={{ color: SemanticColors.actionPrimary, fontWeight: '600' }}>{t('quoteNew.addLineItem', '+ Add line item')}</Text>
              </Pressable>
              <Pressable onPress={() => setShowPricebook(true)} style={[styles.addItemBtn, styles.addItemBtnFlex]}>
                <Text style={{ color: SemanticColors.actionPrimary, fontWeight: '600' }}>{t('quoteNew.fromPricebook', '+ From pricebook')}</Text>
              </Pressable>
            </View>
          </View>

          {/* Total */}
          <View style={styles.card}>
            <View style={styles.totalRow}>
              <Text style={Typography.subtitle}>{t('quoteNew.total', 'Total')}</Text>
              <Text style={[Typography.subtitle, { color: SemanticColors.actionPrimary }]}>
                {formatCurrency(total, country)}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <PrimaryButton
              label={saving ? t('quoteNew.saving', 'Saving...') : t('quoteNew.saveDraft', 'Save draft')}
              onPress={handleSave}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* onRequestClose is required on Android — without it the hardware back
          button does nothing and the modal traps the user. */}
      <Modal
        visible={showPricebook}
        animationType="slide"
        onRequestClose={() => setShowPricebook(false)}
      >
        <Pricebook
          mode="select"
          onSelectItem={addFromPricebook}
          onClose={() => setShowPricebook(false)}
          // No add/edit affordances here: this is a picker mid-quote, and
          // sending someone to the catalogue editor would lose the quote
          // they are part-way through writing.
        />
      </Modal>
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
  addRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  addItemBtnFlex: {
    flex: 1,
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
