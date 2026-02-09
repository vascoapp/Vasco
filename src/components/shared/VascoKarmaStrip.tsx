// =============================================================================
// VASCO KARMA STRIP - Compact karma display with streak fire & badges
// =============================================================================

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { useKarmaProfile } from '../../services/vascoKarmaService';
import type { KarmaLevel, KarmaBadge, KarmaAction } from '../../services/vascoKarmaService';

type IconName = keyof typeof Ionicons.glyphMap;

interface Props {
  role?: string;
}

function getLevelColor(level: KarmaLevel): string {
  switch (level) {
    case 'Starter': return SemanticColors.textTertiary;
    case 'Vakman': return SemanticColors.feedbackInfo;
    case 'Expert': return Palette.hermesOrange;
    case 'Meester': return SemanticColors.feedbackSuccess;
  }
}

function ProgressRing({ progress, size = 28 }: { progress: number; size?: number }) {
  // Simple progress indicator using a background arc simulation
  const fillAngle = (progress / 100) * 360;
  return (
    <View style={[ringStyles.container, { width: size, height: size }]}>
      <View style={[ringStyles.bg, { width: size, height: size, borderRadius: size / 2 }]} />
      <View
        style={[
          ringStyles.fill,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: Palette.hermesOrange,
            borderTopColor: progress > 25 ? Palette.hermesOrange : 'transparent',
            borderRightColor: progress > 50 ? Palette.hermesOrange : 'transparent',
            borderBottomColor: progress > 75 ? Palette.hermesOrange : 'transparent',
            borderLeftColor: progress > 0 ? Palette.hermesOrange : 'transparent',
            transform: [{ rotate: `${fillAngle - 90}deg` }],
          },
        ]}
      />
      <Text style={ringStyles.text}>{Math.round(progress)}%</Text>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  bg: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: SemanticColors.surfaceTertiary,
  },
  fill: {
    position: 'absolute',
    borderWidth: 3,
  },
  text: {
    fontSize: 8,
    fontWeight: '700',
    color: SemanticColors.textSecondary,
  },
});

function BadgeIcon({ badge }: { badge: KarmaBadge }) {
  return (
    <View style={styles.badgeItem}>
      <View style={styles.badgeCircle}>
        <Ionicons name={badge.icon as IconName} size={16} color={Palette.hermesOrange} />
      </View>
      <Text style={styles.badgeName} numberOfLines={1}>{badge.name}</Text>
    </View>
  );
}

function ActionRow({ action }: { action: KarmaAction }) {
  const isPositive = action.points > 0;
  return (
    <View style={styles.actionRow}>
      <Ionicons
        name={isPositive ? 'checkmark-circle' : 'close-circle'}
        size={16}
        color={isPositive ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError}
      />
      <Text style={styles.actionLabel} numberOfLines={1}>{action.label}</Text>
      <Text style={[styles.actionPoints, { color: isPositive ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError }]}>
        {isPositive ? '+' : ''}{action.points}
      </Text>
    </View>
  );
}

