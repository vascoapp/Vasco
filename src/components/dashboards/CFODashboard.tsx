import { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { cfoApi } from '../../api/vascoApi';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import {
  mockProjects,
  mockAppraisals,
  mockDeliveryMetrics,
  getProjectById,
} from '../../data/mockProjects';
import {
  calculateTransferTax,
  formatCurrency,
  formatPercent,
  calculateCostVariance,
  calculateEAC,
  calculateCPI,
  getCurrencyForCountry,
  DE_RETT_RATES,
} from '../../modules/countryModules';
import type { Project, DevelopmentAppraisal, Country, Currency } from '../../types/buildos';
import { hapticError, hapticSuccess } from '../../utils/haptics';

type Recommendation = {
  action: string;
  reason: string;
};

type SimilarOrder = {
  id: string;
  description: string;
  proposed_amount: number;
  actual_cost_impact: number | null;
  approved: boolean;
};

export function CFODashboard() {
  // Project selection
  const [selectedProjectId, setSelectedProjectId] = useState<string>('uk-001');

  // Change order inputs
  const [contractId, setContractId] = useState('');
  const [proposedAmount, setProposedAmount] = useState('');
  const [description, setDescription] = useState('');

  // Tax calculator inputs
  const [taxAmount, setTaxAmount] = useState('');
  const [taxCountry, setTaxCountry] = useState<Country>('UK');
  const [taxBundesland, setTaxBundesland] = useState('Hessen');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeSection, setActiveSection] = useState<'appraisal' | 'costs' | 'tax' | 'actions'>('appraisal');

  // API results
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [similarOrders, setSimilarOrders] = useState<SimilarOrder[] | null>(null);
  const [generatedDrawRequest, setGeneratedDrawRequest] = useState<string | null>(null);
  const [generatedInvestorUpdate, setGeneratedInvestorUpdate] = useState<string | null>(null);
  const [generatedCostReport, setGeneratedCostReport] = useState<string | null>(null);

  // Derived data
  const selectedProject = useMemo(() => getProjectById(selectedProjectId), [selectedProjectId]);
  const appraisal = useMemo(() => mockAppraisals[selectedProjectId], [selectedProjectId]);
  const deliveryMetrics = useMemo(() => mockDeliveryMetrics[selectedProjectId], [selectedProjectId]);
  const currency = useMemo(() => selectedProject ? getCurrencyForCountry(selectedProject.country) : 'GBP', [selectedProject]);

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const handleError = (err: unknown) => {
    setError(err instanceof Error ? err.message : 'An error occurred');
    hapticError();
  };

  // Calculate transfer tax
  const taxResult = useMemo(() => {
    const amount = parseFloat(taxAmount);
    if (isNaN(amount) || amount <= 0) return null;
    return calculateTransferTax(taxCountry, amount, {
      bundesland: taxBundesland,
      isResidential: false,
    });
  }, [taxAmount, taxCountry, taxBundesland]);

  // Calculate cost health indicators
  const costHealth = useMemo(() => {
    if (!selectedProject || !deliveryMetrics) return null;
    const cpi = deliveryMetrics.cpiCostPerformanceIndex;
    const eac = deliveryMetrics.estimateAtCompletion;
    const budgetVariance = selectedProject.totalBudget - eac;
    const contingencyRemaining = selectedProject.contingency - selectedProject.contingencyUsed;
    const contingencyPercent = selectedProject.contingency > 0
      ? contingencyRemaining / selectedProject.contingency
      : 0;

    return {
      cpi,
      eac,
      budgetVariance,
      contingencyRemaining,
      contingencyPercent,
      status: cpi >= 0.95 ? 'healthy' : cpi >= 0.85 ? 'at-risk' : 'critical',
    };
  }, [selectedProject, deliveryMetrics]);

  const getIntegratedRecommendation = async () => {
    clearMessages();
    if (!contractId || !proposedAmount || !description) {
      setError('Contract ID, amount and description are required');
      return;
    }
    setLoading(true);
    try {
      const data = await cfoApi.getIntegratedRecommendation(
        contractId,
        description,
        parseFloat(proposedAmount)
      );
      setRecommendation(data.recommendation);
      setSimilarOrders(data.similar_orders);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const generateLenderDrawRequest = () => {
    clearMessages();
    if (!selectedProject || !appraisal) {
      setError('No project selected');
      return;
    }

    const drawNumber = Math.floor(selectedProject.actualSpent / 5000000) + 1;
    const thisDrawAmount = Math.min(5000000, selectedProject.committedCosts - selectedProject.actualSpent);

    const request = `
LENDER DRAW REQUEST #${drawNumber}
================================
Project: ${selectedProject.name}
Date: ${new Date().toISOString().split('T')[0]}
Facility: Senior Development Loan

DRAW SUMMARY
------------
This Draw Amount: ${formatCurrency(thisDrawAmount, currency)}
Prior Draws: ${formatCurrency(selectedProject.actualSpent, currency)}
Total Drawn (incl. this): ${formatCurrency(selectedProject.actualSpent + thisDrawAmount, currency)}
Remaining Facility: ${formatCurrency(selectedProject.totalBudget * 0.65 - selectedProject.actualSpent - thisDrawAmount, currency)}

PROJECT STATUS
--------------
Overall Progress: ${deliveryMetrics?.earnedValue ? ((deliveryMetrics.earnedValue / selectedProject.totalBudget) * 100).toFixed(1) : 0}%
Schedule Status: ${deliveryMetrics?.scheduleVarianceDays && deliveryMetrics.scheduleVarianceDays < 0 ? Math.abs(deliveryMetrics.scheduleVarianceDays) + ' days behind' : 'On track'}
CPI: ${deliveryMetrics?.cpiCostPerformanceIndex.toFixed(2) || 'N/A'}
EAC: ${formatCurrency(deliveryMetrics?.estimateAtCompletion || 0, currency)}

COST BREAKDOWN THIS DRAW
------------------------
Construction: ${formatCurrency(thisDrawAmount * 0.85, currency)}
Professional Fees: ${formatCurrency(thisDrawAmount * 0.08, currency)}
Statutory Costs: ${formatCurrency(thisDrawAmount * 0.04, currency)}
Interest Capitalized: ${formatCurrency(thisDrawAmount * 0.03, currency)}

CERTIFICATIONS
--------------
[ ] QS Cost Certificate attached
[ ] Insurance certificates current
[ ] No material adverse change
[ ] Planning conditions discharged to date
[ ] Contractor payment applications verified

Prepared by: BuildOS CFO Agent
Generated: ${new Date().toISOString()}
    `.trim();

    setGeneratedDrawRequest(request);
    setSuccess('Lender draw request generated');
    hapticSuccess();
  };

  const generateInvestorUpdate = () => {
    clearMessages();
    if (!selectedProject || !appraisal || !costHealth || !deliveryMetrics) {
      setError('No project selected');
      return;
    }

    const update = `
INVESTOR UPDATE - ${new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
${'='.repeat(50)}
Project: ${selectedProject.name}
Location: ${selectedProject.country === 'UK' ? 'United Kingdom' : selectedProject.country === 'NL' ? 'Netherlands' : 'Germany'}
Phase: ${selectedProject.phase}

EXECUTIVE SUMMARY
-----------------
The project continues to progress ${costHealth.status === 'healthy' ? 'within budget parameters' : 'with cost pressures requiring active management'}. Key metrics remain ${costHealth.cpi >= 0.95 ? 'healthy' : 'under close monitoring'}.

KEY METRICS
-----------
IRR (Current):        ${formatPercent(appraisal.irr)}
NPV:                  ${fmt(appraisal.npv)}
Profit on Cost:       ${formatPercent(appraisal.profitOnCost)}
Profit on GDV:        ${formatPercent(appraisal.profitOnGdv)}

FINANCIAL POSITION
------------------
Total Budget:         ${fmt(selectedProject.totalBudget)}
Committed:            ${fmt(selectedProject.committedCosts)} (${formatPercent(selectedProject.committedCosts / selectedProject.totalBudget)})
Actual Spent:         ${fmt(selectedProject.actualSpent)} (${formatPercent(selectedProject.actualSpent / selectedProject.totalBudget)})
Estimate at Complete: ${fmt(costHealth.eac)}
Budget Variance:      ${costHealth.budgetVariance >= 0 ? '+' : ''}${fmt(costHealth.budgetVariance)}

COST PERFORMANCE
----------------
CPI:                  ${costHealth.cpi.toFixed(2)} (${costHealth.cpi >= 1 ? 'Under budget' : costHealth.cpi >= 0.95 ? 'On target' : 'Over budget'})
Contingency Used:     ${fmt(selectedProject.contingencyUsed)} of ${fmt(selectedProject.contingency)}
Contingency Remaining: ${formatPercent(costHealth.contingencyPercent)}

SCHEDULE STATUS
---------------
SPI:                  ${deliveryMetrics.spiSchedulePerformanceIndex.toFixed(2)}
Schedule Variance:    ${deliveryMetrics.scheduleVarianceDays > 0 ? '+' : ''}${deliveryMetrics.scheduleVarianceDays} days
Planned Completion:   ${selectedProject.plannedEndDate}
Forecast Completion:  ${selectedProject.forecastEndDate || selectedProject.plannedEndDate}

DEVELOPMENT VALUE
-----------------
GDV:                  ${fmt(appraisal.gdv)}
Yield on Cost:        ${formatPercent(appraisal.yieldOnCost)}
${appraisal.exitYield ? `Exit Yield:           ${formatPercent(appraisal.exitYield)}` : ''}

KEY RISKS & MITIGATIONS
-----------------------
${selectedProject.risks.filter(r => r.status !== 'closed').slice(0, 3).map(r =>
`• ${r.category}: ${r.description}
  Mitigation: ${r.mitigation}`).join('\n') || '• No significant risks to report'}

NEXT PERIOD OUTLOOK
-------------------
• Continue cost monitoring and contingency management
• Progress ${selectedProject.scheduleActivities.filter(a => a.isCriticalPath && a.status !== 'completed').slice(0, 2).map(a => a.name).join(', ')}
• ${selectedProject.permits.filter(p => p.status === 'under-review').length > 0 ? 'Await permit decisions' : 'Maintain permit compliance'}

Generated by BuildOS CFO Agent
Report Date: ${new Date().toISOString()}
    `.trim();

    setGeneratedInvestorUpdate(update);
    setSuccess('Investor update generated');
    hapticSuccess();
  };

  const generateCostReport = () => {
    clearMessages();
    if (!selectedProject || !costHealth) {
      setError('No project selected');
      return;
    }

    const report = `
COST CONTROL REPORT
${'='.repeat(50)}
Project: ${selectedProject.name}
Reporting Period: ${new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
Currency: ${currency}

COST SUMMARY
------------
                          Budget         Actual        Variance
${'─'.repeat(60)}
${selectedProject.budgetLines.map(line => {
  const variance = line.forecastFinal - line.currentBudget;
  const varianceStr = variance >= 0 ? `+${fmt(variance)}` : fmt(variance);
  return `${line.description.padEnd(22)} ${fmt(line.currentBudget).padStart(12)} ${fmt(line.actualSpent).padStart(12)} ${varianceStr.padStart(12)}`;
}).join('\n')}
${'─'.repeat(60)}
TOTAL                     ${fmt(selectedProject.totalBudget).padStart(12)} ${fmt(selectedProject.actualSpent).padStart(12)} ${(costHealth.budgetVariance >= 0 ? '+' : '') + fmt(Math.abs(costHealth.budgetVariance)).padStart(11)}

PERFORMANCE INDICATORS
----------------------
Cost Performance Index (CPI): ${costHealth.cpi.toFixed(3)}
  → ${costHealth.cpi >= 1 ? 'Project is under budget' : costHealth.cpi >= 0.95 ? 'Project is within acceptable range' : 'Project is over budget - action required'}

Estimate at Completion (EAC): ${fmt(costHealth.eac)}
  → ${costHealth.budgetVariance >= 0 ? `${fmt(costHealth.budgetVariance)} under budget` : `${fmt(Math.abs(costHealth.budgetVariance))} over budget`}

CONTINGENCY STATUS
------------------
Original Contingency:  ${fmt(selectedProject.contingency)}
Used to Date:          ${fmt(selectedProject.contingencyUsed)}
Remaining:             ${fmt(costHealth.contingencyRemaining)}
Utilization:           ${formatPercent(1 - costHealth.contingencyPercent)}

${costHealth.contingencyPercent < 0.3 ? '⚠️  ALERT: Contingency below 30% - review required' : costHealth.contingencyPercent < 0.5 ? '⚡ NOTE: Contingency at 50% - monitor closely' : '✓ Contingency levels healthy'}

COMMITMENTS
-----------
Total Committed:       ${fmt(selectedProject.committedCosts)}
Uncommitted Budget:    ${fmt(selectedProject.totalBudget - selectedProject.committedCosts)}
Commitment Rate:       ${formatPercent(selectedProject.committedCosts / selectedProject.totalBudget)}

COST CATEGORIES AT RISK
-----------------------
${selectedProject.budgetLines
  .filter(line => line.forecastFinal > line.currentBudget * 1.05)
  .map(line => `• ${line.description}: Forecast ${fmt(line.forecastFinal)} vs Budget ${fmt(line.currentBudget)} (+${formatPercent((line.forecastFinal - line.currentBudget) / line.currentBudget)})`)
  .join('\n') || '• No categories significantly over budget'}

RECOMMENDATIONS
---------------
${costHealth.cpi < 0.95 ? `1. Review scope and value engineering opportunities
2. Assess acceleration vs compression trade-offs
3. Consider contingency allocation for known risks` : `1. Maintain current cost control measures
2. Continue proactive procurement management
3. Monitor for emerging cost pressures`}

Generated by BuildOS CFO Agent
Report Date: ${new Date().toISOString()}
    `.trim();

    setGeneratedCostReport(report);
    setSuccess('Cost report generated');
    hapticSuccess();
  };

  const fmt = (amount: number) => formatCurrency(amount, currency);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={Typography.title}>CFO Dashboard</Text>

      {/* Project Selector */}
      <View style={styles.projectSelector}>
        {mockProjects.map((project) => (
          <Pressable
            key={project.id}
            style={[
              styles.projectPill,
              selectedProjectId === project.id && styles.projectPillActive,
            ]}
            onPress={() => setSelectedProjectId(project.id)}
          >
            <Text style={styles.projectCountry}>{project.country}</Text>
            <Text
              style={[
                styles.projectName,
                selectedProjectId === project.id && styles.projectNameActive,
              ]}
              numberOfLines={1}
            >
              {project.name}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Section Tabs */}
      <View style={styles.tabRow}>
        {(['appraisal', 'costs', 'tax', 'actions'] as const).map((section) => (
          <Pressable
            key={section}
            style={[styles.tab, activeSection === section && styles.tabActive]}
            onPress={() => setActiveSection(section)}
          >
            <Text style={[styles.tabText, activeSection === section && styles.tabTextActive]}>
              {section === 'appraisal' ? 'Appraisal' :
               section === 'costs' ? 'Cost Control' :
               section === 'tax' ? 'Tax Calculator' : 'Actions'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Development Appraisal Section */}
      {activeSection === 'appraisal' && appraisal && selectedProject && (
        <View style={styles.card}>
          <Text style={Typography.subtitle}>Development Appraisal</Text>

          {/* Key Returns */}
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{formatPercent(appraisal.irr)}</Text>
              <Text style={styles.kpiLabel}>IRR</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{fmt(appraisal.npv)}</Text>
              <Text style={styles.kpiLabel}>NPV</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{formatPercent(appraisal.profitOnCost)}</Text>
              <Text style={styles.kpiLabel}>Profit on Cost</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{formatPercent(appraisal.profitOnGdv)}</Text>
              <Text style={styles.kpiLabel}>Profit on GDV</Text>
            </View>
          </View>

          {/* Revenue & Value */}
          <View style={styles.appraisalSection}>
            <Text style={styles.sectionLabel}>Revenue</Text>
            <View style={styles.appraisalRow}>
              <Text style={Typography.body}>Gross Development Value</Text>
              <Text style={styles.appraisalValue}>{fmt(appraisal.gdv)}</Text>
            </View>
            {appraisal.rentalIncome && (
              <View style={styles.appraisalRow}>
                <Text style={Typography.muted}>Annual Rental Income</Text>
                <Text style={Typography.muted}>{fmt(appraisal.rentalIncome)}</Text>
              </View>
            )}
            <View style={styles.appraisalRow}>
              <Text style={Typography.muted}>Yield on Cost</Text>
              <Text style={Typography.muted}>{formatPercent(appraisal.yieldOnCost)}</Text>
            </View>
            {appraisal.exitYield && (
              <View style={styles.appraisalRow}>
                <Text style={Typography.muted}>Exit Yield</Text>
                <Text style={Typography.muted}>{formatPercent(appraisal.exitYield)}</Text>
              </View>
            )}
          </View>

          {/* Costs Breakdown */}
          <View style={styles.appraisalSection}>
            <Text style={styles.sectionLabel}>Costs</Text>
            <View style={styles.appraisalRow}>
              <Text style={Typography.muted}>Land</Text>
              <Text style={Typography.muted}>{fmt(appraisal.landCost)}</Text>
            </View>
            <View style={styles.appraisalRow}>
              <Text style={Typography.muted}>Construction</Text>
              <Text style={Typography.muted}>{fmt(appraisal.constructionCost)}</Text>
            </View>
            <View style={styles.appraisalRow}>
              <Text style={Typography.muted}>Professional Fees</Text>
              <Text style={Typography.muted}>{fmt(appraisal.professionalFees)}</Text>
            </View>
            <View style={styles.appraisalRow}>
              <Text style={Typography.muted}>Finance Costs</Text>
              <Text style={Typography.muted}>{fmt(appraisal.financeCosts)}</Text>
            </View>
            <View style={styles.appraisalRow}>
              <Text style={Typography.muted}>Contingency</Text>
              <Text style={Typography.muted}>{fmt(appraisal.contingency)}</Text>
            </View>
            <View style={[styles.appraisalRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total Development Cost</Text>
              <Text style={styles.totalValue}>{fmt(appraisal.totalDevelopmentCost)}</Text>
            </View>
          </View>

          {/* Equity Returns */}
          {appraisal.equityIrr && (
            <View style={styles.equityCard}>
              <Text style={styles.equityTitle}>Equity Returns</Text>
              <View style={styles.equityRow}>
                <View>
                  <Text style={styles.equityValue}>{formatPercent(appraisal.equityIrr)}</Text>
                  <Text style={styles.equityLabel}>Equity IRR</Text>
                </View>
                {appraisal.equityMultiple && (
                  <View>
                    <Text style={styles.equityValue}>{appraisal.equityMultiple.toFixed(2)}x</Text>
                    <Text style={styles.equityLabel}>Equity Multiple</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      )}

      {/* Cost Control Section */}
      {activeSection === 'costs' && selectedProject && costHealth && (
        <View style={styles.card}>
          <Text style={Typography.subtitle}>Cost Control</Text>

          {/* Health Indicator */}
          <View style={[
            styles.healthBanner,
            costHealth.status === 'healthy' && styles.healthGreen,
            costHealth.status === 'at-risk' && styles.healthYellow,
            costHealth.status === 'critical' && styles.healthRed,
          ]}>
            <Text style={styles.healthText}>
              {costHealth.status === 'healthy' ? 'Cost Performance Healthy' :
               costHealth.status === 'at-risk' ? 'Cost Performance At Risk' :
               'Cost Performance Critical'}
            </Text>
            <Text style={styles.healthCpi}>CPI: {costHealth.cpi.toFixed(2)}</Text>
          </View>

          {/* Budget Overview */}
          <View style={styles.budgetGrid}>
            <View style={styles.budgetItem}>
              <Text style={styles.budgetLabel}>Total Budget</Text>
              <Text style={styles.budgetValue}>{fmt(selectedProject.totalBudget)}</Text>
            </View>
            <View style={styles.budgetItem}>
              <Text style={styles.budgetLabel}>Committed</Text>
              <Text style={styles.budgetValue}>{fmt(selectedProject.committedCosts)}</Text>
            </View>
            <View style={styles.budgetItem}>
              <Text style={styles.budgetLabel}>Actual Spent</Text>
              <Text style={styles.budgetValue}>{fmt(selectedProject.actualSpent)}</Text>
            </View>
            <View style={styles.budgetItem}>
              <Text style={styles.budgetLabel}>EAC</Text>
              <Text style={[
                styles.budgetValue,
                costHealth.budgetVariance < 0 && styles.budgetOverrun,
              ]}>
                {fmt(costHealth.eac)}
              </Text>
            </View>
          </View>

          {/* Contingency Tracker */}
          <View style={styles.contingencyCard}>
            <View style={styles.contingencyHeader}>
              <Text style={styles.contingencyTitle}>Contingency</Text>
              <Text style={styles.contingencyPercent}>
                {formatPercent(costHealth.contingencyPercent)} remaining
              </Text>
            </View>
            <View style={styles.contingencyBar}>
              <View
                style={[
                  styles.contingencyUsed,
                  { width: `${(1 - costHealth.contingencyPercent) * 100}%` },
                ]}
              />
            </View>
            <View style={styles.contingencyValues}>
              <Text style={Typography.muted}>
                Used: {fmt(selectedProject.contingencyUsed)}
              </Text>
              <Text style={Typography.muted}>
                Remaining: {fmt(costHealth.contingencyRemaining)}
              </Text>
            </View>
          </View>

          {/* Budget Lines */}
          <View style={styles.budgetLinesCard}>
            <Text style={styles.sectionLabel}>Cost Categories</Text>
            {selectedProject.budgetLines.map((line) => {
              const variance = calculateCostVariance(line.currentBudget, line.forecastFinal);
              return (
                <View key={line.id} style={styles.budgetLineRow}>
                  <View style={styles.budgetLineInfo}>
                    <Text style={Typography.body}>{line.description}</Text>
                    <Text style={Typography.muted}>
                      {fmt(line.actualSpent)} / {fmt(line.currentBudget)}
                    </Text>
                  </View>
                  <View style={[
                    styles.varianceBadge,
                    variance.status === 'over' && styles.varianceOver,
                    variance.status === 'under' && styles.varianceUnder,
                  ]}>
                    <Text style={[
                      styles.varianceText,
                      variance.status === 'over' && styles.varianceTextOver,
                      variance.status === 'under' && styles.varianceTextUnder,
                    ]}>
                      {variance.variance >= 0 ? '+' : ''}{fmt(variance.variance)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Tax Calculator Section */}
      {activeSection === 'tax' && (
        <View style={styles.card}>
          <Text style={Typography.subtitle}>Transfer Tax Calculator</Text>

          {/* Country Selector */}
          <View style={styles.countrySelector}>
            {(['UK', 'NL', 'DE'] as Country[]).map((country) => (
              <Pressable
                key={country}
                style={[
                  styles.countryPill,
                  taxCountry === country && styles.countryPillActive,
                ]}
                onPress={() => setTaxCountry(country)}
              >
                <Text style={[
                  styles.countryPillText,
                  taxCountry === country && styles.countryPillTextActive,
                ]}>
                  {country === 'UK' ? 'UK SDLT' :
                   country === 'NL' ? 'NL RETT' : 'DE RETT'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* DE State Selector */}
          {taxCountry === 'DE' && (
            <View style={styles.bundeslandSelector}>
              <Text style={styles.pickerLabel}>Bundesland:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.bundeslandRow}>
                  {Object.keys(DE_RETT_RATES).slice(0, 6).map((state) => (
                    <Pressable
                      key={state}
                      style={[
                        styles.bundeslandPill,
                        taxBundesland === state && styles.bundeslandPillActive,
                      ]}
                      onPress={() => setTaxBundesland(state)}
                    >
                      <Text style={[
                        styles.bundeslandText,
                        taxBundesland === state && styles.bundeslandTextActive,
                      ]}>
                        {state}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          <TextInput
            style={styles.input}
            placeholder={`Purchase Price (${taxCountry === 'UK' ? 'GBP' : 'EUR'})`}
            placeholderTextColor={Colors.muted}
            value={taxAmount}
            onChangeText={setTaxAmount}
            keyboardType="numeric"
          />

          {taxResult && (
            <View style={styles.taxResult}>
              <View style={styles.taxResultMain}>
                <Text style={styles.taxLabel}>
                  {taxCountry === 'UK' ? 'SDLT Payable' :
                   taxCountry === 'NL' ? 'Overdrachtsbelasting' :
                   'Grunderwerbsteuer'}
                </Text>
                <Text style={styles.taxValue}>
                  {formatCurrency(taxResult.totalTax, taxCountry === 'UK' ? 'GBP' : 'EUR')}
                </Text>
              </View>
              <Text style={styles.taxEffective}>
                Effective Rate: {formatPercent(taxResult.effectiveRate)}
              </Text>

              {/* UK SDLT Breakdown */}
              {taxCountry === 'UK' && taxResult.details && 'breakdown' in taxResult.details && (
                <View style={styles.taxBreakdown}>
                  <Text style={styles.breakdownTitle}>Band Breakdown:</Text>
                  {taxResult.details.breakdown.map((band, i) => (
                    <View key={i} style={styles.breakdownRow}>
                      <Text style={Typography.muted}>{band.band}</Text>
                      <Text style={Typography.muted}>
                        {formatPercent(band.rate)} = {formatCurrency(band.tax, 'GBP')}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Tax Info Cards */}
          <View style={styles.taxInfoGrid}>
            <View style={styles.taxInfoCard}>
              <Text style={styles.taxInfoTitle}>UK SDLT</Text>
              <Text style={styles.taxInfoRate}>0% / 2% / 5%</Text>
              <Text style={styles.taxInfoDesc}>Banded rates for non-residential</Text>
            </View>
            <View style={styles.taxInfoCard}>
              <Text style={styles.taxInfoTitle}>NL RETT</Text>
              <Text style={styles.taxInfoRate}>10.4%</Text>
              <Text style={styles.taxInfoDesc}>Commercial property rate</Text>
            </View>
            <View style={styles.taxInfoCard}>
              <Text style={styles.taxInfoTitle}>DE RETT</Text>
              <Text style={styles.taxInfoRate}>3.5% - 6.5%</Text>
              <Text style={styles.taxInfoDesc}>Varies by Bundesland</Text>
            </View>
          </View>
        </View>
      )}

      {/* Actions Section (System of Action) */}
      {activeSection === 'actions' && selectedProject && (
        <>
          {/* Quick Actions Bar */}
          <View style={styles.quickActionsCard}>
            <Text style={styles.sectionLabel}>Quick Actions</Text>
            <View style={styles.quickActionsGrid}>
              <Pressable style={styles.quickActionButton} onPress={generateLenderDrawRequest}>
                <View style={styles.quickActionIcon}>
                  <Text style={styles.quickActionIconText}>€</Text>
                </View>
                <Text style={styles.quickActionLabel}>Draw Request</Text>
              </Pressable>
              <Pressable style={styles.quickActionButton} onPress={generateInvestorUpdate}>
                <View style={styles.quickActionIcon}>
                  <Text style={styles.quickActionIconText}>↑</Text>
                </View>
                <Text style={styles.quickActionLabel}>Investor Update</Text>
              </Pressable>
              <Pressable style={styles.quickActionButton} onPress={generateCostReport}>
                <View style={styles.quickActionIcon}>
                  <Text style={styles.quickActionIconText}>$</Text>
                </View>
                <Text style={styles.quickActionLabel}>Cost Report</Text>
              </Pressable>
            </View>
          </View>

          {/* Change Order Analysis */}
          <View style={styles.card}>
            <Text style={Typography.subtitle}>Change Order Analysis</Text>
            <TextInput
              style={styles.input}
              placeholder="Change Order Description"
              placeholderTextColor={Colors.muted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
            <TextInput
              style={styles.input}
              placeholder="Contract ID"
              placeholderTextColor={Colors.muted}
              value={contractId}
              onChangeText={setContractId}
            />
            <TextInput
              style={styles.input}
              placeholder={`Proposed Amount (${currency})`}
              placeholderTextColor={Colors.muted}
              value={proposedAmount}
              onChangeText={setProposedAmount}
              keyboardType="numeric"
            />
            <Pressable style={styles.button} onPress={getIntegratedRecommendation}>
              <Text style={styles.buttonText}>Analyze & Find Similar</Text>
            </Pressable>

            {recommendation && (
              <View style={[
                styles.recommendationCard,
                recommendation.action === 'APPROVE' && styles.recommendationApprove,
                recommendation.action === 'REJECT' && styles.recommendationReject,
                recommendation.action === 'NEGOTIATE' && styles.recommendationNegotiate,
              ]}>
                <Text style={styles.recommendationAction}>{recommendation.action}</Text>
                <Text style={Typography.muted}>{recommendation.reason}</Text>
              </View>
            )}

            {similarOrders && similarOrders.length > 0 && (
              <View style={styles.similarOrdersCard}>
                <Text style={styles.sectionLabel}>Similar Past Change Orders</Text>
                {similarOrders.map((co) => (
                  <View key={co.id} style={styles.similarOrderRow}>
                    <Text style={Typography.body}>{co.description}</Text>
                    <Text style={Typography.muted}>
                      Proposed: {fmt(co.proposed_amount)} | {co.approved ? 'Approved' : 'Rejected'}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Generated Documents */}
          {(generatedDrawRequest || generatedInvestorUpdate || generatedCostReport) && (
            <View style={styles.card}>
              <Text style={Typography.subtitle}>Generated Documents</Text>

              {generatedDrawRequest && (
                <View style={styles.generatedDocument}>
                  <View style={styles.documentHeader}>
                    <Text style={styles.documentTitle}>Lender Draw Request</Text>
                    <View style={styles.documentBadge}>
                      <Text style={styles.documentBadgeText}>DRAFT</Text>
                    </View>
                  </View>
                  <ScrollView style={styles.documentContent} nestedScrollEnabled>
                    <Text style={styles.documentText}>{generatedDrawRequest}</Text>
                  </ScrollView>
                </View>
              )}

              {generatedInvestorUpdate && (
                <View style={styles.generatedDocument}>
                  <View style={styles.documentHeader}>
                    <Text style={styles.documentTitle}>Investor Update</Text>
                    <View style={styles.documentBadge}>
                      <Text style={styles.documentBadgeText}>DRAFT</Text>
                    </View>
                  </View>
                  <ScrollView style={styles.documentContent} nestedScrollEnabled>
                    <Text style={styles.documentText}>{generatedInvestorUpdate}</Text>
                  </ScrollView>
                </View>
              )}

              {generatedCostReport && (
                <View style={styles.generatedDocument}>
                  <View style={styles.documentHeader}>
                    <Text style={styles.documentTitle}>Cost Control Report</Text>
                    <View style={styles.documentBadge}>
                      <Text style={styles.documentBadgeText}>DRAFT</Text>
                    </View>
                  </View>
                  <ScrollView style={styles.documentContent} nestedScrollEnabled>
                    <Text style={styles.documentText}>{generatedCostReport}</Text>
                  </ScrollView>
                </View>
              )}
            </View>
          )}
        </>
      )}

      {loading && <ActivityIndicator size="large" color={Colors.accentDeep} style={styles.loader} />}
      {error !== '' && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      {success !== '' && (
        <View style={styles.successCard}>
          <Text style={styles.successText}>{success}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: 100,
  },
  projectSelector: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  projectPill: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  projectPillActive: {
    borderColor: Colors.accentDeep,
    backgroundColor: Colors.surface,
  },
  projectCountry: {
    color: Colors.accentMuted,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
  },
  projectName: {
    color: Colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  projectNameActive: {
    color: Colors.text,
  },
  tabRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: Colors.surface,
  },
  tabText: {
    color: Colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: Colors.text,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  kpiCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
  },
  kpiValue: {
    color: Colors.accentDeep,
    fontSize: 20,
    fontWeight: '700',
  },
  kpiLabel: {
    color: Colors.muted,
    fontSize: 11,
    marginTop: 4,
  },
  appraisalSection: {
    gap: 8,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  sectionLabel: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  appraisalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appraisalValue: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  totalRow: {
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  totalLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  totalValue: {
    color: Colors.accentMuted,
    fontSize: 16,
    fontWeight: '700',
  },
  equityCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.md,
  },
  equityTitle: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  equityRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  equityValue: {
    color: Colors.success,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  equityLabel: {
    color: Colors.muted,
    fontSize: 11,
    textAlign: 'center',
  },
  healthBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 12,
  },
  healthGreen: {
    backgroundColor: Colors.success + '20',
  },
  healthYellow: {
    backgroundColor: Colors.warning + '20',
  },
  healthRed: {
    backgroundColor: Colors.danger + '20',
  },
  healthText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  healthCpi: {
    color: Colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  budgetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  budgetItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.md,
  },
  budgetLabel: {
    color: Colors.muted,
    fontSize: 11,
    marginBottom: 4,
  },
  budgetValue: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  budgetOverrun: {
    color: Colors.danger,
  },
  contingencyCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.md,
  },
  contingencyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  contingencyTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  contingencyPercent: {
    color: Colors.accentMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  contingencyBar: {
    height: 8,
    backgroundColor: Colors.surface,
    borderRadius: 4,
    overflow: 'hidden',
  },
  contingencyUsed: {
    height: '100%',
    backgroundColor: Colors.warning,
  },
  contingencyValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  budgetLinesCard: {
    gap: 8,
  },
  budgetLineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  budgetLineInfo: {
    flex: 1,
  },
  varianceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.surfaceElevated,
  },
  varianceOver: {
    backgroundColor: Colors.danger + '20',
  },
  varianceUnder: {
    backgroundColor: Colors.success + '20',
  },
  varianceText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.muted,
  },
  varianceTextOver: {
    color: Colors.danger,
  },
  varianceTextUnder: {
    color: Colors.success,
  },
  countrySelector: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  countryPill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  countryPillActive: {
    backgroundColor: Colors.accentDeep + '20',
    borderColor: Colors.accentDeep,
  },
  countryPillText: {
    color: Colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  countryPillTextActive: {
    color: Colors.accentDeep,
  },
  bundeslandSelector: {
    gap: 8,
  },
  pickerLabel: {
    color: Colors.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  bundeslandRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  bundeslandPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bundeslandPillActive: {
    borderColor: Colors.accentMuted,
  },
  bundeslandText: {
    color: Colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  bundeslandTextActive: {
    color: Colors.accentMuted,
  },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 14,
  },
  taxResult: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.md,
    gap: 8,
  },
  taxResultMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taxLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  taxValue: {
    color: Colors.accentDeep,
    fontSize: 20,
    fontWeight: '700',
  },
  taxEffective: {
    color: Colors.muted,
    fontSize: 12,
  },
  taxBreakdown: {
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 4,
  },
  breakdownTitle: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  taxInfoGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  taxInfoCard: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  taxInfoTitle: {
    color: Colors.text,
    fontSize: 11,
    fontWeight: '600',
  },
  taxInfoRate: {
    color: Colors.accentMuted,
    fontSize: 14,
    fontWeight: '700',
    marginVertical: 4,
  },
  taxInfoDesc: {
    color: Colors.muted,
    fontSize: 9,
    textAlign: 'center',
  },
  button: {
    backgroundColor: Colors.accentDeep,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#0B0C0F',
    fontSize: 14,
    fontWeight: '700',
  },
  recommendationCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.md,
    borderLeftWidth: 4,
  },
  recommendationApprove: {
    borderLeftColor: Colors.success,
  },
  recommendationReject: {
    borderLeftColor: Colors.danger,
  },
  recommendationNegotiate: {
    borderLeftColor: Colors.warning,
  },
  recommendationAction: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  similarOrdersCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.md,
    gap: 8,
  },
  similarOrderRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  generatedDocument: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    overflow: 'hidden',
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  documentTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  documentBadge: {
    backgroundColor: Colors.warning + '30',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  documentBadgeText: {
    color: Colors.warning,
    fontSize: 10,
    fontWeight: '700',
  },
  documentContent: {
    maxHeight: 300,
    padding: Spacing.md,
  },
  documentText: {
    color: Colors.text,
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  loader: {
    marginVertical: Spacing.lg,
  },
  errorCard: {
    backgroundColor: Colors.danger + '20',
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
  },
  successCard: {
    backgroundColor: Colors.success + '20',
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  successText: {
    color: Colors.success,
    fontSize: 13,
  },
  quickActionsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accentDeep + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionIconText: {
    color: Colors.accentDeep,
    fontSize: 18,
    fontWeight: '700',
  },
  quickActionLabel: {
    color: Colors.text,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
