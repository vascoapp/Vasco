/**
 * SlotPicker actually opens, and step two actually swaps the menu.
 *
 * The static test next door proves no Alert is used to pick one of N. It
 * cannot prove the replacement WORKS — and the two-step crew flow has a real
 * trapdoor: DKMenu closes on select (`close(); item.onPress()`), so step two
 * re-opens the same balloon from inside that handler and relies on React
 * batching the close and the re-open into one commit. If that ever stopped
 * batching, picking a worker would slam the menu shut and the contractor would
 * have to tap twice — a silent regression a grep cannot see.
 *
 * ONE test per file: the harness keeps a module-scoped AppState.
 */
import React from 'react';
import { Text } from 'react-native';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';

/** Every visible string in the tree, joined. */
const texts = (tree: any) =>
  tree.root
    .findAll((n: any) => typeof n.props?.children === 'string', { deep: true })
    .map((n: any) => n.props.children)
    .join(' | ');

const pressable = (tree: any, label: string) =>
  tree.root.findAll(
    (n: any) => n.props?.accessibilityLabel === label && typeof n.props?.onPress === 'function',
    { deep: true },
  );

describe('SlotPicker', () => {
  it('picks a crew member, then a slot, in one balloon', async () => {
    const { SlotPicker } = require('../app/contractor/drag-schedule');
    const onPick = jest.fn();

    const El = () => (
      <SlotPicker
        // Nine slots. The Alert this replaced was capped at five to stay under
        // Android's three-button ceiling; a menu scrolls, so all nine must be
        // offered.
        slots={[8, 9, 10, 11, 12, 13, 14, 15, 16]}
        workers={[
          { id: 'w1', name: 'Ahmed' },
          { id: 'w2', name: 'Bram' },
          { id: 'w3', name: 'Chantal' },
          { id: 'w4', name: 'Dirk' },
        ]}
        crewMode
        onPick={onPick}
        accessibilityLabel="Tijdslot kiezen"
        labels={{
          chooseSlot: 'Tijdslot kiezen',
          assignTo: 'Toewijzen aan',
          unassign: 'Niet toewijzen',
          noSlots: 'Geen vrij tijdslot',
        }}
        renderAnchor={(open: () => void) => (
          <Text accessibilityLabel="anchor" onPress={open}>Inplannen</Text>
        )}
      />
    );

    const r = await walkScreen(El, { settlePasses: 4 });
    expect(r.error).toBeNull();

    const anchor = pressable(r.tree, 'anchor');
    expect(anchor.length).toBeGreaterThan(0);

    // Step one: the whole crew, not the first three.
    await act(async () => { anchor[0].props.onPress(); });
    const step1 = texts(r.tree);
    expect(step1).toMatch(/Ahmed/);
    expect(step1).toMatch(/Dirk/);          // the 4th — Android's Alert dropped this
    expect(step1).toMatch(/Niet toewijzen/);

    // Step two: same balloon, slot list. Picking a worker must not close it.
    const bram = (r.tree as any).root.findAll(
      (n: any) => n.props?.children === 'Bram' , { deep: true },
    );
    expect(bram.length).toBeGreaterThan(0);
    await act(async () => {
      // Walk up to the menu row that carries the press handler.
      let n = bram[0];
      while (n && typeof n.props?.onPress !== 'function') n = n.parent;
      expect(n).toBeTruthy();
      n.props.onPress();
    });

    const step2 = texts(r.tree);
    expect(step2).toMatch(/9:00/);
    expect(step2).toMatch(/16:00/);          // the 9th slot — past the old cap
    expect(onPick).not.toHaveBeenCalled();   // choosing a worker is not a schedule

    // Step three: the slot commits, carrying the worker chosen in step one.
    await act(async () => {
      let n = (r.tree as any).root.findAll((x: any) => x.props?.children === '9:00', { deep: true })[0];
      while (n && typeof n.props?.onPress !== 'function') n = n.parent;
      n.props.onPress();
    });
    expect(onPick).toHaveBeenCalledWith(9, 'w2');

    teardown(r);
  });
});
