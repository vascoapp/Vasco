// =============================================================================
// SERVICE CONTRACTS COMPONENT
// =============================================================================
// Recurring maintenance contracts management interface
// =============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import {
  useServiceContracts,
  useContractTemplates,
  useContractRenewals,
  useUpcomingVisits,
  useContractRevenue,
  useContractStats,
  ServiceContract,
  ContractTemplate,
  ContractRenewal,
  ScheduledVisit,
} from '../../services/serviceContractsService';

type TabType = 'overview' | 'contracts' | 'renewals' | 'visits';

export function ServiceContracts() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedContract, setSelectedContract] = useState<ServiceContract | null>(null);
  const [showContractModal, setShowContractModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  const { contracts } = useServiceContracts();
  const { templates } = useContractTemplates();
  const { renewals, sendOffer, acceptRenewal } = useContractRenewals();
  const { visits } = useUpcomingVisits(30);
  const { revenue } = useContractRevenue(6);
  const stats = useContractStats();

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overzicht', icon: 'grid' },
    { id: 'contracts', label: 'Contracten', icon: 'document-text' },
    { id: 'renewals', label: 'Verlengingen', icon: 'refresh' },
    { id: 'visits', label: 'Bezoeken', icon: 'calendar' },
  ];

  const renderStatsBar = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.statsBar}
      contentContainerStyle={styles.statsBarContent}
    >
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{stats.activeContracts}</Text>
        <Text style={styles.statLabel}>Actief</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: Palette.success }]}>
          €{stats.monthlyRecurringRevenue}
        </Text>
        <Text style={styles.statLabel}>MRR</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={[styles.statValue, stats.pendingRenewals > 0 && styles.warningValue]}>
          {stats.pendingRenewals}
        </Text>
        <Text style={styles.statLabel}>Verlengingen</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{stats.renewalRate}%</Text>
        <Text style={styles.statLabel}>Retentie</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{stats.upcomingVisits}</Text>
        <Text style={styles.statLabel}>Bezoeken</Text>
      </View>
    </ScrollView>
  );

  const renderOverviewTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.revenueCard}>
        <Text style={styles.revenueTitle}>Jaarlijkse Contractwaarde</Text>
        <Text style={styles.revenueValue}>€{stats.yearlyContractValue.toLocaleString('nl-NL')}</Text>
        <Text style={styles.revenueSubtitle}>
          Gem. €{stats.averageContractValue}/contract
        </Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Omzet Voorspelling</Text>
      </View>

      <View style={styles.chartContainer}>
        <View style={styles.chartBars}>
          {revenue.slice(0, 6).map((r, i) => (
            <View key={i} style={styles.chartBarContainer}>
              <View
                style={[
                  styles.chartBar,
                  { height: `${(r.recurring / Math.max(...revenue.map(x => x.recurring)) * 80)}%` },
                ]}
              />
              <Text style={styles.chartLabel}>{r.period.split(' ')[0]}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Populaire Templates</Text>
        <TouchableOpacity onPress={() => setShowTemplateModal(true)}>
          <Text style={styles.sectionLink}>Alle bekijken</Text>
        </TouchableOpacity>
      </View>

      {templates.slice(0, 3).map(template => (
        <View key={template.id} style={styles.templateCard}>
          <View style={styles.templateHeader}>
            <View style={styles.templateInfo}>
              <Text style={styles.templateName}>{template.name}</Text>
              <Text style={styles.templateDescription}>{template.description}</Text>
            </View>
            <View style={styles.templatePrice}>
              <Text style={styles.templatePriceValue}>€{template.basePrice}</Text>
              <Text style={styles.templatePriceLabel}>/{template.billingCycle === 'monthly' ? 'mnd' : 'jaar'}</Text>
            </View>
          </View>
          <View style={styles.templateServices}>
            {template.services.slice(0, 2).map((s, i) => (
              <View key={i} style={styles.templateService}>
                <Ionicons name="checkmark" size={14} color={Palette.success} />
                <Text style={styles.templateServiceText}>{s.name}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.slaBadge, { backgroundColor: getSlaColor(template.slaLevel) + '20' }]}>
            <Text style={[styles.slaText, { color: getSlaColor(template.slaLevel) }]}>
              {getSlaName(template.slaLevel)} • {template.responseTime}u respons
            </Text>
          </View>
        </View>
      ))}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Aankomende Bezoeken</Text>
      </View>

      {visits.slice(0, 3).map(visit => {
        const contract = contracts.find(c => c.id === visit.contractId);
        return (
          <View key={visit.id} style={styles.visitCard}>
            <View style={styles.visitDate}>
              <Text style={styles.visitDay}>{visit.scheduledDate.getDate()}</Text>
              <Text style={styles.visitMonth}>
                {visit.scheduledDate.toLocaleDateString('nl-NL', { month: 'short' })}
              </Text>
            </View>
            <View style={styles.visitInfo}>
              <Text style={styles.visitCustomer}>{contract?.customerName}</Text>
              <Text style={styles.visitType}>{getVisitTypeName(visit.type)}</Text>
              <Text style={styles.visitTime}>{visit.timeSlot}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={SemanticColors.textSecondary} />
          </View>
        );
      })}
    </ScrollView>
  );

  const renderContractsTab = () => (
    <ScrollView style={styles.tabContent}>
      {contracts.map(contract => (
        <TouchableOpacity
          key={contract.id}
          style={styles.contractCard}
          onPress={() => {
            setSelectedContract(contract);
            setShowContractModal(true);
          }}
        >
          <View style={styles.contractHeader}>
            <View style={styles.contractInfo}>
              <Text style={styles.contractCustomer}>{contract.customerName}</Text>
              <Text style={styles.contractNumber}>{contract.contractNumber}</Text>
            </View>
            <View style={[styles.contractStatus, { backgroundColor: getStatusColor(contract.status) + '20' }]}>
              <Text style={[styles.contractStatusText, { color: getStatusColor(contract.status) }]}>
                {getStatusName(contract.status)}
              </Text>
            </View>
          </View>

          <View style={styles.contractDetails}>
            <View style={styles.contractDetail}>
              <Ionicons name="document-text" size={14} color={SemanticColors.textSecondary} />
              <Text style={styles.contractDetailText}>{getTypeName(contract.type)}</Text>
            </View>
            <View style={styles.contractDetail}>
              <Ionicons name="cash" size={14} color={SemanticColors.textSecondary} />
              <Text style={styles.contractDetailText}>
                €{contract.price}/{contract.billingCycle === 'monthly' ? 'mnd' : contract.billingCycle === 'quarterly' ? 'kw' : 'jaar'}
              </Text>
            </View>
            <View style={styles.contractDetail}>
              <Ionicons name="shield" size={14} color={SemanticColors.textSecondary} />
              <Text style={styles.contractDetailText}>{getSlaName(contract.slaLevel)}</Text>
            </View>
          </View>

          <View style={styles.contractEquipment}>
            <Text style={styles.contractEquipmentLabel}>
              {contract.equipment.length} apparaat/apparaten
            </Text>
            <Text style={styles.contractExpiry}>
              Loopt tot {contract.endDate.toLocaleDateString('nl-NL')}
            </Text>
          </View>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.addButton}>
        <Ionicons name="add-circle" size={24} color={SemanticColors.actionPrimary} />
        <Text style={styles.addButtonText}>Nieuw contract</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderRenewalsTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Openstaande Verlengingen</Text>
        <Text style={styles.sectionSubtitle}>{renewals.filter(r => r.status === 'pending').length} actie vereist</Text>
      </View>

      {renewals
        .filter(r => r.status === 'pending' || r.status === 'sent')
        .sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal)
        .map(renewal => (
          <View key={renewal.id} style={styles.renewalCard}>
            <View style={styles.renewalHeader}>
              <View style={styles.renewalInfo}>
                <Text style={styles.renewalCustomer}>{renewal.customerName}</Text>
                <Text style={styles.renewalContract}>{renewal.contractNumber}</Text>
              </View>
              <View style={styles.renewalDays}>
                <Text style={[
                  styles.renewalDaysValue,
                  renewal.daysUntilRenewal < 30 && { color: Palette.warning },
                  renewal.daysUntilRenewal < 14 && { color: Palette.error },
                ]}>
                  {renewal.daysUntilRenewal}
                </Text>
                <Text style={styles.renewalDaysLabel}>dagen</Text>
              </View>
            </View>

            <View style={styles.renewalPricing}>
              <View style={styles.priceItem}>
                <Text style={styles.priceLabel}>Huidige prijs</Text>
                <Text style={styles.priceValue}>€{renewal.currentPrice}</Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={SemanticColors.textSecondary} />
              <View style={styles.priceItem}>
                <Text style={styles.priceLabel}>Voorstel</Text>
                <Text style={[styles.priceValue, { color: SemanticColors.actionPrimary }]}>
                  €{renewal.suggestedPrice}
                </Text>
              </View>
              <View style={[styles.priceChange, { backgroundColor: renewal.priceChange > 0 ? Palette.warning + '20' : Palette.success + '20' }]}>
                <Text style={[styles.priceChangeText, { color: renewal.priceChange > 0 ? Palette.warning : Palette.success }]}>
                  {renewal.priceChange > 0 ? '+' : ''}{renewal.priceChange}%
                </Text>
              </View>
            </View>

            <View style={styles.renewalActions}>
              {renewal.status === 'pending' ? (
                <TouchableOpacity
                  style={styles.sendOfferButton}
                  onPress={() => sendOffer(renewal.id)}
                >
                  <Ionicons name="send" size={18} color={Palette.white} />
                  <Text style={styles.sendOfferText}>Voorstel versturen</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.sentBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={Palette.success} />
                  <Text style={styles.sentText}>Verstuurd</Text>
                </View>
              )}
              <TouchableOpacity style={styles.editButton}>
                <Ionicons name="create-outline" size={18} color={SemanticColors.actionPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
    </ScrollView>
  );

  const renderVisitsTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Geplande Bezoeken</Text>
        <Text style={styles.sectionSubtitle}>Komende 30 dagen</Text>
      </View>

      {visits.map(visit => {
        const contract = contracts.find(c => c.id === visit.contractId);
        return (
          <View key={visit.id} style={styles.visitDetailCard}>
            <View style={styles.visitDetailDate}>
              <Text style={styles.visitDetailDay}>{visit.scheduledDate.getDate()}</Text>
              <Text style={styles.visitDetailMonth}>
                {visit.scheduledDate.toLocaleDateString('nl-NL', { month: 'short' })}
              </Text>
              <Text style={styles.visitDetailWeekday}>
                {visit.scheduledDate.toLocaleDateString('nl-NL', { weekday: 'short' })}
              </Text>
            </View>

            <View style={styles.visitDetailContent}>
              <View style={styles.visitDetailHeader}>
                <Text style={styles.visitDetailCustomer}>{contract?.customerName}</Text>
                <View style={[styles.visitTypeBadge, { backgroundColor: getVisitTypeColor(visit.type) + '20' }]}>
                  <Text style={[styles.visitTypeBadgeText, { color: getVisitTypeColor(visit.type) }]}>
                    {getVisitTypeName(visit.type)}
                  </Text>
                </View>
              </View>

              <Text style={styles.visitDetailAddress}>{contract?.customerAddress}</Text>
              <Text style={styles.visitDetailTime}>
                <Ionicons name="time" size={12} color={SemanticColors.textSecondary} /> {visit.timeSlot}
              </Text>

              {contract?.equipment && contract.equipment.length > 0 && (
                <View style={styles.visitEquipment}>
                  <Text style={styles.visitEquipmentLabel}>Apparatuur:</Text>
                  {contract.equipment.slice(0, 2).map((eq, i) => (
                    <Text key={i} style={styles.visitEquipmentItem}>
                      • {eq.name} ({eq.brand})
                    </Text>
                  ))}
                </View>
              )}

              <View style={styles.visitActions}>
                <TouchableOpacity style={styles.visitActionButton}>
                  <Ionicons name="navigate" size={16} color={SemanticColors.actionPrimary} />
                  <Text style={styles.visitActionText}>Route</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.visitActionButton}>
                  <Ionicons name="call" size={16} color={SemanticColors.actionPrimary} />
                  <Text style={styles.visitActionText}>Bellen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.visitActionButton}>
                  <Ionicons name="calendar" size={16} color={SemanticColors.actionPrimary} />
                  <Text style={styles.visitActionText}>Verzetten</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      })}

      {visits.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={48} color={SemanticColors.textSecondary} />
          <Text style={styles.emptyText}>Geen bezoeken gepland</Text>
        </View>
      )}
    </ScrollView>
  );

  const renderContractModal = () => (
    <Modal
      visible={showContractModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowContractModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowContractModal(false)}>
            <Ionicons name="close" size={24} color={SemanticColors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Contract Details</Text>
          <TouchableOpacity>
            <Ionicons name="create-outline" size={24} color={SemanticColors.actionPrimary} />
          </TouchableOpacity>
        </View>

        {selectedContract && (
          <ScrollView style={styles.modalContent}>
            <View style={styles.contractProfile}>
              <Text style={styles.contractProfileNumber}>{selectedContract.contractNumber}</Text>
              <Text style={styles.contractProfileCustomer}>{selectedContract.customerName}</Text>
              <Text style={styles.contractProfileAddress}>{selectedContract.customerAddress}</Text>
              <View style={[styles.contractStatus, { backgroundColor: getStatusColor(selectedContract.status) + '20', marginTop: 12 }]}>
                <Text style={[styles.contractStatusText, { color: getStatusColor(selectedContract.status) }]}>
                  {getStatusName(selectedContract.status)}
                </Text>
              </View>
            </View>

            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Contract Details</Text>
              <View style={styles.modalRow}>
                <Text style={styles.modalRowLabel}>Type</Text>
                <Text style={styles.modalRowValue}>{getTypeName(selectedContract.type)}</Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalRowLabel}>SLA Niveau</Text>
                <Text style={styles.modalRowValue}>{getSlaName(selectedContract.slaLevel)}</Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalRowLabel}>Responstijd</Text>
                <Text style={styles.modalRowValue}>{selectedContract.responseTime} uur</Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalRowLabel}>Prijs</Text>
                <Text style={styles.modalRowValue}>
                  €{selectedContract.price}/{selectedContract.billingCycle === 'monthly' ? 'mnd' : 'jaar'}
                </Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalRowLabel}>Looptijd</Text>
                <Text style={styles.modalRowValue}>
                  {selectedContract.startDate.toLocaleDateString('nl-NL')} - {selectedContract.endDate.toLocaleDateString('nl-NL')}
                </Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalRowLabel}>Auto verlenging</Text>
                <Text style={styles.modalRowValue}>{selectedContract.autoRenew ? 'Ja' : 'Nee'}</Text>
              </View>
            </View>

            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Diensten</Text>
              {selectedContract.services.map((service, i) => (
                <View key={i} style={styles.serviceItem}>
                  <Ionicons
                    name={service.included ? 'checkmark-circle' : 'close-circle'}
                    size={18}
                    color={service.included ? Palette.success : SemanticColors.textSecondary}
                  />
                  <View style={styles.serviceInfo}>
                    <Text style={styles.serviceName}>{service.name}</Text>
                    <Text style={styles.serviceDescription}>{service.description}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Apparatuur</Text>
              {selectedContract.equipment.map((eq, i) => (
                <View key={i} style={styles.equipmentItem}>
                  <View style={styles.equipmentIcon}>
                    <Ionicons name="hardware-chip" size={20} color={SemanticColors.actionPrimary} />
                  </View>
                  <View style={styles.equipmentInfo}>
                    <Text style={styles.equipmentName}>{eq.name}</Text>
                    <Text style={styles.equipmentMeta}>{eq.brand} {eq.model}</Text>
                    <Text style={styles.equipmentLocation}>{eq.location}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.primaryAction}>
                <Ionicons name="calendar" size={20} color={Palette.white} />
                <Text style={styles.primaryActionText}>Bezoek Plannen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryAction}>
                <Ionicons name="document-text" size={20} color={SemanticColors.actionPrimary} />
                <Text style={styles.secondaryActionText}>Factuur Maken</Text>
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
        <Text style={styles.title}>Service Contracten</Text>
        <Text style={styles.subtitle}>Terugkerende onderhoudscontracten</Text>
      </View>

      {renderStatsBar()}

      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.activeTab]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={activeTab === tab.id ? SemanticColors.actionPrimary : SemanticColors.textSecondary}
            />
            <Text style={[styles.tabLabel, activeTab === tab.id && styles.activeTabLabel]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'contracts' && renderContractsTab()}
      {activeTab === 'renewals' && renderRenewalsTab()}
      {activeTab === 'visits' && renderVisitsTab()}

      {renderContractModal()}
    </View>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: Palette.success,
    pending: Palette.warning,
    expired: Palette.error,
    cancelled: SemanticColors.textSecondary,
  };
  return colors[status] || SemanticColors.textSecondary;
}

function getStatusName(status: string): string {
  const names: Record<string, string> = {
    active: 'Actief',
    pending: 'In behandeling',
    expired: 'Verlopen',
    cancelled: 'Geannuleerd',
  };
  return names[status] || status;
}

function getTypeName(type: string): string {
  const names: Record<string, string> = {
    cv_maintenance: 'CV Onderhoud',
    airco_maintenance: 'Airco Onderhoud',
    heat_pump_maintenance: 'Warmtepomp Onderhoud',
    full_service: 'Full Service',
    custom: 'Maatwerk',
  };
  return names[type] || type;
}

function getSlaName(level: string): string {
  const names: Record<string, string> = {
    basic: 'Basis',
    standard: 'Standaard',
    premium: 'Premium',
  };
  return names[level] || level;
}

function getSlaColor(level: string): string {
  const colors: Record<string, string> = {
    basic: SemanticColors.textSecondary,
    standard: SemanticColors.actionPrimary,
    premium: Palette.warning,
  };
  return colors[level] || SemanticColors.textSecondary;
}

function getVisitTypeName(type: string): string {
  const names: Record<string, string> = {
    maintenance: 'Onderhoud',
    inspection: 'Inspectie',
    repair: 'Reparatie',
  };
  return names[type] || type;
}

function getVisitTypeColor(type: string): string {
  const colors: Record<string, string> = {
    maintenance: SemanticColors.actionPrimary,
    inspection: Palette.info,
    repair: Palette.warning,
  };
  return colors[type] || SemanticColors.textSecondary;
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SemanticColors.surfaceBackground },
  header: { padding: 20, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '700', color: SemanticColors.text },
  subtitle: { fontSize: 14, color: SemanticColors.textSecondary, marginTop: 4 },
  statsBar: { maxHeight: 80 },
  statsBarContent: { paddingHorizontal: 20, gap: 12 },
  statItem: { backgroundColor: SemanticColors.surfacePrimary, padding: 12, borderRadius: 12, minWidth: 80, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700', color: SemanticColors.text },
  statLabel: { fontSize: 11, color: SemanticColors.textSecondary, marginTop: 2 },
  warningValue: { color: Palette.warning },
  tabBar: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: SemanticColors.surfacePrimary, gap: 4 },
  activeTab: { backgroundColor: SemanticColors.actionPrimary + '15' },
  tabLabel: { fontSize: 12, color: SemanticColors.textSecondary, fontWeight: '500' },
  activeTabLabel: { color: SemanticColors.actionPrimary },
  tabContent: { flex: 1, paddingHorizontal: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: SemanticColors.text },
  sectionSubtitle: { fontSize: 14, color: SemanticColors.textSecondary },
  sectionLink: { fontSize: 14, color: SemanticColors.actionPrimary, fontWeight: '500' },
  revenueCard: { backgroundColor: SemanticColors.actionPrimary + '15', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 20 },
  revenueTitle: { fontSize: 14, color: SemanticColors.textSecondary },
  revenueValue: { fontSize: 36, fontWeight: '700', color: SemanticColors.actionPrimary, marginTop: 8 },
  revenueSubtitle: { fontSize: 14, color: SemanticColors.text, marginTop: 4 },
  chartContainer: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: 16, padding: 16, marginBottom: 20 },
  chartBars: { flexDirection: 'row', justifyContent: 'space-between', height: 100, alignItems: 'flex-end' },
  chartBarContainer: { alignItems: 'center', flex: 1 },
  chartBar: { width: 24, backgroundColor: SemanticColors.actionPrimary, borderRadius: 4, minHeight: 10 },
  chartLabel: { fontSize: 10, color: SemanticColors.textSecondary, marginTop: 6 },
  templateCard: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: 14, padding: 14, marginBottom: 10 },
  templateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  templateInfo: { flex: 1 },
  templateName: { fontSize: 16, fontWeight: '600', color: SemanticColors.text },
  templateDescription: { fontSize: 13, color: SemanticColors.textSecondary, marginTop: 2 },
  templatePrice: { alignItems: 'flex-end' },
  templatePriceValue: { fontSize: 20, fontWeight: '700', color: SemanticColors.actionPrimary },
  templatePriceLabel: { fontSize: 12, color: SemanticColors.textSecondary },
  templateServices: { marginTop: 10, gap: 4 },
  templateService: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  templateServiceText: { fontSize: 13, color: SemanticColors.text },
  slaBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 10 },
  slaText: { fontSize: 11, fontWeight: '500' },
  visitCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: SemanticColors.surfacePrimary, borderRadius: 12, padding: 14, marginBottom: 10 },
  visitDate: { width: 50, alignItems: 'center' },
  visitDay: { fontSize: 22, fontWeight: '700', color: SemanticColors.text },
  visitMonth: { fontSize: 11, color: SemanticColors.textSecondary, textTransform: 'uppercase' },
  visitInfo: { flex: 1, marginLeft: 12 },
  visitCustomer: { fontSize: 15, fontWeight: '600', color: SemanticColors.text },
  visitType: { fontSize: 13, color: SemanticColors.actionPrimary, marginTop: 2 },
  visitTime: { fontSize: 12, color: SemanticColors.textSecondary, marginTop: 2 },
  contractCard: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: 16, padding: 16, marginBottom: 12 },
  contractHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  contractInfo: { flex: 1 },
  contractCustomer: { fontSize: 16, fontWeight: '600', color: SemanticColors.text },
  contractNumber: { fontSize: 13, color: SemanticColors.textSecondary, marginTop: 2 },
  contractStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  contractStatusText: { fontSize: 11, fontWeight: '600' },
  contractDetails: { flexDirection: 'row', marginTop: 12, gap: 16 },
  contractDetail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  contractDetailText: { fontSize: 13, color: SemanticColors.textSecondary },
  contractEquipment: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: SemanticColors.border },
  contractEquipmentLabel: { fontSize: 13, color: SemanticColors.text },
  contractExpiry: { fontSize: 12, color: SemanticColors.textSecondary },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: SemanticColors.surfacePrimary, borderRadius: 12, borderWidth: 1, borderColor: SemanticColors.actionPrimary + '40', borderStyle: 'dashed', marginBottom: 20, gap: 8 },
  addButtonText: { fontSize: 15, color: SemanticColors.actionPrimary, fontWeight: '500' },
  renewalCard: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: 16, padding: 16, marginBottom: 12 },
  renewalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  renewalInfo: { flex: 1 },
  renewalCustomer: { fontSize: 16, fontWeight: '600', color: SemanticColors.text },
  renewalContract: { fontSize: 13, color: SemanticColors.textSecondary, marginTop: 2 },
  renewalDays: { alignItems: 'center', backgroundColor: SemanticColors.surfaceBackground, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  renewalDaysValue: { fontSize: 20, fontWeight: '700', color: SemanticColors.text },
  renewalDaysLabel: { fontSize: 10, color: SemanticColors.textSecondary },
  renewalPricing: { flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: SemanticColors.border },
  priceItem: { flex: 1 },
  priceLabel: { fontSize: 11, color: SemanticColors.textSecondary },
  priceValue: { fontSize: 18, fontWeight: '600', color: SemanticColors.text, marginTop: 2 },
  priceChange: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  priceChangeText: { fontSize: 12, fontWeight: '600' },
  renewalActions: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 10 },
  sendOfferButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: SemanticColors.actionPrimary, paddingVertical: 12, borderRadius: 10, gap: 6 },
  sendOfferText: { fontSize: 15, fontWeight: '600', color: Palette.white },
  sentBadge: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  sentText: { fontSize: 14, color: Palette.success, fontWeight: '500' },
  editButton: { padding: 10, backgroundColor: SemanticColors.actionPrimary + '15', borderRadius: 10 },
  visitDetailCard: { flexDirection: 'row', backgroundColor: SemanticColors.surfacePrimary, borderRadius: 16, marginBottom: 12, overflow: 'hidden' },
  visitDetailDate: { width: 70, backgroundColor: SemanticColors.actionPrimary + '15', padding: 12, alignItems: 'center', justifyContent: 'center' },
  visitDetailDay: { fontSize: 28, fontWeight: '700', color: SemanticColors.actionPrimary },
  visitDetailMonth: { fontSize: 12, color: SemanticColors.actionPrimary, textTransform: 'uppercase' },
  visitDetailWeekday: { fontSize: 11, color: SemanticColors.textSecondary, marginTop: 2 },
  visitDetailContent: { flex: 1, padding: 14 },
  visitDetailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  visitDetailCustomer: { fontSize: 16, fontWeight: '600', color: SemanticColors.text },
  visitTypeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  visitTypeBadgeText: { fontSize: 11, fontWeight: '500' },
  visitDetailAddress: { fontSize: 13, color: SemanticColors.textSecondary, marginTop: 4 },
  visitDetailTime: { fontSize: 13, color: SemanticColors.textSecondary, marginTop: 4 },
  visitEquipment: { marginTop: 10 },
  visitEquipmentLabel: { fontSize: 12, fontWeight: '500', color: SemanticColors.textSecondary },
  visitEquipmentItem: { fontSize: 12, color: SemanticColors.text, marginTop: 2 },
  visitActions: { flexDirection: 'row', marginTop: 12, gap: 12 },
  visitActionButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  visitActionText: { fontSize: 13, color: SemanticColors.actionPrimary, fontWeight: '500' },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 15, color: SemanticColors.textSecondary, marginTop: 12 },
  modalContainer: { flex: 1, backgroundColor: SemanticColors.surfaceBackground },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: SemanticColors.border },
  modalTitle: { fontSize: 17, fontWeight: '600', color: SemanticColors.text },
  modalContent: { flex: 1, padding: 20 },
  contractProfile: { alignItems: 'center', marginBottom: 24 },
  contractProfileNumber: { fontSize: 14, color: SemanticColors.actionPrimary, fontWeight: '500' },
  contractProfileCustomer: { fontSize: 22, fontWeight: '700', color: SemanticColors.text, marginTop: 8 },
  contractProfileAddress: { fontSize: 14, color: SemanticColors.textSecondary, marginTop: 4, textAlign: 'center' },
  modalSection: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: 14, padding: 16, marginBottom: 16 },
  modalSectionTitle: { fontSize: 16, fontWeight: '600', color: SemanticColors.text, marginBottom: 12 },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: SemanticColors.border },
  modalRowLabel: { fontSize: 14, color: SemanticColors.textSecondary },
  modalRowValue: { fontSize: 14, fontWeight: '500', color: SemanticColors.text },
  serviceItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  serviceInfo: { flex: 1 },
  serviceName: { fontSize: 14, fontWeight: '500', color: SemanticColors.text },
  serviceDescription: { fontSize: 12, color: SemanticColors.textSecondary, marginTop: 2 },
  equipmentItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: SemanticColors.border },
  equipmentIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: SemanticColors.actionPrimary + '15', alignItems: 'center', justifyContent: 'center' },
  equipmentInfo: { flex: 1, marginLeft: 12 },
  equipmentName: { fontSize: 14, fontWeight: '500', color: SemanticColors.text },
  equipmentMeta: { fontSize: 12, color: SemanticColors.textSecondary },
  equipmentLocation: { fontSize: 12, color: SemanticColors.textSecondary },
  modalActions: { gap: 10 },
  primaryAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: SemanticColors.actionPrimary, paddingVertical: 14, borderRadius: 12, gap: 8 },
  primaryActionText: { fontSize: 16, fontWeight: '600', color: Palette.white },
  secondaryAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: SemanticColors.actionPrimary + '15', paddingVertical: 12, borderRadius: 12, gap: 8 },
  secondaryActionText: { fontSize: 15, fontWeight: '600', color: SemanticColors.actionPrimary },
});

export default ServiceContracts;
