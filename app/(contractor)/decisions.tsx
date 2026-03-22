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
import { Palette, SemanticColors } from '../../src/theme/colors';
import { PAGE_BG } from '../../src/theme/tabStyles';
import { hapticSuccess } from '../../src/utils/haptics';
import { Spacing } from '../../src/theme/spacing';
import {
  DecisionTrackerList,
  DecisionTrackerDetail,
  TemplatePicker,
} from '../../src/components/contractor/DecisionTracker';
import { ShareDecisionTracker } from '../../src/components/contractor/ShareDecisionTracker';
import type { CustomerDecisionTracker, DecisionTemplate } from '../../src/types/decisions';
import { recordScreenVisit } from '../../src/intelligence/learningStorage';
import { useDecisionUpdates } from '../../src/services/decisionSyncService';

type ViewMode = 'list' | 'detail' | 'template-picker';

export default function KeuzeScreen() {
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
    const newTracker: CustomerDecisionTracker = {
      id: `tracker_${Date.now()}`,
      jobId: 'new',
      customerId: 'new',
      customerName: 'Nieuwe klant',
      templateId: template.id,
      templateName: template.name,
      projectStartDate: new Date().toISOString(),
      phases: [],
      categories: template.categories.map(cat => ({
        id: cat.id,
        categoryId: cat.id,
        name: cat.name,
        phase: cat.phase,
        dueDate: new Date(Date.now() + cat.daysBeforePhaseStart * 86400000).toISOString(),
        items: cat.items.map(item => ({
          id: item.id,
          itemId: item.id,
          name: item.name,
          description: item.description,
          inputType: item.inputType,
          options: item.options,
          priority: item.priority,
          status: 'pending' as const,
          dueDate: new Date(Date.now() + cat.daysBeforePhaseStart * 86400000).toISOString(),
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
    setSelectedTracker(newTracker);
    setViewMode('detail');
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
    const channelLabel = channel === 'whatsapp' ? 'WhatsApp' : channel === 'sms' ? 'SMS' : 'e-mail';
    Alert.alert(
      'Herinnering verstuurd',
      `${itemIds.length} item(s) verstuurd via ${channelLabel}.`,
    );
    if (selectedTracker) {
      setSelectedTracker({
        ...selectedTracker,
        lastReminderSent: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
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
    setSelectedTracker({
      ...selectedTracker,
      categories: updatedCategories,
      decidedCount,
      pendingCount: selectedTracker.totalDecisions - decidedCount,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleShareWithCustomer = () => {
    setShowShareModal(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.titleRow}>
        <Text style={styles.pageTitle}>Klant Keuzes</Text>
        {decisionNewCount > 0 && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>{decisionNewCount} nieuw</Text>
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
          <DecisionTrackerDetail
            tracker={selectedTracker}
            onClose={handleClose}
            onSendReminder={handleSendReminder}
            onRecordDecision={handleRecordDecision}
            onShareWithCustomer={handleShareWithCustomer}
          />
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
    fontFamily: 'Manrope_700Bold',
    color: '#1A1A1A',
  },
  newBadge: {
    backgroundColor: Palette.hermesOrange,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  newBadgeText: {
    fontSize: 11,
    fontFamily: 'Manrope_700Bold',
    color: '#FFF',
  },
});
