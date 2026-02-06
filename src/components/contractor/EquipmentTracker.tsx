// =============================================================================
// EQUIPMENT TRACKER COMPONENT
// =============================================================================
// Comprehensive equipment and asset management interface
// =============================================================================

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import {
  useEquipment,
  useEquipmentCheckouts,
  useMaintenanceSchedule,
  useEquipmentUtilization,
  useDepreciation,
  useEquipmentAlerts,
  useEquipmentStats,
  Equipment,
  EquipmentCategory,
  EquipmentCheckout,
  MaintenanceSchedule,
  EquipmentUtilization,
  DepreciationReport,
} from '../../services/equipmentTrackerService';

const { width } = Dimensions.get('window');

type TabType = 'inventory' | 'checkouts' | 'maintenance' | 'reports';

export function EquipmentTracker() {
  const [activeTab, setActiveTab] = useState<TabType>('inventory');
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<EquipmentCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { equipment, loading: equipmentLoading } = useEquipment();
  const { checkouts, returnItem } = useEquipmentCheckouts();
  const { schedule } = useMaintenanceSchedule();
  const { utilization } = useEquipmentUtilization();
  const { depreciation } = useDepreciation();
  const { alerts, acknowledge } = useEquipmentAlerts();
  const stats = useEquipmentStats();

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'inventory', label: 'Inventaris', icon: 'cube' },
    { id: 'checkouts', label: 'Uitleen', icon: 'swap-horizontal' },
    { id: 'maintenance', label: 'Onderhoud', icon: 'construct' },
    { id: 'reports', label: 'Rapporten', icon: 'bar-chart' },
  ];

  const filteredEquipment = useMemo(() => {
    return equipment.filter(e => {
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          e.name.toLowerCase().includes(query) ||
          e.brand.toLowerCase().includes(query) ||
          e.model.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [equipment, categoryFilter, searchQuery]);

  const renderStatsBar = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.statsBar}
      contentContainerStyle={styles.statsBarContent}
    >
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{stats.totalEquipment}</Text>
        <Text style={styles.statLabel}>Totaal</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>
          €{(stats.totalValue / 1000).toFixed(1)}k
        </Text>
        <Text style={styles.statLabel}>Waarde</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: SemanticColors.feedbackSuccess }]}>
          {stats.availableCount}
        </Text>
        <Text style={styles.statLabel}>Beschikbaar</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{stats.inUseCount}</Text>
        <Text style={styles.statLabel}>In Gebruik</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={[styles.statValue, stats.overdueMaintenanceCount > 0 && styles.warningValue]}>
          {stats.overdueMaintenanceCount}
        </Text>
        <Text style={styles.statLabel}>Onderhoud</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{stats.averageUtilization}%</Text>
        <Text style={styles.statLabel}>Benutting</Text>
      </View>
    </ScrollView>
  );

  const renderAlertsBanner = () => {
    if (alerts.length === 0) return null;

    return (
      <View style={styles.alertsBanner}>
        <Ionicons name="warning" size={18} color={SemanticColors.feedbackWarning} />
        <Text style={styles.alertsText}>{alerts.length} meldingen vereisen aandacht</Text>
        <TouchableOpacity>
          <Text style={styles.alertsLink}>Bekijk</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderInventoryTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={SemanticColors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Zoek apparatuur..."
          placeholderTextColor={SemanticColors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryFilter}
        contentContainerStyle={styles.categoryFilterContent}
      >
        {[
          { id: 'all', label: 'Alles' },
          { id: 'power_tools', label: 'Elektrisch' },
          { id: 'hand_tools', label: 'Handgereedschap' },
          { id: 'vehicles', label: 'Voertuigen' },
          { id: 'diagnostic', label: 'Diagnose' },
          { id: 'measuring', label: 'Meten' },
          { id: 'safety', label: 'Veiligheid' },
        ].map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryChip,
              categoryFilter === cat.id && styles.categoryChipActive,
            ]}
            onPress={() => setCategoryFilter(cat.id as EquipmentCategory | 'all')}
          >
            <Text
              style={[
                styles.categoryChipText,
                categoryFilter === cat.id && styles.categoryChipTextActive,
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filteredEquipment.map(item => (
        <TouchableOpacity
          key={item.id}
          style={styles.equipmentCard}
          onPress={() => {
            setSelectedEquipment(item);
            setShowEquipmentModal(true);
          }}
        >
          <View style={styles.equipmentHeader}>
            <View style={[styles.equipmentIcon, { backgroundColor: getCategoryColor(item.category) + '20' }]}>
              <Ionicons
                name={getCategoryIcon(item.category) as any}
                size={24}
                color={getCategoryColor(item.category)}
              />
            </View>
            <View style={styles.equipmentInfo}>
              <Text style={styles.equipmentName}>{item.name}</Text>
              <Text style={styles.equipmentMeta}>
                {item.brand} {item.model}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {getStatusName(item.status)}
              </Text>
            </View>
          </View>

          <View style={styles.equipmentDetails}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Locatie</Text>
              <Text style={styles.detailValue}>{item.location}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Conditie</Text>
              <Text style={[styles.detailValue, { color: getConditionColor(item.condition) }]}>
                {getConditionName(item.condition)}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Waarde</Text>
              <Text style={styles.detailValue}>€{item.currentValue.toLocaleString('nl-NL')}</Text>
            </View>
          </View>

          {item.assignedToName && (
            <View style={styles.assignedTo}>
              <Ionicons name="person" size={14} color={SemanticColors.actionPrimary} />
              <Text style={styles.assignedToText}>Bij {item.assignedToName}</Text>
            </View>
          )}

          {item.nextMaintenanceDate && (
            <View style={[
              styles.maintenanceAlert,
              item.nextMaintenanceDate <= new Date() && styles.maintenanceOverdue,
            ]}>
              <Ionicons
                name="construct"
                size={14}
                color={item.nextMaintenanceDate <= new Date() ? SemanticColors.feedbackError : SemanticColors.textSecondary}
              />
              <Text style={[
                styles.maintenanceAlertText,
                item.nextMaintenanceDate <= new Date() && styles.maintenanceOverdueText,
              ]}>
                Onderhoud: {item.nextMaintenanceDate.toLocaleDateString('nl-NL')}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.addButton}>
        <Ionicons name="add-circle" size={24} color={SemanticColors.actionPrimary} />
        <Text style={styles.addButtonText}>Apparatuur toevoegen</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderCheckoutsTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Actieve Uitleningen</Text>
        <Text style={styles.sectionSubtitle}>{checkouts.length} items uitgeleend</Text>
      </View>

      {checkouts.map(checkout => {
        const isOverdue = checkout.expectedReturn < new Date();
        return (
          <View key={checkout.id} style={[styles.checkoutCard, isOverdue && styles.overdueCard]}>
            <View style={styles.checkoutHeader}>
              <View style={styles.checkoutInfo}>
                <Text style={styles.checkoutName}>{checkout.equipmentName}</Text>
                <Text style={styles.checkoutPerson}>
                  <Ionicons name="person" size={12} color={SemanticColors.textSecondary} />
                  {' '}{checkout.checkedOutByName}
                </Text>
              </View>
              {isOverdue && (
                <View style={styles.overdueBadge}>
                  <Ionicons name="alert-circle" size={14} color={SemanticColors.feedbackError} />
                  <Text style={styles.overdueText}>Te laat</Text>
                </View>
              )}
            </View>

            <View style={styles.checkoutDates}>
              <View style={styles.dateItem}>
                <Text style={styles.dateLabel}>Uitgeleend</Text>
                <Text style={styles.dateValue}>
                  {checkout.checkoutDate.toLocaleDateString('nl-NL')}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={SemanticColors.textSecondary} />
              <View style={styles.dateItem}>
                <Text style={styles.dateLabel}>Verwacht terug</Text>
                <Text style={[styles.dateValue, isOverdue && styles.overdueDateValue]}>
                  {checkout.expectedReturn.toLocaleDateString('nl-NL')}
                </Text>
              </View>
            </View>

            {checkout.jobName && (
              <View style={styles.checkoutJob}>
                <Ionicons name="briefcase" size={14} color={SemanticColors.textSecondary} />
                <Text style={styles.checkoutJobText}>{checkout.jobName}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.returnButton}
              onPress={() => returnItem(checkout.id, 'good')}
            >
              <Ionicons name="return-down-back" size={18} color={SemanticColors.actionPrimary} />
              <Text style={styles.returnButtonText}>Retour melden</Text>
            </TouchableOpacity>
          </View>
        );
      })}

      {checkouts.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="cube-outline" size={48} color={SemanticColors.textSecondary} />
          <Text style={styles.emptyText}>Geen actieve uitleningen</Text>
        </View>
      )}
    </ScrollView>
  );

  const renderMaintenanceTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Onderhoud Planning</Text>
      </View>

      {schedule
        .sort((a, b) => a.nextDue.getTime() - b.nextDue.getTime())
        .map(item => (
          <View
            key={item.id}
            style={[
              styles.maintenanceCard,
              item.isOverdue && styles.maintenanceOverdueCard,
            ]}
          >
            <View style={styles.maintenanceHeader}>
              <View style={styles.maintenanceInfo}>
                <Text style={styles.maintenanceName}>{item.equipmentName}</Text>
                <Text style={styles.maintenanceType}>{item.description}</Text>
              </View>
              {item.isOverdue ? (
                <View style={styles.overdueBadge}>
                  <Ionicons name="alert-circle" size={14} color={SemanticColors.feedbackError} />
                  <Text style={styles.overdueText}>Achterstallig</Text>
                </View>
              ) : (
                <View style={styles.daysUntil}>
                  <Text style={styles.daysValue}>
                    {Math.ceil((item.nextDue.getTime() - Date.now()) / (1000 * 60 * 60 * 24))}
                  </Text>
                  <Text style={styles.daysLabel}>dagen</Text>
                </View>
              )}
            </View>

            <View style={styles.maintenanceDetails}>
              <View style={styles.maintenanceDetail}>
                <Ionicons name="calendar" size={14} color={SemanticColors.textSecondary} />
                <Text style={styles.maintenanceDetailText}>
                  {item.nextDue.toLocaleDateString('nl-NL')}
                </Text>
              </View>
              <View style={styles.maintenanceDetail}>
                <Ionicons name="time" size={14} color={SemanticColors.textSecondary} />
                <Text style={styles.maintenanceDetailText}>{item.estimatedDuration} min</Text>
              </View>
              <View style={styles.maintenanceDetail}>
                <Ionicons name="cash" size={14} color={SemanticColors.textSecondary} />
                <Text style={styles.maintenanceDetailText}>~€{item.estimatedCost}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.scheduleButton}>
              <Text style={styles.scheduleButtonText}>Inplannen</Text>
            </TouchableOpacity>
          </View>
        ))}
    </ScrollView>
  );

  const renderReportsTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Benutting</Text>
      </View>

      {utilization
        .sort((a, b) => b.utilizationRate - a.utilizationRate)
        .slice(0, 5)
        .map(item => (
          <View key={item.equipmentId} style={styles.utilizationCard}>
            <View style={styles.utilizationHeader}>
              <Text style={styles.utilizationName}>{item.equipmentName}</Text>
              <Text style={[
                styles.utilizationRate,
                { color: item.utilizationRate > 50 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackWarning },
              ]}>
                {item.utilizationRate}%
              </Text>
            </View>
            <View style={styles.utilizationBar}>
              <View
                style={[
                  styles.utilizationFill,
                  {
                    width: `${item.utilizationRate}%`,
                    backgroundColor: item.utilizationRate > 50 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackWarning,
                  },
                ]}
              />
            </View>
            <View style={styles.utilizationStats}>
              <Text style={styles.utilizationStat}>
                ROI: <Text style={styles.utilizationStatValue}>{item.roi}%</Text>
              </Text>
              <Text style={styles.utilizationStat}>
                Omzet: <Text style={styles.utilizationStatValue}>€{item.revenueGenerated.toLocaleString('nl-NL')}</Text>
              </Text>
            </View>
          </View>
        ))}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Afschrijving</Text>
      </View>

      <View style={styles.depreciationSummary}>
        <View style={styles.depreciationItem}>
          <Text style={styles.depreciationLabel}>Totaal Aanschaf</Text>
          <Text style={styles.depreciationValue}>
            €{depreciation.reduce((sum, d) => sum + d.purchasePrice, 0).toLocaleString('nl-NL')}
          </Text>
        </View>
        <View style={styles.depreciationItem}>
          <Text style={styles.depreciationLabel}>Totale Afschrijving</Text>
          <Text style={styles.depreciationValue}>
            €{depreciation.reduce((sum, d) => sum + d.accumulatedDepreciation, 0).toLocaleString('nl-NL')}
          </Text>
        </View>
        <View style={styles.depreciationItem}>
          <Text style={styles.depreciationLabel}>Boekwaarde</Text>
          <Text style={[styles.depreciationValue, { color: SemanticColors.feedbackSuccess }]}>
            €{depreciation.reduce((sum, d) => sum + d.bookValue, 0).toLocaleString('nl-NL')}
          </Text>
        </View>
      </View>

      {depreciation.slice(0, 5).map(item => (
        <View key={item.equipmentId} style={styles.depreciationCard}>
          <View style={styles.depreciationCardHeader}>
            <Text style={styles.depreciationCardName}>{item.equipmentName}</Text>
            <Text style={styles.depreciationCardYears}>
              {item.yearsRemaining} jaar restant
            </Text>
          </View>
          <View style={styles.depreciationCardValues}>
            <View style={styles.depreciationCardValue}>
              <Text style={styles.depreciationCardLabel}>Aanschaf</Text>
              <Text style={styles.depreciationCardAmount}>€{item.purchasePrice.toLocaleString('nl-NL')}</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={SemanticColors.textSecondary} />
            <View style={styles.depreciationCardValue}>
              <Text style={styles.depreciationCardLabel}>Boekwaarde</Text>
              <Text style={styles.depreciationCardAmount}>€{item.bookValue.toLocaleString('nl-NL')}</Text>
            </View>
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.exportButton}>
        <Ionicons name="download" size={18} color={Palette.white} />
        <Text style={styles.exportButtonText}>Exporteer voor belasting</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderEquipmentModal = () => (
    <Modal
      visible={showEquipmentModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowEquipmentModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowEquipmentModal(false)}>
            <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Apparatuur Details</Text>
          <TouchableOpacity>
            <Ionicons name="create-outline" size={24} color={SemanticColors.actionPrimary} />
          </TouchableOpacity>
        </View>

        {selectedEquipment && (
          <ScrollView style={styles.modalContent}>
            <View style={styles.equipmentProfile}>
              <View style={[styles.equipmentProfileIcon, { backgroundColor: getCategoryColor(selectedEquipment.category) + '20' }]}>
                <Ionicons
                  name={getCategoryIcon(selectedEquipment.category) as any}
                  size={48}
                  color={getCategoryColor(selectedEquipment.category)}
                />
              </View>
              <Text style={styles.equipmentProfileName}>{selectedEquipment.name}</Text>
              <Text style={styles.equipmentProfileMeta}>
                {selectedEquipment.brand} {selectedEquipment.model}
              </Text>
              <View style={[styles.statusBadgeLarge, { backgroundColor: getStatusColor(selectedEquipment.status) + '20' }]}>
                <Text style={[styles.statusTextLarge, { color: getStatusColor(selectedEquipment.status) }]}>
                  {getStatusName(selectedEquipment.status)}
                </Text>
              </View>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Algemeen</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailRowLabel}>Serienummer</Text>
                <Text style={styles.detailRowValue}>{selectedEquipment.serialNumber}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailRowLabel}>Locatie</Text>
                <Text style={styles.detailRowValue}>{selectedEquipment.location}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailRowLabel}>Conditie</Text>
                <Text style={[styles.detailRowValue, { color: getConditionColor(selectedEquipment.condition) }]}>
                  {getConditionName(selectedEquipment.condition)}
                </Text>
              </View>
              {selectedEquipment.assignedToName && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailRowLabel}>Toegewezen aan</Text>
                  <Text style={styles.detailRowValue}>{selectedEquipment.assignedToName}</Text>
                </View>
              )}
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Financieel</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailRowLabel}>Aankoopdatum</Text>
                <Text style={styles.detailRowValue}>
                  {selectedEquipment.purchaseDate.toLocaleDateString('nl-NL')}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailRowLabel}>Aankoopprijs</Text>
                <Text style={styles.detailRowValue}>
                  €{selectedEquipment.purchasePrice.toLocaleString('nl-NL')}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailRowLabel}>Huidige waarde</Text>
                <Text style={styles.detailRowValue}>
                  €{selectedEquipment.currentValue.toLocaleString('nl-NL')}
                </Text>
              </View>
              {selectedEquipment.warrantyExpiry && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailRowLabel}>Garantie tot</Text>
                  <Text style={styles.detailRowValue}>
                    {selectedEquipment.warrantyExpiry.toLocaleDateString('nl-NL')}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Gebruik & Onderhoud</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailRowLabel}>Totaal gebruik</Text>
                <Text style={styles.detailRowValue}>{selectedEquipment.totalUsageHours} uur</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailRowLabel}>Reparaties</Text>
                <Text style={styles.detailRowValue}>{selectedEquipment.repairCount}x</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailRowLabel}>Totale reparatiekosten</Text>
                <Text style={styles.detailRowValue}>
                  €{selectedEquipment.totalRepairCost.toLocaleString('nl-NL')}
                </Text>
              </View>
              {selectedEquipment.lastMaintenanceDate && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailRowLabel}>Laatste onderhoud</Text>
                  <Text style={styles.detailRowValue}>
                    {selectedEquipment.lastMaintenanceDate.toLocaleDateString('nl-NL')}
                  </Text>
                </View>
              )}
              {selectedEquipment.nextMaintenanceDate && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailRowLabel}>Volgend onderhoud</Text>
                  <Text style={[
                    styles.detailRowValue,
                    selectedEquipment.nextMaintenanceDate <= new Date() && { color: SemanticColors.feedbackError },
                  ]}>
                    {selectedEquipment.nextMaintenanceDate.toLocaleDateString('nl-NL')}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.modalActions}>
              {selectedEquipment.status === 'available' && (
                <TouchableOpacity style={styles.primaryAction}>
                  <Ionicons name="swap-horizontal" size={20} color={Palette.white} />
                  <Text style={styles.primaryActionText}>Uitlenen</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.secondaryAction}>
                <Ionicons name="construct" size={20} color={SemanticColors.actionPrimary} />
                <Text style={styles.secondaryActionText}>Onderhoud Melden</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryAction}>
                <Ionicons name="document-text" size={20} color={SemanticColors.actionPrimary} />
                <Text style={styles.secondaryActionText}>Geschiedenis</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Apparatuur</Text>
        <Text style={styles.subtitle}>
          {stats.totalEquipment} items • €{(stats.totalValue / 1000).toFixed(1)}k waarde
        </Text>
      </View>

      {renderStatsBar()}
      {renderAlertsBanner()}

      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.activeTab]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons
              name={tab.icon as any}
              size={20}
              color={activeTab === tab.id ? SemanticColors.actionPrimary : SemanticColors.textSecondary}
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === tab.id && styles.activeTabLabel,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'inventory' && renderInventoryTab()}
      {activeTab === 'checkouts' && renderCheckoutsTab()}
      {activeTab === 'maintenance' && renderMaintenanceTab()}
      {activeTab === 'reports' && renderReportsTab()}

      {renderEquipmentModal()}
    </View>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function getCategoryIcon(category: EquipmentCategory): string {
  const icons: Record<EquipmentCategory, string> = {
    power_tools: 'flash',
    hand_tools: 'hammer',
    measuring: 'analytics',
    safety: 'shield-checkmark',
    vehicles: 'car',
    heavy_equipment: 'build',
    diagnostic: 'pulse',
    other: 'cube',
  };
  return icons[category];
}

