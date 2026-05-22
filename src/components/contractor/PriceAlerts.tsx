// =============================================================================
// PRICE ALERTS COMPONENT
// =============================================================================
// Manages and displays price alerts for contractors
// Shows triggered alerts, allows configuration, tracks actions
// =============================================================================

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  Switch,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../i18n/formatting';
import {
  usePriceAlerts,
  useTriggeredAlerts,
  useAlertPreferences,
  type PriceAlert,
  type AlertPreferences,
} from '../../services/priceAlertService';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { useTranslation } from 'react-i18next';type IconName = keyof typeof Ionicons.glyphMap;

// ============================================
// MAIN COMPONENT
// ============================================

interface PriceAlertsProps {
  onClose?: () => void;
}

export function PriceAlerts({ onClose }: PriceAlertsProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'triggered' | 'active' | 'settings'>('triggered');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { alerts, statistics, suggestedAlerts, dismissAlert, snoozeAlert, markPurchased } = usePriceAlerts();
  const triggeredAlerts = alerts.filter((a) => a.status === 'triggered');
  const activeAlerts = alerts.filter((a) => a.status === 'active');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {onClose && (
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
          </Pressable>
        )}
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Prijsalerts</Text>
          <Text style={styles.headerSubtitle}>
            {formatCurrency(statistics.totalSavings)} bespaard · {statistics.actedOnRate}% actie genomen
          </Text>
        </View>
        <Pressable style={styles.addButton} onPress={() => setShowCreateModal(true)}>
          <Ionicons name="add" size={24} color="#fff" />
        </Pressable>
      </View>

      {/* Stats Summary */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{triggeredAlerts.length}</Text>
          <Text style={styles.statLabel}>Actief</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: SemanticColors.feedbackSuccess }]}>
            {formatCurrency(statistics.totalSavings)}
          </Text>
          <Text style={styles.statLabel}>Bespaard</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{statistics.avgSavingsPercent}%</Text>
          <Text style={styles.statLabel}>Gem. korting</Text>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {[
          { id: 'triggered', label: 'Alerts', badge: triggeredAlerts.length },
          { id: 'active', label: 'Actief', badge: activeAlerts.length },
          { id: 'settings', label: 'Instellingen', badge: 0 },
        ].map((tab) => (
          <Pressable
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id as typeof activeTab)}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
            {tab.badge > 0 && (
              <View style={[styles.tabBadge, activeTab === tab.id && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === tab.id && styles.tabBadgeTextActive]}>
                  {tab.badge}
                </Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {activeTab === 'triggered' && (
          <TriggeredAlertsTab
            alerts={triggeredAlerts}
            onDismiss={dismissAlert}
            onSnooze={snoozeAlert}
            onPurchase={markPurchased}
          />
        )}
        {activeTab === 'active' && (
          <ActiveAlertsTab
            alerts={activeAlerts}
            suggestedAlerts={suggestedAlerts}
            onCreateAlert={() => setShowCreateModal(true)}
          />
        )}
        {activeTab === 'settings' && <SettingsTab />}
        <View style={{ height: 50 }} />
      </ScrollView>

      {/* Create Alert Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <CreateAlertModal onClose={() => setShowCreateModal(false)} />
      </Modal>
    </View>
  );
}

// ============================================
// TRIGGERED ALERTS TAB
// ============================================

function TriggeredAlertsTab({
  alerts,
  onDismiss,
  onSnooze,
  onPurchase,
}: {
  alerts: PriceAlert[];
  onDismiss: (id: string, reason?: string) => void;
  onSnooze: (id: string, hours: number) => void;
  onPurchase: (id: string, details?: { actualPrice?: number }) => void;
}) {
  const { t } = useTranslation();
  if (alerts.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="notifications-off-outline" size={48} color={SemanticColors.textTertiary} />
        <Text style={styles.emptyTitle}>{t('alerts.noActiveAlerts', 'No active alerts')}</Text>
        <Text style={styles.emptyText}>
          Maak alerts aan om op de hoogte te blijven van prijsdalingen
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      {alerts.map((alert) => (
        <TriggeredAlertCard
          key={alert.id}
          alert={alert}
          onDismiss={() => onDismiss(alert.id)}
          onSnooze={(hours) => onSnooze(alert.id, hours)}
          onPurchase={() => onPurchase(alert.id)}
        />
      ))}
    </View>
  );
}

function TriggeredAlertCard({
  alert,
  onDismiss,
  onSnooze,
  onPurchase,
}: {
  alert: PriceAlert;
  onDismiss: () => void;
  onSnooze: (hours: number) => void;
  onPurchase: () => void;
}) {
  const { t } = useTranslation();
  const [showActions, setShowActions] = useState(false);

  const getTypeConfig = (type: PriceAlert['type']) => {
    switch (type) {
      case 'price_drop':
        return { label: 'Prijsdaling', icon: 'trending-down' as IconName, color: SemanticColors.feedbackSuccess };
      case 'price_target':
        return { label: 'Doelprijs bereikt', icon: 'flag' as IconName, color: Palette.hermesOrange };
      case 'competitor_match':
        return { label: 'Betere prijs gevonden', icon: 'swap-horizontal' as IconName, color: Palette.blue500 };
      case 'bulk_opportunity':
        return { label: 'Bulk korting', icon: 'layers' as IconName, color: '#8B5CF6' };
    }
  };

  const config = getTypeConfig(alert.type);

  return (
    <View style={[styles.alertCard, alert.priority === 'high' && styles.alertCardUrgent]}>
      {/* Header */}
      <View style={styles.alertHeader}>
        <View style={[styles.alertTypeBadge, { backgroundColor: config.color + '15' }]}>
          <Ionicons name={config.icon} size={14} color={config.color} />
          <Text style={[styles.alertTypeText, { color: config.color }]}>{config.label}</Text>
        </View>
        {alert.priority === 'high' && (
          <View style={styles.urgentBadge}>
            <Ionicons name="flash" size={12} color={SemanticColors.feedbackError} />
            <Text style={styles.urgentText}>Urgent</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <Text style={styles.alertMaterial}>{alert.materialName}</Text>
      {alert.brand && (
        <Text style={styles.alertBrand}>{alert.brand} · {alert.category}</Text>
      )}

      {/* Price Info */}
      <View style={styles.alertPriceRow}>
        <View style={styles.alertPriceInfo}>
          <Text style={styles.alertPriceLabel}>Nu</Text>
          <Text style={styles.alertCurrentPrice}>{alert.currentPrice != null ? formatCurrency(alert.currentPrice) : ''}</Text>
        </View>
        {alert.previousPrice && (
          <View style={styles.alertPriceInfo}>
            <Text style={styles.alertPriceLabel}>Was</Text>
            <Text style={styles.alertPreviousPrice}>{formatCurrency(alert.previousPrice)}</Text>
          </View>
        )}
        {alert.savingsAmount && (
          <View style={styles.alertSavings}>
            <Ionicons name="arrow-down" size={14} color={SemanticColors.feedbackSuccess} />
            <Text style={styles.alertSavingsText}>
              {formatCurrency(alert.savingsAmount)} ({alert.savingsPercent}%)
            </Text>
          </View>
        )}
      </View>

      {/* Supplier */}
      {alert.triggerSupplier && (
        <View style={styles.alertSupplier}>
          <Ionicons name="storefront-outline" size={14} color={SemanticColors.textSecondary} />
          <Text style={styles.alertSupplierText}>{alert.triggerSupplier}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.alertActions}>
        <Pressable style={styles.alertActionSecondary} onPress={() => setShowActions(true)}>
          <Ionicons name="ellipsis-horizontal" size={18} color={SemanticColors.textSecondary} />
        </Pressable>
        <Pressable style={styles.alertActionPrimary} onPress={onPurchase}>
          <Ionicons name="cart" size={16} color="#fff" />
          <Text style={styles.alertActionPrimaryText}>Gekocht</Text>
        </Pressable>
      </View>

      {/* More Actions Modal */}
      {showActions && (
        <View style={styles.actionsOverlay}>
          <Pressable style={styles.actionsBackdrop} onPress={() => setShowActions(false)} />
          <View style={styles.actionsMenu}>
            <Pressable
              style={styles.actionsMenuItem}
              onPress={() => {
                onSnooze(24);
                setShowActions(false);
              }}
            >
              <Ionicons name="time-outline" size={18} color={SemanticColors.textSecondary} />
              <Text style={styles.actionsMenuText}>Snooze 24 uur</Text>
            </Pressable>
            <Pressable
              style={styles.actionsMenuItem}
              onPress={() => {
                onSnooze(168);
                setShowActions(false);
              }}
            >
              <Ionicons name="calendar-outline" size={18} color={SemanticColors.textSecondary} />
              <Text style={styles.actionsMenuText}>Snooze 1 week</Text>
            </Pressable>
            <Pressable
              style={[styles.actionsMenuItem, styles.actionsMenuItemDanger]}
              onPress={() => {
                onDismiss();
                setShowActions(false);
              }}
            >
              <Ionicons name="close-circle-outline" size={18} color={SemanticColors.feedbackError} />
              <Text style={[styles.actionsMenuText, { color: SemanticColors.feedbackError }]}>
                {t('common.delete', 'Delete')}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

// ============================================
// ACTIVE ALERTS TAB
// ============================================

function ActiveAlertsTab({
  alerts,
  suggestedAlerts,
  onCreateAlert,
}: {
  alerts: PriceAlert[];
  suggestedAlerts: Array<{
    materialId: string;
    materialName: string;
    category: string;
    reason: string;
    potentialSavings: number;
  }>;
  onCreateAlert: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.tabContent}>
      {/* Active Alerts */}
      {alerts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actieve Alerts ({alerts.length})</Text>
          {alerts.map((alert) => (
            <View key={alert.id} style={styles.activeAlertCard}>
              <View style={styles.activeAlertIcon}>
                <Ionicons name="notifications-outline" size={20} color={Palette.hermesOrange} />
              </View>
              <View style={styles.activeAlertContent}>
                <Text style={styles.activeAlertName}>{alert.materialName}</Text>
                <Text style={styles.activeAlertCondition}>
                  {alert.type === 'price_drop' && `Alert bij ${alert.condition.dropPercent}% daling`}
                  {alert.type === 'price_target' && `Alert bij ${formatCurrency(alert.condition.targetPrice ?? 0)}`}
                  {alert.type === 'competitor_match' && `Alert als goedkoper dan ${alert.condition.beatSupplier}`}
                  {alert.type === 'bulk_opportunity' && `Alert bij ${alert.condition.bulkDiscount}% bulk korting`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
            </View>
          ))}
        </View>
      )}

      {/* Suggested Alerts */}
      {suggestedAlerts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Aanbevolen Alerts</Text>
          <Text style={styles.sectionSubtitle}>Gebaseerd op je aankoopgeschiedenis</Text>
          {suggestedAlerts.map((suggestion, index) => (
            <View key={index} style={styles.suggestedCard}>
              <View style={styles.suggestedIcon}>
                <Ionicons name="sparkles" size={18} color={Palette.hermesOrange} />
              </View>
              <View style={styles.suggestedContent}>
                <Text style={styles.suggestedName}>{suggestion.materialName}</Text>
                <Text style={styles.suggestedReason}>{suggestion.reason}</Text>
                <View style={styles.suggestedSavings}>
                  <Ionicons name="trending-down" size={12} color={SemanticColors.feedbackSuccess} />
                  <Text style={styles.suggestedSavingsText}>
                    ~{formatCurrency(suggestion.potentialSavings)} potentiële besparing
                  </Text>
                </View>
              </View>
              <Pressable style={styles.suggestedButton}>
                <Ionicons name="add" size={20} color={Palette.hermesOrange} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Empty state or CTA */}
      {alerts.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-outline" size={48} color={SemanticColors.textTertiary} />
          <Text style={styles.emptyTitle}>Geen actieve alerts</Text>
          <Text style={styles.emptyText}>
            Maak een alert aan om op de hoogte te blijven van prijsdalingen
          </Text>
          <Pressable style={styles.createButton} onPress={onCreateAlert}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.createButtonText}>Nieuwe Alert</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ============================================
// SETTINGS TAB
// ============================================

function SettingsTab() {
  const { preferences, updatePreferences } = useAlertPreferences();

  return (
    <View style={styles.tabContent}>
      {/* Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notificaties</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Alerts ingeschakeld</Text>
              <Text style={styles.settingDescription}>Ontvang meldingen bij prijsdalingen</Text>
            </View>
            <Switch
              value={preferences.enabled}
              onValueChange={(enabled) => updatePreferences({ enabled })}
              trackColor={{ true: Palette.hermesOrange }}
            />
          </View>
          <View style={styles.settingDivider} />
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Push notificaties</Text>
            </View>
            <Switch
              value={preferences.channels.push}
              onValueChange={(push) =>
                updatePreferences({ channels: { ...preferences.channels, push } })
              }
              trackColor={{ true: Palette.hermesOrange }}
            />
          </View>
          <View style={styles.settingDivider} />
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>In-app notificaties</Text>
            </View>
            <Switch
              value={preferences.channels.inApp}
              onValueChange={(inApp) =>
                updatePreferences({ channels: { ...preferences.channels, inApp } })
              }
              trackColor={{ true: Palette.hermesOrange }}
            />
          </View>
        </View>
      </View>

      {/* Thresholds */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Drempelwaarden</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Minimale besparing</Text>
              <Text style={styles.settingDescription}>Alleen alerts bij besparingen vanaf</Text>
            </View>
            <View style={styles.thresholdInput}>
              <Text style={styles.thresholdPrefix}>€</Text>
              <TextInput
                style={styles.thresholdValue}
                value={String(preferences.minimumSavings)}
                onChangeText={(text) => {
                  const value = parseInt(text) || 0;
                  updatePreferences({ minimumSavings: value });
                }}
                keyboardType="number-pad"
              />
            </View>
          </View>
        </View>
      </View>

      {/* Quiet Hours */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Stille uren</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Geen notificaties tussen</Text>
            </View>
            <Text style={styles.quietHoursText}>
              {preferences.quietHoursStart} - {preferences.quietHoursEnd}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ============================================
// CREATE ALERT MODAL
// ============================================

function CreateAlertModal({ onClose }: { onClose: () => void }) {
  const { createAlert } = usePriceAlerts();
  const [materialName, setMaterialName] = useState('');
  const [alertType, setAlertType] = useState<PriceAlert['type']>('price_drop');
  const [dropPercent, setDropPercent] = useState('10');
  const [targetPrice, setTargetPrice] = useState('');

  const handleCreate = () => {
    if (!materialName) return;

    const condition: any = {};
    if (alertType === 'price_drop') {
      condition.dropPercent = parseInt(dropPercent) || 10;
    } else if (alertType === 'price_target') {
      condition.targetPrice = parseFloat(targetPrice) || 0;
    }

    createAlert({
      materialId: `mat_${Date.now()}`,
      materialName,
      category: 'Onbekend',
      type: alertType,
      condition,
    });

    onClose();
  };

  return (
    <View style={styles.modalContainer}>
      <View style={styles.modalHeader}>
        <Pressable onPress={onClose}>
          <Text style={styles.cancelText}>Annuleren</Text>
        </Pressable>
        <Text style={styles.modalTitle}>Nieuwe Alert</Text>
        <Pressable onPress={handleCreate} disabled={!materialName}>
          <Text style={[styles.saveText, !materialName && styles.saveTextDisabled]}>Opslaan</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.modalContent}>
        {/* Material Name */}
        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>Materiaal</Text>
          <TextInput
            style={styles.formInput}
            value={materialName}
            onChangeText={setMaterialName}
            placeholder="Bijv. Dulux Trade Eggshell White 5L"
            placeholderTextColor={SemanticColors.textTertiary}
          />
        </View>

        {/* Alert Type */}
        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>Alert type</Text>
          <View style={styles.typeOptions}>
            {[
              { id: 'price_drop', label: 'Prijsdaling', icon: 'trending-down' as IconName },
              { id: 'price_target', label: 'Doelprijs', icon: 'flag' as IconName },
            ].map((type) => (
              <Pressable
                key={type.id}
                style={[styles.typeOption, alertType === type.id && styles.typeOptionActive]}
                onPress={() => setAlertType(type.id as PriceAlert['type'])}
              >
                <Ionicons
                  name={type.icon}
                  size={20}
                  color={alertType === type.id ? Palette.hermesOrange : SemanticColors.textSecondary}
                />
                <Text
                  style={[styles.typeOptionText, alertType === type.id && styles.typeOptionTextActive]}
                >
                  {type.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Condition */}
        {alertType === 'price_drop' && (
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Alert bij prijsdaling van</Text>
            <View style={styles.percentInput}>
              <TextInput
                style={styles.percentValue}
                value={dropPercent}
                onChangeText={setDropPercent}
                keyboardType="number-pad"
              />
              <Text style={styles.percentSuffix}>%</Text>
            </View>
          </View>
        )}

        {alertType === 'price_target' && (
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Alert wanneer prijs daalt naar</Text>
            <View style={styles.priceInput}>
              <Text style={styles.priceCurrency}>€</Text>
              <TextInput
                style={styles.priceValue}
                value={targetPrice}
                onChangeText={setTargetPrice}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={SemanticColors.textTertiary}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  headerTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  headerSubtitle: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.sm,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
  },
  statValue: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  statLabel: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: Palette.pastelOrange + '30',
  },
  tabText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textTertiary,
  },
  tabTextActive: {
    color: Palette.hermesOrange,
    fontFamily: TYPE.titleFamily,
  },
  tabBadge: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tabBadgeActive: {
    backgroundColor: Palette.hermesOrange,
  },
  tabBadgeText: {
    fontSize: TYPE.tinySize - 1,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textSecondary,
  },
  tabBadgeTextActive: {
    color: Palette.white,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: Spacing.lg,
  },
  tabContent: {
    gap: Spacing.lg,
  },

  // Alert Card
  alertCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  alertCardUrgent: {
    borderColor: SemanticColors.feedbackSuccessBorder,
    backgroundColor: SemanticColors.feedbackSuccessBg + '20',
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  alertTypeText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
  },
  urgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: SemanticColors.feedbackErrorBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  urgentText: {
    fontSize: TYPE.tinySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.feedbackError,
  },
  alertMaterial: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  alertBrand: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },
  alertPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: SemanticColors.surfaceSecondary,
    padding: Spacing.sm,
    borderRadius: 8,
  },
  alertPriceInfo: {
    alignItems: 'center',
  },
  alertPriceLabel: {
    fontSize: TYPE.tinySize - 1,
    color: SemanticColors.textTertiary,
  },
  alertCurrentPrice: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  alertPreviousPrice: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textTertiary,
    textDecorationLine: 'line-through',
  },
  alertSavings: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  alertSavingsText: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.feedbackSuccess,
  },
  alertSupplier: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alertSupplierText: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },
  alertActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  alertActionSecondary: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertActionPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: Palette.hermesOrange,
    borderRadius: 10,
  },
  alertActionPrimaryText: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: Palette.white,
  },
  actionsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  actionsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  actionsMenu: {
    position: 'absolute',
    bottom: 0,
    left: Spacing.md,
    right: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    overflow: 'hidden',
  },
  actionsMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  actionsMenuItemDanger: {
    borderBottomWidth: 0,
  },
  actionsMenuText: {
    fontSize: TYPE.bodySize,
    color: SemanticColors.textPrimary,
  },

  // Section
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textTertiary,
    marginTop: -4,
  },

  // Active Alert Card
  activeAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
  },
  activeAlertIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Palette.pastelOrange + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeAlertContent: {
    flex: 1,
  },
  activeAlertName: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  activeAlertCondition: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },

  // Suggested Card
  suggestedCard: {
    flexDirection: 'row',
    backgroundColor: Palette.pastelOrange + '15',
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  suggestedIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Palette.hermesOrange + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestedContent: {
    flex: 1,
  },
  suggestedName: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  suggestedReason: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  suggestedSavings: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  suggestedSavingsText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.feedbackSuccess,
  },
  suggestedButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#14181F",
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  emptyText: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: Palette.hermesOrange,
    borderRadius: 10,
    marginTop: Spacing.md,
  },
  createButtonText: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: Palette.white,
  },

  // Settings
  settingsCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textPrimary,
  },
  settingDescription: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  settingDivider: {
    height: 1,
    backgroundColor: SemanticColors.borderDefault,
    marginLeft: Spacing.md,
  },
  thresholdInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  thresholdPrefix: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
  },
  thresholdValue: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    paddingVertical: 8,
    paddingHorizontal: 4,
    minWidth: 40,
    textAlign: 'right',
  },
  quietHoursText: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  cancelText: {
    fontSize: TYPE.titleSize,
    color: SemanticColors.textSecondary,
  },
  modalTitle: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  saveText: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: Palette.hermesOrange,
  },
  saveTextDisabled: {
    color: SemanticColors.textTertiary,
  },
  modalContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  formGroup: {
    marginBottom: Spacing.lg,
  },
  formLabel: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
    marginBottom: Spacing.sm,
  },
  formInput: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    padding: Spacing.md,
    fontSize: TYPE.bodySize,
    color: SemanticColors.textPrimary,
  },
  typeOptions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  typeOptionActive: {
    borderColor: Palette.hermesOrange,
    backgroundColor: Palette.pastelOrange + '20',
  },
  typeOptionText: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textSecondary,
  },
  typeOptionTextActive: {
    color: Palette.hermesOrange,
  },
  percentInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    paddingHorizontal: Spacing.md,
  },
  percentValue: {
    flex: 1,
    fontSize: TYPE.displaySize - 4,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    paddingVertical: Spacing.md,
  },
  percentSuffix: {
    fontSize: TYPE.sectionSize,
    color: SemanticColors.textSecondary,
  },
  priceInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    paddingHorizontal: Spacing.md,
  },
  priceCurrency: {
    fontSize: TYPE.sectionSize,
    color: SemanticColors.textSecondary,
    marginRight: 4,
  },
  priceValue: {
    flex: 1,
    fontSize: TYPE.displaySize - 4,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    paddingVertical: Spacing.md,
  },
});
