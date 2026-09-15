// =============================================================================
// DecimalInput — an editable NUMBER that can hold a half-typed value
// =============================================================================
// The invoice line editor and the quote builder bound `value={String(price)}`
// and re-parsed every keystroke into that number. Typing "85," parsed to 85,
// re-rendered as "85", and the separator was gone before the next key — in
// every locale, because "85." does the same. No price with cents could be
// typed on either screen.
//
// So the field keeps the TEXT while it is focused and reports the parsed
// number upward; unfocused it shows the number in the market's own decimal
// form. Use this for any TextInput whose source of truth is a number
// (guard: src/__tests__/numericInputsKeepTypedText.test.ts).
// =============================================================================

import { useState } from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { formatDecimalInput, parseDecimalInput } from '../../utils/decimalInput';
import { getCurrentCountry } from '../../lib/currentUser';
import type { Country } from '../../i18n/formatting';

type Props = Omit<TextInputProps, 'value' | 'onChangeText' | 'defaultValue'> & {
  value: number;
  /** Receives the parsed number; an empty or unreadable field reports 0. */
  onChangeValue: (n: number) => void;
  country?: Country;
  maxDecimals?: number;
};

export function DecimalInput({ value, onChangeValue, country, maxDecimals = 2, onFocus, onBlur, ...rest }: Props) {
  const c = country ?? ((getCurrentCountry() as Country) || 'NL');
  // null = not being edited → render the number itself.
  const [text, setText] = useState<string | null>(null);
  return (
    <TextInput
      keyboardType="decimal-pad"
      {...rest}
      value={text ?? formatDecimalInput(value, c, maxDecimals)}
      onFocus={(e) => { setText(formatDecimalInput(value, c, maxDecimals)); onFocus?.(e); }}
      onChangeText={(v) => { setText(v); onChangeValue(parseDecimalInput(v, c) ?? 0); }}
      onBlur={(e) => { setText(null); onBlur?.(e); }}
    />
  );
}
