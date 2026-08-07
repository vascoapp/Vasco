// =============================================================================
// DKSelect — single-choice picker: trigger row + centred iOS-style bubble
// =============================================================================
// Replaces the horizontal chip strip that several forms used for picking one
// value out of a list. That pattern has two failures that only show up with
// real data: options past the third are off-screen with no affordance saying
// so, and the strip grows unboundedly — a contractor with 40 customers had to
// swipe blind through 40 pills.
//
// A trigger row states the current choice in one line and opens a scrollable
// bubble. Search appears once the list is long enough to need it; below that it
// is noise. Native `Modal` handles the backdrop, and `onRequestClose` is set so
// Android's back gesture dismisses the picker instead of the whole screen.
// =============================================================================

import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { DK } from '../../theme/draftkings';
import { TYPE, GRID, RADIUS } from '../../theme/tabStyles';
import { hapticSelection } from '../../utils/haptics';

/** Show the search box only once scanning the list by eye stops being viable. */
const SEARCH_THRESHOLD = 8;

export interface DKSelectOption {
  value: string;
  label: string;
  /** Optional second line — e.g. an address, so two "Jansen" rows are telling apart. */
  sublabel?: string;
}

interface Props {
  value: string;
  options: DKSelectOption[];
  onChange: (value: string) => void;
  /** Sheet heading. Also used as the accessibility label for the trigger. */
  title: string;
  placeholder?: string;
  /** Shown inside the sheet when there is nothing to pick from. */
  emptyText?: string;
  disabled?: boolean;
  testID?: string;
}

