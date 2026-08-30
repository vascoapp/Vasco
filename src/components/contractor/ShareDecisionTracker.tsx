// =============================================================================
// SHARE DECISION TRACKER
// =============================================================================
// Component for contractors to share decision trackers with customers
// Generates access codes and shareable links
// =============================================================================

import { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import type { CustomerDecisionTracker } from '../../types/decisions';
import { generateAccessCode } from '../../data/mockCustomerPortal';
import { useAppState } from '../../state/AppState';
import { logInfo } from '../../utils/errorHandler';

type IconName = keyof typeof Ionicons.glyphMap;

interface ShareDecisionTrackerProps {
  tracker: CustomerDecisionTracker;
  onClose: () => void;
}

export function ShareDecisionTracker({ tracker, onClose }: ShareDecisionTrackerProps) {
  const { t } = useTranslation();
  const { requestTrackerDeposit, mollieConnected, stripeConnected } = useAppState();
  const paymentConnected = mollieConnected || stripeConnected;
  // R309: prefer the tracker's persisted access_code (the row the customer
  // portal actually reads). Only fall back to a fresh code for legacy
  // local-only trackers that never got a BE access_code. Pre-R309 this always
  // minted a NEW code, so the shared link pointed at a non-existent row.
  const [accessCode] = useState(() => tracker.accessCode ?? generateAccessCode());
  const [copied, setCopied] = useState(false);
  // R191: separate flag for the link-copy state so both surfaces give
  // the same checkmark feedback without sharing the same timer.
  const [linkCopied, setLinkCopied] = useState(false);
  // R309: deposit/payment-link request state.
  const [depositInput, setDepositInput] = useState('');
  const [creatingLink, setCreatingLink] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(tracker.paymentLink ?? null);

  const handleRequestDeposit = useCallback(async () => {
    const amount = parseFloat(depositInput.replace(',', '.'));
    if (!amount || amount <= 0) {
      Alert.alert(
        t('share.invalidAmount', 'Enter a valid amount'),
        t('share.invalidAmountBody', 'Please enter the deposit amount you want to request.'),
      );
      return;
    }
    setCreatingLink(true);
    try {
      const url = await requestTrackerDeposit(accessCode, amount);
      setCreatedLink(url);
      Alert.alert(
        t('share.depositRequested', 'Payment link added'),
        t('share.depositRequestedBody', 'Your customer will now see a Pay button in their portal.'),
      );
    } catch (e) {
      Alert.alert(
        t('common.error', 'Error'),
        e instanceof Error ? e.message : t('share.depositFailed', 'Could not create the payment link.'),
      );
    } finally {
      setCreatingLink(false);
    }
  }, [depositInput, accessCode, requestTrackerDeposit, t]);

  // R191: was https://vascobuild.com/c/{code} — neither the host nor path
  // was deployed; every share link was a DNS error. Universal-link landing
  // lives at admin.vascobuild.com/customer/[code] (R190).
  const shareUrl = `https://admin.vascobuild.com/customer/${accessCode}`;
  const appUrl = `/customer/${accessCode}`;

  // R191: was hardcoded Dutch — DE/FR/ES/IT contractors saw a Dutch
  // share message regardless of their own locale. Now built from i18n
  // with the customer's first name + project interpolated.
  const customerFirstName = tracker.customerName.split(' ')[0];
  const shareMessage = t('share.message', {
    defaultValue:
      'Hello {{name}},\n\nHere is the link to submit your choices for {{project}}:\n\n{{url}}\n\nOr use code: {{code}}\n\nPlease fill it out as soon as possible to avoid delays.\n\nBest regards,\nYour contractor',
    name: customerFirstName,
    project: tracker.templateName,
    url: shareUrl,
    code: accessCode,
  });

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
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
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
        title: t('share.shareTitle', 'Share decision form'),
      });
    } catch (error) {
      logInfo('ShareDecisionTracker', `Share error: ${error}`);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.closeButton} accessibilityRole="button" accessibilityLabel={t('common.close', 'Close')}>
          <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>{t('share.shareWithCustomer', 'Share with customer')}</Text>
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
        <Text style={styles.sectionLabel}>{t('share.accessCode', 'Access code')}</Text>
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
              {copied ? t('share.copied', 'Copied') : t('share.copy', 'Copy')}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.codeHelp}>
          {t('share.codeHelp', 'Your customer can enter this code at admin.vascobuild.com/customer')}
        </Text>
      </View>

      {/* Share Link */}
      <View style={styles.linkSection}>
        <Text style={styles.sectionLabel}>{t('share.orShareLink', 'Or share the link')}</Text>
        <Pressable style={styles.linkCard} onPress={handleCopyLink}>
          <Ionicons name="link" size={20} color={SemanticColors.textSecondary} />
          <Text style={styles.linkText} numberOfLines={1}>
            {shareUrl}
          </Text>
          <Ionicons
            name={linkCopied ? 'checkmark' : 'copy-outline'}
            size={18}
            color={linkCopied ? SemanticColors.feedbackSuccess : SemanticColors.actionPrimary}
          />
        </Pressable>
      </View>

      {/* Share Options */}
      <View style={styles.shareSection}>
        <Text style={styles.sectionLabel}>{t('share.sendVia', 'Send via')}</Text>

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
            label={t('share.email', 'Email')}
            color={SemanticColors.textSecondary}
            onPress={handleShareEmail}
          />
          <ShareOption
            icon="share-social"
            label={t('share.more', 'More')}
            color={Palette.hermesOrange}
            onPress={handleNativeShare}
          />
        </View>
      </View>

      {/* Request a deposit (R309) — only when a payment provider is connected */}
      {paymentConnected && (
        <View style={styles.depositSection}>
          <Text style={styles.sectionLabel}>{t('share.requestDeposit', 'Request a deposit')}</Text>
          {createdLink ? (
            <View style={styles.depositDone}>
              <Ionicons name="checkmark-circle" size={20} color={SemanticColors.feedbackSuccess} />
              <Text style={styles.depositDoneText}>
                {t('share.depositActive', 'Payment link is active — your customer can pay from their portal.')}
              </Text>
            </View>
          ) : (
            <View style={styles.depositRow}>
              <TextInput
                style={styles.depositInput}
                value={depositInput}
                onChangeText={setDepositInput}
                keyboardType="decimal-pad"
                placeholder={t('share.depositAmount', 'Amount')}
                placeholderTextColor={SemanticColors.textTertiary}
                accessibilityLabel={t('share.depositAmount', 'Amount')}
              />
              <Pressable
                style={[styles.depositButton, creatingLink && { opacity: 0.6 }]}
                disabled={creatingLink}
                onPress={handleRequestDeposit}
                accessibilityRole="button"
              >
                {creatingLink
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.depositButtonText}>{t('share.createLink', 'Create link')}</Text>}
              </Pressable>
            </View>
          )}
          <Text style={styles.codeHelp}>
            {t('share.depositHelp', 'Creates a secure checkout link the customer pays from their portal.')}
          </Text>
        </View>
      )}

      {/* Info Footer */}
      <View style={styles.infoFooter}>
        <Ionicons name="information-circle" size={18} color={SemanticColors.textTertiary} />
        <Text style={styles.infoText}>
          {t('share.noAccountNeeded', 'Your customer can submit choices without an account. You will be notified of each decision.')}
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
  depositSection: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  depositRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  depositInput: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    padding: Spacing.md,
    fontSize: TYPE.bodySize,
    color: SemanticColors.textPrimary,
  },
  depositButton: {
    backgroundColor: Palette.hermesOrange,
    borderRadius: RADIUS.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  depositButtonText: {
    color: '#fff',
    fontFamily: TYPE.titleFamily,
    fontSize: TYPE.bodySize,
  },
  depositDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: SemanticColors.feedbackSuccess + '12',
    borderRadius: RADIUS.md,
    padding: Spacing.md,
  },
  depositDoneText: {
    flex: 1,
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textPrimary,
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
