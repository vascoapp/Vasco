// =============================================================================
// REASONING MODE - "Waarom?" button with expandable AI reasoning explanation
// =============================================================================
// Reusable component that reveals the AI reasoning behind any recommendation,
// metric, or data point. Shows numbered steps, data sources, confidence level,
// and a feedback mechanism.
// =============================================================================

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ============================================
// TYPES
// ============================================

export interface ReasoningData {
  steps: string[];
  sources: string[];
  confidence: number; // 0–100
  conclusion: string;
}

interface ReasoningModeProps {
  reasoning: ReasoningData;
  /** Optional label override — defaults to "Waarom?" */
  label?: string;
  /** Compact chip variant (default) vs inline variant */
  variant?: 'chip' | 'inline';
  /** Called when the user taps a feedback button */
  onFeedback?: (helpful: boolean) => void;
}

// ============================================
// HELPERS
// ============================================

function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return SemanticColors.feedbackSuccess;
  if (confidence >= 50) return SemanticColors.feedbackWarning;
  return SemanticColors.feedbackError;
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 90) return 'Zeer hoog';
  if (confidence >= 75) return 'Hoog';
  if (confidence >= 50) return 'Gemiddeld';
  if (confidence >= 25) return 'Laag';
  return 'Zeer laag';
}

// ============================================
// COMPONENT
// ============================================

