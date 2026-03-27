// =============================================================================
// GLOBAL SEARCH — Search across jobs, quotes, invoices, customers
// =============================================================================

import { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { SafeArea } from '../../src/theme/spacing';
import { useAppState } from '../../src/state/AppState';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { trackEvent } from '../../src/services/eventTrackingService';

type IconName = keyof typeof Ionicons.glyphMap;
type ResultType = 'job' | 'quote' | 'invoice' | 'customer';

interface SearchResult {
  id: string;
  type: ResultType;
  title: string;
  subtitle: string;
  icon: IconName;
  color: string;
  route: string;
}

const TYPE_CONFIG: Record<ResultType, { icon: IconName; color: string; labelKey: string }> = {
  job: { icon: 'hammer', color: Palette.hermesOrange, labelKey: 'search.job' },
  quote: { icon: 'document-text', color: Palette.hermesOrange, labelKey: 'search.quote' },
  invoice: { icon: 'receipt', color: SemanticColors.feedbackSuccess, labelKey: 'search.invoice' },
  customer: { icon: 'person', color: Palette.hermesOrange, labelKey: 'search.customer' },
};

export default function SearchScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { jobs, quotes, invoices, customers } = useAppState();
  const [query, setQuery] = useState('');

  const results = useMemo((): SearchResult[] => {
    const q = query.toLowerCase().trim();
    if (q.length < 2) return [];

    const r: SearchResult[] = [];

    // Search jobs
    for (const job of jobs) {
      if (job.title?.toLowerCase().includes(q) || job.description?.toLowerCase().includes(q)) {
        r.push({
          id: job.id,
          type: 'job',
          title: job.title,
          subtitle: `${job.status} · ${job.trade ?? ''}`,
          icon: 'hammer',
          color: Palette.hermesOrange,
          route: `/contractor/job/${job.id}`,
        });
      }
    }

    // Search quotes
    for (const quote of quotes) {
      const amt = `€${(quote.amount ?? 0).toLocaleString(undefined)}`;
      if (quote.id?.toLowerCase().includes(q) || quote.customer?.toLowerCase().includes(q) || quote.job?.toLowerCase().includes(q)) {
        r.push({
          id: quote.id,
          type: 'quote',
          title: `${quote.id} — ${quote.job || t('search.quote')}`,
          subtitle: `${quote.status} · ${amt}`,
          icon: 'document-text',
          color: Palette.hermesOrange,
          route: `/quotes/${quote.id}`,
        });
      }
    }

    // Search invoices
    for (const inv of invoices) {
      const invAny = inv as any;
      const amt = `€${(invAny.amount ?? invAny.total ?? 0).toLocaleString(undefined)}`;
      if (invAny.id?.toLowerCase().includes(q) || invAny.customer?.toLowerCase().includes(q)) {
        r.push({
          id: invAny.id,
          type: 'invoice',
          title: `${invAny.id}`,
          subtitle: `${invAny.status} · ${amt}`,
          icon: 'receipt',
          color: SemanticColors.feedbackSuccess,
          route: `/invoices/${invAny.id}`,
        });
      }
    }

    // Search customers
    for (const cust of customers) {
      if (cust.name?.toLowerCase().includes(q) || cust.email?.toLowerCase().includes(q) || cust.phone?.includes(q)) {
        r.push({
          id: cust.id,
          type: 'customer',
          title: cust.name,
          subtitle: [cust.email, cust.phone].filter(Boolean).join(' · '),
          icon: 'person',
          color: Palette.hermesOrange,
          route: `/contractor/customer-crm`,
        });
      }
    }

    return r.slice(0, 20);
  }, [query, jobs, quotes, invoices, customers]);

  // Track search events (debounced — fires 500ms after user stops typing)
  const trackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (query.trim().length >= 2) {
      if (trackTimerRef.current) clearTimeout(trackTimerRef.current);
      trackTimerRef.current = setTimeout(() => {
        trackEvent('search_performed', { query: 'has_query', resultCount: results.length });
      }, 500);
    }
    return () => { if (trackTimerRef.current) clearTimeout(trackTimerRef.current); };
  }, [query, results.length]);

  const grouped = useMemo(() => {
    const groups: Record<ResultType, SearchResult[]> = { job: [], quote: [], invoice: [], customer: [] };
    for (const r of results) groups[r.type].push(r);
    return groups;
  }, [results]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={SemanticColors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('common.search', 'Zoeken...')}
            placeholderTextColor={SemanticColors.textTertiary}
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={SemanticColors.textTertiary} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {query.length < 2 ? (
          <View style={styles.hint}>
            <Ionicons name="search-outline" size={40} color={SemanticColors.textTertiary} />
            <Text style={styles.hintText}>{t('search.placeholder')}</Text>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.hint}>
            <Ionicons name="alert-circle-outline" size={40} color={SemanticColors.textTertiary} />
            <Text style={styles.hintText}>{t('search.noResultsFor', { query })}</Text>
          </View>
        ) : (
          (['job', 'quote', 'invoice', 'customer'] as ResultType[]).map(type => {
            const items = grouped[type];
            if (items.length === 0) return null;
            const cfg = TYPE_CONFIG[type];
            return (
              <FadeIn key={type} delay={0}>
                <Text style={styles.groupTitle}>{t(cfg.labelKey)} ({items.length})</Text>
                {items.map(item => (
                  <Pressable
                    key={item.id}
                    style={({ pressed }) => [styles.resultCard, pressed && { opacity: 0.85 }]}
                    onPress={() => router.push(item.route as any)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.type}: ${item.title}, ${item.subtitle}`}
                  >
                    <View style={[styles.resultIcon, { backgroundColor: item.color + '15' }]}>
                      <Ionicons name={item.icon} size={16} color={item.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.resultSub} numberOfLines={1}>{item.subtitle}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
                  </Pressable>
                ))}
              </FadeIn>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: SafeArea.top, paddingHorizontal: SafeArea.side, paddingBottom: 12 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textPrimary, padding: 0 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SafeArea.side, gap: GRID.sm },
  hint: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  hintText: { fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textTertiary, textAlign: 'center' },
  groupTitle: { fontSize: TYPE.labelSize, fontFamily: TYPE.labelFamily, color: SemanticColors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: GRID.md },
  resultCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: 12 },
  resultIcon: { width: 36, height: 36, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  resultSub: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, marginTop: 1 },
});
