// =============================================================================
// COMPLIANCE STATUS CARD - Dutch Compliance Dashboard Widget
// =============================================================================
// Displays KvK, BTW, certifications, and insurance compliance status
// a16z Sphere pattern: "Compliance as executable workflow logic"
// =============================================================================

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { useComplianceDashboard } from '../../services';
import type { ComplianceAlert, ComplianceDeadline } from '../../types/dutch-compliance';

type IconName = keyof typeof Ionicons.glyphMap;

const STATUS_CONFIG = {
  compliant: {
    color: SemanticColors.feedbackSuccess,
    bgColor: SemanticColors.feedbackSuccessBg,
    icon: 'shield-checkmark' as IconName,
    label: 'Compliant',
  },
  'action-required': {
    color: SemanticColors.feedbackWarning,
    bgColor: SemanticColors.feedbackWarningBg,
    icon: 'alert-circle' as IconName,
    label: 'Action Required',
  },
  critical: {
    color: SemanticColors.feedbackError,
    bgColor: SemanticColors.feedbackErrorBg,
    icon: 'warning' as IconName,
    label: 'Critical',
  },
};

const CATEGORY_ICONS: Record<string, IconName> = {
  kvk: 'business',
  btw: 'receipt',
  certification: 'ribbon',
  insurance: 'shield',
  other: 'document',
};

interface ComplianceStatusCardProps {
  onPress?: () => void;
  compact?: boolean;
}

