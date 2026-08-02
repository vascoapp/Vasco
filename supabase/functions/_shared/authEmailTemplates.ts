// =============================================================================
// authEmailTemplates.ts — localized, branded auth email renderer (6 locales)
// =============================================================================
// Renders Supabase auth emails (confirm-signup, recovery, magic-link,
// email-change, invite, reauthentication) in the recipient's own language,
// in the DraftKings Sunset Slate identity (matches supabase/email-templates/*).
//
// Used by the `send-email` Send-Email-Hook edge function so a German / French /
// Spanish / Italian / UK contractor gets the email in their language instead of
// the Dutch-primary global templates. Falls back en → nl per country.
//
// The static HTML files under supabase/email-templates/ remain the fallback
// that Supabase's BUILT-IN sender uses when the hook is NOT enabled — keep the
// two in visual sync if you restyle.
// =============================================================================

export type EmailLocale = 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';
export type AuthEmailType =
  | 'confirmation'
  | 'recovery'
  | 'magic_link'
  | 'email_change'
  | 'invite'
  | 'reauthentication';

export interface RenderVars {
  /** Action link (verify URL). Not used by `reauthentication`. */
  actionUrl?: string;
  /** 6-digit code for `reauthentication`. */
  token?: string;
  /** Current address, for `email_change`. */
  email?: string;
  /** Requested new address, for `email_change`. */
  newEmail?: string;
}

// DK Sunset Slate tokens (kept literal so this file has no app-code imports).
const C = {
  bg: '#0B0E11',
  panel: '#14181F',
  panel2: '#1C2128',
  border: '#2A3038',
  white: '#FFFFFF',
  body: '#D1D5DB',
  muted: '#9CA3AF',
  faint: '#6B7280',
  faint2: '#4B5563',
  accent: '#F97316',
  accentDeep: '#C2410C',
  accentDark: '#9A3412',
  code: '#F59E0B',
};

// ---------------------------------------------------------------------------
// Localized strings. `{email}` / `{newEmail}` are substituted at render time.
// ---------------------------------------------------------------------------
interface TypeStrings {
  subject: string;
  preheader: string;
  heading: string;
  /** Body HTML (may contain <strong> and {email}/{newEmail}). */
  body: string;
  /** CTA label (omitted for reauthentication). */
  cta?: string;
  /** Expiry + safety note. */
  note: string;
  /** Footer "you're receiving this because…" line. */
  reason: string;
}

interface Common {
  buttonNotWorking: string;
  tagline: string;
  codeIntro: string; // reauthentication: "use this code…"
}

type LocaleBlock = { common: Common } & Record<AuthEmailType, TypeStrings>;

