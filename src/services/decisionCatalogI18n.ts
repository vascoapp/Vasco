/**
 * The decision catalogue in the reader's language.
 *
 * `src/data/mockDecisions.ts` holds 8 built-in checklists — 567 English
 * literals: category names ("Fixtures & Fittings"), item names ("Toilet
 * Style"), the options under them ("Wall-hung"), what each is for, and what
 * happens if the customer takes too long to answer.
 *
 * None of it was translated, and none of it is chrome:
 *  - the contractor works the checklist on their own screen;
 *  - the CUSTOMER reads the same strings in the decision portal;
 *  - and now that a chosen upgrade becomes an invoice line, the customer reads
 *    them on an invoice — a German customer's invoice line said
 *    "Toilet Style — Wall-hung".
 *
 * The ids are stable (`item_toilet_style`, `wall_hung`), so resolve by id at
 * RENDER time rather than translating at creation: a tracker built months ago,
 * or one the contractor made in another language, still reads correctly, and a
 * contractor's OWN item — which has no catalogue id — falls back to what they
 * typed. Same shape as `localizeTemplate` in `quoteTemplateService`.
 *
 * Keys live under `decisionCatalog.*` in the locale files. A missing key falls
 * back to the English seed, so an untranslated market degrades to English
 * rather than to a key name.
 */
export type TFn = (key: string, defaultValue: string) => string;

/** Category heading, e.g. "Fixtures & Fittings" → "Sanitärobjekte & Armaturen". */
export function localizeCategoryName(categoryId: string | undefined, fallback: string, t: TFn): string {
  if (!categoryId) return fallback;
  return t(`decisionCatalog.categories.${categoryId}.name`, fallback);
}

export function localizeCategoryDescription(categoryId: string | undefined, fallback: string, t: TFn): string {
  if (!categoryId) return fallback;
  return t(`decisionCatalog.categories.${categoryId}.description`, fallback);
}

/**
 * `itemId` is the catalogue key (`item_toilet_style`). Tracker rows carry it
 * alongside their own row id — see the two-identifier trap in
 * `decisionRecording`.
 */
export function localizeItemName(itemId: string | undefined, fallback: string, t: TFn): string {
  if (!itemId) return fallback;
  return t(`decisionCatalog.items.${itemId}.name`, fallback);
}

export function localizeItemDescription(itemId: string | undefined, fallback: string, t: TFn): string {
  if (!itemId) return fallback;
  return t(`decisionCatalog.items.${itemId}.description`, fallback);
}

export function localizeItemHelp(itemId: string | undefined, fallback: string, t: TFn): string {
  if (!itemId) return fallback;
  return t(`decisionCatalog.items.${itemId}.help`, fallback);
}

export function localizeItemImpact(itemId: string | undefined, fallback: string, t: TFn): string {
  if (!itemId) return fallback;
  return t(`decisionCatalog.items.${itemId}.impact`, fallback);
}

/**
 * Option labels are keyed by the option's own value, which is unique inside an
 * item but not across the catalogue — so the key carries both.
 */
export function localizeOptionLabel(
  itemId: string | undefined,
  optionValue: string,
  fallback: string,
  t: TFn,
): string {
  if (!itemId) return fallback;
  return t(`decisionCatalog.items.${itemId}.options.${optionValue}`, fallback);
}

export function localizeOptionDescription(
  itemId: string | undefined,
  optionValue: string,
  fallback: string,
  t: TFn,
): string {
  if (!itemId) return fallback;
  return t(`decisionCatalog.items.${itemId}.optionDescriptions.${optionValue}`, fallback);
}

/** Checklist (template) name + description, for the picker and the portal header. */
export function localizeTemplateName(templateId: string | undefined, fallback: string, t: TFn): string {
  if (!templateId) return fallback;
  return t(`decisionCatalog.templates.${templateId}.name`, fallback);
}

export function localizeTemplateDescription(templateId: string | undefined, fallback: string, t: TFn): string {
  if (!templateId) return fallback;
  return t(`decisionCatalog.templates.${templateId}.description`, fallback);
}
