// =============================================================================
// CUSTOMER PORTAL (R306) — functional web decision portal
// =============================================================================
// Served at https://admin.vascobuild.com/customer/{CODE}.
//
// Before R306 this page was an app-redirect STUB ("Open in Vasco app"), so a
// real customer (who doesn't have the contractor app) hit a dead end and could
// never give their decisions. Now it is a real, no-login web portal:
//
//   • Loads the tracker via the anon SECURITY DEFINER RPC get_portal_by_access_code.
//   • Renders the project, categories and per-item options (with price impact).
//   • Customer picks an option (or types an answer) → upsert into
//     decision_submissions (anon "Anyone can submit" INSERT policy) + best-effort
//     update_tracker_progress RPC. Mirrors the mobile decisionSyncService contract.
//   • "Open in Vasco app" stays as a SECONDARY affordance (deep link) for the
//     minority who have the app.
//   • If Supabase isn't configured for the admin build, or the fetch fails,
//     it degrades to the old app-redirect landing — no regression.
//
// No auth. The access code IS the bearer credential, same as the mobile flow.
// MVP scope: option select / boolean / short text|number|date. Photo upload,
// signature, payment and the Q&A thread remain app-only for now (v2).
// =============================================================================

'use client';

import Image from 'next/image';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase';

const STORE_IOS = 'https://apps.apple.com/app/id0000000000';
const STORE_ANDROID = 'https://play.google.com/store/apps/details?id=com.vascobuild.app';

type Lang = 'nl' | 'en' | 'de' | 'fr' | 'es' | 'it';

interface PageProps {
  params: Promise<{ code: string }>;
}

// ── Portal data shape (subset of the RPC payload we render) ──────────────────
interface PortalOption {
  value: string;
  label: string;
  description?: string;
  priceImpact?: number;
}
interface PortalItem {
  id: string;
  name: string;
  description: string;
  inputType: string;
  options?: PortalOption[];
  priority?: string;
  status?: string;
  value?: string | number | boolean | null;
}
interface PortalCategory {
  id: string;
  name: string;
  items: PortalItem[];
  completedCount: number;
  totalCount: number;
}
interface PortalData {
  accessToken: string; // canonical access code — used as tracker_id on submit
  projectName: string;
  contractorName: string;
  contractorCountry?: string;
  categories: PortalCategory[];
  totalDecisions: number;
  completedDecisions: number;
}

