/**
 * WideScreenFrame, asserted through the harness's real viewport mechanism
 * rather than a mocked hook.
 *
 * It lives here, and not beside the component, for a concrete reason: under the
 * main jest config react-test-renderer renders `<View><Text>x</Text></View>`
 * to `null`, so a tree-shape assertion there passes or fails for reasons that
 * have nothing to do with this component. This config mounts real screens, and
 * WALK_VIEWPORT already drives Dimensions — which is what useWindowDimensions
 * reads. So the same file asserts the phone contract under `npm run walk` and
 * the wide contract under `npm run walk:ipad`, using the mechanism the app
 * itself uses.
 */
import React from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import { WideScreenFrame, WIDE_SCREEN_MAX_WIDTH } from '../src/components/shared/WideScreenFrame';

const VIEWPORT = process.env.WALK_VIEWPORT ?? 'phone';
const isWide = VIEWPORT !== 'phone';

// `act` is not optional here. React 19's test renderer does not flush the
// initial mount without it, and an unflushed tree reads as `toJSON() === null`
// — which looks exactly like "the component rendered nothing". screenWalk.tsx
// wraps its mounts for the same reason.
const tree = async (): Promise<any> => {
  let r!: renderer.ReactTestRenderer;
  await act(async () => {
    r = renderer.create(
      <WideScreenFrame>
        <Text>screen</Text>
      </WideScreenFrame>,
    );
  });
  return r.toJSON() as any;
};

describe(`WideScreenFrame @ ${VIEWPORT}`, () => {
  it('renders the screen it wraps, whatever the viewport', async () => {
    expect(JSON.stringify(await tree())).toContain('screen');
  });

  if (!isWide) {
    it('adds NO wrapper on a phone', async () => {
      // Not "a View with neutral styles" — no View at all. This path serves
      // 100% of real users today and the wide path serves an iPad nobody has
      // asked for yet; a regression that costs the first to help the second is
      // the wrong trade, so it is pinned rather than left to review.
      expect((await tree()).type).toBe('Text');
    });
  } else {
    it('constrains and centres on a wide canvas', async () => {
      const t = await tree();
      expect(t.type).toBe('View');
      expect(t.props.style).toMatchObject({ alignItems: 'center' });
      expect(t.children[0].props.style).toMatchObject({
        maxWidth: WIDE_SCREEN_MAX_WIDTH,
        width: '100%',
      });
    });

    it('does not grow with the canvas', async () => {
      // The point of the whole component: a 13" iPad in landscape gets wider
      // gutters, never a wider app.
      expect((await tree()).children[0].props.style.maxWidth).toBe(WIDE_SCREEN_MAX_WIDTH);
    });
  }
});
