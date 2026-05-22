// =============================================================================
// LEGAL — Terms of Service, Privacy Policy, Data Processing, Compliance
// =============================================================================

import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Share } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { Palette, SemanticColors } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { SafeArea } from '../../src/theme/spacing';
import { useAuth } from '../../src/context/AuthContext';
import { useAppState } from '../../src/state/AppState';
import { DKLabel } from '../../src/components/shared/DKLabel';

const APP_VERSION = '1.0.0';
const LAST_UPDATED = 'March 2026';

type CountryCode = 'NL' | 'DE' | 'FR' | 'ES' | 'IT' | 'UK';

// Per-country legal + compliance details — shown only for the user's country
const COUNTRY_COMPLIANCE: Record<CountryCode, { heading: string; body: string; einvoice: string; governingLaw: string }> = {
  NL: {
    heading: 'Nederland (NL)',
    body: 'KvK (Kamer van Koophandel) registratie · BTW-nummer · Belastingdienst 7-jaar bewaarplicht · Nederlands Burgerlijk Wetboek voor contractrecht.',
    einvoice: 'Peppol BIS 3.0 · UBL 2.1 (e-facturering Rijksoverheid, via Digipoort).',
    governingLaw: 'These terms are governed by the laws of the Netherlands. Disputes will first be submitted to mediation in Amsterdam.',
  },
  DE: {
    heading: 'Deutschland (DE)',
    body: 'Handelsregister-Eintrag · Umsatzsteuer-ID (USt-IdNr) · GoBD-konforme Aufzeichnungen · 10-Jahre-Aufbewahrungspflicht (HGB §257) · B2B E-Rechnung seit Jan 2025 verpflichtend zu empfangen.',
    einvoice: 'XRechnung (B2G · Bund/Länder) · ZUGFeRD (hybrid PDF+XML) · Peppol BIS 3.0.',
    governingLaw: 'Es gilt deutsches Recht. Gerichtsstand ist der Sitz des Anbieters, soweit gesetzlich zulässig.',
  },
  FR: {
    heading: 'France (FR)',
    body: 'SIRET/SIREN · numéro TVA intracommunautaire · 10 ans de conservation (Code de commerce art. L123-22) · facturation électronique B2B obligatoire 2026-2027.',
    einvoice: 'Factur-X · Peppol BIS 3.0 · Chorus Pro (B2G).',
    governingLaw: 'Ces conditions sont régies par le droit français. Le tribunal de Paris est compétent.',
  },
  ES: {
    heading: 'España (ES)',
    body: 'NIF/CIF · NIF-IVA · 6 años de conservación (Código de Comercio art. 30) · TicketBAI (País Vasco) y Verifactu (resto de España) para registro de facturación.',
    einvoice: 'Facturae (B2G, FACe) · Peppol BIS 3.0.',
    governingLaw: 'Estas condiciones se rigen por la legislación española. Juzgados y Tribunales de Madrid.',
  },
  IT: {
    heading: 'Italia (IT)',
    body: 'Partita IVA · Codice Fiscale · FatturaPA obbligatoria via Sistema di Interscambio (SDI) · 10 anni di conservazione (Codice Civile art. 2220).',
    einvoice: 'FatturaPA (obbligatoria B2B/B2G via SDI) · Peppol BIS 3.0.',
    governingLaw: 'Queste condizioni sono regolate dal diritto italiano. Foro competente: Milano.',
  },
  UK: {
    heading: 'United Kingdom (UK)',
    body: 'Companies House registration · VAT number · HMRC 6-year retention · Making Tax Digital (MTD) compliance for VAT-registered businesses.',
    einvoice: 'Peppol BIS 3.0 (NHS via NHS Shared Business Services).',
    governingLaw: 'These terms are governed by the laws of England and Wales. Courts of London have exclusive jurisdiction.',
  },
};

type IconName = keyof typeof Ionicons.glyphMap;

interface LegalSubsection {
  headingKey: string;
  headingDefault: string;
  contentKey: string;
  contentDefault: string;
}

interface LegalSection {
  id: string;
  icon: IconName;
  titleKey: string;
  titleDefault: string;
  subsections: LegalSubsection[];
}

