/**
 * The first child of every full-screen (`presentationStyle="pageSheet"`) Modal.
 *
 * `pageSheet` is iOS-only: Android ignores it and draws the modal over the
 * whole window, and with edge-to-edge forced (targetSdk 35, app.json
 * `edgeToEdgeEnabled`) the header row — Cancel / title / Save — landed under
 * the status bar clock (aannemer walk, 2026-09-29: "Mijlpaal toevoegen").
 * The NATIVE SafeAreaView measures the real overlap: the status bar on
 * Android, ~0 on an iOS sheet, so iOS is unchanged.
 *
 * Pass the content's own background so the padded strip matches it.
 * Guard: src/__tests__/pageSheetModalsClearTheStatusBar.test.ts.
 */
import type { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

export function ModalSafeArea({ children, backgroundColor }: { children: ReactNode; backgroundColor: string }) {
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor }}>
      {children}
    </SafeAreaView>
  );
}
