import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radius } from '../../theme/radius';
import { TYPE, GRID } from '../../theme/tabStyles';

export type AlertSeverity = 'critical' | 'warning' | 'info';

type AlertItem = {
  id: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
};

type AlertBannerProps = {
  severity: AlertSeverity;
  items: AlertItem[];
  title?: string;
  maxItems?: number;
  onSeeAll?: () => void;
};

const SEVERITY_CONFIG: Record<AlertSeverity, {
  color: string;
  bg: string;
  border: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = {
  critical: {
    color: SemanticColors.feedbackError,
    bg: SemanticColors.feedbackError + '15',
    border: SemanticColors.feedbackError + '40',
    icon: 'alert-circle',
  },
  warning: {
    color: SemanticColors.feedbackWarning,
    bg: SemanticColors.feedbackWarning + '15',
    border: SemanticColors.feedbackWarning + '40',
    icon: 'warning',
  },
  info: {
    color: SemanticColors.actionPrimary,
    bg: SemanticColors.actionPrimary + '15',
    border: SemanticColors.actionPrimary + '40',
    icon: 'information-circle',
  },
};

export function AlertBanner({ severity, items, title, maxItems = 3, onSeeAll }: AlertBannerProps) {
  if (items.length === 0) return null;

  const config = SEVERITY_CONFIG[severity];
  const visibleItems = items.slice(0, maxItems);
  const hasMore = items.length > maxItems;

  return (
    <View style={[styles.container, { backgroundColor: config.bg, borderColor: config.border }]}>
      {title && (
        <View style={styles.header}>
          <Ionicons name={config.icon} size={18} color={config.color} />
          <Text style={[styles.title, { color: config.color }]}>
            {title} ({items.length})
          </Text>
        </View>
      )}
      <View style={styles.list}>
        {visibleItems.map((item) => (
          <Pressable
            key={item.id}
            style={styles.item}
            onPress={item.onPress}
            disabled={!item.onPress}
          >
            <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
            {item.subtitle && (
              <Text style={styles.itemSubtitle} numberOfLines={1}>{item.subtitle}</Text>
            )}
          </Pressable>
        ))}
      </View>
      {hasMore && onSeeAll && (
        <Pressable style={styles.seeAll} onPress={onSeeAll}>
          <Text style={[styles.seeAllText, { color: config.color }]}>
            See all {items.length} items
          </Text>
          <Ionicons name="chevron-forward" size={14} color={config.color} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    gap: GRID.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
  },
  title: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.sectionFamily,
    flex: 1,
  },
  list: {
    gap: 6,
  },
  item: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
  },
  itemTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
  },
  itemSubtitle: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
    marginTop: 2,
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: GRID.xs,
    gap: GRID.xs,
  },
  seeAllText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
  },
});
