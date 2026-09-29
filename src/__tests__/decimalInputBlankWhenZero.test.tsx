// The crew form's hourly cost opened as a white "0" VALUE, so its "35" example
// never showed and the contractor had to delete the zero first (walk,
// 2026-09-29). `blankWhenZero` is opt-in: elsewhere 0 is a real value.
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { TextInput } from 'react-native';
import { DecimalInput } from '../components/shared/DecimalInput';
import fs from 'fs';
import path from 'path';

const valueOf = (el: React.ReactElement) => {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(el); });
  return tree.root.findByType(TextInput).props.value;
};

it('shows the placeholder for 0 when blankWhenZero', () => {
  expect(valueOf(<DecimalInput value={0} onChangeValue={() => {}} blankWhenZero country="NL" />)).toBe('');
});

it('keeps 0 as a value by default', () => {
  expect(valueOf(<DecimalInput value={0} onChangeValue={() => {}} country="NL" />)).toBe('0');
});

it('a real amount still shows', () => {
  expect(valueOf(<DecimalInput value={38.5} onChangeValue={() => {}} money blankWhenZero country="NL" />)).toBe('38,50');
});

it('the crew hourly cost uses it', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../../app/contractor/crew.tsx'), 'utf8');
  expect(src).toMatch(/<DecimalInput value=\{hourlyCost\}[^>]*blankWhenZero/);
});
