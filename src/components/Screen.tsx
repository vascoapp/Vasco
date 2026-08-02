import { PropsWithChildren } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
// react-native's own SafeAreaView is iOS-only — on Android it renders a plain
// View, so with edgeToEdgeEnabled=true every screen below drew under the status
// bar. safe-area-context is the cross-platform one (and is what the other 46
// screens already use). edges=['top'] only: these screens sit inside a Tabs
// layout that applies its own bottom inset, so claiming 'bottom' here would
// double-pad above the tab bar.
import { SafeAreaView } from 'react-native-safe-area-context';
import { SemanticColors } from '../theme/colors';

type ScreenProps = PropsWithChildren<{ backgroundColor?: string }>;

export function Screen({ children, backgroundColor }: ScreenProps) {
  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.container, { backgroundColor: backgroundColor ?? SemanticColors.surfaceBackground }]}
    >
      <StatusBar barStyle="light-content" />
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
