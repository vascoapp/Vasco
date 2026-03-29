// =============================================================================
// EVIDENCE GRAPH EXPLORER
// =============================================================================
// Visual explorer for evidence chains: Jobs → Evidence → Compliance → Payments
// Shows node relationships, compliance status, and payment readiness
// =============================================================================

import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { formatCurrency } from '../../i18n/formatting';
import { Spacing } from '../../theme/spacing';
import type { NodeType, EdgeType } from '../../types/evidence-graph';

type IconName = keyof typeof Ionicons.glyphMap;

// ============================================
// MOCK DATA (pre-seeded for demo)
// ============================================

interface MockNode {
  id: string;
  type: NodeType;
  label: string;
  icon: IconName;
  color: string;
  status: 'verified' | 'pending' | 'missing' | 'blocked';
  detail?: string;
  timestamp?: string;
}

interface MockEdge {
  from: string;
  to: string;
  type: EdgeType;
  label: string;
}

interface MockChain {
  jobId: string;
  jobTitle: string;
  customer: string;
  complianceScore: number;
  paymentReady: boolean;
  totalValue: number;
  nodes: MockNode[];
  edges: MockEdge[];
  requirements: { name: string; satisfied: boolean; evidenceType: string }[];
  blockers: string[];
}

const MOCK_CHAINS: MockChain[] = [
  {
    jobId: 'job-001',
    jobTitle: 'Badkamer renovatie - Van der Berg',
    customer: 'Familie Van der Berg',
    complianceScore: 85,
    paymentReady: false,
    totalValue: 12500,
    nodes: [
      { id: 'job-001', type: 'job', label: 'Badkamer renovatie', icon: 'construct', color: Palette.hermesOrange, status: 'verified', detail: '€12.500' },
      { id: 'ev-001', type: 'evidence', label: 'Foto\'s voor', icon: 'camera', color: SemanticColors.feedbackSuccess, status: 'verified', timestamp: '2 feb' },
      { id: 'ev-002', type: 'evidence', label: 'Foto\'s tijdens', icon: 'camera', color: SemanticColors.feedbackSuccess, status: 'verified', timestamp: '5 feb' },
      { id: 'ev-003', type: 'evidence', label: 'Foto\'s na', icon: 'camera', color: SemanticColors.feedbackSuccess, status: 'verified', timestamp: '8 feb' },
      { id: 'ev-004', type: 'evidence', label: 'Inspectie rapport', icon: 'document-text', color: SemanticColors.feedbackInfo, status: 'pending', detail: 'Wacht op inspecteur' },
      { id: 'ev-005', type: 'evidence', label: 'Klant handtekening', icon: 'create', color: SemanticColors.feedbackWarning, status: 'missing', detail: 'Nog niet getekend' },
      { id: 'comp-001', type: 'compliance', label: 'NEN 1010 check', icon: 'shield-checkmark', color: SemanticColors.feedbackSuccess, status: 'verified' },
      { id: 'comp-002', type: 'compliance', label: 'Waterdruk test', icon: 'water', color: SemanticColors.feedbackSuccess, status: 'verified', detail: '4.2 bar - OK' },
      { id: 'pay-001', type: 'payment', label: 'Aanbetaling €3.750', icon: 'card', color: SemanticColors.feedbackSuccess, status: 'verified', detail: 'Betaald 1 feb' },
      { id: 'pay-002', type: 'payment', label: 'Slotbetaling €8.750', icon: 'card', color: SemanticColors.feedbackWarning, status: 'blocked', detail: 'Wacht op bewijs' },
    ],
    edges: [
      { from: 'ev-001', to: 'job-001', type: 'evidences', label: 'bewijs voor' },
      { from: 'ev-002', to: 'job-001', type: 'evidences', label: 'bewijs voor' },
      { from: 'ev-003', to: 'job-001', type: 'evidences', label: 'bewijs voor' },
      { from: 'ev-004', to: 'comp-001', type: 'satisfies', label: 'voldoet aan' },
      { from: 'comp-001', to: 'job-001', type: 'requires', label: 'vereist door' },
      { from: 'pay-001', to: 'job-001', type: 'funds', label: 'financiert' },
      { from: 'pay-002', to: 'job-001', type: 'funds', label: 'financiert' },
    ],
    requirements: [
      { name: 'Foto\'s voor werk', satisfied: true, evidenceType: 'photo_before' },
      { name: 'Foto\'s na werk', satisfied: true, evidenceType: 'photo_after' },
      { name: 'Checklist voltooid', satisfied: true, evidenceType: 'checklist' },
      { name: 'Klant handtekening', satisfied: false, evidenceType: 'signature' },
      { name: 'Inspectie rapport', satisfied: false, evidenceType: 'inspection_report' },
    ],
    blockers: ['Klant handtekening ontbreekt', 'Inspectie rapport in afwachting'],
  },
  {
    jobId: 'job-002',
    jobTitle: 'CV ketel installatie - Jansen',
    customer: 'Dhr. Jansen',
    complianceScore: 100,
    paymentReady: true,
    totalValue: 4200,
    nodes: [
      { id: 'job-002', type: 'job', label: 'CV ketel installatie', icon: 'flame', color: Palette.hermesOrange, status: 'verified', detail: '€4.200' },
      { id: 'ev-011', type: 'evidence', label: 'Foto\'s voor', icon: 'camera', color: SemanticColors.feedbackSuccess, status: 'verified', timestamp: '28 jan' },
      { id: 'ev-012', type: 'evidence', label: 'Foto\'s na', icon: 'camera', color: SemanticColors.feedbackSuccess, status: 'verified', timestamp: '30 jan' },
      { id: 'ev-013', type: 'evidence', label: 'Gasdruk test', icon: 'document-text', color: SemanticColors.feedbackSuccess, status: 'verified', detail: '25 mbar - OK' },
      { id: 'ev-014', type: 'evidence', label: 'Klant handtekening', icon: 'create', color: SemanticColors.feedbackSuccess, status: 'verified', timestamp: '30 jan' },
      { id: 'comp-011', type: 'compliance', label: 'Gas veiligheid', icon: 'shield-checkmark', color: SemanticColors.feedbackSuccess, status: 'verified' },
      { id: 'cert-011', type: 'certification', label: 'F-gas certificaat', icon: 'ribbon', color: SemanticColors.feedbackSuccess, status: 'verified' },
      { id: 'pay-011', type: 'payment', label: 'Volledige betaling €4.200', icon: 'card', color: SemanticColors.feedbackSuccess, status: 'verified', detail: 'Betaald 2 feb' },
    ],
    edges: [
      { from: 'ev-011', to: 'job-002', type: 'evidences', label: 'bewijs voor' },
      { from: 'ev-012', to: 'job-002', type: 'evidences', label: 'bewijs voor' },
      { from: 'ev-013', to: 'comp-011', type: 'satisfies', label: 'voldoet aan' },
      { from: 'cert-011', to: 'job-002', type: 'certifies', label: 'certificeert' },
      { from: 'pay-011', to: 'job-002', type: 'funds', label: 'financiert' },
    ],
    requirements: [
      { name: 'Foto\'s voor werk', satisfied: true, evidenceType: 'photo_before' },
      { name: 'Foto\'s na werk', satisfied: true, evidenceType: 'photo_after' },
      { name: 'Gasdruk test', satisfied: true, evidenceType: 'test_result' },
      { name: 'Klant handtekening', satisfied: true, evidenceType: 'signature' },
      { name: 'F-gas certificaat', satisfied: true, evidenceType: 'certification' },
    ],
    blockers: [],
  },
];