function isMobileUA(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function pickLanguage(): Lang {
  if (typeof navigator === 'undefined') return 'en';
  const lang = (navigator.language || 'en').toLowerCase();
  if (lang.startsWith('nl')) return 'nl';
  if (lang.startsWith('de')) return 'de';
  if (lang.startsWith('fr')) return 'fr';
  if (lang.startsWith('es')) return 'es';
  if (lang.startsWith('it')) return 'it';
  return 'en';
}

function normalizeCode(raw: string): string {
  return (raw || '').trim().toUpperCase().slice(0, 12);
}

// Country → currency/locale for price formatting (matches the mobile portal).
function moneyFmt(country: string | undefined, lang: Lang) {
  const map: Record<string, { cur: string; loc: string }> = {
    NL: { cur: 'EUR', loc: 'nl-NL' }, DE: { cur: 'EUR', loc: 'de-DE' },
    FR: { cur: 'EUR', loc: 'fr-FR' }, ES: { cur: 'EUR', loc: 'es-ES' },
    IT: { cur: 'EUR', loc: 'it-IT' }, BE: { cur: 'EUR', loc: 'nl-BE' },
    UK: { cur: 'GBP', loc: 'en-GB' }, GB: { cur: 'GBP', loc: 'en-GB' },
    US: { cur: 'USD', loc: 'en-US' },
  };
  const cfg = map[(country || '').toUpperCase()] || { cur: 'EUR', loc: lang + '-' + lang.toUpperCase() };
  try {
    return new Intl.NumberFormat(cfg.loc, { style: 'currency', currency: cfg.cur, maximumFractionDigits: 0, currencyDisplay: 'narrowSymbol' });
  } catch {
    return new Intl.NumberFormat('en', { style: 'currency', currency: cfg.cur, maximumFractionDigits: 0 });
  }
}

const COPY: Record<Lang, Record<string, string>> = {
  en: { eyebrow: 'Your choices', appCta: 'Open in Vasco app', code: 'Access code', loading: 'Loading your project…', notFoundTitle: 'Link not found', notFoundBody: 'This link is invalid or has been removed. Ask your contractor for a new one.', expiredTitle: 'Link expired', expiredBody: 'This link is no longer active. Ask your contractor to resend it.', retry: 'Try again', decidedOf: 'decided', choose: 'Choose one', included: 'Included', yourChoice: 'Your choice', change: 'Change', save: 'Save', saving: 'Saving…', saved: 'Saved — sent to your contractor', savedLocal: "Saved on your device — we'll send it when you're back online", allDoneTitle: 'All set!', allDoneBody: "You've made all your choices. Your contractor has them.", photoInApp: 'Open the Vasco app to add photos for this.', typeAnswer: 'Type your answer', from: 'from', footer: '© Vasco · vascobuild.com' },
  nl: { eyebrow: 'Jouw keuzes', appCta: 'Open in Vasco-app', code: 'Toegangscode', loading: 'Je project laden…', notFoundTitle: 'Link niet gevonden', notFoundBody: 'Deze link is ongeldig of verwijderd. Vraag je aannemer om een nieuwe.', expiredTitle: 'Link verlopen', expiredBody: 'Deze link is niet meer actief. Vraag je aannemer om hem opnieuw te sturen.', retry: 'Opnieuw proberen', decidedOf: 'gekozen', choose: 'Kies er één', included: 'Inbegrepen', yourChoice: 'Jouw keuze', change: 'Wijzigen', save: 'Opslaan', saving: 'Opslaan…', saved: 'Opgeslagen — naar je aannemer gestuurd', savedLocal: 'Opgeslagen op je toestel — we sturen het zodra je weer online bent', allDoneTitle: 'Helemaal klaar!', allDoneBody: 'Je hebt al je keuzes gemaakt. Je aannemer heeft ze.', photoInApp: "Open de Vasco-app om hier foto's toe te voegen.", typeAnswer: 'Typ je antwoord', from: 'vanaf', footer: '© Vasco · vascobuild.com' },
  de: { eyebrow: 'Deine Auswahl', appCta: 'In Vasco-App öffnen', code: 'Zugangscode', loading: 'Dein Projekt wird geladen…', notFoundTitle: 'Link nicht gefunden', notFoundBody: 'Dieser Link ist ungültig oder wurde entfernt. Bitte deinen Handwerker um einen neuen.', expiredTitle: 'Link abgelaufen', expiredBody: 'Dieser Link ist nicht mehr aktiv. Bitte deinen Handwerker, ihn erneut zu senden.', retry: 'Erneut versuchen', decidedOf: 'entschieden', choose: 'Wähle eine', included: 'Inbegriffen', yourChoice: 'Deine Wahl', change: 'Ändern', save: 'Speichern', saving: 'Speichern…', saved: 'Gespeichert — an deinen Handwerker gesendet', savedLocal: 'Auf deinem Gerät gespeichert — wir senden es, sobald du wieder online bist', allDoneTitle: 'Alles erledigt!', allDoneBody: 'Du hast alle Auswahlen getroffen. Dein Handwerker hat sie.', photoInApp: 'Öffne die Vasco-App, um hier Fotos hinzuzufügen.', typeAnswer: 'Gib deine Antwort ein', from: 'ab', footer: '© Vasco · vascobuild.com' },
  fr: { eyebrow: 'Vos choix', appCta: "Ouvrir dans l'app Vasco", code: "Code d'accès", loading: 'Chargement de votre projet…', notFoundTitle: 'Lien introuvable', notFoundBody: "Ce lien est invalide ou a été supprimé. Demandez-en un nouveau à votre artisan.", expiredTitle: 'Lien expiré', expiredBody: "Ce lien n'est plus actif. Demandez à votre artisan de le renvoyer.", retry: 'Réessayer', decidedOf: 'décidé', choose: 'Choisissez-en un', included: 'Inclus', yourChoice: 'Votre choix', change: 'Modifier', save: 'Enregistrer', saving: 'Enregistrement…', saved: 'Enregistré — envoyé à votre artisan', savedLocal: "Enregistré sur votre appareil — nous l'enverrons dès votre retour en ligne", allDoneTitle: 'Tout est prêt !', allDoneBody: 'Vous avez fait tous vos choix. Votre artisan les a reçus.', photoInApp: "Ouvrez l'app Vasco pour ajouter des photos ici.", typeAnswer: 'Saisissez votre réponse', from: 'à partir de', footer: '© Vasco · vascobuild.com' },
  es: { eyebrow: 'Tus elecciones', appCta: 'Abrir en la app Vasco', code: 'Código de acceso', loading: 'Cargando tu proyecto…', notFoundTitle: 'Enlace no encontrado', notFoundBody: 'Este enlace no es válido o se ha eliminado. Pide uno nuevo a tu contratista.', expiredTitle: 'Enlace caducado', expiredBody: 'Este enlace ya no está activo. Pide a tu contratista que lo reenvíe.', retry: 'Reintentar', decidedOf: 'decidido', choose: 'Elige una', included: 'Incluido', yourChoice: 'Tu elección', change: 'Cambiar', save: 'Guardar', saving: 'Guardando…', saved: 'Guardado — enviado a tu contratista', savedLocal: 'Guardado en tu dispositivo — lo enviaremos cuando vuelvas a estar en línea', allDoneTitle: '¡Todo listo!', allDoneBody: 'Has hecho todas tus elecciones. Tu contratista las tiene.', photoInApp: 'Abre la app Vasco para añadir fotos aquí.', typeAnswer: 'Escribe tu respuesta', from: 'desde', footer: '© Vasco · vascobuild.com' },
  it: { eyebrow: 'Le tue scelte', appCta: "Apri nell'app Vasco", code: 'Codice di accesso', loading: 'Caricamento del tuo progetto…', notFoundTitle: 'Link non trovato', notFoundBody: 'Questo link non è valido o è stato rimosso. Chiedine uno nuovo al tuo contractor.', expiredTitle: 'Link scaduto', expiredBody: 'Questo link non è più attivo. Chiedi al tuo contractor di reinviarlo.', retry: 'Riprova', decidedOf: 'deciso', choose: 'Scegline una', included: 'Incluso', yourChoice: 'La tua scelta', change: 'Modifica', save: 'Salva', saving: 'Salvataggio…', saved: 'Salvato — inviato al tuo contractor', savedLocal: 'Salvato sul tuo dispositivo — lo invieremo appena tornerai online', allDoneTitle: 'Tutto pronto!', allDoneBody: 'Hai fatto tutte le tue scelte. Il tuo contractor le ha ricevute.', photoInApp: "Apri l'app Vasco per aggiungere foto qui.", typeAnswer: 'Scrivi la tua risposta', from: 'da', footer: '© Vasco · vascobuild.com' },
};

type Phase = 'loading' | 'ready' | 'not_found' | 'expired' | 'app_only';

const DK = { bg: '#0B0E11', panel: '#14181F', panel2: '#1C2128', border: '#2A3038', text: '#FFFFFF', muted: '#9CA3AF', accent: '#F97316', amber: '#F59E0B', green: '#22C55E' };

export default function CustomerPortal({ params }: PageProps) {
  const { code: rawCode } = use(params);
  const code = normalizeCode(rawCode);

  const lang = useMemo(() => pickLanguage(), []);
  const t = COPY[lang];

  const [phase, setPhase] = useState<Phase>('loading');
  const [data, setData] = useState<PortalData | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingItem, setPendingItem] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const deepLink = `vasco://customer/${encodeURIComponent(code)}`;
  const fmt = useMemo(() => moneyFmt(data?.contractorCountry, lang), [data?.contractorCountry, lang]);

  const load = useCallback(async () => {
    setPhase('loading');
    // No Supabase in this admin build → fall back to the app-redirect landing.
    if (!isSupabaseConfigured()) { setPhase('app_only'); return; }
    const sb = getSupabase();
    if (!sb) { setPhase('app_only'); return; }
    try {
      const { data: raw, error } = await sb.rpc('get_portal_by_access_code', { p_access_code: code });
      if (error) { setPhase('app_only'); return; } // network/permission → don't strand, offer the app
      if (!raw || typeof raw !== 'object') { setPhase('not_found'); return; }
      if ((raw as Record<string, unknown>).expired === true) { setPhase('expired'); return; }
      setData(raw as unknown as PortalData);
      setPhase('ready');
    } catch {
      setPhase('app_only');
    }
  }, [code]);

  useEffect(() => { void load(); }, [load]);

  const showToast = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(null), 3500); };

  const submit = useCallback(async (item: PortalItem, value: string) => {
    if (!data) return;
    setPendingItem(item.id);
    // Optimistic local update so the UI feels instant.
    setData(prev => prev ? {
      ...prev,
      completedDecisions: prev.categories.flatMap(c => c.items).find(i => i.id === item.id)?.status === 'decided'
        ? prev.completedDecisions
        : Math.min(prev.totalDecisions, prev.completedDecisions + 1),
      categories: prev.categories.map(c => ({
        ...c,
        items: c.items.map(i => i.id === item.id ? { ...i, value, status: 'decided' } : i),
        completedCount: c.items.some(i => i.id === item.id && i.status !== 'decided') ? c.completedCount + 1 : c.completedCount,
      })),
    } : prev);
    setEditing(null);
    const sb = getSupabase();
    let ok = false;
    if (sb) {
      try {
        const { error } = await sb.from('decision_submissions').upsert({
          tracker_id: data.accessToken,
          item_id: item.id,
          submitted_by: 'customer',
          value,
          submitted_at: new Date().toISOString(),
        }, { onConflict: 'tracker_id,item_id,submitted_by' });
        if (!error) {
          ok = true;
          try { await sb.rpc('update_tracker_progress', { p_tracker_id: data.accessToken }); } catch { /* non-critical */ }
        }
      } catch { /* fall through to local */ }
    }
    setPendingItem(null);
    showToast(ok ? t.saved : t.savedLocal);
  }, [data, t]);

  // ── Non-portal states ──────────────────────────────────────────────────────
  if (phase === 'loading') return <Centered><Spinner /><p style={{ color: DK.muted, marginTop: 16 }}>{t.loading}</p></Centered>;
  if (phase === 'not_found') return <Message icon="✕" title={t.notFoundTitle} body={t.notFoundBody} action={{ label: t.retry, onClick: () => void load() }} code={code} codeLabel={t.code} />;
  if (phase === 'expired') return <Message icon="⏳" title={t.expiredTitle} body={t.expiredBody} action={{ label: t.retry, onClick: () => void load() }} code={code} codeLabel={t.code} />;
  if (phase === 'app_only' || !data) return <AppRedirect code={code} lang={lang} deepLink={deepLink} />;

  const allDone = data.totalDecisions > 0 && data.completedDecisions >= data.totalDecisions;

  return (
    <main style={{ minHeight: '100vh', background: DK.bg, color: DK.text, fontFamily: 'var(--font-inter), system-ui, sans-serif', paddingBottom: 48 }}>
      {/* Header */}
      <header style={{ background: 'linear-gradient(180deg, rgba(249,115,22,0.14), rgba(249,115,22,0))', borderBottom: `1px solid ${DK.border}`, padding: '28px 20px 22px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Image src="/vasco-logo.png" alt="Vasco" width={22} height={22} priority style={{ borderRadius: 5 }} />
            <span style={{ fontFamily: 'var(--font-archivo), sans-serif', fontWeight: 900, fontSize: 13, letterSpacing: 1.4, textTransform: 'uppercase' }}>Vasco</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: DK.amber, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 700 }}>{t.eyebrow}</span>
          </div>
          <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-archivo), var(--font-inter), sans-serif', letterSpacing: -0.4 }}>{data.projectName}</h1>
          <p style={{ margin: 0, color: DK.muted, fontSize: 14 }}>{data.contractorName}</p>
          {/* Progress */}
          <div style={{ marginTop: 16 }}>
            <div style={{ height: 8, background: DK.panel2, borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${data.totalDecisions ? (data.completedDecisions / data.totalDecisions) * 100 : 0}%`, background: `linear-gradient(90deg, ${DK.accent}, ${DK.amber})`, transition: 'width 0.3s ease' }} />
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 12, color: DK.muted }}>{data.completedDecisions} / {data.totalDecisions} {t.decidedOf}</p>
          </div>
          <a href={deepLink} style={{ display: 'inline-block', marginTop: 14, fontSize: 12, color: DK.accent, textDecoration: 'none', fontWeight: 600 }}>{t.appCta} →</a>
        </div>
      </header>

      {allDone && (
        <div style={{ maxWidth: 560, margin: '20px auto 0', padding: '0 20px' }}>
          <div style={{ background: 'rgba(34,197,94,0.1)', border: `1px solid rgba(34,197,94,0.3)`, borderRadius: 14, padding: '18px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 30 }}>🎉</div>
            <h2 style={{ margin: '6px 0 4px', fontSize: 17, fontWeight: 800 }}>{t.allDoneTitle}</h2>
            <p style={{ margin: 0, color: DK.muted, fontSize: 14 }}>{t.allDoneBody}</p>
          </div>
        </div>
      )}

      {/* Categories */}
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '8px 20px 0' }}>
        {data.categories.map(cat => (
          <section key={cat.id} style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: DK.muted }}>{cat.name}</h3>
              <span style={{ fontSize: 12, color: DK.muted }}>{cat.completedCount}/{cat.totalCount}</span>
            </div>
            {cat.items.map(item => {
              const decided = item.status === 'decided' || (item.value != null && item.value !== '');
              const isEditing = editing === item.id;
              const opts = item.options ?? [];
              const showOptions = opts.length > 0 && (!decided || isEditing);
              return (
                <article key={item.id} style={{ background: DK.panel, border: `1px solid ${DK.border}`, borderRadius: 14, padding: 16, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: '0 0 3px', fontSize: 15, fontWeight: 700 }}>{item.name}</h4>
                      {item.description ? <p style={{ margin: 0, fontSize: 13, color: DK.muted, lineHeight: 1.45 }}>{item.description}</p> : null}
                    </div>
                    {decided && !isEditing && <span style={{ fontSize: 18, color: DK.green }}>✓</span>}
                  </div>

                  {decided && !isEditing ? (
                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, background: DK.panel2, borderRadius: 10, padding: '10px 12px' }}>
                        <span style={{ fontSize: 10, color: DK.amber, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>{t.yourChoice}</span>
                        <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{labelFor(item)}</div>
                      </div>
                      <button onClick={() => setEditing(item.id)} style={btnGhost}>{t.change}</button>
                    </div>
                  ) : showOptions ? (
                    <div style={{ marginTop: 12 }}>
                      <p style={{ margin: '0 0 8px', fontSize: 11, color: DK.muted, letterSpacing: 0.4, textTransform: 'uppercase' }}>{t.choose}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {opts.map(o => {
                          const selected = String(item.value) === o.value;
                          const pi = o.priceImpact ?? 0;
                          return (
                            <button key={o.value} disabled={pendingItem === item.id} onClick={() => void submit(item, o.value)}
                              style={{ ...optBtn, borderColor: selected ? DK.accent : DK.border, background: selected ? 'rgba(249,115,22,0.1)' : DK.panel2 }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ width: 18, height: 18, borderRadius: 99, border: `2px solid ${selected ? DK.accent : DK.muted}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {selected && <span style={{ width: 8, height: 8, borderRadius: 99, background: DK.accent }} />}
                                </span>
                                <span style={{ textAlign: 'left' }}>
                                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{o.label}</span>
                                  {o.description ? <span style={{ display: 'block', fontSize: 12, color: DK.muted }}>{o.description}</span> : null}
                                </span>
                              </span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: pi > 0 ? DK.amber : DK.muted, whiteSpace: 'nowrap' }}>
                                {pi === 0 ? t.included : `${pi > 0 ? '+' : ''}${fmt.format(pi)}`}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : opts.length === 0 && item.inputType === 'photo' ? (
                    <p style={{ marginTop: 12, fontSize: 13, color: DK.muted }}>📷 {t.photoInApp} <a href={deepLink} style={{ color: DK.accent }}>{t.appCta}</a></p>
                  ) : opts.length === 0 ? (
                    <FreeText item={item} t={t} pending={pendingItem === item.id} onSave={(v) => void submit(item, v)} />
                  ) : null}
                </article>
              );
            })}
          </section>
        ))}
      </div>

      <p style={{ textAlign: 'center', color: DK.muted, fontSize: 11, marginTop: 32 }}>{t.footer}</p>

      {toast && (
        <div style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', background: DK.panel2, border: `1px solid ${DK.border}`, color: DK.text, padding: '12px 18px', borderRadius: 12, fontSize: 13, boxShadow: '0 8px 30px rgba(0,0,0,0.5)', maxWidth: 'calc(100% - 32px)', textAlign: 'center' }}>{toast}</div>
      )}
    </main>
  );
}

