// =============================================================================
// CUSTOMER PORTAL (R306 v1 · R307 v2) — functional web decision portal
// =============================================================================
// Served at https://admin.vascobuild.com/customer/{CODE}. A real, no-login web
// portal so customers can give their decisions in a browser (they don't have
// the contractor app). Mirrors the mobile decisionSyncService / portal contract.
//
// v1 (R306): load via anon RPC get_portal_by_access_code → render categories /
//   items / options → submit to decision_submissions ("Anyone can submit") +
//   update_tracker_progress. States, currency, deep-link fallback, 6 locales.
//
// v2 (R307) adds the previously app-only features:
//   • Running-cost total  — sums chosen options' priceImpact ("+€X vs base quote").
//   • Glossary modal       — CUSTOMER_GLOSSARY, "What do these words mean?".
//   • Q&A                  — classify-customer-question Edge Function + thread.
//   • Photo upload         — anon customer-uploads bucket (insert+select policies).
//   • Acknowledgement sign — SVG capture → write_signature_via_portal RPC (anon).
//   • Payment CTA          — opens portalData.paymentLink (R308 extended the RPC
//                            to return paymentLink/paymentStatus; contractor must
//                            still populate the link when minting a checkout).
//
// R308 also wires the Q&A thread to Supabase realtime: a pending question
// subscribes to customer_questions UPDATEs and drops the contractor's approved
// reply into the thread live (20s poll fallback).
//
// No auth. The access code IS the bearer credential, same as the mobile flow.
// =============================================================================

'use client';

import Image from 'next/image';
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase';
import { CUSTOMER_GLOSSARY, type GlossaryLang } from '../../../lib/customerGlossary';

const STORE_IOS = 'https://apps.apple.com/app/id0000000000';
const STORE_ANDROID = 'https://play.google.com/store/apps/details?id=com.vascobuild.app';
const BUCKET = 'customer-uploads';

type Lang = GlossaryLang;

interface PageProps {
  params: Promise<{ code: string }>;
}

interface PortalOption { value: string; label: string; description?: string; priceImpact?: number }
interface PortalItem {
  id: string; name: string; description: string; inputType: string;
  options?: PortalOption[]; priority?: string; status?: string;
  value?: string | number | boolean | null; photoUrls?: string[];
}
interface PortalCategory { id: string; name: string; items: PortalItem[]; completedCount: number; totalCount: number }
interface PortalData {
  accessToken: string; projectName: string; contractorName: string;
  contractorPhone?: string; contractorCountry?: string;
  categories: PortalCategory[]; totalDecisions: number; completedDecisions: number;
  quoteAmount?: number; depositAmount?: number;
  paymentLink?: string; paymentStatus?: 'pending' | 'paid' | 'partial';
}

interface QAEntry { id: string; dbId?: string; q: string; a: string | null; pending: boolean }

function isMobileUA(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}
function pickLanguage(): Lang {
  if (typeof navigator === 'undefined') return 'en';
  const l = (navigator.language || 'en').toLowerCase();
  if (l.startsWith('nl')) return 'nl';
  if (l.startsWith('de')) return 'de';
  if (l.startsWith('fr')) return 'fr';
  if (l.startsWith('es')) return 'es';
  if (l.startsWith('it')) return 'it';
  return 'en';
}
function normalizeCode(raw: string): string { return (raw || '').trim().toUpperCase().slice(0, 12); }

function moneyFmt(country: string | undefined, lang: Lang) {
  const map: Record<string, { cur: string; loc: string }> = {
    NL: { cur: 'EUR', loc: 'nl-NL' }, DE: { cur: 'EUR', loc: 'de-DE' }, FR: { cur: 'EUR', loc: 'fr-FR' },
    ES: { cur: 'EUR', loc: 'es-ES' }, IT: { cur: 'EUR', loc: 'it-IT' }, BE: { cur: 'EUR', loc: 'nl-BE' },
    UK: { cur: 'GBP', loc: 'en-GB' }, GB: { cur: 'GBP', loc: 'en-GB' }, US: { cur: 'USD', loc: 'en-US' },
  };
  const cfg = map[(country || '').toUpperCase()] || { cur: 'EUR', loc: lang + '-' + lang.toUpperCase() };
  try { return new Intl.NumberFormat(cfg.loc, { style: 'currency', currency: cfg.cur, maximumFractionDigits: 0, currencyDisplay: 'narrowSymbol' }); }
  catch { return new Intl.NumberFormat('en', { style: 'currency', currency: cfg.cur, maximumFractionDigits: 0 }); }
}

