// =============================================================================
// TRUNCATE — cut a preview at a word, not in the middle of one
// =============================================================================
// The AI queue card shows the first ~100 characters of the message it has
// drafted. `resolved.slice(0, 100)` cut wherever character 100 happened to
// land, so a German card read "…ist seit 7 Tagen offen. Könnten Sie sie diese
// Woc" — the contractor cannot tell whether the draft itself is broken or the
// preview is. Two copies of that existed (workflowPackService, aiQueueNotifier)
// and both cut mid-word.
//
// Nothing is lost by cutting early: the FULL text is always carried on
// `preparedData.template`, which is what actually gets sent.
// =============================================================================

/**
 * Shorten to at most `max` characters, breaking at the last whitespace so a
 * word is never split, and marking the cut with an ellipsis.
 *
 * Falls back to a hard cut when there is no whitespace to break on inside the
 * budget — a single very long token (a URL, a German compound) has no word
 * boundary to find, and returning the whole thing would defeat the limit.
 */
export function truncateAtWord(input: string | null | undefined, max: number): string {
  const s = (input ?? '').trim();
  if (!s || s.length <= max) return s;
  // -1 leaves room for the ellipsis, which counts toward `max`.
  const budget = Math.max(1, max - 1);
  const cut = s.slice(0, budget);
  const lastSpace = cut.search(/\s\S*$/);
  // Only honour the word break if it keeps a useful amount of text; breaking a
  // 100-char budget at character 4 is worse than cutting a long word.
  const at = lastSpace > budget * 0.6 ? lastSpace : budget;
  return s.slice(0, at).trimEnd() + '…';
}
