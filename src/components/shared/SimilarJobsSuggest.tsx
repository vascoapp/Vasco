// =============================================================================
// SIMILAR JOBS SUGGEST — reveals semanticSearch results in the quote builder
// =============================================================================
// Contractor types a job description → pgvector returns similar past jobs
// with their line items. One-tap "Use this" prefills the quote.
// =============================================================================

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import { TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { searchSimilarJobs, type SearchResult } from '../../intelligence/semanticSearch';

interface Props {
  query: string;
  onPickJob?: (jobId: string) => void;
}

export function SimilarJobsSuggest({ query, onPickJob }: Props) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 4) { setResults([]); return; }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const r = await searchSimilarJobs(q, 3);
        if (!cancelled) setResults(r);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  if (!loading && results.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={14} color={Palette.hermesOrange} />
        <Text style={styles.title}>Similar past jobs</Text>
        {loading && <ActivityIndicator size="small" color={Palette.hermesOrange} />}
      </View>
      {results.map((r) => (
        <Pressable
          key={r.id}
          onPress={() => onPickJob?.(r.id)}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel={`Reuse past job ${r.title}`}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle} numberOfLines={1}>{r.title}</Text>
            {r.description ? <Text style={styles.rowDesc} numberOfLines={2}>{r.description}</Text> : null}
          </View>
          <Text style={styles.score}>{Math.round((r.score ?? 0) * 100)}%</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: GRID.sm,
    padding: GRID.sm,
    backgroundColor: Palette.hermesOrange + '08',
    borderRadius: RADIUS.md,
    gap: GRID.xs,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: GRID.xs },
  title: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textSecondary, flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    padding: GRID.sm,
    backgroundColor: Palette.white,
    borderRadius: RADIUS.sm,
  },
  rowTitle: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  rowDesc: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, marginTop: 2 },
  score: { fontSize: TYPE.captionSize, fontFamily: TYPE.sectionFamily, color: Palette.hermesOrange },
});
