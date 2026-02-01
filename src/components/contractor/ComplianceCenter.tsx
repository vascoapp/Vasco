// =============================================================================
// COMPLIANCE CENTER COMPONENT
// =============================================================================
// Comprehensive compliance and regulatory management interface
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
  useLicenses,
  useCertifications,
  useRegulatoryUpdates,
  useInsurancePolicies,
  useComplianceAlerts,
  useComplianceStats,
  useExpiryCalendar,
  License,
  Certification,
  RegulatoryUpdate,
  InsurancePolicy,
} from '../../services/complianceService';

type TabType = 'overview' | 'licenses' | 'certifications' | 'insurance' | 'regulatory';

export function ComplianceCenter() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [selectedUpdate, setSelectedUpdate] = useState<RegulatoryUpdate | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const { licenses } = useLicenses();
  const { certifications } = useCertifications();
  const { updates, markRead, toggleBookmark } = useRegulatoryUpdates();
  const { policies } = useInsurancePolicies();
  const { alerts, acknowledge } = useComplianceAlerts();
  const stats = useComplianceStats();
  const expiryCalendar = useExpiryCalendar(6);

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overzicht', icon: 'shield-checkmark' },
    { id: 'licenses', label: 'Licenties', icon: 'document-text' },
    { id: 'certifications', label: 'Certificaten', icon: 'ribbon' },
    { id: 'insurance', label: 'Verzekering', icon: 'umbrella' },
    { id: 'regulatory', label: 'Regelgeving', icon: 'newspaper' },
  ];

  const renderComplianceScore = () => (
    <View style={styles.scoreContainer}>
      <View style={styles.scoreCircle}>
        <Text style={styles.scoreValue}>{stats.complianceScore}</Text>
        <Text style={styles.scoreLabel}>%</Text>
      </View>
      <Text style={styles.scoreTitle}>Compliance Score</Text>
      <Text style={styles.scoreSubtitle}>
        {stats.complianceScore >= 90
          ? 'Uitstekend'
          : stats.complianceScore >= 70
          ? 'Goed'
          : 'Aandacht nodig'}
      </Text>
    </View>
  );

  const renderAlertsBanner = () => {
    const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged);
    if (unacknowledgedAlerts.length === 0) return null;

    const highPriorityCount = unacknowledgedAlerts.filter(
      a => a.severity === 'high' || a.severity === 'critical'
    ).length;

    return (
      <View style={[styles.alertsBanner, highPriorityCount > 0 && styles.alertsBannerUrgent]}>
        <Ionicons
          name={highPriorityCount > 0 ? 'alert-circle' : 'information-circle'}
          size={20}
          color={highPriorityCount > 0 ? Palette.error : Palette.warning}
        />
        <View style={styles.alertsInfo}>
          <Text style={styles.alertsTitle}>
            {unacknowledgedAlerts.length} {unacknowledgedAlerts.length === 1 ? 'melding' : 'meldingen'}
          </Text>
          {highPriorityCount > 0 && (
            <Text style={styles.alertsUrgent}>
              {highPriorityCount} urgent
            </Text>
          )}
        </View>
        <TouchableOpacity style={styles.alertsButton}>
          <Text style={styles.alertsButtonText}>Bekijk</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderOverviewTab = () => (
    <ScrollView style={styles.tabContent}>
      {renderComplianceScore()}
      {renderAlertsBanner()}

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Ionicons name="document-text" size={24} color={SemanticColors.primary} />
          <Text style={styles.statCardValue}>{stats.validLicenses}/{stats.totalLicenses}</Text>
          <Text style={styles.statCardLabel}>Geldige Licenties</Text>
          {stats.expiringLicenses > 0 && (
            <Text style={styles.statCardWarning}>{stats.expiringLicenses} verloopt</Text>
          )}
        </View>
        <View style={styles.statCard}>
          <Ionicons name="ribbon" size={24} color={Palette.success} />
          <Text style={styles.statCardValue}>{stats.validCertifications}/{stats.totalCertifications}</Text>
          <Text style={styles.statCardLabel}>Certificaten</Text>
          {stats.expiringCertifications > 0 && (
            <Text style={styles.statCardWarning}>{stats.expiringCertifications} verloopt</Text>
          )}
        </View>
        <View style={styles.statCard}>
          <Ionicons name="umbrella" size={24} color={Palette.info} />
          <Text style={styles.statCardValue}>{stats.activeInsurance}/{stats.totalInsurancePolicies}</Text>
          <Text style={styles.statCardLabel}>Verzekeringen</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="newspaper" size={24} color={Palette.warning} />
          <Text style={styles.statCardValue}>{stats.unreadRegulatory}</Text>
          <Text style={styles.statCardLabel}>Ongelezen Updates</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Komende Verlopen</Text>
      </View>

      {expiryCalendar.slice(0, 5).map((entry, index) => (
        <View key={index} style={styles.calendarItem}>
          <View style={styles.calendarDate}>
            <Text style={styles.calendarDay}>
              {entry.date.getDate()}
            </Text>
            <Text style={styles.calendarMonth}>
              {entry.date.toLocaleDateString('nl-NL', { month: 'short' })}
            </Text>
          </View>
          <View style={styles.calendarItems}>
            {entry.items.map((item, i) => (
              <View key={i} style={styles.calendarItemRow}>
                <Ionicons
                  name={getTypeIcon(item.type) as any}
                  size={16}
                  color={getTypeColor(item.type)}
                />
                <Text style={styles.calendarItemText}>{item.name}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}

      {expiryCalendar.length === 0 && (
        <View style={styles.emptyCalendar}>
          <Ionicons name="checkmark-circle" size={32} color={Palette.success} />
          <Text style={styles.emptyCalendarText}>Geen verlopen in de komende 6 maanden</Text>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recente Alerts</Text>
      </View>

      {alerts.slice(0, 3).map((alert) => (
        <View key={alert.id} style={styles.alertCard}>
          <View style={[styles.alertSeverity, { backgroundColor: getSeverityColor(alert.severity) }]} />
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>{alert.title}</Text>
            <Text style={styles.alertDescription}>{alert.description}</Text>
            {alert.dueDate && (
              <Text style={styles.alertDue}>
                Deadline: {alert.dueDate.toLocaleDateString('nl-NL')}
              </Text>
            )}
          </View>
          {!alert.acknowledged && (
            <TouchableOpacity
              style={styles.alertAction}
              onPress={() => acknowledge(alert.id)}
            >
              <Ionicons name="checkmark" size={20} color={SemanticColors.primary} />
            </TouchableOpacity>
          )}
        </View>
      ))}
    </ScrollView>
  );

  const renderLicensesTab = () => (
    <ScrollView style={styles.tabContent}>
      {licenses.map((license) => (
        <TouchableOpacity
          key={license.id}
          style={styles.licenseCard}
          onPress={() => {
            setSelectedLicense(license);
            setShowLicenseModal(true);
          }}
        >
          <View style={styles.licenseHeader}>
            <View style={styles.licenseInfo}>
              <Text style={styles.licenseName}>{license.name}</Text>
              <Text style={styles.licenseNumber}>{license.licenseNumber}</Text>
            </View>
            <View style={[styles.licenseStatus, { backgroundColor: getStatusColor(license.status) + '20' }]}>
              <Text style={[styles.licenseStatusText, { color: getStatusColor(license.status) }]}>
                {getStatusName(license.status)}
              </Text>
            </View>
          </View>

          <View style={styles.licenseDetails}>
            <View style={styles.licenseDetail}>
              <Ionicons name="business" size={14} color={SemanticColors.textSecondary} />
              <Text style={styles.licenseDetailText}>{license.issuingAuthority}</Text>
            </View>
            <View style={styles.licenseDetail}>
              <Ionicons name="calendar" size={14} color={SemanticColors.textSecondary} />
              <Text style={styles.licenseDetailText}>
                Verloopt: {license.expiryDate.toLocaleDateString('nl-NL')}
              </Text>
            </View>
          </View>

          {license.requiredFor.length > 0 && (
            <View style={styles.requiredFor}>
              <Text style={styles.requiredForLabel}>Nodig voor:</Text>
              <Text style={styles.requiredForText}>{license.requiredFor.join(', ')}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.addButton}>
        <Ionicons name="add-circle" size={24} color={SemanticColors.primary} />
        <Text style={styles.addButtonText}>Licentie toevoegen</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderCertificationsTab = () => {
    const companyCerts = certifications.filter(c => c.holderType === 'company');
    const employeeCerts = certifications.filter(c => c.holderType === 'employee');

    return (
      <ScrollView style={styles.tabContent}>
        {companyCerts.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Bedrijfscertificaten</Text>
            </View>
            {companyCerts.map((cert) => (
              <View key={cert.id} style={styles.certCard}>
                <View style={styles.certHeader}>
                  <View style={styles.certIcon}>
                    <Ionicons name="ribbon" size={24} color={SemanticColors.primary} />
                  </View>
                  <View style={styles.certInfo}>
                    <Text style={styles.certName}>{cert.name}</Text>
                    <Text style={styles.certIssuer}>{cert.issuingBody}</Text>
                  </View>
                  <View style={[styles.certStatus, { backgroundColor: getStatusColor(cert.status) + '20' }]}>
                    <Text style={[styles.certStatusText, { color: getStatusColor(cert.status) }]}>
                      {getStatusName(cert.status)}
                    </Text>
                  </View>
                </View>
                <View style={styles.certFooter}>
                  <Text style={styles.certExpiry}>
                    Geldig tot: {cert.expiryDate.toLocaleDateString('nl-NL')}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Medewerkercertificaten</Text>
        </View>

        {employeeCerts.map((cert) => (
          <View key={cert.id} style={styles.certCard}>
            <View style={styles.certHeader}>
              <View style={[styles.certAvatar, { backgroundColor: getCategoryColor(cert.category) + '20' }]}>
                <Text style={[styles.certAvatarText, { color: getCategoryColor(cert.category) }]}>
                  {cert.holderName.split(' ').map(n => n[0]).join('')}
                </Text>
              </View>
              <View style={styles.certInfo}>
                <Text style={styles.certName}>{cert.name}</Text>
                <Text style={styles.certHolder}>{cert.holderName}</Text>
              </View>
              <View style={[styles.certStatus, { backgroundColor: getStatusColor(cert.status) + '20' }]}>
                <Text style={[styles.certStatusText, { color: getStatusColor(cert.status) }]}>
                  {getStatusName(cert.status)}
                </Text>
              </View>
            </View>
            <View style={styles.certFooter}>
              <Text style={styles.certExpiry}>
                Geldig tot: {cert.expiryDate.toLocaleDateString('nl-NL')}
              </Text>
              <Text style={styles.certIssuerSmall}>{cert.issuingBody}</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.addButton}>
          <Ionicons name="add-circle" size={24} color={SemanticColors.primary} />
          <Text style={styles.addButtonText}>Certificaat toevoegen</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const renderInsuranceTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.insuranceSummary}>
        <Text style={styles.insuranceSummaryTitle}>Totale Dekking</Text>
        <Text style={styles.insuranceSummaryValue}>
          €{policies.reduce((sum, p) => sum + p.coverage, 0).toLocaleString('nl-NL')}
        </Text>
        <Text style={styles.insuranceSummaryPremium}>
          Maandpremie: €{policies.reduce((sum, p) => {
            if (p.premiumFrequency === 'monthly') return sum + p.premium;
            if (p.premiumFrequency === 'quarterly') return sum + p.premium / 3;
            return sum + p.premium / 12;
          }, 0).toFixed(2)}
        </Text>
      </View>

      {policies.map((policy) => (
        <View key={policy.id} style={styles.insuranceCard}>
          <View style={styles.insuranceHeader}>
            <View style={[styles.insuranceIcon, { backgroundColor: getInsuranceColor(policy.type) + '20' }]}>
              <Ionicons
                name={getInsuranceIcon(policy.type) as any}
                size={24}
                color={getInsuranceColor(policy.type)}
              />
            </View>
            <View style={styles.insuranceInfo}>
              <Text style={styles.insuranceName}>{policy.name}</Text>
              <Text style={styles.insuranceProvider}>{policy.provider}</Text>
            </View>
            <View style={[styles.insuranceStatus, { backgroundColor: getStatusColor(policy.status) + '20' }]}>
              <Text style={[styles.insuranceStatusText, { color: getStatusColor(policy.status) }]}>
                {getStatusName(policy.status)}
              </Text>
            </View>
          </View>

          <View style={styles.insuranceDetails}>
            <View style={styles.insuranceDetailItem}>
              <Text style={styles.insuranceDetailLabel}>Dekking</Text>
              <Text style={styles.insuranceDetailValue}>
                €{policy.coverage.toLocaleString('nl-NL')}
              </Text>
            </View>
            <View style={styles.insuranceDetailItem}>
              <Text style={styles.insuranceDetailLabel}>Eigen risico</Text>
              <Text style={styles.insuranceDetailValue}>
                €{policy.deductible.toLocaleString('nl-NL')}
              </Text>
            </View>
            <View style={styles.insuranceDetailItem}>
              <Text style={styles.insuranceDetailLabel}>Premie</Text>
              <Text style={styles.insuranceDetailValue}>
                €{policy.premium}/{policy.premiumFrequency === 'monthly' ? 'mnd' : policy.premiumFrequency === 'quarterly' ? 'kw' : 'jr'}
              </Text>
            </View>
          </View>

          <View style={styles.insuranceFooter}>
            <Text style={styles.insuranceExpiry}>
              Looptijd tot: {policy.endDate.toLocaleDateString('nl-NL')}
            </Text>
            {policy.autoRenew && (
              <View style={styles.autoRenewBadge}>
                <Ionicons name="refresh" size={12} color={Palette.success} />
                <Text style={styles.autoRenewText}>Auto verlenging</Text>
              </View>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );

  const renderRegulatoryTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.regulatoryFilters}>
        <TouchableOpacity style={[styles.filterChip, styles.filterChipActive]}>
          <Text style={styles.filterChipTextActive}>Alles</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterChip}>
          <Text style={styles.filterChipText}>Wetgeving</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterChip}>
          <Text style={styles.filterChipText}>Normen</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterChip}>
          <Text style={styles.filterChipText}>Subsidies</Text>
        </TouchableOpacity>
      </View>

      {updates.map((update) => (
        <TouchableOpacity
          key={update.id}
          style={[styles.updateCard, !update.read && styles.updateCardUnread]}
          onPress={() => {
            setSelectedUpdate(update);
            setShowUpdateModal(true);
            if (!update.read) markRead(update.id);
          }}
        >
          <View style={styles.updateHeader}>
            <View style={[styles.updateCategory, { backgroundColor: getCategoryUpdateColor(update.category) + '20' }]}>
              <Text style={[styles.updateCategoryText, { color: getCategoryUpdateColor(update.category) }]}>
                {getCategoryUpdateName(update.category)}
              </Text>
            </View>
            <Text style={styles.updateDate}>
              {update.publishDate.toLocaleDateString('nl-NL')}
            </Text>
          </View>

          <Text style={styles.updateTitle}>{update.title}</Text>
          <Text style={styles.updateSummary} numberOfLines={2}>
            {update.summary}
          </Text>

          <View style={styles.updateFooter}>
            <Text style={styles.updateSource}>{update.source}</Text>
            <View style={styles.updateActions}>
              {update.actionRequired && (
                <View style={styles.actionRequiredBadge}>
                  <Ionicons name="alert" size={12} color={Palette.warning} />
                  <Text style={styles.actionRequiredText}>Actie vereist</Text>
                </View>
              )}
              <TouchableOpacity onPress={() => toggleBookmark(update.id)}>
                <Ionicons
                  name={update.bookmarked ? 'bookmark' : 'bookmark-outline'}
                  size={20}
                  color={update.bookmarked ? SemanticColors.primary : SemanticColors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderLicenseModal = () => (
    <Modal
      visible={showLicenseModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowLicenseModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowLicenseModal(false)}>
            <Ionicons name="close" size={24} color={SemanticColors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Licentie Details</Text>
          <TouchableOpacity>
            <Ionicons name="create-outline" size={24} color={SemanticColors.primary} />
          </TouchableOpacity>
        </View>

        {selectedLicense && (
          <ScrollView style={styles.modalContent}>
            <View style={styles.licenseProfile}>
              <View style={[styles.licenseProfileIcon, { backgroundColor: getTypeColor('license') + '20' }]}>
                <Ionicons name="document-text" size={40} color={getTypeColor('license')} />
              </View>
              <Text style={styles.licenseProfileName}>{selectedLicense.name}</Text>
              <Text style={styles.licenseProfileNumber}>{selectedLicense.licenseNumber}</Text>
              <View style={[styles.licenseStatus, { backgroundColor: getStatusColor(selectedLicense.status) + '20' }]}>
                <Text style={[styles.licenseStatusText, { color: getStatusColor(selectedLicense.status) }]}>
                  {getStatusName(selectedLicense.status)}
                </Text>
              </View>
            </View>

            <View style={styles.detailSection}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Uitgegeven door</Text>
                <Text style={styles.detailValue}>{selectedLicense.issuingAuthority}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Uitgiftedatum</Text>
                <Text style={styles.detailValue}>
                  {selectedLicense.issueDate.toLocaleDateString('nl-NL')}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Vervaldatum</Text>
                <Text style={[
                  styles.detailValue,
                  selectedLicense.status !== 'valid' && { color: getStatusColor(selectedLicense.status) },
                ]}>
                  {selectedLicense.expiryDate.toLocaleDateString('nl-NL')}
                </Text>
              </View>
              {selectedLicense.renewalCost && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Verlengingskosten</Text>
                  <Text style={styles.detailValue}>€{selectedLicense.renewalCost}</Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Auto verlenging</Text>
                <Text style={styles.detailValue}>
                  {selectedLicense.autoRenew ? 'Ja' : 'Nee'}
                </Text>
              </View>
            </View>

            {selectedLicense.requiredFor.length > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Vereist voor</Text>
                {selectedLicense.requiredFor.map((item, i) => (
                  <View key={i} style={styles.requiredForItem}>
                    <Ionicons name="checkmark-circle" size={16} color={Palette.success} />
                    <Text style={styles.requiredForItemText}>{item}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.modalActions}>
              {selectedLicense.status === 'expiring_soon' && (
                <TouchableOpacity style={styles.primaryAction}>
                  <Ionicons name="refresh" size={20} color={Palette.white} />
                  <Text style={styles.primaryActionText}>Verlenging Starten</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.secondaryAction}>
                <Ionicons name="document-attach" size={20} color={SemanticColors.primary} />
                <Text style={styles.secondaryActionText}>Document Uploaden</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryAction}>
                <Ionicons name="share" size={20} color={SemanticColors.primary} />
                <Text style={styles.secondaryActionText}>Delen</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );

  const renderUpdateModal = () => (
    <Modal
      visible={showUpdateModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowUpdateModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowUpdateModal(false)}>
            <Ionicons name="close" size={24} color={SemanticColors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Update Details</Text>
          <TouchableOpacity onPress={() => selectedUpdate && toggleBookmark(selectedUpdate.id)}>
            <Ionicons
              name={selectedUpdate?.bookmarked ? 'bookmark' : 'bookmark-outline'}
              size={24}
              color={selectedUpdate?.bookmarked ? SemanticColors.primary : SemanticColors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {selectedUpdate && (
          <ScrollView style={styles.modalContent}>
            <View style={[styles.updateCategory, { backgroundColor: getCategoryUpdateColor(selectedUpdate.category) + '20', alignSelf: 'flex-start', marginBottom: 12 }]}>
              <Text style={[styles.updateCategoryText, { color: getCategoryUpdateColor(selectedUpdate.category) }]}>
                {getCategoryUpdateName(selectedUpdate.category)}
              </Text>
            </View>

            <Text style={styles.updateModalTitle}>{selectedUpdate.title}</Text>

            <View style={styles.updateMeta}>
              <Text style={styles.updateMetaText}>{selectedUpdate.source}</Text>
              <Text style={styles.updateMetaText}>•</Text>
              <Text style={styles.updateMetaText}>
                {selectedUpdate.publishDate.toLocaleDateString('nl-NL')}
              </Text>
            </View>

            {selectedUpdate.effectiveDate && (
              <View style={styles.effectiveDate}>
                <Ionicons name="calendar" size={16} color={SemanticColors.primary} />
                <Text style={styles.effectiveDateText}>
                  Ingangsdatum: {selectedUpdate.effectiveDate.toLocaleDateString('nl-NL')}
                </Text>
              </View>
            )}

            <Text style={styles.updateFullSummary}>{selectedUpdate.summary}</Text>

            {selectedUpdate.affectedAreas.length > 0 && (
              <View style={styles.affectedAreas}>
                <Text style={styles.affectedAreasTitle}>Betreffende gebieden:</Text>
                <View style={styles.affectedAreasTags}>
                  {selectedUpdate.affectedAreas.map((area, i) => (
                    <View key={i} style={styles.affectedAreaTag}>
                      <Text style={styles.affectedAreaTagText}>{area}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {selectedUpdate.actionRequired && (
              <View style={styles.actionRequiredSection}>
                <View style={styles.actionRequiredHeader}>
                  <Ionicons name="alert-circle" size={20} color={Palette.warning} />
                  <Text style={styles.actionRequiredTitle}>Actie Vereist</Text>
                </View>
                <Text style={styles.actionRequiredDescription}>
                  {selectedUpdate.actionDescription}
                </Text>
                {selectedUpdate.actionDeadline && (
                  <Text style={styles.actionDeadline}>
                    Deadline: {selectedUpdate.actionDeadline.toLocaleDateString('nl-NL')}
                  </Text>
                )}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Compliance Center</Text>
        <Text style={styles.subtitle}>Licenties, certificaten en regelgeving</Text>
      </View>

      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.activeTab]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Ionicons
                name={tab.icon as any}
                size={18}
                color={activeTab === tab.id ? SemanticColors.primary : SemanticColors.textSecondary}
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
        </ScrollView>
      </View>

      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'licenses' && renderLicensesTab()}
      {activeTab === 'certifications' && renderCertificationsTab()}
      {activeTab === 'insurance' && renderInsuranceTab()}
      {activeTab === 'regulatory' && renderRegulatoryTab()}

      {renderLicenseModal()}
      {renderUpdateModal()}
    </View>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function getStatusName(status: string): string {
  const names: Record<string, string> = {
    valid: 'Geldig',
    active: 'Actief',
    expiring_soon: 'Verloopt',
    expired: 'Verlopen',
    pending_renewal: 'In verlenging',
    suspended: 'Opgeschort',
    cancelled: 'Geannuleerd',
  };
  return names[status] || status;
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    valid: Palette.success,
    active: Palette.success,
    expiring_soon: Palette.warning,
    expired: Palette.error,
    pending_renewal: Palette.info,
    suspended: Palette.error,
    cancelled: SemanticColors.textSecondary,
  };
  return colors[status] || SemanticColors.textSecondary;
}

function getTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    license: 'document-text',
    certification: 'ribbon',
    insurance: 'umbrella',
  };
  return icons[type] || 'document';
}

function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    license: SemanticColors.primary,
    certification: Palette.success,
    insurance: Palette.info,
  };
  return colors[type] || SemanticColors.textSecondary;
}

function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    critical: Palette.error,
    high: Palette.error,
    medium: Palette.warning,
    low: Palette.info,
  };
  return colors[severity] || SemanticColors.textSecondary;
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    technical: SemanticColors.primary,
    safety: Palette.warning,
    environmental: Palette.success,
    quality: Palette.info,
    industry_specific: '#9B59B6',
  };
  return colors[category] || SemanticColors.textSecondary;
}

function getCategoryUpdateColor(category: string): string {
  const colors: Record<string, string> = {
    legislation: Palette.error,
    standard: SemanticColors.primary,
    guideline: Palette.success,
    industry_news: Palette.info,
  };
  return colors[category] || SemanticColors.textSecondary;
}

function getCategoryUpdateName(category: string): string {
  const names: Record<string, string> = {
    legislation: 'Wetgeving',
    standard: 'Norm',
    guideline: 'Richtlijn',
    industry_news: 'Nieuws',
  };
  return names[category] || category;
}

function getInsuranceIcon(type: string): string {
  const icons: Record<string, string> = {
    liability: 'shield',
    professional: 'briefcase',
    vehicle: 'car',
    equipment: 'construct',
    workers_comp: 'people',
    property: 'business',
  };
  return icons[type] || 'umbrella';
}

function getInsuranceColor(type: string): string {
  const colors: Record<string, string> = {
    liability: SemanticColors.primary,
    professional: Palette.info,
    vehicle: Palette.warning,
    equipment: Palette.success,
    workers_comp: '#9B59B6',
    property: '#E67E22',
  };
  return colors[type] || SemanticColors.textSecondary;
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.background,
  },
  header: {
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: SemanticColors.text,
  },
  subtitle: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  tabBar: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 8,
    borderRadius: 10,
    backgroundColor: SemanticColors.card,
    gap: 6,
  },
  activeTab: {
    backgroundColor: SemanticColors.primary + '15',
  },
  tabLabel: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    fontWeight: '500',
  },
  activeTabLabel: {
    color: SemanticColors.primary,
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scoreContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  scoreCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: SemanticColors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  scoreValue: {
    fontSize: 36,
    fontWeight: '700',
    color: SemanticColors.primary,
  },
  scoreLabel: {
    fontSize: 18,
    fontWeight: '500',
    color: SemanticColors.primary,
    marginLeft: 2,
  },
  scoreTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.text,
    marginTop: 12,
  },
  scoreSubtitle: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  alertsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: Palette.warning + '15',
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  alertsBannerUrgent: {
    backgroundColor: Palette.error + '15',
  },
  alertsInfo: {
    flex: 1,
  },
  alertsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  alertsUrgent: {
    fontSize: 13,
    color: Palette.error,
    fontWeight: '500',
  },
  alertsButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: SemanticColors.card,
    borderRadius: 8,
  },
  alertsButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.primary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: '47%',
    backgroundColor: SemanticColors.card,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  statCardValue: {
    fontSize: 24,
    fontWeight: '700',
    color: SemanticColors.text,
    marginTop: 8,
  },
  statCardLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  statCardWarning: {
    fontSize: 11,
    color: Palette.warning,
    marginTop: 4,
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
    color: SemanticColors.text,
  },
  calendarItem: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  calendarDate: {
    width: 50,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: SemanticColors.border,
    paddingRight: 12,
    marginRight: 12,
  },
  calendarDay: {
    fontSize: 22,
    fontWeight: '700',
    color: SemanticColors.text,
  },
  calendarMonth: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
  },
  calendarItems: {
    flex: 1,
    gap: 6,
  },
  calendarItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calendarItemText: {
    fontSize: 14,
    color: SemanticColors.text,
  },
  emptyCalendar: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
  },
  emptyCalendarText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginTop: 8,
  },
  alertCard: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  alertSeverity: {
    width: 4,
  },
  alertContent: {
    flex: 1,
    padding: 14,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  alertDescription: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  alertDue: {
    fontSize: 12,
    color: Palette.warning,
    marginTop: 6,
  },
  alertAction: {
    padding: 14,
    justifyContent: 'center',
  },
  licenseCard: {
    backgroundColor: SemanticColors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  licenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  licenseInfo: {
    flex: 1,
  },
  licenseName: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  licenseNumber: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  licenseStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  licenseStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  licenseDetails: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 16,
  },
  licenseDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  licenseDetailText: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  requiredFor: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.border,
  },
  requiredForLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  requiredForText: {
    fontSize: 13,
    color: SemanticColors.text,
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.primary + '40',
    borderStyle: 'dashed',
    marginBottom: 20,
    gap: 8,
  },
  addButtonText: {
    fontSize: 15,
    color: SemanticColors.primary,
    fontWeight: '500',
  },
  certCard: {
    backgroundColor: SemanticColors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  certHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  certIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SemanticColors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  certAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  certAvatarText: {
    fontSize: 14,
    fontWeight: '600',
  },
  certInfo: {
    flex: 1,
    marginLeft: 12,
  },
  certName: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  certHolder: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  certIssuer: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  certStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  certStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  certFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.border,
  },
  certExpiry: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  certIssuerSmall: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  insuranceSummary: {
    backgroundColor: SemanticColors.primary + '10',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  insuranceSummaryTitle: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  insuranceSummaryValue: {
    fontSize: 32,
    fontWeight: '700',
    color: SemanticColors.primary,
    marginTop: 4,
  },
  insuranceSummaryPremium: {
    fontSize: 14,
    color: SemanticColors.text,
    marginTop: 8,
  },
  insuranceCard: {
    backgroundColor: SemanticColors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  insuranceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  insuranceIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insuranceInfo: {
    flex: 1,
    marginLeft: 12,
  },
  insuranceName: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  insuranceProvider: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  insuranceStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  insuranceStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  insuranceDetails: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.border,
  },
  insuranceDetailItem: {
    flex: 1,
    alignItems: 'center',
  },
  insuranceDetailLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  insuranceDetailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.text,
    marginTop: 2,
  },
  insuranceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  insuranceExpiry: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  autoRenewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  autoRenewText: {
    fontSize: 11,
    color: Palette.success,
    fontWeight: '500',
  },
  regulatoryFilters: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: SemanticColors.card,
    borderRadius: 16,
  },
  filterChipActive: {
    backgroundColor: SemanticColors.primary,
  },
  filterChipText: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  filterChipTextActive: {
    fontSize: 13,
    color: Palette.white,
    fontWeight: '500',
  },
  updateCard: {
    backgroundColor: SemanticColors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  updateCardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: SemanticColors.primary,
  },
  updateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  updateCategory: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  updateCategoryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  updateDate: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  updateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.text,
    marginBottom: 6,
  },
  updateSummary: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    lineHeight: 20,
  },
  updateFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  updateSource: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  updateActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionRequiredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Palette.warning + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  actionRequiredText: {
    fontSize: 11,
    color: Palette.warning,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: SemanticColors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  licenseProfile: {
    alignItems: 'center',
    marginBottom: 24,
  },
  licenseProfileIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  licenseProfileName: {
    fontSize: 22,
    fontWeight: '700',
    color: SemanticColors.text,
    textAlign: 'center',
  },
  licenseProfileNumber: {
    fontSize: 15,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  detailSection: {
    backgroundColor: SemanticColors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.text,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.border,
  },
  detailLabel: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: SemanticColors.text,
  },
  requiredForItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  requiredForItemText: {
    fontSize: 14,
    color: SemanticColors.text,
  },
  modalActions: {
    gap: 10,
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.primary,
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
    backgroundColor: SemanticColors.primary + '15',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  secondaryActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.primary,
  },
  updateModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: SemanticColors.text,
    marginBottom: 8,
  },
  updateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  updateMetaText: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  effectiveDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SemanticColors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  effectiveDateText: {
    fontSize: 14,
    color: SemanticColors.primary,
    fontWeight: '500',
  },
  updateFullSummary: {
    fontSize: 15,
    color: SemanticColors.text,
    lineHeight: 24,
    marginBottom: 20,
  },
  affectedAreas: {
    marginBottom: 20,
  },
  affectedAreasTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.text,
    marginBottom: 10,
  },
  affectedAreasTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  affectedAreaTag: {
    backgroundColor: SemanticColors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  affectedAreaTagText: {
    fontSize: 13,
    color: SemanticColors.text,
  },
  actionRequiredSection: {
    backgroundColor: Palette.warning + '15',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Palette.warning + '40',
  },
  actionRequiredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  actionRequiredTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Palette.warning,
  },
  actionRequiredDescription: {
    fontSize: 14,
    color: SemanticColors.text,
    lineHeight: 22,
  },
  actionDeadline: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.error,
    marginTop: 10,
  },
});

export default ComplianceCenter;
