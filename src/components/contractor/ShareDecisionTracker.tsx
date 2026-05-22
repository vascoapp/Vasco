// =============================================================================
// SHARE DECISION TRACKER
// =============================================================================
// Component for contractors to share decision trackers with customers
// Generates access codes and shareable links
// =============================================================================

import { useState, useCallback } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import type { CustomerDecisionTracker } from '../../types/decisions';
import { generateAccessCode } from '../../data/mockCustomerPortal';
import { logInfo } from '../../utils/errorHandler';

type IconName = keyof typeof Ionicons.glyphMap;

interface ShareDecisionTrackerProps {
  tracker: CustomerDecisionTracker;
  onClose: () => void;
}

export function ShareDecisionTracker({ tracker, onClose }: ShareDecisionTrackerProps) {
  const { t } = useTranslation();
  const [accessCode] = useState(() => generateAccessCode());
  const [copied, setCopied] = useState(false);

  const shareUrl = `https://vascobuild.com/c/${accessCode}`;
  const appUrl = `/customer/${accessCode}`;

  const shareMessage = `Hallo ${tracker.customerName.split(' ')[0]},

Hierbij de link om uw keuzes voor ${tracker.templateName} door te geven:

${shareUrl}

Of gebruik code: ${accessCode}

Graag zo snel mogelijk invullen om vertraging te voorkomen.

Met vriendelijke groet,
${tracker.customerName ? 'Uw aannemer' : ''}`;

  const handleCopyCode = useCallback(async () => {
    try {
      await Share.share({ message: accessCode });
    } catch {
      // R66r61: Share.share rarely fails on mobile but when it does (e.g.
      // user cancels mid-flow on iOS, or Android share intent denied), the
      // contractor still needs to see + manually copy the code. Localized
      // title + value-in-body so VoiceOver reads "Access code, AB12CD".
      Alert.alert(
        t('share.accessCodeTitle', 'Access code'),
        accessCode,
      );
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [accessCode, t]);

  const handleCopyLink = useCallback(async () => {
    try {
      await Share.share({ message: shareUrl });
    } catch {
      Alert.alert(
        t('share.linkTitle', 'Share link'),
        shareUrl,
      );
    }
  }, [shareUrl, t]);

  const handleShareWhatsApp = () => {
    const phone = tracker.customerPhone?.replace(/\s/g, '') || '';
    const url = phone
      ? `whatsapp://send?phone=${phone}&text=${encodeURIComponent(shareMessage)}`
      : `whatsapp://send?text=${encodeURIComponent(shareMessage)}`;

    Linking.openURL(url).catch(() => {
      Alert.alert(t('common.error', 'Error'), t('share.couldNotOpenWhatsApp', 'Could not open WhatsApp'));
    });
  };

  const handleShareSMS = () => {
    const phone = tracker.customerPhone || '';
    const url = `sms:${phone}?body=${encodeURIComponent(shareMessage)}`;

    Linking.openURL(url).catch(() => {
      Alert.alert(t('common.error', 'Error'), t('share.couldNotOpenSMS', 'Could not open SMS'));
    });
  };

  const handleShareEmail = () => {
    const email = tracker.customerEmail || '';
    const subject = `${t('share.submitChoices', 'Submit choices')}: ${tracker.templateName}`;
    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareMessage)}`;

    Linking.openURL(url).catch(() => {
      Alert.alert(t('common.error', 'Error'), t('share.couldNotOpenEmail', 'Could not open email'));
    });
  };

  const handleNativeShare = async () => {
    try {
      await Share.share({
        message: shareMessage,
        title: 'Deel keuzeformulier',
      });
    } catch (error) {
      logInfo('ShareDecisionTracker', `Share error: ${error}`);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Deel met klant</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Customer Info */}
      <View style={styles.customerCard}>
        <View style={styles.customerAvatar}>
          <Text style={styles.customerInitials}>
            {tracker.customerName.split(' ').slice(0, 2).map((n) => n[0]).join('')}
          </Text>
        </View>
        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>{tracker.customerName}</Text>
          <Text style={styles.projectName}>{tracker.templateName}</Text>
        </View>
      </View>

      {/* Access Code */}
      <View style={styles.codeSection}>
        <Text style={styles.sectionLabel}>Toegangscode</Text>
        <View style={styles.codeCard}>
          <Text style={styles.codeText}>{accessCode}</Text>
          <Pressable style={styles.copyButton} onPress={handleCopyCode}>
            <Ionicons
              name={copied ? 'checkmark' : 'copy-outline'}
              size={20}
              color={copied ? SemanticColors.feedbackSuccess : SemanticColors.actionPrimary}
            />
            <Text
              style={[
                styles.copyText,
                { color: copied ? SemanticColors.feedbackSuccess : SemanticColors.actionPrimary },
              ]}
            >
              {copied ? 'Gekopieerd' : 'Kopieer'}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.codeHelp}>
          De klant kan deze code invullen op vascobuild.com/c
        </Text>
      </View>

      {/* Share Link */}
      <View style={styles.linkSection}>
        <Text style={styles.sectionLabel}>Of deel de link</Text>
        <Pressable style={styles.linkCard} onPress={handleCopyLink}>
          <Ionicons name="link" size={20} color={SemanticColors.textSecondary} />
          <Text style={styles.linkText} numberOfLines={1}>
            {shareUrl}
          </Text>
          <Ionicons name="copy-outline" size={18} color={SemanticColors.actionPrimary} />
        </Pressable>
      </View>

      {/* Share Options */}
      <View style={styles.shareSection}>
        <Text style={styles.sectionLabel}>Verstuur via</Text>

        <View style={styles.shareGrid}>
          <ShareOption
            icon="logo-whatsapp"
            label="WhatsApp"
            color="#25D366"
            onPress={handleShareWhatsApp}
          />
          <ShareOption
            icon="chatbubble"
            label="SMS"
            color={SemanticColors.feedbackInfo}
            onPress={handleShareSMS}
          />
          <ShareOption
            icon="mail"
            label="E-mail"
            color={SemanticColors.textSecondary}
            onPress={handleShareEmail}
          />
          <ShareOption
            icon="share-social"
            label="Meer..."
            color={Palette.hermesOrange}
            onPress={handleNativeShare}
          />
        </View>
      </View>

      {/* Info Footer */}
      <View style={styles.infoFooter}>
        <Ionicons name="information-circle" size={18} color={SemanticColors.textTertiary} />
        <Text style={styles.infoText}>
          De klant kan direct keuzes doorgeven zonder account. U ontvangt een melding bij elke keuze.
        </Text>
      </View>
    </View>
  );
}

// Share Option Button
interface ShareOptionProps {
  icon: IconName;
  label: string;
  color: string;
  onPress: () => void;
}

function ShareOption({ icon, label, color, onPress }: ShareOptionProps) {
  return (
    <Pressable style={styles.shareOption} onPress={onPress}>
      <View style={[styles.shareOptionIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.shareOptionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    paddingTop: Spacing.xl,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  title: {
    fontSize: TYPE.titleSize + 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  customerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Palette.hermesOrange + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  customerInitials: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: Palette.hermesOrange,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: TYPE.titleSize + 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  projectName: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  codeSection: {
    padding: Spacing.lg,
  },
  sectionLabel: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  codeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  codeText: {
    fontSize: TYPE.displaySize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    letterSpacing: 4,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: SemanticColors.actionPrimary + '10',
    borderRadius: RADIUS.sm,
  },
  copyText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
  },
  codeHelp: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textTertiary,
    marginTop: Spacing.sm,
  },
  linkSection: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  linkText: {
    flex: 1,
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
  },
  shareSection: {
    padding: Spacing.lg,
    paddingTop: 0,
  },
  shareGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  shareOption: {
    alignItems: 'center',
    gap: 8,
  },
  shareOptionIcon: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareOptionLabel: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    fontFamily: TYPE.labelFamily,
  },
  infoFooter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.lg,
    backgroundColor: SemanticColors.surfaceSecondary,
    marginTop: 'auto',
  },
  infoText: {
    flex: 1,
    fontSize: TYPE.captionSize,
    color: SemanticColors.textTertiary,
    lineHeight: 18,
  },
});
