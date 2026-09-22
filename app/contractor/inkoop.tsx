// =============================================================================
// INKOOP — supplier invoices in, price intelligence out  (rebuilt 2026-09-22)
// =============================================================================
// Rebuilt around what actually works. An audit of the old nine-tile hub found
// Herbestellen, Leveranciers, Voorraad and both headline figures ("Stockouts
// voorkomen" 0, "Bespaard op inkoop" €0) fed by an inventory that ONLY a test
// seed ever filled; "Zoek materiaal" searched hardcoded prices and kept its
// orders on the device; the savings block could not be shown to work. They are
// gone, not hidden — nothing writes the data they need (learnings #362/#363).
//
// What stays is what writes real rows:
//   1. Read a supplier invoice → purchase prices land in the contractor's price
//      history (material_price_history), the input for everything in 2.
//      E-factuur works today. The photo route (receipt scanner) needs Claude
//      Vision and appears by itself when the server reports it can run it
//      (useAiCapabilities) — no build when the key is set.
//   2. Prijsinzicht — DATANORM offered as an intelligence, not a tile: link the
//      wholesaler's price list, and Vasco watches the prices of what you buy.
//      The drift / forecast / lead-time / price-drop cards hide when empty.
//
// Purchase prices are NOT turned into selling prices: a quote line is the
// contractor's own price, and a supplier invoice is what they paid.
// =============================================================================

import { formatCurrency } from '../../src/i18n/formatting';
import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import { File as ExpoFile } from 'expo-file-system';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DK } from '../../src/theme/draftkings';
import { TYPE, GRID, RADIUS } from '../../src/theme/tabStyles';
import { DKScreenHeader } from '../../src/components/shared/DKScreenHeader';
import { DKLabel } from '../../src/components/shared/DKLabel';
import { ReceiptScanner } from '../../src/components/contractor/ReceiptScanner';
import { parseDateanormV4, parseDateanormV5, importDatanormToMoat } from '../../src/integrations/datanorm';
import { getCurrentTrade, getCurrentCountry } from '../../src/lib/currentUser';
import { MaterialDriftCard } from '../../src/components/contractor/MaterialDriftCard';
import { PriceDropAlertCard } from '../../src/components/contractor/PriceDropAlertCard';
import { SeasonalityBanner } from '../../src/components/contractor/SeasonalityBanner';
import { MaterialPriceForecastCard } from '../../src/components/contractor/MaterialPriceForecastCard';
import { SupplierLeadtimePredictionCard } from '../../src/components/contractor/SupplierLeadtimePredictionCard';
import { useAppState } from '../../src/state/AppState';
import { useAiCapabilities } from '../../src/services/aiCapabilities';
import { useMyPriceWatch, PRICE_RISE_THRESHOLD_PCT } from '../../src/services/personalPriceWatch';

