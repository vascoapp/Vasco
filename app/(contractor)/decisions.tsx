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
import { Palette } from '../../src/theme/colors';
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

type ViewMode = 'list' | 'detail' | 'template-picker';

export default function KeuzeScreen() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedTracker, setSelectedTracker] = useState<CustomerDecisionTracker | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Screen visit tracking
  useEffect(() => { recordScreenVisit('decisions'); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      hapticSuccess();
    }, 800);
  }, []);

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
      <Text style={styles.pageTitle}>Klant Keuzes</Text>
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
    backgroundColor: Palette.salmonLight,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
});
