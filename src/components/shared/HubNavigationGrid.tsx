import { StyleSheet, Text, View } from 'react-native';
import { SemanticColors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { TYPE } from '../../theme/tabStyles';

interface HubNavigationGridProps {
  title?: string;
  children: React.ReactNode;
}

export function HubNavigationGrid({ title, children }: HubNavigationGridProps) {
  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <View style={styles.grid}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  title: {
    color: SemanticColors.textSecondary,
    fontSize: 11,
    fontFamily: TYPE.titleFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
});
