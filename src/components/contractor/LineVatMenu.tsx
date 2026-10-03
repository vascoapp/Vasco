// =============================================================================
// LineVatMenu — the IVA of ONE invoice line, for an Italian contractor
// =============================================================================
// In Italy a 0 % line must say WHY (FatturaPA Natura): reverse charge on a
// building subcontract (N6.3) is a different invoice in law from an exempt
// supply (N4) or the forfettario franchise (N2.2). Italian invoicing software
// asks for it the way it is asked here — one "codice IVA" per line that is
// either a rate or a 0 % reason — so a reverse-charge line is reachable at all
// (the rates the app offers otherwise start at 10 %).
//
// Picking one of N → a DKMenu (CLAUDE.md), never a chip row. The options and
// legal bases live in src/domain/vatNature.ts; this is only the picker.
// =============================================================================
import { Pressable, StyleSheet, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { DKMenu, type DKMenuItem } from '../shared/DKMenu';
import { SemanticColors } from '../../theme/colors';
import { TYPE, GRID } from '../../theme/tabStyles';
import { getSelectableVatRates } from '../../domain/business';
import { offeredVatNatures, vatNatureLabelKey, type VatNature } from '../../domain/vatNature';
import type { BusinessProfile } from '../../domain/business';

export interface LineVat {
  vatRate?: number;
  vatNature?: VatNature;
}

type Translate = (key: string, opts?: Record<string, unknown>) => string;

/** "IVA 22 %" / "N6.3 · Inversione contabile – subappalto edile" / "0 % — scegli il motivo". */
export function lineVatLabel(line: LineVat, fallbackRatePct: number, t: Translate): string {
  const rate = line.vatRate ?? fallbackRatePct;
  if (rate === 0 && line.vatNature) return `${line.vatNature} · ${t(vatNatureLabelKey(line.vatNature), { defaultValue: line.vatNature })}`;
  if (rate === 0) return t('vatNature.choose', { defaultValue: '0 % — choose why' });
  return t('vatNature.rate', { rate: String(rate).replace('.', ','), defaultValue: `${rate} %` });
}

/**
 * The menu rows: every rate the country allows, then every 0 % reason the
 * regime allows. Choosing a rate clears the nature; choosing a nature sets 0 %.
 */
export function lineVatMenuItems(args: {
  country: BusinessProfile['country'];
  regime: string | undefined;
  current: LineVat;
  fallbackRatePct: number;
  onChange: (next: { vatRate: number; vatNature?: VatNature }) => void;
  t: Translate;
}): DKMenuItem[] {
  const { country, regime, current, fallbackRatePct, onChange, t } = args;
  const rate = current.vatRate ?? fallbackRatePct;
  const rates: DKMenuItem[] = getSelectableVatRates(country).map((r) => ({
    key: `rate-${r}`,
    label: t('vatNature.rate', { rate: String(r).replace('.', ','), defaultValue: `${r} %` }),
    selected: rate === r && !current.vatNature,
    onPress: () => onChange({ vatRate: r }),
  }));
  const natures: DKMenuItem[] = offeredVatNatures(regime).map((n) => ({
    key: `nature-${n}`,
    label: `${n} · ${t(vatNatureLabelKey(n), { defaultValue: n })}`,
    detail: '0 %',
    selected: rate === 0 && current.vatNature === n,
    onPress: () => onChange({ vatRate: 0, vatNature: n }),
  }));
  return [...rates, ...natures];
}

export function LineVatMenu(props: {
  country: BusinessProfile['country'];
  regime: string | undefined;
  line: LineVat;
  fallbackRatePct: number;
  onChange: (next: { vatRate: number; vatNature?: VatNature }) => void;
}) {
  const { t } = useTranslation();
  const tt = t as unknown as Translate;
  const needsChoice = (props.line.vatRate ?? props.fallbackRatePct) === 0 && !props.line.vatNature;
  return (
    <DKMenu
      accessibilityLabel={tt('vatNature.menuLabel', { defaultValue: 'VAT for this line' })}
      items={lineVatMenuItems({ ...props, current: props.line, t: tt })}
      renderAnchor={(open) => (
        <Pressable
          onPress={open}
          style={s.anchor}
          accessibilityRole="button"
          accessibilityLabel={`${t('vatNature.menuLabel', { defaultValue: 'VAT for this line' })}: ${lineVatLabel(props.line, props.fallbackRatePct, tt)}`}
        >
          <Ionicons name="receipt-outline" size={14} color={needsChoice ? SemanticColors.feedbackWarning : SemanticColors.textTertiary} />
          <Text style={[s.value, needsChoice && s.valueNeedsChoice]} numberOfLines={2}>
            {lineVatLabel(props.line, props.fallbackRatePct, tt)}
          </Text>
          <Ionicons name="chevron-down" size={14} color={SemanticColors.textTertiary} />
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  anchor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
    paddingVertical: GRID.xs,
  },
  value: {
    flex: 1,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
  },
  valueNeedsChoice: {
    color: SemanticColors.feedbackWarning,
  },
});
