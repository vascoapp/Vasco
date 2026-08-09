// =============================================================================
// CREW — Multi-tech roster (R86 US Phase 5 — crew dispatch lite)
// =============================================================================
// Solo contractors see the empty state and a "you're solo today" message.
// Multi-tech crews use this screen to add/edit workers; assignment to
// jobs happens inline on the job detail screen (separate edit).
//
// Lite scope: no GPS, no shifts, no payroll integration. Just the
// roster entity + role + active flag + per-tech cost. Job assignment
// flows through Job.assignedWorkerId on the job-detail screen.
// =============================================================================

import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useAppState } from '../../src/state/AppState';
import type { Worker, WorkerRole } from '../../src/domain/worker';
import { SemanticColors } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { DK } from '../../src/theme/draftkings';
import { currencySymbol } from '../../src/i18n/formatting';
import { useAuth } from '../../src/context/AuthContext';

// Was a module-scope Record of English strings, evaluated at import time before
// any language existed, so a Dutch contractor with a team read "Lead Tech"
// (learnings #86). This screen is gated on TEAM SIZE, not country, so it is
// fully reachable outside the US.
const ROLE_FALLBACK: Record<WorkerRole, string> = {
  owner: 'Owner',
  lead_tech: 'Lead Tech',
  tech: 'Tech',
  apprentice: 'Apprentice',
  subcontractor: 'Subcontractor',
};
type TFunc = (k: string, o?: Record<string, unknown>) => string;
const roleLabel = (t: TFunc, r: WorkerRole): string =>
  t(`crew.roles.${r}`, { defaultValue: ROLE_FALLBACK[r] });

const ROLES: WorkerRole[] = ['owner', 'lead_tech', 'tech', 'apprentice', 'subcontractor'];

const ROLE_TONE: Record<WorkerRole, string> = {
  owner: DK.colors.accent,
  lead_tech: DK.colors.highlight,
  tech: '#3B82F6',
  apprentice: '#9CA3AF',
  subcontractor: '#A78BFA',
};

export default function CrewScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const { workers, addWorker, updateWorker, removeWorker, jobs } = useAppState();

  const [editing, setEditing] = useState<Worker | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const activeWorkers = workers.filter((w) => w.isActive);
  const inactiveWorkers = workers.filter((w) => !w.isActive);

  const jobCountFor = (workerId: string) =>
    jobs.filter((j) => j.assignedWorkerId === workerId && j.status !== 'completed' && j.status !== 'paid').length;

  const handleSave = async (data: Omit<Worker, 'id' | 'createdAt' | 'updatedAt'>, original?: Worker) => {
    if (original) {
      await updateWorker(original.id, data);
    } else {
      try {
        const { loadSubscription, canAddTeamMember } = await import('../../src/services/subscriptionService');
        const sub = await loadSubscription();
        const gate = canAddTeamMember(sub, workers.length);
        if (!gate.allowed) {
          Alert.alert(
            t('billing.upgradeRequired', 'Upgrade required'),
            gate.reason,
            [
              { text: t('common.cancel', 'Cancel'), style: 'cancel' },
              { text: t('billing.viewPlans', 'View plans'), onPress: () => router.push('/contractor/profile' as any) },
            ],
          );
          return;
        }
      } catch {}
      await addWorker(data);
    }
    setEditing(null);
    setShowAdd(false);
  };

  const handleDelete = (worker: Worker) => {
    const openCount = jobCountFor(worker.id);
    const msg = openCount > 0
      ? t('crew.deleteWithJobs', { defaultValue: '{{name}} has {{count}} open jobs assigned. Remove anyway? Jobs will be unassigned.', name: worker.name, count: openCount })
      : t('crew.deleteSure', { defaultValue: 'Remove {{name}} from the crew?', name: worker.name });
    Alert.alert(
      t('crew.delete', 'Remove worker'),
      msg as string,
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Remove'),
          style: 'destructive',
          onPress: async () => {
            await removeWorker(worker.id);
            setEditing(null);
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('crew.title', 'Crew')}</Text>
        <Pressable onPress={() => setShowAdd(true)} style={styles.backBtn}>
          <Ionicons name="add" size={26} color={DK.colors.accent} />
        </Pressable>
      </View>

      {workers.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={48} color={SemanticColors.textTertiary} />
          {/* An AANNEMER runs crews across several sites — telling them "solo
              contractors don't need this screen" dismisses the feature to the
              exact customer it exists for. The solo copy stays for solo
              contractors, who genuinely don't need it. */}
          <Text style={styles.emptyTitle}>
            {user?.isAannemer ? t('crew.emptyAannemer') : t('crew.empty', "You're solo today")}
          </Text>
          <Text style={styles.emptyBody}>
            {user?.isAannemer
              ? t('crew.emptyBodyAannemer')
              : t('crew.emptyBody', 'Add crew members here once you have techs working under you. Solo contractors don\'t need this screen.')}
          </Text>
          <Pressable style={styles.emptyCta} onPress={() => setShowAdd(true)}>
            <Ionicons name="person-add" size={20} color={DK.colors.accent} />
            <Text style={styles.emptyCtaText}>{t('crew.addFirst', 'Add first crew member')}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: GRID.lg, paddingBottom: GRID.xl * 2 }}>
          {activeWorkers.map((w) => {
            const openCount = jobCountFor(w.id);
            return (
              <Pressable key={w.id} style={styles.card} onPress={() => setEditing(w)}>
                <View style={[styles.roleDot, { backgroundColor: w.color ?? ROLE_TONE[w.role] }]}>
                  <Text style={styles.roleDotText}>{w.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{w.name}</Text>
                  <Text style={styles.cardMeta}>
                    {roleLabel(t, w.role)}
                    {w.trade ? ` · ${t(`onboarding.trades.${w.trade}`, w.trade)}` : ''}
                  </Text>
                  {openCount > 0 ? (
                    <Text style={styles.cardJobs}>{t('crew.openJobs', { count: openCount, defaultValue: '{{count}} open jobs' })}</Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
              </Pressable>
            );
          })}

          {/* What the crew COSTS, from the same workers + logged hours this
              screen already manages. Its only other entry point is a link at
              the bottom of Timesheet, which is a strange place to look for it
              once you have people. */}
          <Pressable style={styles.payrollLink} onPress={() => router.push('/contractor/payroll' as any)}>
            <View style={styles.payrollIcon}>
              <Ionicons name="cash-outline" size={20} color={DK.colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.payrollTitle}>{t('payroll.title', 'Payroll')}</Text>
              <Text style={styles.payrollSub}>{t('crew.payrollSub', 'Hours and cost per person')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
          </Pressable>

          {inactiveWorkers.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>{t('crew.inactive', 'Inactive')}</Text>
              {inactiveWorkers.map((w) => (
                <Pressable key={w.id} style={[styles.card, styles.cardInactive]} onPress={() => setEditing(w)}>
                  <View style={[styles.roleDot, { backgroundColor: SemanticColors.borderDefault }]}>
                    <Text style={styles.roleDotText}>{w.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardName, { color: SemanticColors.textSecondary }]}>{w.name}</Text>
                    <Text style={styles.cardMeta}>{roleLabel(t, w.role)}</Text>
                  </View>
                </Pressable>
              ))}
            </>
          ) : null}
        </ScrollView>
      )}

      <WorkerModal
        visible={showAdd || editing !== null}
        original={editing ?? undefined}
        onClose={() => {
          setShowAdd(false);
          setEditing(null);
        }}
        onSave={handleSave}
        onDelete={editing ? () => handleDelete(editing) : undefined}
      />
    </SafeAreaView>
  );
}

