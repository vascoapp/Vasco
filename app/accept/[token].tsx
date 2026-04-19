import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { processAcceptance } from '../../src/services/customerQuoteAcceptanceService';
import { useAppState } from '../../src/state/AppState';
import { logWarn } from '../../src/utils/errorHandler';
import { Palette } from '../../src/theme/colors';

// ---------------------------------------------------------------------------
// Token validation + rate limiting
// ---------------------------------------------------------------------------
const TOKEN_REGEX = /^[a-zA-Z0-9_-]{8,128}$/;
const RATE_LIMIT_KEY = '@vasco_accept_rate';
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

function isValidTokenFormat(token: string): boolean {
  return TOKEN_REGEX.test(token);
}

async function isRateLimited(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(RATE_LIMIT_KEY);
    const timestamps: number[] = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    const recent = timestamps.filter((t) => t > now - RATE_LIMIT_WINDOW_MS);
    if (recent.length >= RATE_LIMIT_MAX) {
      return true;
    }
    recent.push(now);
    await AsyncStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(recent));
    return false;
  } catch {
    return false;
  }
}

export default function AcceptQuoteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { updateQuote } = useAppState();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing your approval...');

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('Invalid link'); return; }

    // Validate token format
    if (!isValidTokenFormat(token)) {
      logWarn('AcceptQuote', `Invalid token format: ${token.slice(0, 10)}...`);
      setStatus('error');
      setMessage('Invalid approval link.');
      return;
    }

    // Check rate limiting
    isRateLimited().then((limited) => {
      if (limited) {
        logWarn('AcceptQuote', 'Rate limit exceeded for token validation');
        setStatus('error');
        setMessage('Too many attempts. Please try again in a minute.');
        return;
      }

      processAcceptanceFlow();
    });

    function processAcceptanceFlow() {
    processAcceptance(token!).then(async (result) => {
      if (result.success && result.link) {
        try {
          updateQuote(result.link.quoteId, { status: 'accepted' });
          setStatus('success');
          setMessage('Quote accepted! Your contractor will start scheduling the work.');
          // Navigate to home after delay
          setTimeout(() => router.replace('/'), 3000);
        } catch {
          setStatus('error');
          setMessage('Quote accepted but job creation failed. Your contractor has been notified.');
        }
      } else {
        setStatus('error');
        setMessage(result.error || 'Could not process approval');
      }
    }).catch(() => {
      setStatus('error');
      setMessage('Something went wrong. Please try again.');
    });
    } // end processAcceptanceFlow
  }, [token]);

  return (
    <View style={styles.container}>
      {status === 'processing' && <ActivityIndicator size="large" color={Palette.hermesOrange} />}
      <Text style={styles.title}>
        {status === 'success' ? 'Accepted' : status === 'error' ? 'Error' : 'Processing...'}
      </Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, backgroundColor: "#14181F" },
  title: { fontSize: 24, fontWeight: '700', marginTop: 20, color: "#FFFFFF" },
  message: { fontSize: 16, color: '#666', marginTop: 12, textAlign: 'center', lineHeight: 24 },
});
