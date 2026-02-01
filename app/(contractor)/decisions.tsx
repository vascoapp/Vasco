// Customer Decisions Screen - Help contractors guide customers through project decisions
import { useState } from 'react';
import { View, StyleSheet, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SemanticColors } from '../../src/theme/colors';
import {
  DecisionTrackerList,
  DecisionTrackerDetail,
  TemplatePicker,
} from '../../src/components/contractor/DecisionTracker';
import { ShareDecisionTracker } from '../../src/components/contractor/ShareDecisionTracker';
import type { CustomerDecisionTracker, DecisionTemplate } from '../../src/types/decisions';

type ViewMode = 'list' | 'detail' | 'template-picker';

export default function DecisionsScreen() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedTracker, setSelectedTracker] = useState<CustomerDecisionTracker | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  const handleSelectTracker = (tracker: CustomerDecisionTracker) => {
    setSelectedTracker(tracker);
    setViewMode('detail');
  };

  const handleCreateNew = () => {
    setViewMode('template-picker');
  };

  const handleSelectTemplate = (template: DecisionTemplate) => {
    // In a real app, this would create a new tracker and navigate to it
    // For now, just go back to list
    console.log('Selected template:', template.name);
    setViewMode('list');
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
    console.log(`Reminder sent via ${channel} for ${itemIds.length} items`);
    // In a real app, this would record the reminder in the database
  };

  const handleRecordDecision = (
    trackerId: string,
    itemId: string,
    value: string | number | boolean
  ) => {
    console.log(`Decision recorded for item ${itemId}: ${value}`);
    // In a real app, this would update the decision in the database
  };

  const handleShareWithCustomer = () => {
    setShowShareModal(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
    backgroundColor: SemanticColors.surfaceBackground,
  },
});
