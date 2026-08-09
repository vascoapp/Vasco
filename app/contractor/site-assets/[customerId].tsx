// =============================================================================
// SITE ASSETS — what you service at this customer's address
// =============================================================================
// Reached from the customer screen. Two lists: what has been registered, and
// what the job history suggests is worth registering.
//
// The proposals are the point. A manual asset register asks for a serial number
// before it gives anything back, so it stays empty and the feature dies. Here
// the app has already noticed you keep going back to one address and asks the
// only question it cannot answer itself: what is it you service there?
// =============================================================================

import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../../src/theme/tabStyles';
import { SafeArea } from '../../../src/theme/spacing';
import { DKScreenHeader } from '../../../src/components/shared/DKScreenHeader';
import { hapticSuccess } from '../../../src/utils/haptics';
import { useAppState } from '../../../src/state/AppState';
import {
  useCustomerSiteAssets,
  newAsset,
  historyForSite,
  nextServiceDue,
  type SiteAsset,
  type SiteAssetCategory,
  type SiteAssetProposal,
  type ProposalJob,
} from '../../../src/services/siteAssetService';
import { formatDateShortAuto } from '../../../src/i18n/formatting';

const CATEGORIES: SiteAssetCategory[] = [
  'heating', 'water', 'electrical', 'ventilation', 'roof', 'exterior', 'other',
];

/** Months offered for a service interval. Empty stays valid — see the service. */
const INTERVALS = [6, 12, 24];