function getCategoryColor(category: EquipmentCategory): string {
  const colors: Record<EquipmentCategory, string> = {
    power_tools: SemanticColors.feedbackWarning,
    hand_tools: SemanticColors.actionPrimary,
    measuring: SemanticColors.feedbackInfo,
    safety: SemanticColors.feedbackSuccess,
    vehicles: SemanticColors.feedbackError,
    heavy_equipment: '#8B4513',
    diagnostic: '#9B59B6',
    other: SemanticColors.textSecondary,
  };
  return colors[category];
}

function getStatusName(status: string): string {
  const names: Record<string, string> = {
    available: 'Beschikbaar',
    in_use: 'In Gebruik',
    maintenance: 'Onderhoud',
    repair: 'Reparatie',
    retired: 'Afgeschreven',
  };
  return names[status] || status;
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    available: SemanticColors.feedbackSuccess,
    in_use: SemanticColors.actionPrimary,
    maintenance: SemanticColors.feedbackWarning,
    repair: SemanticColors.feedbackError,
    retired: SemanticColors.textSecondary,
  };
  return colors[status] || SemanticColors.textSecondary;
}

function getConditionName(condition: string): string {
  const names: Record<string, string> = {
    excellent: 'Uitstekend',
    good: 'Goed',
    fair: 'Redelijk',
    poor: 'Slecht',
  };
  return names[condition] || condition;
}

