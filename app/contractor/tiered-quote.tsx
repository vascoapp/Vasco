import { useRef, useMemo, useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Alert, View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { TieredQuoteBuilder } from '../../src/components/contractor';
import { useAppState } from '../../src/state/AppState';
import { hapticSuccess } from '../../src/utils/haptics';
import { ensureCanCreate } from '../../src/services/tierGatePrompt';
import { DK } from '../../src/theme/draftkings';
import { TYPE, GRID } from '../../src/theme/tabStyles';
import { DKScreenHeader } from '../../src/components/shared/DKScreenHeader';
import { DKMenu } from '../../src/components/shared/DKMenu';
import { DKLabel } from '../../src/components/shared/DKLabel';
import { AddCustomerSheet } from '../../src/components/shared/AddCustomerSheet';

export default function TieredQuoteScreen() {
  const router = useRouter();
  const { addQuote, updateQuote, updateJobStatus, customers, quotes, jobs, isLoading } = useAppState();
  const { t } = useTranslation();
  const sendingRef = useRef(false);

  // R300: prefill customer when reached via R286 executor's draft_quote route
  // (e.g. EVE analyst, customer-question handoff). Looks up by customerId
  // param so the builder opens scoped to the right customer.
  const params = useLocalSearchParams<{ customerId?: string; jobId?: string; templateId?: string }>();
  // `jobId` was declared and never read: the job screen's "Angebot erstellen"
  // could not hand its job over, so it flipped the job to "Angebot" and made
  // no quote at all (German device walk, 2026-09-14). The job now supplies the
  // customer when the caller did not, and names the quote.
  const linkedJob = useMemo(
    () => (params.jobId ? jobs.find((j) => j.id === params.jobId) : undefined),
    [params.jobId, jobs],
  );
  // WHO the quote is for is asked FIRST. Every generic entry point (Geld,
  // Werk, Facturen, Vandaag, the activation checklist — about fifteen) opens
  // this screen with no customer, and the builder has no picker of its own:
  // a first-time contractor filled in an entire quote and was only then told
  // "No customer attached", with Cancel or Create anyway and no way to add one
  // (TestFlight, 2026-09-22). Asking here covers every caller at once.
  const [chosenCustomerId, setChosenCustomerId] = useState<string | null>(null);
  const [skippedCustomer, setSkippedCustomer] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);

  const prefillCustomer = useMemo(() => {
    const id = params.customerId ?? linkedJob?.customerId ?? chosenCustomerId ?? undefined;
    if (!id) return undefined;
    return customers.find((c: any) => c.id === id) as any;
  }, [params.customerId, linkedJob?.customerId, chosenCustomerId, customers]);

  // A caller that NAMED a customer or a job keeps its old behaviour, even if
  // that record is gone — this step is for "no customer was given".
  const callerNamedOne = !!(params.customerId || linkedJob?.customerId);
  const askForCustomer = !callerNamedOne && !prefillCustomer && !skippedCustomer;
  const hasCustomers = customers.length > 0;

  // No customers at all: go straight to adding the first one, once. Closing
  // the sheet leaves the step on screen with the same button, never a loop.
  const autoOpened = useRef(false);
  useEffect(() => {
    // Not while customers are still loading: on a cold start an existing
    // contractor would be handed "add your first customer" (review).
    if (askForCustomer && !hasCustomers && !isLoading && !autoOpened.current) {
      autoOpened.current = true;
      setShowAddCustomer(true);
    }
  }, [askForCustomer, hasCustomers, isLoading]);

  if (askForCustomer) {
    return (
      <View style={cs.root}>
        <DKScreenHeader title={t('dk.actions.newQuote', 'New quote')} />
        <View style={cs.body}>
          <Ionicons name="person-add-outline" size={40} color={DK.colors.textMuted} />
          <DKLabel style={cs.heading}>{t('tieredQuote.whoIsItFor', 'Who is this quote for?')}</DKLabel>
          {hasCustomers ? (
            <View style={cs.menuWrap}>
              {/* One-of-N → a balloon menu, never a chip strip (CLAUDE.md). */}
              <DKMenu
                accessibilityLabel={t('jobs.selectCustomer', 'Select customer')}
                items={[
                  ...(customers as { id: string; name: string; phone?: string }[]).map((c) => ({
                    key: c.id,
                    label: c.name,
                    detail: c.phone,
                    onPress: () => setChosenCustomerId(c.id),
                  })),
                  {
                    key: '__new__',
                    label: t('dk.actions.newCustomer', 'New customer'),
                    icon: 'add' as const,
                    emphasis: true,
                    onPress: () => setShowAddCustomer(true),
                  },
                ]}
                renderAnchor={(open) => (
                  <Pressable style={cs.anchor} onPress={open} accessibilityRole="button">
                    <Ionicons name="person-outline" size={16} color={DK.colors.text} />
                    <Text style={cs.anchorText} numberOfLines={1}>{t('jobs.selectCustomer', 'Select customer')}</Text>
                    <Ionicons name="chevron-down" size={16} color={DK.colors.text} />
                  </Pressable>
                )}
              />
            </View>
          ) : (
            <>
              <Text style={cs.desc}>
                {t('tieredQuote.firstCustomerDesc', 'Add your customer first — the quote is made out to them and sent to them.')}
              </Text>
              <Pressable style={cs.primary} onPress={() => setShowAddCustomer(true)} accessibilityRole="button">
                <LinearGradient colors={[DK.colors.primaryDark, DK.colors.primary, DK.colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                <DKLabel style={cs.primaryText}>{t('dk.actions.newCustomer', 'New customer')}</DKLabel>
              </Pressable>
            </>
          )}
          <Pressable onPress={() => setSkippedCustomer(true)} hitSlop={8} accessibilityRole="button">
            <Text style={cs.skip}>{t('tieredQuote.continueWithoutCustomer', 'Continue without a customer')}</Text>
          </Pressable>
        </View>
        <AddCustomerSheet
          visible={showAddCustomer}
          onClose={() => setShowAddCustomer(false)}
          onAdded={(id) => setChosenCustomerId(id)}
        />
      </View>
    );
  }

  return (
    <TieredQuoteBuilder
      customer={prefillCustomer}
      initialTemplateId={params.templateId}
      onSend={async (quote) => {
        if (sendingRef.current) return;
        sendingRef.current = true;

        const tiers = (quote.tiers ?? []).filter((ti: any) => ti && Array.isArray(ti.lineItems) && ti.lineItems.length > 0);
        if (tiers.length === 0) {
          Alert.alert(t('tieredQuote.error'), t('tieredQuote.noItems'));
          sendingRef.current = false;
          return;
        }

        const sendTier = async (tier: any) => {
          const lineItems = (tier.lineItems ?? []).map((item: any) => ({
            id: `li-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            description: item.description || item.name || 'Item',
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice || item.price || 0,
            // The rate the tier was PRICED at — the builder resolves it
            // (exempt / reduced opt-in / country standard) and showed the
            // customer a total computed with it. This map used to drop it, so
            // `addQuote` re-rated every line at the profile's standard rate: a
            // Dutch 9% quote was saved, exported and invoiced at 21% (#253's
            // shape, one screen further along).
            vatRate: item.vatRate ?? tier.vatRate,
          }));
          if (lineItems.length === 0) {
            Alert.alert(t('tieredQuote.error'), t('tieredQuote.noItems'));
            return;
          }
          const tierTotal = lineItems.reduce((sum: number, li: any) => sum + li.unitPrice * li.quantity, 0);
          if (tierTotal <= 0) {
            Alert.alert(t('tieredQuote.error'), t('tieredQuote.zeroAmount', 'Quote total must be greater than zero.'));
            return;
          }
          try {
            // R13.2: was always passing the literal i18n string "Customer" /
            // "Klant" as the customer arg. AppState.addQuote stores this as
            // customer_id, so the resulting quote couldn't be linked back to
            // the actual customer — even when prefillCustomer (R300) was
            // loaded. Now thread the prefill customer id when present.
            const customerArg = prefillCustomer?.id ?? t('tieredQuote.customer');
            // R21: also gate via R304's quoteValidationGate so the tiered-quote
            // path gets the same warnings (zero-priced items, possible
            // duplicate, unknown VAT) the /quotes/new path has had since R304.
            // Was R2 deferral — the validator was wired in AppState.addQuote
            // but always proceeded with `// Still allow creation`.
            // Tier cap FIRST — this is the DEFAULT "new quote" destination
            // (the + on the invoices tab and the AI queue's draft_quote both
            // land here), and it was the one quote path with no gate at all,
            // while /quotes/new — the secondary route — had one.
            if (!(await ensureCanCreate('quote', quotes))) return;
            const { gateQuoteValidation } = await import('../../src/services/quoteValidationGate');
            const ok = await gateQuoteValidation(
              { customer: customerArg, amount: tierTotal, lineItems },
              quotes,
            );
            if (!ok) return;
            // `addQuote`'s second argument is the quote's `job` — the label
            // every list, the invoice converted from it, and the AI queue read
            // back. It was the TIER NAME, so every document a contractor made
            // through this builder was called "Basis" / "Standard" / "Premium":
            // a customer with three quotes saw the same title three times, the
            // queue offered "XRechnung: Standard", and the package name says
            // nothing about the work. The package is not lost — the customer
            // receives ONE quote whose LINES are the package (see
            // memory/quote-flow-consolidation.md), and those are stored.
            // Name the work instead, in the contractor's own wording.
            const first = lineItems[0]?.description?.trim();
            const jobLabel = linkedJob?.title?.trim() ? linkedJob.title.trim() : !first
              ? (tier.name || t('tieredQuote.quoteLabel'))
              : lineItems.length > 1
                ? t('tieredQuote.jobLabelMore', {
                    defaultValue: '{{first}} +{{count}}',
                    first,
                    count: lineItems.length - 1,
                  })
                : first;
            const quoteId = await addQuote(customerArg, jobLabel, lineItems);
            // The job reaches "quoted" because a quote now EXISTS — never on a
            // button press. Only a lead moves: a job further along keeps its
            // stage when a second quote is drafted for it.
            if (linkedJob && linkedJob.status === 'lead') {
              updateJobStatus(linkedJob.id, 'quoted');
            }
            // Close the learning loop. Line corrections are captured while the
            // contractor edits — BEFORE a quote exists — so they were written
            // with quote_id = null and could never be joined to whether the
            // quote was won. Without that join the moat can only learn to
            // imitate edits, never whether the edited price still won the job.
            // Fail-soft: a broken link must not fail sending a quote.
            import('../../src/services/reasonCodeService')
              .then((m) => m.attachQuoteIdToRecentDeltas(quoteId))
              .catch(() => {});
            // R62: persist the SOW narrative the contractor reviewed in the
            // builder's preview step. Threaded through TieredQuote.description
            // so we don't change addQuote's signature. updateDocument
            // dual-routes uuid vs docNumber per R57; quoteId here is the
            // FE docNumber form ("Q-260001") which BE matches via
            // document_number. Fail-soft so quote send doesn't fail just
            // because the SOW persist hit a flaky network.
            // R64 (audit fix #1): also update the in-memory Quote in AppState
            // so the immediately-following PDF share at /quotes/[id] sees
            // the SOW without waiting for refreshData. The mapper at
            // documentRowToQuote pulls scope_text → Quote.description on
            // refresh; we mirror that here for the optimistic path.
            const sow = (quote.description ?? '').trim();
            if (sow) {
              try {
                const { updateDocument } = await import('../../src/lib/dataProvider');
                await updateDocument(quoteId, { scope_text: sow });
              } catch {
                // Silent — local state still has it via TieredQuote.description.
              }
              // Local mirror: optimistic-update the FE Quote so the share-PDF
              // happy path doesn't require a refresh round-trip. updateQuote
              // is wired through R56's persistOrQueue, so this is also
              // queued for any second BE write that wants to land.
              try {
                // R66 round 21: was `as any` — Quote.description is a typed
                // domain field. updateQuote now persists it via the standard
                // mapper (description → scope_text), so the explicit
                // updateDocument call above is now redundant defense-in-depth.
                updateQuote(quoteId, { description: sow });
              } catch {}
            }
            hapticSuccess();
            Alert.alert(t('tieredQuote.quoteCreated'), t('tieredQuote.quoteSaved', { id: quoteId }), [
              { text: t('tieredQuote.viewQuote'), onPress: () => router.replace(`/quotes/${quoteId}` as any) },
              { text: t('common.close'), onPress: () => router.back() },
            ]);
          } catch (err) {
            Alert.alert(t('tieredQuote.error'), t('tieredQuote.couldNotSave'));
          }
        };

        // The package is chosen on the tier cards in the builder and arrives
        // as `quote.selectedTier`. It used to be asked again here, in an
        // Alert, on a screen that had just told the contractor "customer sees
        // three options" — one choice, made twice, and the first description
        // of it was false: the customer portal renders ONE quote with one set
        // of lines and never could show three.
        const chosen =
          tiers.find((ti: any) => ti.tier === (quote as any).selectedTier)
          ?? tiers[1]
          ?? tiers[0];
        try {
          await sendTier(chosen);
        } finally {
          sendingRef.current = false;
        }
      }}
      onClose={() => router.back()}
    />
  );
}

const cs = StyleSheet.create({
  root: { flex: 1, backgroundColor: DK.colors.bg },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: GRID.md, paddingHorizontal: GRID.lg, paddingBottom: GRID.xl },
  heading: { fontFamily: DK.type.display900, fontSize: TYPE.titleSize, color: DK.colors.text, letterSpacing: 1.8, textAlign: 'center' },
  desc: { fontFamily: DK.type.body400, fontSize: TYPE.captionSize, color: DK.colors.text, textAlign: 'center', maxWidth: 300 },
  // The menu's own wrapper sizes to content, so the width goes on a View
  // around it, not on the anchor (docs/ui-playbook.md §2).
  menuWrap: { alignSelf: 'stretch' },
  anchor: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: DK.colors.panel2,
    borderRadius: DK.radius.button,
    borderWidth: 1, borderColor: DK.colors.border,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  anchorText: { flex: 1, minWidth: 0, fontSize: TYPE.bodySize, fontFamily: DK.type.body500, color: DK.colors.text },
  primary: {
    borderRadius: DK.radius.button, overflow: 'hidden',
    paddingVertical: 14, paddingHorizontal: GRID.xl,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: DK.colors.accent, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 18, elevation: 10,
  },
  primaryText: { fontFamily: DK.type.display900, fontSize: TYPE.captionSize, color: DK.colors.text, letterSpacing: 1.4 },
  skip: { fontFamily: DK.type.body500, fontSize: TYPE.captionSize, color: DK.colors.text, textDecorationLine: 'underline', marginTop: GRID.sm },
});
