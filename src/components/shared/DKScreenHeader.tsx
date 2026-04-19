// Shared DraftKings-style screen header for drill-down screens.
// Back button (left, dark panel circle) · uppercase Archivo 900 title · optional right actions.

import { Pressable, Text, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { DK } from '../../theme/draftkings';

type IconName = keyof typeof Ionicons.glyphMap;

interface Action {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel?: string;
  tone?: string;
}

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: Action[];
  containerStyle?: StyleProp<ViewStyle>;
}

export function DKScreenHeader({ title, subtitle, onBack, actions, containerStyle }: Props) {
  const router = useRouter();
  const handleBack = onBack ?? (() => router.back());
  return (
    <SafeAreaView edges={['top']} style={[{ backgroundColor: DK.colors.bg }, containerStyle]}>
      <View style={styles.bar}>
        <Pressable onPress={handleBack} hitSlop={8} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={22} color={DK.colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{title.toUpperCase()}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle.toUpperCase()}</Text> : null}
        </View>
        <View style={styles.actions}>
          {(actions || []).map((a, i) => (
            <Pressable key={i} onPress={a.onPress} hitSlop={8} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={a.accessibilityLabel ?? a.icon}>
              <Ionicons name={a.icon} size={20} color={a.tone ?? DK.colors.text} />
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DK.colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: DK.colors.border,
  },
  title: {
    fontFamily: DK.type.display900,
    fontSize: 18,
    color: DK.colors.text,
    letterSpacing: 1.2,
  },
  subtitle: {
    fontFamily: DK.type.display800,
    fontSize: 10,
    color: DK.colors.textMuted,
    letterSpacing: 1.3,
    marginTop: 2,
  },
  actions: { flexDirection: 'row', gap: 8 },
});
