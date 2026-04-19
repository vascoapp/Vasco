// DraftKings-style gradient CTA primitive. Used by the Vandaag pilot.
import { Pressable, Text, View, StyleSheet, type PressableProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DK } from '../../theme/draftkings';

type Variant = 'primary' | 'secondary' | 'tertiary';

interface Props extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: Variant;
  fullWidth?: boolean;
  subLabel?: string;
}

export function DKButton({ label, variant = 'primary', fullWidth = true, subLabel, ...rest }: Props) {
  if (variant === 'primary') {
    return (
      <Pressable {...rest} style={({ pressed }) => [fullWidth && { width: '100%' }, pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] }]}>
        <View style={[styles.glowWrap, DK.effects.ctaShadow]}>
          <LinearGradient
            colors={DK.effects.ctaGradient as unknown as [string, string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primary}
          >
            <Text style={styles.primaryLabel}>{label}</Text>
            {subLabel ? <Text style={styles.primarySub}>{subLabel}</Text> : null}
          </LinearGradient>
        </View>
      </Pressable>
    );
  }
  if (variant === 'secondary') {
    return (
      <Pressable {...rest} style={({ pressed }) => [styles.secondary, fullWidth && { width: '100%' }, pressed && { opacity: 0.85 }]}>
        <Text style={styles.secondaryLabel}>{label}</Text>
      </Pressable>
    );
  }
  return (
    <Pressable {...rest} style={({ pressed }) => [styles.tertiary, fullWidth && { width: '100%' }, pressed && { opacity: 0.85 }]}>
      <Text style={styles.tertiaryLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  glowWrap: {
    borderRadius: DK.radius.button,
  },
  primary: {
    borderRadius: DK.radius.button,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontFamily: DK.type.display800,
    fontSize: 14,
    letterSpacing: 0.8,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  primarySub: {
    fontFamily: DK.type.body500,
    fontSize: 11,
    color: '#FFFFFFCC',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  secondary: {
    borderRadius: DK.radius.button,
    borderWidth: 1.5,
    borderColor: DK.colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  secondaryLabel: {
    fontFamily: DK.type.display800,
    fontSize: 13,
    letterSpacing: 0.6,
    color: DK.colors.accent,
    textTransform: 'uppercase',
  },
  tertiary: {
    borderRadius: DK.radius.button,
    borderWidth: 1,
    borderColor: DK.colors.border,
    backgroundColor: DK.colors.panel2,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tertiaryLabel: {
    fontFamily: DK.type.display700,
    fontSize: 13,
    letterSpacing: 0.5,
    color: DK.colors.text,
  },
});
