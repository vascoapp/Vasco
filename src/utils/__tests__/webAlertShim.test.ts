/**
 * @jest-environment jsdom
 *
 * react-native-web ships Alert as `class Alert { static alert() {} }`. Every
 * confirmation, every multi-option picker, every destructive-action guard in
 * the app runs through Alert.alert — so in a browser all 361 of them were
 * silently no-ops, and the buttons that open them read as broken.
 *
 * These tests pin the two halves of the fix: the shim must actually replace
 * the no-op AND must route each button's onPress. The decoy check matters
 * most — an implementation that renders the dialog but drops onPress looks
 * identical in a screenshot and still loses the work.
 */
import { Alert, Platform } from 'react-native';
import { installWebAlert } from '../webAlertShim';

const originalAlert = (Alert as any).alert;

describe('webAlertShim', () => {
  afterEach(() => {
    (Alert as any).alert = originalAlert;
    (Platform as any).OS = 'ios';
    document.body.innerHTML = '';
  });

  it('leaves Alert untouched on native', () => {
    (Platform as any).OS = 'ios';
    installWebAlert();
    expect((Alert as any).alert).toBe(originalAlert);
  });

  it('replaces the no-op on web and renders title, message and every button', () => {
    (Platform as any).OS = 'web';
    installWebAlert();
    expect((Alert as any).alert).not.toBe(originalAlert);

    Alert.alert('Klus afronden', 'Ontbreekt:\n• Aftekening klant', [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Handtekening vastleggen' },
      { text: 'Afronden' },
    ]);

    const buttons = Array.from(document.querySelectorAll('button')).map((b) => b.textContent);
    expect(buttons).toEqual(['Annuleren', 'Handtekening vastleggen', 'Afronden']);
    expect(document.body.textContent).toContain('Klus afronden');
    // The newline-joined checklist is the whole point of the message body.
    expect(document.body.textContent).toContain('• Aftekening klant');
  });

  it('invokes the pressed button onPress and dismisses', () => {
    (Platform as any).OS = 'web';
    installWebAlert();
    const onPress = jest.fn();

    Alert.alert('Ik kom eraan', 'Wanneer ben je er?', [
      { text: '10 min', onPress },
      { text: 'Annuleren', style: 'cancel' },
    ]);

    const first = document.querySelectorAll('button')[0] as HTMLButtonElement;
    first.click();

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('button')).toHaveLength(0);
  });

  it('lets an onPress open the next dialog — the ETA and completion flows chain', () => {
    (Platform as any).OS = 'web';
    installWebAlert();

    Alert.alert('First', undefined, [
      { text: 'Next', onPress: () => Alert.alert('Second', undefined, [{ text: 'OK' }]) },
    ]);
    (document.querySelectorAll('button')[0] as HTMLButtonElement).click();

    expect(document.body.textContent).toContain('Second');
    expect(document.body.textContent).not.toContain('First');
  });

  it('defaults to a single OK when no buttons are given', () => {
    (Platform as any).OS = 'web';
    installWebAlert();
    Alert.alert('Opgeslagen');
    expect(Array.from(document.querySelectorAll('button')).map((b) => b.textContent)).toEqual(['OK']);
  });

  it('does not stack scrims when a second alert fires over an open one', () => {
    (Platform as any).OS = 'web';
    installWebAlert();
    Alert.alert('First');
    Alert.alert('Second');
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(document.body.textContent).toContain('Second');
  });
});