export default function SiteAssetsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const { jobs, customers } = useAppState();
  const { assets, proposals, upsert, remove } = useCustomerSiteAssets(String(customerId));

  const customer = customers.find((c) => c.id === customerId);
  const [draft, setDraft] = useState<SiteAsset | null>(null);

  const startFromProposal = (p: SiteAssetProposal) => {
    setDraft({ ...newAsset(p.customerId, p.siteKey, p.siteLabel) });
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      // The name is the whole point of asking — an unnamed asset records
      // nothing the history did not already say.
      Alert.alert(t('siteAssets.nameRequired', 'Give it a name first'));
      return;
    }
    await upsert(draft);
    hapticSuccess();
    setDraft(null);
  };

  const confirmDelete = (asset: SiteAsset) => {
    Alert.alert(
      t('siteAssets.deleteTitle', 'Remove this asset?'),
      t('siteAssets.deleteBody', 'The job history at this address is not affected.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        { text: t('common.delete', 'Delete'), style: 'destructive', onPress: () => remove(asset.id) },
      ],
    );
  };

  const renderAsset = (asset: SiteAsset) => {
    const history = historyForSite(jobs as unknown as ProposalJob[], asset.customerId, asset.siteKey);
    const last = history[0]?.completedAt ?? history[0]?.updatedAt;
    const due = nextServiceDue(asset, last);

    return (
      <View key={asset.id} style={styles.card}>
        <View style={styles.cardHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.assetName}>{asset.name}</Text>
            <Text style={styles.assetSite}>{asset.siteLabel}</Text>
          </View>
          <Pressable onPress={() => confirmDelete(asset)} hitSlop={8}>
            <Ionicons name="trash-outline" size={18} color={SemanticColors.textTertiary} />
          </Pressable>
        </View>

        {!!asset.details && <Text style={styles.details}>{asset.details}</Text>}

        {/* Absent when the contractor has not set an interval — an assumed
            annual service on someone else's unit is a claim we cannot support. */}
        {due && (
          <Text style={styles.due}>
            {t('siteAssets.nextDue', 'Next service due {{date}}', {
              date: formatDateShortAuto(new Date(due)),
            })}
          </Text>
        )}

        <Text style={styles.historyLabel}>
          {t('siteAssets.serviceHistory', '{{count}} visits on record', { count: history.length })}
        </Text>
        {history.slice(0, 4).map((h, i) => (
          <Text key={i} style={styles.historyRow} numberOfLines={1}>
            {(h.completedAt ?? h.updatedAt ?? '').slice(0, 10)} · {h.title}
          </Text>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <DKScreenHeader
        title={t('siteAssets.title', 'Serviced assets')}
        subtitle={customer?.name}
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {draft ? (
          <View style={styles.card}>
            <Text style={styles.editTitle}>{draft.siteLabel}</Text>

            <Text style={styles.fieldLabel}>{t('siteAssets.name', 'What do you service here?')}</Text>
            <TextInput
              style={styles.input}
              value={draft.name}
              onChangeText={(v) => setDraft({ ...draft, name: v })}
              placeholder={t('siteAssets.namePlaceholder', 'e.g. CV-ketel Remeha Avanta')}
              placeholderTextColor={SemanticColors.textTertiary}
            />

            <Text style={styles.fieldLabel}>{t('siteAssets.details', 'Model, serial, position')}</Text>
            <TextInput
              style={styles.input}
              value={draft.details ?? ''}
              onChangeText={(v) => setDraft({ ...draft, details: v })}
              placeholder={t('siteAssets.detailsPlaceholder', 'Optional')}
              placeholderTextColor={SemanticColors.textTertiary}
            />

            <Text style={styles.fieldLabel}>{t('siteAssets.category', 'Category')}</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c}
                  style={[styles.chip, draft.category === c && styles.chipActive]}
                  onPress={() => setDraft({ ...draft, category: c })}
                >
                  <Text style={[styles.chipText, draft.category === c && styles.chipTextActive]}>
                    {t(`siteAssets.cat.${c}`, c)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>{t('siteAssets.interval', 'Service every')}</Text>
            <View style={styles.chipRow}>
              {INTERVALS.map((m) => (
                <Pressable
                  key={m}
                  style={[styles.chip, draft.serviceIntervalMonths === m && styles.chipActive]}
                  // Tapping the active one clears it: "I don't know" must stay
                  // reachable, because a made-up interval drives a due date.
                  onPress={() => setDraft({ ...draft, serviceIntervalMonths: draft.serviceIntervalMonths === m ? undefined : m })}
                >
                  <Text style={[styles.chipText, draft.serviceIntervalMonths === m && styles.chipTextActive]}>
                    {t('siteAssets.months', '{{count}} months', { count: m })}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.editActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setDraft(null)}>
                <Text style={styles.cancelBtnText}>{t('common.cancel', 'Cancel')}</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={save}>
                <Text style={styles.saveBtnText}>{t('common.save', 'Save')}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            {assets.map(renderAsset)}

            {proposals.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>{t('siteAssets.suggested', 'Worth registering')}</Text>
                {proposals.map((p) => (
                  <Pressable key={p.siteKey} style={styles.proposal} onPress={() => startFromProposal(p)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.proposalSite}>{p.siteLabel}</Text>
                      {/* States the evidence rather than naming the asset: the
                          app does not know what is there, only that you keep
                          going back. */}
                      <Text style={styles.proposalWhy}>
                        {t('siteAssets.visitsSoFar', '{{count}} visits — {{work}}', {
                          count: p.visits,
                          work: p.recentWork.join(', '),
                        })}
                      </Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={20} color={Palette.hermesOrange} />
                  </Pressable>
                ))}
              </>
            )}

            {assets.length === 0 && proposals.length === 0 && (
              <View style={styles.empty}>
                <Ionicons name="cube-outline" size={44} color={SemanticColors.textTertiary} />
                <Text style={styles.emptyTitle}>{t('siteAssets.emptyTitle', 'Nothing to register yet')}</Text>
                <Text style={styles.emptyHint}>
                  {t('siteAssets.emptyHint', 'Once you have finished work at the same address twice, it shows up here to register.')}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  content: { padding: GRID.md, paddingBottom: SafeArea.bottom + 40, gap: GRID.sm },
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    padding: 14,
    gap: 6,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: GRID.sm },
  assetName: { color: SemanticColors.textPrimary, fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily },
  assetSite: { color: SemanticColors.textSecondary, fontSize: TYPE.captionSize },
  details: { color: SemanticColors.textSecondary, fontSize: TYPE.captionSize },
  due: { color: Palette.hermesOrange, fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily },
  historyLabel: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.labelSize,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  historyRow: { color: SemanticColors.textSecondary, fontSize: TYPE.captionSize },
  sectionLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: GRID.md,
  },
  proposal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Palette.hermesOrange + '60',
    padding: 14,
  },
  proposalSite: { color: SemanticColors.textPrimary, fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily },
  proposalWhy: { color: SemanticColors.textSecondary, fontSize: TYPE.captionSize },
  editTitle: { color: SemanticColors.textPrimary, fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily },
  fieldLabel: { color: SemanticColors.textSecondary, fontSize: TYPE.captionSize, marginTop: 6 },
  input: {
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    paddingHorizontal: GRID.sm,
    paddingVertical: 10,
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID.xs },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  chipActive: { backgroundColor: SemanticColors.actionPrimary + '20', borderColor: SemanticColors.actionPrimary },
  chipText: { color: SemanticColors.textSecondary, fontSize: TYPE.captionSize },
  chipTextActive: { color: SemanticColors.actionPrimary, fontFamily: TYPE.titleFamily },
  editActions: { flexDirection: 'row', gap: GRID.sm, marginTop: GRID.sm },
  cancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: RADIUS.full, borderWidth: 1, borderColor: SemanticColors.borderDefault },
  cancelBtnText: { color: SemanticColors.textSecondary, fontSize: TYPE.bodySize - 1 },
  saveBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: RADIUS.full, backgroundColor: SemanticColors.actionPrimary },
  saveBtnText: { color: Palette.white, fontSize: TYPE.bodySize - 1, fontFamily: TYPE.titleFamily },
  empty: { alignItems: 'center', padding: GRID.xl, gap: GRID.sm },
  emptyTitle: { color: SemanticColors.textSecondary, fontSize: TYPE.bodySize },
  emptyHint: { color: SemanticColors.textTertiary, fontSize: TYPE.captionSize, textAlign: 'center', lineHeight: 19 },
});
