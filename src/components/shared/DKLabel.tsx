// DK-style uppercase label with accessibility preserved.
//
// The DraftKings theme uses many UPPERCASE labels rendered via styling
// (textTransform: 'uppercase') which screen readers can announce letter-by-
// letter or mispronounce. This helper renders the uppercase transform visually
// but hands the original-case string to screen readers via accessibilityLabel.
//
// Usage:
//   <DKLabel style={styles.tabLabel}>{t('dk.tabs.today', 'Today')}</DKLabel>
// vs. the existing:
//   <Text style={styles.tabLabel}>{t('dk.tabs.today', 'Today').toUpperCase()}</Text>

import { Text, type TextProps } from 'react-native';

interface Props extends Omit<TextProps, 'children'> {
  children: string;
}

export function DKLabel({ children, style, accessibilityLabel, ...rest }: Props) {
  return (
    <Text
      accessibilityLabel={accessibilityLabel ?? children}
      style={[style, { textTransform: 'uppercase' }]}
      {...rest}
    >
      {children}
    </Text>
  );
}
