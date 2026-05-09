// =============================================================================
// KEUZES — Customer Decision Tracker
// =============================================================================
// Track customer decisions to keep projects on schedule. Customers see what
// needs to be decided and when, with integrated reminders to reduce project
// overflow caused by late decisions.
// =============================================================================

import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Palette, SemanticColors } from '../../src/theme/colors';
import { PAGE_BG, TYPE } from '../../src/theme/tabStyles';
import { hapticSuccess } from '../../src/utils/haptics';
import { Spacing } from '../../src/theme/spacing';
import { MS_PER_DAY } from '../../src/utils/timeConstants';
import {
  DecisionTrackerList,
  DecisionTrackerDetail,
  TemplatePicker,
} from '../../src/components/contractor/DecisionTracker';
import { ShareDecisionTracker } from '../../src/components/contractor/ShareDecisionTracker';
import type { CustomerDecisionTracker, DecisionTemplate } from '../../src/types/decisions';
import { recordScreenVisit } from '../../src/intelligence/learningStorage';
import { useDecisionUpdates } from '../../src/services/decisionSyncService';
import { PhotoSubmissionsPanel } from '../../src/components/contractor/PhotoSubmissionsPanel';
import { DecisionActivityPanel } from '../../src/components/contractor/DecisionActivityPanel';

// R66 round 30: persist contractor-side tracker mutations so they survive
// app backgrounding. Pre-R30, `handleSelectTemplate` and `handleRecordDecision`
// updated component-local state only — backgrounding the app dropped 30+
// freshly-entered decision items. Same pattern as DecisionTracker.tsx
// (`@vasco_decision_trackers` AsyncStorage key, upsert by tracker.id).
//
// FE→BE→DB drift NOTE (left for R66 round 31): `decision_trackers.id` and
// `decision_items.id` are DB-generated UUIDs (migration 003), but FE here
// generates `tracker_${Date.now()}` + uses template-string item ids
// (`item_paint_color`). Direct BE inserts would fail UUID cast. R31 will
// follow R52/R54: insert without `id`, capture row uuids, rekey via
// idRemapBus. For R30 we keep the existing FE id shape and stay
// AsyncStorage-only — no BE writes that could expose the drift.
const TRACKER_STORAGE_KEY = '@vasco_decision_trackers';

async function persistTrackerLocal(tracker: CustomerDecisionTracker): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(TRACKER_STORAGE_KEY);
    const list: CustomerDecisionTracker[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex((t) => t.id === tracker.id);
    if (idx >= 0) {
      list[idx] = tracker;
    } else {
      list.unshift(tracker);
    }
    await AsyncStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Non-fatal — UI already updated optimistically. Worst case the
    // tracker disappears on next cold start, matching pre-R30 behavior.
  }
}

type ViewMode = 'list' | 'detail' | 'template-picker';

