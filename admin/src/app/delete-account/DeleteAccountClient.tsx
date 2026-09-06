"use client";

// =============================================================================
// /delete-account — the WEB half of Google Play's account-deletion requirement
// =============================================================================
// Play requires deletion to be initiable BOTH inside the app and from a public
// web page, with that page's URL entered in the Data safety form. Vasco already
// had the in-app half (`requestAccountDeletion()` in app/contractor/legal.tsx);
// without this page the Data safety form is rejected as "invalid account/data
// deletion link".
//   https://support.google.com/googleplay/android-developer/answer/13327111
//
// WHY SIGN-IN RATHER THAN "TYPE YOUR EMAIL":
// An unauthenticated email box would let anyone queue deletion of someone
// else's account. Signing in proves ownership using machinery that already
// exists, and lets the insert run AS the user so the existing RLS policy
// (`auth.uid() = user_id`) enforces correctness — no service-role key in the
// browser, no new grant, no migration. `authenticated` already holds INSERT.
//
// This queues exactly the row the app queues; `drain-account-deletions`
// (pg_cron) performs the erasure. Nothing here deletes directly.
//
// ui-playbook §8: six languages from navigator.language, DK palette inline
// (this page ships without the RN theme module), German is Sie, and an
// irreversible action takes two steps — here, sign in and then type DELETE.
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

type Stage = "signin" | "confirm" | "done" | "already";
type Loc = "en" | "nl" | "de" | "fr" | "es" | "it";

const SUPPORT = "privacy@vascobuild.com";

// DK Sunset Slate, mirrored inline per ui-playbook §8.
const DK = {
  bg: "#0B0E11",
  panel: "#14181F",
  panel2: "#1C2128",
  border: "#2A3038",
  text: "#FFFFFF",
  muted: "#9CA3AF",
  accent: "#F97316",
  danger: "#FB7185",
  dangerBg: "#2B1219",
  good: "#34D399",
  goodBg: "#0E241C",
  amber: "#F59E0B",
  amberBg: "#2A2110",
};

interface Copy {
  title: string;
  lead: string;
  whatHeading: string;
  items: string[];
  retention: string;
  privacy: string;
  whySignIn: string;
  email: string;
  password: string;
  cont: string;
  checking: string;
  badCreds: string;
  confirmHeading: string;
  confirmBody: string;
  reason: string;
  optional: string;
  typeToConfirm: string;
  deleteBtn: string;
  submitting: string;
  doneHeading: string;
  doneBody: string;
  alreadyHeading: string;
  alreadyBody: string;
  inAppHint: string;
  questions: string;
  unavailable: string;
  genericError: string;
  expired: string;
}