const COPY: Record<Lang, Record<string, string>> = {
  en: { eyebrow: 'Your choices', appCta: 'Open in Vasco app', code: 'Access code', loading: 'Loading your project…', notFoundTitle: 'Link not found', notFoundBody: 'This link is invalid or has been removed. Ask your contractor for a new one.', expiredTitle: 'Link expired', expiredBody: 'This link is no longer active. Ask your contractor to resend it.', retry: 'Try again', decidedOf: 'decided', choose: 'Choose one', included: 'Included', yourChoice: 'Your choice', change: 'Change', save: 'Save', saving: 'Saving…', saved: 'Saved — sent to your contractor', savedLocal: "Saved on your device — we'll send it when you're back online", allDoneTitle: 'All set!', allDoneBody: "You've made all your choices. Your contractor has them.", typeAnswer: 'Type your answer', footer: '© Vasco · vascobuild.com', runningCost: 'Your choices so far', vsBase: 'vs base quote', noExtra: 'No extra cost', glossaryBtn: 'What do these words mean?', glossaryTitle: 'Words explained', close: 'Close', addPhotos: 'Add photos', uploading: 'Uploading…', askTitle: 'Have a question?', askPlaceholder: 'Ask your contractor anything…', send: 'Send', sending: 'Sending…', yourQuestions: 'Your questions', signTitle: 'Confirm your choices', signBody: 'Sign below to confirm the choices above (optional).', yourName: 'Your name', clear: 'Clear', signSave: 'Confirm & sign', signed: 'Signed — thank you!', payTitle: 'Payment', payNow: 'Pay now', payDeposit: 'Pay deposit', paid: 'Payment received', qaDemoReply: 'Thanks — your contractor will reply soon.', awaitingReply: 'Waiting for your contractor to reply…' },
  nl: { eyebrow: 'Jouw keuzes', appCta: 'Open in Vasco-app', code: 'Toegangscode', loading: 'Je project laden…', notFoundTitle: 'Link niet gevonden', notFoundBody: 'Deze link is ongeldig of verwijderd. Vraag je aannemer om een nieuwe.', expiredTitle: 'Link verlopen', expiredBody: 'Deze link is niet meer actief. Vraag je aannemer om hem opnieuw te sturen.', retry: 'Opnieuw proberen', decidedOf: 'gekozen', choose: 'Kies er één', included: 'Inbegrepen', yourChoice: 'Jouw keuze', change: 'Wijzigen', save: 'Opslaan', saving: 'Opslaan…', saved: 'Opgeslagen — naar je aannemer gestuurd', savedLocal: 'Opgeslagen op je toestel — we sturen het zodra je weer online bent', allDoneTitle: 'Helemaal klaar!', allDoneBody: 'Je hebt al je keuzes gemaakt. Je aannemer heeft ze.', typeAnswer: 'Typ je antwoord', footer: '© Vasco · vascobuild.com', runningCost: 'Je keuzes tot nu toe', vsBase: 't.o.v. basisofferte', noExtra: 'Geen extra kosten', glossaryBtn: 'Wat betekenen deze woorden?', glossaryTitle: 'Woorden uitgelegd', close: 'Sluiten', addPhotos: "Foto's toevoegen", uploading: 'Uploaden…', askTitle: 'Een vraag?', askPlaceholder: 'Vraag je aannemer wat je wilt…', send: 'Versturen', sending: 'Versturen…', yourQuestions: 'Jouw vragen', signTitle: 'Bevestig je keuzes', signBody: 'Onderteken hieronder om je keuzes te bevestigen (optioneel).', yourName: 'Je naam', clear: 'Wissen', signSave: 'Bevestigen & ondertekenen', signed: 'Ondertekend — bedankt!', payTitle: 'Betaling', payNow: 'Nu betalen', payDeposit: 'Aanbetaling doen', paid: 'Betaling ontvangen', qaDemoReply: 'Bedankt — je aannemer reageert snel.', awaitingReply: 'Wachten op antwoord van je aannemer…' },
  de: { eyebrow: 'Deine Auswahl', appCta: 'In Vasco-App öffnen', code: 'Zugangscode', loading: 'Dein Projekt wird geladen…', notFoundTitle: 'Link nicht gefunden', notFoundBody: 'Dieser Link ist ungültig oder wurde entfernt. Bitte deinen Handwerker um einen neuen.', expiredTitle: 'Link abgelaufen', expiredBody: 'Dieser Link ist nicht mehr aktiv. Bitte deinen Handwerker, ihn erneut zu senden.', retry: 'Erneut versuchen', decidedOf: 'entschieden', choose: 'Wähle eine', included: 'Inbegriffen', yourChoice: 'Deine Wahl', change: 'Ändern', save: 'Speichern', saving: 'Speichern…', saved: 'Gespeichert — an deinen Handwerker gesendet', savedLocal: 'Auf deinem Gerät gespeichert — wir senden es, sobald du wieder online bist', allDoneTitle: 'Alles erledigt!', allDoneBody: 'Du hast alle Auswahlen getroffen. Dein Handwerker hat sie.', typeAnswer: 'Gib deine Antwort ein', footer: '© Vasco · vascobuild.com', runningCost: 'Deine bisherige Auswahl', vsBase: 'ggü. Basisangebot', noExtra: 'Keine Mehrkosten', glossaryBtn: 'Was bedeuten diese Wörter?', glossaryTitle: 'Wörter erklärt', close: 'Schließen', addPhotos: 'Fotos hinzufügen', uploading: 'Hochladen…', askTitle: 'Eine Frage?', askPlaceholder: 'Frag deinen Handwerker alles…', send: 'Senden', sending: 'Senden…', yourQuestions: 'Deine Fragen', signTitle: 'Bestätige deine Auswahl', signBody: 'Unterschreibe unten, um deine Auswahl zu bestätigen (optional).', yourName: 'Dein Name', clear: 'Löschen', signSave: 'Bestätigen & unterschreiben', signed: 'Unterschrieben — danke!', payTitle: 'Zahlung', payNow: 'Jetzt zahlen', payDeposit: 'Anzahlung leisten', paid: 'Zahlung erhalten', qaDemoReply: 'Danke — dein Handwerker antwortet bald.', awaitingReply: 'Warten auf die Antwort deines Handwerkers…' },
  fr: { eyebrow: 'Vos choix', appCta: "Ouvrir dans l'app Vasco", code: "Code d'accès", loading: 'Chargement de votre projet…', notFoundTitle: 'Lien introuvable', notFoundBody: "Ce lien est invalide ou a été supprimé. Demandez-en un nouveau à votre artisan.", expiredTitle: 'Lien expiré', expiredBody: "Ce lien n'est plus actif. Demandez à votre artisan de le renvoyer.", retry: 'Réessayer', decidedOf: 'décidé', choose: 'Choisissez-en un', included: 'Inclus', yourChoice: 'Votre choix', change: 'Modifier', save: 'Enregistrer', saving: 'Enregistrement…', saved: 'Enregistré — envoyé à votre artisan', savedLocal: "Enregistré sur votre appareil — nous l'enverrons dès votre retour en ligne", allDoneTitle: 'Tout est prêt !', allDoneBody: 'Vous avez fait tous vos choix. Votre artisan les a reçus.', typeAnswer: 'Saisissez votre réponse', footer: '© Vasco · vascobuild.com', runningCost: 'Vos choix jusqu’ici', vsBase: 'vs devis de base', noExtra: 'Sans coût supplémentaire', glossaryBtn: 'Que signifient ces mots ?', glossaryTitle: 'Mots expliqués', close: 'Fermer', addPhotos: 'Ajouter des photos', uploading: 'Téléversement…', askTitle: 'Une question ?', askPlaceholder: 'Demandez à votre artisan…', send: 'Envoyer', sending: 'Envoi…', yourQuestions: 'Vos questions', signTitle: 'Confirmez vos choix', signBody: 'Signez ci-dessous pour confirmer vos choix (facultatif).', yourName: 'Votre nom', clear: 'Effacer', signSave: 'Confirmer & signer', signed: 'Signé — merci !', payTitle: 'Paiement', payNow: 'Payer maintenant', payDeposit: 'Payer l’acompte', paid: 'Paiement reçu', qaDemoReply: 'Merci — votre artisan répondra bientôt.', awaitingReply: 'En attente de la réponse de votre artisan…' },
  es: { eyebrow: 'Tus elecciones', appCta: 'Abrir en la app Vasco', code: 'Código de acceso', loading: 'Cargando tu proyecto…', notFoundTitle: 'Enlace no encontrado', notFoundBody: 'Este enlace no es válido o se ha eliminado. Pide uno nuevo a tu contratista.', expiredTitle: 'Enlace caducado', expiredBody: 'Este enlace ya no está activo. Pide a tu contratista que lo reenvíe.', retry: 'Reintentar', decidedOf: 'decidido', choose: 'Elige una', included: 'Incluido', yourChoice: 'Tu elección', change: 'Cambiar', save: 'Guardar', saving: 'Guardando…', saved: 'Guardado — enviado a tu contratista', savedLocal: 'Guardado en tu dispositivo — lo enviaremos cuando vuelvas a estar en línea', allDoneTitle: '¡Todo listo!', allDoneBody: 'Has hecho todas tus elecciones. Tu contratista las tiene.', typeAnswer: 'Escribe tu respuesta', footer: '© Vasco · vascobuild.com', runningCost: 'Tus elecciones hasta ahora', vsBase: 'vs presupuesto base', noExtra: 'Sin coste extra', glossaryBtn: '¿Qué significan estas palabras?', glossaryTitle: 'Palabras explicadas', close: 'Cerrar', addPhotos: 'Añadir fotos', uploading: 'Subiendo…', askTitle: '¿Una pregunta?', askPlaceholder: 'Pregunta lo que quieras a tu contratista…', send: 'Enviar', sending: 'Enviando…', yourQuestions: 'Tus preguntas', signTitle: 'Confirma tus elecciones', signBody: 'Firma abajo para confirmar tus elecciones (opcional).', yourName: 'Tu nombre', clear: 'Borrar', signSave: 'Confirmar y firmar', signed: 'Firmado — ¡gracias!', payTitle: 'Pago', payNow: 'Pagar ahora', payDeposit: 'Pagar anticipo', paid: 'Pago recibido', qaDemoReply: 'Gracias — tu contratista responderá pronto.', awaitingReply: 'Esperando la respuesta de tu contratista…' },
  it: { eyebrow: 'Le tue scelte', appCta: "Apri nell'app Vasco", code: 'Codice di accesso', loading: 'Caricamento del tuo progetto…', notFoundTitle: 'Link non trovato', notFoundBody: 'Questo link non è valido o è stato rimosso. Chiedine uno nuovo al tuo contractor.', expiredTitle: 'Link scaduto', expiredBody: 'Questo link non è più attivo. Chiedi al tuo contractor di reinviarlo.', retry: 'Riprova', decidedOf: 'deciso', choose: 'Scegline una', included: 'Incluso', yourChoice: 'La tua scelta', change: 'Modifica', save: 'Salva', saving: 'Salvataggio…', saved: 'Salvato — inviato al tuo contractor', savedLocal: 'Salvato sul tuo dispositivo — lo invieremo appena tornerai online', allDoneTitle: 'Tutto pronto!', allDoneBody: 'Hai fatto tutte le tue scelte. Il tuo contractor le ha ricevute.', typeAnswer: 'Scrivi la tua risposta', footer: '© Vasco · vascobuild.com', runningCost: 'Le tue scelte finora', vsBase: 'vs preventivo base', noExtra: 'Nessun costo extra', glossaryBtn: 'Cosa significano queste parole?', glossaryTitle: 'Parole spiegate', close: 'Chiudi', addPhotos: 'Aggiungi foto', uploading: 'Caricamento…', askTitle: 'Una domanda?', askPlaceholder: 'Chiedi qualsiasi cosa al tuo contractor…', send: 'Invia', sending: 'Invio…', yourQuestions: 'Le tue domande', signTitle: 'Conferma le tue scelte', signBody: 'Firma qui sotto per confermare le tue scelte (facoltativo).', yourName: 'Il tuo nome', clear: 'Cancella', signSave: 'Conferma e firma', signed: 'Firmato — grazie!', payTitle: 'Pagamento', payNow: 'Paga ora', payDeposit: 'Paga acconto', paid: 'Pagamento ricevuto', qaDemoReply: 'Grazie — il tuo contractor risponderà presto.', awaitingReply: 'In attesa della risposta del tuo contractor…' },
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
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [qa, setQa] = useState<QAEntry[]>([]);
  const [qDraft, setQDraft] = useState('');
  const [qSending, setQSending] = useState(false);
  const [signed, setSigned] = useState(false);

  const deepLink = `vasco://customer/${encodeURIComponent(code)}`;
  const fmt = useMemo(() => moneyFmt(data?.contractorCountry, lang), [data?.contractorCountry, lang]);

  const load = useCallback(async () => {
    setPhase('loading');
    if (!isSupabaseConfigured()) { setPhase('app_only'); return; }
    const sb = getSupabase();
    if (!sb) { setPhase('app_only'); return; }
    try {
      const { data: raw, error } = await sb.rpc('get_portal_by_access_code', { p_access_code: code });
      if (error) { setPhase('app_only'); return; }
      if (!raw || typeof raw !== 'object') { setPhase('not_found'); return; }
      if ((raw as Record<string, unknown>).expired === true) { setPhase('expired'); return; }
      setData(raw as unknown as PortalData);
      setPhase('ready');
    } catch { setPhase('app_only'); }
  }, [code]);

  useEffect(() => { void load(); }, [load]);

  const showToast = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(null), 3500); };

  const submit = useCallback(async (item: PortalItem, value: string, photos?: string[]) => {
    if (!data) return;
    setPendingItem(item.id);
    setData(prev => prev ? {
      ...prev,
      completedDecisions: prev.categories.flatMap(c => c.items).find(i => i.id === item.id)?.status === 'decided'
        ? prev.completedDecisions : Math.min(prev.totalDecisions, prev.completedDecisions + 1),
      categories: prev.categories.map(c => ({
        ...c,
        items: c.items.map(i => i.id === item.id ? { ...i, value, status: 'decided', photoUrls: photos ?? i.photoUrls } : i),
        completedCount: c.items.some(i => i.id === item.id && i.status !== 'decided') ? c.completedCount + 1 : c.completedCount,
      })),
    } : prev);
    setEditing(null);
    const sb = getSupabase();
    let ok = false;
    if (sb) {
      try {
        const row: Record<string, unknown> = { tracker_id: data.accessToken, item_id: item.id, submitted_by: 'customer', value, submitted_at: new Date().toISOString() };
        if (photos && photos.length) row.photos = photos;
        const { error } = await sb.from('decision_submissions').upsert(row, { onConflict: 'tracker_id,item_id,submitted_by' });
        if (!error) { ok = true; try { await sb.rpc('update_tracker_progress', { p_tracker_id: data.accessToken }); } catch { /* non-critical */ } }
      } catch { /* local */ }
    }
    setPendingItem(null);
    showToast(ok ? t.saved : t.savedLocal);
  }, [data, t]);

  const uploadPhotos = useCallback(async (item: PortalItem, files: FileList) => {
    if (!data) return;
    setPendingItem(item.id);
    const sb = getSupabase();
    const urls: string[] = [];
    if (sb) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.type === 'image/png' ? 'png' : 'jpg';
        const filename = `${data.accessToken}/${Date.now()}-${i}.${ext}`;
        try {
          const { error } = await sb.storage.from(BUCKET).upload(filename, file, { contentType: file.type || 'image/jpeg', upsert: false });
          if (error) continue;
          const { data: signedUrl } = await sb.storage.from(BUCKET).createSignedUrl(filename, 60 * 60 * 24 * 30);
          if (signedUrl?.signedUrl) urls.push(signedUrl.signedUrl);
        } catch { /* skip */ }
      }
    }
    if (urls.length) await submit(item, `${urls.length} photo(s)`, urls);
    else { setPendingItem(null); showToast(t.savedLocal); }
  }, [data, submit, t]);

  const sendQuestion = useCallback(async () => {
    const q = qDraft.trim();
    if (!q || !data) return;
    setQSending(true);
    const localId = `q_${Date.now()}`;
    setQa(prev => [...prev, { id: localId, q, a: null, pending: true }]);
    setQDraft('');
    const sb = getSupabase();
    const demo = data.accessToken.length < 8;
    if (!sb || demo) {
      setQa(prev => prev.map(e => e.id === localId ? { ...e, a: t.qaDemoReply, pending: false } : e));
      setQSending(false);
      return;
    }
    try {
      const { data: res } = await sb.functions.invoke('classify-customer-question', { body: { trackerAccessToken: data.accessToken, question: q, customerName: 'customer', language: lang } });
      const r = res as { id?: string; autoReply?: string; pending?: boolean } | null;
      // autoReply present → answered now; otherwise leave pending and let the
      // realtime effect fill it in when the contractor approves a reply.
      setQa(prev => prev.map(e => e.id === localId ? { ...e, dbId: r?.id, a: r?.autoReply ?? null, pending: !r?.autoReply } : e));
    } catch {
      setQa(prev => prev.map(e => e.id === localId ? { ...e, a: t.qaDemoReply, pending: false } : e));
    }
    setQSending(false);
  }, [qDraft, data, lang, t]);

  // Realtime: when a question is awaiting the contractor's reply, subscribe to
  // customer_questions UPDATEs (R308 added it to the realtime publication with
  // REPLICA IDENTITY FULL) and drop the approved reply into the thread live.
  // A 20s poll is kept as a fallback in case realtime isn't enabled yet.
  const pendingReplyIds = qa.filter(e => e.pending && e.dbId).map(e => e.dbId as string);
  const pendingReplyKey = pendingReplyIds.join(',');
  useEffect(() => {
    if (!pendingReplyKey) return;
    const sb = getSupabase();
    if (!sb) return;
    const ids = pendingReplyKey.split(',');
    const apply = (dbId: string, row: Record<string, unknown> | null | undefined) => {
      if (!row) return;
      const reply = (row.approved_reply as string | null) ?? (row.auto_sent ? (row.ai_reply_draft as string | null) : null);
      if (reply) setQa(prev => prev.map(e => e.dbId === dbId ? { ...e, a: reply, pending: false } : e));
    };
    const channels = ids.map(dbId =>
      sb.channel(`cq:${dbId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'customer_questions', filter: `id=eq.${dbId}` }, payload => apply(dbId, payload.new as Record<string, unknown>))
        .subscribe()
    );
    const iv = window.setInterval(() => {
      ids.forEach(async dbId => {
        try {
          const { data: row } = await sb.from('customer_questions').select('status, approved_reply, auto_sent, ai_reply_draft').eq('id', dbId).maybeSingle();
          apply(dbId, row as Record<string, unknown> | null);
        } catch { /* ignore */ }
      });
    }, 20000);
    return () => { channels.forEach(c => { try { void sb.removeChannel(c); } catch { /* ignore */ } }); window.clearInterval(iv); };
  }, [pendingReplyKey]);

  if (phase === 'loading') return <Centered><Spinner /><p style={{ color: DK.muted, marginTop: 16 }}>{t.loading}</p></Centered>;
  if (phase === 'not_found') return <Message icon="✕" title={t.notFoundTitle} body={t.notFoundBody} action={{ label: t.retry, onClick: () => void load() }} code={code} codeLabel={t.code} />;
  if (phase === 'expired') return <Message icon="⏳" title={t.expiredTitle} body={t.expiredBody} action={{ label: t.retry, onClick: () => void load() }} code={code} codeLabel={t.code} />;
  if (phase === 'app_only' || !data) return <AppRedirect code={code} lang={lang} deepLink={deepLink} />;

  const allItems = data.categories.flatMap(c => c.items);
  const allDone = data.totalDecisions > 0 && data.completedDecisions >= data.totalDecisions;
  const upgradeTotal = allItems.reduce((sum, i) => sum + ((i.options ?? []).find(o => o.value === String(i.value))?.priceImpact ?? 0), 0);

  return (
    <main style={{ minHeight: '100vh', background: DK.bg, color: DK.text, fontFamily: 'var(--font-inter), system-ui, sans-serif', paddingBottom: 48 }}>
      <header style={{ background: 'linear-gradient(180deg, rgba(249,115,22,0.14), rgba(249,115,22,0))', borderBottom: `1px solid ${DK.border}`, padding: '28px 20px 22px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Image src="/vasco-logo.png" alt="Vasco" width={22} height={22} priority style={{ borderRadius: 5 }} />
            <span style={{ fontFamily: 'var(--font-archivo), sans-serif', fontWeight: 900, fontSize: 13, letterSpacing: 1.4, textTransform: 'uppercase' }}>Vasco</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: DK.amber, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 700 }}>{t.eyebrow}</span>
          </div>
          <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-archivo), var(--font-inter), sans-serif', letterSpacing: -0.4 }}>{data.projectName}</h1>
          <p style={{ margin: 0, color: DK.muted, fontSize: 14 }}>{data.contractorName}</p>
          <div style={{ marginTop: 16 }}>
            <div style={{ height: 8, background: DK.panel2, borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${data.totalDecisions ? (data.completedDecisions / data.totalDecisions) * 100 : 0}%`, background: `linear-gradient(90deg, ${DK.accent}, ${DK.amber})`, transition: 'width 0.3s ease' }} />
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 12, color: DK.muted }}>{data.completedDecisions} / {data.totalDecisions} {t.decidedOf}</p>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
            <a href={deepLink} style={{ fontSize: 12, color: DK.accent, textDecoration: 'none', fontWeight: 600 }}>{t.appCta} →</a>
            <button onClick={() => setGlossaryOpen(true)} style={{ background: 'none', border: 'none', color: DK.muted, fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>{t.glossaryBtn}</button>
          </div>
        </div>
      </header>

      {/* Running cost */}
      {data.completedDecisions > 0 && (
        <div style={{ maxWidth: 560, margin: '16px auto 0', padding: '0 20px' }}>
          <div style={{ background: DK.panel, border: `1px solid ${DK.border}`, borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: DK.muted }}>{t.runningCost}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: upgradeTotal > 0 ? DK.amber : DK.green }}>
              {upgradeTotal === 0 ? t.noExtra : `+${fmt.format(upgradeTotal)}`}{upgradeTotal > 0 ? <span style={{ fontSize: 11, color: DK.muted, fontWeight: 500 }}> {t.vsBase}</span> : null}
            </span>
          </div>
        </div>
      )}

      {allDone && (
        <div style={{ maxWidth: 560, margin: '16px auto 0', padding: '0 20px' }}>
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
              const isPhoto = opts.length === 0 && item.inputType === 'photo';
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
                      {opts.length > 0 && <button onClick={() => setEditing(item.id)} style={btnGhost}>{t.change}</button>}
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
                  ) : isPhoto ? (
                    <PhotoUpload item={item} t={t} pending={pendingItem === item.id} onPick={(files) => void uploadPhotos(item, files)} />
                  ) : opts.length === 0 ? (
                    <FreeText item={item} t={t} pending={pendingItem === item.id} onSave={(v) => void submit(item, v)} />
                  ) : null}
                </article>
              );
            })}
          </section>
        ))}
      </div>

      {/* Acknowledgement signature — shown once everything is decided */}
      {allDone && !signed && (
        <div style={{ maxWidth: 560, margin: '24px auto 0', padding: '0 20px' }}>
          <SignaturePad t={t} country={data.contractorCountry} onSign={async (name, svg) => {
            const sb = getSupabase();
            if (sb && data.accessToken.length >= 4) {
              try { await sb.rpc('write_signature_via_portal', { p_access_code: data.accessToken, p_signer_name: name, p_signer_role: 'customer', p_signature_svg: svg, p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null }); } catch { /* best-effort */ }
            }
            setSigned(true); showToast(t.signed);
          }} />
        </div>
      )}
      {signed && (
        <div style={{ maxWidth: 560, margin: '24px auto 0', padding: '0 20px' }}>
          <div style={{ background: 'rgba(34,197,94,0.1)', border: `1px solid rgba(34,197,94,0.3)`, borderRadius: 14, padding: '16px 20px', textAlign: 'center', fontSize: 14, fontWeight: 600 }}>✓ {t.signed}</div>
        </div>
      )}

      {/* Payment CTA (renders only when the contractor attached a payment link) */}
      {data.paymentLink && data.paymentStatus !== 'paid' && (
        <div style={{ maxWidth: 560, margin: '24px auto 0', padding: '0 20px' }}>
          <div style={{ background: DK.panel, border: `1px solid ${DK.border}`, borderRadius: 14, padding: 18 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: DK.muted }}>{t.payTitle}</h3>
            <a href={data.paymentLink} style={{ ...btnPrimary, textDecoration: 'none', display: 'block', textAlign: 'center' }}>
              {data.depositAmount ? `${t.payDeposit} · ${fmt.format(data.depositAmount)}` : data.quoteAmount ? `${t.payNow} · ${fmt.format(data.quoteAmount)}` : t.payNow}
            </a>
          </div>
        </div>
      )}
      {data.paymentStatus === 'paid' && (
        <div style={{ maxWidth: 560, margin: '24px auto 0', padding: '0 20px' }}>
          <div style={{ background: 'rgba(34,197,94,0.1)', border: `1px solid rgba(34,197,94,0.3)`, borderRadius: 14, padding: '16px 20px', textAlign: 'center', fontSize: 14, fontWeight: 700 }}>✓ {t.paid}</div>
        </div>
      )}

      {/* Q&A */}
      <div style={{ maxWidth: 560, margin: '24px auto 0', padding: '0 20px' }}>
        <div style={{ background: DK.panel, border: `1px solid ${DK.border}`, borderRadius: 14, padding: 18 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: DK.muted }}>{t.askTitle}</h3>
          {qa.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
              {qa.map(e => (
                <div key={e.id}>
                  <div style={{ background: DK.panel2, borderRadius: 10, padding: '8px 12px', fontSize: 13 }}>{e.q}</div>
                  {e.pending ? <div style={{ fontSize: 12, color: DK.muted, padding: '6px 12px', fontStyle: 'italic' }}>{t.awaitingReply}</div>
                    : <div style={{ fontSize: 13, color: DK.muted, padding: '6px 12px', lineHeight: 1.5 }}>{e.a}</div>}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={qDraft} onChange={e => setQDraft(e.target.value)} placeholder={t.askPlaceholder} onKeyDown={e => { if (e.key === 'Enter') void sendQuestion(); }}
              style={{ flex: 1, background: DK.panel2, border: `1px solid ${DK.border}`, borderRadius: 10, padding: '10px 12px', color: DK.text, fontSize: 14 }} />
            <button disabled={qSending || !qDraft.trim()} onClick={() => void sendQuestion()} style={{ ...btnPrimary, opacity: qSending || !qDraft.trim() ? 0.5 : 1 }}>{qSending ? t.sending : t.send}</button>
          </div>
        </div>
      </div>

      <p style={{ textAlign: 'center', color: DK.muted, fontSize: 11, marginTop: 32 }}>{t.footer}</p>

      {glossaryOpen && <GlossaryModal lang={lang} t={t} onClose={() => setGlossaryOpen(false)} />}
      {toast && <div style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', background: DK.panel2, border: `1px solid ${DK.border}`, color: DK.text, padding: '12px 18px', borderRadius: 12, fontSize: 13, boxShadow: '0 8px 30px rgba(0,0,0,0.5)', maxWidth: 'calc(100% - 32px)', textAlign: 'center', zIndex: 50 }}>{toast}</div>}
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

function PhotoUpload({ item, t, pending, onPick }: { item: PortalItem; t: Record<string, string>; pending: boolean; onPick: (files: FileList) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div style={{ marginTop: 12 }}>
      {item.photoUrls && item.photoUrls.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- customer-uploaded signed URLs; next/image needs remotePatterns config we don't want here */}
          {item.photoUrls.map((u, i) => <img key={i} src={u} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: `1px solid ${DK.border}` }} />)}
        </div>
      )}
      <input ref={ref} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { if (e.target.files && e.target.files.length) onPick(e.target.files); }} />
      <button disabled={pending} onClick={() => ref.current?.click()} style={{ ...btnGhost, opacity: pending ? 0.5 : 1, width: '100%' }}>📷 {pending ? t.uploading : t.addPhotos}</button>
    </div>
  );
}

function SignaturePad({ t, country, onSign }: { t: Record<string, string>; country?: string; onSign: (name: string, svg: string) => void }) {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [saving, setSaving] = useState(false);
  const drawing = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);
  void country;

  const pt = (e: React.PointerEvent) => {
    const r = svgRef.current?.getBoundingClientRect();
    return { x: Math.round(e.clientX - (r?.left ?? 0)), y: Math.round(e.clientY - (r?.top ?? 0)) };
  };
  const down = (e: React.PointerEvent) => { drawing.current = true; const p = pt(e); setPath(prev => `${prev} M ${p.x} ${p.y}`.trim()); (e.target as Element).setPointerCapture?.(e.pointerId); };
  const move = (e: React.PointerEvent) => { if (!drawing.current) return; const p = pt(e); setPath(prev => `${prev} L ${p.x} ${p.y}`); };
  const up = () => { drawing.current = false; };

  return (
    <div style={{ background: DK.panel, border: `1px solid ${DK.border}`, borderRadius: 14, padding: 18 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 800 }}>{t.signTitle}</h3>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: DK.muted }}>{t.signBody}</p>
      <input value={name} onChange={e => setName(e.target.value)} placeholder={t.yourName}
        style={{ width: '100%', boxSizing: 'border-box', background: DK.panel2, border: `1px solid ${DK.border}`, borderRadius: 10, padding: '10px 12px', color: DK.text, fontSize: 14, marginBottom: 10 }} />
      <svg ref={svgRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
        style={{ width: '100%', height: 140, background: '#fff', borderRadius: 10, touchAction: 'none', cursor: 'crosshair' }}>
        <path d={path} stroke="#0B0E11" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={() => setPath('')} style={btnGhost}>{t.clear}</button>
        <button disabled={saving || !name.trim() || !path} onClick={async () => { setSaving(true); await onSign(name.trim(), path); }}
          style={{ ...btnPrimary, flex: 1, opacity: saving || !name.trim() || !path ? 0.5 : 1 }}>{saving ? t.saving : t.signSave}</button>
      </div>
    </div>
  );
}

function GlossaryModal({ lang, t, onClose }: { lang: Lang; t: Record<string, string>; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 60 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: DK.panel, borderTop: `1px solid ${DK.border}`, borderRadius: '18px 18px 0 0', width: '100%', maxWidth: 560, maxHeight: '80vh', overflowY: 'auto', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{t.glossaryTitle}</h3>
          <button onClick={onClose} style={btnGhost}>{t.close}</button>
        </div>
        {CUSTOMER_GLOSSARY.map(g => (
          <div key={g.id} style={{ padding: '12px 0', borderBottom: `1px solid ${DK.border}` }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{g.term[lang]}</div>
            <div style={{ fontSize: 13, color: DK.muted, lineHeight: 1.5 }}>{g.def[lang]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

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
