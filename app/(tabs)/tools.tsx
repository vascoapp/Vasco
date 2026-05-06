import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View, Text, Pressable, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';

interface Tool {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route?: string;
}

const TOOLS: Tool[] = [
  {
    id: 'new-quote',
    title: 'New Quote',
    description: 'Create a draft quote with line items',
    icon: 'create',
    color: SemanticColors.actionPrimary,
    route: '/quotes/new',
  },
  {
    id: 'new-invoice',
    title: 'New Invoice',
    description: 'Create an invoice from a quote',
    icon: 'document-text',
    color: SemanticColors.feedbackSuccess,
    route: '/invoices/new',
  },
  {
    id: 'customers',
    title: 'Customers',
    description: 'Manage your customer list',
    icon: 'people',
    color: '#3B82F6',
    route: '/(modals)/customers',
  },
  {
    id: 'business',
    title: 'Business Settings',
    description: 'KVK, BTW, and contact details',
    icon: 'business',
    color: '#7C3AED',
    route: '/(modals)/business-settings',
  },
  {
    id: 'pdf',
    title: 'PDF Scanner',
    description: 'Extract prices from invoices & catalogs',
    icon: 'scan',
    color: SemanticColors.feedbackWarning,
    route: '/(modals)/ingestion',
  },
  {
    id: 'insights',
    title: 'Price Insights',
    description: 'View pricing intelligence & risks',
    icon: 'analytics',
    color: '#E74C3C',
    route: '/(modals)/insights',
  },
  {
    id: 'materials',
    title: 'Materials',
    description: 'Material catalog & supplier prices',
    icon: 'cube',
    color: '#3B82F6',
    route: '/hub/materials',
  },
  {
    id: 'suppliers',
    title: 'Suppliers',
    description: 'Supplier performance & reliability',
    icon: 'business',
    color: '#10B981',
    route: '/hub/suppliers',
  },
  {
    id: 'moneybird',
    title: 'Moneybird',
    description: 'Accounting integration',
    icon: 'cloud-upload',
    color: SemanticColors.textTertiary,
    route: '/(modals)/moneybird',
  },
  {
    id: 'mollie',
    title: 'Mollie',
    description: 'Payment processing',
    icon: 'card',
    color: '#9B59B6',
    route: '/(modals)/mollie',
  },
];

export default function ToolsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={Typography.title}>Tools</Text>
        <Text style={styles.subtitle}>Quick access to contractor tools</Text>

        <View style={styles.toolsGrid}>
          {TOOLS.map((tool) => (
            <Pressable
              key={tool.id}
              style={({ pressed }) => [styles.toolCard, pressed && styles.toolCardPressed]}
              onPress={() => tool.route && router.push(tool.route as never)}
            >
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
    backgroundColor: SemanticColors.surfaceBackground,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: 40,
  },
  subtitle: {
    color: SemanticColors.textSecondary,
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
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 8,
  },
  toolCardPressed: {
    opacity: 0.85,
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
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  toolDescription: {
    color: SemanticColors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
});
