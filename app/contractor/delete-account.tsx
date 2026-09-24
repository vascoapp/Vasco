// =============================================================================
// DELETE ACCOUNT — export, then delete (user's decision, 2026-09-24)
// =============================================================================
// The ONE place an account deletion starts. Profile, the AI tab and the legal
// screen each had their own flow (one inserting the request itself), and all
// warned "financial records will be anonymised per EU retention law" — which
// was never true (the auth cascade erased them) and is not Vasco's duty: the
// contractor must keep their invoices, Vasco deletes everything. So:
//   1. Keep your records — the country's period when known, the downloads.
//   2. Acknowledge it (required).
//   3. Delete — through accountDeletionService, which refuses to wipe the
//      phone if the request did not reach the server.
// =============================================================================
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { SafeArea } from '../../src/theme/spacing';
import { DKScreenHeader } from '../../src/components/shared/DKScreenHeader';
import { useAuth } from '../../src/context/AuthContext';
import { useAppState } from '../../src/state/AppState';
import { exportAllData } from '../../src/services/dataExportService';
import { exportRecordsArchive } from '../../src/services/recordsArchiveService';
import { requestAccountDeletion } from '../../src/services/accountDeletionService';
import { invoiceRetentionYears } from '../../src/domain/recordRetention';
import { getAuthedUserId } from '../../src/lib/currentUser';

