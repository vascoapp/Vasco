// =============================================================================
// VASCO TASK BAR - Natural language task input with parsed preview
// =============================================================================

import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { hapticSuccess } from '../../utils/haptics';
import { useTaskParser } from '../../services/vascoTaskParserService';
import type { ParsedTask } from '../../services/vascoTaskParserService';

type IconName = keyof typeof Ionicons.glyphMap;

interface Props {
  onSubmit?: (task: ParsedTask) => void;
  placeholder?: string;
}

export function VascoTaskBar({ onSubmit, placeholder = 'Bijv. "Inspectie ketel om 14:00 morgen"' }: Props) {
  const [input, setInput] = useState('');
  const [parsed, setParsed] = useState<ParsedTask | null>(null);
  const { parse, categoryIcon, categoryLabel } = useTaskParser();

  const handleChange = useCallback((text: string) => {
    setInput(text);
    if (text.length > 2) {
      setParsed(parse(text));
    } else {
      setParsed(null);
    }
  }, [parse]);

  const handleSubmit = useCallback(() => {
    if (!input.trim()) return;
    const task = parse(input);
    onSubmit?.(task);
    hapticSuccess();
    setInput('');
    setParsed(null);
    Keyboard.dismiss();
  }, [input, parse, onSubmit]);

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <Ionicons name="sparkles" size={18} color={Palette.hermesOrange} style={styles.sparkle} />
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={SemanticColors.textTertiary}
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />
        {input.length > 0 && (
          <Pressable onPress={handleSubmit} style={styles.submitBtn}>
            <Ionicons name="add-circle" size={24} color={Palette.hermesOrange} />
          </Pressable>
        )}
      </View>

      {/* Parsed preview chips */}
      {parsed && input.length > 2 && (
        <View style={styles.chipRow}>
          {parsed.category && parsed.category !== 'overig' && (
            <View style={styles.chip}>
              <Ionicons
                name={categoryIcon[parsed.category] as IconName}
                size={12}
                color={Palette.hermesOrange}
              />
              <Text style={styles.chipText}>{categoryLabel[parsed.category]}</Text>
            </View>
          )}
          {parsed.time && (
            <View style={styles.chip}>
              <Ionicons name="time" size={12} color={SemanticColors.feedbackInfo} />
              <Text style={styles.chipText}>{parsed.time}</Text>
            </View>
          )}
          {parsed.dateLabel && (
            <View style={styles.chip}>
              <Ionicons name="calendar" size={12} color={SemanticColors.feedbackSuccess} />
              <Text style={styles.chipText}>{parsed.dateLabel}</Text>
            </View>
          )}
          {parsed.confidence >= 0.7 && (
            <View style={[styles.chip, styles.chipConfidence]}>
              <Ionicons name="checkmark-circle" size={12} color={SemanticColors.feedbackSuccess} />
              <Text style={[styles.chipText, { color: SemanticColors.feedbackSuccess }]}>Herkend</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderMuted,
    padding: Spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sparkle: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: SemanticColors.textPrimary,
    paddingVertical: 8,
  },
  submitBtn: {
    marginLeft: 8,
    padding: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderMuted,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  chipConfidence: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
  },
});
