import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../../src/components/Screen';
import {
  CFODashboard,
  COODashboard,
  SiteLeadDashboard,
} from '../../../src/components/dashboards';
import { Colors } from '../../../src/theme/colors';
import { Radius } from '../../../src/theme/radius';
import { Spacing } from '../../../src/theme/spacing';

type Role = 'cfo' | 'coo' | 'site';

const roles: { id: Role; label: string; title: string; description: string }[] = [
  {
    id: 'cfo',
    label: 'CFO',
    title: 'Finance Control',
    description: 'Cash flow, cost control, valuations',
  },
  {
    id: 'coo',
    label: 'COO',
    title: 'Delivery Control',
    description: 'Schedule, permits, procurement',
  },
  {
    id: 'site',
    label: 'Site',
    title: 'Execution',
    description: 'Daily planning, safety, blockers',
  },
];

export default function ProjectsScreen() {
  const [role, setRole] = useState<Role>('cfo');
  const currentRole = roles.find((r) => r.id === role)!;

  const renderDashboard = () => {
    switch (role) {
      case 'cfo':
        return <CFODashboard />;
      case 'coo':
        return <COODashboard />;
      case 'site':
        return <SiteLeadDashboard />;
    }
  };

  return (
    <Screen>
      {/* Role Selector */}
      <View style={styles.roleContainer}>
        <View style={styles.roleSwitch}>
          {roles.map((item) => {
            const selected = item.id === role;
            return (
              <Pressable
                key={item.id}
                onPress={() => setRole(item.id)}
                style={[styles.rolePill, selected && styles.rolePillActive]}
              >
                <Text style={[styles.roleLabel, selected && styles.roleLabelActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Current Role Info */}
        <View style={styles.roleInfo}>
          <Text style={styles.roleTitle}>{currentRole.title}</Text>
          <Text style={styles.roleDescription}>{currentRole.description}</Text>
        </View>
      </View>

      {renderDashboard()}
    </Screen>
  );
}

const styles = StyleSheet.create({
  roleContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  roleSwitch: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rolePill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.md,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  rolePillActive: {
    backgroundColor: Colors.surfaceElevated,
  },
  roleLabel: {
    color: Colors.muted,
    fontWeight: '600',
    fontSize: 14,
  },
  roleLabelActive: {
    color: Colors.text,
  },
  roleInfo: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  roleTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  roleDescription: {
    color: Colors.muted,
    fontSize: 12,
  },
});