const LEGAL_SECTIONS: LegalSection[] = [
  {
    id: 'privacy',
    icon: 'shield-checkmark',
    titleKey: 'legal.privacyPolicy',
    titleDefault: 'Privacy Policy',
    subsections: [
      {
        headingKey: 'legal.dataWeCollect',
        headingDefault: 'Data We Collect',
        contentKey: 'legal.dataWeCollectContent',
        contentDefault:
          'We collect the following categories of personal and business data to provide our services:\n\n' +
          '\u2022 Business information: Company name, registration numbers (KvK, Handelsregister), VAT number, trade certifications, business address\n' +
          '\u2022 Account data: Name, email address, phone number, language preference\n' +
          '\u2022 Job data: Job descriptions, schedules, addresses, materials used, time tracking records, completion status\n' +
          '\u2022 Financial records: Invoices, quotes, payment records, pricing data, accounting exports\n' +
          '\u2022 Photos: Job site photos uploaded for AI analysis, receipt/invoice scans\n' +
          '\u2022 Location: Job site addresses for scheduling and route optimization (not real-time GPS tracking)\n' +
          '\u2022 Usage analytics: Anonymized feature usage to improve the platform',
      },
      {
        headingKey: 'legal.howWeUseData',
        headingDefault: 'How We Use Your Data',
        contentKey: 'legal.howWeUseDataContent',
        contentDefault:
          '\u2022 Core platform functionality: Job management, scheduling, invoicing, quoting\n' +
          '\u2022 AI-powered insights: Our compound AI engine analyzes your business data to generate actionable recommendations, predict payment timelines, optimize pricing, and identify workflow improvements\n' +
          '\u2022 Payment processing: Processing payments via Mollie (EU) or Stripe (UK) when you create payment links\n' +
          '\u2022 Accounting sync: Exporting invoices and financial data to your connected accounting provider (only when you explicitly connect and trigger exports)\n' +
          '\u2022 Benchmarking: Anonymized, aggregated cross-contractor benchmarks to help you understand market positioning (no individual data is ever shared)',
      },
      {
        headingKey: 'legal.whoWeShareWith',
        headingDefault: 'Who We Share Data With',
        contentKey: 'legal.whoWeShareWithContent',
        contentDefault:
          'We only share your data with third parties when necessary to provide our services:\n\n' +
          '\u2022 Payment providers: Mollie (EU countries) and Stripe (UK) for payment processing — only invoice amounts and customer details required for payment\n' +
          '\u2022 Accounting providers: Your connected accounting software (Moneybird, DATEV, Lexoffice, SevDesk, Pennylane, Holded, Fatture in Cloud, Xero, QuickBooks, etc.) — only when you explicitly trigger an export\n' +
          '\u2022 Cloud infrastructure: Supabase (EU-hosted) for secure data storage and authentication\n' +
          '\u2022 AI processing: Anthropic (Claude) for photo analysis — images are processed and not retained\n\n' +
          'We never sell your data to third parties. We never share individual business data with competitors.',
      },
      {
        headingKey: 'legal.gdprRights',
        headingDefault: 'Your GDPR Rights',
        contentKey: 'legal.gdprRightsContent',
        contentDefault:
          'Under the EU General Data Protection Regulation (GDPR), you have the following rights — all implemented directly in the app:\n\n' +
          '\u2022 Right of access: View all your data in the app at any time\n' +
          '\u2022 Right to data portability: Export all your data (jobs, invoices, quotes, customers) as structured data using the "Export my data" button below\n' +
          '\u2022 Right to erasure: Delete your account and all associated data using the "Delete my account" button below. Financial records subject to legal retention periods will be anonymized rather than deleted.\n' +
          '\u2022 Right to rectification: Edit any of your data directly in the app\n' +
          '\u2022 Right to restrict processing: Contact us at privacy@vascobuild.com\n' +
          '\u2022 Right to object: Opt out of analytics in your profile settings',
      },
      {
        headingKey: 'legal.dataRetention',
        headingDefault: 'Data Retention',
        contentKey: 'legal.dataRetentionContent',
        contentDefault:
          '\u2022 Financial records (invoices, quotes, payments): 7 years minimum, as required by EU tax law (Belastingdienst NL, Finanzamt DE, HMRC UK, etc.)\n' +
          '\u2022 Contract and job records: 7 years from completion\n' +
          '\u2022 Customer data: Retained while your account is active, deleted within 30 days of account closure (except where linked to retained financial records)\n' +
          '\u2022 Usage analytics: Anonymized and aggregated after 12 months\n' +
          '\u2022 Photos and scans: Retained while your account is active, deleted within 30 days of account closure',
      },
    ],
  },
  {
    id: 'terms',
    icon: 'document-text',
    titleKey: 'legal.termsOfService',
    titleDefault: 'Terms of Service',
    subsections: [
      {
        headingKey: 'legal.platformUsage',
        headingDefault: 'Platform Usage',
        contentKey: 'legal.platformUsageContent',
        contentDefault:
          'Vasco provides an AI-native construction trades management platform including job scheduling, invoicing, quoting, customer management, and workflow automation. By creating an account and using the platform, you agree to these terms.\n\n' +
          'You must be at least 18 years old and legally authorized to operate a construction trade business in your jurisdiction. You must provide accurate business information during registration.',
      },
      {
        headingKey: 'legal.contractorResponsibilities',
        headingDefault: 'Contractor Responsibilities',
        contentKey: 'legal.contractorResponsibilitiesContent',
        contentDefault:
          '\u2022 You are responsible for the accuracy of all data you enter (invoices, quotes, job details, customer information)\n' +
          '\u2022 You must maintain the confidentiality of your account credentials\n' +
          '\u2022 You are responsible for compliance with all applicable trade regulations, building codes, and licensing requirements in your jurisdiction\n' +
          '\u2022 You must not use the platform for any unlawful purpose\n' +
          '\u2022 AI-generated insights and recommendations are advisory only — you are responsible for all business decisions',
      },
      {
        headingKey: 'legal.paymentTerms',
        headingDefault: 'Payment Terms',
        contentKey: 'legal.paymentTermsContent',
        contentDefault:
          '\u2022 Vasco subscription fees are billed monthly or annually as selected during signup\n' +
          '\u2022 Payment processing fees (Mollie/Stripe) are charged per transaction at their published rates\n' +
          '\u2022 You are responsible for setting your own payment terms with your customers\n' +
          '\u2022 Vasco is not a party to any contract between you and your customers\n' +
          '\u2022 Refunds for subscription fees follow a 14-day cooling-off period per EU consumer law',
      },
      {
        headingKey: 'legal.liabilityLimitations',
        headingDefault: 'Liability Limitations',
        contentKey: 'legal.liabilityLimitationsContent',
        contentDefault:
          'Vasco is provided "as is" without warranty of any kind, express or implied. Specifically:\n\n' +
          '\u2022 AI predictions (payment timing, quote win rates, job durations) are estimates based on available data and are not guarantees\n' +
          '\u2022 We are not liable for any loss resulting from reliance on AI-generated recommendations\n' +
          '\u2022 We are not liable for any indirect, incidental, or consequential damages\n' +
          '\u2022 Our total liability is limited to the subscription fees paid in the 12 months prior to the claim\n' +
          '\u2022 We do not guarantee uninterrupted service availability',
      },
      {
        headingKey: 'legal.disputeResolution',
        headingDefault: 'Dispute Resolution',
        contentKey: 'legal.disputeResolutionContent',
        contentDefault:
          '\u2022 These terms are governed by the laws of the Netherlands\n' +
          '\u2022 Disputes will first be submitted to mediation in Amsterdam\n' +
          '\u2022 If mediation fails, disputes will be resolved by the courts of Amsterdam\n' +
          '\u2022 EU consumers may also use the European Online Dispute Resolution platform (ec.europa.eu/odr)\n' +
          '\u2022 You may terminate your account at any time through the app',
      },
    ],
  },
  {
    id: 'dataprocessing',
    icon: 'server',
    titleKey: 'legal.dataProcessing',
    titleDefault: 'Data Processing',
    subsections: [
      {
        headingKey: 'legal.subProcessors',
        headingDefault: 'Sub-processors',
        contentKey: 'legal.subProcessorsContent',
        contentDefault:
          'The following sub-processors handle your data under strict data processing agreements:\n\n' +
          '\u2022 Supabase (Singapore Pte Ltd) — Database, authentication, edge functions. Data location: EU (Frankfurt, Germany). SOC2 Type II certified.\n' +
          '\u2022 Mollie (Netherlands) — Payment processing for NL, DE, FR, ES, IT. PCI DSS Level 1 compliant.\n' +
          '\u2022 Stripe (Ireland) — Payment processing for UK. PCI DSS Level 1 compliant.\n' +
          '\u2022 Accounting providers — Only when connected by you: Moneybird (NL), DATEV/Lexoffice/SevDesk (DE), Pennylane (FR), Holded (ES), Fatture in Cloud (IT), Xero/QuickBooks (UK). Data is only transmitted when you trigger an export.\n' +
          '\u2022 Anthropic (US) — AI photo analysis via Claude. Images are processed in transit and not stored. EU Standard Contractual Clauses in place.',
      },
      {
        headingKey: 'legal.dataLocation',
        headingDefault: 'Data Location & Security',
        contentKey: 'legal.dataLocationContent',
        contentDefault:
          '\u2022 All primary data is stored in EU data centers (Frankfurt, Germany)\n' +
          '\u2022 Data is encrypted at rest using AES-256 encryption\n' +
          '\u2022 Data is encrypted in transit using TLS 1.3\n' +
          '\u2022 Database backups are encrypted and stored in the same EU region\n' +
          '\u2022 Access to production data is restricted to authorized personnel with multi-factor authentication\n' +
          '\u2022 We conduct regular security audits and penetration testing',
      },
      {
        headingKey: 'legal.legalBasis',
        headingDefault: 'Legal Basis for Processing',
        contentKey: 'legal.legalBasisContent',
        contentDefault:
          '\u2022 Contract performance (Art. 6(1)(b) GDPR): Processing necessary to provide platform services\n' +
          '\u2022 Legal obligation (Art. 6(1)(c) GDPR): Financial record retention per EU tax law\n' +
          '\u2022 Legitimate interest (Art. 6(1)(f) GDPR): Service improvement via anonymized analytics\n' +
          '\u2022 Consent (Art. 6(1)(a) GDPR): Optional features like photo AI analysis (consent can be withdrawn at any time)',
      },
    ],
  },
  {
    id: 'compliance',
    icon: 'flag',
    titleKey: 'legal.compliance',
    titleDefault: 'Compliance',
    subsections: [
      {
        headingKey: 'legal.perCountry',
        headingDefault: 'Country-Specific Regulatory Information',
        contentKey: 'legal.perCountryContent',
        contentDefault:
          'Vasco supports compliance requirements across 6 EU countries:\n\n' +
          '\u2022 Netherlands (NL): KvK (Kamer van Koophandel) registration, BTW-nummer (VAT), Belastingdienst 7-year retention, Dutch BW (Burgerlijk Wetboek) for contract law\n' +
          '\u2022 Germany (DE): Handelsregister registration, Umsatzsteuer-ID (VAT), GoBD-compliant record keeping, 10-year retention for financial documents (HGB \u00a7257), XRechnung/ZUGFeRD e-invoicing\n' +
          '\u2022 France (FR): SIRET/SIREN registration, TVA number, 10-year retention (Code de Commerce), Factur-X e-invoicing, mandatory e-invoicing for B2B (2026)\n' +
          '\u2022 Spain (ES): NIF/CIF registration, NIF-IVA (VAT), 6-year retention (C\u00f3digo de Comercio), Facturae/TicketBAI e-invoicing\n' +
          '\u2022 Italy (IT): Partita IVA, Codice Fiscale, FatturaPA mandatory e-invoicing via SDI, 10-year retention (Codice Civile art. 2220)\n' +
          '\u2022 United Kingdom (UK): Companies House registration, VAT number, HMRC 6-year retention, Making Tax Digital (MTD) compliance',
      },
      {
        headingKey: 'legal.einvoicing',
        headingDefault: 'E-Invoicing Standards',
        contentKey: 'legal.einvoicingContent',
        contentDefault:
          'Vasco supports the following e-invoicing standards per country:\n\n' +
          '\u2022 Peppol: Pan-European e-invoicing network (all countries)\n' +
          '\u2022 XRechnung: German government e-invoicing standard\n' +
          '\u2022 ZUGFeRD: German hybrid PDF/XML invoice format\n' +
          '\u2022 Factur-X: French equivalent of ZUGFeRD\n' +
          '\u2022 Facturae: Spanish e-invoicing format\n' +
          '\u2022 FatturaPA: Italian mandatory e-invoicing via Sistema di Interscambio (SDI)',
      },
    ],
  },
  {
    id: 'contact',
    icon: 'mail',
    titleKey: 'legal.contact',
    titleDefault: 'Contact',
    subsections: [
      {
        headingKey: 'legal.contactDetails',
        headingDefault: 'Contact Information',
        contentKey: 'legal.contactDetailsContent',
        contentDefault:
          'For questions about these policies, your data, or to exercise your GDPR rights:\n\n' +
          'Email: privacy@vascobuild.com\nSupport: support@vascobuild.com\n\nVasco B.V.\nAmsterdam, The Netherlands\nKvK: 12345678\nData Protection Officer: privacy@vascobuild.com',
      },
    ],
  },
];

