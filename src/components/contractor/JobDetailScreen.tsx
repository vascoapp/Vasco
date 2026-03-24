// Job Detail Screen - Full job view with actions, photos, time, materials
import { useState, useMemo, useEffect } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, SemanticColors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import type { Job, JobPhoto, TimeEntry, MaterialUsage } from '../../types/contractor';
import type { Customer } from '../../domain/customers';
import type { JobMaterial, JobMaterialStatus } from '../../domain/materials';
import { JOB_STATUS_CONFIG } from '../../data/mockContractor';
import { useAppState } from '../../state/AppState';
import { InlineInsight, VascoInsightCard } from '../shared/VascoInsightCard';
import { useInlineInsight, useVascoGuidance } from '../../services/vascoGuidanceService';
import { AddJobMaterialModal } from './AddJobMaterialModal';
import { getNextAction as getLoopNextAction, getStageLabel, getLoopProgress, type LoopStage } from '../../services/accountingLoopService';
import { getAIRecommendation } from '../../intelligence/loopIntelligence';

type IconName = keyof typeof Ionicons.glyphMap;

interface JobDetailScreenProps {
  job: Job;
  onClose?: () => void;
  onStatusChange?: (jobId: string, newStatus: Job['status']) => void;
  onAddPhoto?: (jobId: string, type: JobPhoto['type']) => void;
  onClockIn?: (jobId: string) => void;
  onClockOut?: (jobId: string) => void;
  onAddMaterial?: (jobId: string) => void;
  onNavigateToInvoice?: (jobId: string) => void;
}

