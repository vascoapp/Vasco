/**
 * The quote builder does not offer generation production cannot run.
 *
 * 2026-09-14, German device: "Leistungsumfang generieren — KI-erstellter Text"
 * answered after twelve seconds with "konnte nicht generiert werden"; the photo
 * tile calls the same dark LLM backend. With EXPO_PUBLIC_LLM_ENABLED unset
 * (every build profile today) neither may render, and the scope stays writable.
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import nl from '../src/i18n/locales/nl.json';
import { LLM_GENERATION_ENABLED } from '../src/config/ai';

const TieredQuote = () => require('../app/contractor/tiered-quote').default;

describe('quote builder with no LLM', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('shows no photo scan and no generate button, and keeps a scope field', async () => {
    expect(LLM_GENERATION_ENABLED).toBe(false);
    // A built-in template gives the builder lines, so the review step — where
    // the scope section lives — can be reached.
    const r = await walkScreen(TieredQuote(), { settlePasses: 10, params: { templateId: 'qt-1' } });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;

    // Step 1: no photo tile.
    expect(root.findAll((n: any) => n.props?.testID === 'ai-scan-row', { deep: true })).toHaveLength(0);

    // Step 2: the review step.
    const review = (nl as any).quotes.reviewQuote as string;
    const reviewBtn = root.findAll(
      (n: any) => typeof n.props?.onPress === 'function'
        && n.findAll((c: any) => c.props?.children === review, { deep: true }).length > 0,
      { deep: true },
    );
    expect(reviewBtn.length).toBeGreaterThan(0);
    await act(async () => { reviewBtn[reviewBtn.length - 1].props.onPress(); });
    for (let i = 0; i < 6; i++) await act(async () => { await new Promise((res) => setTimeout(res, 0)); });
    const texts = root.findAll((n: any) => typeof n.props?.children === 'string', { deep: true }).map((n: any) => n.props.children).join(' ');
    expect(texts).toContain((nl as any).quotes.scopeTitle);

    const generate = (nl as any).quotes.scopeGenerate as string;
    expect(root.findAll((n: any) => n.props?.accessibilityLabel === generate, { deep: true })).toHaveLength(0);
    expect(texts).not.toContain(generate);

    const scopeField = root.findAll(
      (n: any) => typeof n.props?.onChangeText === 'function'
        && n.props?.accessibilityLabel === (nl as any).quotes.scopeTitle,
      { deep: true },
    );
    expect(scopeField.length).toBeGreaterThan(0);
    teardown(r);
  });
});
