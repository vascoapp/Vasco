/**
 * The licenses screen cannot write before the profile has loaded.
 *
 * Every write sends the WHOLE list, built from what is on screen. Before
 * hydrate that list is [], so adding one license replaced the contractor's
 * stored licenses (sweep 2026-09-23, D4b).
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

const mockUpdate = jest.fn(async () => undefined);
let mockState: any;
jest.mock('../src/state/AppState', () => ({ useAppState: () => mockState }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: any) => children }));

const Screen = () => require('../app/contractor/licenses').default;
const pressables = (root: any) => root.findAll((n: any) => typeof n.props?.onPress === 'function', { deep: true });

async function render() {
  let tree: any;
  const S = Screen();
  await act(async () => { tree = TestRenderer.create(<S />); });
  return tree;
}

it('before the profile loads: only the back button — nothing that can write', async () => {
  mockState = { profileLoaded: false, businessProfile: { isComplete: false, completenessPercent: 0 }, updateBusinessProfile: mockUpdate };
  const tree = await render();
  expect(pressables(tree.root).length).toBe(1); // back
  tree.unmount();
});

it('loaded: the list and its add button are there', async () => {
  mockState = { profileLoaded: true, businessProfile: { country: 'DE', licenses: [] }, updateBusinessProfile: mockUpdate };
  const tree = await render();
  expect(pressables(tree.root).length).toBeGreaterThan(1);
  tree.unmount();
});
