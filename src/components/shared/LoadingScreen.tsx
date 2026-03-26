// =============================================================================
// LOADING SCREEN — Full-screen centered loading indicator
// =============================================================================
// ActivityIndicator with Palette.hermesOrange + optional message text.
// Used for initial data loading or route transitions.
// =============================================================================

import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Palette, SemanticColors } from '../../theme/colors';
import { PAGE_BG, TYPE, GRID } from '../../theme/tabStyles';

interface LoadingScreenProps {
  /** Optional message shown below the spinner */
  message?: string;
}

export function LoadingScreen({ message }: LoadingScreenProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Palette.hermesOrange} />
      {message ? (
        <Text style={styles.message}>{message}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.md,
  },
  message: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: GRID.xl,
  },
});