export default function DeleteAccountScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { businessProfile, invoices, lineItems, customers, jobs } = useAppState();
  const [exported, setExported] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [archived, setArchived] = useState(false);
  const [archiving, setArchiving] = useState(false);
  // Each PDF is rendered in turn — a long history takes minutes, so say where it is.
  const [archiveProgress, setArchiveProgress] = useState<{ done: number; total: number } | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Profile first, account as fallback (CLAUDE.md); unknown → no number.
  const years = invoiceRetentionYears(businessProfile?.country ?? user?.country);

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await exportAllData('json', { userId: user?.id, email: user?.email });
      // Only a COMPLETE export counts: offline it is the device cache only,
      // and a table that could not be read is a record the business lacks.
      if (result.success && result.complete) setExported(true);
      else Alert.alert(t('accountDeletion.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  // The invoices THEMSELVES — PDF as the customer received it + the market's
  // e-invoice — which the JSON export above does not give an accountant.
  const handleInvoicesArchive = async () => {
    setArchiving(true);
    try {
      const result = await exportRecordsArchive({
        invoices, lineItems: lineItems as any, customers, jobs: jobs as any, businessProfile,
        // Profile first, account as fallback; unknown → no format, never a default.
        country: businessProfile?.country ?? user?.country ?? '',
        t: (key, fallback, opts) => t(key, { defaultValue: fallback, ...opts }),
        onProgress: (done, total) => setArchiveProgress({ done, total }),
      });
      const gaps = result.pdfFailed.length + result.xmlMissing.filter((m) => m.kind !== 'noFormat').length;
      if (!result.ok) Alert.alert(t('accountDeletion.invoicesArchiveFailed'));
      else if (gaps > 0) Alert.alert(t('accountDeletion.invoicesArchivePartial', { count: result.invoiceCount }));
      // Created, even if a gap is listed: the file exists and says what it lacks.
      if (result.ok) setArchived(true);
    } finally {
      setArchiving(false);
      setArchiveProgress(null);
    }
  };

  const submit = async () => {
    setDeleting(true);
    try {
      // The signed-in backend id (null for a demo account, which has no
      // server rows); RLS refuses a request for anyone else anyway.
      const authId = getAuthedUserId();
      const result = authId
        ? await requestAccountDeletion(authId)
        : { success: false, serverRequested: false };
      if (!result.success || !result.serverRequested) {
        Alert.alert(t('accountDeletion.failedTitle'), t('accountDeletion.failedBody'));
        return;
      }
      Alert.alert(t('accountDeletion.doneTitle'), t('accountDeletion.doneBody'), [
        { text: t('common.ok', 'OK'), onPress: () => { logout(); router.replace('/login'); } },
      ]);
    } finally {
      setDeleting(false);
    }
  };

  const confirm = () => {
    Alert.alert(t('accountDeletion.confirmTitle'), t('accountDeletion.confirmBody'), [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      { text: t('accountDeletion.confirmDelete'), style: 'destructive', onPress: () => { void submit(); } },
    ]);
  };

  const canDelete = acknowledged && !deleting;

  return (
    <View style={styles.container}>
      <DKScreenHeader title={t('accountDeletion.title')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>{t('accountDeletion.intro')}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('accountDeletion.keepTitle')}</Text>
          <Text style={styles.body}>
            {years != null ? t('accountDeletion.dutyYears', { years }) : t('accountDeletion.dutyUnknown')}
          </Text>
          <Pressable
            style={[styles.primaryBtn, exporting && styles.disabled]}
            onPress={handleExport}
            disabled={exporting}
            accessibilityRole="button"
          >
            <Ionicons name={exported ? 'checkmark-circle' : 'download-outline'} size={18} color={Palette.white} />
            <Text style={styles.primaryBtnText}>
              {exported ? t('accountDeletion.exported') : t('accountDeletion.exportAll')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryBtn, archiving && styles.disabled]}
            onPress={handleInvoicesArchive}
            disabled={archiving}
            accessibilityRole="button"
            accessibilityState={{ busy: archiving }}
          >
            <Ionicons name={archived ? 'checkmark-circle' : 'documents-outline'} size={18} color={Palette.hermesOrange} />
            <Text style={styles.secondaryBtnText}>
              {archiveProgress
                ? t('accountDeletion.invoicesArchiveProgress', archiveProgress)
                : archived ? t('accountDeletion.invoicesArchiveDone') : t('accountDeletion.invoicesArchive')}
            </Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => router.push('/contractor/reports' as any)}
            accessibilityRole="button"
          >
            <Ionicons name="document-text-outline" size={18} color={Palette.hermesOrange} />
            <Text style={styles.secondaryBtnText}>{t('accountDeletion.reports')}</Text>
          </Pressable>
        </View>

        <Pressable
          style={styles.ackRow}
          onPress={() => setAcknowledged((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: acknowledged }}
          accessibilityLabel={t('accountDeletion.ack')}
        >
          <Text style={styles.ackText}>{t('accountDeletion.ack')}</Text>
          {/* The row is the one control a screen reader lands on. */}
          <Switch
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            value={acknowledged}
            onValueChange={setAcknowledged}
            trackColor={{ true: Palette.hermesOrange, false: SemanticColors.borderDefault }}
          />
        </Pressable>

        <Pressable
          style={[styles.deleteBtn, !canDelete && styles.disabled]}
          onPress={confirm}
          disabled={!canDelete}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canDelete }}
        >
          <Ionicons name="trash-outline" size={18} color={Palette.white} />
          <Text style={styles.primaryBtnText}>{t('accountDeletion.deleteBtn')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  content: { padding: GRID.md, paddingBottom: SafeArea.bottom + 40 },
  intro: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.captionSize,
    lineHeight: 19,
    marginBottom: GRID.md,
  },
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    marginBottom: GRID.lg,
    gap: GRID.sm,
  },
  cardTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
  },
  body: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.bodySize,
    lineHeight: 21,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.xs,
    backgroundColor: Palette.hermesOrange,
    borderRadius: RADIUS.full,
    paddingVertical: GRID.sm + 2,
    marginTop: GRID.xs,
  },
  primaryBtnText: {
    color: Palette.white,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    paddingVertical: GRID.sm + 2,
  },
  secondaryBtnText: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
  },
  ackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    marginBottom: GRID.lg,
  },
  ackText: {
    flex: 1,
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize,
    lineHeight: 21,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.xs,
    backgroundColor: SemanticColors.feedbackError,
    borderRadius: RADIUS.full,
    paddingVertical: GRID.sm + 4,
  },
  disabled: { opacity: 0.5 },
});
