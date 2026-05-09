// =============================================================================
// CUSTOMER PORTAL ROUTE
// =============================================================================
// Customer-facing decision portal accessible via access code
// URL: /customer/[code] or /customer/access
// Every decision feeds into the Vasco intelligence moat
// =============================================================================

import { useState, useEffect, useRef } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { SemanticColors } from '../../src/theme/colors';
import {
  CustomerDecisionPortal,
  AccessCodeEntry,
} from '../../src/components/customer/CustomerDecisionPortal';
import {
  getPortalByAccessCode as getMockPortalByAccessCode,
  validateAccessCode as validateMockAccessCode,
} from '../../src/data/mockCustomerPortal';
import { fetchPortalByAccessCode } from '../../src/services/decisionTrackerService';
import { DEMO_MODE } from '../../src/config/demo';
import { decisionIntelligence } from '../../src/intelligence/decisionIntelligence';
import {
  submitDecision as syncSubmitDecision,
  logActivity as syncLogActivity,
} from '../../src/services/decisionSyncService';
import { logWarn } from '../../src/utils/errorHandler';
import { hapticSuccess } from '../../src/utils/haptics';
import type {
  CustomerPortalData,
  CustomerDecisionSubmission,
  CustomerPortalActivity,
} from '../../src/types/customerPortal';
import type { CustomerDecisionItem } from '../../src/types/decisions';

// ---------------------------------------------------------------------------
// Access code validation + rate limiting
// ---------------------------------------------------------------------------
const ACCESS_CODE_REGEX = /^[a-zA-Z0-9_-]{4,64}$/;
const ACCESS_RATE_LIMIT_KEY = '@vasco_customer_access_rate';
const ACCESS_RATE_LIMIT_MAX = 5;
const ACCESS_RATE_LIMIT_WINDOW_MS = 60_000;

function isValidAccessCodeFormat(code: string): boolean {
  return ACCESS_CODE_REGEX.test(code);
}

async function isAccessRateLimited(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(ACCESS_RATE_LIMIT_KEY);
    const timestamps: number[] = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    const recent = timestamps.filter((t) => t > now - ACCESS_RATE_LIMIT_WINDOW_MS);
    if (recent.length >= ACCESS_RATE_LIMIT_MAX) {
      return true;
    }
    recent.push(now);
    await AsyncStorage.setItem(ACCESS_RATE_LIMIT_KEY, JSON.stringify(recent));
    return false;
  } catch {
    return false;
  }
}

