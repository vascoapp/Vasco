// =============================================================================
// SHARE QUOTE BUTTON — mints a signed portal URL and opens the Share sheet
// =============================================================================

import { useState } from 'react';
import { Pressable, Text, StyleSheet, Share, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { signQuoteLink } from '../../services/publicQuotePortalService';
import { TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Palette } from '../../theme/colors';

interface Props {
  quoteId: string;
  customerName?: string;
  label?: string;
}

export function ShareQuoteButton({ quoteId, customerName, label }: Props) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const handlePress = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await signQuoteLink(quoteId);
      if (!result.ok || !result.url) {
        Alert.alert(t('shareQuote.failTitle'), result.error ?? t('shareQuote.failBody'));
        return;
      }
      const greeting = customerName ? t('shareQuote.greeting', { name: customerName }) : '';
      await Share.share({
        message: t('shareQuote.message', { greeting, url: result.url }),
        url: result.url,
        title: t('shareQuote.shareTitle'),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={busy}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }, busy && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel="Share signed quote link"
    >
      {busy ? (
        <ActivityIndicator size="small" color={Palette.white} />
      ) : (
        <Ionicons name="share-outline" size={16} color={Palette.white} />
      )}
      <Text style={styles.text}>{label ?? t('shareQuote.buttonLabel')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.xs,
    backgroundColor: Palette.hermesOrange,
    paddingHorizontal: GRID.md, paddingVertical: GRID.sm + 2,
    borderRadius: RADIUS.sm,
  },
  text: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: Palette.white },
});