export function JobDetailScreen({
  job,
  onClose,
  onStatusChange,
  onAddPhoto,
  onClockIn,
  onClockOut,
  onAddMaterial,
  onNavigateToInvoice,
}: JobDetailScreenProps) {
  const { customers, jobMaterials: jobMaterialsMap, materials: materialCatalog, suppliers } = useAppState();
  const [activeTab, setActiveTab] = useState<'details' | 'photos' | 'time' | 'materials'>('details');
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [loopRecommendation, setLoopRecommendation] = useState<{ message: string; priority: 'low' | 'medium' | 'high'; actionLabel?: string } | null>(null);

  // AI guidance
  const overviewInsight = useInlineInsight('contractor', 'job-detail', 'overview');
  const materialsInsight = useInlineInsight('contractor', 'job-detail', 'materials');
  const insights = useVascoGuidance('contractor', 'job-detail');
  const topInsights = insights.slice(0, 2);

  const customer = customers.find((c) => c.id === job.customerId);
  const statusConfig = JOB_STATUS_CONFIG[job.status];

  // Map job status to accounting loop stage for AI recommendation
  const statusToStage: Record<string, LoopStage> = {
    'lead': 'quote_created', 'quoted': 'quote_sent', 'accepted': 'quote_accepted',
    'scheduled': 'job_scheduled', 'in-progress': 'job_in_progress', 'completed': 'job_completed',
    'invoiced': 'invoice_sent', 'paid': 'payment_received',
  };
  const loopStage = statusToStage[job.status] ?? 'quote_created';

  // Fetch async AI recommendation
  useEffect(() => {
    getAIRecommendation({
      jobId: job.id, customerId: job.customerId, currentStage: loopStage,
      history: [{ stage: loopStage, timestamp: job.updatedAt || job.createdAt || new Date().toISOString() }],
      amounts: { quoted: job.quotedAmount || 0, agreed: job.agreedAmount || 0, invoiced: 0, paid: 0 },
    }).then(setLoopRecommendation).catch(() => {});
  }, [job.id, job.status]);

  // Typed job materials from AppState
  const typedJobMaterials = jobMaterialsMap[job.id] ?? [];

  const formatCurrency = (amount: number) => `€${amount.toLocaleString(undefined)}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  // Calculate totals
  const totalTimeMinutes = job.timeEntries.reduce((sum, t) => sum + t.totalMinutes, 0);
  const totalMaterialsCost = typedJobMaterials.reduce((sum, m) => sum + (m.totalPrice ?? 0), 0);
  const totalMaterialsCharge = job.materials.reduce((sum, m) => sum + (m.chargeToCustomer || 0), 0);

  const getNextStatus = (): Job['status'] | null => {
    const flow: Record<Job['status'], Job['status'] | null> = {
      'lead': 'quoted',
      'quoted': 'accepted',
      'accepted': 'scheduled',
      'scheduled': 'in-progress',
      'in-progress': 'completed',
      'completed': 'invoiced',
      'invoiced': 'paid',
      'paid': null,
      'cancelled': null,
    };
    return flow[job.status];
  };

  const handleAdvanceStatus = () => {
    const nextStatus = getNextStatus();
    if (nextStatus && onStatusChange) {
      if (nextStatus === 'completed' || nextStatus === 'invoiced') {
        Alert.alert(
          'Klus afgerond!',
          'Factuur aanmaken?',
          [
            { text: 'Later', style: 'cancel', onPress: () => onStatusChange(job.id, nextStatus) },
            {
              text: 'Factureer nu',
              onPress: () => {
                onStatusChange(job.id, nextStatus);
                if (onNavigateToInvoice) {
                  onNavigateToInvoice(job.id);
                }
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'Update Status',
          `Move job to "${JOB_STATUS_CONFIG[nextStatus].label}"?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Confirm', onPress: () => onStatusChange(job.id, nextStatus) },
          ]
        );
      }
    }
  };

  const tabs: { id: 'details' | 'photos' | 'time' | 'materials'; label: string; icon: string; badge?: number }[] = [
    { id: 'details', label: 'Details', icon: 'information-circle-outline' },
    { id: 'photos', label: 'Photos', icon: 'camera-outline', badge: job.photos.length },
    { id: 'time', label: 'Time', icon: 'time-outline', badge: job.timeEntries.length },
    { id: 'materials', label: 'Materials', icon: 'cube-outline', badge: typedJobMaterials.length },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={styles.headerContent}>
          <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
          <Text style={styles.customerName}>{customer?.name}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
          <Ionicons name={statusConfig.icon as IconName} size={14} color={statusConfig.color} />
          <Text style={[styles.statusText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      {/* Accounting Loop — next step banner */}
      {(() => {
        const nextAction = getLoopNextAction(loopStage);
        const progress = getLoopProgress({
          jobId: job.id, customerId: job.customerId, currentStage: loopStage,
          history: [{ stage: loopStage, timestamp: new Date().toISOString() }],
          amounts: { quoted: job.quotedAmount || 0, agreed: job.agreedAmount || 0, invoiced: 0, paid: 0 },
        });
        return nextAction ? (
          <View style={styles.loopBanner}>
            <View style={styles.loopProgress}>
              <View style={[styles.loopProgressFill, { width: `${progress.percent}%` }]} />
            </View>
            <View style={styles.loopRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.loopStage}>{getStageLabel(loopStage)}</Text>
                {loopRecommendation ? (
                  <Text style={styles.loopHint}>{loopRecommendation.message}</Text>
                ) : (
                  <Text style={styles.loopHint}>Volgende: {nextAction}</Text>
                )}
              </View>
              {loopRecommendation?.actionLabel && (
                <Pressable style={styles.loopAction} onPress={handleAdvanceStatus}>
                  <Text style={styles.loopActionText}>{loopRecommendation.actionLabel}</Text>
                </Pressable>
              )}
            </View>
          </View>
        ) : null;
      })()}

      {/* Quick Actions Bar */}
      <View style={styles.quickActions}>
        {job.status === 'in-progress' && (
          <>
            <Pressable
              style={[styles.quickActionBtn, styles.quickActionPrimary]}
              onPress={() => onClockIn?.(job.id)}
            >
              <Ionicons name="play" size={18} color="#fff" />
              <Text style={styles.quickActionTextPrimary}>Clock In</Text>
            </Pressable>
            <Pressable
              style={styles.quickActionBtn}
              onPress={() => onAddPhoto?.(job.id, 'during')}
            >
              <Ionicons name="camera" size={18} color={SemanticColors.textPrimary} />
              <Text style={styles.quickActionText}>Photo</Text>
            </Pressable>
            <Pressable
              style={styles.quickActionBtn}
              onPress={() => setShowAddMaterial(true)}
            >
              <Ionicons name="add-circle" size={18} color={SemanticColors.textPrimary} />
              <Text style={styles.quickActionText}>Material</Text>
            </Pressable>
          </>
        )}
        {getNextStatus() && (
          <Pressable
            style={[styles.quickActionBtn, styles.quickActionSuccess]}
            onPress={handleAdvanceStatus}
          >
            <Ionicons name="arrow-forward" size={18} color={SemanticColors.feedbackSuccess} />
            <Text style={[styles.quickActionText, { color: SemanticColors.feedbackSuccess }]}>
              {JOB_STATUS_CONFIG[getNextStatus()!].label}
            </Text>
          </Pressable>
        )}
      </View>

      {/* AI Insight Strip */}
      {topInsights.length > 0 && (
        <View style={{ paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, gap: Spacing.xs }}>
          {topInsights.map((insight) => (
            <VascoInsightCard key={insight.id} insight={insight} compact showSource />
          ))}
        </View>
      )}
      {overviewInsight && !topInsights.length && (
        <View style={{ paddingHorizontal: Spacing.sm, paddingTop: Spacing.xs }}>
          <InlineInsight
            icon={overviewInsight.icon as any}
            message={overviewInsight.message}
            actionLabel={overviewInsight.actionLabel}
            actionRoute={overviewInsight.actionRoute}
          />
        </View>
      )}

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons
              name={tab.icon as IconName}
              size={18}
              color={activeTab === tab.id ? SemanticColors.actionPrimary : SemanticColors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
            {tab.badge !== undefined && tab.badge > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{tab.badge}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {/* Tab Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {activeTab === 'details' && (
          <DetailsTab job={job} customer={customer} formatCurrency={formatCurrency} formatDate={formatDate} />
        )}
        {activeTab === 'photos' && (
          <PhotosTab photos={job.photos} onAddPhoto={() => onAddPhoto?.(job.id, 'during')} />
        )}
        {activeTab === 'time' && (
          <TimeTab
            entries={job.timeEntries}
            totalMinutes={totalTimeMinutes}
            onClockIn={() => onClockIn?.(job.id)}
          />
        )}
        {activeTab === 'materials' && materialsInsight && (
          <InlineInsight
            icon={materialsInsight.icon as any}
            message={materialsInsight.message}
            actionLabel={materialsInsight.actionLabel}
            actionRoute={materialsInsight.actionRoute}
          />
        )}
        {activeTab === 'materials' && (
          <TypedMaterialsTab
            jobMaterials={typedJobMaterials}
            materialCatalog={materialCatalog}
            supplierList={suppliers}
            totalCost={totalMaterialsCost}
            formatCurrency={formatCurrency}
            onAddMaterial={() => setShowAddMaterial(true)}
          />
        )}
      </ScrollView>

      {/* Add Material Modal */}
      <AddJobMaterialModal
        visible={showAddMaterial}
        jobId={job.id}
        onClose={() => setShowAddMaterial(false)}
      />

      {/* Bottom Summary */}
      {!!(job.quotedAmount && job.agreedAmount && job.agreedAmount < job.quotedAmount * 0.85 && (job.status === 'completed' || job.status === 'invoiced')) && (
        <View style={{ paddingHorizontal: Spacing.md, paddingTop: Spacing.xs }}>
          <Text style={{ color: SemanticColors.feedbackWarning, fontSize: 13, lineHeight: 18 }}>
            <Ionicons name="alert-circle" size={13} color={SemanticColors.feedbackWarning} />{' '}
            Let op: deze klus is {Math.round((1 - job.agreedAmount / job.quotedAmount) * 100)}% onder de offerte afgesloten. Reden loggen helpt toekomstige schattingen.
          </Text>
        </View>
      )}
      <View style={styles.bottomSummary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Quoted</Text>
          <Text style={styles.summaryValue}>
            {job.agreedAmount ? formatCurrency(job.agreedAmount) : '-'}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Time</Text>
          <Text style={styles.summaryValue}>
            {Math.floor(totalTimeMinutes / 60)}h {totalTimeMinutes % 60}m
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Materials</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalMaterialsCost)}</Text>
        </View>
      </View>
    </View>
  );
}

// Details Tab Component
function DetailsTab({
  job,
  customer,
  formatCurrency,
  formatDate,
}: {
  job: Job;
  customer?: Customer;
  formatCurrency: (n: number) => string;
  formatDate: (d: string) => string;
}) {
  return (
    <View style={styles.tabContent}>
      {/* Schedule Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Schedule</Text>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color={SemanticColors.textSecondary} />
          <Text style={styles.detailText}>
            {job.scheduledDate ? formatDate(job.scheduledDate) : 'Not scheduled'}
          </Text>
        </View>
        {job.scheduledStartTime && (
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={16} color={SemanticColors.textSecondary} />
            <Text style={styles.detailText}>
              {job.scheduledStartTime} - {job.scheduledEndTime || 'TBD'}
            </Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <Ionicons name="hourglass-outline" size={16} color={SemanticColors.textSecondary} />
          <Text style={styles.detailText}>Est. {job.estimatedDuration} hours</Text>
        </View>
      </View>

      {/* Location Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Location</Text>
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={16} color={SemanticColors.textSecondary} />
          <View style={styles.detailTextContainer}>
            <Text style={styles.detailText}>{job.address.street}</Text>
            <Text style={styles.detailSubtext}>
              {job.address.postcode} {job.address.city}
            </Text>
          </View>
        </View>
        {job.address.accessNotes && (
          <View style={styles.noteBox}>
            <Ionicons name="key-outline" size={14} color={SemanticColors.feedbackWarning} />
            <Text style={styles.noteText}>{job.address.accessNotes}</Text>
          </View>
        )}
        {job.address.parkingNotes && (
          <View style={styles.noteBox}>
            <Ionicons name="car-outline" size={14} color={SemanticColors.feedbackInfo} />
            <Text style={styles.noteText}>{job.address.parkingNotes}</Text>
          </View>
        )}
        <Pressable style={styles.mapButton}>
          <Ionicons name="navigate" size={16} color={SemanticColors.actionPrimary} />
          <Text style={styles.mapButtonText}>Open in Maps</Text>
        </Pressable>
      </View>

      {/* Customer Card */}
      {customer && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Customer</Text>
          <View style={styles.customerRow}>
            <View style={styles.customerAvatar}>
              <Text style={styles.customerInitials}>
                {customer.name.split(' ').map((n) => n[0]).join('')}
              </Text>
            </View>
            <View style={styles.customerInfo}>
              <Text style={styles.customerName}>{customer.name}</Text>
            </View>
          </View>
          <View style={styles.contactActions}>
            <Pressable style={styles.contactBtn}>
              <Ionicons name="call" size={18} color={SemanticColors.feedbackSuccess} />
              <Text style={[styles.contactBtnText, { color: SemanticColors.feedbackSuccess }]}>
                Call
              </Text>
            </Pressable>
            <Pressable style={styles.contactBtn}>
              <Ionicons name="chatbubble" size={18} color={SemanticColors.feedbackInfo} />
              <Text style={[styles.contactBtnText, { color: SemanticColors.feedbackInfo }]}>
                Message
              </Text>
            </Pressable>
            <Pressable style={styles.contactBtn}>
              <Ionicons name="mail" size={18} color={SemanticColors.textSecondary} />
              <Text style={styles.contactBtnText}>Email</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Job Description */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Description</Text>
        <Text style={styles.descriptionText}>{job.description}</Text>
        {job.roomsAreas && job.roomsAreas.length > 0 && (
          <View style={styles.areasContainer}>
            <Text style={styles.areasLabel}>Areas:</Text>
            <View style={styles.areasTags}>
              {job.roomsAreas.map((area, idx) => (
                <View key={idx} style={styles.areaTag}>
                  <Text style={styles.areaTagText}>{area}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        {job.specifications && (
          <View style={styles.specsBox}>
            <Text style={styles.specsLabel}>Specifications</Text>
            <Text style={styles.specsText}>{job.specifications}</Text>
          </View>
        )}
      </View>

      {/* Notes */}
      {job.notes.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Notes</Text>
          {job.notes.map((note) => (
            <View key={note.id} style={styles.noteItem}>
              <Text style={styles.noteItemText}>{note.text}</Text>
              <Text style={styles.noteItemMeta}>
                {new Date(note.createdAt).toLocaleDateString(undefined)}
                {!note.isCustomerVisible && ' • Internal'}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// Photos Tab Component
function PhotosTab({
  photos,
  onAddPhoto,
}: {
  photos: JobPhoto[];
  onAddPhoto: () => void;
}) {
  const photoTypes: JobPhoto['type'][] = ['before', 'during', 'after', 'issue'];

  return (
    <View style={styles.tabContent}>
      {photoTypes.map((type) => {
        const typePhotos = photos.filter((p) => p.type === type);
        return (
          <View key={type} style={styles.photoSection}>
            <Text style={styles.photoSectionTitle}>
              {type.charAt(0).toUpperCase() + type.slice(1)} ({typePhotos.length})
            </Text>
            {typePhotos.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.photoGrid}>
                  {typePhotos.map((photo) => (
                    <View key={photo.id} style={styles.photoThumbnail}>
                      <View style={styles.photoPlaceholder}>
                        <Ionicons name="image" size={32} color={SemanticColors.textTertiary} />
                      </View>
                      {photo.caption && (
                        <Text style={styles.photoCaption} numberOfLines={1}>
                          {photo.caption}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.emptyPhotos}>
                <Text style={styles.emptyPhotosText}>No {type} photos</Text>
              </View>
            )}
          </View>
        );
      })}
      <Pressable style={styles.addPhotoButton} onPress={onAddPhoto}>
        <Ionicons name="camera" size={20} color={SemanticColors.actionPrimary} />
        <Text style={styles.addPhotoText}>Add Photo</Text>
      </Pressable>
    </View>
  );
}

// Time Tab Component
function TimeTab({
  entries,
  totalMinutes,
  onClockIn,
}: {
  entries: TimeEntry[];
  totalMinutes: number;
  onClockIn: () => void;
}) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return (
    <View style={styles.tabContent}>
      {/* Total Time Card */}
      <View style={styles.timeSummaryCard}>
        <Text style={styles.timeSummaryLabel}>Total Time</Text>
        <Text style={styles.timeSummaryValue}>{hours}h {minutes}m</Text>
      </View>

      {/* Time Entries */}
      {entries.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Time Entries</Text>
          {entries.map((entry) => (
            <View key={entry.id} style={styles.timeEntry}>
              <View style={styles.timeEntryMain}>
                <Text style={styles.timeEntryDate}>
                  {new Date(entry.date).toLocaleDateString(undefined, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
                <Text style={styles.timeEntryHours}>
                  {Math.floor(entry.totalMinutes / 60)}h {entry.totalMinutes % 60}m
                </Text>
              </View>
              <Text style={styles.timeEntryTimes}>
                {entry.startTime} - {entry.endTime || 'Active'}
                {entry.breakMinutes > 0 && ` (${entry.breakMinutes}m break)`}
              </Text>
              {entry.description && (
                <Text style={styles.timeEntryDesc}>{entry.description}</Text>
              )}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="time-outline" size={48} color={SemanticColors.textTertiary} />
          <Text style={styles.emptyStateText}>No time tracked yet</Text>
        </View>
      )}

      <Pressable style={styles.clockInButton} onPress={onClockIn}>
        <Ionicons name="play-circle" size={24} color="#fff" />
        <Text style={styles.clockInButtonText}>Clock In</Text>
      </Pressable>
    </View>
  );
}

// Materials Tab Component
function MaterialsTab({
  materials,
  totalCost,
  totalCharge,
  formatCurrency,
  onAddMaterial,
}: {
  materials: MaterialUsage[];
  totalCost: number;
  totalCharge: number;
  formatCurrency: (n: number) => string;
  onAddMaterial: () => void;
}) {
  return (
    <View style={styles.tabContent}>
      {/* Summary */}
      <View style={styles.materialsSummary}>
        <View style={styles.materialsSummaryItem}>
          <Text style={styles.materialsSummaryLabel}>Cost</Text>
          <Text style={styles.materialsSummaryValue}>{formatCurrency(totalCost)}</Text>
        </View>
        <View style={styles.materialsSummaryItem}>
          <Text style={styles.materialsSummaryLabel}>Charge</Text>
          <Text style={[styles.materialsSummaryValue, { color: SemanticColors.feedbackSuccess }]}>
            {formatCurrency(totalCharge)}
          </Text>
        </View>
        <View style={styles.materialsSummaryItem}>
          <Text style={styles.materialsSummaryLabel}>Margin</Text>
          <Text style={[styles.materialsSummaryValue, { color: SemanticColors.actionPrimary }]}>
            {formatCurrency(totalCharge - totalCost)}
          </Text>
        </View>
      </View>

      {/* Materials List */}
      {materials.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Materials Used</Text>
          {materials.map((material) => (
            <View key={material.id} style={styles.materialItem}>
              <View style={styles.materialMain}>
                <Text style={styles.materialName}>{material.name}</Text>
                <Text style={styles.materialCost}>{formatCurrency(material.totalCost)}</Text>
              </View>
              <View style={styles.materialDetails}>
                <Text style={styles.materialQty}>
                  {material.quantity} {material.unit} @ {formatCurrency(material.unitCost)}
                </Text>
                {material.supplier && (
                  <Text style={styles.materialSupplier}>{material.supplier}</Text>
                )}
              </View>
              {material.billable && material.chargeToCustomer && (
                <View style={styles.materialBillable}>
                  <Ionicons name="arrow-forward" size={12} color={SemanticColors.feedbackSuccess} />
                  <Text style={styles.materialBillableText}>
                    Charge: {formatCurrency(material.chargeToCustomer)}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="cube-outline" size={48} color={SemanticColors.textTertiary} />
          <Text style={styles.emptyStateText}>No materials recorded</Text>
        </View>
      )}

      <Pressable style={styles.addMaterialButton} onPress={onAddMaterial}>
        <Ionicons name="add-circle" size={20} color={SemanticColors.actionPrimary} />
        <Text style={styles.addMaterialText}>Add Material</Text>
      </Pressable>
    </View>
  );
}

// Typed Materials Tab using domain types
const JM_STATUS_CONFIG: Record<JobMaterialStatus, { label: string; color: string; icon: string }> = {
  planned: { label: 'Gepland', color: '#6B7280', icon: 'time-outline' },
  ordered: { label: 'Besteld', color: '#3B82F6', icon: 'cart-outline' },
  delivered: { label: 'Geleverd', color: '#F59E0B', icon: 'cube-outline' },
  installed: { label: 'Verwerkt', color: '#16A34A', icon: 'checkmark-circle-outline' },
};

function TypedMaterialsTab({
  jobMaterials,
  materialCatalog,
  supplierList,
  totalCost,
  formatCurrency,
  onAddMaterial,
}: {
  jobMaterials: JobMaterial[];
  materialCatalog: { id: string; name: string; brand?: string }[];
  supplierList: { id: string; name: string }[];
  totalCost: number;
  formatCurrency: (n: number) => string;
  onAddMaterial: () => void;
}) {
  const materialLookup = useMemo(() => {
    const map = new Map<string, { name: string; brand?: string }>();
    for (const m of materialCatalog) map.set(m.id, { name: m.name, brand: m.brand });
    return map;
  }, [materialCatalog]);

  const supplierLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of supplierList) map.set(s.id, s.name);
    return map;
  }, [supplierList]);

  return (
    <View style={styles.tabContent}>
      {/* Summary */}
      <View style={styles.materialsSummary}>
        <View style={styles.materialsSummaryItem}>
          <Text style={styles.materialsSummaryLabel}>Totaal kosten</Text>
          <Text style={styles.materialsSummaryValue}>{formatCurrency(totalCost)}</Text>
        </View>
        <View style={styles.materialsSummaryItem}>
          <Text style={styles.materialsSummaryLabel}>Items</Text>
          <Text style={styles.materialsSummaryValue}>{jobMaterials.length}</Text>
        </View>
        <View style={styles.materialsSummaryItem}>
          <Text style={styles.materialsSummaryLabel}>Verwerkt</Text>
          <Text style={[styles.materialsSummaryValue, { color: SemanticColors.feedbackSuccess }]}>
            {jobMaterials.filter((jm) => jm.status === 'installed').length}/{jobMaterials.length}
          </Text>
        </View>
      </View>

      {/* Materials List */}
      {jobMaterials.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Materialen</Text>
          {jobMaterials.map((jm) => {
            const mat = materialLookup.get(jm.materialId);
            const sup = jm.supplierId ? supplierLookup.get(jm.supplierId) : undefined;
            const statusCfg = JM_STATUS_CONFIG[jm.status] ?? JM_STATUS_CONFIG.planned;

            return (
              <View key={jm.id} style={styles.materialItem}>
                <View style={styles.materialMain}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.materialName} numberOfLines={1}>
                      {mat?.name ?? 'Onbekend materiaal'}
                    </Text>
                    {mat?.brand && (
                      <Text style={{ fontSize: 11, color: '#999' }}>{mat.brand}</Text>
                    )}
                  </View>
                  <Text style={styles.materialCost}>
                    {jm.totalPrice != null ? formatCurrency(jm.totalPrice) : '-'}
                  </Text>
                </View>
                <View style={styles.materialDetails}>
                  <Text style={styles.materialQty}>
                    {jm.quantity} {jm.unit}
                    {jm.unitPrice != null ? ` @ ${formatCurrency(jm.unitPrice)}` : ''}
                  </Text>
                  {sup && <Text style={styles.materialSupplier}>{sup}</Text>}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Ionicons name={statusCfg.icon as any} size={12} color={statusCfg.color} />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: statusCfg.color }}>
                    {statusCfg.label}
                  </Text>
                  {jm.notes && (
                    <Text style={{ fontSize: 11, color: '#999', marginLeft: 8 }} numberOfLines={1}>
                      {jm.notes}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="cube-outline" size={48} color={SemanticColors.textTertiary} />
          <Text style={styles.emptyStateText}>Nog geen materialen toegevoegd</Text>
        </View>
      )}

      <Pressable style={styles.addMaterialButton} onPress={onAddMaterial}>
        <Ionicons name="add-circle" size={20} color={SemanticColors.actionPrimary} />
        <Text style={styles.addMaterialText}>Materiaal toevoegen</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  // Accounting loop banner
  loopBanner: { marginHorizontal: Spacing.md, marginBottom: Spacing.sm, gap: 6 },
  loopProgress: { height: 3, backgroundColor: SemanticColors.borderDefault, borderRadius: 1.5, overflow: 'hidden' },
  loopProgressFill: { height: 3, backgroundColor: Palette.hermesOrange, borderRadius: 1.5 },
  loopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loopStage: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Palette.hermesOrange },
  loopHint: { fontSize: 12, fontFamily: 'Inter_400Regular', color: SemanticColors.textSecondary },
  loopAction: { backgroundColor: Palette.hermesOrange, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  loopActionText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    paddingTop: Spacing.xl,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerContent: {
    flex: 1,
  },
  jobTitle: {
    color: SemanticColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  customerName: {
    color: SemanticColors.textSecondary,
    fontSize: 13,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    padding: Spacing.sm,
    gap: Spacing.xs,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  quickActionPrimary: {
    backgroundColor: SemanticColors.actionPrimary,
  },
  quickActionSuccess: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackSuccessBorder,
  },
  quickActionText: {
    color: SemanticColors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  quickActionTextPrimary: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: SemanticColors.actionPrimary,
  },
  tabText: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  tabTextActive: {
    color: SemanticColors.actionPrimary,
    fontWeight: '600',
  },
  tabBadge: {
    backgroundColor: SemanticColors.actionPrimary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 18,
    alignItems: 'center',
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.md,
    paddingBottom: 100,
  },
  tabContent: {
    gap: Spacing.md,
  },
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  cardTitle: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  detailTextContainer: {
    flex: 1,
  },
  detailText: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
  },
  detailSubtext: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    padding: Spacing.sm,
    borderRadius: 8,
  },
  noteText: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
    flex: 1,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: SemanticColors.actionPrimary + '15',
    borderRadius: 8,
    marginTop: 4,
  },
  mapButtonText: {
    color: SemanticColors.actionPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  customerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SemanticColors.actionPrimary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerInitials: {
    color: SemanticColors.actionPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  customerInfo: {
    flex: 1,
  },
  customerCompany: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
  },
  contactActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  contactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 8,
  },
  contactBtnText: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  descriptionText: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  areasContainer: {
    marginTop: Spacing.sm,
  },
  areasLabel: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
    marginBottom: 6,
  },
  areasTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  areaTag: {
    backgroundColor: SemanticColors.surfaceSecondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  areaTagText: {
    color: SemanticColors.textPrimary,
    fontSize: 12,
  },
  specsBox: {
    backgroundColor: SemanticColors.feedbackInfoBg,
    padding: Spacing.sm,
    borderRadius: 8,
    marginTop: Spacing.sm,
  },
  specsLabel: {
    color: SemanticColors.feedbackInfo,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  specsText: {
    color: SemanticColors.textPrimary,
    fontSize: 13,
  },
  noteItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
  },
  noteItemText: {
    color: SemanticColors.textPrimary,
    fontSize: 13,
  },
  noteItemMeta: {
    color: SemanticColors.textTertiary,
    fontSize: 11,
    marginTop: 4,
  },
  photoSection: {
    gap: Spacing.xs,
  },
  photoSectionTitle: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  photoGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  photoThumbnail: {
    width: 100,
    gap: 4,
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  photoCaption: {
    color: SemanticColors.textSecondary,
    fontSize: 10,
  },
  emptyPhotos: {
    backgroundColor: SemanticColors.surfacePrimary,
    padding: Spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  emptyPhotosText: {
    color: SemanticColors.textTertiary,
    fontSize: 12,
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: Spacing.md,
    backgroundColor: SemanticColors.actionPrimary + '15',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.actionPrimary + '30',
    borderStyle: 'dashed',
  },
  addPhotoText: {
    color: SemanticColors.actionPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  timeSummaryCard: {
    backgroundColor: SemanticColors.actionPrimary + '15',
    padding: Spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
  },
  timeSummaryLabel: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
  },
  timeSummaryValue: {
    color: SemanticColors.actionPrimary,
    fontSize: 32,
    fontWeight: '700',
  },
  timeEntry: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
    gap: 4,
  },
  timeEntryMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeEntryDate: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  timeEntryHours: {
    color: SemanticColors.actionPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  timeEntryTimes: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
  },
  timeEntryDesc: {
    color: SemanticColors.textTertiary,
    fontSize: 12,
    fontStyle: 'italic',
  },
  clockInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: SemanticColors.feedbackSuccess,
    padding: Spacing.md,
    borderRadius: 12,
  },
  clockInButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  materialsSummary: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  materialsSummaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  materialsSummaryLabel: {
    color: SemanticColors.textSecondary,
    fontSize: 11,
  },
  materialsSummaryValue: {
    color: SemanticColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  materialItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
    gap: 4,
  },
  materialMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  materialName: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  materialCost: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  materialDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  materialQty: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
  },
  materialSupplier: {
    color: SemanticColors.textTertiary,
    fontSize: 12,
  },
  materialBillable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  materialBillableText: {
    color: SemanticColors.feedbackSuccess,
    fontSize: 12,
    fontWeight: '500',
  },
  addMaterialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: Spacing.md,
    backgroundColor: SemanticColors.actionPrimary + '15',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.actionPrimary + '30',
    borderStyle: 'dashed',
  },
  addMaterialText: {
    color: SemanticColors.actionPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyStateText: {
    color: SemanticColors.textTertiary,
    fontSize: 14,
  },
  bottomSummary: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    padding: Spacing.md,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    color: SemanticColors.textSecondary,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: SemanticColors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: SemanticColors.borderDefault,
  },
});