export default function LegalScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { invoices, jobs, customers } = useAppState();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    privacy: true,
    terms: false,
    dataprocessing: false,
    compliance: false,
    contact: false,
  });

  // Build sections dynamically so the Compliance block only shows the user's country
  const userCountry = (user?.country as CountryCode | undefined) ?? 'NL';
  const userCompliance = COUNTRY_COMPLIANCE[userCountry] ?? COUNTRY_COMPLIANCE.NL;
  const sections: LegalSection[] = LEGAL_SECTIONS.map((section) => {
    if (section.id !== 'compliance') return section;
    return {
      ...section,
      subsections: [
        {
          headingKey: 'legal.perCountry',
          headingDefault: 'Regulatory Information',
          contentKey: `legal.perCountryContent_${userCountry}`,
          contentDefault: `${userCompliance.heading}\n\n${userCompliance.body}`,
        },
        {
          headingKey: 'legal.einvoicing',
          headingDefault: 'E-Invoicing Standards',
          contentKey: `legal.einvoicingContent_${userCountry}`,
          contentDefault: userCompliance.einvoice,
        },
      ],
    };
  });

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExportData = () => {
    Share.share({
      message: t('legal.exportMessage', {
        defaultValue: 'Vasco Data Export\n\nUser: {{name}} ({{email}})\nCompany: {{company}}\nInvoices: {{invoices}}\nJobs: {{jobs}}\nCustomers: {{customers}}\n\nFull data export available upon request at privacy@vascobuild.com',
        name: user?.name ?? '',
        email: user?.email ?? '',
        company: user?.company ?? '',
        invoices: invoices.length,
        jobs: jobs.length,
        customers: customers.length,
      }),
      title: t('legal.dataExport', 'Vasco Data Export'),
    });
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('legal.deleteAccount', 'Delete my account'),
      t('legal.deleteAccountWarning', 'This will permanently delete your account and all data. Financial records will be anonymized per EU retention law (7 years). This action cannot be undone.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('legal.deleteConfirm', 'Delete permanently'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t('legal.deleteConfirmTitle', 'Account deletion requested'),
              t('legal.deleteConfirmDesc', 'Your account deletion has been scheduled. You will receive a confirmation email within 24 hours. All data will be removed within 30 days.'),
              [{ text: t('common.ok', 'OK'), onPress: () => { logout(); router.replace('/login'); } }],
            );
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel={t('common.back', 'Back')}>
          <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('legal.title', 'Legal')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Version info */}
        <View style={styles.versionCard}>
          <View style={styles.versionRow}>
            <Ionicons name="shield-checkmark" size={20} color={Palette.hermesOrange} />
            <View style={{ flex: 1 }}>
              <Text style={styles.versionLabel}>{t('legal.appVersion', 'App version')} {APP_VERSION}</Text>
              <Text style={styles.lastUpdated}>
                {t('legal.lastUpdated', 'Last updated')}: {LAST_UPDATED}
              </Text>
            </View>
          </View>
        </View>

        {/* Legal sections */}
        {sections.map((section) => (
          <View key={section.id} style={styles.section}>
            {/* Section header — always visible */}
            <Pressable style={styles.sectionHeader} onPress={() => toggleSection(section.id)}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name={section.icon} size={18} color={Palette.hermesOrange} />
              </View>
              <Text style={styles.sectionTitle}>{t(section.titleKey, section.titleDefault)}</Text>
              <Ionicons
                name={expandedSections[section.id] ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={SemanticColors.textTertiary}
              />
            </Pressable>

            {/* Subsections — shown when expanded */}
            {expandedSections[section.id] && (
              <View style={styles.sectionBody}>
                {section.subsections.map((sub, idx) => (
                  <View key={sub.headingKey} style={[styles.subsection, idx > 0 && styles.subsectionBorder]}>
                    <Text style={styles.subsectionHeading}>{t(sub.headingKey, sub.headingDefault)}</Text>
                    <Text style={styles.subsectionContent}>{t(sub.contentKey, sub.contentDefault)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* GDPR Action Buttons */}
        <View style={styles.gdprSection}>
          <DKLabel style={styles.gdprSectionTitle}>{t('legal.yourData', 'YOUR DATA')}</DKLabel>

          <Pressable style={styles.gdprButton} onPress={handleExportData}>
            <View style={styles.gdprButtonIcon}>
              <Ionicons name="download-outline" size={20} color={Palette.hermesOrange} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.gdprButtonTitle}>{t('legal.exportMyData', 'Export my data')}</Text>
              <Text style={styles.gdprButtonDesc}>
                {t('legal.exportMyDataDesc', 'Download all your data: jobs, invoices, quotes, customers')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
          </Pressable>

          <Pressable style={styles.gdprButton} onPress={handleDeleteAccount}>
            <View style={[styles.gdprButtonIcon, styles.deleteButtonIcon]}>
              <Ionicons name="trash-outline" size={20} color={SemanticColors.feedbackError} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.gdprButtonTitle, { color: SemanticColors.feedbackError }]}>
                {t('legal.deleteMyAccount', 'Delete my account')}
              </Text>
              <Text style={styles.gdprButtonDesc}>
                {t('legal.deleteMyAccountDesc', 'Permanently delete your account and all data')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
          </Pressable>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t(`legal.footerNote_${userCountry}`, userCompliance.governingLaw)}
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
    backgroundColor: "#14181F",
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
    
    color: SemanticColors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2 },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: GRID.md,
    paddingTop: GRID.lg,
    paddingBottom: SafeArea.bottom + GRID.xl,
  },
  versionCard: {
    backgroundColor: "#14181F",
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    marginBottom: GRID.lg,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm + 4,
  },
  versionLabel: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  lastUpdated: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  section: {
    backgroundColor: "#14181F",
    borderRadius: RADIUS.lg,
    marginBottom: GRID.md,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: GRID.md,
    gap: GRID.sm + 4,
  },
  sectionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    backgroundColor: Palette.hermesOrange + '0C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    flex: 1,
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  sectionBody: {
    paddingHorizontal: GRID.md,
    paddingBottom: GRID.md,
  },
  subsection: {
    paddingTop: GRID.sm,
    paddingBottom: GRID.sm,
  },
  subsectionBorder: {
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderMuted,
  },
  subsectionHeading: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    marginBottom: GRID.sm,
  },
  subsectionContent: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textSecondary,
    lineHeight: 20,
  },
  gdprSection: {
    marginTop: GRID.sm,
    gap: GRID.sm,
  },
  gdprSectionTitle: {
    fontSize: TYPE.labelSize,
    fontFamily: 'Archivo_800ExtraBold',
    color: SemanticColors.textTertiary,
    letterSpacing: 0.8,
    paddingHorizontal: GRID.xs,
    marginBottom: GRID.xs,
  },
  gdprButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: "#14181F",
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    gap: GRID.sm + 4,
  },
  gdprButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: Palette.hermesOrange + '0C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gdprButtonTitle: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  gdprButtonDesc: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  deleteButtonIcon: {
    backgroundColor: SemanticColors.feedbackError + '0C',
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
