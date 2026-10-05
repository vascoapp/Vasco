/**
 * An AI insight whose action only OPENS the place to do it (no write — sweep
 * B5) navigates there but is not marked done; a done effect retires the card.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }));
let mockResult: any;
jest.mock('../intelligence/actionExecutor', () => ({
  executeActionWithConfirmation: (_a: any, _i: string, _g: string, onResult: (r: any) => void) => onResult(mockResult),
}));
jest.mock('../intelligence/learningStorage', () => ({ recordInteraction: jest.fn(), recordInsightOutcome: jest.fn() }));

import { VascoInsightCard } from '../components/shared/VascoInsightCard';

const insight: any = {
  id: 'ins-1', category: 'financial', priority: 'medium', title: 'Uitgave', message: 'Leg je bonnetje vast', icon: 'receipt', actionLabel: 'Uitgave vastleggen',
  action: { type: 'log_expense', label: 'Uitgave vastleggen', params: {}, requiresApproval: false },
};

async function pressPrimary() {
  let tree: any;
  await act(async () => { tree = TestRenderer.create(<VascoInsightCard insight={insight} />); });
  const btn = tree.root.findAll((n: any) => typeof n.props?.onPress === 'function'
    && n.findAll((c: any) => c.props?.children === 'Uitgave vastleggen', { deep: true }).length > 0, { deep: true });
  await act(async () => { btn[btn.length - 1].props.onPress(); await new Promise((r) => setTimeout(r, 0)); });
  const texts = tree.root.findAll((n: any) => typeof n.props?.children === 'string', { deep: true }).map((n: any) => n.props.children).join(' | ');
  tree.unmount();
  return texts;
}

beforeEach(() => mockPush.mockClear());

it('opens the screen and keeps the card when nothing happened', async () => {
  mockResult = { success: false, message: '', data: { route: '/contractor/expenses' } };
  const texts = await pressPrimary();
  expect(mockPush).toHaveBeenCalledWith('/contractor/expenses');
  expect(texts).toMatch(/Leg je bonnetje vast/);
});

it('retires the card when the effect happened', async () => {
  mockResult = { success: true, message: '', data: { route: '/invoices/RE-1' } };
  const texts = await pressPrimary();
  expect(mockPush).toHaveBeenCalledWith('/invoices/RE-1');
  expect(texts).not.toMatch(/Leg je bonnetje vast/);
});

it('a custom action with only its own route still opens it', async () => {
  insight.action = { type: 'custom', label: 'Uitgave vastleggen', params: {}, requiresApproval: false, route: '/contractor/crew' };
  mockResult = { success: false, message: '' };
  const texts = await pressPrimary();
  expect(mockPush).toHaveBeenCalledWith('/contractor/crew');
  expect(texts).toMatch(/Leg je bonnetje vast/);
});
