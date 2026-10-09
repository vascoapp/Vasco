// =============================================================================
// JOB FORMS — per-trade checklists a contractor defines once and runs on site
// =============================================================================
// The closeout screen ships a fixed eight-item list, identical for every job
// and every trade: a plumber's boiler service gets the same checklist as a
// painter's exterior job. That is fine as a handover ritual and useless as a
// work record, which is why Jobber sells "customizable job forms" and an
// aannemer running four trades needs one list per trade rather than one list.
//
// Two separate things live here:
//
//   TEMPLATE  — what to check, written once by the contractor. Config.
//   RESPONSE  — what was found on a specific job. Evidence.
//
// Keeping them apart matters: editing a template must never rewrite what a
// crew already recorded on a finished job. A response therefore snapshots the
// item labels it was answered against, so a form completed in March still
// reads correctly after the template is reworded in June.
//
// Storage mirrors quoteTemplateService / messageTemplateService: AsyncStorage,
// contractor-local. Templates are configuration, not shared data.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { pushLibraryItem, deleteLibraryItem, syncLibraryList } from './userLibrarySync';
import { getAuthedUserId } from '../lib/currentUser';
import { useCallback, useEffect, useState } from 'react';

const TEMPLATES_KEY = '@vasco_job_form_templates';
const RESPONSES_KEY = '@vasco_job_form_responses';
const MAX_RESPONSES = 500;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * `check` covers most of what a trades checklist needs. `text` and `number`
 * exist because a reading ("water pressure: 1.8 bar") is the thing that makes a
 * service record worth keeping, and a tick cannot carry it.
 */
export type JobFormFieldType = 'check' | 'text' | 'number';

export interface JobFormField {
  id: string;
  label: string;
  type: JobFormFieldType;
  required: boolean;
  /** Shown under the label — where to look, what "good" is. */
  hint?: string;
  /** For `number`: bar, °C, mm. Rendered next to the input. */
  unit?: string;
  sortOrder: number;
}

export interface JobFormTemplate {
  id: string;
  name: string;
  /** Trade this applies to. Undefined = offered for any job. */
  trade?: string;
  fields: JobFormField[];
  createdAt: string;
  updatedAt: string;
}

export interface JobFormAnswer {
  fieldId: string;
  /** Snapshotted from the template at answer time — see the header note. */
  label: string;
  type: JobFormFieldType;
  unit?: string;
  checked?: boolean;
  text?: string;
  number?: number;
}

