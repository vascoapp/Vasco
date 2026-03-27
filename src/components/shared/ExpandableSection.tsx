import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radius } from '../../theme/radius';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type ExpandableSectionProps = {
  title: string;
  subtitle?: string;
  badge?: string | number;
  badgeColor?: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  emptyMessage?: string;
};

export function ExpandableSection({
  title,
  subtitle,
  badge,
  badgeColor = SemanticColors.actionPrimary,
  children,
  defaultExpanded = false,
  onToggle,
  emptyMessage,
}: ExpandableSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newState = !expanded;
    setExpanded(newState);
    onToggle?.(newState);
  };

  const isEmpty = !children || (Array.isArray(children) && children.length === 0);

  return (
    <View style={styles.container}>
      <Pressable style={styles.header} onPress={handleToggle}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        <View style={styles.headerRight}>
          {badge !== undefined && (
            <View style={[styles.badge, { backgroundColor: badgeColor + '20' }]}>
              <Text style={[styles.badgeText, { color: badgeColor }]}>{badge}</Text>
            </View>
          )}
          <View style={styles.chevronContainer}>
            <Ionicons
              name={expanded ? 'chevron-down' : 'chevron-forward'}
              size={16}
              color={SemanticColors.textSecondary}
            />
          </View>
        </View>
      </Pressable>
      {expanded && (
        <View style={styles.content}>
          {isEmpty && emptyMessage ? (
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={24} color={SemanticColors.textSecondary} />
              <Text style={styles.emptyText}>{emptyMessage}</Text>
            </View>
          ) : (
            children
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    overflow: 'hidden',
    // Shadow for depth
    shadowColor: Palette.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.sm,
    minHeight: 56,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: SemanticColors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  subtitle: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chevronContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: Spacing.sm,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    gap: 8,
  },
  emptyText: {
    color: SemanticColors.textSecondary,
    fontSize: 13,
  },
});
