import { ScrollView, StyleSheet, View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';

interface Tool {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const TOOLS: Tool[] = [
  {
    id: 'calculator',
    title: 'Quote Calculator',
    description: 'Calculate job quotes with materials and labor',
    icon: 'calculator',
    color: Colors.success,
  },
  {
    id: 'materials',
    title: 'Material Estimator',
    description: 'Estimate material quantities for projects',
    icon: 'cube',
    color: Colors.accentDeep,
  },
  {
    id: 'schedule',
    title: 'Schedule Planner',
    description: 'Plan and organize your work schedule',
    icon: 'calendar',
    color: Colors.warning,
  },
  {
    id: 'invoice',
    title: 'Invoice Generator',
    description: 'Create and send professional invoices',
    icon: 'document-text',
    color: Colors.accentMuted,
  },
  {
    id: 'checklist',
    title: 'Job Checklist',
    description: 'Standard checklists for common job types',
    icon: 'checkbox',
    color: '#9B59B6',
  },
  {
    id: 'camera',
    title: 'Photo Evidence',
    description: 'Capture and organize job photos',
    icon: 'camera',
    color: '#E74C3C',
  },
];

export default function ToolsScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={Typography.title}>Tools</Text>
        <Text style={styles.subtitle}>Quick access to contractor tools</Text>

        <View style={styles.toolsGrid}>
          {TOOLS.map((tool) => (
            <Pressable key={tool.id} style={styles.toolCard}>
              <View style={[styles.iconContainer, { backgroundColor: tool.color + '20' }]}>
                <Ionicons name={tool.icon} size={28} color={tool.color} />
              </View>
              <Text style={styles.toolTitle}>{tool.title}</Text>
              <Text style={styles.toolDescription}>{tool.description}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  subtitle: {
    color: Colors.muted,
    fontSize: 14,
    marginBottom: Spacing.md,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  toolCard: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  toolTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  toolDescription: {
    color: Colors.muted,
    fontSize: 11,
    lineHeight: 16,
  },
});
