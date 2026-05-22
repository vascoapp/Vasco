import { useEffect, useRef } from 'react';
import { Text, StyleSheet, Animated, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../theme/colors';
import { SafeArea } from '../../theme/spacing';
import { RADIUS } from '../../theme/tabStyles';

type IconName = keyof typeof Ionicons.glyphMap;

interface ToastProps {
  message: string;
  visible: boolean;
  onHide: () => void;
  duration?: number;
  icon?: IconName;
  type?: 'success' | 'error' | 'info';
}

const TYPE_CONFIG = {
  success: { icon: 'checkmark-circle' as IconName, color: SemanticColors.feedbackSuccess, bg: SemanticColors.feedbackSuccessBg },
  error: { icon: 'alert-circle' as IconName, color: SemanticColors.feedbackError, bg: SemanticColors.feedbackErrorBg },
  info: { icon: 'information-circle' as IconName, color: SemanticColors.feedbackInfo, bg: SemanticColors.feedbackInfoBg },
};

export function Toast({ message, visible, onHide, duration = 2500, icon, type = 'success' }: ToastProps) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 15, stiffness: 200 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: -100, duration: 300, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start(() => onHide());
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  const cfg = TYPE_CONFIG[type];
  const displayIcon = icon || cfg.icon;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }], opacity, backgroundColor: cfg.bg }]}>
      <Ionicons name={displayIcon} size={20} color={cfg.color} />
      <Text style={[styles.message, { color: cfg.color }]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: SafeArea.top + 8,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    shadowColor: Palette.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 999,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Archivo_700Bold',
  },
});
