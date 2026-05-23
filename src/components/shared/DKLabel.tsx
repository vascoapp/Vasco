// DK-style uppercase label with accessibility preserved.
//
// R106: hands an already-uppercased string to <Text> instead of relying on
// CSS textTransform:'uppercase'. On iOS, the Yoga text layout engine
// measures glyph widths from the ORIGINAL case before applying
// textTransform, then renders the transformed (wider) string into the
// measured box — clipping the trailing characters of bold uppercase
// labels with positive letterSpacing (Archivo Black). Pre-uppercasing
// the string lets the layout engine measure the actual rendered width.
//
// Screen readers still receive the original-case string via
// accessibilityLabel so VoiceOver announces "Schedule" not "S C H E D U L E".
//
// Usage:
//   <DKLabel style={styles.tabLabel}>{t('dk.tabs.today', 'Today')}</DKLabel>

import { Text, type TextProps } from 'react-native';

interface Props extends Omit<TextProps, 'children'> {
  children: string;
}

export function DKLabel({ children, style, accessibilityLabel, numberOfLines, ...rest }: Props) {
  return (
    <Text
      accessibilityLabel={accessibilityLabel ?? children}
      style={style}
      numberOfLines={numberOfLines ?? 1}
      {...rest}
    >
      {children.toUpperCase()}
    </Text>
  );
}