export default function KeuzeScreen() {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedTracker, setSelectedTracker] = useState<CustomerDecisionTracker | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Decision sync — shows badge when customer submits new decisions
  const { newCount: decisionNewCount, submissions: decisionSubmissions, refresh: refreshDecisions } = useDecisionUpdates(
    selectedTracker?.id ?? null
  );

  // Screen visit tracking
  useEffect(() => { recordScreenVisit('decisions'); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshDecisions();
    setTimeout(() => {
      setRefreshing(false);
      hapticSuccess();
    }, 800);
  }, [refreshDecisions]);

  const handleSelectTracker = (tracker: CustomerDecisionTracker) => {
    setSelectedTracker(tracker);
    setViewMode('detail');
  };

  const handleCreateNew = () => {
    setViewMode('template-picker');
  };

  const handleSelectTemplate = (template: DecisionTemplate) => {
    // R66 round 32: route create through decisionTrackerService so BE
    // gets the tracker + items rows with proper UUIDs. Optimistic flow:
    //   1. Build a local tempId-keyed tracker, render immediately.
    //   2. Persist locally so backgrounding mid-request doesn't lose it.
    //   3. Fire-and-await createTrackerWithBE — on success, swap to the
    //      BE-uuid version and re-persist; on failure, keep the local
    //      copy (tempId stays; flagged for r33 retry path).
    const customerName = t('decisions.newCustomer', 'New customer');
    const optimistic: CustomerDecisionTracker = {
      id: `tracker_${Date.now()}`,
      jobId: 'new',
      customerId: 'new',
      customerName,
      templateId: template.id,
      templateName: template.name,
      projectStartDate: new Date().toISOString(),
      phases: [],
      categories: template.categories.map(cat => ({
        id: cat.id,
        categoryId: cat.id,
        name: cat.name,
        phase: cat.phase,
        dueDate: new Date(Date.now() + cat.daysBeforePhaseStart * MS_PER_DAY).toISOString(),
        items: cat.items.map(item => ({
          id: item.id,
          itemId: item.id,
          name: item.name,
          description: item.description,
          inputType: item.inputType,
          options: item.options,
          priority: item.priority,
          status: 'pending' as const,
          dueDate: new Date(Date.now() + cat.daysBeforePhaseStart * MS_PER_DAY).toISOString(),
          isOverdue: false,
          remindersSent: 0,
        })),
        isOverdue: false,
        completedCount: 0,
        totalCount: cat.items.length,
      })),
      totalDecisions: template.estimatedTotalDecisions,
      decidedCount: 0,
      pendingCount: template.estimatedTotalDecisions,
      overdueCount: 0,
      reminderFrequency: 'every_2_days',
      preferredChannel: 'whatsapp',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSelectedTracker(optimistic);
    setViewMode('detail');
    persistTrackerLocal(optimistic);
    // R66r49 #6: pack discovery hook. First tracker create is the moment
    // to suggest the Decisions pack (OFF by default). Idempotent.
    import('../../src/services/workflowPackService')
      .then((m) => m.suggestPackIfFirstTime({
        packId: 'klant_keuze_herinnering',
        title: t('packDiscovery.decisions.title', 'Auto-nudge for unanswered choices?'),
        body: t('packDiscovery.decisions.body', 'Vasco can remind your customer at +3 and +7 days when items in this checklist stay open.'),
      }))
      .catch(() => {});

    // Background BE create — replaces the optimistic tempId-keyed tracker
    // with the BE-uuid version. We dynamic-import the service to keep the
    // initial bundle lean for screens that never hit "create".
    (async () => {
      try {
        const [{ createTrackerWithBE }, { getCurrentUserId }] = await Promise.all([
          import('../../src/services/decisionTrackerService'),
          import('../../src/lib/currentUser'),
        ]);
        const userId = getCurrentUserId();
        if (!userId || userId === 'current-user') return;
        const result = await createTrackerWithBE({
          userId,
          template,
          customerName,
        });
        if (!result.persistedRemotely) return;
        setSelectedTracker((prev) => {
          if (!prev || prev.id !== optimistic.id) return prev;
          return result.tracker;
        });
        // Drop the tempId-keyed local copy and write the BE-uuid one.
        try {
          const raw = await AsyncStorage.getItem(TRACKER_STORAGE_KEY);
          const list: CustomerDecisionTracker[] = raw ? JSON.parse(raw) : [];
          const next = list.filter((tr) => tr.id !== optimistic.id);
          next.unshift(result.tracker);
          await AsyncStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(next));
        } catch {}
      } catch {
        // Local copy stays — no UI disruption. Re-attempt deferred to a
        // future round (offline-queue style replay).
      }
    })();
  };

  const handleClose = () => {
    setSelectedTracker(null);
    setViewMode('list');
  };

  const handleSendReminder = (
    trackerId: string,
    itemIds: string[],
    channel: 'whatsapp' | 'sms' | 'email'
  ) => {
    // R66 round 30: silent-failure gate. Pre-R30 this Alert claimed
    // "Herinnering verstuurd" + bumped lastReminderSent — but no
    // actual WhatsApp/SMS/email left the device. Contractors thought
    // their customer got a nudge; customer received nothing. R31 will
    // wire customerPhone → wa.me deep-link via whatsappService for
    // the WA channel; SMS/email need provider integration. Until then
    // surface honestly so contractors don't trust a phantom send.
    const { DEMO_MODE } = require('../../src/config/demo');
    if (!DEMO_MODE) {
      Alert.alert(
        t('decisions.reminderUnavailableTitle', 'Coming soon'),
        t('decisions.reminderUnavailableBody', 'Automated decision reminders are in development. For now, message your customer directly via WhatsApp or call them.'),
      );
      return;
    }
    const channelLabel = channel === 'whatsapp' ? 'WhatsApp' : channel === 'sms' ? 'SMS' : t('decisions.channelEmail', 'email');
    Alert.alert(
      t('decisions.reminderSentTitle', 'Reminder sent'),
      t('decisions.reminderSentBody', '{{count}} item(s) sent via {{channel}}.', { count: itemIds.length, channel: channelLabel }),
    );
    if (selectedTracker) {
      const updated: CustomerDecisionTracker = {
        ...selectedTracker,
        lastReminderSent: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSelectedTracker(updated);
      persistTrackerLocal(updated);
    }
  };

  const handleRecordDecision = (
    trackerId: string,
    itemId: string,
    value: string | number | boolean
  ) => {
    if (!selectedTracker) return;
    const updatedCategories = selectedTracker.categories.map(cat => ({
      ...cat,
      items: cat.items.map(item =>
        item.itemId === itemId
          ? { ...item, status: 'decided' as const, value, decidedAt: new Date().toISOString() }
          : item
      ),
      completedCount: cat.items.filter(item =>
        item.itemId === itemId ? true : item.status === 'decided'
      ).length,
    }));
    const decidedCount = updatedCategories.reduce((sum, cat) => sum + cat.completedCount, 0);
    const updatedTracker: CustomerDecisionTracker = {
      ...selectedTracker,
      categories: updatedCategories,
      decidedCount,
      pendingCount: selectedTracker.totalDecisions - decidedCount,
      updatedAt: new Date().toISOString(),
    };
    setSelectedTracker(updatedTracker);
    // R66 round 30: persist contractor-recorded decisions so they
    // survive backgrounding. Pre-R30 this lived in React state only —
    // a contractor recording 5 decisions face-to-face with a customer
    // could lose all of them by tapping home before navigating away.
    // BE write deferred to R31 (FE→BE→DB drift: tracker.id and itemId
    // are non-UUID strings here; submitDecision call would fail UUID
    // cast on decision_submissions.tracker_id / .item_id).
    persistTrackerLocal(updatedTracker);
  };

  const handleShareWithCustomer = () => {
    // R66 round 32: ungated for BE-persisted trackers. Pre-R32 (R25 gate)
    // we hard-blocked the share path because the customer portal lookup
    // in mockCustomerPortal returned false outside DEMO mode. R32 lands
    // the SECURITY DEFINER RPC `get_portal_by_access_code` and the
    // service-side BE create — trackers with `accessCode` are now
    // resolvable on /customer/[code] cross-device.
    //
    // Legacy local-only trackers (created pre-R30 or when BE create
    // failed and we fell through to local) don't have `accessCode` set.
    // Block them to avoid shipping a code that won't resolve. Demo
    // accounts still get the seeded VDB24A path.
    const { DEMO_MODE } = require('../../src/config/demo');
    const hasUsableCode = !!selectedTracker?.accessCode || DEMO_MODE;
    if (!hasUsableCode) {
      Alert.alert(
        t('decisions.shareUnavailableTitle', 'Coming soon'),
        t('decisions.shareLocalOnlyBody', 'This tracker was created offline and hasn\'t synced yet. Reconnect and reopen the tracker to share it with your customer.'),
      );
      return;
    }
    setShowShareModal(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.titleRow}>
        <Text style={styles.pageTitle}>{t('decisions.title', 'Customer decisions')}</Text>
        {decisionNewCount > 0 && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>{t('decisions.newBadge', '{{count}} new', { count: decisionNewCount })}</Text>
          </View>
        )}
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />
        }
      >
        {viewMode === 'list' && (
          <DecisionTrackerList
            onSelectTracker={handleSelectTracker}
            onCreateNew={handleCreateNew}
          />
        )}

        {viewMode === 'detail' && selectedTracker && (
          <>
            <View style={{ paddingHorizontal: Spacing.md, paddingTop: Spacing.md, gap: Spacing.sm }}>
              <PhotoSubmissionsPanel
                submissions={decisionSubmissions}
                trackerId={selectedTracker.id}
                customerName={selectedTracker.customerName}
              />
              {/* R66 round 47: customer activity / hesitation timeline. Only
                  renders when decision_activities has rows for this tracker. */}
              <DecisionActivityPanel
                trackerId={selectedTracker.id}
                itemNameById={selectedTracker.categories.reduce<Record<string, string>>((acc, cat) => {
                  for (const item of cat.items) acc[item.id] = item.name;
                  return acc;
                }, {})}
              />
            </View>
            <DecisionTrackerDetail
              tracker={selectedTracker}
              onClose={handleClose}
              onSendReminder={handleSendReminder}
              onRecordDecision={handleRecordDecision}
              onShareWithCustomer={handleShareWithCustomer}
            />
          </>
        )}

        {viewMode === 'template-picker' && (
          <TemplatePicker
            onSelect={handleSelectTemplate}
            onClose={handleClose}
          />
        )}
      </ScrollView>

      {/* Share Modal */}
      <Modal
        visible={showShareModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowShareModal(false)}
      >
        {selectedTracker && (
          <ShareDecisionTracker
            tracker={selectedTracker}
            onClose={() => setShowShareModal(false)}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  titleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  pageTitle: {
    fontSize: 22,
    fontFamily: TYPE.sectionFamily,
    color: "#FFFFFF",
  },
  newBadge: {
    backgroundColor: Palette.hermesOrange,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  newBadgeText: {
    fontSize: 11,
    fontFamily: TYPE.sectionFamily,
    color: '#FFF',
  },
});