function getConditionColor(condition: string): string {
  const colors: Record<string, string> = {
    excellent: SemanticColors.feedbackSuccess,
    good: SemanticColors.actionPrimary,
    fair: SemanticColors.feedbackWarning,
    poor: SemanticColors.feedbackError,
  };
  return colors[condition] || SemanticColors.textSecondary;
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  header: {
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  statsBar: {
    maxHeight: 80,
  },
  statsBarContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  statItem: {
    backgroundColor: SemanticColors.surfacePrimary,
    padding: 12,
    borderRadius: 12,
    minWidth: 75,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  warningValue: {
    color: SemanticColors.feedbackWarning,
  },
  alertsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 12,
    padding: 12,
    backgroundColor: SemanticColors.feedbackWarning + '15',
    borderRadius: 10,
    gap: 8,
  },
  alertsText: {
    flex: 1,
    fontSize: 13,
    color: SemanticColors.textPrimary,
  },
  alertsLink: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.actionPrimary,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: SemanticColors.surfacePrimary,
    gap: 6,
  },
  activeTab: {
    backgroundColor: SemanticColors.actionPrimary + '15',
  },
  tabLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    fontWeight: '500',
  },
  activeTabLabel: {
    color: SemanticColors.actionPrimary,
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: SemanticColors.textPrimary,
  },
  categoryFilter: {
    maxHeight: 40,
    marginBottom: 12,
  },
  categoryFilterContent: {
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
  },
  categoryChipActive: {
    backgroundColor: SemanticColors.actionPrimary,
  },
  categoryChipText: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: Palette.white,
  },
  equipmentCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  equipmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  equipmentIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  equipmentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  equipmentName: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  equipmentMeta: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  equipmentDetails: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: SemanticColors.textPrimary,
    marginTop: 2,
  },
  assignedTo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  assignedToText: {
    fontSize: 13,
    color: SemanticColors.actionPrimary,
  },
  maintenanceAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  maintenanceOverdue: {
    backgroundColor: SemanticColors.feedbackError + '10',
    padding: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  maintenanceAlertText: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  maintenanceOverdueText: {
    color: SemanticColors.feedbackError,
    fontWeight: '500',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.actionPrimary + '40',
    borderStyle: 'dashed',
    marginBottom: 20,
    gap: 8,
  },
  addButtonText: {
    fontSize: 15,
    color: SemanticColors.actionPrimary,
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  checkoutCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  overdueCard: {
    borderWidth: 1,
    borderColor: SemanticColors.feedbackError + '40',
  },
  checkoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checkoutInfo: {
    flex: 1,
  },
  checkoutName: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  checkoutPerson: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  overdueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.feedbackError + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  overdueText: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.feedbackError,
  },
  checkoutDates: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  dateItem: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '500',
    color: SemanticColors.textPrimary,
    marginTop: 2,
  },
  overdueDateValue: {
    color: SemanticColors.feedbackError,
  },
  checkoutJob: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  checkoutJobText: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  returnButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: SemanticColors.actionPrimary + '15',
    borderRadius: 10,
    gap: 6,
  },
  returnButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.actionPrimary,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 15,
    color: SemanticColors.textSecondary,
    marginTop: 12,
  },
  maintenanceCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  maintenanceOverdueCard: {
    borderWidth: 1,
    borderColor: SemanticColors.feedbackError + '40',
  },
  maintenanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  maintenanceInfo: {
    flex: 1,
  },
  maintenanceName: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  maintenanceType: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  daysUntil: {
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceBackground,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  daysValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  daysLabel: {
    fontSize: 10,
    color: SemanticColors.textSecondary,
  },
  maintenanceDetails: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 16,
  },
  maintenanceDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  maintenanceDetailText: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  scheduleButton: {
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: SemanticColors.actionPrimary + '15',
    borderRadius: 10,
    alignItems: 'center',
  },
  scheduleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.actionPrimary,
  },
  utilizationCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  utilizationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  utilizationName: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  utilizationRate: {
    fontSize: 18,
    fontWeight: '700',
  },
  utilizationBar: {
    height: 6,
    backgroundColor: SemanticColors.borderDefault,
    borderRadius: 3,
    overflow: 'hidden',
  },
  utilizationFill: {
    height: '100%',
    borderRadius: 3,
  },
  utilizationStats: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 16,
  },
  utilizationStat: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  utilizationStatValue: {
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  depreciationSummary: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  depreciationItem: {
    flex: 1,
    alignItems: 'center',
  },
  depreciationLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
  },
  depreciationValue: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginTop: 4,
  },
  depreciationCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  depreciationCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  depreciationCardName: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  depreciationCardYears: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  depreciationCardValues: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  depreciationCardValue: {
    flex: 1,
  },
  depreciationCardLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  depreciationCardAmount: {
    fontSize: 14,
    fontWeight: '500',
    color: SemanticColors.textPrimary,
    marginTop: 2,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.actionPrimary,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 20,
    gap: 8,
  },
  exportButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Palette.white,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  modalContent: {
    flex: 1,
  },
  equipmentProfile: {
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  equipmentProfileIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  equipmentProfileName: {
    fontSize: 22,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginTop: 16,
    textAlign: 'center',
  },
  equipmentProfileMeta: {
    fontSize: 15,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  statusBadgeLarge: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusTextLarge: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  detailRowLabel: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  detailRowValue: {
    fontSize: 14,
    fontWeight: '500',
    color: SemanticColors.textPrimary,
  },
  modalActions: {
    padding: 20,
    gap: 10,
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.actionPrimary,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  primaryActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: Palette.white,
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.actionPrimary + '15',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  secondaryActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.actionPrimary,
  },
});

export default EquipmentTracker;
