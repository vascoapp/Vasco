// =============================================================================
// COMPLIANCE CENTER COMPONENT
// =============================================================================
// Comprehensive compliance and regulatory management interface
// =============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { scan as runComplianceScan, getLastRun, type ComplianceScanResult } from '../../services/complianceAgentService';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { formatCurrency } from '../../i18n/formatting';
import { useTranslation } from 'react-i18next';
import {
  useLicenses,
  useCertifications,
  useRegulatoryUpdates,
  useInsurancePolicies,
  useComplianceAlerts,
  useComplianceStats,
  useExpiryCalendar,
  useTradeRequirements,
  License,
  Certification,
  RegulatoryUpdate,
  InsurancePolicy,
} from '../../services/complianceService';
import type { TradeCompliance } from '../../domain/complianceKnowledge';

type TabType = 'overview' | 'licenses' | 'certifications' | 'insurance' | 'regulatory' | 'requirements';

export function ComplianceCenter() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [selectedUpdate, setSelectedUpdate] = useState<RegulatoryUpdate | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [expandedReqId, setExpandedReqId] = useState<string | null>(null);

  const { licenses } = useLicenses();
  const { certifications } = useCertifications();
  const { updates, markRead, toggleBookmark } = useRegulatoryUpdates();
  const { policies } = useInsurancePolicies();
  const { alerts, acknowledge } = useComplianceAlerts();
  const stats = useComplianceStats();
  const expiryCalendar = useExpiryCalendar(6);
  const { trades, getTradeCompliance, registryChecks } = useTradeRequirements('NL');

  const selectedTrade: TradeCompliance | undefined = selectedTradeId
    ? getTradeCompliance(selectedTradeId)
    : undefined;

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'overview', label: t('compliance.overview', 'Overview'), icon: 'shield-checkmark' },
    { id: 'licenses', label: t('compliance.licenses', 'Licenses'), icon: 'document-text' },
    { id: 'certifications', label: t('compliance.certifications', 'Certifications'), icon: 'ribbon' },
    { id: 'insurance', label: t('compliance.insurance', 'Insurance'), icon: 'umbrella' },
    { id: 'regulatory', label: t('compliance.regulatory', 'Regulatory'), icon: 'newspaper' },
    { id: 'requirements', label: 'Vakvereisten', icon: 'construct' },
  ];

  // Compliance-agent scan state — last-run + one-tap "Scan now"
  const [lastScanAt, setLastScanAt] = useState<Date | null>(null);
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<ComplianceScanResult | null>(null);

  useEffect(() => {
    getLastRun().then(setLastScanAt).catch(() => {});
  }, []);

  const handleScanNow = useCallback(async () => {
    setScanning(true);
    try {
      const result = await runComplianceScan({ force: true });
      setLastResult(result);
      setLastScanAt(new Date(result.ranAt));
    } finally {
      setScanning(false);
    }
  }, []);

  const formatLastScan = (d: Date | null): string => {
    if (!d) return t('compliance.neverScanned', 'Never scanned');
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return t('compliance.scannedJustNow', 'Scanned just now');
    if (mins < 60) return t('compliance.scannedMinAgo', { defaultValue: 'Scanned {{min}} min ago', min: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('compliance.scannedHoursAgo', { defaultValue: 'Scanned {{h}}h ago', h: hours });
    return t('compliance.scannedDaysAgo', { defaultValue: 'Scanned {{d}} days ago', d: Math.floor(hours / 24) });
  };

  const renderScanCard = () => (
    <View style={styles.scanCard}>
      <View style={styles.scanInfo}>
        <Ionicons name="scan-outline" size={18} color={Palette.hermesOrange} />
        <View style={{ flex: 1 }}>
          <Text style={styles.scanTitle}>{t('compliance.agent', 'Compliance agent')}</Text>
          <Text style={styles.scanSubtitle}>
            {formatLastScan(lastScanAt)}
            {lastResult
              ? ` · ${t('compliance.scanSummary', { defaultValue: '{{alerts}} new alert, {{atRisk}} at risk', count: lastResult.alertsAdded, alerts: lastResult.alertsAdded, atRisk: lastResult.itemsAtRisk })}`
              : ''}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={handleScanNow}
        disabled={scanning}
        style={[styles.scanBtn, scanning && { opacity: 0.6 }]}
        accessibilityRole="button"
        accessibilityLabel={t('compliance.scanNow', 'Scan now')}
      >
        {scanning
          ? <ActivityIndicator size="small" color={Palette.white} />
          : <Ionicons name="refresh" size={16} color={Palette.white} />}
        <Text style={styles.scanBtnText}>
          {scanning ? t('compliance.scanning', 'Scanning…') : t('compliance.scanNow', 'Scan now')}
        </Text>
      </Pressable>
    </View>
  );

  const renderComplianceScore = () => (
    <View style={styles.scoreContainer}>
      <View style={styles.scoreCircle}>
        <Text style={styles.scoreValue}>{stats.complianceScore}</Text>
        <Text style={styles.scoreLabel}>%</Text>
      </View>
      <Text style={styles.scoreTitle}>Compliance Score</Text>
      <Text style={styles.scoreSubtitle}>
        {stats.complianceScore >= 90
          ? t('compliance.excellent', 'Excellent')
          : stats.complianceScore >= 70
          ? t('compliance.good', 'Good')
          : t('compliance.needsAttention', 'Needs attention')}
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
          color={highPriorityCount > 0 ? SemanticColors.feedbackError : SemanticColors.feedbackWarning}
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
        <Pressable style={styles.alertsButton}>
          <Text style={styles.alertsButtonText}>Bekijk</Text>
        </Pressable>
      </View>
    );
  };

  const renderOverviewTab = () => (
    <ScrollView style={styles.tabContent}>
      {renderScanCard()}
      {renderComplianceScore()}
      {renderAlertsBanner()}

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Ionicons name="document-text" size={24} color={SemanticColors.actionPrimary} />
          <Text style={styles.statCardValue}>{stats.validLicenses}/{stats.totalLicenses}</Text>
          <Text style={styles.statCardLabel}>Geldige Licenties</Text>
          {stats.expiringLicenses > 0 && (
            <Text style={styles.statCardWarning}>{stats.expiringLicenses} verloopt</Text>
          )}
        </View>
        <View style={styles.statCard}>
          <Ionicons name="ribbon" size={24} color={SemanticColors.feedbackSuccess} />
          <Text style={styles.statCardValue}>{stats.validCertifications}/{stats.totalCertifications}</Text>
          <Text style={styles.statCardLabel}>Certificaten</Text>
          {stats.expiringCertifications > 0 && (
            <Text style={styles.statCardWarning}>{stats.expiringCertifications} verloopt</Text>
          )}
        </View>
        <View style={styles.statCard}>
          <Ionicons name="umbrella" size={24} color={SemanticColors.feedbackInfo} />
          <Text style={styles.statCardValue}>{stats.activeInsurance}/{stats.totalInsurancePolicies}</Text>
          <Text style={styles.statCardLabel}>Verzekeringen</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="newspaper" size={24} color={SemanticColors.feedbackWarning} />
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
              {entry.date.toLocaleDateString(undefined, { month: 'short' })}
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
          <Ionicons name="checkmark-circle" size={32} color={SemanticColors.feedbackSuccess} />
          <Text style={styles.emptyCalendarText}>{t('compliance.noExpirations', 'No expirations in the next 6 months')}</Text>
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
                Deadline: {alert.dueDate.toLocaleDateString(undefined)}
              </Text>
            )}
          </View>
          {!alert.acknowledged && (
            <Pressable
              style={styles.alertAction}
              onPress={() => acknowledge(alert.id)}
            >
              <Ionicons name="checkmark" size={20} color={SemanticColors.actionPrimary} />
            </Pressable>
          )}
        </View>
      ))}
    </ScrollView>
  );

  const renderLicensesTab = () => (
    <ScrollView style={styles.tabContent}>
      {licenses.map((license) => (
        <Pressable
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
                Verloopt: {license.expiryDate.toLocaleDateString(undefined)}
              </Text>
            </View>
          </View>

          {license.requiredFor.length > 0 && (
            <View style={styles.requiredFor}>
              <Text style={styles.requiredForLabel}>Nodig voor:</Text>
              <Text style={styles.requiredForText}>{license.requiredFor.join(', ')}</Text>
            </View>
          )}
        </Pressable>
      ))}

      <Pressable style={styles.addButton}>
        <Ionicons name="add-circle" size={24} color={SemanticColors.actionPrimary} />
        <Text style={styles.addButtonText}>Licentie toevoegen</Text>
      </Pressable>
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
                    <Ionicons name="ribbon" size={24} color={SemanticColors.actionPrimary} />
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
                    Geldig tot: {cert.expiryDate.toLocaleDateString(undefined)}
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
                Geldig tot: {cert.expiryDate.toLocaleDateString(undefined)}
              </Text>
              <Text style={styles.certIssuerSmall}>{cert.issuingBody}</Text>
            </View>
          </View>
        ))}

        <Pressable style={styles.addButton}>
          <Ionicons name="add-circle" size={24} color={SemanticColors.actionPrimary} />
          <Text style={styles.addButtonText}>Certificaat toevoegen</Text>
        </Pressable>
      </ScrollView>
    );
  };

  const renderInsuranceTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.insuranceSummary}>
        <Text style={styles.insuranceSummaryTitle}>Totale Dekking</Text>
        <Text style={styles.insuranceSummaryValue}>
          {formatCurrency(policies.reduce((sum, p) => sum + p.coverage, 0))}
        </Text>
        <Text style={styles.insuranceSummaryPremium}>
          Maandpremie: {formatCurrency(policies.reduce((sum, p) => {
            if (p.premiumFrequency === 'monthly') return sum + p.premium;
            if (p.premiumFrequency === 'quarterly') return sum + p.premium / 3;
            return sum + p.premium / 12;
          }, 0))}
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
                {formatCurrency(policy.coverage)}
              </Text>
            </View>
            <View style={styles.insuranceDetailItem}>
              <Text style={styles.insuranceDetailLabel}>Eigen risico</Text>
              <Text style={styles.insuranceDetailValue}>
                {formatCurrency(policy.deductible)}
              </Text>
            </View>
            <View style={styles.insuranceDetailItem}>
              <Text style={styles.insuranceDetailLabel}>Premie</Text>
              <Text style={styles.insuranceDetailValue}>
                {formatCurrency(policy.premium)}/{policy.premiumFrequency === 'monthly' ? 'mnd' : policy.premiumFrequency === 'quarterly' ? 'kw' : 'jr'}
              </Text>
            </View>
          </View>

          <View style={styles.insuranceFooter}>
            <Text style={styles.insuranceExpiry}>
              Looptijd tot: {policy.endDate.toLocaleDateString(undefined)}
            </Text>
            {policy.autoRenew && (
              <View style={styles.autoRenewBadge}>
                <Ionicons name="refresh" size={12} color={SemanticColors.feedbackSuccess} />
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
        <Pressable style={[styles.filterChip, styles.filterChipActive]}>
          <Text style={styles.filterChipTextActive}>Alles</Text>
        </Pressable>
        <Pressable style={styles.filterChip}>
          <Text style={styles.filterChipText}>Wetgeving</Text>
        </Pressable>
        <Pressable style={styles.filterChip}>
          <Text style={styles.filterChipText}>Normen</Text>
        </Pressable>
        <Pressable style={styles.filterChip}>
          <Text style={styles.filterChipText}>Subsidies</Text>
        </Pressable>
      </View>

      {updates.map((update) => (
        <Pressable
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
              {update.publishDate.toLocaleDateString(undefined)}
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
                  <Ionicons name="alert" size={12} color={SemanticColors.feedbackWarning} />
                  <Text style={styles.actionRequiredText}>Actie vereist</Text>
                </View>
              )}
              <Pressable onPress={() => toggleBookmark(update.id)}>
                <Ionicons
                  name={update.bookmarked ? 'bookmark' : 'bookmark-outline'}
                  size={20}
                  color={update.bookmarked ? SemanticColors.actionPrimary : SemanticColors.textSecondary}
                />
              </Pressable>
            </View>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );

  const renderRequirementsTab = () => (
    <ScrollView style={styles.tabContent}>
      {/* Trade picker chips */}
      <View style={styles.tradePickerRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {trades.map((t) => (
            <Pressable
              key={t.tradeId}
              style={[
                styles.tradeChip,
                selectedTradeId === t.tradeId && styles.tradeChipActive,
              ]}
              onPress={() =>
                setSelectedTradeId(selectedTradeId === t.tradeId ? null : t.tradeId)
              }
            >
              <Text
                style={[
                  styles.tradeChipText,
                  selectedTradeId === t.tradeId && styles.tradeChipTextActive,
                ]}
              >
                {t.localizedLabel || t.tradeLabel}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {!selectedTrade && (
        <View style={styles.emptyTrade}>
          <Ionicons name="construct" size={40} color={SemanticColors.textSecondary} />
          <Text style={styles.emptyTradeTitle}>Kies een vakgebied</Text>
          <Text style={styles.emptyTradeSubtitle}>
            Selecteer hierboven een vak om de vereisten, bewijsstukken en checklists te bekijken.
          </Text>
        </View>
      )}

      {selectedTrade && (
        <>
          {/* Requirements */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Vereisten</Text>
            <Text style={styles.reqCount}>
              {selectedTrade.requirements.length}
            </Text>
          </View>

          {selectedTrade.requirements.map((req) => {
            const isExpanded = expandedReqId === req.id;
            const nlTitle = req.titleLocalizations?.nl || req.title;
            const nlDesc = req.descriptionLocalizations?.nl || req.description;
            const nlNotes = req.applicabilityNotesLocalizations?.nl || req.applicabilityNotes;

            return (
              <Pressable
                key={req.id}
                style={styles.reqCard}
                onPress={() => setExpandedReqId(isExpanded ? null : req.id)}
              >
                <View style={styles.reqHeader}>
                  <View style={[styles.reqLevelBadge, { backgroundColor: getReqLevelColor(req.level) + '20' }]}>
                    <Text style={[styles.reqLevelText, { color: getReqLevelColor(req.level) }]}>
                      {getReqLevelName(req.level)}
                    </Text>
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={SemanticColors.textSecondary}
                  />
                </View>
                <Text style={styles.reqTitle}>{nlTitle}</Text>
                {isExpanded && (
                  <>
                    <Text style={styles.reqDescription}>{nlDesc}</Text>
                    {nlNotes && (
                      <View style={styles.reqNotesBox}>
                        <Ionicons name="information-circle" size={14} color={SemanticColors.feedbackInfo} />
                        <Text style={styles.reqNotesText}>{nlNotes}</Text>
                      </View>
                    )}
                  </>
                )}
              </Pressable>
            );
          })}

          {/* Evidence */}
          {selectedTrade.evidence.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Bewijsstukken</Text>
              </View>
              {selectedTrade.evidence.map((ev) => {
                const nlLabel = ev.labelLocalizations?.nl || ev.label;
                const nlDesc = ev.descriptionLocalizations?.nl || ev.description;
                return (
                  <View key={ev.id} style={styles.evidenceCard}>
                    <View style={styles.evidenceHeader}>
                      <Ionicons
                        name={ev.required ? 'document-attach' : 'document-outline'}
                        size={20}
                        color={ev.required ? SemanticColors.actionPrimary : SemanticColors.textSecondary}
                      />
                      <Text style={styles.evidenceLabel}>{nlLabel}</Text>
                      {ev.required && (
                        <View style={styles.requiredBadge}>
                          <Text style={styles.requiredBadgeText}>Verplicht</Text>
                        </View>
                      )}
                    </View>
                    {nlDesc && <Text style={styles.evidenceDesc}>{nlDesc}</Text>}
                  </View>
                );
              })}
            </>
          )}

          {/* Checklists */}
          {selectedTrade.checklists.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Checklist</Text>
              </View>
              {selectedTrade.checklists.map((item) => {
                const nlLabel = item.labelLocalizations?.nl || item.label;
                return (
                  <View key={item.id} style={styles.checklistRow}>
                    <Ionicons
                      name={item.required ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={item.required ? SemanticColors.actionPrimary : SemanticColors.textSecondary}
                    />
                    <Text style={styles.checklistLabel}>{nlLabel}</Text>
                  </View>
                );
              })}
            </>
          )}

          {/* Registry checks */}
          {registryChecks.length > 0 && (
            <>
              <View style={[styles.sectionHeader, { marginTop: 20 }]}>
                <Text style={styles.sectionTitle}>Registercontroles</Text>
              </View>
              {registryChecks.map((rc) => {
                const nlLabel = rc.labelLocalizations?.nl || rc.label;
                const nlDesc = rc.descriptionLocalizations?.nl || rc.description;
                return (
                  <View key={rc.id} style={styles.registryCard}>
                    <View style={styles.registryHeader}>
                      <Ionicons name="search" size={18} color={SemanticColors.actionPrimary} />
                      <Text style={styles.registryLabel}>{nlLabel}</Text>
                    </View>
                    <Text style={styles.registryDesc}>{nlDesc}</Text>
                    <View style={styles.registryFields}>
                      {rc.inputs.map((input) => (
                        <Text key={input.key} style={styles.registryField}>
                          {input.labelLocalizations?.nl || input.label}
                          {input.required ? ' *' : ''}
                        </Text>
                      ))}
                    </View>
                  </View>
                );
              })}
            </>
          )}

          <View style={{ height: 40 }} />
        </>
      )}
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
          <Pressable onPress={() => setShowLicenseModal(false)}>
            <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
          </Pressable>
          <Text style={styles.modalTitle}>Licentie Details</Text>
          <Pressable>
            <Ionicons name="create-outline" size={24} color={SemanticColors.actionPrimary} />
          </Pressable>
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
                  {selectedLicense.issueDate.toLocaleDateString(undefined)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Vervaldatum</Text>
                <Text style={[
                  styles.detailValue,
                  selectedLicense.status !== 'valid' && { color: getStatusColor(selectedLicense.status) },
                ]}>
                  {selectedLicense.expiryDate.toLocaleDateString(undefined)}
                </Text>
              </View>
              {selectedLicense.renewalCost && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Verlengingskosten</Text>
                  <Text style={styles.detailValue}>{formatCurrency(selectedLicense.renewalCost)}</Text>
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
                    <Ionicons name="checkmark-circle" size={16} color={SemanticColors.feedbackSuccess} />
                    <Text style={styles.requiredForItemText}>{item}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.modalActions}>
              {selectedLicense.status === 'expiring_soon' && (
                <Pressable style={styles.primaryAction}>
                  <Ionicons name="refresh" size={20} color={Palette.white} />
                  <Text style={styles.primaryActionText}>Verlenging Starten</Text>
                </Pressable>
              )}
              <Pressable style={styles.secondaryAction}>
                <Ionicons name="document-attach" size={20} color={SemanticColors.actionPrimary} />
                <Text style={styles.secondaryActionText}>Document Uploaden</Text>
              </Pressable>
              <Pressable style={styles.secondaryAction}>
                <Ionicons name="share" size={20} color={SemanticColors.actionPrimary} />
                <Text style={styles.secondaryActionText}>Delen</Text>
              </Pressable>
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
          <Pressable onPress={() => setShowUpdateModal(false)}>
            <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
          </Pressable>
          <Text style={styles.modalTitle}>Update Details</Text>
          <Pressable onPress={() => selectedUpdate && toggleBookmark(selectedUpdate.id)}>
            <Ionicons
              name={selectedUpdate?.bookmarked ? 'bookmark' : 'bookmark-outline'}
              size={24}
              color={selectedUpdate?.bookmarked ? SemanticColors.actionPrimary : SemanticColors.textSecondary}
            />
          </Pressable>
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
                {selectedUpdate.publishDate.toLocaleDateString(undefined)}
              </Text>
            </View>

            {selectedUpdate.effectiveDate && (
              <View style={styles.effectiveDate}>
                <Ionicons name="calendar" size={16} color={SemanticColors.actionPrimary} />
                <Text style={styles.effectiveDateText}>
                  Ingangsdatum: {selectedUpdate.effectiveDate.toLocaleDateString(undefined)}
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
                  <Ionicons name="alert-circle" size={20} color={SemanticColors.feedbackWarning} />
                  <Text style={styles.actionRequiredTitle}>Actie Vereist</Text>
                </View>
                <Text style={styles.actionRequiredDescription}>
                  {selectedUpdate.actionDescription}
                </Text>
                {selectedUpdate.actionDeadline && (
                  <Text style={styles.actionDeadline}>
                    Deadline: {selectedUpdate.actionDeadline.toLocaleDateString(undefined)}
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
            <Pressable
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.activeTab]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Ionicons
                name={tab.icon as any}
                size={18}
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
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'licenses' && renderLicensesTab()}
      {activeTab === 'certifications' && renderCertificationsTab()}
      {activeTab === 'insurance' && renderInsuranceTab()}
      {activeTab === 'regulatory' && renderRegulatoryTab()}
      {activeTab === 'requirements' && renderRequirementsTab()}

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
    valid: 'Valid',
    active: 'Active',
    expiring_soon: 'Expiring',
    expired: 'Expired',
    pending_renewal: 'Pending renewal',
    suspended: 'Suspended',
    cancelled: 'Cancelled',
  };
  return names[status] || status;
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    valid: SemanticColors.feedbackSuccess,
    active: SemanticColors.feedbackSuccess,
    expiring_soon: SemanticColors.feedbackWarning,
    expired: SemanticColors.feedbackError,
    pending_renewal: SemanticColors.feedbackInfo,
    suspended: SemanticColors.feedbackError,
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
    license: SemanticColors.actionPrimary,
    certification: SemanticColors.feedbackSuccess,
    insurance: SemanticColors.feedbackInfo,
  };
  return colors[type] || SemanticColors.textSecondary;
}

function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    critical: SemanticColors.feedbackError,
    high: SemanticColors.feedbackError,
    medium: SemanticColors.feedbackWarning,
    low: SemanticColors.feedbackInfo,
  };
  return colors[severity] || SemanticColors.textSecondary;
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    technical: SemanticColors.actionPrimary,
    safety: SemanticColors.feedbackWarning,
    environmental: SemanticColors.feedbackSuccess,
    quality: SemanticColors.feedbackInfo,
    industry_specific: '#9B59B6',
  };
  return colors[category] || SemanticColors.textSecondary;
}

function getCategoryUpdateColor(category: string): string {
  const colors: Record<string, string> = {
    legislation: SemanticColors.feedbackError,
    standard: SemanticColors.actionPrimary,
    guideline: SemanticColors.feedbackSuccess,
    industry_news: SemanticColors.feedbackInfo,
  };
  return colors[category] || SemanticColors.textSecondary;
}

function getCategoryUpdateName(category: string): string {
  const names: Record<string, string> = {
    legislation: 'Legislation',
    standard: 'Standard',
    guideline: 'Guideline',
    industry_news: 'Industry news',
  };
  return names[category] || category;
}

function getReqLevelColor(level: string): string {
  const colors: Record<string, string> = {
    mandatory: SemanticColors.feedbackError,
    recommended: SemanticColors.feedbackWarning,
    optional: SemanticColors.feedbackInfo,
  };
  return colors[level] || SemanticColors.textSecondary;
}

function getReqLevelName(level: string): string {
  const names: Record<string, string> = {
    mandatory: 'Verplicht',
    recommended: 'Aanbevolen',
    optional: 'Optioneel',
  };
  return names[level] || level;
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
    liability: SemanticColors.actionPrimary,
    professional: SemanticColors.feedbackInfo,
    vehicle: SemanticColors.feedbackWarning,
    equipment: SemanticColors.feedbackSuccess,
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
    backgroundColor: SemanticColors.surfaceBackground,
  },
  header: {
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: TYPE.displaySize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  subtitle: {
    fontSize: TYPE.bodySize - 1,
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
    borderRadius: RADIUS.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    gap: 6,
  },
  activeTab: {
    backgroundColor: SemanticColors.actionPrimary + '15',
  },
  tabLabel: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    fontFamily: TYPE.labelFamily,
  },
  activeTabLabel: {
    color: SemanticColors.actionPrimary,
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
    backgroundColor: SemanticColors.actionPrimary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  scoreValue: {
    fontSize: 36,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.actionPrimary,
  },
  scoreLabel: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.actionPrimary,
    marginLeft: 2,
  },
  scoreTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    marginTop: 12,
  },
  scoreSubtitle: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  alertsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: SemanticColors.feedbackWarning + '15',
    borderRadius: RADIUS.md,
    marginBottom: 16,
    gap: 12,
  },
  alertsBannerUrgent: {
    backgroundColor: SemanticColors.feedbackError + '15',
  },
  alertsInfo: {
    flex: 1,
  },
  alertsTitle: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  alertsUrgent: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.feedbackError,
    fontFamily: TYPE.labelFamily,
  },
  alertsButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.sm,
  },
  alertsButtonText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.actionPrimary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: '47%',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 16,
    alignItems: 'center',
  },
  statCardValue: {
    fontSize: TYPE.displaySize - 4,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    marginTop: 8,
  },
  statCardLabel: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  statCardWarning: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.feedbackWarning,
    marginTop: 4,
    fontFamily: TYPE.labelFamily,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  calendarItem: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 10,
  },
  calendarDate: {
    width: 50,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: SemanticColors.borderDefault,
    paddingRight: 12,
    marginRight: 12,
  },
  calendarDay: {
    fontSize: TYPE.displaySize - 6,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  calendarMonth: {
    fontSize: TYPE.labelSize,
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
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textPrimary,
  },
  emptyCalendar: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
  },
  emptyCalendarText: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
    marginTop: 8,
  },
  alertCard: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
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
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  alertDescription: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  alertDue: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.feedbackWarning,
    marginTop: 6,
  },
  alertAction: {
    padding: 14,
    justifyContent: 'center',
  },
  licenseCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
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
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  licenseNumber: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  licenseStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.md,
  },
  licenseStatusText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
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
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
  },
  requiredFor: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  requiredForLabel: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },
  requiredForText: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textPrimary,
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SemanticColors.actionPrimary + '40',
    borderStyle: 'dashed',
    marginBottom: 20,
    gap: 8,
  },
  addButtonText: {
    fontSize: TYPE.bodySize,
    color: SemanticColors.actionPrimary,
    fontFamily: TYPE.labelFamily,
  },
  certCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
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
    borderRadius: RADIUS.full,
    backgroundColor: SemanticColors.actionPrimary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  certAvatar: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  certAvatarText: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
  },
  certInfo: {
    flex: 1,
    marginLeft: 12,
  },
  certName: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  certHolder: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  certIssuer: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  certStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  certStatusText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
  },
  certFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  certExpiry: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },
  certIssuerSmall: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },
  insuranceSummary: {
    backgroundColor: SemanticColors.actionPrimary + '10',
    borderRadius: RADIUS.lg,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  insuranceSummaryTitle: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
  },
  insuranceSummaryValue: {
    fontSize: TYPE.displaySize + 4,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.actionPrimary,
    marginTop: 4,
  },
  insuranceSummaryPremium: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textPrimary,
    marginTop: 8,
  },
  insuranceCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
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
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insuranceInfo: {
    flex: 1,
    marginLeft: 12,
  },
  insuranceName: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  insuranceProvider: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  insuranceStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.md,
  },
  insuranceStatusText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
  },
  insuranceDetails: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  insuranceDetailItem: {
    flex: 1,
    alignItems: 'center',
  },
  insuranceDetailLabel: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
  },
  insuranceDetailValue: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    marginTop: 2,
  },
  insuranceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  insuranceExpiry: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },
  autoRenewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  autoRenewText: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.feedbackSuccess,
    fontFamily: TYPE.labelFamily,
  },
  regulatoryFilters: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
  },
  filterChipActive: {
    backgroundColor: SemanticColors.actionPrimary,
  },
  filterChipText: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
  },
  filterChipTextActive: {
    fontSize: TYPE.captionSize,
    color: Palette.white,
    fontFamily: TYPE.labelFamily,
  },
  updateCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 16,
    marginBottom: 12,
  },
  updateCardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: SemanticColors.actionPrimary,
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
    borderRadius: RADIUS.sm,
  },
  updateCategoryText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
  },
  updateDate: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },
  updateTitle: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    marginBottom: 6,
  },
  updateSummary: {
    fontSize: TYPE.bodySize - 1,
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
    fontSize: TYPE.labelSize,
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
    backgroundColor: SemanticColors.feedbackWarning + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  actionRequiredText: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.feedbackWarning,
    fontFamily: TYPE.labelFamily,
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
    fontSize: TYPE.titleSize + 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
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
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  licenseProfileName: {
    fontSize: TYPE.displaySize - 6,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    textAlign: 'center',
  },
  licenseProfileNumber: {
    fontSize: TYPE.bodySize,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  detailSection: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 16,
    marginBottom: 16,
  },
  detailSectionTitle: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  detailLabel: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
  },
  detailValue: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textPrimary,
  },
  requiredForItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  requiredForItemText: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textPrimary,
  },
  modalActions: {
    gap: 10,
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.actionPrimary,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    gap: 8,
  },
  primaryActionText: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: Palette.white,
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.actionPrimary + '15',
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    gap: 8,
  },
  secondaryActionText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.actionPrimary,
  },
  updateModalTitle: {
    fontSize: TYPE.displaySize - 6,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    marginBottom: 8,
  },
  updateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  updateMetaText: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
  },
  effectiveDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SemanticColors.actionPrimary + '15',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  effectiveDateText: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.actionPrimary,
    fontFamily: TYPE.labelFamily,
  },
  updateFullSummary: {
    fontSize: TYPE.bodySize,
    color: SemanticColors.textPrimary,
    lineHeight: 24,
    marginBottom: 20,
  },
  affectedAreas: {
    marginBottom: 20,
  },
  affectedAreasTitle: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    marginBottom: 10,
  },
  affectedAreasTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  affectedAreaTag: {
    backgroundColor: SemanticColors.surfacePrimary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.lg,
  },
  affectedAreaTagText: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textPrimary,
  },
  actionRequiredSection: {
    backgroundColor: SemanticColors.feedbackWarning + '15',
    borderRadius: RADIUS.md,
    padding: 16,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackWarning + '40',
  },
  actionRequiredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  actionRequiredTitle: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.feedbackWarning,
  },
  actionRequiredDescription: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textPrimary,
    lineHeight: 22,
  },
  actionDeadline: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.feedbackError,
    marginTop: 10,
  },
  // Trade Requirements tab
  tradePickerRow: {
    marginBottom: 16,
  },
  tradeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    marginRight: 8,
  },
  tradeChipActive: {
    backgroundColor: SemanticColors.actionPrimary,
  },
  tradeChipText: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
  },
  tradeChipTextActive: {
    fontSize: TYPE.captionSize,
    color: Palette.white,
    fontFamily: TYPE.labelFamily,
  },
  emptyTrade: {
    alignItems: 'center',
    padding: 40,
    gap: 8,
  },
  emptyTradeTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  emptyTradeSubtitle: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  reqCount: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    backgroundColor: SemanticColors.surfacePrimary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  reqCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 10,
  },
  reqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  reqLevelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  reqLevelText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
  },
  reqTitle: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  reqDescription: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
    lineHeight: 20,
    marginTop: 8,
  },
  reqNotesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
    backgroundColor: SemanticColors.feedbackInfo + '10',
    padding: 10,
    borderRadius: RADIUS.sm,
  },
  reqNotesText: {
    flex: 1,
    fontSize: TYPE.captionSize,
    color: SemanticColors.feedbackInfo,
    lineHeight: 18,
  },
  evidenceCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 8,
  },
  evidenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  evidenceLabel: {
    flex: 1,
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textPrimary,
  },
  evidenceDesc: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    marginTop: 6,
    marginLeft: 28,
  },
  requiredBadge: {
    backgroundColor: SemanticColors.feedbackError + '15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  requiredBadgeText: {
    fontSize: TYPE.tinySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.feedbackError,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  checklistLabel: {
    flex: 1,
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textPrimary,
  },
  registryCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 10,
  },
  registryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  registryLabel: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  registryDesc: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  registryFields: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  registryField: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    backgroundColor: SemanticColors.surfaceBackground,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },

  // Scan card — compliance agent last-run + "Scan now" CTA
  scanCard: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.sm,
    padding: GRID.md, marginBottom: GRID.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: SemanticColors.borderMuted,
  },
  scanInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: GRID.sm },
  scanTitle: { fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  scanSubtitle: { fontSize: TYPE.captionSize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textSecondary, marginTop: 2 },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: GRID.md, paddingVertical: GRID.sm,
    borderRadius: RADIUS.sm, backgroundColor: Palette.hermesOrange,
  },
  scanBtnText: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: Palette.white },
});

export default ComplianceCenter;
