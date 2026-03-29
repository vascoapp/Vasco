// =============================================================================
// SCHEDULE BLOCK BOARD - Tap-to-reassign scheduling blocks
// =============================================================================

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import { hapticSuccess } from '../../utils/haptics';
import type { ScheduleBlock } from '../../services/resourceHeatmapService';

type IconName = keyof typeof Ionicons.glyphMap;

interface Props {
  blocks: ScheduleBlock[];
  unassigned: ScheduleBlock[];
  workers: { id: string; name: string; trade: string }[];
  onReassign?: (blockId: string, newWorkerId: string) => void;
}

function getPriorityColor(priority: ScheduleBlock['priority']): string {
  switch (priority) {
    case 'urgent': return SemanticColors.feedbackError;
    case 'high': return SemanticColors.feedbackWarning;
    case 'normal': return Palette.hermesOrange;
    case 'low': return SemanticColors.textTertiary;
  }
}

function getStatusIcon(status: ScheduleBlock['status']): IconName {
  switch (status) {
    case 'completed': return 'checkmark-circle';
    case 'in-progress': return 'play-circle';
    case 'scheduled': return 'time';
    case 'unassigned': return 'alert-circle';
  }
}

function getStatusColor(status: ScheduleBlock['status']): string {
  switch (status) {
    case 'completed': return SemanticColors.feedbackSuccess;
    case 'in-progress': return Palette.hermesOrange;
    case 'scheduled': return SemanticColors.textTertiary;
    case 'unassigned': return SemanticColors.feedbackError;
  }
}

function BlockCard({ block, onPress, isSelected }: {
  block: ScheduleBlock;
  onPress: () => void;
  isSelected: boolean;
}) {
  const widthHours = Math.max(block.durationHours, 1);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.blockCard,
        { borderLeftColor: getPriorityColor(block.priority) },
        isSelected && styles.blockCardSelected,
      ]}
    >
      <View style={styles.blockHeader}>
        <Ionicons name={getStatusIcon(block.status)} size={14} color={getStatusColor(block.status)} />
        <Text style={styles.blockTitle} numberOfLines={1}>{block.jobTitle}</Text>
      </View>
      <View style={styles.blockMeta}>
        <Text style={styles.blockTime}>
          {String(block.startHour).padStart(2, '0')}:00 - {String(block.startHour + widthHours).padStart(2, '0')}:00
        </Text>
        <Text style={styles.blockZone}>{block.zone}</Text>
      </View>
      {block.assignedName ? (
        <Text style={styles.blockWorker}>{block.assignedName}</Text>
      ) : (
        <Text style={[styles.blockWorker, { color: SemanticColors.feedbackError }]}>Niet toegewezen</Text>
      )}
    </Pressable>
  );
}

