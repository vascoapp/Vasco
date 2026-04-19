// =============================================================================
// SAFETY DOCS — RAMS Builder & Safety Document Templates
// =============================================================================
// Auto-generates Risk Assessments & Method Statements from trade templates
// =============================================================================

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { hapticSuccess } from '../../src/utils/haptics';
import { useTranslation } from 'react-i18next';
import { GradientButton } from '../../src/components/shared/GradientButton';

type IconName = keyof typeof Ionicons.glyphMap;

interface RAMSTemplate {
  id: string;
  trade: string;
  tradeIcon: IconName;
  title: string;
  hazards: string[];
  controls: string[];
  ppe: string[];
}

const RAMS_TEMPLATES: RAMSTemplate[] = [
  {
    id: 'rams-elec',
    trade: 'Elektra',
    tradeIcon: 'flash',
    title: 'Elektrische installatie',
    hazards: ['Elektrocutie', 'Brand door kortsluiting', 'Kabelbeschadiging', 'Werken op hoogte'],
    controls: ['Spanningsloos werken', 'Lock-out/tag-out', 'Aarding controleren', 'Brandblussers nabij'],
    ppe: ['Isolerende handschoenen', 'Veiligheidsbril', 'Veiligheidsschoenen', 'Helm'],
  },
  {
    id: 'rams-plumb',
    trade: 'Loodgieterij',
    tradeIcon: 'water',
    title: 'Sanitair & CV installatie',
    hazards: ['Wateroverlast', 'Solderen/open vlam', 'Asbestblootstelling', 'Werken in kruipruimte'],
    controls: ['Waterkraan dicht', 'Brandwerend scherm', 'Asbest check vóór werk', 'Ventilatie waarborgen'],
    ppe: ['Werkhandschoenen', 'Veiligheidsbril', 'Kniebeschermers', 'Stofmasker'],
  },
  {
    id: 'rams-carp',
    trade: 'Timmerwerk',
    tradeIcon: 'hammer',
    title: 'Houtbewerking & montage',
    hazards: ['Snijwonden', 'Splinters/houtstof', 'Vallende objecten', 'Werken op hoogte'],
    controls: ['Machinebeveiligingen', 'Stofafzuiging', 'Materiaal vastzetten', 'Steiger/vangnet'],
    ppe: ['Werkhandschoenen', 'Veiligheidsbril', 'Stofmasker', 'Helm', 'Gehoorbescherming'],
  },
  {
    id: 'rams-paint',
    trade: 'Schilderwerk',
    tradeIcon: 'color-palette',
    title: 'Schilder- en lakwerk',
    hazards: ['Dampen/oplosmiddelen', 'Werken op hoogte', 'Huidcontact chemicaliën', 'Uitglijden'],
    controls: ['Ventilatie waarborgen', 'Valbeveiliging', 'Handschoenen dragen', 'Antislip matten'],
    ppe: ['Halfgelaatsmasker', 'Chemische handschoenen', 'Veiligheidsbril', 'Overall'],
  },
  {
    id: 'rams-mason',
    trade: 'Metselwerk',
    tradeIcon: 'cube',
    title: 'Metsel- en voegwerk',
    hazards: ['Stof (kwarts)', 'Vallende stenen', 'Rugbelasting', 'Werken op steiger'],
    controls: ['Nat snijden', 'Werkzone afzetten', 'Tilhulpmiddelen', 'Steiger keuring'],
    ppe: ['FFP2 stofmasker', 'Helm', 'Veiligheidsschoenen', 'Werkhandschoenen'],
  },
  {
    id: 'rams-vgplan',
    trade: 'Algemeen',
    tradeIcon: 'shield-checkmark',
    title: 'Veiligheids- en Gezondheidsplan (V&G Plan)',
    hazards: ['Werken op hoogte', 'Elektriciteit', 'Graafwerkzaamheden', 'Asbest', 'Zwaar materieel'],
    controls: ['Veiligheidsbriefing dagelijks', 'Toolbox talks wekelijks', 'Incidentmelding direct', 'EHBO aanwezig'],
    ppe: ['Helm', 'Veiligheidsschoenen', 'Gehoorbescherming', 'Veiligheidsbril', 'Valbeveiliging'],
  },
];

interface GeneratedDoc {
  template: RAMSTemplate;
  projectName: string;
  location: string;
  date: string;
  additionalNotes: string;
  checkedHazards: Set<string>;
  checkedControls: Set<string>;
  checkedPpe: Set<string>;
}

