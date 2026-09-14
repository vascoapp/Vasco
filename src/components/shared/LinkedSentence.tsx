// =============================================================================
// LinkedSentence — one translated sentence with tappable slots inside it
// =============================================================================
// Consent lines were assembled from fragments: "By continuing you agree to our"
// + [Terms] + " & " + [Privacy Policy]. A fragment cannot agree with a noun it
// never sees, so Italian read "accetti i nostri Termini & Informativa sulla
// privacy" (needs "e l'Informativa"), French "nos Conditions et Politique" (needs
// "notre Politique"), and "&" is not a word in any of them. German had already
// needed a fix for the same assembly (learnings #300).
//
// The translator now writes the whole sentence, with {{slot}} where each link
// goes. The slots are filled with sentinels through t() — so i18next never
// drops or escapes them and the preflight's interpolation check still sees the
// variables — and the result is split on those sentinels.
import { Fragment, type ReactNode } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

export interface SentenceLink {
  label: string;
  onPress: () => void;
}

// Written as an escape on purpose: a raw control character is invisible in
// source and easy to lose in an edit, which would make split('') shred text.
const MARK = '\u0001';

/** A sentinel for slot `name`, to pass as that variable's value to t(). */
export function slot(name: string): string {
  return `${MARK}${name}${MARK}`;
}

/** Split a sentence produced with slot() values into text and slot names. */
export function splitSentence(sentence: string): Array<{ text: string } | { slot: string }> {
  const parts = sentence.split(MARK);
  // Odd indexes are slot names: "a␁terms␁b␁privacy␁c" → a, terms, b, privacy, c.
  return parts
    .map((p, i) => (i % 2 === 1 ? { slot: p } : { text: p }))
    .filter((p) => !('text' in p) || p.text !== '');
}

export function LinkedSentence({ sentence, links, style, linkStyle }: {
  /** The translated sentence, produced with slot(name) for each link. */
  sentence: string;
  links: Record<string, SentenceLink>;
  style?: StyleProp<TextStyle>;
  linkStyle?: StyleProp<TextStyle>;
}) {
  const children: ReactNode[] = splitSentence(sentence).map((part, i) => {
    if ('text' in part) return <Fragment key={i}>{part.text}</Fragment>;
    const link = links[part.slot];
    if (!link) return null;
    return (
      <Text
        key={i}
        style={linkStyle}
        accessibilityRole="link"
        accessibilityLabel={link.label}
        onPress={link.onPress}
      >
        {link.label}
      </Text>
    );
  });
  return <Text style={style}>{children}</Text>;
}
