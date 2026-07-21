// =============================================================================
// CUSTOMER TAG BADGE
// =============================================================================
// Renders a small pill with the customer's auto-tag colour + label.
// =============================================================================

import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CustomerTag } from '../../services/customerTaggingService';
import { TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { SemanticColors, Palette } from '../../theme/colors';

interface Props {
  tag: CustomerTag;
  compact?: boolean;
}

// Colours only — the visible label is resolved through i18n so the badge
// renders in the app locale (was hardcoded English on the Klanten list).
const COLORS: Record<CustomerTag, { bg: string; fg: string }> = {
  vip:      { bg: '#FDEEDD', fg: '#B54708' },
  loyal:    { bg: '#E0E7FF', fg: '#3730A3' },
  new:      { bg: '#ECFEFF', fg: '#155E75' },
  risky:    { bg: '#FEE2E2', fg: '#991B1B' },
  inactive: { bg: '#F3F4F6', fg: '#6B7280' },
};

const DEFAULT_LABEL: Record<CustomerTag, string> = {
  vip: 'VIP', loyal: 'Loyal', new: 'New', risky: 'Risky', inactive: 'Inactive',
};

export function CustomerTagBadge({ tag, compact }: Props) {
  const { t } = useTranslation();
  const theme = COLORS[tag];
  const label = t(`customerTag.${tag}`, DEFAULT_LABEL[tag]);
  return (
    <View style={[styles.pill, { backgroundColor: theme.bg }, compact && styles.compact]}>
      <Text style={[styles.text, { color: theme.fg }, compact && styles.textCompact]}>
        {label}
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