interface WorkerModalProps {
  visible: boolean;
  original?: Worker;
  onClose: () => void;
  onSave: (data: Omit<Worker, 'id' | 'createdAt' | 'updatedAt'>, original?: Worker) => Promise<void>;
  onDelete?: () => void;
}

function WorkerModal({ visible, original, onClose, onSave, onDelete }: WorkerModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [name, setName] = useState(original?.name ?? '');
  const [role, setRole] = useState<WorkerRole>(original?.role ?? 'tech');
  const [email, setEmail] = useState(original?.email ?? '');
  const [phone, setPhone] = useState(original?.phone ?? '');
  const [trade, setTrade] = useState(original?.trade ?? '');
  const [hourlyCost, setHourlyCost] = useState(original?.hourlyCost?.toString() ?? '');
  const [isActive, setIsActive] = useState(original?.isActive ?? true);

  const canSave = name.trim().length > 0;

  const handleSave = () => {
    onSave({
      name: name.trim(),
      role,
      email: email || undefined,
      phone: phone || undefined,
      trade: trade || undefined,
      hourlyCost: hourlyCost ? Number(hourlyCost) : undefined,
      isActive,
      color: undefined,
    }, original);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.backBtn}>
            <Ionicons name="close" size={26} color={SemanticColors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {original ? t('crew.editWorker', 'Edit worker') : t('crew.addWorker', 'Add worker')}
          </Text>
          <Pressable disabled={!canSave} onPress={handleSave}>
            <Text style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}>
              {t('common.save', 'Save')}
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: GRID.lg }}>
          <Text style={styles.label}>{t('crew.name', 'Name *')}</Text>
          <TextInput value={name} onChangeText={setName} placeholder={t('crew.namePlaceholder', 'Name')} placeholderTextColor={SemanticColors.textTertiary} style={styles.input} />

          <Text style={styles.label}>{t('crew.role', 'Role')}</Text>
          <View style={styles.roleGrid}>
            {ROLES.map((r) => {
              const selected = role === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => setRole(r)}
                  style={[styles.roleChip, selected && styles.roleChipSelected]}
                >
                  <Text style={[styles.roleChipText, selected && styles.roleChipTextSelected]}>
                    {roleLabel(t, r)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>{t('crew.email', 'Email')}</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="mike@example.com" placeholderTextColor={SemanticColors.textTertiary} style={styles.input} keyboardType="email-address" autoCapitalize="none" />

          <Text style={styles.label}>{t('crew.phone', 'Phone')}</Text>
          <TextInput value={phone} onChangeText={setPhone} placeholder="+1 555 0123" placeholderTextColor={SemanticColors.textTertiary} style={styles.input} keyboardType="phone-pad" />

          <Text style={styles.label}>{t('crew.trade', 'Trade specialty')}</Text>
          <TextInput value={trade} onChangeText={setTrade} placeholder="HVAC / electrical / plumbing…" placeholderTextColor={SemanticColors.textTertiary} style={styles.input} />

          <Text style={styles.label}>{t('crew.hourlyCostSym', 'Hourly cost to you ({{sym}})', { sym: currencySymbol(user?.country as never) })}</Text>
          <TextInput value={hourlyCost} onChangeText={setHourlyCost} placeholder="35" placeholderTextColor={SemanticColors.textTertiary} style={styles.input} keyboardType="numeric" />

          <View style={styles.activeRow}>
            <Text style={styles.activeLabel}>{t('crew.active', 'Active on payroll')}</Text>
            <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: DK.colors.accent }} />
          </View>

          {original && onDelete ? (
            <Pressable onPress={onDelete} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={18} color="#FECACA" />
              <Text style={styles.deleteBtnText}>{t('crew.delete', 'Remove worker')}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: GRID.md, paddingVertical: GRID.sm,
    borderBottomWidth: 1, borderBottomColor: SemanticColors.borderDefault,
  },
  backBtn: { padding: GRID.xs },
  headerTitle: {
    fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2,
  },
  saveBtn: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: DK.colors.accent, paddingHorizontal: GRID.sm },
  saveBtnDisabled: { opacity: 0.4 },
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: GRID.xl, gap: GRID.md,
  },
  emptyTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  emptyBody: {
    fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textSecondary,
    textAlign: 'center', maxWidth: 320,
  },
  emptyCta: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.sm,
    paddingHorizontal: GRID.lg, paddingVertical: GRID.md,
    borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: `${DK.colors.accent}66`,
    backgroundColor: `${DK.colors.accent}11`,
  },
  emptyCtaText: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: DK.colors.accent },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.md,
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: SemanticColors.borderDefault,
    padding: GRID.md, marginBottom: GRID.sm,
  },
  cardInactive: { opacity: 0.55 },
  payrollLink: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.md,
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: DK.colors.accent + '33',
    padding: GRID.md, marginTop: GRID.md,
  },
  payrollIcon: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: DK.colors.accent + '1A',
  },
  payrollTitle: { fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  payrollSub: { fontSize: TYPE.captionSize, color: SemanticColors.textSecondary, marginTop: 2 },
  roleDot: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  roleDotText: { color: '#fff', fontFamily: TYPE.titleFamily, fontSize: 18 },
  cardName: { fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  cardMeta: { fontSize: TYPE.captionSize, color: SemanticColors.textSecondary, marginTop: 2 },
  cardJobs: { fontSize: TYPE.captionSize, color: DK.colors.highlight, marginTop: 4, fontFamily: TYPE.labelFamily },
  sectionLabel: {
    marginTop: GRID.lg, marginBottom: GRID.sm,
    fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary, textTransform: 'uppercase', letterSpacing: 1,
  },
  label: {
    fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: GRID.xs, marginTop: GRID.md,
  },
  input: {
    backgroundColor: SemanticColors.surfacePrimary, borderWidth: 1,
    borderColor: SemanticColors.borderDefault, borderRadius: RADIUS.md,
    paddingHorizontal: GRID.md, paddingVertical: GRID.sm,
    fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textPrimary,
  },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID.sm },
  roleChip: {
    paddingHorizontal: GRID.md, paddingVertical: GRID.sm,
    borderRadius: RADIUS.md, backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 1, borderColor: SemanticColors.borderDefault,
  },
  roleChipSelected: { borderColor: DK.colors.accent, backgroundColor: `${DK.colors.accent}22` },
  roleChipText: { fontSize: TYPE.bodySize, fontFamily: TYPE.labelFamily, color: SemanticColors.textPrimary },
  roleChipTextSelected: { color: DK.colors.accent, fontFamily: TYPE.titleFamily },
  activeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: GRID.lg, paddingVertical: GRID.sm,
  },
  activeLabel: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  deleteBtn: {
    marginTop: GRID.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: GRID.sm, paddingVertical: GRID.md,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: '#7F1D1D',
    backgroundColor: '#7F1D1D22',
  },
  deleteBtnText: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: '#FECACA' },
});
