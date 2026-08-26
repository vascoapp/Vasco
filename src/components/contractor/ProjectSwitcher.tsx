// =============================================================================
// PROJECT SWITCHER (R248)
// =============================================================================
// Balloon menu on Vandaag for aannemer-mode contractors. Lets the
// contractor pick the active project context. Active selection persists
// (activeProjectService) so subsequent site-lead navigations pre-fill
// the projectId param.
//
// Hidden when:
//   - user is not aannemer
//   - aannemer has zero active projects
// =============================================================================

import { memo, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DK } from '../../theme/draftkings';
import { TYPE, GRID, RADIUS } from '../../theme/tabStyles';
import { DKLabel } from '../shared/DKLabel';
import { DKMenu } from '../shared/DKMenu';
import { useAppState } from '../../state/AppState';
import { useAuth } from '../../context/AuthContext';
import { useActiveProject } from '../../services/activeProjectService';

function ProjectSwitcherImpl() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const { projects } = useAppState();
  const { activeProjectId, setActive } = useActiveProject();

  const activeProjects = useMemo(
    () => (projects ?? []).filter((p: any) => p.status === 'active' || p.status === 'planning' || p.status === 'in_progress'),
    [projects],
  );

  const activeProject = useMemo(
    () => activeProjects.find((p: any) => p.id === activeProjectId) ?? null,
    [activeProjects, activeProjectId],
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
        <DKLabel style={styles.title}>{t('projectSwitcher.activeProjects')}</DKLabel>
        <Pressable hitSlop={8} accessibilityRole="link" accessibilityLabel={t('projectSwitcher.a11yViewAll')} onPress={() => router.push('/contractor/projects' as any)}>
          <Text style={styles.allLink}>{t('projectSwitcher.allLink')}</Text>
        </Pressable>
      </View>
      {/* Was a horizontal pill row. A strip of chips hides every option past
          the right edge and never says how many there are — with four projects
          the fourth was invisible. One anchor showing the current context,
          opening a balloon that lists all of them, is the house pattern now
          (see DKMenu). */}
      <View style={styles.anchorRow}>
        <DKMenu
          accessibilityLabel={t('projectSwitcher.activeProjects')}
          items={[
            ...activeProjects.map((p: any) => ({
              key: p.id,
              label: p.title,
              icon: 'folder-outline' as const,
              selected: activeProjectId === p.id,
              // Tapping the SELECTED project clears the context, which is what
              // the pill toggle did. Unchanged so muscle memory survives.
              onPress: () => { void handleSelect(p.id); },
            })),
            {
              key: '__new',
              label: t('projectSwitcher.newProject'),
              icon: 'add' as const,
              emphasis: true,
              onPress: () => router.push('/contractor/projects' as any),
            },
          ]}
          renderAnchor={(open) => (
            <Pressable
              style={styles.anchor}
              onPress={open}
              onLongPress={() => activeProject && handleOpenDetail(activeProject.id)}
              accessibilityRole="button"
              accessibilityLabel={t('projectSwitcher.a11yOpenMenu', {
                defaultValue: 'Choose active project',
              })}
            >
              <Ionicons
                name={activeProject ? 'checkmark-circle' : 'folder-outline'}
                size={16}
                color={activeProject ? DK.colors.accent : DK.colors.textMuted}
              />
              <Text style={styles.anchorText} numberOfLines={1}>
                {/* "No project SELECTED", not "no active project": this anchor
                    sits directly under the header "ACTIVE PROJECTS", and it
                    only renders at all when there is at least one. The old
                    copy read as a flat contradiction of the line above it —
                    "ACTIEVE PROJECTEN / Geen actief project" — on an aannemer
                    with two running projects. Seen on device 2026-08-26. */}
                {activeProject
                  ? activeProject.title
                  : t('projectSwitcher.noneSelected', { defaultValue: 'No project selected' })}
              </Text>
              <Ionicons name="chevron-down" size={16} color={DK.colors.textMuted} />
            </Pressable>
          )}
        />
      </View>
      {activeProjectId ? (
        <Text style={styles.hint}>{t('projectSwitcher.hint')}</Text>
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
  anchorRow: {
    paddingHorizontal: GRID.md,
    paddingVertical: GRID.xs,
  },
  anchor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    backgroundColor: DK.colors.panel,
    borderRadius: RADIUS.md,
    paddingHorizontal: GRID.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: DK.colors.border,
  },
  // flex:1 so a long project title truncates rather than shoving the chevron
  // off the row — the starved-sibling shape this app keeps reintroducing.
  anchorText: {
    flex: 1,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: DK.colors.text,
  },
  hint: {
    fontSize: 11,
    fontFamily: TYPE.tinyFamily,
    color: DK.colors.textMuted,
    paddingHorizontal: GRID.md,
  },
});

export const ProjectSwitcher = memo(ProjectSwitcherImpl);