const STRINGS: Record<EmailLocale, LocaleBlock> = {
  // ------------------------------------------------------------------- EN ---
  en: {
    common: {
      buttonNotWorking: "Button not working? Copy this link into your browser:",
      tagline: 'smart admin for tradespeople',
      codeIntro: 'Use this code to confirm your identity in Vasco:',
    },
    confirmation: {
      subject: 'Confirm your email · Vasco',
      preheader: 'One tap and your Vasco account is live.',
      heading: 'Confirm your email',
      body: 'Welcome to Vasco! Tap the button below to confirm your email address and activate your account. Then you can get straight to quotes, invoices and your schedule.',
      cta: 'Confirm email',
      note: "This link expires in 24 hours and works once. Didn't create a Vasco account? You can safely ignore this email — nothing will happen.",
      reason: "You're receiving this email because this address was used to create a Vasco account.",
    },
    recovery: {
      subject: 'Reset your password · Vasco',
      preheader: 'Choose a new password for your Vasco account.',
      heading: 'Reset your password',
      body: 'We received a request to reset the password for your Vasco account. Tap the button below to choose a new password.',
      cta: 'Choose new password',
      note: "This link expires in 1 hour and works once. Didn't request this? You can safely ignore this email — your password stays unchanged.",
      reason: "You're receiving this email because a password reset was requested for this address.",
    },
    magic_link: {
      subject: 'Your sign-in link · Vasco',
      preheader: 'Sign in to Vasco instantly — no password needed.',
      heading: 'Your sign-in link',
      body: 'Tap the button below to sign in to Vasco instantly. No password needed.',
      cta: 'Sign in to Vasco',
      note: "This link works once and expires in 1 hour. Didn't request it? You can safely ignore this email.",
      reason: "You're receiving this email because a sign-in link was requested for this address.",
    },
    email_change: {
      subject: 'Confirm your new email · Vasco',
      preheader: 'Confirm your Vasco account email change.',
      heading: 'Confirm your new email',
      body: 'You requested to change your Vasco account email from <strong style="color:#FFFFFF;">{email}</strong> to <strong style="color:#FFFFFF;">{newEmail}</strong>. Tap the button below to confirm.',
      cta: 'Confirm change',
      note: "Didn't request this change? You can safely ignore this email — your address stays unchanged.",
      reason: "You're receiving this email because an email change was requested for your Vasco account.",
    },
    invite: {
      subject: "You're invited to Vasco",
      preheader: 'Create your account and get started right away.',
      heading: "You're invited",
      body: "You've been invited to join Vasco — the smart admin app for trade professionals. Quotes, invoices, scheduling and compliance in one place. Tap the button to create your account.",
      cta: 'Accept invitation',
      note: "Not expecting this invite? You can safely ignore this email — no account will be created.",
      reason: "You're receiving this email because someone invited you to Vasco at this address.",
    },
    reauthentication: {
      subject: 'Your verification code · Vasco',
      preheader: 'Your Vasco verification code.',
      heading: 'Your verification code',
      body: 'Use this code to confirm your identity in Vasco:',
      note: 'This code expires in a few minutes. Never share it — Vasco will never ask for it by phone or message. If you didn’t request it, you can safely ignore this email.',
      reason: "You're receiving this email because a verification was requested for your Vasco account.",
    },
  },
  // ------------------------------------------------------------------- NL ---
  nl: {
    common: {
      buttonNotWorking: 'Werkt de knop niet? Kopieer deze link naar je browser:',
      tagline: 'slimme administratie voor vakmensen',
      codeIntro: 'Gebruik deze code om je identiteit te bevestigen in Vasco:',
    },
    confirmation: {
      subject: 'Bevestig je e-mailadres · Vasco',
      preheader: 'Eén tik en je Vasco-account is actief.',
      heading: 'Bevestig je e‑mailadres',
      body: 'Welkom bij Vasco! Tik op de knop hieronder om je e-mailadres te bevestigen en je account te activeren. Daarna kun je direct aan de slag met offertes, facturen en je planning.',
      cta: 'Bevestig e‑mailadres',
      note: 'Deze link verloopt na 24 uur en werkt één keer. Heb je geen account aangemaakt bij Vasco? Negeer dan deze e-mail — er gebeurt niets.',
      reason: 'Je ontvangt deze e-mail omdat dit adres is gebruikt om een Vasco-account aan te maken.',
    },
    recovery: {
      subject: 'Wachtwoord opnieuw instellen · Vasco',
      preheader: 'Kies binnen 1 uur een nieuw wachtwoord voor je Vasco-account.',
      heading: 'Wachtwoord opnieuw instellen',
      body: 'We ontvingen een verzoek om het wachtwoord van je Vasco-account opnieuw in te stellen. Tik op de knop hieronder om een nieuw wachtwoord te kiezen.',
      cta: 'Kies nieuw wachtwoord',
      note: 'Deze link verloopt na 1 uur en werkt één keer. Heb je dit niet aangevraagd? Negeer dan deze e-mail — je wachtwoord blijft ongewijzigd.',
      reason: 'Je ontvangt deze e-mail omdat er een wachtwoordherstel is aangevraagd voor dit adres.',
    },
    magic_link: {
      subject: 'Je inloglink · Vasco',
      preheader: 'Log direct in bij Vasco — geen wachtwoord nodig.',
      heading: 'Je inloglink',
      body: 'Tik op de knop hieronder om direct in te loggen bij Vasco. Geen wachtwoord nodig.',
      cta: 'Log in bij Vasco',
      note: 'Deze link werkt één keer en verloopt na 1 uur. Heb je dit niet aangevraagd? Negeer dan deze e-mail — niemand krijgt toegang tot je account zonder deze link.',
      reason: 'Je ontvangt deze e-mail omdat er een inloglink is aangevraagd voor dit adres.',
    },
    email_change: {
      subject: 'Bevestig je nieuwe e-mailadres · Vasco',
      preheader: 'Bevestig de wijziging van het e-mailadres van je Vasco-account.',
      heading: 'Bevestig je nieuwe e‑mailadres',
      body: 'Je hebt gevraagd het e-mailadres van je Vasco-account te wijzigen van <strong style="color:#FFFFFF;">{email}</strong> naar <strong style="color:#FFFFFF;">{newEmail}</strong>. Tik op de knop hieronder om de wijziging te bevestigen.',
      cta: 'Bevestig wijziging',
      note: 'Heb je deze wijziging niet aangevraagd? Negeer dan deze e-mail — je e-mailadres blijft ongewijzigd.',
      reason: 'Je ontvangt deze e-mail omdat er een e-mailwijziging is aangevraagd voor je Vasco-account.',
    },
    invite: {
      subject: 'Je bent uitgenodigd voor Vasco',
      preheader: 'Maak je account aan en ga direct aan de slag.',
      heading: 'Je bent uitgenodigd',
      body: 'Je bent uitgenodigd om mee te werken in Vasco — de slimme administratie-app voor vakmensen. Offertes, facturen, planning en compliance op één plek. Tik op de knop om je account aan te maken.',
      cta: 'Accepteer uitnodiging',
      note: 'Verwachtte je deze uitnodiging niet? Negeer dan deze e-mail — er wordt geen account aangemaakt.',
      reason: 'Je ontvangt deze e-mail omdat iemand je heeft uitgenodigd voor Vasco op dit adres.',
    },
    reauthentication: {
      subject: 'Je verificatiecode · Vasco',
      preheader: 'Je Vasco-verificatiecode — verloopt na enkele minuten.',
      heading: 'Je verificatiecode',
      body: 'Gebruik deze code om je identiteit te bevestigen in Vasco:',
      note: 'De code verloopt na enkele minuten. Deel deze code met niemand — Vasco vraagt er nooit om via telefoon of bericht. Heb je dit niet aangevraagd? Negeer dan deze e-mail.',
      reason: 'Je ontvangt deze e-mail omdat er een verificatie is aangevraagd voor je Vasco-account.',
    },
  },
  // ------------------------------------------------------------------- DE ---
  de: {
    common: {
      buttonNotWorking: 'Funktioniert die Schaltfläche nicht? Kopiere diesen Link in deinen Browser:',
      tagline: 'clevere Verwaltung für Handwerker',
      codeIntro: 'Verwende diesen Code, um deine Identität in Vasco zu bestätigen:',
    },
    confirmation: {
      subject: 'Bestätige deine E-Mail-Adresse · Vasco',
      preheader: 'Ein Tipp und dein Vasco-Konto ist aktiv.',
      heading: 'E-Mail bestätigen',
      body: 'Willkommen bei Vasco! Tippe auf die Schaltfläche unten, um deine E-Mail-Adresse zu bestätigen und dein Konto zu aktivieren. Danach kannst du direct mit Angeboten, Rechnungen und deiner Planung loslegen.',
      cta: 'E-Mail bestätigen',
      note: 'Dieser Link ist 24 Stunden gültig und funktioniert einmal. Du hast kein Vasco-Konto erstellt? Dann ignoriere diese E-Mail — es passiert nichts.',
      reason: 'Du erhältst diese E-Mail, weil mit dieser Adresse ein Vasco-Konto erstellt wurde.',
    },
    recovery: {
      subject: 'Passwort zurücksetzen · Vasco',
      preheader: 'Wähle ein neues Passwort für dein Vasco-Konto.',
      heading: 'Passwort zurücksetzen',
      body: 'Wir haben eine Anfrage erhalten, das Passwort deines Vasco-Kontos zurückzusetzen. Tippe auf die Schaltfläche unten, um ein neues Passwort zu wählen.',
      cta: 'Neues Passwort wählen',
      note: 'Dieser Link ist 1 Stunde gültig und funktioniert einmal. Nicht angefordert? Dann ignoriere diese E-Mail — dein Passwort bleibt unverändert.',
      reason: 'Du erhältst diese E-Mail, weil für diese Adresse ein Passwort-Reset angefordert wurde.',
    },
    magic_link: {
      subject: 'Dein Anmeldelink · Vasco',
      preheader: 'Melde dich sofort bei Vasco an — ohne Passwort.',
      heading: 'Dein Anmeldelink',
      body: 'Tippe auf die Schaltfläche unten, um dich sofort bei Vasco anzumelden. Kein Passwort nötig.',
      cta: 'Bei Vasco anmelden',
      note: 'Dieser Link funktioniert einmal und ist 1 Stunde gültig. Nicht angefordert? Dann ignoriere diese E-Mail.',
      reason: 'Du erhältst diese E-Mail, weil für diese Adresse ein Anmeldelink angefordert wurde.',
    },
    email_change: {
      subject: 'Bestätige deine neue E-Mail-Adresse · Vasco',
      preheader: 'Bestätige die Änderung der E-Mail-Adresse deines Vasco-Kontos.',
      heading: 'Neue E-Mail bestätigen',
      body: 'Du hast beantragt, die E-Mail-Adresse deines Vasco-Kontos von <strong style="color:#FFFFFF;">{email}</strong> auf <strong style="color:#FFFFFF;">{newEmail}</strong> zu ändern. Tippe auf die Schaltfläche unten, um die Änderung zu bestätigen.',
      cta: 'Änderung bestätigen',
      note: 'Diese Änderung nicht beantragt? Dann ignoriere diese E-Mail — deine Adresse bleibt unverändert.',
      reason: 'Du erhältst diese E-Mail, weil für dein Vasco-Konto eine E-Mail-Änderung angefordert wurde.',
    },
    invite: {
      subject: 'Du bist zu Vasco eingeladen',
      preheader: 'Erstelle dein Konto und leg direkt los.',
      heading: 'Du bist eingeladen',
      body: 'Du wurdest eingeladen, bei Vasco mitzumachen — der cleveren Verwaltungs-App für Handwerker. Angebote, Rechnungen, Planung und Compliance an einem Ort. Tippe auf die Schaltfläche, um dein Konto zu erstellen.',
      cta: 'Einladung annehmen',
      note: 'Diese Einladung nicht erwartet? Dann ignoriere diese E-Mail — es wird kein Konto erstellt.',
      reason: 'Du erhältst diese E-Mail, weil dich jemand unter dieser Adresse zu Vasco eingeladen hat.',
    },
    reauthentication: {
      subject: 'Dein Bestätigungscode · Vasco',
      preheader: 'Dein Vasco-Bestätigungscode — läuft in wenigen Minuten ab.',
      heading: 'Dein Bestätigungscode',
      body: 'Verwende diesen Code, um deine Identität in Vasco zu bestätigen:',
      note: 'Der Code läuft in wenigen Minuten ab. Teile ihn mit niemandem — Vasco fragt niemals per Telefon oder Nachricht danach. Nicht angefordert? Dann ignoriere diese E-Mail.',
      reason: 'Du erhältst diese E-Mail, weil für dein Vasco-Konto eine Bestätigung angefordert wurde.',
    },
  },
  // ------------------------------------------------------------------- FR ---
  fr: {
    common: {
      buttonNotWorking: 'Le bouton ne fonctionne pas ? Copie ce lien dans ton navigateur :',
      tagline: 'la gestion intelligente pour les artisans',
      codeIntro: 'Utilise ce code pour confirmer ton identité dans Vasco :',
    },
    confirmation: {
      subject: 'Confirme ton adresse e-mail · Vasco',
      preheader: 'Un tap et ton compte Vasco est actif.',
      heading: 'Confirme ton e-mail',
      body: 'Bienvenue sur Vasco ! Appuie sur le bouton ci-dessous pour confirmer ton adresse e-mail et activer ton compte. Tu pourras ensuite passer directement aux devis, factures et à ton planning.',
      cta: "Confirmer l'e-mail",
      note: "Ce lien expire dans 24 heures et fonctionne une seule fois. Tu n'as pas créé de compte Vasco ? Ignore simplement cet e-mail — rien ne se passera.",
      reason: 'Tu reçois cet e-mail car cette adresse a été utilisée pour créer un compte Vasco.',
    },
    recovery: {
      subject: 'Réinitialise ton mot de passe · Vasco',
      preheader: 'Choisis un nouveau mot de passe pour ton compte Vasco.',
      heading: 'Réinitialise ton mot de passe',
      body: 'Nous avons reçu une demande de réinitialisation du mot de passe de ton compte Vasco. Appuie sur le bouton ci-dessous pour choisir un nouveau mot de passe.',
      cta: 'Choisir un mot de passe',
      note: "Ce lien expire dans 1 heure et fonctionne une seule fois. Tu n'as rien demandé ? Ignore cet e-mail — ton mot de passe reste inchangé.",
      reason: 'Tu reçois cet e-mail car une réinitialisation de mot de passe a été demandée pour cette adresse.',
    },
    magic_link: {
      subject: 'Ton lien de connexion · Vasco',
      preheader: 'Connecte-toi à Vasco instantanément — sans mot de passe.',
      heading: 'Ton lien de connexion',
      body: 'Appuie sur le bouton ci-dessous pour te connecter instantanément à Vasco. Aucun mot de passe nécessaire.',
      cta: 'Se connecter à Vasco',
      note: "Ce lien fonctionne une seule fois et expire dans 1 heure. Tu n'as rien demandé ? Ignore cet e-mail.",
      reason: 'Tu reçois cet e-mail car un lien de connexion a été demandé pour cette adresse.',
    },
    email_change: {
      subject: 'Confirme ta nouvelle adresse e-mail · Vasco',
      preheader: "Confirme le changement d'adresse e-mail de ton compte Vasco.",
      heading: 'Confirme ta nouvelle adresse',
      body: "Tu as demandé à changer l'adresse e-mail de ton compte Vasco de <strong style=\"color:#FFFFFF;\">{email}</strong> vers <strong style=\"color:#FFFFFF;\">{newEmail}</strong>. Appuie sur le bouton ci-dessous pour confirmer.",
      cta: 'Confirmer le changement',
      note: "Tu n'as pas demandé ce changement ? Ignore cet e-mail — ton adresse reste inchangée.",
      reason: "Tu reçois cet e-mail car un changement d'adresse a été demandé pour ton compte Vasco.",
    },
    invite: {
      subject: 'Tu es invité sur Vasco',
      preheader: 'Crée ton compte et commence tout de suite.',
      heading: 'Tu es invité',
      body: "Tu as été invité à rejoindre Vasco — l'app de gestion intelligente pour les artisans. Devis, factures, planning et conformité au même endroit. Appuie sur le bouton pour créer ton compte.",
      cta: "Accepter l'invitation",
      note: "Tu n'attendais pas cette invitation ? Ignore cet e-mail — aucun compte ne sera créé.",
      reason: "Tu reçois cet e-mail car quelqu'un t'a invité sur Vasco à cette adresse.",
    },
    reauthentication: {
      subject: 'Ton code de vérification · Vasco',
      preheader: 'Ton code de vérification Vasco — expire dans quelques minutes.',
      heading: 'Ton code de vérification',
      body: 'Utilise ce code pour confirmer ton identité dans Vasco :',
      note: "Ce code expire dans quelques minutes. Ne le partage avec personne — Vasco ne le demandera jamais par téléphone ou message. Tu n'as rien demandé ? Ignore cet e-mail.",
      reason: 'Tu reçois cet e-mail car une vérification a été demandée pour ton compte Vasco.',
    },
  },
  // ------------------------------------------------------------------- ES ---
  es: {
    common: {
      buttonNotWorking: '¿El botón no funciona? Copia este enlace en tu navegador:',
      tagline: 'gestión inteligente para profesionales',
      codeIntro: 'Usa este código para confirmar tu identidad en Vasco:',
    },
    confirmation: {
      subject: 'Confirma tu correo · Vasco',
      preheader: 'Un toque y tu cuenta de Vasco estará activa.',
      heading: 'Confirma tu correo',
      body: '¡Bienvenido a Vasco! Toca el botón de abajo para confirmar tu correo y activar tu cuenta. Después podrás empezar directamente con presupuestos, facturas y tu agenda.',
      cta: 'Confirmar correo',
      note: 'Este enlace caduca en 24 horas y funciona una sola vez. ¿No creaste una cuenta de Vasco? Puedes ignorar este correo — no pasará nada.',
      reason: 'Recibes este correo porque esta dirección se usó para crear una cuenta de Vasco.',
    },
    recovery: {
      subject: 'Restablece tu contraseña · Vasco',
      preheader: 'Elige una nueva contraseña para tu cuenta de Vasco.',
      heading: 'Restablece tu contraseña',
      body: 'Recibimos una solicitud para restablecer la contraseña de tu cuenta de Vasco. Toca el botón de abajo para elegir una nueva contraseña.',
      cta: 'Elegir contraseña',
      note: 'Este enlace caduca en 1 hora y funciona una sola vez. ¿No lo solicitaste? Puedes ignorar este correo — tu contraseña no cambiará.',
      reason: 'Recibes este correo porque se solicitó restablecer la contraseña de esta dirección.',
    },
    magic_link: {
      subject: 'Tu enlace de acceso · Vasco',
      preheader: 'Accede a Vasco al instante — sin contraseña.',
      heading: 'Tu enlace de acceso',
      body: 'Toca el botón de abajo para acceder a Vasco al instante. No necesitas contraseña.',
      cta: 'Acceder a Vasco',
      note: 'Este enlace funciona una sola vez y caduca en 1 hora. ¿No lo solicitaste? Puedes ignorar este correo.',
      reason: 'Recibes este correo porque se solicitó un enlace de acceso para esta dirección.',
    },
    email_change: {
      subject: 'Confirma tu nuevo correo · Vasco',
      preheader: 'Confirma el cambio de correo de tu cuenta de Vasco.',
      heading: 'Confirma tu nuevo correo',
      body: 'Solicitaste cambiar el correo de tu cuenta de Vasco de <strong style="color:#FFFFFF;">{email}</strong> a <strong style="color:#FFFFFF;">{newEmail}</strong>. Toca el botón de abajo para confirmar.',
      cta: 'Confirmar cambio',
      note: '¿No solicitaste este cambio? Puedes ignorar este correo — tu dirección no cambiará.',
      reason: 'Recibes este correo porque se solicitó un cambio de correo en tu cuenta de Vasco.',
    },
    invite: {
      subject: 'Te han invitado a Vasco',
      preheader: 'Crea tu cuenta y empieza ahora mismo.',
      heading: 'Te han invitado',
      body: 'Te han invitado a unirte a Vasco — la app de gestión inteligente para profesionales. Presupuestos, facturas, agenda y cumplimiento en un solo lugar. Toca el botón para crear tu cuenta.',
      cta: 'Aceptar invitación',
      note: '¿No esperabas esta invitación? Puedes ignorar este correo — no se creará ninguna cuenta.',
      reason: 'Recibes este correo porque alguien te invitó a Vasco en esta dirección.',
    },
    reauthentication: {
      subject: 'Tu código de verificación · Vasco',
      preheader: 'Tu código de verificación de Vasco — caduca en unos minutos.',
      heading: 'Tu código de verificación',
      body: 'Usa este código para confirmar tu identidad en Vasco:',
      note: 'El código caduca en unos minutos. No lo compartas con nadie — Vasco nunca te lo pedirá por teléfono o mensaje. ¿No lo solicitaste? Puedes ignorar este correo.',
      reason: 'Recibes este correo porque se solicitó una verificación en tu cuenta de Vasco.',
    },
  },
  // ------------------------------------------------------------------- IT ---
  it: {
    common: {
      buttonNotWorking: 'Il pulsante non funziona? Copia questo link nel tuo browser:',
      tagline: 'gestione intelligente per artigiani',
      codeIntro: 'Usa questo codice per confermare la tua identità in Vasco:',
    },
    confirmation: {
      subject: 'Conferma la tua email · Vasco',
      preheader: 'Un tocco e il tuo account Vasco è attivo.',
      heading: 'Conferma la tua email',
      body: 'Benvenuto in Vasco! Tocca il pulsante qui sotto per confermare la tua email e attivare il tuo account. Poi potrai iniziare subito con preventivi, fatture e la tua agenda.',
      cta: 'Conferma email',
      note: 'Questo link scade tra 24 ore e funziona una sola volta. Non hai creato un account Vasco? Ignora questa email — non succederà nulla.',
      reason: 'Ricevi questa email perché questo indirizzo è stato usato per creare un account Vasco.',
    },
    recovery: {
      subject: 'Reimposta la password · Vasco',
      preheader: 'Scegli una nuova password per il tuo account Vasco.',
      heading: 'Reimposta la password',
      body: 'Abbiamo ricevuto una richiesta di reimpostazione della password del tuo account Vasco. Tocca il pulsante qui sotto per scegliere una nuova password.',
      cta: 'Scegli password',
      note: 'Questo link scade tra 1 ora e funziona una sola volta. Non l’hai richiesto? Ignora questa email — la tua password resta invariata.',
      reason: 'Ricevi questa email perché è stato richiesto un ripristino password per questo indirizzo.',
    },
    magic_link: {
      subject: 'Il tuo link di accesso · Vasco',
      preheader: 'Accedi a Vasco all’istante — senza password.',
      heading: 'Il tuo link di accesso',
      body: 'Tocca il pulsante qui sotto per accedere a Vasco all’istante. Nessuna password necessaria.',
      cta: 'Accedi a Vasco',
      note: 'Questo link funziona una sola volta e scade tra 1 ora. Non l’hai richiesto? Ignora questa email.',
      reason: 'Ricevi questa email perché è stato richiesto un link di accesso per questo indirizzo.',
    },
    email_change: {
      subject: 'Conferma la tua nuova email · Vasco',
      preheader: 'Conferma la modifica dell’email del tuo account Vasco.',
      heading: 'Conferma la tua nuova email',
      body: 'Hai richiesto di cambiare l’email del tuo account Vasco da <strong style="color:#FFFFFF;">{email}</strong> a <strong style="color:#FFFFFF;">{newEmail}</strong>. Tocca il pulsante qui sotto per confermare.',
      cta: 'Conferma modifica',
      note: 'Non hai richiesto questa modifica? Ignora questa email — il tuo indirizzo resta invariato.',
      reason: 'Ricevi questa email perché è stata richiesta una modifica email per il tuo account Vasco.',
    },
    invite: {
      subject: 'Sei stato invitato su Vasco',
      preheader: 'Crea il tuo account e inizia subito.',
      heading: 'Sei stato invitato',
      body: 'Sei stato invitato a unirti a Vasco — l’app di gestione intelligente per artigiani. Preventivi, fatture, agenda e conformità in un unico posto. Tocca il pulsante per creare il tuo account.',
      cta: 'Accetta l’invito',
      note: 'Non aspettavi questo invito? Ignora questa email — non verrà creato alcun account.',
      reason: 'Ricevi questa email perché qualcuno ti ha invitato su Vasco a questo indirizzo.',
    },
    reauthentication: {
      subject: 'Il tuo codice di verifica · Vasco',
      preheader: 'Il tuo codice di verifica Vasco — scade tra pochi minuti.',
      heading: 'Il tuo codice di verifica',
      body: 'Usa questo codice per confermare la tua identità in Vasco:',
      note: 'Il codice scade tra pochi minuti. Non condividerlo con nessuno — Vasco non lo chiederà mai per telefono o messaggio. Non l’hai richiesto? Ignora questa email.',
      reason: 'Ricevi questa email perché è stata richiesta una verifica per il tuo account Vasco.',
    },
  },
};