export function ReasoningMode({
  reasoning,
  label = 'Waarom?',
  variant = 'chip',
  onFeedback,
}: ReasoningModeProps) {
  const [expanded, setExpanded] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<boolean | null>(null);

  const toggleExpand = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => !prev);
  }, []);

  const handleFeedback = useCallback((helpful: boolean) => {
    setFeedbackGiven(helpful);
    onFeedback?.(helpful);
  }, [onFeedback]);

  const confidenceColor = getConfidenceColor(reasoning.confidence);
  const confidenceLabel = getConfidenceLabel(reasoning.confidence);

  // ---- Collapsed: chip or inline trigger ----
  if (!expanded) {
    if (variant === 'inline') {
      return (
        <Pressable style={styles.inlineTrigger} onPress={toggleExpand} hitSlop={8}>
          <Ionicons name="help-circle-outline" size={14} color={Palette.hermesOrange} />
          <Text style={styles.inlineTriggerText}>{label}</Text>
        </Pressable>
      );
    }

    return (
      <Pressable style={styles.chip} onPress={toggleExpand} hitSlop={6}>
        <Ionicons name="bulb-outline" size={13} color={Palette.hermesOrange} />
        <Text style={styles.chipText}>{label}</Text>
        <Ionicons name="chevron-down" size={12} color={SemanticColors.textTertiary} />
      </Pressable>
    );
  }

  // ---- Expanded: full reasoning panel ----
  return (
    <View style={styles.panel}>
      {/* Panel Header */}
      <Pressable style={styles.panelHeader} onPress={toggleExpand}>
        <View style={styles.panelHeaderLeft}>
          <View style={styles.panelIcon}>
            <Ionicons name="bulb" size={14} color={Palette.hermesOrange} />
          </View>
          <Text style={styles.panelTitle}>AI Redenering</Text>
        </View>
        <Ionicons name="chevron-up" size={16} color={SemanticColors.textTertiary} />
      </Pressable>

      {/* Conclusion */}
      <View style={styles.conclusionContainer}>
        <Text style={styles.conclusionText}>{reasoning.conclusion}</Text>
      </View>

      {/* Reasoning Steps */}
      <View style={styles.stepsContainer}>
        <Text style={styles.sectionLabel}>Redeneerstappen</Text>
        {reasoning.steps.map((step, index) => (
          <View key={index} style={styles.stepRow}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{index + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      {/* Data Sources */}
      <View style={styles.sourcesContainer}>
        <Text style={styles.sectionLabel}>Databronnen</Text>
        <View style={styles.sourcesList}>
          {reasoning.sources.map((source, index) => (
            <View key={index} style={styles.sourceTag}>
              <Ionicons name="document-text-outline" size={11} color={SemanticColors.textSecondary} />
              <Text style={styles.sourceText}>{source}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Confidence Level */}
      <View style={styles.confidenceContainer}>
        <Text style={styles.sectionLabel}>Betrouwbaarheid</Text>
        <View style={styles.confidenceRow}>
          <View style={styles.confidenceBarTrack}>
            <View
              style={[
                styles.confidenceBar,
                {
                  width: `${reasoning.confidence}%`,
                  backgroundColor: confidenceColor,
                },
              ]}
            />
          </View>
          <Text style={[styles.confidenceValue, { color: confidenceColor }]}>
            {reasoning.confidence}%
          </Text>
        </View>
        <Text style={styles.confidenceLabel}>{confidenceLabel}</Text>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Feedback */}
      {feedbackGiven === null ? (
        <View style={styles.feedbackContainer}>
          <Text style={styles.feedbackQuestion}>Was dit nuttig?</Text>
          <View style={styles.feedbackButtons}>
            <Pressable
              style={styles.feedbackButton}
              onPress={() => handleFeedback(true)}
              hitSlop={6}
            >
              <Ionicons name="thumbs-up-outline" size={16} color={SemanticColors.feedbackSuccess} />
              <Text style={[styles.feedbackButtonText, { color: SemanticColors.feedbackSuccess }]}>Ja</Text>
            </Pressable>
            <Pressable
              style={styles.feedbackButton}
              onPress={() => handleFeedback(false)}
              hitSlop={6}
            >
              <Ionicons name="thumbs-down-outline" size={16} color={SemanticColors.feedbackError} />
              <Text style={[styles.feedbackButtonText, { color: SemanticColors.feedbackError }]}>Nee</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.feedbackThanks}>
          <Ionicons name="checkmark-circle" size={14} color={SemanticColors.feedbackSuccess} />
          <Text style={styles.feedbackThanksText}>Bedankt voor je feedback!</Text>
        </View>
      )}
    </View>
  );
}

// ============================================
// HOOK: useReasoningMode
// ============================================
// Generates mock reasoning data for any metric or insight context.
// In production this would call the AI reasoning engine.
// ============================================

type ReasoningContext =
  | 'savings_total'
  | 'savings_potential'
  | 'price_alert'
  | 'profitability'
  | 'win_rate'
  | 'tco_comparison'
  | 'supplier_negotiation'
  | 'predictive_saving';

const REASONING_LIBRARY: Record<ReasoningContext, ReasoningData> = {
  savings_total: {
    steps: [
      'Alle bonnen en facturen van deze maand zijn verzameld en gecategoriseerd.',
      'Prijzen zijn vergeleken met de gemiddelde marktprijs per materiaal.',
      'Bulk-kortingen en actieaankopen zijn apart gemarkeerd.',
      'Het verschil tussen betaalde prijs en marktgemiddelde is berekend als besparing.',
    ],
    sources: [
      'Bonscanner data (23 bonnen)',
      'Leverancier prijslijsten',
      'Marktprijzen database',
      'Historische aankoopdata',
    ],
    confidence: 87,
    conclusion:
      'Je hebt deze maand voornamelijk bespaard door slim in te kopen bij Bouwmaat tijdens de actieweek en door bulk-aankopen bij Technische Unie.',
  },
  savings_potential: {
    steps: [
      'Komende projecten en hun materiaallijsten zijn geanalyseerd.',
      'Huidige leveranciersprijzen zijn vergeleken met alternatieven.',
      'Seizoensgebonden prijsdalingen zijn meegenomen in de berekening.',
      'Bulk-mogelijkheden over meerdere projecten zijn gecombineerd.',
    ],
    sources: [
      'Geplande projecten (4 actief)',
      'Prijsmonitoring 12 leveranciers',
      'Seizoenstrends (3 jaar data)',
      'Voorraadniveaus leveranciers',
    ],
    confidence: 72,
    conclusion:
      'De grootste bespaarkans zit in het combineren van materiaalbestellingen voor je komende 3 projecten. Bestel voor 15 maart om seizoenskorting te pakken.',
  },
  price_alert: {
    steps: [
      'Prijsmonitor heeft een daling gedetecteerd bij leverancier.',
      'De huidige prijs is vergeleken met het 90-daags gemiddelde.',
      'Historisch kooppatroon laat zien dat je dit materiaal regelmatig nodig hebt.',
      'Voorraadniveaus bij de leverancier zijn gecontroleerd — beperkte voorraad.',
    ],
    sources: [
      'Prijsmonitor (dagelijks)',
      'Jouw aankoopgeschiedenis',
      'Leverancier API',
      'Marktprijzen index',
    ],
    confidence: 91,
    conclusion:
      'Dit is een ongebruikelijk lage prijs voor dit product. Op basis van je gebruikspatroon raad ik aan om nu in te slaan.',
  },
  profitability: {
    steps: [
      'Alle projecten van de afgelopen 6 maanden zijn geanalyseerd op marge.',
      'Directe kosten (materiaal, arbeid) en indirecte kosten zijn toegerekend.',
      'Marges zijn vergeleken per klustype en opdrachtgever.',
      'Trends in margedruk door materiaalprijsstijgingen zijn meegewogen.',
    ],
    sources: [
      'Projectadministratie (18 projecten)',
      'Facturen & bonnen',
      'Urenregistratie',
      'Marktprijzen trends',
    ],
    confidence: 84,
    conclusion:
      'Badkamerrenovaties leveren de hoogste marge op (38%). Kleine reparaties kosten relatief veel reistijd waardoor de marge daalt naar 12%.',
  },
  win_rate: {
    steps: [
      'Alle offertes van de afgelopen 3 maanden zijn vergeleken met de uitkomst.',
      'Factoren zoals prijs, reactiesnelheid en reviews zijn gewogen.',
      'Je scores zijn vergeleken met het gemiddelde in jouw regio en vakgebied.',
      'Klantfeedback na afwijzing is meegenomen waar beschikbaar.',
    ],
    sources: [
      'Offertegeschiedenis (24 offertes)',
      'Klantfeedback (8 reacties)',
      'Regionale benchmark data',
      'Review scores (Google, Werkspot)',
    ],
    confidence: 68,
    conclusion:
      'Je wint vooral op kwaliteit en betrouwbaarheid. Op prijs scoor je iets hoger dan het gemiddelde — overweeg scherpere tarieven bij grotere projecten.',
  },
  tco_comparison: {
    steps: [
      'Aanschafprijs, installatiekosten en verwacht onderhoud zijn berekend.',
      'Levensduur per optie is geschat op basis van fabrikantdata en ervaring.',
      'Energieverbruik en efficiëntie over de levensduur zijn meegenomen.',
      'Totale kosten zijn teruggerekend naar kosten per jaar.',
    ],
    sources: [
      'Fabrikant specificaties',
      'Installatie-ervaringsdata',
      'Energieprijzen (huidige + prognose)',
      'Onderhoudshistorie soortgelijke producten',
    ],
    confidence: 79,
    conclusion:
      'Hoewel de budget-optie goedkoper is in aanschaf, is de premium optie na 3 jaar voordeliger door lager onderhoud en energieverbruik.',
  },
  supplier_negotiation: {
    steps: [
      'Je aankoopvolume bij deze leverancier is berekend over 12 maanden.',
      'Beschikbare volume-kortingen zijn geïdentificeerd.',
      'Alternatieve leveranciers met betere tarieven zijn in kaart gebracht.',
      'Onderhandelingsmogelijkheden zijn beoordeeld op basis van je positie.',
    ],
    sources: [
      'Aankoophistorie (12 maanden)',
      'Leveranciersvoorwaarden',
      'Marktprijzen concurrenten',
      'Branche-benchmarks',
    ],
    confidence: 75,
    conclusion:
      'Met je huidige volume kun je waarschijnlijk 5-8% korting bedingen. Combineer dit met een langere afnameovereenkomst voor het beste resultaat.',
  },
  predictive_saving: {
    steps: [
      'Seizoenspatronen in materiaalkosten zijn geanalyseerd.',
      'Je aankomende projectplanning is gekoppeld aan verwachte bestellingen.',
      'Prijsvoorspellingen zijn gegenereerd op basis van markttrends.',
      'Optimale bestelmomenten zijn berekend per materiaalcategorie.',
    ],
    sources: [
      'Prijshistorie (3 jaar)',
      'Seizoenstrends per materiaal',
      'Projectplanning (komende 3 maanden)',
      'Leverancier actieplanning',
    ],
    confidence: 66,
    conclusion:
      'Door je bestellingen 2 weken te vervroegen kun je profiteren van de voorjaarsacties bij meerdere leveranciers tegelijk.',
  },
};

/**
 * Hook that returns ReasoningData for a given context.
 * In production this would call the AI reasoning engine to generate
 * context-specific reasoning. Currently returns curated mock data.
 */
export function useReasoningMode(context: ReasoningContext): ReasoningData {
  return REASONING_LIBRARY[context];
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  // Chip trigger (collapsed)
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: RADIUS.lg,
    backgroundColor: Palette.hermesOrange + '12',
    borderWidth: 1,
    borderColor: Palette.hermesOrange + '25',
  },
  chipText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
    color: Palette.hermesOrange,
  },

  // Inline trigger (collapsed)
  inlineTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  inlineTriggerText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.labelFamily,
    color: Palette.hermesOrange,
    textDecorationLine: 'underline',
  },

  // Expanded panel
  panel: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: Palette.hermesOrange + '30',
    overflow: 'hidden',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Palette.hermesOrange + '08',
  },
  panelHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  panelIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Palette.hermesOrange + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelTitle: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },

  // Conclusion
  conclusionContainer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  conclusionText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textPrimary,
    lineHeight: 19,
  },

  // Steps
  stepsContainer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    gap: 8,
  },
  sectionLabel: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  stepNumber: {
    width: 20,
    height: 20,
    borderRadius: RADIUS.sm,
    backgroundColor: Palette.hermesOrange + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumberText: {
    fontSize: TYPE.tinySize - 1,
    fontFamily: TYPE.sectionFamily,
    color: Palette.hermesOrange,
  },
  stepText: {
    flex: 1,
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    lineHeight: 17,
  },

  // Sources
  sourcesContainer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    gap: 6,
  },
  sourcesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 6,
  },
  sourceText: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
  },

  // Confidence
  confidenceContainer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    gap: 4,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confidenceBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  confidenceBar: {
    height: 6,
    borderRadius: 3,
  },
  confidenceValue: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.sectionFamily,
    width: 36,
    textAlign: 'right',
  },
  confidenceLabel: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textTertiary,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: SemanticColors.borderMuted,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },

  // Feedback
  feedbackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  feedbackQuestion: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textTertiary,
  },
  feedbackButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  feedbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RADIUS.sm,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  feedbackButtonText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
  },
  feedbackThanks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  feedbackThanksText: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.feedbackSuccess,
    fontFamily: TYPE.labelFamily,
  },
});
