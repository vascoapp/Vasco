import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import { SafeArea } from '../../theme/spacing';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type IconName = keyof typeof Ionicons.glyphMap;

export interface BottomSheetAction {
  label: string;
  icon?: IconName;
  color?: string;
  destructive?: boolean;
  onPress: () => void;
}

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  actions: BottomSheetAction[];
}

export function BottomSheet({ visible, onClose, title, actions }: BottomSheetProps) {
  const translateY = useRef(new Animated.Value(300)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 300, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity }]}>
        <Pressable style={styles.overlayPress} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        {/* Handle */}
        <View style={styles.handle} />

        {title && <Text style={styles.title}>{title}</Text>}

        <View style={styles.actions}>
          {actions.map((action, i) => {
            const color = action.destructive
              ? SemanticColors.feedbackError
              : action.color || SemanticColors.textPrimary;

            return (
              <Pressable
                key={i}
                style={({ pressed }) => [styles.actionRow, pressed && { backgroundColor: SemanticColors.surfaceSecondary }]}
                onPress={() => { action.onPress(); onClose(); }}
              >
                {action.icon && (
                  <View style={[styles.actionIcon, { backgroundColor: color + '12' }]}>
                    <Ionicons name={action.icon} size={20} color={color} />
                  </View>
                )}
                <Text style={[styles.actionLabel, { color }]}>{action.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={SemanticColors.textDisabled} />
              </Pressable>
            );
          })}
        </View>

        {/* Cancel */}
        <Pressable
          style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.8 }]}
          onPress={onClose}
        >
          <Text style={styles.cancelText}>Annuleren</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  overlayPress: {
    flex: 1,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: SemanticColors.surfacePrimary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: SafeArea.bottom + 12,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: SemanticColors.borderDefault,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontFamily: 'Manrope_700Bold',
    color: SemanticColors.textPrimary,
    marginBottom: 16,
  },
  actions: {
    gap: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 12,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Manrope_500Medium',
  },
  cancelBtn: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 14,
  },
  cancelText: {
    fontSize: 15,
    fontFamily: 'Manrope_600SemiBold',
    color: SemanticColors.textSecondary,
  },
});