export function DKSelect({
  value,
  options,
  onChange,
  title,
  placeholder,
  emptyText,
  disabled,
  testID,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Clamped, not trusted: useSafeAreaInsets reads the provider OUTSIDE the
  // Modal, and no device has a bottom inset over 34pt.
  const bottomPad = Math.min(Math.max(insets.bottom, GRID.md), 34);

  const selected = options.find((o) => o.value === value);
  const showSearch = options.length >= SEARCH_THRESHOLD;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.sublabel ?? '').toLowerCase().includes(q),
    );
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const pick = (v: string) => {
    hapticSelection();
    onChange(v);
    close();
  };

  return (
    <>
      <Pressable
        testID={testID}
        disabled={disabled}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityValue={{ text: selected?.label ?? placeholder ?? '' }}
        style={({ pressed }) => [
          styles.trigger,
          pressed && styles.triggerPressed,
          disabled && styles.triggerDisabled,
        ]}
      >
        <Text
          style={[styles.triggerText, !selected && styles.triggerPlaceholder]}
          numberOfLines={1}
        >
          {selected?.label ?? placeholder ?? t('common.select', 'Select')}
        </Text>
        <Ionicons name="chevron-down" size={18} color={DK.colors.textMuted} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={close}
        statusBarTranslucent
      >
        <View style={[styles.modalRoot, { height: windowHeight }]}>
          {/* Backdrop is its own Pressable so a tap outside the card dismisses. */}
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel={t('common.cancel', 'Cancel')} />

          <View style={[styles.sheetWrap, { paddingBottom: bottomPad }]}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{title.toUpperCase()}</Text>

            {showSearch && (
              <View style={styles.searchWrap}>
                <Ionicons name="search" size={16} color={DK.colors.textMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('common.search', 'Search')}
                  placeholderTextColor={DK.colors.textMuted}
                  style={styles.searchInput}
                  autoCorrect={false}
                  returnKeyType="search"
                />
              </View>
            )}

            {filtered.length === 0 ? (
              <Text style={styles.empty}>
                {options.length === 0
                  ? emptyText ?? t('common.noOptions', 'Nothing to choose from yet')
                  : t('common.noResults', 'No results found')}
              </Text>
            ) : (
              <ScrollView
                style={styles.list}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {filtered.map((o, idx) => {
                  const isSel = o.value === value;
                  return (
                    <Pressable
                      key={o.value}
                      onPress={() => pick(o.value)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSel }}
                      style={({ pressed }) => [
                        styles.option,
                        idx > 0 && styles.optionBorder,
                        pressed && styles.optionPressed,
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optionLabel, isSel && styles.optionLabelSel]} numberOfLines={1}>
                          {o.label}
                        </Text>
                        {o.sublabel ? (
                          <Text style={styles.optionSub} numberOfLines={1}>{o.sublabel}</Text>
                        ) : null}
                      </View>
                      {isSel && <Ionicons name="checkmark" size={20} color={DK.colors.accent} />}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>

          <Pressable
            style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.7 }]}
            onPress={close}
            accessibilityRole="button"
          >
            <Text style={styles.cancelText}>{t('common.cancel', 'Cancel')}</Text>
          </Pressable>
        </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    backgroundColor: DK.colors.panel,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: DK.colors.border,
    paddingHorizontal: GRID.md,
    paddingVertical: GRID.md,
  },
  triggerPressed: { borderColor: DK.colors.accent },
  triggerDisabled: { opacity: 0.5 },
  triggerText: { flex: 1, fontSize: 14, fontFamily: TYPE.bodyFamily, color: DK.colors.text },
  triggerPlaceholder: { color: DK.colors.textMuted },

  // CENTRED, not bottom-anchored — deliberately.
  //
  // RN's Modal host view is unreachable in its bottom ~102pt on this device:
  // measured on an iPhone 17 sim, the sheet's lowest pixel landed at 772pt of an
  // 874pt screen under FOUR independent attempts — flex-end, `bottom: 0`, an
  // explicit module-level window height, and a live `useWindowDimensions()`
  // height. A bottom sheet that stops 100pt above the bottom reads as broken,
  // and the only way to close the gap would be a hard-coded offset that is
  // wrong on the next device.
  //
  // A centred bubble does not care where the bottom edge is.
  modalRoot: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },

  sheetWrap: {
    paddingHorizontal: GRID.lg,
    gap: GRID.sm,
  },
  sheet: {
    backgroundColor: DK.colors.panel2,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: DK.colors.border,
    paddingTop: GRID.md,
    paddingBottom: GRID.xs,
    overflow: 'hidden',
    // The list is capped rather than sized to content: a 40-customer sheet must
    // not cover the whole screen, and a 2-customer one must not look empty.
    maxHeight: '70%',
  },
  sheetTitle: {
    fontFamily: DK.type.display800,
    fontSize: 12,
    letterSpacing: 1.3,
    color: DK.colors.textMuted,
    paddingHorizontal: GRID.md,
    marginBottom: GRID.sm,
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.sm,
    marginHorizontal: GRID.md, marginBottom: GRID.sm,
    backgroundColor: DK.colors.bg,
    borderRadius: RADIUS.md,
    paddingHorizontal: GRID.sm,
  },
  searchInput: {
    flex: 1, color: DK.colors.text,
    fontFamily: TYPE.bodyFamily, fontSize: 14,
    paddingVertical: GRID.sm,
  },
  list: { flexGrow: 0 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.sm,
    paddingHorizontal: GRID.md, paddingVertical: 14,
  },
  optionBorder: { borderTopWidth: 1, borderTopColor: DK.colors.border },
  optionPressed: { backgroundColor: DK.colors.accent + '15' },
  optionLabel: { fontSize: 15, fontFamily: TYPE.bodyFamily, color: DK.colors.text },
  optionLabelSel: { color: DK.colors.accent, fontFamily: TYPE.titleFamily },
  optionSub: { fontSize: 12, fontFamily: TYPE.captionFamily, color: DK.colors.textMuted, marginTop: 2 },
  empty: {
    fontSize: 14, fontFamily: TYPE.bodyFamily, color: DK.colors.textMuted,
    textAlign: 'center', paddingVertical: GRID.lg, paddingHorizontal: GRID.md,
  },
  cancel: {
    backgroundColor: DK.colors.panel2,
    borderRadius: RADIUS.xl,
    paddingVertical: 15,
    alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontFamily: DK.type.display700, color: DK.colors.text },
});
