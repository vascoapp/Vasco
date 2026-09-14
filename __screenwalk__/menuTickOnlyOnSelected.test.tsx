/**
 * A DKMenu ticks the selected row and NO other.
 *
 * 2026-09-14, Android device: the unselected rows' tick was an Ionicons glyph
 * coloured 'transparent', and Android drew it BLACK — the timesheet's job picker
 * showed a tick beside all three options, every menu in the app the same. The
 * test renderer cannot see colour, so this asserts the structure instead: one
 * checkmark glyph per selected row, and no glyph "hidden" by colour.
 *
 * ONE test per file (module-scoped AppState in the harness).
 */
import React from 'react';
import { act } from 'react-test-renderer';
import { walkScreen } from '../src/test-utils/screenWalk';

describe('DKMenu tick', () => {
  it('renders a checkmark only for the selected item', async () => {
    const { DKMenu } = require('../src/components/shared/DKMenu');
    const { Text } = require('react-native');
    const El = () => (
      <DKMenu
        accessibilityLabel="Auftrag wählen"
        items={[
          { key: 'a', label: 'Heizungswartung', onPress: () => {} },
          { key: 'b', label: 'Badsanierung', selected: true, onPress: () => {} },
          { key: 'c', label: 'Ohne Auftrag', emphasis: true, onPress: () => {} },
        ]}
        renderAnchor={(open: () => void) => (
          <Text accessibilityLabel="anchor" onPress={open}>anchor</Text>
        )}
      />
    );
    const r = await walkScreen(El, { settlePasses: 4 });
    expect(r.error).toBeNull();

    const root = (r.tree as any).root;
    const anchor = root.findAll(
      (n: any) => n.props?.accessibilityLabel === 'anchor' && typeof n.props?.onPress === 'function',
      { deep: true },
    );
    await act(async () => { anchor[0].props.onPress(); });

    // Sanity: the menu is open, otherwise "no stray ticks" proves nothing.
    const labels = root.findAll((n: any) => n.props?.children === 'Ohne Auftrag', { deep: true });
    expect(labels.length).toBeGreaterThan(0);

    const ticks = root.findAll(
      (n: any) => n.props?.name === 'checkmark' && typeof n.type !== 'string',
      { deep: true },
    );
    // Composite glyph components can nest; count distinct top-level ones.
    const outer = ticks.filter((n: any) => !ticks.includes(n.parent));
    expect(outer).toHaveLength(1);
    expect(outer[0].props.color).not.toBe('transparent');
  });
});
