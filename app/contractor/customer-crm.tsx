// =============================================================================
// KLANTEN — Phonebook-style contact list
// =============================================================================
// Find a customer fast. Call, email, or create a quote with one tap.
// No CRM dashboards, no metrics grids — just contacts.
// =============================================================================

import { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Linking, TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { DK } from '../../src/theme/draftkings';
import { SafeArea } from '../../src/theme/spacing';
import { useAppState } from '../../src/state/AppState';
import { hapticSuccess } from '../../src/utils/haptics';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { CustomerTagBadge } from '../../src/components/contractor/CustomerTagBadge';
import { scoreAllCustomers } from '../../src/services/customerTaggingService';
import { formatMoney } from '../../src/i18n/formatting';
import { AddCustomerSheet } from '../../src/components/shared/AddCustomerSheet';

type IconName = keyof typeof Ionicons.glyphMap;

export default function CustomerPhonebookScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { customers, jobs, invoices } = useAppState();
  // R98 — `q` query param seeds the search filter so the AI bot's
  // find_customer intent lands here with the right list already
  // narrowed. Wired from app/contractor/ai-chat.tsx routeForIntent.
  const { q: aiSearchPrefill } = useLocalSearchParams<{ q?: string }>();
  const [search, setSearch] = useState(aiSearchPrefill ?? '');
  const [showAdd, setShowAdd] = useState(false);

  // Build contact list with job count + auto-tags
  const contacts = useMemo(() => {
    const profiles = scoreAllCustomers(
      customers as any,
      jobs as any,
      invoices as any,
    );
    return customers
      .map(c => ({
        ...c,
        initials: c.name.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase() || '').join(''),
        jobCount: jobs.filter(j => j.customerId === c.id).length,
        hasActive: jobs.some(j => j.customerId === c.id && ['scheduled', 'in-progress', 'accepted'].includes(j.status)),
        tag: profiles.get(c.id)?.tag,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, jobs, invoices]);

  // R51: search now also matches the auto-tag (`vip`, `loyal`, `risky`,
  // `inactive`, `new`) — was the R299 "tags don't gate behavior" gap.
  // Typing "vip" surfaces all VIP-tagged customers; "risky" surfaces
  // customers flagged late-payer / disputes by customerTaggingService.
  // Localized tag labels are matched too so a Dutch user typing "trouw"
  // finds "loyal" customers when the locale provides that translation.
  const filtered = useMemo(() => {
    if (!search) return contacts;
    const q = search.toLowerCase().trim();
    return contacts.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      if (c.phone?.toLowerCase().includes(q)) return true;
      if (c.email?.toLowerCase().includes(q)) return true;
      if (c.tag && c.tag.toLowerCase().includes(q)) return true;
      if (c.tag) {
        const localized = t(`customerCrm.tags.${c.tag}`, { defaultValue: c.tag });
        if (localized.toLowerCase().includes(q)) return true;
      }
      return false;
    });
  }, [contacts, search, t]);

  // Group alphabetically
  const grouped = useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    filtered.forEach(c => {
      const letter = c.name[0]?.toUpperCase() || '#';
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(c);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);


  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn} accessibilityRole="button" accessibilityLabel={t('common.back', 'Back')}>
          <Ionicons name="chevron-back" size={22} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>{t('contractor.customers.title', 'Customers')}</Text>
        <Pressable onPress={() => setShowAdd(true)} style={s.addBtn} accessibilityRole="button" accessibilityLabel={t('common.add', 'Add')}>
          <Ionicons name="add" size={22} color={Palette.white} />
        </Pressable>
      </View>

      {/* Search */}
      <View style={s.searchBar}>
        <Ionicons name="search" size={18} color={SemanticColors.textTertiary} />
        <TextInput
          style={s.searchInput}
          placeholder={t('contractor.customers.searchPlaceholder', 'Search by name, phone or email...')}
          placeholderTextColor={SemanticColors.placeholder}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={SemanticColors.textTertiary} />
          </Pressable>
        )}
      </View>

      {/* Contact list */}
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag">
        {grouped.map(([letter, group]) => (
          <View key={letter}>
            <Text style={s.sectionLetter}>{letter}</Text>
            {group.map(contact => (
              <Pressable
                key={contact.id}
                style={({ pressed }) => [s.contactRow, pressed && { opacity: 0.9 }]}
                // R15.1 sent this to global search pre-filled with the name
                // (customer-view is the customer PORTAL and ignored ?id=). The
                // customer detail screen — history, quotes, invoices, and the
                // edit button — is the customer; search matched any job, quote
                // or customer whose text merely contained the name.
                onPress={() => router.push(`/contractor/customer/${contact.id}` as any)}
                accessibilityRole="button"
                accessibilityLabel={contact.name}
              >
                {/* Avatar */}
                <View style={[s.avatar, contact.hasActive && s.avatarActive]}>
                  <Text style={s.avatarText}>{contact.initials}</Text>
                </View>

                {/* Name + subtitle */}
                <View style={s.contactInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: GRID.xs }}>
                    <Text style={s.contactName} numberOfLines={1}>{contact.name}</Text>
                    {contact.tag && contact.tag !== 'new' && <CustomerTagBadge tag={contact.tag} compact />}
                  </View>
                  <Text style={s.contactMeta} numberOfLines={1}>
                    {[
                      contact.jobCount > 0 ? t('contractor.customers.jobs', { count: contact.jobCount }) : null,
                      contact.phone,
                    ].filter(Boolean).join(' · ')}
                  </Text>
                  {(() => {
                    const custInvoices = invoices.filter((inv: any) => inv.customer === contact.id);
                    const totalInvoiced = custInvoices.reduce((sum: number, inv: any) => sum + (inv.total || inv.amount || 0), 0);
                    const outstanding = custInvoices.filter((inv: any) => inv.status !== 'paid').reduce((sum: number, inv: any) => sum + (inv.total || inv.amount || 0), 0);
                    if (totalInvoiced === 0 && contact.jobCount === 0) return null;
                    // R12.2: was hardcoded English "total" / "outstanding" labels.
                    return (
                      <Text style={s.contactFinancial} numberOfLines={1}>
                        {totalInvoiced > 0 ? t('contractor.customers.totalAmount', { defaultValue: '{{amount}} total', amount: formatMoney(totalInvoiced) }) : ''}
                        {outstanding > 0 ? ` · ${t('contractor.customers.outstandingAmount', { defaultValue: '{{amount}} outstanding', amount: formatMoney(outstanding) })}` : ''}
                      </Text>
                    );
                  })()}
                </View>

                {/* Quick actions — always visible */}
                <View style={s.actions}>
                  {contact.phone && (
                    <Pressable
                      style={s.actionIcon}
                      onPress={(e) => { e.stopPropagation?.(); Linking.openURL(`tel:${contact.phone}`); }}
                      hitSlop={6}
                     accessibilityRole="button" accessibilityLabel={t('common.call', 'Call')}>
                      <Ionicons name="call" size={16} color={SemanticColors.feedbackSuccess} />
                    </Pressable>
                  )}
                  {contact.email && (
                    <Pressable
                      style={s.actionIcon}
                      onPress={(e) => { e.stopPropagation?.(); Linking.openURL(`mailto:${contact.email}`); }}
                      hitSlop={6}
                     accessibilityRole="button" accessibilityLabel={t('common.email', 'Email')}>
                      <Ionicons name="mail" size={16} color={SemanticColors.feedbackInfo} />
                    </Pressable>
                  )}
                  <Pressable
                    style={s.actionIcon}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      hapticSuccess();
                      router.push(`/contractor/tiered-quote?customerId=${contact.id}&customerName=${encodeURIComponent(contact.name)}` as any);
                    }}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={t('quotes.newQuote', 'New quote')}
                  >
                    <Ionicons name="document-text" size={16} color={Palette.hermesOrange} />
                  </Pressable>
                </View>
              </Pressable>
            ))}
          </View>
        ))}

        {/* Empty state */}
        {contacts.length === 0 && (
          <View style={s.empty}>
            <Ionicons name="people-outline" size={40} color={SemanticColors.textTertiary} />
            <Text style={s.emptyTitle}>{t('contractor.customers.emptyTitle', 'No customers yet')}</Text>
            <Text style={s.emptyDesc}>{t('contractor.customers.emptyDesc', 'Add your first customer')}</Text>
            <Pressable onPress={() => setShowAdd(true)} style={s.emptyBtnWrap}>
              <LinearGradient
                colors={DK.effects.ctaGradient as unknown as readonly [string, string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.emptyBtn}
              >
                <Text style={s.emptyBtnText}>{t('contractor.customers.addCustomer', 'Add customer')}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}

        {filtered.length === 0 && contacts.length > 0 && (
          <View style={s.empty}>
            <Ionicons name="search-outline" size={32} color={SemanticColors.textTertiary} />
            <Text style={s.emptyTitle}>{t('contractor.customers.noResults', 'No results')}</Text>
            <Text style={s.emptyDesc}>{t('contractor.customers.tryDifferentSearch', 'Try a different search term')}</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* THE customer form — plan limit, validation, duplicate check, VAT id
          and the market's e-invoice fields in one place (#365). */}
      <AddCustomerSheet visible={showAdd} onClose={() => setShowAdd(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SafeArea.top,
    paddingHorizontal: SafeArea.side,
    paddingBottom: GRID.sm,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: SemanticColors.surfacePrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontSize: TYPE.displaySize,
    fontFamily: TYPE.displayFamily,
    color: SemanticColors.textPrimary,
     textTransform: 'uppercase', letterSpacing: 1.2 },
  // R66r53: align with DK CTA glow tokens
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center', justifyContent: 'center',
    ...DK.effects.ctaShadow,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: SafeArea.side,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: GRID.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
    padding: 0,
  },

  // Scroll
  scroll: { flex: 1, paddingHorizontal: SafeArea.side },

  // Section letter
  sectionLetter: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textTertiary,
    marginTop: GRID.md,
    marginBottom: GRID.xs,
    marginLeft: 4,
  },

  // Contact row — phonebook style
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 4,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Palette.hermesOrange + '12',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarActive: {
    borderWidth: 2,
    borderColor: Palette.hermesOrange,
  },
  avatarText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.sectionFamily,
    color: Palette.hermesOrange,
  },
  contactInfo: { flex: 1 },
  contactName: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  contactMeta: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textSecondary,
    marginTop: 1,
  },
  contactFinancial: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: Palette.hermesOrange,
    marginTop: 1,
  },

  // Quick actions — always visible
  actions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center', justifyContent: 'center',
  },

  // Empty state
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  emptyDesc: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textSecondary,
  },
  // R66r53: DK canonical CTA gradient pill
  emptyBtnWrap: {
    borderRadius: RADIUS.full,
    marginTop: 8,
    ...DK.effects.ctaShadow,
  },
  emptyBtn: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emptyBtnText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: Palette.white,
  },

});
