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

export function DKLabel({ children, style, accessibilityLabel, ...rest }: Props) {
  // R107: do NOT default numberOfLines={1}. R106 added that as a safety
  // net but it caused unrelated chips and headers to ellipse ("VASCO
  // ANALY…", "SCHED…", "NEW QU…") when their inline-styled parent
  // containers used flexShrink:1 or auto-sized to other siblings.
  // Callers that need ellipsis pass numberOfLines={1} explicitly.
  return (
    <Text
      accessibilityLabel={accessibilityLabel ?? children}
      style={style}
      {...rest}
    >
      {children.toUpperCase()}
    </Text>
  );
}