export function VascoKarmaStrip({ role }: Props) {
  const profile = useKarmaProfile(role);
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = useCallback(() => setExpanded(v => !v), []);
  const dailyProgress = Math.round((profile.todayActions / profile.todayGoal) * 100);

  return (
    <>
      {/* Compact strip */}
      <Pressable onPress={toggleExpand} style={styles.strip}>
        <View style={styles.stripLeft}>
          <View style={[styles.levelBadge, { backgroundColor: getLevelColor(profile.level) + '20' }]}>
            <Text style={[styles.levelText, { color: getLevelColor(profile.level) }]}>{profile.level}</Text>
          </View>
          <Text style={styles.pointsText}>{profile.points} pts</Text>
        </View>

        <View style={styles.stripCenter}>
          {profile.streak > 0 && (
            <View style={styles.streakContainer}>
              <Text style={styles.streakFire}>🔥</Text>
              <Text style={styles.streakCount}>{profile.streak}d</Text>
            </View>
          )}
        </View>

        <View style={styles.stripRight}>
          <ProgressRing progress={dailyProgress} />
          <Ionicons name="chevron-forward" size={14} color={SemanticColors.textTertiary} />
        </View>
      </Pressable>

      {/* Expanded modal */}
      <Modal visible={expanded} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Vasco Karma</Text>
              <Pressable onPress={toggleExpand}>
                <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Level + Points */}
              <View style={styles.profileSection}>
                <View style={[styles.bigLevelBadge, { backgroundColor: getLevelColor(profile.level) + '20' }]}>
                  <Ionicons name="star" size={24} color={getLevelColor(profile.level)} />
                  <Text style={[styles.bigLevelText, { color: getLevelColor(profile.level) }]}>{profile.level}</Text>
                </View>
                <Text style={styles.bigPoints}>{profile.points} punten</Text>
                <View style={styles.levelBar}>
                  <View style={[styles.levelBarFill, { width: `${profile.levelProgress}%` }]} />
                </View>
                <Text style={styles.levelProgressText}>{profile.levelProgress}% naar volgend niveau</Text>
              </View>

              {/* Streak */}
              <View style={styles.streakSection}>
                <Text style={styles.streakBigFire}>🔥</Text>
                <View>
                  <Text style={styles.streakBigCount}>{profile.streak} dagen streak</Text>
                  <Text style={styles.streakRecord}>Record: {profile.longestStreak} dagen</Text>
                </View>
              </View>

              {/* Daily progress */}
              <View style={styles.dailySection}>
                <Text style={styles.sectionLabel}>Vandaag</Text>
                <View style={styles.dailyBar}>
                  <View style={[styles.dailyBarFill, { width: `${Math.min(dailyProgress, 100)}%` }]} />
                </View>
                <Text style={styles.dailyText}>
                  {profile.todayActions} / {profile.todayGoal} acties
                </Text>
              </View>

              {/* Badges */}
              {profile.badges.length > 0 && (
                <View style={styles.badgesSection}>
                  <Text style={styles.sectionLabel}>Badges ({profile.badges.length})</Text>
                  <View style={styles.badgesGrid}>
                    {profile.badges.map(badge => (
                      <BadgeIcon key={badge.id} badge={badge} />
                    ))}
                  </View>
                </View>
              )}

              {/* Recent actions */}
              <View style={styles.actionsSection}>
                <Text style={styles.sectionLabel}>Recente acties</Text>
                {profile.recentActions.slice(0, 5).map(action => (
                  <ActionRow key={action.id} action={action} />
                ))}
              </View>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: SemanticColors.borderMuted,
  },
  stripLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  levelText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pointsText: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  stripCenter: {
    alignItems: 'center',
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  streakFire: {
    fontSize: 14,
  },
  streakCount: {
    fontSize: 12,
    fontWeight: '700',
    color: SemanticColors.feedbackWarning,
  },
  stripRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.md,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  bigLevelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 8,
  },
  bigLevelText: {
    fontSize: 18,
    fontWeight: '800',
  },
  bigPoints: {
    fontSize: 24,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginBottom: 8,
  },
  levelBar: {
    width: '100%',
    height: 6,
    backgroundColor: SemanticColors.surfaceTertiary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  levelBarFill: {
    height: '100%',
    backgroundColor: Palette.hermesOrange,
    borderRadius: 3,
  },
  levelProgressText: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 4,
  },
  streakSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: SemanticColors.feedbackWarningBg,
    borderRadius: 12,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  streakBigFire: {
    fontSize: 32,
  },
  streakBigCount: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  streakRecord: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },
  dailySection: {
    marginBottom: Spacing.sm,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    marginBottom: 8,
  },
  dailyBar: {
    height: 8,
    backgroundColor: SemanticColors.surfaceTertiary,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  dailyBarFill: {
    height: '100%',
    backgroundColor: Palette.hermesOrange,
    borderRadius: 4,
  },
  dailyText: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },
  badgesSection: {
    marginBottom: Spacing.sm,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  badgeItem: {
    alignItems: 'center',
    width: 60,
  },
  badgeCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.hermesOrange + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  badgeName: {
    fontSize: 9,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
    fontWeight: '600',
  },
  actionsSection: {
    gap: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionLabel: {
    flex: 1,
    fontSize: 13,
    color: SemanticColors.textPrimary,
  },
  actionPoints: {
    fontSize: 13,
    fontWeight: '700',
  },
});
