import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../../src/theme/colors';
import { Spacing, SafeArea } from '../../../src/theme/spacing';
import { hapticSuccess } from '../../../src/utils/haptics';

// Site Lead palette (references Palette where possible)
const SL_COLORS = {
  terracotta: Palette.hermesOrange,
  charcoal: SemanticColors.textPrimary,
  sand: SemanticColors.surfaceBackground,
  sandDark: SemanticColors.surfaceSecondary,
  cream: SemanticColors.surfacePrimary,
  warmGray: SemanticColors.textSecondary,
};



interface Team {
  name: string;
  trade: string;
  tradeIcon: keyof typeof Ionicons.glyphMap;
  lead: string;
  members: string[];
  task: string;
  location: string;
  progress: number;
  status: 'on-track' | 'behind' | 'at-risk' | 'completed';
}

const TEAMS: Record<string, Team> = {
  'wt-1': {
    name: 'Elektra Team A',
    trade: 'Elektricien',
    tradeIcon: 'flash',
    lead: 'Mohammed Al-Rashid',
    members: ['Mohammed Al-Rashid', 'Ahmed Khalil', 'Tom Hendriks'],
    task: 'Bekabeling 2e verdieping',
    location: 'Blok A - Verdieping 2',
    progress: 72,
    status: 'on-track',
  },
  'wt-2': {
    name: 'Loodgieter Team',
    trade: 'Loodgieter',
    tradeIcon: 'water',
    lead: 'Pieter de Groot',
    members: ['Pieter de Groot', 'Mark Jansen'],
    task: 'Sanitair installatie badkamers',
    location: 'Blok B - Verdieping 1',
    progress: 45,
    status: 'behind',
  },
  'wt-3': {
    name: 'Timmerwerk',
    trade: 'Timmerman',
    tradeIcon: 'hammer',
    lead: 'Erik Jansen',
    members: ['Erik Jansen', 'Bas Smit', 'Leo Visser', 'Henk de Boer'],
    task: 'Kozijnen plaatsen begane grond',
    location: 'Blok A - Begane grond',
    progress: 88,
    status: 'on-track',
  },
  'wt-4': {
    name: 'Schilders',
    trade: 'Schilder',
    tradeIcon: 'color-palette',
    lead: 'Lisa Bakker',
    members: ['Lisa Bakker', 'Nina van Dijk'],
    task: 'Binnenschilderwerk kantoren',
    location: 'Blok C - Verdieping 3',
    progress: 30,
    status: 'at-risk',
  },
  'wt-5': {
    name: 'Metselwerk',
    trade: 'Metselaar',
    tradeIcon: 'cube',
    lead: 'Jan van Bergen',
    members: ['Jan van Bergen', 'Koen Bakker', 'Sander Mulder'],
    task: 'Gevelstenen buitenmuur',
    location: 'Blok B - Buitenzijde',
    progress: 100,
    status: 'completed',
  },
};

const MEMBER_STATUS: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  beschikbaar: { label: 'Beschikbaar', color: SemanticColors.feedbackSuccess, bgColor: SemanticColors.feedbackSuccessBg },
  bezig: { label: 'Bezig', color: Palette.hermesOrange, bgColor: Palette.hermesOrange + '12' },
  pauze: { label: 'Pauze', color: SemanticColors.textSecondary, bgColor: SemanticColors.surfaceSecondary },
  ziek: { label: 'Ziek', color: SemanticColors.feedbackError, bgColor: SemanticColors.feedbackErrorBg },
};

const SCHEDULE_BLOCKS = [
  {
    start: '08:00',
    end: '10:30',
    task: 'Bekabeling bovenmuur',
    progress: 100,
    assignedTo: 'Mohammed Al-Rashid, Ahmed Khalil',
  },
  {
    start: '10:45',
    end: '12:30',
    task: 'Kabelkanalen installeren',
    progress: 65,
    assignedTo: 'Gehele team',
  },
  {
    start: '13:30',
    end: '16:00',
    task: 'Aansluiting schakelpaneel',
    progress: 15,
    assignedTo: 'Mohammed Al-Rashid, Tom Hendriks',
  },
  {
    start: '16:00',
    end: '17:00',
    task: 'Opruimen en gereedschap check',
    progress: 0,
    assignedTo: 'Gehele team',
  },
];

