/**
 * REPO-WIDE: a horizontal chip strip is a FILTER, never a single choice.
 *
 * CLAUDE.md carries the rule in red — "🔴 NEVER build a chip/pill row as a
 * MENU" — with the reasoning spelled out: a strip hides every option past the
 * right edge, never says how many exist, and reads as a filter rather than a
 * choice. Learnings #221 records that the rule was still violated in
 * `permits.tsx`, where the strip showed TWO jobs (the second already clipped)
 * and the same data opened as a menu showed EIGHT, and concludes: "a convention
 * without a detector decays at the rate new screens are written."
 *
 * This is that detector, built from the candidate shape #221 proposed: a
 * horizontal ScrollView whose mapped children are Pressables that all call the
 * same `setX(...)` with different values.
 *
 * ── Why this one allowlists instead of failing outright ─────────────────────
 * The shape alone cannot tell a filter from a choice — and chips ARE correct
 * for filters and toggles, where every option should be visible at once and
 * more than one can be on. The rule's own test is "is the user choosing ONE
 * thing?", which is a judgement about meaning, not syntax. So every candidate
 * is classified here by hand, with the reason. A NEW strip fails the build
 * until someone classifies it — which is the point: the decision gets made
 * once, deliberately, rather than defaulting to whatever was easiest to type.
 *
 * A stale entry fails too, so this list cannot quietly rot into an exemption
 * blanket the way `scheduleMenuNotAlert`'s single-file scope did.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const ROOTS = ['app', 'src/components'];
const SKIP = ['node_modules', '__tests__', '__screenwalk__'];

/**
 * Strips that are legitimately FILTERS or TABS — every option visible at once,
 * nothing hidden behind a choice the user has to commit to. Keyed
 * `file :: setter`.
 */
const FILTERS_AND_TABS: Record<string, string> = {
  'app/contractor/projects.tsx :: setStatusFilter': 'Alle / Lopend / Afgerond — a filter, and the rule names this exact case as correct.',
  'app/contractor/quote-templates.tsx :: setSelectedCategory': 'Filters the template LIST. The template\'s own category is a form field and is a DKMenu.',
  'app/contractor/message-templates.tsx :: setSelectedCategory': 'Same: the list filter. The editor\'s category picker below it is a DKMenu.',
  'app/contractor/expenses.tsx :: setSelectedCategory': 'Filters the expense list. The expense FORM\'s category is a DKMenu (fixed 2026-08-24).',
  'app/contractor/reports.tsx :: setSelectedMonth': 'A month scrubber over a report. Reads as a range control, and the months are self-ordering.',
  'app/(contractor)/bedrijf.tsx :: setTab': 'Tab bar.',
  'app/(contractor)/ai.tsx :: setTab': 'Tab bar.',
  'app/(contractor)/werk.tsx :: setTab': 'Tab bar.',
  'src/components/contractor/DocumentVault.tsx :: setSelectedType': 'Filters the document list.',
  'src/components/contractor/PriceComparison.tsx :: setSelectedCategory': 'Filters the price list.',
  'src/components/contractor/ComplianceCenter.tsx :: setActiveTab': 'Tab bar.',
  'src/components/contractor/CashFlowDashboard.tsx :: setActiveTab': 'Tab bar.',
  'src/components/dashboards/MetricsDashboard.tsx :: setActiveTab': 'Tab bar.',
  'src/components/dashboards/BudgetOptimizerDashboard.tsx :: setFilterAction': 'Filters the action list.',
};

/** Not a choice among options at all — the setter just happens to match. */
const NOT_A_PICKER: Record<string, string> = {
  'app/(contractor)/werk.tsx :: setShowNewJob': 'Opens the new-job sheet. One button, not a set of options.',
  'src/components/customer/CustomerDecisionPortal.tsx :: setLightboxUri': 'Opens a photo full-screen. A gallery, not a picker.',
};

/**
 * Real violations of the rule that are NOT being fixed, each with the reason.
 * Reachability decides this: a strip on a surface that ships to nobody is dead
 * code, and #211 is explicit that the reachability question comes first.
 */
const UNREACHABLE: Record<string, string> = {
  'src/components/dashboards/TaxCalculatorDashboard.tsx :: setTaxBundesland': 'A real violation — SIXTEEN German states in a strip. Only reachable from app/(tabs)/hub/taxes.tsx, and `enterprise_portfolio` is false, so the hub ships to nobody (feedback_contractor_aannemer_only). Fix it if the hub is ever turned on.',
  'src/components/contractor/ComplianceCenter.tsx :: setSelectedTradeId': 'A real violation — picking ONE trade. The component is exported from the barrel and mounted by no screen (npm run audit:unmounted).',
  'app/hub/materials.tsx :: setSelectedCategory': 'A filter over the material list, and `app/hub/**` is the portfolio surface that ships to nobody either way.',
};