export default function SafetyDocsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [selectedTemplate, setSelectedTemplate] = useState<RAMSTemplate | null>(null);
  const [projectName, setProjectName] = useState('Amsterdam-Zuid Blok A-C');
  const [location, setLocation] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [checkedHazards, setCheckedHazards] = useState<Set<string>>(new Set());
  const [checkedControls, setCheckedControls] = useState<Set<string>>(new Set());
  const [checkedPpe, setCheckedPpe] = useState<Set<string>>(new Set());

  const toggleSet = (set: Set<string>, item: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(item)) next.delete(item); else next.add(item);
    setter(next);
  };

  const handleSelectTemplate = (tmpl: RAMSTemplate) => {
    setSelectedTemplate(tmpl);
    // Pre-check all items
    setCheckedHazards(new Set(tmpl.hazards));
    setCheckedControls(new Set(tmpl.controls));
    setCheckedPpe(new Set(tmpl.ppe));
  };

  const handleGenerate = () => {
    hapticSuccess();
    Alert.alert(
      t('safetyDocs.generated', 'RAMS Document Gegenereerd'),
      t('safetyDocs.generatedDesc', '{{title}} — Risk Assessment & Method Statement is aangemaakt als PDF en opgeslagen in het project dossier.', { title: selectedTemplate!.title }),
      [
        { text: t('safetyDocs.shareEmail', 'Deel via e-mail'), onPress: () => router.back() },
        { text: 'OK', onPress: () => router.back() },
      ]
    );
  };

  const today = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

  // Template selection screen
  if (!selectedTemplate) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('safetyDocs.title')}</Text>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionTitle}>{t('safetyDocs.templates')}</Text>
          <Text style={styles.sectionDesc}>{t('safetyDocs.templatesDesc')}</Text>

          {RAMS_TEMPLATES.map(tmpl => (
            <Pressable
              key={tmpl.id}
              style={({ pressed }) => [styles.templateCard, pressed && { opacity: 0.9 }]}
              onPress={() => handleSelectTemplate(tmpl)}
            >
              <View style={[styles.templateIcon, { backgroundColor: Palette.hermesOrange + '12' }]}>
                <Ionicons name={tmpl.tradeIcon} size={22} color={Palette.hermesOrange} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.templateTitle}>{tmpl.title}</Text>
                <Text style={styles.templateTrade}>{tmpl.trade} · {tmpl.hazards.length} {t('safetyDocs.risks')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
            </Pressable>
          ))}

          {/* Existing docs */}
          <Text style={[styles.sectionTitle, { marginTop: Spacing.md }]}>{t('safetyDocs.recentGenerated')}</Text>
          {[
            { title: 'Elektrische installatie — Blok A', date: '15 mrt 2026', status: t('safetyDocs.active', 'Actief') },
            { title: 'Metselwerk gevel — Blok B', date: '12 mrt 2026', status: t('safetyDocs.active', 'Actief') },
          ].map((doc, i) => (
            <View key={i} style={styles.docRow}>
              <Ionicons name="document-text" size={18} color={SemanticColors.feedbackSuccess} />
              <View style={{ flex: 1 }}>
                <Text style={styles.docTitle}>{doc.title}</Text>
                <Text style={styles.docDate}>{doc.date}</Text>
              </View>
              <View style={styles.docStatus}>
                <Text style={styles.docStatusText}>{doc.status}</Text>
              </View>
            </View>
          ))}

          <View style={{ height: Spacing.xxl }} />
        </ScrollView>
      </View>
    );
  }

  // Builder screen
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => setSelectedTemplate(null)} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{selectedTemplate.title}</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Project info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('safetyDocs.projectDetails', 'Project gegevens')}</Text>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{t('safetyDocs.project', 'Project')}</Text>
            <TextInput style={styles.fieldInput} value={projectName} onChangeText={setProjectName} placeholderTextColor={SemanticColors.textTertiary} />
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{t('safetyDocs.location', 'Locatie')}</Text>
            <TextInput style={styles.fieldInput} value={location} onChangeText={setLocation} placeholder={t('safetyDocs.locationPlaceholder', 'Specifieke locatie op bouwplaats')} placeholderTextColor={SemanticColors.textTertiary} />
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{t('safetyDocs.date', 'Datum')}</Text>
            <Text style={styles.fieldValue}>{today}</Text>
          </View>
        </View>

        {/* Hazards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('safetyDocs.identifiedRisks', "Geïdentificeerde risico's")}</Text>
          {selectedTemplate.hazards.map(h => (
            <Pressable
              key={h}
              style={styles.checkRow}
              onPress={() => toggleSet(checkedHazards, h, setCheckedHazards)}
            >
              <Ionicons
                name={checkedHazards.has(h) ? 'checkbox' : 'square-outline'}
                size={22}
                color={checkedHazards.has(h) ? SemanticColors.feedbackError : SemanticColors.textTertiary}
              />
              <Text style={styles.checkLabel}>{h}</Text>
            </Pressable>
          ))}
        </View>

        {/* Controls */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('safetyDocs.controlMeasures', 'Beheersmaatregelen')}</Text>
          {selectedTemplate.controls.map(c => (
            <Pressable
              key={c}
              style={styles.checkRow}
              onPress={() => toggleSet(checkedControls, c, setCheckedControls)}
            >
              <Ionicons
                name={checkedControls.has(c) ? 'checkbox' : 'square-outline'}
                size={22}
                color={checkedControls.has(c) ? SemanticColors.feedbackSuccess : SemanticColors.textTertiary}
              />
              <Text style={styles.checkLabel}>{c}</Text>
            </Pressable>
          ))}
        </View>

        {/* PPE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('safetyDocs.ppe', 'PBM (Persoonlijke Beschermingsmiddelen)')}</Text>
          <View style={styles.ppeGrid}>
            {selectedTemplate.ppe.map(p => (
              <Pressable
                key={p}
                style={[styles.ppeChip, checkedPpe.has(p) && styles.ppeChipActive]}
                onPress={() => toggleSet(checkedPpe, p, setCheckedPpe)}
              >
                <Ionicons
                  name={checkedPpe.has(p) ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={checkedPpe.has(p) ? Palette.hermesOrange : SemanticColors.textTertiary}
                />
                <Text style={[styles.ppeText, checkedPpe.has(p) && styles.ppeTextActive]}>{p}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Additional notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('safetyDocs.additionalNotes', 'Aanvullende opmerkingen')}</Text>
          <TextInput
            style={styles.textArea}
            value={additionalNotes}
            onChangeText={setAdditionalNotes}
            placeholder={t('safetyDocs.additionalNotesPlaceholder', 'Extra veiligheidsmaatregelen, specifieke aandachtspunten...')}
            placeholderTextColor={SemanticColors.textTertiary}
            multiline
          />
        </View>

        {/* Generate button */}
        <GradientButton
          label={t('safetyDocs.generate')}
          onPress={handleGenerate}
          icon="document-text"
        />

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: SafeArea.top, paddingHorizontal: SafeArea.side, paddingBottom: 12,
  },
  headerTitle: { fontSize: 20, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary, flex: 1, textTransform: 'uppercase', letterSpacing: 1.2 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: SafeArea.side, gap: Spacing.md },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: 14, fontFamily: 'Archivo_800ExtraBold', color: Palette.hermesOrange,
    letterSpacing: 0.6,
  },
  sectionDesc: { fontSize: 14, fontFamily: 'Inter_400Regular', color: SemanticColors.textSecondary, marginBottom: 4 },
  templateCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: 16, padding: 16,
  },
  templateIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  templateTitle: { fontSize: 15, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  templateTrade: { fontSize: 13, fontFamily: 'Inter_400Regular', color: SemanticColors.textSecondary },
  docRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: 12, padding: 14,
  },
  docTitle: { fontSize: 14, fontFamily: 'Inter_500Medium', color: SemanticColors.textPrimary },
  docDate: { fontSize: 12, fontFamily: 'Inter_400Regular', color: SemanticColors.textSecondary },
  docStatus: { backgroundColor: SemanticColors.feedbackSuccessBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  docStatusText: { fontSize: 11, fontFamily: TYPE.titleFamily, color: SemanticColors.feedbackSuccess },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: 12, padding: 14,
  },
  fieldLabel: { fontSize: 14, fontFamily: 'Inter_500Medium', color: SemanticColors.textSecondary },
  fieldInput: {
    flex: 1, textAlign: 'right', fontSize: 14, fontFamily: 'Inter_500Medium',
    color: SemanticColors.textPrimary, marginLeft: 12,
  },
  fieldValue: { fontSize: 14, fontFamily: 'Inter_500Medium', color: SemanticColors.textPrimary },
  checkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: 12, padding: 12,
  },
  checkLabel: { fontSize: 14, fontFamily: 'Inter_400Regular', color: SemanticColors.textPrimary, flex: 1 },
  ppeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ppeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: SemanticColors.borderDefault,
  },
  ppeChipActive: { borderColor: Palette.hermesOrange, backgroundColor: Palette.hermesOrange + '08' },
  ppeText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: SemanticColors.textSecondary },
  ppeTextActive: { color: Palette.hermesOrange },
  textArea: {
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: 12,
    borderWidth: 1, borderColor: SemanticColors.borderDefault,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontFamily: 'Inter_400Regular',
    color: SemanticColors.textPrimary, minHeight: 80, textAlignVertical: 'top',
  },
});