const PROGRESS_NOTES = [
  { time: '14:15', note: 'Schakelpaneel aansluiting gestart' },
  { time: '12:45', note: 'Lunchpauze afgerond, hervatten om 13:30' },
  { time: '10:30', note: 'Bekabeling bovenmuur 100% gereed' },
  { time: '09:15', note: 'Extra kabels ontvangen van magazijn' },
  { time: '08:05', note: 'Team compleet aanwezig, werkdag gestart' },
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getMemberStatus(
  index: number
): keyof typeof MEMBER_STATUS {
  const statuses: (keyof typeof MEMBER_STATUS)[] = [
    'bezig',
    'beschikbaar',
    'bezig',
    'pauze',
  ];
  return statuses[index % statuses.length];
}

export default function TeamPlanningScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const team = TEAMS[id || 'wt-1'];

  if (!team) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Team niet gevonden</Text>
      </View>
    );
  }

  const statusColors = {
    'on-track': SemanticColors.feedbackSuccess,
    behind: SemanticColors.feedbackError,
    'at-risk': SemanticColors.feedbackWarning,
    completed: SemanticColors.textSecondary,
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color={SL_COLORS.charcoal} />
          </Pressable>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>{team.name}</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>Planning</Text>
          </View>
        </View>

        {/* Team Info Card */}
        <View style={[styles.card, styles.teamInfoCard]}>
          <View style={styles.teamInfoHeader}>
            <View
              style={[
                styles.tradeIconCircle,
                { backgroundColor: SL_COLORS.sandDark },
              ]}
            >
              <Ionicons
                name={team.tradeIcon}
                size={24}
                color={SL_COLORS.terracotta}
              />
            </View>
            <View style={styles.teamInfoHeaderText}>
              <Text style={styles.teamInfoTitle} numberOfLines={1}>{team.trade}</Text>
              <Text style={styles.teamInfoSubtitle}>
                {team.members.length} teamleden
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusColors[team.status] + '20' },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: statusColors[team.status] },
                ]}
              />
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.teamInfoRow}>
            <Ionicons name="person" size={16} color={SL_COLORS.warmGray} />
            <Text style={styles.teamInfoLabel}>Teamleider:</Text>
            <Text style={styles.teamInfoValue} numberOfLines={1}>{team.lead}</Text>
          </View>

          <View style={styles.teamInfoRow}>
            <Ionicons name="construct" size={16} color={SL_COLORS.warmGray} />
            <Text style={styles.teamInfoLabel}>Huidige taak:</Text>
            <Text style={styles.teamInfoValue} numberOfLines={1}>{team.task}</Text>
          </View>

          <View style={styles.teamInfoRow}>
            <Ionicons name="location" size={16} color={SL_COLORS.warmGray} />
            <Text style={styles.teamInfoLabel}>Locatie:</Text>
            <Text style={styles.teamInfoValue} numberOfLines={1}>{team.location}</Text>
          </View>

          <View style={styles.progressContainer}>
            <Text style={styles.progressLabel}>Voortgang</Text>
            <Text style={styles.progressPercentage}>{team.progress}%</Text>
          </View>
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${team.progress}%`,
                  backgroundColor: SL_COLORS.terracotta,
                },
              ]}
            />
          </View>
        </View>

        {/* Team Members */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Teamleden</Text>
        </View>

        <View style={styles.card}>
          {team.members.map((member, index) => {
            const status = getMemberStatus(index);
            const statusInfo = MEMBER_STATUS[status];

            return (
              <View
                key={member}
                style={[
                  styles.memberRow,
                  index < team.members.length - 1 && styles.memberRowBorder,
                ]}
              >
                <View
                  style={[
                    styles.memberAvatar,
                    { backgroundColor: SL_COLORS.sandDark },
                  ]}
                >
                  <Text style={styles.memberInitials}>
                    {getInitials(member)}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName} numberOfLines={1}>{member}</Text>
                  <Text style={styles.memberRole}>{team.trade}</Text>
                </View>
                <View
                  style={[
                    styles.memberStatusBadge,
                    { backgroundColor: statusInfo.bgColor },
                  ]}
                >
                  <Text
                    style={[
                      styles.memberStatusText,
                      { color: statusInfo.color },
                    ]}
                  >
                    {statusInfo.label}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Planning Agenda */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Planning Vandaag</Text>
          <Text style={styles.sectionDate}>
            {new Date().toLocaleDateString(undefined, {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
          </Text>
        </View>

        <View style={styles.card}>
          {SCHEDULE_BLOCKS.map((block, index) => (
            <View
              key={index}
              style={[
                styles.scheduleBlock,
                index < SCHEDULE_BLOCKS.length - 1 && styles.scheduleBlockBorder,
              ]}
            >
              <View style={styles.scheduleTimeColumn}>
                <Text style={styles.scheduleTime}>{block.start}</Text>
                <View style={styles.scheduleTimeline}>
                  <View
                    style={[
                      styles.scheduleTimelineDot,
                      {
                        backgroundColor:
                          block.progress === 100
                            ? '#16A34A'
                            : block.progress > 0
                            ? SL_COLORS.terracotta
                            : SL_COLORS.warmGray,
                      },
                    ]}
                  />
                  {index < SCHEDULE_BLOCKS.length - 1 && (
                    <View style={styles.scheduleTimelineLine} />
                  )}
                </View>
                <Text style={styles.scheduleTime}>{block.end}</Text>
              </View>

              <View style={styles.scheduleContent}>
                <Text style={styles.scheduleTask} numberOfLines={1}>{block.task}</Text>
                <Text style={styles.scheduleAssigned} numberOfLines={1}>{block.assignedTo}</Text>
                <View style={styles.scheduleProgressRow}>
                  <View style={styles.scheduleProgressBarBg}>
                    <View
                      style={[
                        styles.scheduleProgressBarFill,
                        {
                          width: `${block.progress}%`,
                          backgroundColor:
                            block.progress === 100
                              ? '#16A34A'
                              : SL_COLORS.terracotta,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.scheduleProgressText}>
                    {block.progress}%
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* AI Scheduling Section */}
        <Pressable
          style={styles.aiSuggestionCard}
          onPress={() =>
            Alert.alert(
              'AI Inzet Suggestie',
              'Vasco kan automatisch werknemer-vervangingen voorstellen op basis van:\n\n• Weersomstandigheden\n• Projectprioriteiten\n• Feestdagen en verlof\n• Ziekteverzuim\n• Capaciteitsplanning'
            )
          }
        >
          <View
            style={[
              styles.aiIconCircle,
              { backgroundColor: SL_COLORS.terracotta },
            ]}
          >
            <Ionicons name="sparkles" size={20} color={SL_COLORS.cream} />
          </View>
          <View style={styles.aiTextContainer}>
            <Text style={styles.aiTitle} numberOfLines={1}>AI Inzet Suggestie</Text>
            <Text style={styles.aiSubtitle} numberOfLines={2}>
              Vasco kan substituten voorstellen op basis van weer, prioriteiten
              en feestdagen
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={SL_COLORS.warmGray}
          />
        </Pressable>

        {/* Progress Notes */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Voortgangsnotities</Text>
        </View>

        <View style={styles.card}>
          {PROGRESS_NOTES.map((note, index) => (
            <View
              key={index}
              style={[
                styles.noteRow,
                index < PROGRESS_NOTES.length - 1 && styles.noteRowBorder,
              ]}
            >
              <Text style={styles.noteTime}>{note.time}</Text>
              <Text style={styles.noteText} numberOfLines={2}>{note.note}</Text>
            </View>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <Pressable
            style={[styles.actionButton, styles.actionButtonPrimary]}
            onPress={() =>
              Alert.alert(
                'Werknemer Vervangen',
                'Selecteer een werknemer om te vervangen en kies een vervanger.'
              )
            }
          >
            <Ionicons
              name="people"
              size={20}
              color={SL_COLORS.cream}
              style={styles.actionButtonIcon}
            />
            <Text style={styles.actionButtonTextPrimary}>
              Werknemer Vervangen
            </Text>
          </Pressable>

          <Pressable
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={() =>
              Alert.alert(
                'Notitie Toevoegen',
                'Voeg een voortgangsnotitie toe voor dit team.'
              )
            }
          >
            <Ionicons
              name="create-outline"
              size={20}
              color={SL_COLORS.terracotta}
              style={styles.actionButtonIcon}
            />
            <Text style={styles.actionButtonTextSecondary}>
              Notitie Toevoegen
            </Text>
          </Pressable>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SL_COLORS.sand,
  },
  scrollView: {
    flex: 1,
  },
  errorText: {
    fontSize: 16,
    color: SL_COLORS.charcoal,
    textAlign: 'center',
    marginTop: 100,
  },

  // Header
  header: {
    paddingTop: SafeArea.top,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: SL_COLORS.cream,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: SL_COLORS.sandDark,
  },
  backButton: {
    padding: Spacing.sm,
    marginRight: Spacing.sm,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'Archivo_800ExtraBold',
    color: SL_COLORS.charcoal, textTransform: 'uppercase', letterSpacing: 1.2 },
  headerSubtitle: {
    fontSize: 14,
    color: SL_COLORS.warmGray,
    marginTop: 2,
  },

  // Card
  card: {
    backgroundColor: SL_COLORS.cream,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: 12,
    padding: Spacing.lg,
  },

  // Team Info Card
  teamInfoCard: {
    marginTop: Spacing.lg,
  },
  teamInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  tradeIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  teamInfoHeaderText: {
    flex: 1,
  },
  teamInfoTitle: {
    fontSize: 18,
    fontFamily: 'Archivo_700Bold',
    color: SL_COLORS.charcoal,
  },
  teamInfoSubtitle: {
    fontSize: 14,
    color: SL_COLORS.warmGray,
    marginTop: 2,
  },
  statusBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  divider: {
    height: 1,
    backgroundColor: SL_COLORS.sandDark,
    marginBottom: Spacing.md,
  },
  teamInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  teamInfoLabel: {
    fontSize: 14,
    color: SL_COLORS.warmGray,
    marginLeft: Spacing.sm,
    marginRight: Spacing.xs,
  },
  teamInfoValue: {
    fontSize: 14,
    color: SL_COLORS.charcoal,
    fontFamily: 'Inter_600SemiBold',
    flex: 1,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  progressLabel: {
    fontSize: 14,
    fontFamily: 'Archivo_700Bold',
    color: SL_COLORS.charcoal,
  },
  progressPercentage: {
    fontSize: 14,
    fontFamily: 'Archivo_800ExtraBold',
    color: SL_COLORS.terracotta,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: SL_COLORS.sandDark,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },

  // Section Headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Archivo_800ExtraBold',
    color: SL_COLORS.charcoal,
  },
  sectionDate: {
    fontSize: 14,
    color: SL_COLORS.warmGray,
  },

  // Team Members
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  memberRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: SL_COLORS.sandDark,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  memberInitials: {
    fontSize: 14,
    fontFamily: 'Archivo_800ExtraBold',
    color: SL_COLORS.terracotta,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontFamily: 'Archivo_700Bold',
    color: SL_COLORS.charcoal,
  },
  memberRole: {
    fontSize: 13,
    color: SL_COLORS.warmGray,
    marginTop: 2,
  },
  memberStatusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  memberStatusText: {
    fontSize: 12,
    fontFamily: 'Archivo_700Bold',
  },

  // Schedule Blocks
  scheduleBlock: {
    flexDirection: 'row',
    paddingVertical: Spacing.md,
  },
  scheduleBlockBorder: {
    borderBottomWidth: 1,
    borderBottomColor: SL_COLORS.sandDark,
  },
  scheduleTimeColumn: {
    width: 60,
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  scheduleTime: {
    fontSize: 12,
    fontFamily: 'Archivo_700Bold',
    color: SL_COLORS.warmGray,
  },
  scheduleTimeline: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.xs,
  },
  scheduleTimelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: SL_COLORS.cream,
  },
  scheduleTimelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: SL_COLORS.sandDark,
    marginTop: 4,
  },
  scheduleContent: {
    flex: 1,
  },
  scheduleTask: {
    fontSize: 15,
    fontFamily: 'Archivo_700Bold',
    color: SL_COLORS.charcoal,
    marginBottom: 4,
  },
  scheduleAssigned: {
    fontSize: 13,
    color: SL_COLORS.warmGray,
    marginBottom: Spacing.sm,
  },
  scheduleProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scheduleProgressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: SL_COLORS.sandDark,
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: Spacing.sm,
  },
  scheduleProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  scheduleProgressText: {
    fontSize: 12,
    fontFamily: 'Archivo_700Bold',
    color: SL_COLORS.warmGray,
    width: 40,
    textAlign: 'right',
  },

  // AI Suggestion
  aiSuggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SL_COLORS.cream,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    borderRadius: 12,
  },
  aiIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  aiTextContainer: {
    flex: 1,
  },
  aiTitle: {
    fontSize: 15,
    fontFamily: 'Archivo_800ExtraBold',
    color: SL_COLORS.charcoal,
    marginBottom: 2,
  },
  aiSubtitle: {
    fontSize: 13,
    color: SL_COLORS.warmGray,
    lineHeight: 18,
  },

  // Progress Notes
  noteRow: {
    paddingVertical: Spacing.md,
  },
  noteRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: SL_COLORS.sandDark,
  },
  noteTime: {
    fontSize: 13,
    fontFamily: 'Archivo_800ExtraBold',
    color: SL_COLORS.terracotta,
    marginBottom: 4,
  },
  noteText: {
    fontSize: 14,
    color: SL_COLORS.charcoal,
    lineHeight: 20,
  },

  // Actions
  actionsContainer: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.md,
  },
  actionButtonPrimary: {
    backgroundColor: SL_COLORS.terracotta,
  },
  actionButtonSecondary: {
    backgroundColor: SL_COLORS.cream,
    borderWidth: 1.5,
    borderColor: SL_COLORS.terracotta,
  },
  actionButtonIcon: {
    marginRight: Spacing.sm,
  },
  actionButtonTextPrimary: {
    fontSize: 16,
    fontFamily: 'Archivo_800ExtraBold',
    color: SL_COLORS.cream,
  },
  actionButtonTextSecondary: {
    fontSize: 16,
    fontFamily: 'Archivo_800ExtraBold',
    color: SL_COLORS.terracotta,
  },

  bottomSpacer: {
    height: Spacing.xl,
  },
});
