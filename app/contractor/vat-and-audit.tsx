// =============================================================================
// VAT SCHEME + GoBD AUDIT TRAIL SETTINGS (R252)
// =============================================================================
// Single screen surfacing the two compliance toggles a contractor needs to
// own personally:
//   - VAT scheme (Standard / NL KOR / DE Kleinunternehmerregelung)
//   - GoBD audit-trail integrity check + exportable text dump
//
// VAT scheme drives every invoice's VAT rendering (R251). Audit trail is the
// hash-chained log of all invoice lifecycle events with verify + export.
// =============================================================================

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { DK } from '../../src/theme/draftkings';
import { TYPE, GRID, RADIUS } from '../../src/theme/tabStyles';
import { DKLabel } from '../../src/components/shared/DKLabel';
import { DKScreenHeader } from '../../src/components/shared/DKScreenHeader';
import { useAppState } from '../../src/state/AppState';
import {
  verifyAuditTrail,
  exportAuditTrail,
  getAuditEntries,
  type AuditVerificationResult,
} from '../../src/services/gobdAuditTrailService';
import { hapticSuccess } from '../../src/utils/haptics';
import type { VatScheme } from '../../src/domain/business';
import { suggestVatScheme } from '../../src/services/vatSchemeAdvisor';

export default function VatAndAuditScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { businessProfile, updateBusinessProfile } = useAppState();
  const country = businessProfile.country ?? 'NL';

  const [scheme, setScheme] = useState<VatScheme>(businessProfile.vatScheme ?? 'standard');
  const [verification, setVerification] = useState<AuditVerificationResult | null>(null);
  const [entryCount, setEntryCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([verifyAuditTrail(), getAuditEntries({})]).then(([v, entries]) => {
      if (cancelled) return;
      setVerification(v);
      setEntryCount(entries.length);
    });
    return () => { cancelled = true; };
  }, []);

  const handleSchemeChange = async (next: VatScheme) => {
    if (next === scheme) return;
    setScheme(next);
    await updateBusinessProfile({ vatScheme: next });
    hapticSuccess();
  };

  const handleExport = async () => {
    try {
      const text = await exportAuditTrail();
      await Share.share({
        message: text,
        title: t(country === 'DE' ? 'audit.exportTitleGobd' : 'audit.exportTitle', 'Vasco audit trail'),
      });
    } catch (e) {
      Alert.alert('Export failed', String((e as Error).message ?? e));
    }
  };

  const handleVerify = async () => {
    const v = await verifyAuditTrail();
    setVerification(v);
    hapticSuccess();
    Alert.alert(
      v.valid ? '✓ Audit trail valid' : '✗ Audit trail tampered',
      v.valid
        ? `${v.totalEntries} entries — chain unbroken.`
        : `Chain broken at index ${v.brokenAtIndex} — ${v.brokenReason}`,
    );
  };

  // Schemes available for the contractor's country.
  const schemeOptions: { value: VatScheme; label: string; subtitle: string; visible: boolean }[] = [
    {
      value: 'standard',
      label: t('vatScheme.standard', 'Standard VAT'),
      subtitle: country === 'NL'
        ? '21% / 9% / 0% (BTW-plichtig)'
        : country === 'DE'
          ? '19% / 7% / 0% (Umsatzsteuer)'
          : 'Standard rate per country',
      visible: true,
    },
    {
      value: 'small_business_NL_KOR',
      label: t('vatScheme.korNl', 'KOR — Kleineondernemersregeling'),
      subtitle: 'NL · Geen BTW · jaaromzet ≤ €20.000',
      visible: country === 'NL',
    },
    {
      value: 'small_business_DE_kleinunternehmer',
      label: t('vatScheme.kleinunternehmer', 'Kleinunternehmer (§19 UStG)'),
      subtitle: 'DE · Keine USt · Vorjahr ≤ €22.000 · laufendes ≤ €50.000',
      visible: country === 'DE',
    },
  ];

  return (
    <SafeAreaView style={styles.root}>
      <DKScreenHeader title="VAT & AUDIT" />
      <ScrollView contentContainerStyle={styles.content}>

        {/* R263: advisor banner — only when high-confidence and differs from current */}
        {(() => {
          const advice = suggestVatScheme({
            country: businessProfile.country,
            businessType: (businessProfile as any).businessType,
            teamSize: (businessProfile as any).teamSize,
          });
          if (!advice.confident || advice.suggested === scheme) return null;
          return (
            <View style={styles.advisor}>
              <View style={styles.advisorHeader}>
                <Ionicons name="bulb" size={18} color={DK.colors.accent} />
                <DKLabel style={styles.advisorLabel}>
                  {t('vatScheme.advisor.title', 'SUGGESTED FOR YOU')}
                </DKLabel>
              </View>
              <Text style={styles.advisorBody}>
                {t(advice.i18nKey, advice.reason)}
              </Text>
              <Pressable
                style={styles.advisorBtn}
                onPress={() => handleSchemeChange(advice.suggested)}
                accessibilityRole="button"
                accessibilityLabel={t('vatScheme.advisor.applyA11y', 'Apply suggested VAT scheme')}
              >
                <Text style={styles.advisorBtnText}>
                  {t('vatScheme.advisor.apply', 'USE THIS SCHEME')}
                </Text>
              </Pressable>
            </View>
          );
        })()}

        {/* VAT scheme picker */}
        <DKLabel style={styles.section}>VAT SCHEME</DKLabel>
        <View style={styles.card}>
          {schemeOptions.filter((o) => o.visible).map((opt, idx) => (
            <Pressable
              key={opt.value}
              style={[styles.row, idx > 0 && styles.rowBorder]}
              onPress={() => handleSchemeChange(opt.value)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{opt.label}</Text>
                <Text style={styles.rowSubtitle}>{opt.subtitle}</Text>
              </View>
              <View style={[styles.radio, scheme === opt.value && styles.radioActive]}>
                {scheme === opt.value && <View style={styles.radioDot} />}
              </View>
            </Pressable>
          ))}
        </View>

        {scheme !== 'standard' && (
          <View style={styles.notice}>
            <Ionicons name="information-circle" size={18} color={DK.colors.highlight} />
            <Text style={styles.noticeText}>
              {scheme === 'small_business_NL_KOR'
                ? 'Iedere factuur toont 0% BTW + verplichte KOR-vermelding.'
                : 'Jede Rechnung zeigt 0% USt + §19-Hinweis.'}
            </Text>
          </View>
        )}

        {/* Audit trail. GoBD is a German standard — only name it for DE users;
            everyone else sees a localized, country-neutral title/footnote. The
            mechanism (hash-chained immutable log) is the same for all. */}
        <DKLabel style={[styles.section, { marginTop: GRID.lg }]}>
          {t(country === 'DE' ? 'audit.sectionTitleGobd' : 'audit.sectionTitle', 'Audit trail')}
        </DKLabel>
        <View style={styles.card}>
          <View style={styles.rowStatic}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{t('audit.totalEntries', 'Audit entries')}</Text>
              <Text style={styles.rowSubtitle}>
                {t('audit.totalEntriesDesc', 'Hash-chained record of invoice lifecycle events')}
              </Text>
            </View>
            <Text style={styles.rowValue}>{entryCount}</Text>
          </View>

          <View style={[styles.rowStatic, styles.rowBorder]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{t('audit.integrity', 'Chain integrity')}</Text>
              <Text style={styles.rowSubtitle}>
                {verification?.valid === undefined
                  ? t('audit.checking', 'Checking...')
                  : verification.valid
                    ? t('audit.valid', '✓ unbroken')
                    : `✗ broken @ ${verification.brokenAtIndex}`}
              </Text>
            </View>
            <View
              style={[
                styles.statusDot,
                verification?.valid ? styles.statusDotOk : verification?.valid === false ? styles.statusDotErr : null,
              ]}
            />
          </View>

          <Pressable style={[styles.actionRow, styles.rowBorder]} onPress={handleVerify}>
            <Ionicons name="shield-checkmark" size={18} color={DK.colors.accent} />
            <Text style={styles.actionLabel}>{t('audit.verify', 'Run verification')}</Text>
          </Pressable>

          <Pressable style={[styles.actionRow, styles.rowBorder]} onPress={handleExport}>
            <Ionicons name="download" size={18} color={DK.colors.accent} />
            <Text style={styles.actionLabel}>{t('audit.export', 'Export trail (.txt)')}</Text>
          </Pressable>
        </View>

        <Text style={styles.footnote}>
          {country === 'DE'
            ? t('audit.footnoteGobd',
                'GoBD requires 10-year retention. The hash chain proves no entry was retroactively changed. ' +
                'For full archive certification (DATEV-zertifiziert), pair this export with your accountant\'s archive.')
            : t('audit.footnote',
                'The hash chain proves no entry was retroactively changed. Keep this export with your records ' +
                'for your country\'s statutory retention period.')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DK.colors.bg },
  content: { padding: GRID.lg, paddingBottom: GRID.xl * 2, gap: GRID.xs },
  section: { color: DK.colors.textMuted, marginTop: GRID.sm, marginBottom: GRID.xs },
  card: {
    backgroundColor: DK.colors.panel,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: GRID.md,
    paddingVertical: GRID.md,
    gap: GRID.sm,
  },
  rowStatic: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: GRID.md,
    paddingVertical: GRID.md,
    gap: GRID.sm,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: DK.colors.border },
  rowLabel: { fontSize: 14, fontFamily: TYPE.bodyFamily, color: DK.colors.text },
  rowSubtitle: { fontSize: 12, fontFamily: TYPE.captionFamily, color: DK.colors.textMuted, marginTop: 2 },
  rowValue: { fontSize: 16, fontFamily: TYPE.titleFamily, color: DK.colors.text },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: DK.colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: DK.colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: DK.colors.accent },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    backgroundColor: DK.colors.highlight + '12',
    borderRadius: RADIUS.md,
    padding: GRID.md,
    marginTop: GRID.sm,
  },
  noticeText: { flex: 1, fontSize: 13, fontFamily: TYPE.bodyFamily, color: DK.colors.text },
  advisor: {
    backgroundColor: DK.colors.accent + '14',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: DK.colors.accent + '40',
    padding: GRID.md,
    marginBottom: GRID.md,
    gap: GRID.xs,
  },
  advisorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
  },
  advisorLabel: { color: DK.colors.accent, fontSize: 11, letterSpacing: 1.4 },
  advisorBody: { fontSize: 13, fontFamily: TYPE.bodyFamily, color: DK.colors.text, lineHeight: 18 },
  advisorBtn: {
    alignSelf: 'flex-start',
    backgroundColor: DK.colors.accent,
    paddingHorizontal: GRID.md,
    paddingVertical: GRID.xs + 2,
    borderRadius: RADIUS.full,
    marginTop: GRID.xs,
    shadowColor: DK.colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  advisorBtnText: {
    color: '#000',
    fontFamily: TYPE.titleFamily,
    fontSize: 12,
    letterSpacing: 1.2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    paddingHorizontal: GRID.md,
    paddingVertical: GRID.md,
  },
  actionLabel: { fontSize: 14, fontFamily: TYPE.bodyFamily, color: DK.colors.text },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: DK.colors.textMuted },
  statusDotOk: { backgroundColor: DK.colors.success },
  statusDotErr: { backgroundColor: DK.colors.danger ?? '#EF4444' },
  footnote: {
    fontSize: 11,
    fontFamily: TYPE.tinyFamily,
    color: DK.colors.textMuted,
    paddingHorizontal: GRID.sm,
    marginTop: GRID.md,
  },
});
