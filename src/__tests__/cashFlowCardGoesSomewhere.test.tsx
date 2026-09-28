// The 30-day cash-flow card on Geld is a button — it must go somewhere.
//
// Emulator crawl 2026-09-28: the card rendered as a Pressable with
// accessibilityRole="button", but Geld never passed `onPress`, so a tap (and a
// screen reader's "button") did nothing. Geld now opens the full forecast
// (/contractor/cashflow); the card is only a button when it has somewhere to go.
import fs from 'fs';
import path from 'path';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { stripComments } from '../utils/stripComments';

jest.mock('@expo/vector-icons/Ionicons', () => () => null);
jest.mock('../services/cashFlowForecastService', () => ({
  buildForecast: jest.fn(async () => ({
    totalInflow: 800, totalOutflow: 0, netChange: 800, outflowKnown: false,
    minCashDay: { date: '2026-10-01', cumulative: 800 }, days: [],
  })),
}));

import { CashFlowForecastCard } from '../components/contractor/CashFlowForecastCard';

async function mount(onPress?: () => void) {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<CashFlowForecastCard invoices={[]} onPress={onPress} />); });
  await act(async () => {});
  // The jest setup's react-native is not the Pressable class the card imports;
  // find the card's root by what it announces instead.
  const hits = tree.root.findAll((n) => typeof n.type !== 'string' && n.props.accessibilityLabel === 'Cash flow — next 30 days');
  expect(hits.length).toBeGreaterThan(0); // the forecast rendered at all
  return hits[0];
}

describe('CashFlowForecastCard', () => {
  it('is a button that fires when given somewhere to go', async () => {
    const onPress = jest.fn();
    const p = await mount(onPress);
    expect(p.props.accessibilityRole).toBe('button');
    expect(p.props.disabled).toBe(false);
    p.props.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is not announced as a button when it goes nowhere', async () => {
    const p = await mount(undefined);
    expect(p.props.accessibilityRole).toBeUndefined();
    expect(p.props.disabled).toBe(true);
  });
});

describe('Geld mounts the card with a destination', () => {
  it('passes onPress to the full cash-flow screen', () => {
    const src = stripComments(fs.readFileSync(path.resolve(__dirname, '../../app/(contractor)/geld.tsx'), 'utf8'));
    const m = src.match(/<CashFlowForecastCard\b[\s\S]*?\/>/);
    expect(m).not.toBeNull();
    expect(m![0]).toMatch(/onPress=\{[^}]*\/contractor\/cashflow/);
  });
});