// ============================================
// COMPONENTS
// ============================================

function ChainSelector({
  chains,
  selectedId,
  onSelect,
}: {
  chains: MockChain[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chainSelector}>
      {chains.map((chain) => (
        <Pressable
          key={chain.jobId}
          style={[styles.chainTab, selectedId === chain.jobId && styles.chainTabActive]}
          onPress={() => onSelect(chain.jobId)}
        >
          <View style={styles.chainTabDot}>
            <View style={[styles.dot, { backgroundColor: chain.paymentReady ? SemanticColors.feedbackSuccess : SemanticColors.feedbackWarning }]} />
          </View>
          <Text style={[styles.chainTabText, selectedId === chain.jobId && styles.chainTabTextActive]} numberOfLines={1}>
            {chain.jobTitle.split(' - ')[0]}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function ComplianceScoreBadge({ score, paymentReady }: { score: number; paymentReady: boolean }) {
  const color = score >= 90 ? SemanticColors.feedbackSuccess : score >= 70 ? SemanticColors.feedbackWarning : SemanticColors.feedbackError;
  return (
    <View style={styles.scoreRow}>
      <View style={styles.scoreCard}>
        <Text style={[styles.scoreValue, { color }]}>{score}%</Text>
        <Text style={styles.scoreLabel}>Compliance</Text>
      </View>
      <View style={styles.scoreCard}>
        <Ionicons
          name={paymentReady ? 'checkmark-circle' : 'close-circle'}
          size={24}
          color={paymentReady ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError}
        />
        <Text style={styles.scoreLabel}>{paymentReady ? 'Betaalklaar' : 'Geblokkeerd'}</Text>
      </View>
    </View>
  );
}

function GraphNodeCard({ node, onPress }: { node: MockNode; onPress: () => void }) {
  const statusIcon: Record<string, { icon: IconName; color: string }> = {
    verified: { icon: 'checkmark-circle', color: SemanticColors.feedbackSuccess },
    pending: { icon: 'time', color: SemanticColors.feedbackWarning },
    missing: { icon: 'alert-circle', color: SemanticColors.feedbackError },
    blocked: { icon: 'lock-closed', color: SemanticColors.feedbackError },
  };

  const s = statusIcon[node.status];

  return (
    <Pressable style={styles.nodeCard} onPress={onPress}>
      <View style={[styles.nodeIcon, { backgroundColor: node.color + '15' }]}>
        <Ionicons name={node.icon} size={18} color={node.color} />
      </View>
      <View style={styles.nodeContent}>
        <Text style={styles.nodeLabel} numberOfLines={1}>{node.label}</Text>
        {node.detail && <Text style={styles.nodeDetail} numberOfLines={1}>{node.detail}</Text>}
      </View>
      {node.timestamp && <Text style={styles.nodeTimestamp}>{node.timestamp}</Text>}
      <Ionicons name={s.icon} size={16} color={s.color} />
    </Pressable>
  );
}

function RequirementsList({ requirements }: { requirements: MockChain['requirements'] }) {
  return (
    <View style={styles.requirementsCard}>
      <View style={styles.sectionHeader}>
        <Ionicons name="shield-checkmark" size={16} color={Palette.hermesOrange} />
        <Text style={styles.sectionTitle}>Vereisten</Text>
      </View>
      {requirements.map((req, i) => (
        <View key={i} style={styles.requirementRow}>
          <Ionicons
            name={req.satisfied ? 'checkmark-circle' : 'ellipse-outline'}
            size={16}
            color={req.satisfied ? SemanticColors.feedbackSuccess : SemanticColors.textTertiary}
          />
          <Text style={[styles.requirementText, req.satisfied && styles.requirementSatisfied]}>{req.name}</Text>
        </View>
      ))}
    </View>
  );
}

function BlockersList({ blockers }: { blockers: string[] }) {
  if (blockers.length === 0) return null;
  return (
    <View style={styles.blockersCard}>
      <View style={styles.sectionHeader}>
        <Ionicons name="warning" size={16} color={SemanticColors.feedbackError} />
        <Text style={[styles.sectionTitle, { color: SemanticColors.feedbackError }]}>Blokkades voor betaling</Text>
      </View>
      {blockers.map((b, i) => (
        <View key={i} style={styles.blockerRow}>
          <View style={styles.blockerDot} />
          <Text style={styles.blockerText}>{b}</Text>
        </View>
      ))}
    </View>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function EvidenceGraphExplorer() {
  const [selectedChainId, setSelectedChainId] = useState(MOCK_CHAINS[0].jobId);
  const [expandedType, setExpandedType] = useState<NodeType | null>(null);

  const chain = useMemo(
    () => MOCK_CHAINS.find(c => c.jobId === selectedChainId) || MOCK_CHAINS[0],
    [selectedChainId]
  );

  // Group nodes by type
  const nodeGroups = useMemo(() => {
    const groups: { type: NodeType; label: string; icon: IconName; nodes: MockNode[] }[] = [
      { type: 'job', label: 'Klus', icon: 'construct', nodes: [] },
      { type: 'evidence', label: 'Bewijs', icon: 'camera', nodes: [] },
      { type: 'compliance', label: 'Compliance', icon: 'shield-checkmark', nodes: [] },
      { type: 'certification', label: 'Certificaten', icon: 'ribbon', nodes: [] },
      { type: 'payment', label: 'Betalingen', icon: 'card', nodes: [] },
    ];
    for (const node of chain.nodes) {
      const group = groups.find(g => g.type === node.type);
      if (group) group.nodes.push(node);
    }
    return groups.filter(g => g.nodes.length > 0);
  }, [chain]);

  const handleNodePress = (node: MockNode) => {
    Alert.alert(
      node.label,
      [
        `Type: ${node.type}`,
        `Status: ${node.status === 'verified' ? 'Geverifieerd' : node.status === 'pending' ? 'In afwachting' : node.status === 'missing' ? 'Ontbreekt' : 'Geblokkeerd'}`,
        node.detail ? `Detail: ${node.detail}` : '',
        node.timestamp ? `Datum: ${node.timestamp}` : '',
      ].filter(Boolean).join('\n'),
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="git-network" size={20} color={Palette.hermesOrange} />
        <Text style={styles.headerTitle}>Bewijsketen</Text>
      </View>

      {/* Chain Selector */}
      <ChainSelector chains={MOCK_CHAINS} selectedId={selectedChainId} onSelect={setSelectedChainId} />

      {/* Job Info */}
      <View style={styles.jobInfoCard}>
        <Text style={styles.jobInfoTitle}>{chain.jobTitle}</Text>
        <Text style={styles.jobInfoCustomer}>{chain.customer}</Text>
        <Text style={styles.jobInfoValue}>{formatCurrency(chain.totalValue)}</Text>
      </View>

      {/* Score */}
      <ComplianceScoreBadge score={chain.complianceScore} paymentReady={chain.paymentReady} />

      {/* Node Groups */}
      {nodeGroups.map((group) => (
        <View key={group.type} style={styles.nodeGroup}>
          <Pressable
            style={styles.groupHeader}
            onPress={() => setExpandedType(expandedType === group.type ? null : group.type)}
          >
            <View style={styles.groupHeaderLeft}>
              <Ionicons name={group.icon} size={16} color={SemanticColors.textSecondary} />
              <Text style={styles.groupTitle}>{group.label}</Text>
              <View style={styles.groupBadge}>
                <Text style={styles.groupBadgeText}>{group.nodes.length}</Text>
              </View>
            </View>
            <Ionicons
              name={expandedType === group.type ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={SemanticColors.textTertiary}
            />
          </Pressable>
          {(expandedType === group.type || expandedType === null) &&
            group.nodes.map((node) => (
              <GraphNodeCard key={node.id} node={node} onPress={() => handleNodePress(node)} />
            ))}
          {/* Connection lines */}
          {(expandedType === group.type || expandedType === null) && group.type !== 'payment' && (
            <View style={styles.connectionLine}>
              <Ionicons name="arrow-down" size={14} color={SemanticColors.borderDefault} />
            </View>
          )}
        </View>
      ))}

      {/* Requirements */}
      <RequirementsList requirements={chain.requirements} />

      {/* Blockers */}
      <BlockersList blockers={chain.blockers} />

      <View style={{ height: 40 }} />
    </ScrollView>
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
  content: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: Spacing.xs,
  },
  headerTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  // Chain selector
  chainSelector: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  chainTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.xl,
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    marginRight: 8,
  },
  chainTabActive: {
    borderColor: Palette.hermesOrange,
    backgroundColor: Palette.hermesOrange + '10',
  },
  chainTabDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chainTabText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textSecondary,
    maxWidth: 140,
  },
  chainTabTextActive: {
    color: SemanticColors.textPrimary,
    fontFamily: TYPE.titleFamily,
  },
  // Job info
  jobInfoCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  jobInfoTitle: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  jobInfoCustomer: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  jobInfoValue: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: Palette.hermesOrange,
    marginTop: 4,
  },
  // Score
  scoreRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  scoreCard: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  scoreValue: {
    fontSize: TYPE.displaySize,
    fontFamily: TYPE.displayFamily,
  },
  scoreLabel: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textTertiary,
  },
  // Node groups
  nodeGroup: {
    gap: 2,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupTitle: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  groupBadge: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  groupBadgeText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textTertiary,
  },
  // Node card
  nodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.sm,
    padding: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    marginBottom: 2,
  },
  nodeIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeContent: {
    flex: 1,
  },
  nodeLabel: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textPrimary,
  },
  nodeDetail: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textTertiary,
    marginTop: 1,
  },
  nodeTimestamp: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textTertiary,
  },
  // Connection
  connectionLine: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  // Requirements
  requirementsCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requirementText: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
  },
  requirementSatisfied: {
    color: SemanticColors.textTertiary,
    textDecorationLine: 'line-through',
  },
  // Blockers
  blockersCard: {
    backgroundColor: SemanticColors.feedbackErrorBg,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackErrorBorder,
    gap: 8,
  },
  blockerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  blockerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: SemanticColors.feedbackError,
  },
  blockerText: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textPrimary,
  },
});
