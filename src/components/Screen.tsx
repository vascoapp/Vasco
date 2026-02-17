import { PropsWithChildren } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { SemanticColors } from '../theme/colors';

type ScreenProps = PropsWithChildren<{ backgroundColor?: string }>;

export function Screen({ children, backgroundColor }: ScreenProps) {
  return (
    <SafeAreaView
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