export default function InkoopScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { businessProfile } = useAppState();
  const trade = businessProfile?.trade ?? 'general';
  const country = businessProfile?.country ?? 'NL';
  // The photo route needs Claude Vision; offered only when the server can run it.
  const { vision } = useAiCapabilities();
  const [showReceiptScanner, setShowReceiptScanner] = useState(false);
  const [importingEInvoice, setImportingEInvoice] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  // Your own supplier prices over time — the intelligence DATANORM feeds.
  const { watch, refresh: refreshPriceWatch } = useMyPriceWatch();

  // R307: tier gate — receipt scanning is paid-tier only. The photo button is
  // the single entry to the scanner, so this is the one place it is enforced.
  const openReceiptScanner = useCallback(async () => {
    try {
      const { loadSubscription, canUseFeature } = await import('../../src/services/subscriptionService');
      const sub = await loadSubscription();
      const gate = canUseFeature(sub, 'hasInvoiceScanning');
      if (!gate.allowed) {
        Alert.alert(
          t('billing.upgradeRequired', 'Upgrade required'),
          gate.reason ?? t('inkoop.scannerUpgradeRequired', 'Receipt scanning is part of the paid plan.'),
          [
            { text: t('common.cancel', 'Cancel'), style: 'cancel' },
            { text: t('billing.viewPlans', 'View plans'), onPress: () => router.push('/contractor/profile' as any) },
          ],
        );
        return;
      }
    } catch {}
    // NOT openReceiptScanner() — that is THIS callback, and calling it here
    // recursed forever, so the modal never opened for anyone who passed the
    // gate. Open the modal the gate is guarding.
    setShowReceiptScanner(true);
  }, [t, router]);

  // -------------------------------------------------------
  // DATANORM file import
  // -------------------------------------------------------
  const handleDatanormImport = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'application/octet-stream'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setIsImporting(true);

      const file = new ExpoFile(asset.uri);
      const text = await file.text();

      if (!text || text.trim().length < 10) {
        Alert.alert(t('inkoop.importFailedTitle', 'Import failed'), t('inkoop.importFailedNoData', 'The file contains no valid data.'));
        setIsImporting(false);
        return;
      }

      // Auto-detect v4 vs v5: v5 files start with a V (version) record
      const firstLine = text.split(/\r?\n/)[0] ?? '';
      const isV5 = firstLine.trim().toUpperCase().startsWith('V;');
      const articles = isV5 ? parseDateanormV5(text) : parseDateanormV4(text);

      if (articles.length === 0) {
        Alert.alert(t('inkoop.noArticlesTitle', 'No articles'), t('inkoop.noArticlesDesc', 'No articles could be read from the file. Verify it is a valid DATANORM file.'));
        setIsImporting(false);
        return;
      }

      // Derive supplier name from filename (e.g. "richter_frenzel_2026.dat" → "Richter Frenzel")
      const rawName = (asset.name ?? 'supplier')
        .replace(/\.(txt|dat|csv|datanorm)$/i, '')
        .replace(/[_\-]+/g, ' ')
        .replace(/\d{4,}/g, '')
        .trim();
      const supplierName = rawName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') || 'DATANORM Supplier';
      const supplierId = supplierName.toLowerCase().replace(/\s+/g, '_');

      const { imported, skipped, failed } = await importDatanormToMoat(articles, supplierId, {
        supplierName,
        trade: getCurrentTrade() || 'general',
        country: getCurrentCountry() || 'NL',
      });

      // Nothing landed: say so, instead of "0 materials imported" under a
      // success title (#363).
      if (imported === 0 && failed > 0) {
        Alert.alert(
          t('inkoop.importFailedTitle', 'Import failed'),
          t('inkoop.importNothingSaved', 'Nothing could be saved (materials: {{count}}). Check your connection and try again.', { count: failed }),
        );
        return;
      }

      Alert.alert(
        t('inkoop.importSuccessTitle', 'Import successful'),
        t('inkoop.importSuccessBody', '{{imported}} materials imported from {{supplier}}.{{skippedNote}}', {
          imported,
          supplier: supplierName,
          skippedNote: [
            skipped > 0 ? t('inkoop.importSkipped', '{{count}} skipped (duplicates or invalid price).', { count: skipped }) : '',
            failed > 0 ? t('inkoop.importSomeFailed', 'Not saved: {{count}} — import again to retry them.', { count: failed }) : '',
          ].filter(Boolean).map((line) => `\n${line}`).join(''),
        }),
      );
    } catch {
      Alert.alert(t('inkoop.importFailedTitle', 'Import failed'), t('inkoop.importFailedRead', 'Something went wrong reading the file.'));
    } finally {
      setIsImporting(false);
      refreshPriceWatch();
    }
  }, [refreshPriceWatch]);

  /**
   * Read a supplier e-invoice (XRechnung / ZUGFeRD / Peppol UBL).
   *
   * Errors are reported specifically rather than as one generic failure: the
   * overwhelmingly likely mistake is picking the PDF instead of the XML, and
   * "that file is a PDF without embedded invoice data" is actionable where
   * "import failed" is not.
   */
  const importEInvoice = useCallback(async () => {
    setImportingEInvoice(true);
    try {
      const { pickAndImportEInvoice } = await import('../../src/services/einvoiceImportService');
      const res = await pickAndImportEInvoice();

      if (res.error === 'cancelled') return;

      if (!res.ok) {
        const body =
          res.error === 'pdf_without_xml'
            ? t('inkoop.eInvoicePdfOnly', 'That PDF has no invoice data inside it. A normal PDF is a picture of an invoice — ZUGFeRD and Factur-X carry the data within the PDF, and an XRechnung is a separate .xml file.')
            : res.error === 'unrecognised_format'
              ? t('inkoop.eInvoiceUnknown', 'That file is not an e-invoice we recognise. Expected an XRechnung, ZUGFeRD, Factur-X or Peppol UBL document.')
              : res.error === 'no_line_items'
                ? t('inkoop.eInvoiceNoLines', 'That invoice has no line items, so there is nothing to read from it.')
                : t('inkoop.eInvoiceFailed', 'Could not read that file.');
        Alert.alert(t('inkoop.eInvoiceFailedTitle', 'Could not read the e-invoice'), body);
        return;
      }

      const inv = res.invoice!;
      Alert.alert(
        t('inkoop.eInvoiceReadTitle', 'Invoice read'),
        t('inkoop.eInvoiceReadBody', '{{supplier}} · {{count}} lines · {{total}}{{moat}}', {
          supplier: inv.supplierName || t('inkoop.eInvoiceUnknownSupplier', 'Unknown supplier'),
          count: inv.lineItems.length,
          total: formatCurrency(inv.total, country),
          // Only claimed when it actually happened — feedPricingMoat has its own
          // arithmetic gate and can legitimately decline.
          moat: res.fedMoat ? `\n\n${t('inkoop.eInvoicePricesAdded', 'Prices added to your price index.')}` : '',
        }),
      );
    } finally {
      setImportingEInvoice(false);
      refreshPriceWatch();
    }
  }, [t, country, refreshPriceWatch]);

  return (
    <SafeAreaView edges={['bottom']} style={styles.container}>
      <DKScreenHeader title={t('inkoop.title', 'Purchasing')} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* 1. Read a supplier invoice — the one input that writes real rows. */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="document-text-outline" size={26} color={DK.colors.accent} />
          </View>
          <Text style={styles.heroTitle}>{t('inkoop.readInvoiceTitle', 'Read a supplier invoice')}</Text>
          <Text style={styles.heroDesc}>
            {t('inkoop.readInvoiceDesc', 'Read in the invoice from your wholesaler. Vasco keeps what you paid per material, so you can see when prices go up.')}
          </Text>

          <Pressable
            style={({ pressed }) => [styles.primary, pressed && styles.pressed, importingEInvoice && styles.disabled]}
            onPress={importEInvoice}
            disabled={importingEInvoice}
            accessibilityRole="button"
            testID="inkoop-einvoice"
          >
            <LinearGradient colors={[DK.colors.primaryDark, DK.colors.primary, DK.colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            {importingEInvoice
              ? <ActivityIndicator color={DK.colors.text} />
              : <Ionicons name="document-attach-outline" size={20} color={DK.colors.text} />}
            <Text style={styles.primaryText}>
              {importingEInvoice ? t('inkoop.eInvoiceReading', 'Reading…') : t('inkoop.eInvoiceImport', 'Read e-invoice')}
            </Text>
          </Pressable>
          <Text style={styles.hint}>{t('inkoop.eInvoiceFormats', 'XRechnung, ZUGFeRD, Factur-X or Peppol')}</Text>

          {vision ? (
            <Pressable
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
              onPress={openReceiptScanner}
              accessibilityRole="button"
              testID="inkoop-photo"
            >
              <Ionicons name="camera-outline" size={20} color={DK.colors.accent} />
              <Text style={styles.secondaryText}>{t('inkoop.photoReceipt', 'Photo of a receipt')}</Text>
            </Pressable>
          ) : null}
        </View>

        {/* 2. Prijsinzicht — DATANORM as an intelligence, plus the cards it feeds. */}
        <DKLabel style={styles.section}>{t('inkoop.priceInsightTitle', 'Price insight')}</DKLabel>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="pulse-outline" size={20} color={DK.colors.accent} />
            <Text style={styles.cardTitle}>{t('inkoop.priceWatchTitle', "Your wholesaler's price list")}</Text>
          </View>
          <Text style={styles.cardDesc}>
            {t('inkoop.priceWatchDesc', "Link your wholesaler's DATANORM file. Vasco tracks the prices of the materials you use and warns you when they rise.")}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed, isImporting && styles.disabled]}
            onPress={handleDatanormImport}
            disabled={isImporting}
            accessibilityRole="button"
            testID="inkoop-datanorm"
          >
            {isImporting
              ? <ActivityIndicator color={DK.colors.accent} />
              : <Ionicons name="cloud-upload-outline" size={20} color={DK.colors.accent} />}
            <Text style={styles.secondaryText}>
              {isImporting ? t('inkoop.importing', 'Importing…') : t('inkoop.priceWatchButton', 'Import price list')}
            </Text>
          </Pressable>

          {/* Your own supplier prices, latest vs the previous list. Hidden until
              something has been seen twice — before that there is no change. */}
          {watch.tracked > 0 ? (
            <View style={styles.watch} testID="inkoop-price-watch">
              {watch.rises.length === 0 ? (
                <Text style={styles.watchNone}>
                  {t('inkoop.priceWatchNoRises', 'Materials tracked: {{count}} · no rises above {{pct}}%', { count: watch.tracked, pct: PRICE_RISE_THRESHOLD_PCT })}
                </Text>
              ) : (
                <>
                  <Text style={styles.watchTitle}>{t('inkoop.priceWatchRises', 'Prices that went up')}</Text>
                  {watch.rises.map((r) => (
                    <View key={r.key} style={styles.riseRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.riseName} numberOfLines={2}>{r.materialName}</Text>
                        <Text style={styles.riseMeta}>
                          {r.supplierName} · {formatCurrency(r.previous, country)} → {formatCurrency(r.latest, country)}{r.unit ? ` / ${r.unit}` : ''}
                        </Text>
                      </View>
                      <Text style={styles.risePct}>+{r.pct}%</Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          ) : null}
        </View>

        {/* Each hides itself when it has nothing real to say. */}
        <SeasonalityBanner trade={trade} country={country} />
        <MaterialDriftCard trade={trade} country={country} />
        <PriceDropAlertCard trade={trade} country={country} />
        <MaterialPriceForecastCard trade={trade} country={country} />
        <SupplierLeadtimePredictionCard />

        <Pressable
          style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
          onPress={() => router.push('/contractor/market-prices' as any)}
          accessibilityRole="button"
        >
          <Ionicons name="stats-chart-outline" size={18} color={DK.colors.text} />
          <Text style={styles.linkText}>{t('inkoop.marketPrices', 'View market prices')}</Text>
          <Ionicons name="chevron-forward" size={18} color={DK.colors.text} />
        </Pressable>
      </ScrollView>

      {/* The scanner feeds the price history itself (invoiceScanService) —
          feeding it again here double-counted every scan (R11.1). */}
      <Modal visible={showReceiptScanner} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setShowReceiptScanner(false)}>
        <ReceiptScanner
          onClose={() => setShowReceiptScanner(false)}
          onComplete={() => setShowReceiptScanner(false)}
        />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DK.colors.bg },
  scroll: { flex: 1 },
  content: { padding: GRID.lg, gap: GRID.md, paddingBottom: GRID.xl * 2 },

  hero: {
    backgroundColor: DK.colors.panel,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: DK.colors.border,
    padding: GRID.lg,
    gap: GRID.sm,
  },
  heroIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: DK.colors.accent + '1A',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: GRID.xs,
  },
  heroTitle: { fontFamily: DK.type.display800, fontSize: TYPE.sectionSize, color: DK.colors.text },
  heroDesc: { fontFamily: DK.type.body400, fontSize: TYPE.bodySize, color: DK.colors.text, lineHeight: 22, marginBottom: GRID.sm },

  primary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: GRID.sm,
    borderRadius: DK.radius.button, overflow: 'hidden',
    paddingVertical: GRID.md,
    shadowColor: DK.colors.accent, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 8,
  },
  primaryText: { fontFamily: DK.type.display800, fontSize: TYPE.titleSize, color: DK.colors.text },
  hint: { fontFamily: DK.type.body400, fontSize: TYPE.captionSize, color: DK.colors.textMuted, textAlign: 'center' },

  secondary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: GRID.sm,
    borderRadius: DK.radius.button,
    borderWidth: 1, borderColor: DK.colors.accent + '55',
    backgroundColor: DK.colors.accent + '14',
    paddingVertical: GRID.md,
    marginTop: GRID.xs,
  },
  secondaryText: { fontFamily: DK.type.body500, fontSize: TYPE.bodySize, color: DK.colors.text },

  // Same as the tabs' section titles (werk.tsx sectionTitle).
  section: { fontFamily: DK.type.display900, fontSize: TYPE.captionSize, letterSpacing: 1.8, color: DK.colors.text, marginTop: GRID.sm },

  card: {
    backgroundColor: DK.colors.panel,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: DK.colors.border,
    padding: GRID.md,
    gap: GRID.sm,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: GRID.sm },
  cardTitle: { flex: 1, fontFamily: DK.type.display700, fontSize: TYPE.titleSize, color: DK.colors.text },
  cardDesc: { fontFamily: DK.type.body400, fontSize: TYPE.bodySize, color: DK.colors.text, lineHeight: 22 },

  watch: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: DK.colors.border, paddingTop: GRID.sm, marginTop: GRID.xs, gap: GRID.sm },
  watchNone: { fontFamily: DK.type.body400, fontSize: TYPE.captionSize, color: DK.colors.textMuted },
  watchTitle: { fontFamily: DK.type.display900, fontSize: TYPE.captionSize, letterSpacing: 1.2, color: DK.colors.text },
  riseRow: { flexDirection: 'row', alignItems: 'center', gap: GRID.sm },
  riseName: { fontFamily: DK.type.body500, fontSize: TYPE.bodySize, color: DK.colors.text },
  riseMeta: { fontFamily: DK.type.body400, fontSize: TYPE.captionSize, color: DK.colors.textMuted, marginTop: 2 },
  risePct: { fontFamily: DK.type.display800, fontSize: TYPE.titleSize, color: DK.colors.danger },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.sm,
    backgroundColor: DK.colors.panel,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: DK.colors.border,
    paddingHorizontal: GRID.md, paddingVertical: 14,
  },
  linkText: { flex: 1, fontFamily: DK.type.body500, fontSize: TYPE.bodySize, color: DK.colors.text },

  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
});
