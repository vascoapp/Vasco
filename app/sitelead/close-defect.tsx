import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../../src/theme/spacing';

type Severity = 'alle' | 'hoog' | 'middel' | 'laag';

interface Defect {
  id: string;
  title: string;
  location: string;
  severity: 'hoog' | 'middel' | 'laag';
  trade: string;
  date: string;
  desc: string;
}

const MOCK_DEFECTS: Defect[] = [
  {
    id: 'd1',
    title: 'Lekkage CV-leiding',
    location: 'Blok B - Verdieping 1',
    severity: 'hoog',
    trade: 'Loodgieter',
    date: '05-02-2026',
    desc: 'Lekkage bij koppeling CV-leiding badkamer',
  },
  {
    id: 'd2',
    title: 'Scheuren in stucwerk',
    location: 'Blok A - Begane grond',
    severity: 'middel',
    trade: 'Stukadoor',
    date: '04-02-2026',
    desc: 'Haarscheuren in nieuw stucwerk hal',
  },
  {
    id: 'd3',
    title: 'Stopcontact los',
    location: 'Blok C - Verdieping 3',
    severity: 'laag',
    trade: 'Elektricien',
    date: '03-02-2026',
    desc: 'Stopcontact bij bureau zit los in muur',
  },
  {
    id: 'd4',
    title: 'Kozijn klemt',
    location: 'Blok A - Verdieping 2',
    severity: 'middel',
    trade: 'Timmerman',
    date: '02-02-2026',
    desc: 'Raamkozijn slaapkamer sluit niet goed',
  },
  {
    id: 'd5',
    title: 'Waterdruk te laag',
    location: 'Blok B - Verdieping 2',
    severity: 'hoog',
    trade: 'Loodgieter',
    date: '01-02-2026',
    desc: 'Waterdruk onvoldoende in badkamer',
  },
];

export default function CloseDefectScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<Severity>('alle');
  const [defects, setDefects] = useState<Defect[]>(MOCK_DEFECTS);

  const getSeverityColor = (severity: 'hoog' | 'middel' | 'laag') => {
    switch (severity) {
      case 'hoog':
        return '#DC2626';
      case 'middel':
        return '#F59E0B';
      case 'laag':
        return '#10B981';
    }
  };

  const handleResolve = (defectId: string) => {
    Alert.alert('Gebrek Gesloten', 'Het gebrek is als opgelost gemarkeerd.', [
      {
        text: 'OK',
        onPress: () => {
          setDefects((prev) => prev.filter((d) => d.id !== defectId));
        },
      },
    ]);
  };

  const filteredDefects =
    filter === 'alle'
      ? defects
      : defects.filter((d) => d.severity === filter);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#2D2926" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sluit Gebrek</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Filter Chips */}
        <View style={styles.filterRow}>
          {(['alle', 'hoog', 'middel', 'laag'] as Severity[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterChip,
                filter === f && styles.filterChipActive,
              ]}
              onPress={() => setFilter(f)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filter === f && styles.filterChipTextActive,
                ]}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Defects List */}
        <View style={styles.defectsList}>
          {filteredDefects.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#8A7E76" />
              <Text style={styles.emptyStateText}>Geen openstaande gebreken</Text>
            </View>
          ) : (
            filteredDefects.map((defect) => (
              <View key={defect.id} style={styles.defectCard}>
                <View style={styles.defectHeader}>
                  <View style={styles.defectTitleRow}>
                    <View
                      style={[
                        styles.severityDot,
                        { backgroundColor: getSeverityColor(defect.severity) },
                      ]}
                    />
                    <Text style={styles.defectTitle}>{defect.title}</Text>
                  </View>
                  <Text style={styles.defectDate}>{defect.date}</Text>
                </View>

                <Text style={styles.defectLocation}>
                  <Ionicons name="location-outline" size={14} color="#8A7E76" />{' '}
                  {defect.location}
                </Text>

                <Text style={styles.defectDesc}>{defect.desc}</Text>

                <View style={styles.defectFooter}>
                  <View style={styles.tradeTag}>
                    <Ionicons name="construct-outline" size={14} color="#D2691E" />
                    <Text style={styles.tradeText}>{defect.trade}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.resolveButton}
                    onPress={() => handleResolve(defect.id)}
                  >
                    <Text style={styles.resolveButtonText}>
                      Markeer als opgelost
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF6F1',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl + 20,
    paddingBottom: Spacing.lg,
    backgroundColor: '#FFFDF9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  backButton: {
    marginRight: Spacing.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2D2926',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    backgroundColor: '#FFFDF9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  filterChipActive: {
    backgroundColor: '#D2691E',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8A7E76',
  },
  filterChipTextActive: {
    color: '#FFFDF9',
  },
  defectsList: {
    gap: Spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#8A7E76',
    marginTop: Spacing.md,
  },
  defectCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: 12,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  defectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  defectTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  severityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.sm,
  },
  defectTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D2926',
    flex: 1,
  },
  defectDate: {
    fontSize: 13,
    color: '#8A7E76',
  },
  defectLocation: {
    fontSize: 14,
    color: '#8A7E76',
    marginBottom: Spacing.sm,
  },
  defectDesc: {
    fontSize: 14,
    color: '#2D2926',
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  defectFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  tradeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0EAE2',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 8,
    gap: 4,
  },
  tradeText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#D2691E',
  },
  resolveButton: {
    backgroundColor: '#D2691E',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
  },
  resolveButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFDF9',
  },
});
