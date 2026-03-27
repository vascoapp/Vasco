// =============================================================================
// ERROR BOUNDARY - Catches React render errors
// =============================================================================

import React from 'react';
import { View, Text, Pressable, StyleSheet, Share, Platform } from 'react-native';
import { SemanticColors, Palette } from '../../theme/colors';
import { logWarn } from '../../utils/errorHandler';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    logWarn('ErrorBoundary', `Caught an error: ${error.message}`);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorDetails = this.state.error?.message || 'Unknown error';
      const handleCopyError = async () => {
        const details = `Error: ${errorDetails}\n\nStack: ${this.state.error?.stack || 'N/A'}`;
        try {
          if (Platform.OS === 'web') {
            await navigator.clipboard.writeText(details);
          } else {
            await Share.share({ message: details, title: 'Error details' });
          }
        } catch {}
      };

      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {errorDetails}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.copyButton, pressed && { opacity: 0.8 }]}
            onPress={handleCopyError}
          >
            <Text style={styles.copyButtonText}>Copy error details</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter_500Medium',
    color: SemanticColors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: SemanticColors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: SemanticColors.actionPrimary,
  },
  buttonText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: Palette.white,
  },
  copyButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: SemanticColors.surfaceSecondary,
    marginTop: 12,
  },
  copyButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: SemanticColors.textSecondary,
  },
});
