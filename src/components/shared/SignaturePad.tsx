// =============================================================================
// SIGNATURE PAD — capture a digital signature for handover
// =============================================================================
// Uses react-native-gesture-handler + react-native-svg (already in package).
// Emits an SVG path string on "Save" — stored on the job as a signature blob
// alongside the completion checklist.
// =============================================================================

import { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { GestureHandlerRootView, PanGestureHandler } from 'react-native-gesture-handler';
import type { PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import { SemanticColors, Palette } from '../../theme/colors';
import { TYPE, RADIUS, GRID } from '../../theme/tabStyles';

interface Props {
  onSave: (svgPath: string) => void;
  onClear?: () => void;
  label?: string;
}

const PAD_HEIGHT = 180;

export function SignaturePad({ onSave, onClear, label }: Props) {
  const [paths, setPaths] = useState<string[]>([]);
  const currentPath = useRef<string>('');

  const onGesture = (e: PanGestureHandlerGestureEvent) => {
    const { x, y, state } = e.nativeEvent as any;
    if (state === 2 /* BEGAN */ || currentPath.current === '') {
      currentPath.current = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    } else {
      currentPath.current += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    setPaths((prev) => {
      const next = [...prev];
      next[next.length - 1] = currentPath.current;
      return next;
    });
  };

  const onBegin = () => {
    currentPath.current = '';
    setPaths((prev) => [...prev, '']);
  };

  const clear = () => {
    setPaths([]);
    currentPath.current = '';
    onClear?.();
  };

  const save = () => {
    if (paths.filter((p) => p.length > 0).length === 0) return;
    // Wrap in a minimal SVG string so the receiver can embed it anywhere
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 ${PAD_HEIGHT}">${paths
      .map((p) => `<path d="${p}" fill="none" stroke="#0D1B2A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`)
      .join('')}</svg>`;
    onSave(svg);
  };

  const isEmpty = paths.every((p) => p.length === 0);

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <GestureHandlerRootView style={styles.pad}>
        <PanGestureHandler onGestureEvent={onGesture} onBegan={onBegin}>
          <View style={StyleSheet.absoluteFill}>
            <Svg width="100%" height={PAD_HEIGHT} viewBox={`0 0 360 ${PAD_HEIGHT}`}>
              {paths.map((p, i) => (
                <Path key={i} d={p} fill="none" stroke="#0D1B2A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </Svg>
          </View>
        </PanGestureHandler>
      </GestureHandlerRootView>
      <View style={styles.row}>
        <Pressable onPress={clear} style={styles.clearBtn} accessibilityRole="button" accessibilityLabel="Clear signature">
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>
        <Pressable
          onPress={save}
          disabled={isEmpty}
          style={[styles.saveBtn, isEmpty && { opacity: 0.4 }]}
          accessibilityRole="button"
          accessibilityLabel="Save signature"
        >
          <Text style={styles.saveText}>Save signature</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: GRID.sm },
  label: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textSecondary },
  pad: {
    height: PAD_HEIGHT,
    backgroundColor: Palette.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderMuted,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', gap: GRID.sm, justifyContent: 'flex-end' },
  clearBtn: { paddingHorizontal: GRID.md, paddingVertical: GRID.sm + 2, borderRadius: RADIUS.sm, backgroundColor: SemanticColors.surfaceSecondary },
  clearText: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textSecondary },
  saveBtn: { paddingHorizontal: GRID.md, paddingVertical: GRID.sm + 2, borderRadius: RADIUS.sm, backgroundColor: Palette.hermesOrange },
  saveText: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: Palette.white },
});
