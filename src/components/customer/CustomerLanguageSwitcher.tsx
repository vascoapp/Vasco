// =============================================================================
// CUSTOMER LANGUAGE SWITCHER
// =============================================================================
// Compact 6-language toggle for the customer-facing portal. A customer working
// with a Dutch contractor may not read Dutch — this lets them switch the whole
// portal to their language (the portal is fully localized in en/nl/de/fr/es/it).
// =============================================================================

import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DK } from '../../theme/draftkings';

const LANGS: { code: string; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'nl', label: 'NL' },
  { code: 'de', label: 'DE' },
  { code: 'fr', label: 'FR' },
  { code: 'es', label: 'ES' },
  { code: 'it', label: 'IT' },
];

interface Props {
  /** Visual variant — 'dark' for the dark portal hero, 'panel' for the light landing card. */
  compact?: boolean;
}

export function CustomerLanguageSwitcher({ compact }: Props) {
  const { t } = useTranslation();
  const { i18n } = useTranslation();
  const active = (i18n.language || 'en').slice(0, 2).toLowerCase();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[s.row, compact && { gap: 4 }]}
      accessibilityRole="radiogroup"
      accessibilityLabel={t('settings.language', 'Language')}
    >
      {LANGS.map((l) => {
        const isActive = active === l.code;
        return (
          <Pressable
            key={l.code}
            onPress={() => i18n.changeLanguage(l.code)}
            style={({ pressed }) => [
              s.chip,
              compact && s.chipCompact,
              isActive && s.chipActive,
              pressed && { opacity: 0.7 },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={l.label}
            hitSlop={6}
          >
            <Text style={[s.chipText, isActive && s.chipTextActive]}>{l.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: DK.colors.border,
    backgroundColor: DK.colors.panel,
  },
  chipCompact: { paddingHorizontal: 8, paddingVertical: 4 },
  chipActive: {
    backgroundColor: DK.colors.accent + '1F',
    borderColor: DK.colors.accent,
  },
  chipText: {
    fontFamily: DK.type.display800,
    fontSize: 11,
    letterSpacing: 0.6,
    color: DK.colors.textMuted,
  },
  chipTextActive: { color: DK.colors.accent },
});