const COPY: Record<Loc, Copy> = {
  en: {
    title: "Delete your Vasco account",
    lead: "This permanently erases your account and everything in it. It cannot be undone.",
    whatHeading: "What gets deleted",
    items: [
      "Your account and sign-in details",
      "Customers, jobs, quotes and invoices",
      "Photos, signatures and scanned documents",
      "Time entries, expenses and pricing history",
      "Connected accounting and payment integrations",
    ],
    retention:
      "Invoices already issued may be kept in anonymised form where tax law requires it — seven years in the Netherlands, ten in Germany. Everything else is erased.",
    privacy: "Privacy Policy",
    whySignIn:
      "Sign in to confirm this is your account. We ask because otherwise anyone could request deletion of someone else's data.",
    email: "Email",
    password: "Password",
    cont: "Continue",
    checking: "Checking…",
    badCreds:
      "That email and password did not match an account. If you have forgotten your password, reset it in the Vasco app first.",
    confirmHeading: "This permanently deletes everything listed above",
    confirmBody:
      "Your data is queued for erasure and removed within 30 days, as required by GDPR Article 17. You will not be able to sign in again.",
    reason: "Why are you leaving?",
    optional: "(optional)",
    typeToConfirm: "Type DELETE to confirm",
    deleteBtn: "Delete my account",
    submitting: "Submitting…",
    doneHeading: "Your account is scheduled for deletion",
    doneBody:
      "We have signed you out. Your data is erased within 30 days. Changed your mind? Email us before then and we can stop it.",
    alreadyHeading: "Deletion is already scheduled",
    alreadyBody:
      "Your account is queued for erasure and will be removed within 30 days. There is nothing else to do. To cancel, email us before it completes.",
    inAppHint:
      "Prefer to do this in the app? Open Vasco → Profile → Legal → Delete my account. Either route does the same thing.",
    questions: "Questions about your data:",
    unavailable:
      "Account deletion is temporarily unavailable here. Email us and we will delete your account within 30 days.",
    genericError: "Something went wrong. Please email us and we will handle it by hand.",
    expired: "Your session expired. Please sign in again.",
  },
  nl: {
    title: "Je Vasco-account verwijderen",
    lead: "Hiermee wis je je account en alles erin definitief. Dit kan niet ongedaan worden gemaakt.",
    whatHeading: "Wat wordt verwijderd",
    items: [
      "Je account en inloggegevens",
      "Klanten, klussen, offertes en facturen",
      "Foto's, handtekeningen en gescande documenten",
      "Urenregistratie, uitgaven en prijshistorie",
      "Gekoppelde boekhoud- en betaalintegraties",
    ],
    retention:
      "Al verstuurde facturen kunnen geanonimiseerd bewaard blijven waar de belastingwet dat vereist — zeven jaar in Nederland, tien in Duitsland. De rest wordt gewist.",
    privacy: "Privacyverklaring",
    whySignIn:
      "Log in om te bevestigen dat dit jouw account is. We vragen dit omdat anders iemand anders verwijdering van jouw gegevens zou kunnen aanvragen.",
    email: "E-mailadres",
    password: "Wachtwoord",
    cont: "Doorgaan",
    checking: "Controleren…",
    badCreds:
      "Dit e-mailadres en wachtwoord horen niet bij een account. Wachtwoord vergeten? Stel het eerst opnieuw in via de Vasco-app.",
    confirmHeading: "Hiermee verwijder je alles hierboven definitief",
    confirmBody:
      "Je gegevens worden binnen 30 dagen gewist, zoals AVG artikel 17 vereist. Je kunt daarna niet meer inloggen.",
    reason: "Waarom stop je?",
    optional: "(optioneel)",
    typeToConfirm: "Typ DELETE om te bevestigen",
    deleteBtn: "Verwijder mijn account",
    submitting: "Versturen…",
    doneHeading: "Je account staat klaar om verwijderd te worden",
    doneBody:
      "Je bent uitgelogd. Je gegevens worden binnen 30 dagen gewist. Toch bedacht? Mail ons voor die tijd, dan stoppen we het.",
    alreadyHeading: "Verwijdering is al ingepland",
    alreadyBody:
      "Je account staat in de wachtrij en wordt binnen 30 dagen verwijderd. Je hoeft niets meer te doen. Annuleren? Mail ons voordat het klaar is.",
    inAppHint:
      "Liever in de app? Open Vasco → Profiel → Juridisch → Account verwijderen. Beide routes doen hetzelfde.",
    questions: "Vragen over je gegevens:",
    unavailable:
      "Account verwijderen kan hier tijdelijk niet. Mail ons en we verwijderen je account binnen 30 dagen.",
    genericError: "Er ging iets mis. Mail ons, dan regelen we het handmatig.",
    expired: "Je sessie is verlopen. Log opnieuw in.",
  },
  de: {
    title: "Ihr Vasco-Konto löschen",
    lead: "Damit werden Ihr Konto und alle darin enthaltenen Daten endgültig gelöscht. Das lässt sich nicht rückgängig machen.",
    whatHeading: "Was gelöscht wird",
    items: [
      "Ihr Konto und Ihre Anmeldedaten",
      "Kunden, Aufträge, Angebote und Rechnungen",
      "Fotos, Unterschriften und gescannte Dokumente",
      "Zeiterfassung, Ausgaben und Preishistorie",
      "Verbundene Buchhaltungs- und Zahlungsintegrationen",
    ],
    retention:
      "Bereits gestellte Rechnungen können anonymisiert aufbewahrt werden, wo das Steuerrecht es verlangt — sieben Jahre in den Niederlanden, zehn in Deutschland. Alles andere wird gelöscht.",
    privacy: "Datenschutzerklärung",
    whySignIn:
      "Melden Sie sich an, um zu bestätigen, dass dies Ihr Konto ist. Wir fragen danach, weil sonst jede beliebige Person die Löschung fremder Daten beantragen könnte.",
    email: "E-Mail-Adresse",
    password: "Passwort",
    cont: "Weiter",
    checking: "Wird geprüft…",
    badCreds:
      "E-Mail-Adresse und Passwort gehören zu keinem Konto. Passwort vergessen? Setzen Sie es zuerst in der Vasco-App zurück.",
    confirmHeading: "Damit wird alles oben Genannte endgültig gelöscht",
    confirmBody:
      "Ihre Daten werden innerhalb von 30 Tagen gelöscht, wie Art. 17 DSGVO es verlangt. Eine erneute Anmeldung ist danach nicht mehr möglich.",
    reason: "Warum verlassen Sie uns?",
    optional: "(optional)",
    typeToConfirm: "Geben Sie DELETE ein, um zu bestätigen",
    deleteBtn: "Mein Konto löschen",
    submitting: "Wird gesendet…",
    doneHeading: "Ihr Konto ist zur Löschung vorgemerkt",
    doneBody:
      "Wir haben Sie abgemeldet. Ihre Daten werden innerhalb von 30 Tagen gelöscht. Anders entschieden? Schreiben Sie uns vorher, dann stoppen wir es.",
    alreadyHeading: "Die Löschung ist bereits vorgemerkt",
    alreadyBody:
      "Ihr Konto steht in der Warteschlange und wird innerhalb von 30 Tagen gelöscht. Sie müssen nichts weiter tun. Zum Abbrechen schreiben Sie uns, bevor der Vorgang abgeschlossen ist.",
    inAppHint:
      "Lieber in der App? Öffnen Sie Vasco → Profil → Rechtliches → Konto löschen. Beide Wege bewirken dasselbe.",
    questions: "Fragen zu Ihren Daten:",
    unavailable:
      "Das Löschen des Kontos ist hier vorübergehend nicht möglich. Schreiben Sie uns, dann löschen wir Ihr Konto innerhalb von 30 Tagen.",
    genericError: "Etwas ist schiefgelaufen. Schreiben Sie uns, dann erledigen wir es manuell.",
    expired: "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.",
  },
  fr: {
    title: "Supprimer votre compte Vasco",
    lead: "Cette action efface définitivement votre compte et tout ce qu'il contient. Elle est irréversible.",
    whatHeading: "Ce qui sera supprimé",
    items: [
      "Votre compte et vos identifiants",
      "Clients, chantiers, devis et factures",
      "Photos, signatures et documents scannés",
      "Heures, dépenses et historique des prix",
      "Intégrations comptables et de paiement connectées",
    ],
    retention:
      "Les factures déjà émises peuvent être conservées sous forme anonymisée là où la loi fiscale l'exige — sept ans aux Pays-Bas, dix en Allemagne. Tout le reste est effacé.",
    privacy: "Politique de confidentialité",
    whySignIn:
      "Connectez-vous pour confirmer qu'il s'agit bien de votre compte. Nous le demandons car sinon n'importe qui pourrait demander la suppression des données d'autrui.",
    email: "Adresse e-mail",
    password: "Mot de passe",
    cont: "Continuer",
    checking: "Vérification…",
    badCreds:
      "Cette adresse e-mail et ce mot de passe ne correspondent à aucun compte. Mot de passe oublié ? Réinitialisez-le d'abord dans l'app Vasco.",
    confirmHeading: "Ceci supprime définitivement tout ce qui est listé ci-dessus",
    confirmBody:
      "Vos données sont effacées sous 30 jours, comme l'exige l'article 17 du RGPD. Vous ne pourrez plus vous connecter.",
    reason: "Pourquoi partez-vous ?",
    optional: "(facultatif)",
    typeToConfirm: "Tapez DELETE pour confirmer",
    deleteBtn: "Supprimer mon compte",
    submitting: "Envoi…",
    doneHeading: "Votre compte est programmé pour suppression",
    doneBody:
      "Nous vous avons déconnecté. Vos données sont effacées sous 30 jours. Vous avez changé d'avis ? Écrivez-nous avant, nous pouvons l'arrêter.",
    alreadyHeading: "La suppression est déjà programmée",
    alreadyBody:
      "Votre compte est en file d'attente et sera supprimé sous 30 jours. Rien d'autre à faire. Pour annuler, écrivez-nous avant la fin du délai.",
    inAppHint:
      "Vous préférez le faire dans l'app ? Ouvrez Vasco → Profil → Mentions légales → Supprimer mon compte. Les deux font la même chose.",
    questions: "Questions sur vos données :",
    unavailable:
      "La suppression de compte est momentanément indisponible ici. Écrivez-nous et nous supprimerons votre compte sous 30 jours.",
    genericError: "Un problème est survenu. Écrivez-nous et nous le traiterons manuellement.",
    expired: "Votre session a expiré. Veuillez vous reconnecter.",
  },
  es: {
    title: "Eliminar tu cuenta de Vasco",
    lead: "Esto borra permanentemente tu cuenta y todo lo que contiene. No se puede deshacer.",
    whatHeading: "Qué se elimina",
    items: [
      "Tu cuenta y tus datos de acceso",
      "Clientes, trabajos, presupuestos y facturas",
      "Fotos, firmas y documentos escaneados",
      "Horas, gastos e historial de precios",
      "Integraciones de contabilidad y pagos conectadas",
    ],
    retention:
      "Las facturas ya emitidas pueden conservarse de forma anonimizada donde la ley fiscal lo exija — siete años en los Países Bajos, diez en Alemania. Todo lo demás se borra.",
    privacy: "Política de privacidad",
    whySignIn:
      "Inicia sesión para confirmar que esta es tu cuenta. Lo pedimos porque de lo contrario cualquiera podría solicitar el borrado de datos ajenos.",
    email: "Correo electrónico",
    password: "Contraseña",
    cont: "Continuar",
    checking: "Comprobando…",
    badCreds:
      "Ese correo y contraseña no coinciden con ninguna cuenta. ¿Has olvidado la contraseña? Restablécela primero en la app de Vasco.",
    confirmHeading: "Esto elimina permanentemente todo lo indicado arriba",
    confirmBody:
      "Tus datos se borran en un plazo de 30 días, según exige el artículo 17 del RGPD. No podrás volver a iniciar sesión.",
    reason: "¿Por qué te vas?",
    optional: "(opcional)",
    typeToConfirm: "Escribe DELETE para confirmar",
    deleteBtn: "Eliminar mi cuenta",
    submitting: "Enviando…",
    doneHeading: "Tu cuenta está programada para eliminarse",
    doneBody:
      "Hemos cerrado tu sesión. Tus datos se borran en 30 días. ¿Has cambiado de idea? Escríbenos antes y podemos detenerlo.",
    alreadyHeading: "La eliminación ya está programada",
    alreadyBody:
      "Tu cuenta está en cola y se eliminará en un plazo de 30 días. No hace falta nada más. Para cancelar, escríbenos antes de que se complete.",
    inAppHint:
      "¿Prefieres hacerlo en la app? Abre Vasco → Perfil → Legal → Eliminar mi cuenta. Ambas rutas hacen lo mismo.",
    questions: "Dudas sobre tus datos:",
    unavailable:
      "Eliminar la cuenta no está disponible aquí ahora mismo. Escríbenos y borraremos tu cuenta en 30 días.",
    genericError: "Algo ha ido mal. Escríbenos y lo resolvemos a mano.",
    expired: "Tu sesión ha caducado. Inicia sesión de nuevo.",
  },
  it: {
    title: "Elimina il tuo account Vasco",
    lead: "Questa operazione cancella definitivamente il tuo account e tutto ciò che contiene. Non è reversibile.",
    whatHeading: "Cosa viene eliminato",
    items: [
      "Il tuo account e le credenziali di accesso",
      "Clienti, lavori, preventivi e fatture",
      "Foto, firme e documenti scansionati",
      "Ore, spese e storico dei prezzi",
      "Integrazioni contabili e di pagamento collegate",
    ],
    retention:
      "Le fatture già emesse possono essere conservate in forma anonima dove la legge fiscale lo richiede — sette anni nei Paesi Bassi, dieci in Germania. Tutto il resto viene cancellato.",
    privacy: "Informativa sulla privacy",
    whySignIn:
      "Accedi per confermare che questo è il tuo account. Lo chiediamo perché altrimenti chiunque potrebbe chiedere la cancellazione dei dati altrui.",
    email: "Email",
    password: "Password",
    cont: "Continua",
    checking: "Verifica in corso…",
    badCreds:
      "Email e password non corrispondono a nessun account. Password dimenticata? Reimpostala prima nell'app Vasco.",
    confirmHeading: "Questo elimina definitivamente tutto quanto elencato sopra",
    confirmBody:
      "I tuoi dati vengono cancellati entro 30 giorni, come richiede l'articolo 17 del GDPR. Non potrai più accedere.",
    reason: "Perché ci lasci?",
    optional: "(facoltativo)",
    typeToConfirm: "Digita DELETE per confermare",
    deleteBtn: "Elimina il mio account",
    submitting: "Invio…",
    doneHeading: "Il tuo account è programmato per l'eliminazione",
    doneBody:
      "Ti abbiamo disconnesso. I tuoi dati vengono cancellati entro 30 giorni. Cambiato idea? Scrivici prima e possiamo fermare tutto.",
    alreadyHeading: "L'eliminazione è già programmata",
    alreadyBody:
      "Il tuo account è in coda e sarà eliminato entro 30 giorni. Non serve altro. Per annullare, scrivici prima che venga completata.",
    inAppHint:
      "Preferisci farlo nell'app? Apri Vasco → Profilo → Note legali → Elimina il mio account. Entrambe le strade fanno la stessa cosa.",
    questions: "Domande sui tuoi dati:",
    unavailable:
      "L'eliminazione dell'account non è disponibile qui al momento. Scrivici e cancelleremo il tuo account entro 30 giorni.",
    genericError: "Qualcosa è andato storto. Scrivici e ce ne occupiamo manualmente.",
    expired: "La sessione è scaduta. Accedi di nuovo.",
  },
};

