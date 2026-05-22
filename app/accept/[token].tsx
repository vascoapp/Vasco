import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { processAcceptance } from '../../src/services/customerQuoteAcceptanceService';
import { useAppState } from '../../src/state/AppState';
import { logWarn } from '../../src/utils/errorHandler';
import { DK } from '../../src/theme/draftkings';
import { DKLabel } from '../../src/components/shared/DKLabel';

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
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { updateQuote, convertQuoteToJob } = useAppState();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState(t('accept.processing', 'Processing your approval...'));

  useEffect(() => {
    // R14.3: was 6 hardcoded English error/success messages mid-flow
    // ("Invalid link", "Quote accepted! …", etc) on a customer-facing screen
    // that already used t() for titles. Customer in DE/FR/ES/IT got English
    // mid-flow. Migrated to accept.* keys.
    if (!token) { setStatus('error'); setMessage(t('accept.invalidLink', 'Invalid link')); return; }

    // Validate token format
    if (!isValidTokenFormat(token)) {
      logWarn('AcceptQuote', `Invalid token format: ${token.slice(0, 10)}...`);
      setStatus('error');
      setMessage(t('accept.invalidApprovalLink', 'Invalid approval link.'));
      return;
    }

    // Check rate limiting
    isRateLimited().then((limited) => {
      if (limited) {
        logWarn('AcceptQuote', 'Rate limit exceeded for token validation');
        setStatus('error');
        setMessage(t('accept.rateLimited', 'Too many attempts. Please try again in a minute.'));
        return;
      }

      processAcceptanceFlow();
    });

    function processAcceptanceFlow() {
    processAcceptance(token!).then(async (result) => {
      if (result.success && result.link) {
        try {
          // R56: was just `updateQuote(..., { status: 'accepted' })` — the
          // quote turned green but no job was ever created. The success
          // message ("Your contractor will start scheduling the work") and
          // the explicit error string `acceptedButFailed` ("Quote accepted
          // but job creation failed") show the original intent was to
          // auto-create the job on customer acceptance via the link.
          // convertQuoteToJob fires the full R52/R55 housekeeping path
          // (markStepComplete, ontology, semanticIndex, calendar, emit).
          await convertQuoteToJob(result.link.quoteId);
          setStatus('success');
          setMessage(t('accept.quoteAccepted', 'Quote accepted! Your contractor will start scheduling the work.'));
          // Navigate to home after delay
          setTimeout(() => router.replace('/'), 3000);
        } catch {
          // Fall back to status-only update so the contractor at least sees
          // the quote as accepted, even if the auto-job-creation failed
          // (e.g. quote not in local AppState because customer device
          // hadn't synced — accept-token is a customer-side surface).
          try { updateQuote(result.link.quoteId, { status: 'accepted' }); } catch {}
          setStatus('error');
          setMessage(t('accept.acceptedButFailed', 'Quote accepted but job creation failed. Your contractor has been notified.'));
        }
      } else {
        setStatus('error');
        setMessage(result.error || t('accept.couldNotProcess', 'Could not process approval'));
      }
    }).catch(() => {
      setStatus('error');
      setMessage(t('accept.somethingWentWrong', 'Something went wrong. Please try again.'));
    });
    } // end processAcceptanceFlow
  }, [token]);

  const iconName = status === 'success' ? 'checkmark-circle' : status === 'error' ? 'alert-circle' : 'sync';
  const iconColor = status === 'success' ? DK.colors.success : status === 'error' ? DK.colors.danger : DK.colors.accent;
  const title = status === 'success'
    ? t('accept.successTitle', 'Accepted')
    : status === 'error'
    ? t('accept.errorTitle', 'Error')
    : t('accept.processingTitle', 'Processing...');

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        {status === 'processing' ? (
          <ActivityIndicator size="large" color={DK.colors.accent} />
        ) : (
          <LinearGradient
            colors={status === 'success'
              ? [DK.colors.success + 'AA', DK.colors.success]
              : [DK.colors.danger + 'AA', DK.colors.danger]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconCircle}
          >
            <Ionicons name={iconName} size={40} color="#FFFFFF" />
          </LinearGradient>
        )}
      </View>
      <DKLabel style={styles.title}>{title}</DKLabel>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: DK.colors.bg,
    gap: 16,
  },
  iconWrap: {
    shadowColor: DK.colors.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 22,
    elevation: 10,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Archivo_900Black',
    fontSize: 24,
    color: DK.colors.text,
    letterSpacing: -0.4,
    marginTop: 8,
  },
  message: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: DK.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
});