export function ScheduleBlockBoard({ blocks, unassigned, workers, onReassign }: Props) {
  const [selectedBlock, setSelectedBlock] = useState<ScheduleBlock | null>(null);
  const [showWorkerModal, setShowWorkerModal] = useState(false);

  const handleBlockPress = useCallback((block: ScheduleBlock) => {
    setSelectedBlock(block);
    setShowWorkerModal(true);
  }, []);

  const handleAssignWorker = useCallback((workerId: string, workerName: string) => {
    if (selectedBlock) {
      onReassign?.(selectedBlock.id, workerId);
      hapticSuccess();
      Alert.alert('Hertoegewezen', `${selectedBlock.jobTitle} → ${workerName}`);
    }
    setShowWorkerModal(false);
    setSelectedBlock(null);
  }, [selectedBlock, onReassign]);

  // Group blocks by worker
  const workerBlocks = workers.map(w => ({
    ...w,
    blocks: blocks.filter(b => b.assignedTo === w.id).sort((a, b) => a.startHour - b.startHour),
  }));

  return (
    <View style={styles.container}>
      {/* Unassigned pool */}
      {unassigned.length > 0 && (
        <View style={styles.unassignedSection}>
          <View style={styles.unassignedHeader}>
            <Ionicons name="alert-circle" size={16} color={SemanticColors.feedbackError} />
            <Text style={styles.unassignedTitle}>Niet toegewezen ({unassigned.length})</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.unassignedScroll}>
            {unassigned.map(block => (
              <BlockCard
                key={block.id}
                block={block}
                onPress={() => handleBlockPress(block)}
                isSelected={selectedBlock?.id === block.id}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Worker timelines */}
      {workerBlocks.map(worker => (
        <View key={worker.id} style={styles.workerRow}>
          <View style={styles.workerLabel}>
            <Text style={styles.workerName} numberOfLines={1}>{worker.name.split(' ')[0]}</Text>
            <Text style={styles.workerTrade}>{worker.trade}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.blockScroll}>
            {worker.blocks.map(block => (
              <BlockCard
                key={block.id}
                block={block}
                onPress={() => handleBlockPress(block)}
                isSelected={selectedBlock?.id === block.id}
              />
            ))}
            {worker.blocks.length === 0 && (
              <View style={styles.emptySlot}>
                <Text style={styles.emptyText}>Geen taken</Text>
              </View>
            )}
          </ScrollView>
        </View>
      ))}

      {/* Worker selection modal */}
      <Modal visible={showWorkerModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Hertoewijzen</Text>
              <Pressable onPress={() => { setShowWorkerModal(false); setSelectedBlock(null); }}>
                <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
              </Pressable>
            </View>
            {selectedBlock && (
              <View style={styles.modalJobInfo}>
                <Text style={styles.modalJobTitle}>{selectedBlock.jobTitle}</Text>
                <Text style={styles.modalJobMeta}>
                  {String(selectedBlock.startHour).padStart(2, '0')}:00 · {selectedBlock.durationHours}u · {selectedBlock.zone}
                </Text>
              </View>
            )}
            <Text style={styles.modalSubtitle}>Kies medewerker:</Text>
            <ScrollView style={styles.workerList}>
              {workers.map(w => (
                <Pressable
                  key={w.id}
                  style={styles.workerOption}
                  onPress={() => handleAssignWorker(w.id, w.name)}
                >
                  <View style={styles.workerOptionLeft}>
                    <View style={styles.workerAvatar}>
                      <Text style={styles.workerAvatarText}>
                        {w.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.workerOptionName}>{w.name}</Text>
                      <Text style={styles.workerOptionTrade}>{w.trade}</Text>
                    </View>
                  </View>
                  <Ionicons name="arrow-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderMuted,
    gap: Spacing.sm,
  },
  unassignedSection: {
    backgroundColor: SemanticColors.feedbackErrorBg,
    borderRadius: RADIUS.sm,
    padding: Spacing.xs,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackErrorBorder,
  },
  unassignedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.xs,
  },
  unassignedTitle: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.feedbackError,
  },
  unassignedScroll: {
    gap: 8,
  },
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workerLabel: {
    width: 70,
  },
  workerName: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  workerTrade: {
    fontSize: TYPE.tinySize - 1,
    color: SemanticColors.textTertiary,
  },
  blockScroll: {
    gap: 6,
    paddingRight: 8,
  },
  blockCard: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
    padding: 8,
    borderLeftWidth: 3,
    minWidth: 130,
    maxWidth: 160,
  },
  blockCardSelected: {
    borderColor: Palette.hermesOrange,
    borderWidth: 2,
    borderLeftWidth: 3,
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  blockTitle: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    flex: 1,
  },
  blockMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  blockTime: {
    fontSize: TYPE.tinySize - 1,
    color: SemanticColors.textTertiary,
  },
  blockZone: {
    fontSize: TYPE.tinySize - 1,
    color: SemanticColors.textTertiary,
    fontFamily: TYPE.labelFamily,
  },
  blockWorker: {
    fontSize: TYPE.tinySize - 1,
    color: Palette.hermesOrange,
    fontFamily: TYPE.titleFamily,
  },
  emptySlot: {
    backgroundColor: SemanticColors.surfaceTertiary,
    borderRadius: RADIUS.sm,
    padding: 12,
    alignItems: 'center',
    minWidth: 100,
  },
  emptyText: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textTertiary,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.md,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  modalTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  modalJobInfo: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
    padding: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  modalJobTitle: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  modalJobMeta: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  modalSubtitle: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
    marginBottom: 8,
  },
  workerList: {
    maxHeight: 300,
  },
  workerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
  },
  workerOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  workerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.hermesOrange,
    justifyContent: 'center',
    alignItems: 'center',
  },
  workerAvatarText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.sectionFamily,
    color: Palette.white,
  },
  workerOptionName: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  workerOptionTrade: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textTertiary,
  },
});
