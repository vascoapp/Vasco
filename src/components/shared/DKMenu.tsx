// =============================================================================
// DK MENU — the iOS-style balloon menu. The sanctioned way to pick one of N.
// =============================================================================
// House rule: Vasco does NOT use chip/pill rows as menus. A horizontal strip of
// pills hides its own options (anything past the right edge is invisible until
// you scroll), gives no indication how many there are, and reads as filters
// rather than a choice. Single-choice pickers use this component.
//
// Chips remain correct for MULTI-SELECT filters and toggles, where every option
// is meant to be visible at once and more than one can be on.
//
// Deliberately NOT a native UIMenu (@react-native-menu/menu): that is a native
// module, so adopting it would force a native rebuild and take every fix in
// this repo off the OTA channel. This is a plain Modal + measured anchor, so it
// ships as JS — and it renders identically on Android, where UIMenu does not
// exist at all.
// =============================================================================

import { useRef, useState, useCallback, type ReactNode } from 'react';
import { View, Text, Modal, Pressable, ScrollView, StyleSheet, type LayoutRectangle, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DK } from '../../theme/draftkings';
import { TYPE, GRID, RADIUS } from '../../theme/tabStyles';

export interface DKMenuItem {
  key: string;
  label: string;
  /** Shown under the label — a count, a date, whatever qualifies the choice. */
  detail?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Ticked. The menu shows the current selection rather than hiding it. */
  selected?: boolean;
  /** Rendered in the accent colour and separated — "New project", "Clear". */
  emphasis?: boolean;
  onPress: () => void;
}

interface Props {
  /** The always-visible button. Receives the open handler. */
  renderAnchor: (open: () => void) => ReactNode;
  items: DKMenuItem[];
  /** Announced when the sheet opens. */
  accessibilityLabel: string;
}

/** Comfortable width for a SMALL anchor. A wide anchor gets its own width. */
const MENU_MIN_WIDTH = 260;
const SCREEN_MARGIN = GRID.md;

export function DKMenu({ renderAnchor, items, accessibilityLabel }: Props) {
  const anchorRef = useRef<View>(null);
  const [frame, setFrame] = useState<LayoutRectangle | null>(null);
  // Live dimensions, not a module-level Dimensions.get(): that snapshot is
  // taken before layout and survives rotation, which is how a previous bottom
  // sheet came to rest 100pt short of the screen edge.
  const { width: screenWidth } = useWindowDimensions();

  // Never narrower than the control that opened it. At a fixed 260 the
  // full-width project anchor produced a balloon that truncated every option
  // ("Badkamer renovatie —…", "Keuken verbouwing —…") — which defeats the point
  // of this component, since it exists so a chip strip cannot hide options.
  const menuWidth = frame
    ? Math.min(screenWidth - SCREEN_MARGIN * 2, Math.max(MENU_MIN_WIDTH, frame.width))
    : MENU_MIN_WIDTH;

  // Measured at open time, not on layout: the anchor can move (the strip sits
  // inside a scroll view), and a stale frame puts the balloon over the wrong row.
  const open = useCallback(() => {
    // Open FIRST, refine the position after. Measuring is best-effort: the
    // callback may never fire (it does not under the test renderer, and a node
    // that is detached or off-screen behaves the same on device), and waiting
    // for it left the tap doing nothing at all — a dead control with no error,
    // which is the failure mode this component exists to remove. A balloon in
    // a slightly wrong place beats a button that ignores you.
    setFrame({ x: SCREEN_MARGIN, y: 96, width: MENU_MIN_WIDTH, height: 0 });
    const node: any = anchorRef.current;
    if (typeof node?.measureInWindow !== 'function') return;
    node.measureInWindow((x: number, y: number, width: number, height: number) => {
      // Zeros mean "not laid out", not "at the origin" — keep the fallback.
      if (!width && !height) return;
      setFrame({ x, y, width, height });
    });
  }, []);

  const close = useCallback(() => setFrame(null), []);

  return (
    <>
      <View ref={anchorRef} collapsable={false}>
        {renderAnchor(open)}
      </View>

      <Modal visible={frame !== null} transparent animationType="fade" onRequestClose={close}>
        {/* Full-screen catcher: tapping anywhere outside dismisses, which is
            what makes this read as a popover rather than a dialog. */}
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel={accessibilityLabel}>
          {frame ? (
            <Pressable
              style={[
                styles.balloon,
                {
                  top: frame.y + frame.height + 6,
                  width: menuWidth,
                  // Right-align to the anchor, then clamp to BOTH screen edges:
                  // an anchor near the right edge would push the balloon off,
                  // and a menu widened to match a full-width anchor would
                  // overflow the left if only the right were clamped.
                  left: Math.max(
                    SCREEN_MARGIN,
                    Math.min(
                      frame.x + frame.width - menuWidth,
                      screenWidth - SCREEN_MARGIN - menuWidth,
                    ),
                  ),
                },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <ScrollView bounces={false} style={styles.scroll}>
                {items.map((item, i) => (
                  <Pressable
                    key={item.key}
                    style={[
                      styles.item,
                      i > 0 && styles.itemBorder,
                      item.emphasis && styles.itemEmphasis,
                    ]}
                    onPress={() => {
                      close();
                      item.onPress();
                    }}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: !!item.selected }}
                  >
                    {item.icon ? (
                      <Ionicons
                        name={item.icon}
                        size={16}
                        color={item.emphasis ? DK.colors.accent : DK.colors.textMuted}
                      />
                    ) : null}
                    <View style={styles.itemMain}>
                      <Text
                        style={[styles.itemLabel, item.emphasis && styles.itemLabelEmphasis]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                      {item.detail ? (
                        <Text style={styles.itemDetail} numberOfLines={1}>{item.detail}</Text>
                      ) : null}
                    </View>
                    {/* The tick stays in the layout when absent so labels do
                        not shift as the selection moves. */}
                    <Ionicons
                      name="checkmark"
                      size={16}
                      color={item.selected ? DK.colors.accent : 'transparent'}
                    />
                  </Pressable>
                ))}
              </ScrollView>
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000055' },
  balloon: {
    position: 'absolute',
    backgroundColor: DK.colors.panel2,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: DK.colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  // Capped so a contractor with twenty projects gets a scrollable balloon
  // rather than one running off the bottom of the screen.
  scroll: { maxHeight: 320 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    paddingHorizontal: GRID.md,
    paddingVertical: 12,
  },
  itemBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: DK.colors.border },
  itemEmphasis: { backgroundColor: DK.colors.panel },
  // flex:1 so a long project name truncates inside the row instead of pushing
  // the tick off the balloon.
  itemMain: { flex: 1 },
  itemLabel: { fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: DK.colors.text },
  itemLabelEmphasis: { fontFamily: TYPE.titleFamily, color: DK.colors.accent },
  itemDetail: { fontSize: TYPE.labelSize, fontFamily: TYPE.bodyFamily, color: DK.colors.textMuted, marginTop: 1 },
});
