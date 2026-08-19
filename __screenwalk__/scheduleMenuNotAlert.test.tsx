/**
 * The schedule board must never offer a choice through an Alert again.
 *
 * RN's Android Alert silently keeps only the FIRST THREE buttons (learnings
 * #140). This screen shipped `Alert.alert(…, [...5 slots, cancel])` and
 * `Alert.alert(…, [...N workers, unassign, cancel])`, so an Android contractor
 * could pick from two time slots and never reach the third crew member — with
 * no error, no truncation indicator, nothing. That is data loss on the primary
 * scheduling flow, and it is invisible from an iPhone.
 *
 * A count assertion, not a snapshot: the point is the CAP, so the test states
 * the cap. Confirmations (conflict, trade mismatch, remove) are still Alerts
 * and still legitimate — they are 2-button yes/no, not a choice among N.
 */
import fs from 'fs';
import path from 'path';

const FILE = path.join(__dirname, '..', 'app', 'contractor', 'drag-schedule.tsx');
const src = fs.readFileSync(FILE, 'utf8');

/** Strip comments so prose describing the old bug does not trip the checks. */
const code = src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

describe('schedule board — picking one of N is a menu, never an Alert', () => {
  it('builds no Alert button list by spreading a collection', () => {
    // `...slots.map(`, `...activeWorkers.map(` — a spread INTO an Alert button
    // array is the exact shape that blows the Android cap.
    const spreadIntoAlert = /Alert\.alert\([\s\S]{0,400}?\.\.\.\w+[\s\S]{0,80}?\.map\(/g;
    expect(code.match(spreadIntoAlert) ?? []).toHaveLength(0);
  });

  it('keeps every remaining Alert at three buttons or fewer', () => {
    // Android shows three. An Alert with four is a silently truncated menu
    // wearing a confirmation's clothes.
    const alerts = code.match(/Alert\.alert\([\s\S]*?\n\s*\);/g) ?? [];
    const overCap = alerts
      .map((a) => ({ a, buttons: (a.match(/\{\s*text:/g) ?? []).length }))
      .filter((x) => x.buttons > 3);
    expect(overCap.map((x) => x.a.slice(0, 90))).toEqual([]);
  });

  it('routes both pickers through DKMenu', () => {
    expect(code).toContain("from '../../src/components/shared/DKMenu'");
    // The pool card schedules through SlotPicker; a scheduled block reassigns
    // through BlockPressable. Both are DKMenu anchors.
    expect(code).toMatch(/<SlotPicker/);
    expect(code).toMatch(/<BlockPressable/);
  });

  it('no longer caps the slot list at five', () => {
    // `.slice(0, 5)` existed only to stay under the Alert cap. A DKMenu
    // scrolls, so every slot the job fits in is offered.
    expect(code).not.toMatch(/HOURS\.filter\([^)]*\)\.slice\(/);
  });

  it('does not claim a drag it does not implement', () => {
    // No PanResponder / Gesture / reanimated has ever been imported here. The
    // header used to promise "long-press to pick up a job, drag to a time
    // slot" — a name and a comment are the most-read documentation there is.
    const claimsDrag = /drag to a time slot|Gesture-based/i.test(src);
    const hasGesture = /PanResponder|PanGestureHandler|Gesture\.Pan|useAnimatedGestureHandler/.test(code);
    expect(claimsDrag && !hasGesture).toBe(false);
  });
});
