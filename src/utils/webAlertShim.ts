/**
 * react-native-web ships `Alert` as `class Alert { static alert() {} }` — a
 * literal no-op. Every one of the app's 361 Alert.alert call sites therefore
 * does NOTHING in a browser: confirmations never appear, and the button whose
 * onPress carries the actual work (complete the job, send the on-my-way
 * message, delete the customer) is never reachable. The screen looks alive and
 * the taps land, so it reads as "the button is broken" rather than "the dialog
 * is missing".
 *
 * This installs a DOM implementation over that no-op. It is a browser-only
 * concern: on iOS/Android `Alert` is the real native module and this file
 * returns immediately, so nothing about the shipping app changes.
 *
 * Deliberately NOT window.alert/confirm — those cap out at two buttons, block
 * the JS thread, and cannot render the 4-option ETA picker or the 4-option
 * job-completion dialog.
 */
import { Alert, Platform } from 'react-native';

type AlertButton = {
  text?: string;
  onPress?: (value?: string) => void;
  style?: 'default' | 'cancel' | 'destructive';
};

// DK Sunset Slate tokens, inlined: this renders outside React, so it cannot
// import the theme's StyleSheet objects.
const C = {
  scrim: 'rgba(0,0,0,0.6)',
  panel: '#1C2128',
  border: '#2A3038',
  text: '#FFFFFF',
  muted: '#9CA3AF',
  accent: '#F97316',
  danger: '#EF4444',
};

let openDialog: (() => void) | null = null;

function webAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (typeof document === 'undefined') return;

  // A second alert fired while one is open (a catch handler racing a success
  // path) would otherwise stack scrims and trap the pointer.
  openDialog?.();

  const scrim = document.createElement('div');
  scrim.setAttribute('role', 'dialog');
  scrim.setAttribute('aria-modal', 'true');
  scrim.style.cssText = [
    'position:fixed', 'inset:0', `background:${C.scrim}`, 'z-index:99999',
    'display:flex', 'align-items:center', 'justify-content:center', 'padding:24px',
    'font-family:Inter,system-ui,sans-serif',
  ].join(';');

  const card = document.createElement('div');
  card.style.cssText = [
    `background:${C.panel}`, `border:1px solid ${C.border}`, 'border-radius:14px',
    'max-width:340px', 'width:100%', 'padding:20px', 'box-shadow:0 12px 40px rgba(0,0,0,0.5)',
  ].join(';');

  const h = document.createElement('div');
  h.textContent = title ?? '';
  h.style.cssText = `color:${C.text};font-size:16px;font-weight:700;margin-bottom:${message ? '8px' : '16px'}`;
  card.appendChild(h);

  if (message) {
    const p = document.createElement('div');
    p.textContent = message;
    // Alert messages are newline-joined lists (missing checklist items,
    // completion warnings); collapsing them to one line loses the structure.
    p.style.cssText = `color:${C.muted};font-size:14px;line-height:1.45;margin-bottom:16px;white-space:pre-wrap`;
    card.appendChild(p);
  }

  const close = () => {
    if (scrim.parentNode) scrim.parentNode.removeChild(scrim);
    document.removeEventListener('keydown', onKey);
    if (openDialog === close) openDialog = null;
  };

  const list = (buttons && buttons.length > 0)
    ? buttons
    : [{ text: 'OK' } as AlertButton];

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;flex-direction:column;gap:8px';
  list.forEach((b) => {
    const el = document.createElement('button');
    el.textContent = b.text ?? 'OK';
    const isCancel = b.style === 'cancel';
    const isDanger = b.style === 'destructive';
    el.style.cssText = [
      'padding:12px', 'border-radius:10px', 'font-size:15px', 'font-weight:600',
      'cursor:pointer', 'width:100%', 'text-align:center',
      isCancel ? `background:transparent;border:1px solid ${C.border};color:${C.muted}`
        : isDanger ? `background:${C.danger};border:none;color:#fff`
        : `background:${C.accent};border:none;color:#fff`,
    ].join(';');
    el.onclick = () => {
      close();
      // Close first: an onPress that opens the next Alert (the ETA picker
      // chain) must not be dismissed by its own parent's teardown.
      try { b.onPress?.(); } catch { /* matches native: a throwing handler does not break the dialog */ }
    };
    row.appendChild(el);
  });
  card.appendChild(row);

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    const cancel = list.find((b) => b.style === 'cancel');
    close();
    try { cancel?.onPress?.(); } catch { /* ignore */ }
  };
  document.addEventListener('keydown', onKey);
  scrim.onclick = (e) => { if (e.target === scrim) onKey({ key: 'Escape' } as KeyboardEvent); };

  scrim.appendChild(card);
  document.body.appendChild(scrim);
  openDialog = close;
}

export function installWebAlert(): void {
  if (Platform.OS !== 'web') return;
  (Alert as any).alert = webAlert;
}