const CLASSIFIED = { ...FILTERS_AND_TABS, ...NOT_A_PICKER, ...UNREACHABLE };

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (SKIP.some((s) => p.includes(s))) continue;
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Each `<ScrollView …> … </ScrollView>` region, nesting-aware. */
function scrollViewBlocks(code: string): string[] {
  const out: string[] = [];
  for (const m of code.matchAll(/<ScrollView\b/g)) {
    let depth = 0;
    let end = -1;
    for (const o of code.slice(m.index!).matchAll(/<\/?ScrollView\b/g)) {
      const at = m.index! + o.index!;
      if (code.startsWith('</', at)) {
        depth -= 1;
        if (depth === 0) { end = at + o[0].length; break; }
      } else depth += 1;
    }
    if (end > 0) out.push(code.slice(m.index!, end));
  }
  return out;
}

function candidatesIn(file: string): string[] {
  const raw = fs.readFileSync(file, 'utf8');
  if (!raw.includes('horizontal')) return [];
  const code = stripComments(raw);
  const rel = path.relative(ROOT, file);
  const out = new Set<string>();
  for (const block of scrollViewBlocks(code)) {
    const head = block.slice(0, block.indexOf('>') + 1);
    if (!head.includes('horizontal')) continue;
    if (!block.includes('.map(')) continue;
    if (!block.includes('Pressable') && !block.includes('TouchableOpacity')) continue;
    for (const s of block.matchAll(/onPress=\{\(\)\s*=>\s*(set[A-Z]\w*)\(/g)) {
      out.add(`${rel} :: ${s[1]}`);
    }
  }
  return [...out];
}

describe('a chip strip is a filter, not a menu', () => {
  const files = ROOTS.flatMap((r) => walk(path.join(ROOT, r)));
  const found = files.flatMap(candidatesIn).sort();

  it('scans a meaningful number of files', () => {
    expect(files.length).toBeGreaterThan(150);
    // The scanner finding NOTHING would pass every assertion below. #177.
    expect(found.length).toBeGreaterThan(5);
  });

  it('has no unclassified horizontal single-setter strip', () => {
    const unclassified = found.filter((f) => !(f in CLASSIFIED));
    // If this fires: open the screen. Is the user choosing ONE thing? Then it
    // is a DKMenu. Is it a filter or a toggle where every option should be
    // visible? Then add it to FILTERS_AND_TABS with the reason.
    expect(unclassified).toEqual([]);
  });

  it('has no stale classification', () => {
    // An entry that no longer matches has been fixed or deleted; leaving it
    // turns the list into a blanket exemption nobody rereads.
    const stale = Object.keys(CLASSIFIED).filter((k) => !found.includes(k));
    expect(stale).toEqual([]);
  });

  it('detects the shape when it is reintroduced (decoy)', () => {
    const decoy = path.join(ROOT, 'app', '__chip_decoy__.tsx');
    fs.writeFileSync(
      decoy,
      [
        'export function D() { return (',
        '  <ScrollView horizontal>',
        '    {items.map((i) => (',
        '      <Pressable key={i.id} onPress={() => setChosenThing(i.id)}>',
        '        <Text>{i.name}</Text>',
        '      </Pressable>',
        '    ))}',
        '  </ScrollView>',
        '); }',
      ].join('\n'),
      'utf8',
    );
    try {
      expect(candidatesIn(decoy)).toEqual(['app/__chip_decoy__.tsx :: setChosenThing']);
    } finally {
      fs.unlinkSync(decoy);
    }
  });

  it('does not flag a VERTICAL list of the same shape', () => {
    // The rule is about the horizontal strip specifically — a vertical list
    // shows its own length. A detector that flagged both would be noise.
    const decoy = path.join(ROOT, 'app', '__chip_decoy_vertical__.tsx');
    fs.writeFileSync(
      decoy,
      '<ScrollView>{items.map((i) => (<Pressable onPress={() => setChosenThing(i.id)} />))}</ScrollView>',
      'utf8',
    );
    try {
      expect(candidatesIn(decoy)).toEqual([]);
    } finally {
      fs.unlinkSync(decoy);
    }
  });
});