function pickLocale(): Loc {
  if (typeof navigator === "undefined") return "en";
  const tag = (navigator.language || "en").slice(0, 2).toLowerCase();
  return (tag in COPY ? tag : "en") as Loc;
}

export default function DeleteAccountClient() {
  // Resolved after mount: navigator does not exist during prerender, and
  // reading it in useState would produce an en-first render that then swaps.
  const [loc, setLoc] = useState<Loc>("en");
  useEffect(() => setLoc(pickLocale()), []);
  const t = useMemo(() => COPY[loc], [loc]);

  const [stage, setStage] = useState<Stage>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const configured = isSupabaseConfigured();

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const sb = getSupabase();
      if (!sb) throw new Error("unavailable");

      const { data, error: signInError } = await sb.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError || !data.user) {
        setError(t.badCreds);
        return;
      }

      // Surface an existing request rather than stacking duplicates: the drain
      // job filters on status='pending', so a second row is a no-op that would
      // still read to the user as a fresh confirmation.
      const { data: existing } = await sb
        .from("account_deletion_requests")
        .select("id")
        .eq("user_id", data.user.id)
        .eq("status", "pending")
        .limit(1);

      setStage(existing && existing.length > 0 ? "already" : "confirm");
    } catch {
      setError(t.genericError);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const sb = getSupabase();
      if (!sb) throw new Error("unavailable");

      const { data: userData } = await sb.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        setError(t.expired);
        setStage("signin");
        return;
      }

      const { error: insertError } = await sb.from("account_deletion_requests").insert({
        user_id: uid,
        reason: reason.trim() || null,
        status: "pending",
      });
      if (insertError) {
        setError(t.genericError);
        return;
      }

      await sb.auth.signOut();
      setStage("done");
    } catch {
      setError(t.genericError);
    } finally {
      setBusy(false);
    }
  }

  const field: React.CSSProperties = {
    width: "100%",
    marginTop: 6,
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${DK.border}`,
    background: DK.panel2,
    color: DK.text,
    fontSize: 15,
  };
  const label: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: DK.text };
  const card = (bg: string, bd: string): React.CSSProperties => ({
    background: bg,
    border: `1px solid ${bd}`,
    borderRadius: 12,
    padding: 20,
  });

  return (
    <div style={{ background: DK.bg, minHeight: "100vh", color: DK.text }}>
      <main
        style={{
          maxWidth: 620,
          margin: "0 auto",
          padding: "48px 20px 96px",
          fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
          lineHeight: 1.6,
        }}
      >
        <a href="/" style={{ color: DK.muted, fontSize: 14, textDecoration: "none" }}>
          ← Vasco
        </a>

        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", margin: "22px 0 10px" }}>
          {t.title}
        </h1>
        <p style={{ color: DK.muted, margin: "0 0 28px" }}>{t.lead}</p>

        {!configured && (
          <div style={card(DK.amberBg, DK.amber)}>
            <p style={{ margin: 0, fontSize: 14 }}>
              {t.unavailable}{" "}
              <a href={`mailto:${SUPPORT}`} style={{ color: DK.amber }}>
                {SUPPORT}
              </a>
            </p>
          </div>
        )}

        {configured && stage === "signin" && (
          <>
            <section style={{ ...card(DK.panel, DK.border), marginBottom: 26 }}>
              <h2
                style={{
                  fontSize: 11,
                  letterSpacing: "0.13em",
                  textTransform: "uppercase",
                  color: DK.muted,
                  margin: "0 0 12px",
                }}
              >
                {t.whatHeading}
              </h2>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14.5 }}>
                {t.items.map((item) => (
                  <li key={item} style={{ marginBottom: 5 }}>
                    {item}
                  </li>
                ))}
              </ul>
              <p style={{ marginTop: 16, marginBottom: 0, fontSize: 13.5, color: DK.muted }}>
                {t.retention}{" "}
                <a href="/privacy" style={{ color: DK.accent }}>
                  {t.privacy}
                </a>
              </p>
            </section>

            <form onSubmit={handleSignIn}>
              <p style={{ fontSize: 14, color: DK.muted, marginTop: 0 }}>{t.whySignIn}</p>
              <div style={{ marginBottom: 14 }}>
                <label htmlFor="email" style={label}>
                  {t.email}
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  style={field}
                />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label htmlFor="password" style={label}>
                  {t.password}
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                  style={field}
                />
              </div>
              {error && <p style={{ color: DK.danger, fontSize: 14 }}>{error}</p>}
              <button
                type="submit"
                disabled={busy}
                style={{
                  background: DK.accent,
                  color: "#0B0E11",
                  border: 0,
                  borderRadius: 8,
                  padding: "11px 20px",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: busy ? "default" : "pointer",
                  opacity: busy ? 0.6 : 1,
                }}
              >
                {busy ? t.checking : t.cont}
              </button>
            </form>
          </>
        )}

        {configured && stage === "confirm" && (
          <form onSubmit={handleDelete}>
            <div style={{ ...card(DK.dangerBg, DK.danger), marginBottom: 22 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px", color: DK.danger }}>
                {t.confirmHeading}
              </h2>
              <p style={{ margin: 0, fontSize: 14 }}>{t.confirmBody}</p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label htmlFor="reason" style={label}>
                {t.reason} <span style={{ fontWeight: 400, color: DK.muted }}>{t.optional}</span>
              </label>
              <textarea
                id="reason"
                rows={3}
                value={reason}
                onChange={(ev) => setReason(ev.target.value)}
                style={{ ...field, resize: "vertical" }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label htmlFor="confirm" style={label}>
                {t.typeToConfirm}
              </label>
              <input
                id="confirm"
                value={confirmText}
                onChange={(ev) => setConfirmText(ev.target.value)}
                style={{ ...field, fontFamily: "ui-monospace, Menlo, monospace" }}
              />
            </div>

            {error && <p style={{ color: DK.danger, fontSize: 14 }}>{error}</p>}

            <button
              type="submit"
              disabled={busy || confirmText !== "DELETE"}
              style={{
                background: confirmText === "DELETE" ? DK.danger : DK.panel2,
                color: confirmText === "DELETE" ? "#2B1219" : DK.muted,
                border: `1px solid ${confirmText === "DELETE" ? DK.danger : DK.border}`,
                borderRadius: 8,
                padding: "11px 20px",
                fontSize: 15,
                fontWeight: 700,
                cursor: confirmText === "DELETE" && !busy ? "pointer" : "not-allowed",
              }}
            >
              {busy ? t.submitting : t.deleteBtn}
            </button>
          </form>
        )}

        {configured && stage === "already" && (
          <div style={card(DK.amberBg, DK.amber)}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px", color: DK.amber }}>
              {t.alreadyHeading}
            </h2>
            <p style={{ margin: 0, fontSize: 14 }}>
              {t.alreadyBody}{" "}
              <a href={`mailto:${SUPPORT}`} style={{ color: DK.amber }}>
                {SUPPORT}
              </a>
            </p>
          </div>
        )}

        {configured && stage === "done" && (
          <div style={card(DK.goodBg, DK.good)}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px", color: DK.good }}>
              {t.doneHeading}
            </h2>
            <p style={{ margin: 0, fontSize: 14 }}>
              {t.doneBody}{" "}
              <a href={`mailto:${SUPPORT}`} style={{ color: DK.good }}>
                {SUPPORT}
              </a>
            </p>
          </div>
        )}

        <footer
          style={{
            marginTop: 44,
            paddingTop: 20,
            borderTop: `1px solid ${DK.border}`,
            fontSize: 13.5,
            color: DK.muted,
          }}
        >
          <p style={{ margin: "0 0 8px" }}>{t.inAppHint}</p>
          <p style={{ margin: 0 }}>
            {t.questions}{" "}
            <a href={`mailto:${SUPPORT}`} style={{ color: DK.accent }}>
              {SUPPORT}
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
