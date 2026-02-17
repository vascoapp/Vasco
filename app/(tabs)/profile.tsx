import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { useAppState } from '../../src/state/AppState';
import { useAuth } from '../../src/context/AuthContext';
import { SemanticColors } from '../../src/theme/colors';
import { Radius } from '../../src/theme/radius';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';

export default function ProfileScreen() {
  const router = useRouter();
  const { moneybirdConnected, mollieConnected, businessProfile, customers } = useAppState();
  const { user, roleConfig, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  const integrations = [
    {
      name: 'Moneybird',
      description: 'Accounting & invoices',
      connected: moneybirdConnected,
      route: '/(modals)/moneybird',
    },
    {
      name: 'Mollie',
      description: 'Payment processing',
      connected: mollieConnected,
      route: '/(modals)/mollie',
    },
  ];

  const primaryColor = roleConfig?.primaryColor || SemanticColors.actionPrimary;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        {/* User Header Card */}
        <View style={[styles.userCard, { borderColor: primaryColor + '30' }]}>
          <View style={[styles.avatarContainer, { backgroundColor: primaryColor + '20' }]}>
            <Text style={[styles.avatarText, { color: primaryColor }]}>
              {user?.name.split(' ').map(n => n[0]).join('')}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <View style={[styles.roleBadge, { backgroundColor: primaryColor + '20' }]}>
              <Text style={[styles.roleBadgeText, { color: primaryColor }]}>
                {roleConfig?.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Role Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{roleConfig?.title}</Text>
          <Text style={styles.roleDescription}>{roleConfig?.description}</Text>

          <View style={styles.featureList}>
            {roleConfig?.features.slice(0, 4).map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={16} color={primaryColor} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Account Details */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Account details</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Company</Text>
            <Text style={styles.fieldValue}>{user?.company}</Text>
          </View>
          <View style={[styles.field, styles.fieldBorder]}>
            <Text style={styles.fieldLabel}>Projects</Text>
            <Text style={styles.fieldValue}>{user?.projects.length} active</Text>
          </View>
          <View style={[styles.field, styles.fieldBorder]}>
            <Text style={styles.fieldLabel}>User ID</Text>
            <Text style={[styles.fieldValue, styles.fieldValueMuted]}>{user?.id}</Text>
          </View>
        </View>

        {/* Business Settings */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Business settings</Text>
        </View>

        <View style={styles.card}>
          <Pressable
            style={styles.menuItem}
            onPress={() => router.push('/(modals)/business-settings' as never)}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="business-outline" size={20} color={SemanticColors.textPrimary} />
              <View>
                <Text style={styles.menuItemText}>Bedrijfsgegevens</Text>
                <Text style={{ color: SemanticColors.textSecondary, fontSize: 12 }}>
                  {businessProfile.completenessPercent}% compleet
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SemanticColors.textSecondary} />
          </Pressable>
          <Pressable
            style={[styles.menuItem, styles.menuItemBorder]}
            onPress={() => router.push('/(modals)/customers' as never)}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="people-outline" size={20} color={SemanticColors.textPrimary} />
              <View>
                <Text style={styles.menuItemText}>Klanten</Text>
                <Text style={{ color: SemanticColors.textSecondary, fontSize: 12 }}>
                  {customers.length} klanten
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SemanticColors.textSecondary} />
          </Pressable>
        </View>

        {/* Integrations */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Integrations</Text>
        </View>

        <View style={styles.integrationList}>
          {integrations.map((integration) => (
            <Pressable
              key={integration.name}
              style={({ pressed }) => [
                styles.integrationCard,
                integration.connected && styles.integrationCardConnected,
                pressed && styles.cardPressed,
              ]}
              onPress={() => router.push(integration.route as never)}
            >
              <View style={styles.integrationInfo}>
                <Text style={styles.integrationName}>{integration.name}</Text>
                <Text style={styles.integrationDesc}>{integration.description}</Text>
              </View>
              <View style={[
                styles.integrationStatus,
                integration.connected ? styles.integrationStatusActive : styles.integrationStatusInactive,
              ]}>
                <Text style={[
                  styles.integrationStatusText,
                  integration.connected && styles.integrationStatusTextActive,
                ]}>
                  {integration.connected ? 'Connected' : 'Connect'}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Certificaten & Documenten (for contractors) */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Documenten</Text>
        </View>

        <View style={styles.card}>
          <Pressable
            style={styles.menuItem}
            onPress={() => router.push('/(contractor)/certificaten' as never)}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="ribbon-outline" size={20} color={SemanticColors.textPrimary} />
              <Text style={styles.menuItemText}>Certificaten en documenten</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SemanticColors.textSecondary} />
          </Pressable>
        </View>

        {/* Settings */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Settings</Text>
        </View>

        <View style={styles.card}>
          <Pressable style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="notifications-outline" size={20} color={SemanticColors.textPrimary} />
              <Text style={styles.menuItemText}>Notifications</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SemanticColors.textSecondary} />
          </Pressable>
          <Pressable style={[styles.menuItem, styles.menuItemBorder]}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="shield-outline" size={20} color={SemanticColors.textPrimary} />
              <Text style={styles.menuItemText}>Privacy settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SemanticColors.textSecondary} />
          </Pressable>
          <Pressable style={[styles.menuItem, styles.menuItemBorder]}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="help-circle-outline" size={20} color={SemanticColors.textPrimary} />
              <Text style={styles.menuItemText}>Help & Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SemanticColors.textSecondary} />
          </Pressable>
        </View>

        {/* Logout Button */}
        <Pressable
          style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color={SemanticColors.feedbackError} />
          <Text style={styles.logoutButtonText}>Sign Out</Text>
        </Pressable>

        {/* Version Info */}
        <Text style={styles.versionText}>Vasco BuildOS v1.0.0</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: 100,
  },
  sectionLabel: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '500',
  },
  sectionHeader: {
    marginTop: Spacing.sm,
  },
  userCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
    gap: 4,
  },
  userName: {
    color: SemanticColors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  userEmail: {
    color: SemanticColors.textSecondary,
    fontSize: 14,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    marginTop: 4,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
  },
  cardTitle: {
    color: SemanticColors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  roleDescription: {
    color: SemanticColors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  featureList: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
  },
  field: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  fieldBorder: {
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    paddingTop: Spacing.md,
    marginTop: Spacing.xs,
  },
  fieldLabel: {
    color: SemanticColors.textSecondary,
    fontSize: 14,
  },
  fieldValue: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  fieldValueMuted: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
  },
  integrationList: {
    gap: Spacing.sm,
  },
  integrationCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  integrationCardConnected: {
    backgroundColor: SemanticColors.feedbackSuccess + '08',
    borderColor: SemanticColors.feedbackSuccess + '25',
  },
  cardPressed: {
    opacity: 0.85,
  },
  integrationInfo: {
    gap: 2,
  },
  integrationName: {
    color: SemanticColors.textPrimary,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  integrationDesc: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  integrationStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  integrationStatusActive: {
    backgroundColor: SemanticColors.feedbackSuccess + '20',
  },
  integrationStatusInactive: {
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  integrationStatusText: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  integrationStatusTextActive: {
    color: SemanticColors.feedbackSuccess,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  menuItemBorder: {
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    paddingTop: Spacing.md,
    marginTop: Spacing.xs,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemText: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: SemanticColors.feedbackError + '15',
    borderRadius: Radius.md,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackError + '30',
    minHeight: 44,
  },
  logoutButtonText: {
    color: SemanticColors.feedbackError,
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.8,
  },
  versionText: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
