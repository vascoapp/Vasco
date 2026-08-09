import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { AppStateProvider, useAppState } from '../src/state/AppState';
import { AuthProvider } from '../src/context/AuthContext';
import * as dp from '../src/lib/dataProvider';
import * as eh from '../src/utils/errorHandler';

it('listProjects reached now', async () => {
  const warns: string[] = [];
  jest.spyOn(eh, 'logWarn').mockImplementation((s: any, m: any) => { warns.push(`${s}: ${m}`); });
  const spy = jest.spyOn(dp, 'listProjects');
  const Probe = () => { const { projects } = useAppState(); return <Text>{`projects=${projects.length}`}</Text>; };
  let tree: any;
  await act(async () => { tree = renderer.create(<AuthProvider><AppStateProvider><Probe /></AppStateProvider></AuthProvider>); });
  for (let i = 0; i < 40; i++) await act(async () => { await Promise.resolve(); await new Promise(r => setTimeout(r, 1)); });
  console.log('RENDER:', JSON.stringify(tree.toJSON()?.children), '| listProjects calls:', spy.mock.calls.length, '| warns:', JSON.stringify(warns));
  tree.unmount();
});