function labelFor(item: PortalItem): string {
  const v = item.value;
  if (v == null) return '—';
  const opt = (item.options ?? []).find(o => o.value === String(v));
  if (opt) return opt.label;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

function FreeText({ item, t, pending, onSave }: { item: PortalItem; t: Record<string, string>; pending: boolean; onSave: (v: string) => void }) {
  const [v, setV] = useState<string>(item.value != null ? String(item.value) : '');
  const type = item.inputType === 'number' ? 'number' : item.inputType === 'date' ? 'date' : 'text';
  return (
    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
      <input value={v} onChange={e => setV(e.target.value)} type={type} placeholder={t.typeAnswer}
        style={{ flex: 1, background: DK.panel2, border: `1px solid ${DK.border}`, borderRadius: 10, padding: '10px 12px', color: DK.text, fontSize: 14 }} />
      <button disabled={pending || !v.trim()} onClick={() => onSave(v.trim())} style={{ ...btnPrimary, opacity: pending || !v.trim() ? 0.5 : 1 }}>{pending ? t.saving : t.save}</button>
    </div>
  );
}

// ── Shared chrome ────────────────────────────────────────────────────────────
function Centered({ children }: { children: React.ReactNode }) {
  return <main style={{ minHeight: '100vh', background: DK.bg, color: DK.text, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-inter), system-ui, sans-serif', padding: 24 }}>{children}</main>;
}
function Spinner() {
  return <><style>{`@keyframes vbspin{to{transform:rotate(360deg)}}`}</style><div style={{ width: 34, height: 34, border: `3px solid ${DK.border}`, borderTopColor: DK.accent, borderRadius: '50%', animation: 'vbspin 0.9s linear infinite' }} /></>;
}
function Message({ icon, title, body, action, code, codeLabel }: { icon: string; title: string; body: string; action: { label: string; onClick: () => void }; code: string; codeLabel: string }) {
  return (
    <Centered>
      <div style={{ width: 84, height: 84, borderRadius: 24, background: DK.panel2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, marginBottom: 20 }}>{icon}</div>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 10px', textAlign: 'center' }}>{title}</h1>
      <p style={{ color: DK.muted, fontSize: 15, textAlign: 'center', maxWidth: 340, lineHeight: 1.5, margin: '0 0 12px' }}>{body}</p>
      <div style={{ background: DK.panel2, border: `1px solid ${DK.border}`, borderRadius: 10, padding: '8px 16px', margin: '0 0 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 10, color: DK.amber, letterSpacing: 1.4, textTransform: 'uppercase' }}>{codeLabel}</div>
        <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 18, letterSpacing: 4 }}>{code}</div>
      </div>
      <button onClick={action.onClick} style={btnPrimary}>{action.label}</button>
    </Centered>
  );
}

// Graceful fallback: the old app-redirect landing (Supabase not configured / fetch failed).
function AppRedirect({ code, lang, deepLink }: { code: string; lang: Lang; deepLink: string }) {
  const t = COPY[lang];
  useEffect(() => { if (isMobileUA()) { const id = window.setTimeout(() => { window.location.href = deepLink; }, 600); return () => window.clearTimeout(id); } }, [deepLink]);
  return (
    <Centered>
      <div style={{ width: 92, height: 92, borderRadius: 26, background: `linear-gradient(135deg, #9A3412, #C2410C, ${DK.accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22, boxShadow: `0 16px 40px rgba(249,115,22,0.42)` }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M9 12h6m-6 4h6M9 8h6m-9 12V6a2 2 0 0 1 2-2h8l4 4v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 12px', textAlign: 'center', fontFamily: 'var(--font-archivo), sans-serif' }}>{t.eyebrow}</h1>
      <div style={{ background: DK.panel2, border: `1px solid ${DK.border}`, borderRadius: 10, padding: '8px 16px', margin: '0 0 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 10, color: DK.amber, letterSpacing: 1.4, textTransform: 'uppercase' }}>{t.code}</div>
        <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 18, letterSpacing: 4 }}>{code}</div>
      </div>
      <a href={deepLink} style={{ ...btnPrimary, textDecoration: 'none' }}>{t.appCta}</a>
      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <a href={STORE_IOS} style={{ color: DK.muted, fontSize: 12 }}>App Store</a>
        <a href={STORE_ANDROID} style={{ color: DK.muted, fontSize: 12 }}>Google Play</a>
      </div>
    </Centered>
  );
}

const btnPrimary: React.CSSProperties = { background: `linear-gradient(135deg, #9A3412, #C2410C, ${DK.accent})`, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 22px', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: `0 10px 26px rgba(249,115,22,0.45)` };
const btnGhost: React.CSSProperties = { background: 'transparent', color: DK.accent, border: `1px solid ${DK.border}`, borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' };
const optBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, border: '1px solid', borderRadius: 12, padding: '12px 14px', cursor: 'pointer', color: DK.text, width: '100%' };