/** Country → email locale. Falls back to en for anything unmapped. */
const COUNTRY_TO_LOCALE: Record<string, EmailLocale> = {
  NL: 'nl', BE: 'nl', DE: 'de', AT: 'de', FR: 'fr', ES: 'es', IT: 'it',
  GB: 'en', UK: 'en', US: 'en', IE: 'en',
};

/** Resolve the best email locale from optional language + country hints. */
export function resolveEmailLocale(
  language?: string | null,
  country?: string | null,
): EmailLocale {
  const lang = (language ?? '').slice(0, 2).toLowerCase();
  if (lang && lang in STRINGS) return lang as EmailLocale;
  const cc = (country ?? '').toUpperCase();
  if (cc && COUNTRY_TO_LOCALE[cc]) return COUNTRY_TO_LOCALE[cc];
  return 'en';
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Render a localized, branded auth email.
 * Returns the subject + full HTML document ready to hand to Resend.
 */
export function renderAuthEmail(
  type: AuthEmailType,
  locale: EmailLocale,
  vars: RenderVars,
): { subject: string; html: string } {
  const L = STRINGS[locale] ?? STRINGS.en;
  const t = L[type];
  const common = L.common;

  const body = t.body
    .replace('{email}', esc(vars.email ?? ''))
    .replace('{newEmail}', esc(vars.newEmail ?? ''));

  const fontStack = "Arial,Helvetica,sans-serif";
  const isCode = type === 'reauthentication';

  // Shared header + card open
  const head = `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${esc(t.heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.bg};" bgcolor="${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(t.preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background-color:${C.bg};">
<tr><td align="center" style="padding:40px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
    <tr><td align="center" style="padding-bottom:28px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="48" height="48" align="center" valign="middle" bgcolor="${C.accentDeep}" style="border-radius:24px;background-color:${C.accentDeep};background-image:linear-gradient(135deg,${C.accentDark},${C.accentDeep},${C.accent});font-family:${fontStack};font-size:24px;font-weight:900;color:${C.white};line-height:48px;">V</td>
        <td style="padding-left:14px;font-family:${fontStack};font-size:20px;font-weight:900;color:${C.white};letter-spacing:4px;">VASCO</td>
      </tr></table>
    </td></tr>
    <tr><td bgcolor="${C.panel}" style="background-color:${C.panel};border:1px solid ${C.border};border-radius:14px;padding:36px 32px;">
      <h1 style="margin:0 0 18px;font-family:${fontStack};font-size:20px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;color:${C.white};">${esc(t.heading)}</h1>
      <p style="margin:0 0 14px;font-family:${fontStack};font-size:15px;line-height:24px;color:${C.body};">${body}</p>`;

  // Action block: either a CTA button or a code panel
  let action = '';
  if (isCode) {
    action = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;"><tr>
        <td align="center" bgcolor="${C.panel2}" style="background-color:${C.panel2};border:1px solid ${C.border};border-radius:10px;padding:20px 16px;font-family:'Courier New',Courier,monospace;font-size:30px;font-weight:bold;letter-spacing:8px;color:${C.code};">${esc(vars.token ?? '')}</td>
      </tr></table>`;
  } else {
    const url = vars.actionUrl ?? '#';
    action = `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 24px;"><tr>
        <td align="center" bgcolor="${C.accentDeep}" style="border-radius:10px;background-color:${C.accentDeep};background-image:linear-gradient(90deg,${C.accentDark},${C.accentDeep},${C.accent});">
          <a href="${url}" target="_blank" style="display:inline-block;padding:15px 36px;font-family:${fontStack};font-size:14px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:${C.white};text-decoration:none;border-radius:10px;">${esc(t.cta ?? '')}</a>
        </td>
      </tr></table>
      <p style="margin:0 0 6px;font-family:${fontStack};font-size:13px;line-height:20px;color:${C.muted};">${esc(common.buttonNotWorking)}</p>
      <p style="margin:0;font-family:${fontStack};font-size:12px;line-height:18px;"><a href="${url}" target="_blank" style="color:${C.accent};word-break:break-all;">${url}</a></p>`;
  }

  const tail = `
      <hr style="border:none;border-top:1px solid ${C.border};margin:26px 0 18px;">
      <p style="margin:0;font-family:${fontStack};font-size:12px;line-height:19px;color:${C.faint};">${esc(t.note)}</p>
    </td></tr>
    <tr><td align="center" style="padding-top:26px;">
      <p style="margin:0 0 6px;font-family:${fontStack};font-size:12px;line-height:18px;color:${C.faint};"><strong style="color:${C.muted};">Vasco</strong> &mdash; ${esc(common.tagline)}</p>
      <p style="margin:0;font-family:${fontStack};font-size:12px;line-height:18px;color:${C.faint};"><a href="https://vascobuild.com" target="_blank" style="color:${C.muted};text-decoration:none;">vascobuild.com</a></p>
      <p style="margin:12px 0 0;font-family:${fontStack};font-size:11px;line-height:16px;color:${C.faint2};">${esc(t.reason)}</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  return { subject: t.subject, html: head + action + tail };
}
