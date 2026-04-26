// =============================================================================
// PROJECT SWITCHER (R248)
// =============================================================================
// Horizontal pill row on Vandaag for aannemer-mode contractors. Lets the
// contractor pick the active project context. Active selection persists
// (activeProjectService) so subsequent site-lead navigations pre-fill
// the projectId param.
//
// Hidden when:
//   - user is not aannemer
//   - aannemer has zero active projects
// =============================================================================

import { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DK } from '../../theme/draftkings';
import { TYPE, GRID, RADIUS } from '../../theme/tabStyles';
import { DKLabel } from '../shared/DKLabel';
import { useAppState } from '../../state/AppState';
import { useAuth } from '../../context/AuthContext';
import { useActiveProject } from '../../services/activeProjectService';

export function ProjectSwitcher() {
  const router = useRouter();
  const { user } = useAuth();
  const { projects } = useAppState();
  const { activeProjectId, setActive } = useActiveProject();

  const activeProjects = useMemo(
    () => (projects ?? []).filter((p: any) => p.status === 'active' || p.status === 'planning' || p.status === 'in_progress'),
    [projects],
  );

  if (!user?.isAannemer || activeProjects.length === 0) return null;

  const handleSelect = async (id: string) => {
    await setActive(activeProjectId === id ? null : id);
  };

  const handleOpenDetail = (id: string) => {
    router.push(`/contractor/projects/${id}` as any);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <DKLabel style={styles.title}>ACTIVE PROJECTS</DKLabel>
        <Pressable hitSlop={8} onPress={() => router.push('/contractor/projects' as any)}>
          <Text style={styles.allLink}>All ›</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {activeProjects.map((p: any) => {
          const isActive = activeProjectId === p.id;
          return (
            <Pressable
              key={p.id}
              style={[styles.pill, isActive && styles.pillActive]}
              onPress={() => handleSelect(p.id)}
              onLongPress={() => handleOpenDetail(p.id)}
            >
              <Ionicons
                name={isActive ? 'checkmark-circle' : 'folder-outline'}
                size={14}
                color={isActive ? '#000' : DK.colors.text}
              />
              <Text style={[styles.pillText, isActive && styles.pillTextActive]} numberOfLines={1}>
                {p.title}
              </Text>
            </Pressable>
          );
        })}
        <Pressable style={styles.addPill} onPress={() => router.push('/contractor/projects' as any)}>
          <Ionicons name="add" size={16} color={DK.colors.accent} />
          <Text style={styles.addPillText}>NEW</Text>
        </Pressable>
      </ScrollView>
      {activeProjectId ? (
        <Text style={styles.hint}>
          Tap to deselect · long-press to open · site-lead actions on Vandaag scope to active project
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginVertical: GRID.sm,
    gap: GRID.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GRID.md,
  },
  title: {
    color: DK.colors.textMuted,
  },
  allLink: {
    fontSize: 12,
    fontFamily: TYPE.captionFamily,
    color: DK.colors.accent,
  },
  row: {
    paddingHorizontal: GRID.md,
    gap: GRID.sm,
    paddingVertical: GRID.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: DK.colors.panel,
    borderRadius: RADIUS.full,
    paddingHorizontal: GRID.md,
    paddingVertical: GRID.sm,
    borderWidth: 1,
    borderColor: DK.colors.border,
    maxWidth: 240,
  },
  pillActive: {
    backgroundColor: DK.colors.accent,
    borderColor: DK.colors.accent,
  },
  pillText: {
    fontSize: 13,
    fontFamily: TYPE.bodyFamily,
    color: DK.colors.text,
  },
  pillTextActive: {
    color: '#000',
    fontFamily: TYPE.titleFamily,
  },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: DK.colors.panel,
    borderRadius: RADIUS.full,
    paddingHorizontal: GRID.md,
    paddingVertical: GRID.sm,
    borderWidth: 1,
    borderColor: DK.colors.accent,
    borderStyle: 'dashed',
  },
  addPillText: {
    fontSize: 11,
    fontFamily: TYPE.titleFamily,
    color: DK.colors.accent,
    letterSpacing: 1.2,
  },
  hint: {
    fontSize: 11,
    fontFamily: TYPE.tinyFamily,
    color: DK.colors.textMuted,
    paddingHorizontal: GRID.md,
  },
});
