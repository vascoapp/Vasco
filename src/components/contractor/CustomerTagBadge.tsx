// =============================================================================
// CUSTOMER TAG BADGE
// =============================================================================
// Renders a small pill with the customer's auto-tag colour + label.
// =============================================================================

import { View, Text, StyleSheet } from 'react-native';
import type { CustomerTag } from '../../services/customerTaggingService';
import { TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { SemanticColors, Palette } from '../../theme/colors';

interface Props {
  tag: CustomerTag;
  compact?: boolean;
}

const COLORS: Record<CustomerTag, { bg: string; fg: string; label: string }> = {
  vip:      { bg: '#FDEEDD', fg: '#B54708', label: 'VIP' },
  loyal:    { bg: '#E0E7FF', fg: '#3730A3', label: 'Loyal' },
  new:      { bg: '#ECFEFF', fg: '#155E75', label: 'New' },
  risky:    { bg: '#FEE2E2', fg: '#991B1B', label: 'Risky' },
  inactive: { bg: '#F3F4F6', fg: '#6B7280', label: 'Inactive' },
};

export function CustomerTagBadge({ tag, compact }: Props) {
  const theme = COLORS[tag];
  return (
    <View style={[styles.pill, { backgroundColor: theme.bg }, compact && styles.compact]}>
      <Text style={[styles.text, { color: theme.fg }, compact && styles.textCompact]}>
        {theme.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: GRID.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
  },
  compact: { paddingHorizontal: 6, paddingVertical: 1 },
  text: { fontSize: TYPE.tinySize, fontFamily: TYPE.sectionFamily, letterSpacing: 0.3 },
  textCompact: { fontSize: TYPE.tinySize - 1 },
});

// Silence unused-import warnings if SemanticColors/Palette become theme
// overrides later. These re-exports keep tooling predictable.
export const _unused = { SemanticColors, Palette };