export interface JobFormResponse {
  id: string;
  jobId: string;
  templateId: string;
  /** Snapshotted too: templates get renamed. */
  templateName: string;
  answers: JobFormAnswer[];
  completedAt?: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface JobFormError {
  code: 'missing_required' | 'not_a_number' | 'empty_template';
  message: string;
  fieldId?: string;
}

/**
 * What blocks a form from counting as complete.
 *
 * An unticked optional item is a normal outcome, not an error — only required
 * fields block. A required `check` that is explicitly false is still an answer:
 * "did you bleed the radiators? no" is a legitimate, and often important,
 * record. So the test is whether it was ANSWERED, not whether it was ticked.
 */
export function validateResponse(
  template: Pick<JobFormTemplate, 'fields'>,
  answers: JobFormAnswer[],
): JobFormError[] {
  const errors: JobFormError[] = [];
  if (template.fields.length === 0) {
    return [{ code: 'empty_template', message: 'This form has no fields yet' }];
  }
  const byId = new Map(answers.map((a) => [a.fieldId, a]));

  for (const field of template.fields) {
    if (!field.required) continue;
    const a = byId.get(field.id);
    const answered =
      field.type === 'check'
        ? typeof a?.checked === 'boolean'
        : field.type === 'number'
          ? typeof a?.number === 'number' && Number.isFinite(a.number)
          : !!a?.text && a.text.trim().length > 0;

    if (!answered) {
      errors.push({
        code: 'missing_required',
        message: `"${field.label}" still needs an answer`,
        fieldId: field.id,
      });
    }
  }

  for (const a of answers) {
    if (a.type === 'number' && a.number !== undefined && !Number.isFinite(a.number)) {
      errors.push({
        code: 'not_a_number',
        message: `"${a.label}" is not a number`,
        fieldId: a.fieldId,
      });
    }
  }

  return errors;
}

/** 0-100. Counts answered fields, so a half-filled form reads honestly. */
export function completionPercent(
  template: Pick<JobFormTemplate, 'fields'>,
  answers: JobFormAnswer[],
): number {
  if (template.fields.length === 0) return 0;
  const byId = new Map(answers.map((a) => [a.fieldId, a]));
  const done = template.fields.filter((f) => {
    const a = byId.get(f.id);
    if (!a) return false;
    if (f.type === 'check') return typeof a.checked === 'boolean';
    if (f.type === 'number') return typeof a.number === 'number' && Number.isFinite(a.number);
    return !!a.text && a.text.trim().length > 0;
  }).length;
  return Math.round((done / template.fields.length) * 100);
}

/**
 * Templates a given job can use: its own trade, plus the trade-agnostic ones.
 *
 * Matching is case-insensitive because trade comes from onboarding in one place
 * and from the job in another, and "Loodgieter" vs "loodgieter" should not
 * silently hide a contractor's own form.
 *
 * An UNKNOWN job trade returns everything, which is the whole reason this
 * function is not a one-line filter. `Job.trade` is optional and the only
 * in-app job-creation path never sets it, so in practice almost every real job
 * arrives here with `undefined`. Reading that as "this job is trade-agnostic"
 * hid every trade-tagged form and left the contractor staring at "no form for
 * this trade" on a job they had just written a form for. Undefined means we
 * cannot narrow, so we offer the lot and let them pick.
 */
export function templatesForJob(
  templates: JobFormTemplate[],
  trade: string | undefined,
): JobFormTemplate[] {
  const t = trade?.toLowerCase().trim();
  // 'general' / 'other' say nothing about the work: every job is stamped with
  // the CONTRACTOR's trade, which for an aannemer is 'general' — a form set to
  // "plumbing" then matched no job at all (review 2026-10-03). Unknown → all.
  if (!t || t === 'general' || t === 'other') return templates;
  return templates.filter((tpl) => !tpl.trade || tpl.trade.toLowerCase().trim() === t);
}

/** Build a blank answer set so the UI has something to bind to. */
export function blankAnswers(template: Pick<JobFormTemplate, 'fields'>): JobFormAnswer[] {
  return [...template.fields]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((f) => ({ fieldId: f.id, label: f.label, type: f.type, unit: f.unit }));
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export async function loadTemplates(): Promise<JobFormTemplate[]> {
  try {
    const raw = await AsyncStorage.getItem(TEMPLATES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveTemplates(templates: JobFormTemplate[]): Promise<void> {
  await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates)).catch(() => {});
}

export async function loadResponses(): Promise<JobFormResponse[]> {
  try {
    const raw = await AsyncStorage.getItem(RESPONSES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveResponse(response: JobFormResponse): Promise<void> {
  const all = await loadResponses();
  // Replace by id so re-saving an in-progress form does not accumulate
  // duplicates every time the crew taps save.
  // Newest first, and capped: these never expire on their own, and AsyncStorage
  // is a single blob that is re-serialised on every keystroke-triggered save.
  // 500 is years of work for a solo contractor and keeps the write cheap.
  const next = [response, ...all.filter((r) => r.id !== response.id)].slice(0, MAX_RESPONSES);
  await AsyncStorage.setItem(RESPONSES_KEY, JSON.stringify(next)).catch(() => {});
  // The record of work done lives in the account, not only on this phone (W190).
  scheduleResponsePush(response);
}

// The form screen saves on every pause in typing (400 ms). Pushing each of
// those filled the offline queue — on site, offline is the normal case — and
// the queue keeps only its newest entries, so a few long forms could push out
// another table's queued write (review 2026-10-09). One push once typing has
// settled, at once when the form is completed; anything missed (app killed)
// is uploaded by the next session's merge, which pushes what the account lacks.
export const RESPONSE_PUSH_DELAY_MS = 8000;
const pendingResponsePush = new Map<string, { timer: ReturnType<typeof setTimeout>; response: JobFormResponse; owner: string | null }>();

/**
 * Send every waiting form push NOW — called at logout BEFORE the sign-out:
 * logout wipes the device copy, so a form typed in the last seconds would
 * otherwise exist nowhere (review 2026-10-09). Offline it lands in the write
 * queue, which survives logout for the same account.
 */
export async function flushPendingResponsePushes(): Promise<void> {
  const waiting = [...pendingResponsePush.values()];
  pendingResponsePush.clear();
  for (const w of waiting) clearTimeout(w.timer);
  await Promise.all(waiting.map((w) => pushLibraryItem('job_form_response', w.response.id, w.response, w.owner)));
}

function scheduleResponsePush(response: JobFormResponse): void {
  const prev = pendingResponsePush.get(response.id);
  if (prev) clearTimeout(prev.timer);
  const owner = getAuthedUserId();
  const push = () => {
    pendingResponsePush.delete(response.id);
    void pushLibraryItem('job_form_response', response.id, response, owner);
  };
  if (response.completedAt) { push(); return; }
  pendingResponsePush.set(response.id, { timer: setTimeout(push, RESPONSE_PUSH_DELAY_MS), response, owner });
}

// Filled forms come back from the account once per signed-in session (a new
// phone, a reinstall, a logout all start with an empty device cache).
let responsesSyncedFor: string | null = null;
async function syncResponsesOnce(): Promise<void> {
  const uid = getAuthedUserId();
  if (!uid || responsesSyncedFor === uid) return;
  const merged = await syncLibraryList('job_form_response', loadResponses);
  if (merged) {
    responsesSyncedFor = uid;
    const sorted = [...merged].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')).slice(0, MAX_RESPONSES);
    await AsyncStorage.setItem(RESPONSES_KEY, JSON.stringify(sorted)).catch(() => {});
  }
}

export async function responsesForJob(jobId: string): Promise<JobFormResponse[]> {
  await syncResponsesOnce().catch(() => {});
  return (await loadResponses()).filter((r) => r.jobId === jobId);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useJobFormTemplates() {
  const [templates, setTemplates] = useState<JobFormTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadTemplates().then((local) => { if (!cancelled) setTemplates(local); }).finally(() => { if (!cancelled) setLoading(false); });
    // The account's forms (W190): back after a logout or on a new phone.
    (async () => {
      const merged = await syncLibraryList('job_form_template', loadTemplates);
      if (merged && !cancelled) { await saveTemplates(merged); setTemplates(merged); }
    })().catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const persist = useCallback(async (next: JobFormTemplate[]) => {
    setTemplates(next);
    await saveTemplates(next);
  }, []);

  const upsert = useCallback(
    async (template: JobFormTemplate) => {
      const now = new Date().toISOString();
      const exists = templates.some((t) => t.id === template.id);
      const next = exists
        ? templates.map((t) => (t.id === template.id ? { ...template, updatedAt: now } : t))
        : [...templates, { ...template, createdAt: now, updatedAt: now }];
      await persist(next);
      const saved = next.find((t) => t.id === template.id);
      if (saved) void pushLibraryItem('job_form_template', saved.id, saved);
    },
    [templates, persist],
  );

  const remove = useCallback(
    async (id: string) => {
      // Responses are deliberately NOT deleted with the template: they are the
      // record of work done, and they carry their own snapshotted labels, so
      // they stay readable without it.
      await persist(templates.filter((t) => t.id !== id));
      void deleteLibraryItem('job_form_template', id);
    },
    [templates, persist],
  );

  return { templates, loading, upsert, remove };
}
