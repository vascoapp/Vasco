// =============================================================================
// INTEGRATIONS SCREEN — Connect accounting, payments, and suppliers
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { hapticSuccess } from '../../src/utils/haptics';
import { useAuth } from '../../src/context/AuthContext';
import { useTradeConfig } from '../../src/config/tradeFeatures';
import {
  PROVIDERS,
  getAccountingConfig,
  saveAccountingConfig,
  type AccountingProvider,
} from '../../src/integrations/accounting';
import {
  DUTCH_SUPPLIERS,
  getSuppliersForTrade,
  getSupplierConfigs,
  saveSupplierConfig,
  type SupplierId,
} from '../../src/integrations/suppliers';
import {
  isConnected as isMollieConnected,
  saveMollieConfig,
} from '../../src/integrations/mollie';

type IconName = keyof typeof Ionicons.glyphMap;

export default function IntegrationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const tradeConfig = useTradeConfig();
  const [refreshing, setRefreshing] = useState(false);
  const [accountingProvider, setAccountingProvider] = useState<AccountingProvider>('none');
  const [mollieConnected, setMollieConnected] = useState(false);
  const [connectedSuppliers, setConnectedSuppliers] = useState<SupplierId[]>([]);

  const tradeSuppliers = getSuppliersForTrade(user?.trade ?? 'general');

  const loadState = useCallback(async () => {
    const acConfig = await getAccountingConfig();
    setAccountingProvider(acConfig.connected ? acConfig.provider : 'none');
    setMollieConnected(await isMollieConnected());
    const supConfigs = await getSupplierConfigs();
    setConnectedSuppliers(supConfigs.filter(c => c.connected).map(c => c.id));
  }, []);

  useEffect(() => { loadState(); }, [loadState]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadState().then(() => { setRefreshing(false); hapticSuccess(); });
  }, [loadState]);

  const connectAccounting = async (provider: AccountingProvider) => {
    // In production: OAuth flow → save tokens
    // For now: toggle connection status
    await saveAccountingConfig({
      provider,
      connected: true,
      connectedAt: new Date().toISOString(),
    });
    setAccountingProvider(provider);
    hapticSuccess();
  };

  const connectMollie = async () => {
    // In production: enter API key → validate
    await saveMollieConfig({ apiKey: 'test_placeholder' });
    setMollieConnected(true);
    hapticSuccess();
  };

  const toggleSupplier = async (id: SupplierId) => {
    const isConnected = connectedSuppliers.includes(id);
    await saveSupplierConfig({
      id,
      connected: !isConnected,
      connectedAt: isConnected ? undefined : new Date().toISOString(),
    });
    setConnectedSuppliers(prev =>
      isConnected ? prev.filter(s => s !== id) : [...prev, id]
    );
    hapticSuccess();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Koppelingen</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />}
      >
        {/* Accounting */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BOEKHOUDING</Text>
          <View style={styles.sectionCards}>
            {PROVIDERS.filter(p => p.popular).map(provider => {
              const isActive = accountingProvider === provider.id;
              return (
                <Pressable
                  key={provider.id}
                  style={[styles.card, isActive && styles.cardActive]}
                  onPress={() => connectAccounting(provider.id)}
                >
                  <Ionicons name={provider.icon as IconName} size={22} color={isActive ? Palette.hermesOrange : SemanticColors.textSecondary} />
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>{provider.name}</Text>
                    <Text style={styles.cardDesc} numberOfLines={1}>{provider.description}</Text>
                  </View>
                  {isActive ? (
                    <View style={styles.connectedBadge}>
                      <Text style={styles.connectedText}>Verbonden</Text>
                    </View>
                  ) : (
                    <Ionicons name="add-circle-outline" size={22} color={SemanticColors.textTertiary} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Payments */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BETALINGEN</Text>
          <View style={styles.sectionCards}>
            <Pressable
              style={[styles.card, mollieConnected && styles.cardActive]}
              onPress={connectMollie}
            >
              <Ionicons name="card-outline" size={22} color={mollieConnected ? Palette.hermesOrange : SemanticColors.textSecondary} />
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>Mollie</Text>
                <Text style={styles.cardDesc}>iDEAL, Bancontact, Credit Card, Klarna</Text>
              </View>
              {mollieConnected ? (
                <View style={styles.connectedBadge}>
                  <Text style={styles.connectedText}>Verbonden</Text>
                </View>
              ) : (
                <Ionicons name="add-circle-outline" size={22} color={SemanticColors.textTertiary} />
              )}
            </Pressable>
          </View>
        </View>

        {/* Suppliers — filtered by trade */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LEVERANCIERS</Text>
          <View style={styles.sectionCards}>
            {tradeSuppliers.map(supplier => {
              const isActive = connectedSuppliers.includes(supplier.id);
              return (
                <Pressable
                  key={supplier.id}
                  style={[styles.card, isActive && styles.cardActive]}
                  onPress={() => toggleSupplier(supplier.id)}
                >
                  <Ionicons name="storefront-outline" size={22} color={isActive ? Palette.hermesOrange : SemanticColors.textSecondary} />
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>{supplier.name}</Text>
                    <Text style={styles.cardDesc} numberOfLines={1}>{supplier.description}</Text>
                  </View>
                  {isActive ? (
                    <View style={styles.connectedBadge}>
                      <Text style={styles.connectedText}>Verbonden</Text>
                    </View>
                  ) : (
                    <Ionicons name="add-circle-outline" size={22} color={SemanticColors.textTertiary} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SafeArea.side, paddingTop: SafeArea.top, paddingBottom: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  backBtn: { marginRight: Spacing.md },
  headerTitle: { fontSize: 20, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SafeArea.side, paddingTop: Spacing.md, gap: Spacing.lg },
  section: { gap: 8 },
  sectionLabel: {
    fontSize: 12, fontFamily: 'Inter_700Bold', color: SemanticColors.textTertiary,
    letterSpacing: 0.8,
  },
  sectionCards: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: 16, overflow: 'hidden' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SemanticColors.borderDefault,
  },
  cardActive: { backgroundColor: Palette.hermesOrange + '06' },
  cardInfo: { flex: 1, gap: 1 },
  cardName: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textPrimary },
  cardDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', color: SemanticColors.textSecondary },
  connectedBadge: {
    backgroundColor: SemanticColors.feedbackSuccess + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  connectedText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: SemanticColors.feedbackSuccess },
});
