// =============================================================================
// LEGAL — Terms of Service, Privacy Policy, Data Processing
// =============================================================================

import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Palette, SemanticColors } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { SafeArea } from '../../src/theme/spacing';

const APP_VERSION = '1.0.0';
const LAST_UPDATED = '2026-03-01';

interface LegalSection {
  titleKey: string;
  titleDefault: string;
  paragraphs: { key: string; default: string }[];
}

const LEGAL_SECTIONS: LegalSection[] = [
  {
    titleKey: 'legal.termsOfService',
    titleDefault: 'Terms of Service',
    paragraphs: [
      {
        key: 'legal.termsIntro',
        default:
          'By using Vasco, you agree to these Terms of Service. Vasco provides a construction trades management platform including job scheduling, invoicing, quoting, and AI-assisted workflow automation.',
      },
      {
        key: 'legal.termsUsage',
        default:
          'You are responsible for maintaining the confidentiality of your account credentials. You agree not to use the service for any unlawful purpose or in violation of any applicable regulations.',
      },
      {
        key: 'legal.termsLiability',
        default:
          'Vasco is provided "as is" without warranty of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the platform.',
      },
      {
        key: 'legal.termsTermination',
        default:
          'We reserve the right to suspend or terminate your account if you violate these terms. You may delete your account at any time through the app settings.',
      },
    ],
  },
  {
    titleKey: 'legal.privacyPolicy',
    titleDefault: 'Privacy Policy',
    paragraphs: [
      {
        key: 'legal.privacyIntro',
        default:
          'Vasco collects and processes personal data to provide our construction management services. We are committed to protecting your privacy in compliance with the EU General Data Protection Regulation (GDPR).',
      },
      {
        key: 'legal.privacyDataCollected',
        default:
          'We collect: account information (name, email, company details), job and project data, financial records (invoices, quotes), and usage analytics. All data is stored securely in EU-based data centers.',
      },
      {
        key: 'legal.privacyRights',
        default:
          'You have the right to access, correct, delete, or export your personal data at any time. To exercise these rights, contact us at privacy@vasco.dev or use the data export feature in Settings.',
      },
    ],
  },
  {
    titleKey: 'legal.dataProcessing',
    titleDefault: 'Data Processing',
    paragraphs: [
      {
        key: 'legal.dataProcessingIntro',
        default:
          'Vasco processes your data for the following purposes: providing core platform functionality, generating AI-powered insights and recommendations, improving service quality, and complying with legal obligations.',
      },
      {
        key: 'legal.dataProcessingThirdParty',
        default:
          'We share data with third-party processors only as necessary: payment providers (Mollie), accounting integrations (when connected by you), and cloud infrastructure (Supabase). All processors are GDPR-compliant.',
      },
      {
        key: 'legal.dataProcessingRetention',
        default:
          'Financial records are retained for the legally required period in your country (typically 7-10 years). Other data is retained while your account is active and deleted within 30 days of account closure.',
      },
    ],
  },
  {
    titleKey: 'legal.cookiePolicy',
    titleDefault: 'Cookie Policy',
    paragraphs: [
      {
        key: 'legal.cookieIntro',
        default:
          'As a mobile application, Vasco uses local storage (AsyncStorage) instead of browser cookies. This data is stored locally on your device and is used to maintain your session, preferences, and cached data.',
      },
      {
        key: 'legal.cookieAnalytics',
        default:
          'We use anonymized usage analytics to improve the app experience. You can opt out of analytics collection in your profile settings.',
      },
    ],
  },
  {
    titleKey: 'legal.contact',
    titleDefault: 'Contact',
    paragraphs: [
      {
        key: 'legal.contactInfo',
        default:
          'For questions about these policies or your data, contact us at:\n\nEmail: privacy@vasco.dev\nSupport: support@vasco.dev\n\nVasco B.V.\nAmsterdam, The Netherlands\nKvK: 12345678',
      },
    ],
  },
];

export default function LegalScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel={t('common.back', 'Back')}>
          <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('legal.title', 'Legal')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Version info */}
        <View style={styles.versionCard}>
          <Text style={styles.versionLabel}>{t('legal.appVersion', 'App version')}</Text>
          <Text style={styles.versionValue}>{APP_VERSION}</Text>
          <Text style={styles.lastUpdated}>
            {t('legal.lastUpdated', 'Last updated')}: {LAST_UPDATED}
          </Text>
        </View>

        {/* Legal sections */}
        {LEGAL_SECTIONS.map((section, index) => (
          <View key={section.titleKey} style={[styles.section, index === LEGAL_SECTIONS.length - 1 && styles.lastSection]}>
            <Text style={styles.sectionTitle}>{t(section.titleKey, section.titleDefault)}</Text>
            {section.paragraphs.map((paragraph) => (
              <Text key={paragraph.key} style={styles.paragraph}>
                {t(paragraph.key, paragraph.default)}
              </Text>
            ))}
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t('legal.footerNote', 'These policies are governed by the laws of the Netherlands and the European Union.')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
    paddingTop: SafeArea.top,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GRID.md,
    paddingVertical: GRID.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
  },
  headerTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    letterSpacing: TYPE.sectionTracking,
    color: SemanticColors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: GRID.md,
    paddingTop: GRID.lg,
    paddingBottom: SafeArea.bottom + GRID.xl,
  },
  versionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    marginBottom: GRID.lg,
    alignItems: 'center',
  },
  versionLabel: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
    marginBottom: GRID.xs,
  },
  versionValue: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    letterSpacing: TYPE.sectionTracking,
    color: SemanticColors.textPrimary,
    marginBottom: GRID.xs,
  },
  lastUpdated: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.tinyFamily,
    color: SemanticColors.textTertiary,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    marginBottom: GRID.md,
  },
  lastSection: {
    marginBottom: GRID.lg,
  },
  sectionTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    letterSpacing: TYPE.sectionTracking,
    color: SemanticColors.textPrimary,
    marginBottom: GRID.sm,
  },
  paragraph: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textSecondary,
    lineHeight: 22,
    marginBottom: GRID.sm,
  },
  footer: {
    paddingVertical: GRID.lg,
    alignItems: 'center',
  },
  footerText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
  },
});
