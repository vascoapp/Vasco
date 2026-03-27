import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SemanticColors, Palette } from '../../theme/colors';

interface Segment {
  key: string;
  label: string;
}

interface SegmentControlProps {
  segments: Segment[];
  selected: string;
  onSelect: (key: string) => void;
  accentColor?: string;
}

export function SegmentControl({ segments, selected, onSelect, accentColor }: SegmentControlProps) {
  const accent = accentColor || Palette.hermesOrange;

  return (
    <View style={styles.container}>
      {segments.map((seg) => {
        const active = seg.key === selected;
        return (
          <Pressable
            key={seg.key}
            style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && { opacity: 0.7 }]}
            onPress={() => onSelect(seg.key)}
          >
            <Text style={[styles.label, active && [styles.labelActive, { color: accent }]]}>
              {seg.label}
            </Text>
            {active && <View style={[styles.indicator, { backgroundColor: accent }]} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 12,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    position: 'relative',
  },
  tabActive: {
    backgroundColor: SemanticColors.surfacePrimary,
  },
  label: {
    fontSize: 13,
    fontFamily: 'Manrope_500Medium',
    color: SemanticColors.textSecondary,
  },
  labelActive: {
    fontFamily: 'Manrope_600SemiBold',
  },
  indicator: {
    position: 'absolute',
    bottom: 3,
    width: 16,
    height: 2.5,
    borderRadius: 1.5,
  },
});