export function ComplianceStatusCard({ onPress, compact = false }: ComplianceStatusCardProps) {
  const dashboard = useComplianceDashboard();

  if (!dashboard) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <View style={styles.loadingPlaceholder} />
      </View>
    );
  }

  const statusConfig = STATUS_CONFIG[dashboard.status as keyof typeof STATUS_CONFIG];

  if (compact) {
    return (
      <Pressable style={[styles.container, styles.containerCompact]} onPress={onPress}>
        <View style={styles.compactHeader}>
          <View style={[styles.statusIcon, { backgroundColor: statusConfig.bgColor }]}>
            <Ionicons name={statusConfig.icon} size={18} color={statusConfig.color} />
          </View>
          <View style={styles.compactContent}>
            <Text style={styles.compactTitle}>Compliance</Text>
            <Text style={[styles.compactStatus, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
          <View style={styles.scoreCircle}>
            <Text style={styles.scoreText}>{dashboard.overallScore}</Text>
          </View>
        </View>
        {dashboard.alerts.length > 0 && (
          <View style={styles.alertBadge}>
            <Ionicons name="alert-circle" size={12} color={SemanticColors.feedbackWarning} />
            <Text style={styles.alertBadgeText}>
              {dashboard.alerts.length} alert{dashboard.alerts.length !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.container} onPress={onPress}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.statusIcon, { backgroundColor: statusConfig.bgColor }]}>
            <Ionicons name={statusConfig.icon} size={20} color={statusConfig.color} />
          </View>
          <View>
            <Text style={styles.title}>Dutch Compliance</Text>
            <Text style={[styles.statusLabel, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreValue}>{dashboard.overallScore}</Text>
          <Text style={styles.scoreMax}>/100</Text>
        </View>
      </View>

      {/* Status Grid */}
      <View style={styles.statusGrid}>
        {/* KvK Status */}
        <StatusItem
          icon="business"
          label="KvK"
          status={dashboard.kvkStatus === 'verified' ? 'good' : 'warning'}
          detail={dashboard.kvkStatus === 'verified' ? 'Verified' : 'Needs verification'}
        />

        {/* BTW Status */}
        <StatusItem
          icon="receipt"
          label="BTW"
          status={
            dashboard.btwStatus === 'up-to-date'
              ? 'good'
              : dashboard.btwStatus === 'filing-due'
                ? 'warning'
                : 'error'
          }
          detail={
            dashboard.btwStatus === 'up-to-date'
              ? 'Up to date'
              : dashboard.nextBtwDeadline
                ? `Due ${formatDate(dashboard.nextBtwDeadline)}`
                : 'Check status'
          }
        />

        {/* Certifications */}
        <StatusItem
          icon="ribbon"
          label="Certs"
          status={
            dashboard.certificationsExpired > 0
              ? 'error'
              : dashboard.certificationsExpiringSoon > 0
                ? 'warning'
                : 'good'
          }
          detail={
            dashboard.certificationsExpired > 0
              ? `${dashboard.certificationsExpired} expired`
              : dashboard.certificationsExpiringSoon > 0
                ? `${dashboard.certificationsExpiringSoon} expiring`
                : `${dashboard.certificationsValid} valid`
          }
        />

        {/* Insurance */}
        <StatusItem
          icon="shield"
          label="Insurance"
          status={
            dashboard.insuranceExpired > 0
              ? 'error'
              : dashboard.insuranceExpiringSoon > 0
                ? 'warning'
                : 'good'
          }
          detail={
            dashboard.insuranceExpired > 0
              ? `${dashboard.insuranceExpired} expired`
              : dashboard.insuranceExpiringSoon > 0
                ? `${dashboard.insuranceExpiringSoon} expiring`
                : `${dashboard.insuranceActive} active`
          }
        />
      </View>

      {/* Alerts */}
      {dashboard.alerts.length > 0 && (
        <View style={styles.alertsSection}>
          <Text style={styles.alertsTitle}>
            {dashboard.alerts.length} Alert{dashboard.alerts.length !== 1 ? 's' : ''}
          </Text>
          {dashboard.alerts.slice(0, 2).map((alert: any) => (
            <AlertItem key={alert.id} alert={alert} />
          ))}
          {dashboard.alerts.length > 2 && (
            <Text style={styles.moreAlerts}>
              +{dashboard.alerts.length - 2} more alerts
            </Text>
          )}
        </View>
      )}

      {/* Upcoming Deadlines */}
      {dashboard.upcomingDeadlines.length > 0 && (
        <View style={styles.deadlinesSection}>
          <Text style={styles.deadlinesTitle}>Upcoming Deadlines</Text>
          {dashboard.upcomingDeadlines.slice(0, 3).map((deadline: any) => (
            <DeadlineItem key={deadline.id} deadline={deadline} />
          ))}
        </View>
      )}
    </Pressable>
  );
}

// Status Item Component
function StatusItem({
  icon,
  label,
  status,
  detail,
}: {
  icon: IconName;
  label: string;
  status: 'good' | 'warning' | 'error';
  detail: string;
}) {
  const color =
    status === 'good'
      ? SemanticColors.feedbackSuccess
      : status === 'warning'
        ? SemanticColors.feedbackWarning
        : SemanticColors.feedbackError;

  const bgColor =
    status === 'good'
      ? SemanticColors.feedbackSuccessBg
      : status === 'warning'
        ? SemanticColors.feedbackWarningBg
        : SemanticColors.feedbackErrorBg;

  return (
    <View style={[styles.statusItem, { backgroundColor: bgColor }]}>
      <Ionicons name={icon} size={16} color={color} />
      <View style={styles.statusItemContent}>
        <Text style={styles.statusItemLabel}>{label}</Text>
        <Text style={[styles.statusItemDetail, { color }]} numberOfLines={1}>
          {detail}
        </Text>
      </View>
    </View>
  );
}

// Alert Item Component
function AlertItem({ alert }: { alert: ComplianceAlert }) {
  const icon = CATEGORY_ICONS[alert.category] || 'alert-circle';
  const color =
    alert.severity === 'critical'
      ? SemanticColors.feedbackError
      : alert.severity === 'warning'
        ? SemanticColors.feedbackWarning
        : SemanticColors.feedbackInfo;

  return (
    <View style={styles.alertItem}>
      <Ionicons name={icon} size={14} color={color} />
      <View style={styles.alertContent}>
        <Text style={styles.alertTitle}>{alert.title}</Text>
        <Text style={styles.alertMessage} numberOfLines={1}>
          {alert.message}
        </Text>
      </View>
      {alert.actionRequired && (
        <Pressable style={[styles.alertAction, { backgroundColor: color + '15' }]}>
          <Text style={[styles.alertActionText, { color }]}>
            {alert.actionLabel || 'Fix'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// Deadline Item Component
function DeadlineItem({ deadline }: { deadline: ComplianceDeadline }) {
  const color =
    deadline.status === 'overdue'
      ? SemanticColors.feedbackError
      : deadline.status === 'due-soon'
        ? SemanticColors.feedbackWarning
        : SemanticColors.textSecondary;

  return (
    <View style={styles.deadlineItem}>
      <View style={[styles.deadlineDot, { backgroundColor: color }]} />
      <View style={styles.deadlineContent}>
        <Text style={styles.deadlineTitle}>{deadline.title}</Text>
        <Text style={[styles.deadlineDate, { color }]}>
          {deadline.daysUntil < 0
            ? `${Math.abs(deadline.daysUntil)} days overdue`
            : deadline.daysUntil === 0
              ? 'Today'
              : `${deadline.daysUntil} day${deadline.daysUntil !== 1 ? 's' : ''}`}
        </Text>
      </View>
    </View>
  );
}

// Helper function
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
  });
}

// Widget version for dashboard
export function ComplianceWidget({ onPress }: { onPress?: () => void }) {
  const dashboard = useComplianceDashboard();

  if (!dashboard) return null;

  const statusConfig = STATUS_CONFIG[dashboard.status as keyof typeof STATUS_CONFIG];
  const totalIssues =
    dashboard.alerts.filter((a: any) => a.severity === 'critical' || a.severity === 'warning').length;

  return (
    <Pressable style={styles.widget} onPress={onPress}>
      <View style={[styles.widgetIcon, { backgroundColor: statusConfig.bgColor }]}>
        <Ionicons name={statusConfig.icon} size={20} color={statusConfig.color} />
      </View>
      <View style={styles.widgetContent}>
        <Text style={styles.widgetTitle}>Compliance</Text>
        <Text style={[styles.widgetStatus, { color: statusConfig.color }]}>
          {statusConfig.label}
        </Text>
      </View>
      {totalIssues > 0 && (
        <View style={styles.widgetBadge}>
          <Text style={styles.widgetBadgeText}>{totalIssues}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
  },
  containerCompact: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  loadingPlaceholder: {
    height: 100,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 12,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  scoreMax: {
    fontSize: 14,
    color: SemanticColors.textTertiary,
  },
  // Status Grid
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48.5%',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 10,
  },
  statusItemContent: {
    flex: 1,
  },
  statusItemLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  statusItemDetail: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Alerts Section
  alertsSection: {
    gap: Spacing.xs,
  },
  alertsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: Spacing.xs,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: Spacing.sm,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  alertMessage: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  alertAction: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  alertActionText: {
    fontSize: 11,
    fontWeight: '600',
  },
  moreAlerts: {
    fontSize: 12,
    color: SemanticColors.actionPrimary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  // Deadlines Section
  deadlinesSection: {
    gap: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  deadlinesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: Spacing.xs,
  },
  deadlineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  deadlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  deadlineContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deadlineTitle: {
    fontSize: 13,
    color: SemanticColors.textPrimary,
  },
  deadlineDate: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Compact styles
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  compactContent: {
    flex: 1,
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  compactStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  scoreCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: SemanticColors.feedbackWarningBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 52,
  },
  alertBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.feedbackWarning,
  },
  // Widget styles
  widget: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  widgetIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  widgetContent: {
    flex: 1,
  },
  widgetTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  widgetStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  widgetBadge: {
    backgroundColor: SemanticColors.feedbackErrorBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  widgetBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: SemanticColors.feedbackError,
  },
});