export default function CustomerPortalScreen() {
  const { t } = useTranslation();
  const { code } = useLocalSearchParams<{ code: string }>();

  const [portalData, setPortalData] = useState<CustomerPortalData | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  // Track session start time for timing analytics
  const sessionStartRef = useRef<number>(Date.now());
  const itemViewTimesRef = useRef<Map<string, number>>(new Map());

  // Start intelligence service on mount
  useEffect(() => {
    decisionIntelligence.start();
    return () => decisionIntelligence.stop();
  }, []);

  // If code is provided in URL, try to load portal
  useEffect(() => {
    if (code && code !== 'access') {
      handleAccessCode(code);
    }
  }, [code]);

  const handleAccessCode = async (accessCode: string) => {
    setIsLoading(true);
    setError(undefined);

    // Validate format
    if (!isValidAccessCodeFormat(accessCode)) {
      logWarn('CustomerPortal', `Invalid access code format: ${accessCode.slice(0, 5)}...`);
      setError(t('customerPortal.codeInvalidOrExpired', 'Code is invalid or expired. Ask your contractor for a new one.'));
      setIsLoading(false);
      return;
    }

    // Rate limiting
    const limited = await isAccessRateLimited();
    if (limited) {
      logWarn('CustomerPortal', 'Rate limit exceeded for access code validation');
      setError(t('customerPortal.rateLimited', 'Too many attempts. Try again in a minute.'));
      setIsLoading(false);
      return;
    }

    // R66 round 32: BE-primary lookup via SECURITY DEFINER RPC
    // (`get_portal_by_access_code`, migration 20260507000009). Pre-R32
    // this hit `validateMockAccessCode` which always returned false in
    // non-DEMO mode — the entire customer portal flow was dead in prod.
    // Mock now serves only the DEMO_MODE 'VDB24A' fallback.
    let data = await fetchPortalByAccessCode(accessCode);
    if (!data && DEMO_MODE && validateMockAccessCode(accessCode)) {
      data = getMockPortalByAccessCode(accessCode);
    }
    if (data) {
      setPortalData(data);
      hapticSuccess();
      sessionStartRef.current = Date.now();

      // Track portal access for intelligence
      logActivity('portal_accessed', {
        accessCode,
        totalDecisions: data.totalDecisions,
        completedDecisions: data.completedDecisions,
        overdueDecisions: data.overdueDecisions,
      });

      // Persist portal access via sync service
      syncLogActivity(data.accessToken, 'portal_accessed', undefined, {
        accessCode,
        totalDecisions: data.totalDecisions,
        completedDecisions: data.completedDecisions,
        overdueDecisions: data.overdueDecisions,
      }).catch((err) => { if (__DEV__) console.error('Failed to sync portal access:', err); });

      // R239: write to customer_portal_events for the moat learning pipeline.
      // Anon insert — no contractor_user_id when we don't have it yet.
      import('../../src/services/intelligenceCaptureService').then((m) =>
        m.recordPortalEvent({
          portalToken: data.accessToken,
          eventType: 'portal_opened',
          metadata: {
            totalDecisions: data.totalDecisions,
            completedDecisions: data.completedDecisions,
          },
        }),
      ).catch(() => {});
    } else {
      setError(t('customerPortal.projectNotFound', 'Project not found. Check the code and try again.'));
    }

    setIsLoading(false);
  };

  const handleSubmitDecision = async (submission: CustomerDecisionSubmission) => {
    if (!portalData) return;

    // Find the item that was decided
    let decidedItem: CustomerDecisionItem | undefined;
    let categoryPhase = 'unknown';

    for (const category of portalData.categories) {
      const item = category.items.find((i) => i.id === submission.itemId);
      if (item) {
        decidedItem = item as unknown as CustomerDecisionItem;
        categoryPhase = category.phase;
        break;
      }
    }

    if (!decidedItem) {
      if (__DEV__) console.error('Could not find item for submission:', submission.itemId);
      return;
    }

    // Calculate time to decide (from when they first viewed the item)
    const viewStartTime = itemViewTimesRef.current.get(submission.itemId);
    const timeToDecide = viewStartTime
      ? Math.floor((Date.now() - viewStartTime) / 1000)
      : undefined;

    // Enrich submission with timing data
    const enrichedSubmission: CustomerDecisionSubmission = {
      ...submission,
      timeToDecide,
    };

    // Process through intelligence moat
    try {
      await decisionIntelligence.processDecisionSubmission(
        enrichedSubmission,
        decidedItem,
        {
          trade: inferTradeFromTemplate(portalData.projectName),
          projectType: inferProjectType(portalData.projectName),
          // R41: was hardcoded `'noord-holland' / 'mid-range' / 'house'` for
          // every decision regardless of the actual quote/contractor. Real
          // values flow via portalData.metadata when the BE ships them.
          // Empty string when not yet available so the cohort aggregator
          // doesn't double-count fake "noord-holland" data points.
          region: (portalData as any).metadata?.region ?? '',
          projectBudget: (portalData as any).metadata?.projectBudget ?? '',
          propertyType: (portalData as any).metadata?.propertyType ?? '',
        }
      );
    } catch (err) {
      if (__DEV__) console.error('Failed to process decision intelligence:', err);
    }

    // Persist decision via sync service (local + Supabase when configured)
    try {
      await syncSubmitDecision({
        trackerId: portalData.accessToken,
        itemId: submission.itemId,
        submittedBy: 'customer',
        value: String(submission.value),
        notes: submission.notes,
        photos: submission.photoUrls,
        linkedProductUrl: submission.linkedProduct?.url,
        timeToDecideSeconds: timeToDecide,
        submittedAt: submission.submittedAt,
      });
    } catch (err) {
      if (__DEV__) console.error('Failed to sync decision:', err);
    }

    // R239: portal-event telemetry for the moat
    const valueStr = String(submission.value).toLowerCase();
    const eventType = valueStr.includes('approve') || valueStr.includes('accept') || valueStr === 'yes' || valueStr === 'true'
      ? 'accepted'
      : (valueStr.includes('decline') || valueStr.includes('reject') || valueStr === 'no' || valueStr === 'false')
        ? 'declined'
        : 'session_ended';
    import('../../src/services/intelligenceCaptureService').then((m) =>
      m.recordPortalEvent({
        portalToken: portalData.accessToken,
        decisionId: submission.itemId,
        eventType,
        durationMs: timeToDecide ? timeToDecide * 1000 : undefined,
      }),
    ).catch(() => {});

    // Update local state to reflect the decision
    const updatedCategories = portalData.categories.map((category) => ({
      ...category,
      items: category.items.map((item) => {
        if (item.id === submission.itemId) {
          return {
            ...item,
            status: 'decided' as const,
            value: submission.value,
            notes: submission.notes,
            decidedAt: submission.submittedAt,
          };
        }
        return item;
      }),
      completedCount: category.items.filter(
        (i) => i.id === submission.itemId || i.status === 'decided'
      ).length,
    }));

    const newCompleted = updatedCategories.reduce((sum, c) => sum + c.completedCount, 0);

    setPortalData({
      ...portalData,
      categories: updatedCategories,
      completedDecisions: newCompleted,
      overdueDecisions: updatedCategories.reduce(
        (sum, c) => sum + c.items.filter((i) => i.isOverdue && i.status === 'pending').length,
        0
      ),
    });
  };

  const logActivity = (action: string, metadata?: Record<string, unknown>) => {
    if (!portalData) return;

    // Track item view times for timing analytics
    if (action === 'item_viewed' && metadata?.itemId) {
      itemViewTimesRef.current.set(String(metadata.itemId), Date.now());
    }

    // Create activity record
    const activity: CustomerPortalActivity = {
      id: `activity_${Date.now()}`,
      trackerId: portalData.accessToken,
      // R41: was hardcoded 'customer' string for every event regardless of
      // who actually opened the portal. portalData.customerId comes from
      // the access-code lookup; falls through to '' (anonymous) when the
      // BE token doesn't carry a customer id (e.g. shared-link visits).
      customerId: (portalData as any).customerId ?? '',
      action: action as CustomerPortalActivity['action'],
      itemId: metadata?.itemId as string | undefined,
      categoryId: metadata?.categoryId as string | undefined,
      metadata,
      // R41: was hardcoded 'mobile' for every event including web tablet/
      // desktop visits. Real Platform.OS reading via expo-router runs on
      // device so iOS/Android distinction lands; web uses 'web' branch
      // since react-native-web reports 'web' from Platform.OS.
      deviceType: Platform.OS === 'web' ? 'desktop' : 'mobile',
      timestamp: new Date().toISOString(),
    };

    // Buffer for batch processing
    decisionIntelligence.trackActivity(activity);

    // R239+: route to customer_portal_events for the moat learning pipeline.
    // Map portal action names to portal_event_type enum values.
    const map: Record<string, string> = {
      item_viewed: 'quote_viewed',
      item_expanded: 'price_expanded',
      line_clicked: 'line_clicked',
      photo_viewed: 'photo_viewed',
      accept_hovered: 'accept_hovered',
      decline_hovered: 'decline_hovered',
      question_started: 'question_started',
      question_sent: 'question_sent',
    };
    const eventType = map[action];
    if (eventType) {
      import('../../src/services/intelligenceCaptureService').then((m) =>
        m.recordPortalEvent({
          portalToken: portalData.accessToken,
          decisionId: metadata?.itemId as string | undefined,
          eventType: eventType as any,
          metadata,
        }),
      ).catch(() => {});
    }
  };

  // Show access code entry if no portal data
  if (!portalData) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <AccessCodeEntry
          onSubmit={handleAccessCode}
          error={error}
          isLoading={isLoading}
        />
      </SafeAreaView>
    );
  }

  // Show portal
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <CustomerDecisionPortal
        portalData={portalData}
        onSubmitDecision={handleSubmitDecision}
        onActivityLog={logActivity}
        // R303: thread the same trade + region values used for
        // processDecisionSubmission's intelligence context. The portal
        // panel uses these to fetch getRegionalPreferences and surface
        // "67% of customers chose X" hints when k-anonymity ≥20.
        // R66 round 32: was hardcoding 'noord-holland' for every NL
        // contractor regardless of actual province — collapsed all NL
        // contractors into a single bogus regional bucket and polluted
        // the cohort signal. Now passes the country code as the region
        // until the BE row carries a real province field; matches the
        // empty-string fallback at line 207 (R41) for the same reason.
        trade={inferTradeFromTemplate(portalData.projectName)}
        region={portalData.contractorCountry ?? ''}
      />
    </SafeAreaView>
  );
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function inferTradeFromTemplate(projectName: string): string {
  const nameLower = projectName.toLowerCase();

  if (nameLower.includes('badkamer') || nameLower.includes('bathroom')) return 'bathroom_fitter';
  if (nameLower.includes('keuken') || nameLower.includes('kitchen')) return 'kitchen_fitter';
  if (nameLower.includes('schilder') || nameLower.includes('verf') || nameLower.includes('paint')) return 'painter';
  if (nameLower.includes('elektr')) return 'electrician';
  if (nameLower.includes('loodgieter') || nameLower.includes('plumb')) return 'plumber';
  if (nameLower.includes('tegel') || nameLower.includes('tile')) return 'tiler';
  if (nameLower.includes('vloer') || nameLower.includes('floor')) return 'flooring';

  return 'general_contractor';
}

function inferProjectType(projectName: string): string {
  const nameLower = projectName.toLowerCase();

  if (nameLower.includes('badkamer') || nameLower.includes('bathroom')) return 'bathroom';
  if (nameLower.includes('keuken') || nameLower.includes('kitchen')) return 'kitchen';
  if (nameLower.includes('schilder') || nameLower.includes('verf') || nameLower.includes('paint')) return 'painting';
  if (nameLower.includes('elektr')) return 'electrical';
  if (nameLower.includes('renovatie') || nameLower.includes('renovation')) return 'renovation';
  if (nameLower.includes('verbouwing') || nameLower.includes('remodel')) return 'remodel';

  return 'other';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
});
