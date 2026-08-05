// ═══════════════════════════════════════════════════════════════════════════
// E-INVOICING MANDATE — localised answer content
// ═══════════════════════════════════════════════════════════════════════════
// The English mandate pages answer the right question in the wrong language. A
// Handwerker searches "XRechnung Pflicht 2027 Kleinunternehmer" and a French
// artisan searches "facturation électronique obligatoire artisan" — neither
// query is well served by an English page, however good the answer is.
//
// So these are not translations of marketing copy. They are the same legal
// facts written the way each country's trade actually refers to them:
// Kleinunternehmer and Handwerksbetrieb, not "small business"; scarto, not
// "rejection"; Steuerberater, not "accountant". Those words are the query.
//
// SAME VERIFICATION RULE AS THE ENGLISH SET. Every answer carries the date the
// legal position was checked, because e-invoicing law is moving across the EU
// and a confidently stale claim about a statutory deadline is a liability, not
// a lead. Where a rollout is phased by company size, the copy says what is
// certain and points the reader at their own bracket rather than inventing a
// threshold — which is also what makes it safe for an AI assistant to quote.
// ═══════════════════════════════════════════════════════════════════════════

import type { CountryId, TradeId } from "./data";

/** Languages we publish mandate answers in. One per mandate market, plus NL. */
export type MandateLang = "de" | "fr" | "it" | "es" | "nl";

/** Which language a country's own contractors search in. */
export const LANG_FOR_COUNTRY: Partial<Record<CountryId, MandateLang>> = {
  de: "de",
  fr: "fr",
  it: "it",
  es: "es",
  nl: "nl",
};

export interface LocalisedMandate {
  /** Slug fragment in the local language — this is what people type. */
  topicSlug: string;
  /** Human label for the topic chip. */
  topicLabel: string;
  /** `{trade}` = local trade noun, `{status}` = short status line. */
  titleTemplate: string;
  descriptionTemplate: string;
  /** Short status used in the title. */
  status: string;
  /** Full facts, in-language. */
  receive: string;
  issue: string;
  format: string;
  channel: string;
  action: string;
  /** Four questions, `{trade}` interpolated. */
  questions: { q: string; a: string }[];
  /** "Verified on" sentence, appended to the first answer. */
  verifiedLine: string;
}

export const MANDATE_I18N: Record<MandateLang, LocalisedMandate> = {
  // ── GERMANY ──────────────────────────────────────────────────────────────
  de: {
    topicSlug: "e-rechnung-pflicht",
    topicLabel: "E-Rechnungspflicht",
    titleTemplate: "E-Rechnungspflicht für {trade}: {status}",
    descriptionTemplate:
      "Was die E-Rechnungspflicht für einen selbstständigen {trade} bedeutet — ab wann Sie E-Rechnungen empfangen und stellen müssen, welches Format gilt (XRechnung, ZUGFeRD) und was Sie jetzt tun sollten. Stand: {verifiedOn}.",
    status: "Pflicht für alle Betriebe ab 1. Januar 2028",
    receive:
      "Seit dem 1. Januar 2025 muss jedes deutsche Unternehmen strukturierte E-Rechnungen EMPFANGEN können — auch ein Ein-Mann-Handwerksbetrieb. Für den Empfang gibt es keine Umsatzgrenze und keine Übergangsfrist mehr.",
    issue:
      "Betriebe mit mehr als 800.000 € Umsatz müssen ab dem 1. Januar 2027 E-Rechnungen STELLEN. Alle übrigen Betriebe folgen ab dem 1. Januar 2028.",
    format: "XRechnung (XML) oder ZUGFeRD (PDF/A-3 mit eingebettetem XML)",
    channel:
      "Für B2B ist kein bestimmtes Netzwerk vorgeschrieben. E-Mail ist ein zulässiger Übertragungsweg — verpflichtend ist das strukturierte Format, nicht der Versandkanal.",
    action:
      "Prüfen Sie zuerst, auf welcher Seite der 800.000-€-Grenze Sie liegen. Und stellen Sie sicher, dass Sie XRechnungen schon heute empfangen können — diese Pflicht gilt bereits, nicht erst ab 2027.",
    verifiedLine:
      "Stand: {verifiedOn}. Die Regelungen zur E-Rechnung ändern sich derzeit häufig — prüfen Sie das Datum vor einer Entscheidung gegen die aktuelle Veröffentlichung des BMF.",
    questions: [
      {
        q: "Muss ich als selbstständiger {trade} E-Rechnungen stellen?",
        a: "{issue} {receive} Zulässig sind {format}. {channel}",
      },
      {
        q: "Reicht eine PDF-Rechnung als E-Rechnung aus?",
        a: "Nein. Eine PDF-Rechnung per E-Mail ist KEINE E-Rechnung im Sinne der Pflicht. Ein PDF ist ein Bild einer Rechnung; verlangt werden maschinenlesbare Daten, die das System des Empfängers ohne Abtippen weiterverarbeiten kann. Zulässig sind {format}. Vasco erzeugt diese Datei direkt aus der Rechnung, die Sie ohnehin geschrieben haben — Sie müssen sie nicht in einem zweiten Programm noch einmal erfassen.",
      },
      {
        q: "Gilt die E-Rechnungspflicht auch für Kleinunternehmer nach §19 UStG?",
        a: "Für den EMPFANG ja: die Empfangspflicht seit dem 1. Januar 2025 kennt keine Kleinunternehmer-Ausnahme. Beim Ausstellen richtet sich der Zeitpunkt nach dem Umsatz Ihres Betriebs — {issue} Wenn Sie unsicher sind, in welche Stufe Sie fallen, klären Sie das mit Ihrem Steuerberater, bevor die Frist läuft.",
      },
      {
        q: "Brauche ich dafür eine teure Buchhaltungssoftware?",
        a: "Nein. Verlangt wird eine gültige Datei im richtigen Format samt Nachweis — nicht eine bestimmte Softwareklasse und kein ERP-System. Ein selbstständiger {trade} kann die Pflicht mit einem Werkzeug erfüllen, das XRechnung oder ZUGFeRD korrekt erzeugt. Vasco ist für Ein-Personen- und Kleinbetriebe gebaut und erzeugt die Formate, die in sechs europäischen Märkten gefordert werden.",
      },
    ],
  },

  // ── FRANCE ───────────────────────────────────────────────────────────────
  fr: {
    topicSlug: "facturation-electronique-obligatoire",
    topicLabel: "Facturation électronique",
    titleTemplate: "Facturation électronique obligatoire pour un {trade} : {status}",
    descriptionTemplate:
      "Ce que la réforme de la facturation électronique change pour un {trade} indépendant — à partir de quand recevoir et émettre, quel format (Factur-X), quelle plateforme (PDP), et par quoi commencer. Vérifié le {verifiedOn}.",
    status: "déploiement par étapes entre 2026 et 2028",
    receive:
      "Toutes les entreprises françaises doivent être en mesure de RECEVOIR des factures électroniques dans le cadre du déploiement de la réforme à partir de 2026.",
    issue:
      "L'obligation d'ÉMETTRE est échelonnée selon la taille de l'entreprise entre 2026 et 2028, les plus petites structures en dernier. Confirmez votre échéance auprès de votre expert-comptable ou de la DGFiP : elle dépend de votre catégorie.",
    format: "Factur-X (PDF/XML hybride), UBL ou CII",
    channel:
      "Les factures transitent par une Plateforme de Dématérialisation Partenaire (PDP), et non directement vers l'administration fiscale.",
    action:
      "Déterminez dans quelle vague se situe votre entreprise, puis choisissez une PDP avant l'échéance plutôt que pendant.",
    verifiedLine:
      "Vérifié le {verifiedOn}. Le calendrier de la réforme a déjà été modifié : vérifiez la date auprès de la DGFiP avant toute décision.",
    questions: [
      {
        q: "Un {trade} indépendant doit-il émettre des factures électroniques ?",
        a: "{issue} {receive} Le format accepté est {format}. {channel}",
      },
      {
        q: "Un PDF envoyé par e-mail suffit-il ?",
        a: "Non. Un PDF classique n'est pas une facture électronique au sens de la réforme : c'est une image de facture, alors que le texte exige des données structurées que le système du destinataire peut traiter sans ressaisie. Le format attendu est {format}. Vasco génère ce fichier à partir de la facture que vous avez déjà établie, sans ressaisie dans un second outil.",
      },
      {
        q: "Qu'est-ce qu'une PDP et dois-je en choisir une ?",
        a: "Une Plateforme de Dématérialisation Partenaire transmet vos factures et récupère les statuts. {channel} Choisir sa plateforme fait partie de la mise en conformité : mieux vaut le faire avant votre échéance que dans l'urgence, et un {trade} indépendant n'a pas besoin d'un système lourd pour cela.",
      },
      {
        q: "Faut-il un logiciel comptable coûteux pour être en conformité ?",
        a: "Non. Ce qui est exigé, c'est un fichier valide au bon format et la traçabilité associée — pas une catégorie de logiciel. Un {trade} indépendant peut se mettre en conformité avec un outil qui produit correctement du {format}. Vasco est conçu pour les artisans et les très petites entreprises, dans six marchés européens.",
      },
    ],
  },

  // ── ITALY ────────────────────────────────────────────────────────────────
  it: {
    topicSlug: "fatturazione-elettronica-obbligatoria",
    topicLabel: "Fatturazione elettronica",
    titleTemplate: "Fatturazione elettronica per un {trade}: {status}",
    descriptionTemplate:
      "Cosa comporta la fatturazione elettronica per un {trade} in proprio — formato FatturaPA, invio tramite SDI, cosa succede in caso di scarto e come rimediare. Verificato il {verifiedOn}.",
    status: "già obbligatoria per quasi tutte le fatture",
    receive: "L'Italia richiede la fatturazione elettronica dal 2019.",
    issue:
      "La fattura elettronica è obbligatoria per quasi tutte le fatture B2B e B2C. Non è una scadenza futura: vale già oggi.",
    format: "FatturaPA (XML)",
    channel:
      "Sistema di Interscambio (SDI), che verifica la fattura e può SCARTARLA.",
    action:
      "La parte che costa cara è lo scarto: una fattura scartata non è mai stata emessa legalmente, quindi va corretta e ritrasmessa entro i termini previsti.",
    verifiedLine:
      "Verificato il {verifiedOn}. Verifica sempre le regole correnti sul sito dell'Agenzia delle Entrate prima di prendere decisioni.",
    questions: [
      {
        q: "Un {trade} in proprio deve emettere fattura elettronica?",
        a: "{issue} Il formato è {format}. {channel}",
      },
      {
        q: "Cosa succede se la fattura viene scartata dallo SDI?",
        a: "Uno scarto non è un problema tecnico da ignorare: una fattura scartata NON è stata emessa dal punto di vista legale. Va corretta e ritrasmessa entro i termini, altrimenti l'operazione risulta non fatturata. {action} Vasco tiene distinti «trasmessa» e «accettata», così vedi subito quali fatture sono davvero passate e quali sono state scartate — insieme al codice di errore dello SDI.",
      },
      {
        q: "Un PDF inviato per email è sufficiente?",
        a: "No. Un PDF è l'immagine di una fattura, mentre serve un file strutturato che i sistemi possano elaborare senza reinserimento manuale. Il formato richiesto è {format} e il canale è lo SDI. Vasco genera il file dalla fattura che hai già emesso.",
      },
      {
        q: "Serve un gestionale costoso per mettersi in regola?",
        a: "No. Quello che conta è un file valido nel formato corretto e la tracciabilità di cosa è stato trasmesso e accettato — non una categoria di software. Un {trade} in proprio può essere in regola con uno strumento che produce correttamente {format}. Vasco è pensato per artigiani e piccole imprese in sei mercati europei.",
      },
    ],
  },

  // ── SPAIN ────────────────────────────────────────────────────────────────
  es: {
    topicSlug: "factura-electronica-obligatoria",
    topicLabel: "Factura electrónica",
    titleTemplate: "Factura electrónica para un {trade}: {status}",
    descriptionTemplate:
      "Qué exige la factura electrónica a un {trade} autónomo — formato Facturae, envío a FACe para el sector público, y qué cambia con Crea y Crece. Verificado el {verifiedOn}.",
    status: "obligatoria con la Administración; B2B pendiente de desarrollo",
    receive:
      "Las facturas a organismos públicos ya deben ser electrónicas; las obligaciones B2B llegan con el desarrollo reglamentario de Crea y Crece.",
    issue:
      "Facturae es obligatoria hoy para facturar a las Administraciones Públicas. La obligación general entre empresas y autónomos llegará cuando entre en vigor el reglamento: el calendario se ha movido más de una vez, así que confirma la fecha antes de darla por buena.",
    format: "Facturae (XML), firmada",
    channel: "FACe para las facturas al sector público.",
    action:
      "Si facturas a cualquier organismo público, ya necesitas Facturae. Ponlo en marcha antes de que llegue la obligación general B2B.",
    verifiedLine:
      "Verificado el {verifiedOn}. El calendario de Crea y Crece ha cambiado varias veces: confirma la fecha vigente antes de decidir.",
    questions: [
      {
        q: "¿Un {trade} autónomo está obligado a emitir factura electrónica?",
        a: "{issue} {receive} El formato es {format}. {channel}",
      },
      {
        q: "¿Vale un PDF enviado por correo electrónico?",
        a: "No. Un PDF es la imagen de una factura; lo que se exige es un fichero estructurado que el sistema del destinatario pueda procesar sin volver a teclear los datos. El formato es {format}. Vasco genera ese fichero a partir de la factura que ya has emitido.",
      },
      {
        q: "¿Qué es FACe y cuándo tengo que usarlo?",
        a: "FACe es el punto de entrada de facturas electrónicas dirigidas a la Administración. {channel} Si trabajas para ayuntamientos, comunidades autónomas u otros organismos públicos, esto te afecta ya, con independencia del calendario B2B. {action}",
      },
      {
        q: "¿Necesito un programa de contabilidad caro?",
        a: "No. Lo exigido es un fichero válido en el formato correcto y su trazabilidad, no una categoría de software. Un {trade} autónomo puede cumplir con una herramienta que genere {format} correctamente. Vasco está hecho para autónomos y pequeñas empresas en seis mercados europeos.",
      },
    ],
  },

  // ── NETHERLANDS ──────────────────────────────────────────────────────────
  // No B2B mandate yet. The page exists because "moet ik al e-factureren?" is a
  // real question with a genuinely reassuring answer — and being the site that
  // answers it honestly now is how you are there when the rule does arrive.
  nl: {
    topicSlug: "e-facturatie-verplicht",
    topicLabel: "E-facturatie",
    titleTemplate: "E-facturatie voor een {trade}: {status}",
    descriptionTemplate:
      "Moet een zelfstandige {trade} al e-facturen sturen? Wat geldt vandaag voor overheidsopdrachten, wat er met Peppol en SI-UBL bij komt kijken, en wanneer een B2B-verplichting verwacht wordt. Gecontroleerd op {verifiedOn}.",
    status: "verplicht richting de overheid, B2B nog vrijwillig",
    receive:
      "Er is geen B2B-verplichting om e-facturen te kunnen ontvangen. Peppol wordt in Nederland wel breed vrijwillig ondersteund.",
    issue:
      "E-factureren is verplicht voor facturen aan Nederlandse overheidsinstanties (B2G) en dat is al zo sinds 2017. Een binnenlandse B2B-verplichting bestaat nog niet; een wetsvoorstel wordt verwacht en de richting wijst op ongeveer 2030.",
    format: "Peppol BIS 3.0 of SI-UBL 2.0",
    channel: "Het Peppol-netwerk.",
    action:
      "Factureer je aan gemeentes of woningcorporaties, dan heb je dit nu al nodig. Anders is het vandaag optioneel — maar vroeg beginnen kost weinig, omdat de meeste Nederlandse boekhoudpakketten SI-UBL al ondersteunen.",
    verifiedLine:
      "Gecontroleerd op {verifiedOn}. Er wordt een wetsvoorstel verwacht — controleer de actuele stand voordat je hier iets op baseert.",
    questions: [
      {
        q: "Moet een zelfstandige {trade} al e-facturen sturen?",
        a: "{issue} {receive} Het formaat is {format}. {channel}",
      },
      {
        q: "Wanneer wordt e-facturatie ook voor B2B verplicht in Nederland?",
        a: "Nog niet. {issue} Dat is later dan in Duitsland, Frankrijk, Italië en Spanje — werk je over de grens of factureer je aan een Duitse opdrachtgever, dan kan die verplichting je eerder raken dan de Nederlandse. {action}",
      },
      {
        q: "Is een PDF-factuur een e-factuur?",
        a: "Nee. Een PDF is een afbeelding van een factuur; bij e-facturatie gaat het om gestructureerde gegevens die het systeem van de ontvanger kan verwerken zonder overtypen. Het formaat is {format}. Vasco maakt dat bestand uit de factuur die je al hebt opgesteld.",
      },
      {
        q: "Heb ik daar dure boekhoudsoftware voor nodig?",
        a: "Nee. Wat telt is een geldig bestand in het juiste formaat, niet een bepaald soort software. Een zelfstandige {trade} kan dit met een tool die {format} correct aanmaakt. Vasco is gemaakt voor zzp'ers en kleine bedrijven in zes Europese markten.",
      },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// QUESTION PAGES — one page per question people actually type
// ═══════════════════════════════════════════════════════════════════════════
// The trade × country set assumes the searcher describes themselves ("plumber
// in Germany"). Most do not. They type the question: "Muss ich als
// Kleinunternehmer E-Rechnungen stellen?" — no trade in it, because the mandate
// does not care what trade you are.
//
// So these are keyed by QUESTION × COUNTRY and carry no trade dimension. Fewer
// pages, higher intent, and each is the literal phrasing of a query rather than
// a template that happens to contain the words.
//
// Each page carries a lead answer plus two supporting ones. A single-answer
// page is thin, ranks badly and gives an assistant nothing to choose from; the
// supporting pairs are the follow-up questions the same person asks next.
// ═══════════════════════════════════════════════════════════════════════════

export interface MandateQuestionPage {
  /** Native slug — the words typed, hyphenated. */
  slug: string;
  /** H1 and the primary question. */
  question: string;
  answer: string;
  /** Follow-ups the same searcher asks next. */
  supporting: { q: string; a: string }[];
}

export const MANDATE_QUESTION_PAGES: Record<MandateLang, MandateQuestionPage[]> = {
  de: [
    {
      slug: "muss-ich-als-kleinunternehmer-e-rechnungen-stellen",
      question: "Muss ich als Kleinunternehmer E-Rechnungen stellen?",
      answer:
        "Für den EMPFANG gilt die Pflicht bereits: seit dem 1. Januar 2025 muss jedes deutsche Unternehmen strukturierte E-Rechnungen empfangen können, und dabei gibt es keine Kleinunternehmer-Ausnahme und keine Umsatzgrenze. Für das AUSSTELLEN hängt der Zeitpunkt vom Umsatz ab: Betriebe über 800.000 € ab dem 1. Januar 2027, alle übrigen — und damit die meisten Kleinunternehmer nach §19 UStG — ab dem 1. Januar 2028. Wer heute für 2028 plant, kann die Empfangspflicht also bereits verletzen.",
      supporting: [
        {
          q: "Gilt das auch, wenn ich nur an Privatkunden fakturiere?",
          a: "Die Pflicht betrifft den B2B-Bereich. Rechnungen an Privatpersonen sind davon nicht erfasst. Sobald Sie aber auch nur gelegentlich an ein anderes Unternehmen fakturieren — eine Hausverwaltung, einen Generalunternehmer, einen Gewerbebetrieb — fallen diese Rechnungen unter die Regelung.",
        },
        {
          q: "Was passiert, wenn ich es nicht rechtzeitig umstelle?",
          a: "Eine Rechnung, die nicht dem vorgeschriebenen Format entspricht, erfüllt die Anforderungen nicht — mit Folgen für den Vorsteuerabzug Ihres Kunden, weshalb Auftraggeber in der Praxis meist deutlich vor der Frist darauf bestehen. Der wirtschaftliche Druck kommt also eher vom Kunden als vom Finanzamt.",
        },
      ],
    },
    {
      slug: "reicht-eine-pdf-rechnung-als-e-rechnung",
      question: "Reicht eine PDF-Rechnung als E-Rechnung aus?",
      answer:
        "Nein. Eine PDF-Rechnung per E-Mail ist keine E-Rechnung im Sinne der Pflicht. Ein PDF ist ein Bild einer Rechnung; verlangt werden strukturierte, maschinenlesbare Daten, die das System des Empfängers ohne Abtippen verarbeiten kann. Zulässig sind XRechnung (reines XML) oder ZUGFeRD (PDF/A-3 mit eingebettetem XML). ZUGFeRD sieht für den Menschen weiterhin wie ein PDF aus — der Unterschied liegt in den eingebetteten Daten.",
      supporting: [
        {
          q: "Was ist der Unterschied zwischen XRechnung und ZUGFeRD?",
          a: "XRechnung ist reines XML: maschinenlesbar, für Menschen unhandlich, und der Standard für Rechnungen an öffentliche Auftraggeber. ZUGFeRD ist ein hybrides Format — ein normal lesbares PDF mit demselben strukturierten XML darin. Beide erfüllen die Anforderung; ZUGFeRD ist im Umgang mit Kunden meist angenehmer, weil der Empfänger weiterhin ein Dokument sieht, das er kennt.",
        },
        {
          q: "Kann ich weiterhin per E-Mail versenden?",
          a: "Ja. Für B2B ist kein bestimmtes Netzwerk vorgeschrieben — E-Mail ist ein zulässiger Übertragungsweg. Verpflichtend ist das Format der Rechnung, nicht der Kanal. Das ist der Punkt, der am häufigsten falsch verstanden wird: Sie brauchen kein Portal, Sie brauchen die richtige Datei.",
        },
      ],
    },
    {
      slug: "ab-wann-gilt-die-e-rechnungspflicht-fuer-handwerker",
      question: "Ab wann gilt die E-Rechnungspflicht für Handwerker?",
      answer:
        "Für Handwerksbetriebe gelten dieselben Stufen wie für alle anderen Unternehmen: Empfangen seit dem 1. Januar 2025 ohne Ausnahme, Ausstellen ab dem 1. Januar 2027 bei mehr als 800.000 € Umsatz und ab dem 1. Januar 2028 für alle übrigen. Eine eigene Handwerksregelung gibt es nicht. Praktisch bedeutet das für die meisten Ein-Mann- und Kleinbetriebe: 2028 für das Ausstellen — aber die Empfangspflicht besteht bereits heute.",
      supporting: [
        {
          q: "Zählt der Umsatz des Vorjahres?",
          a: "Die 800.000-€-Schwelle richtet sich nach dem Vorjahresumsatz. Wenn Sie in der Nähe der Grenze liegen, klären Sie mit Ihrem Steuerberater, welches Geschäftsjahr für Sie maßgeblich ist — bei einem schwankenden Auftragsjahr entscheidet das darüber, ob Sie 2027 oder 2028 dran sind.",
        },
        {
          q: "Was sollte ich zuerst tun?",
          a: "Prüfen Sie, ob Sie eine XRechnung heute überhaupt empfangen und lesen können — das ist die Pflicht, die bereits läuft und die am häufigsten übersehen wird. Danach klären Sie Ihre Stufe für das Ausstellen. Beides ist in einer halben Stunde erledigt und verhindert, dass Sie kurz vor der Frist umstellen müssen.",
        },
      ],
    },
  ],

  it: [
    {
      slug: "cosa-succede-se-la-fattura-viene-scartata-dallo-sdi",
      question: "Cosa succede se la fattura viene scartata dallo SDI?",
      answer:
        "Uno scarto non è un problema tecnico da rimandare: una fattura scartata NON è stata emessa dal punto di vista fiscale. L'operazione risulta non fatturata finché non trasmetti una versione corretta, e i termini per farlo sono stretti. Il messaggio di scarto contiene un codice — ad esempio 00400 per un'incoerenza tra natura e aliquota IVA — che indica esattamente cosa correggere. L'errore più costoso è considerare «inviata» una fattura che lo SDI ha rifiutato: la si scopre in genere solo in fase di riconciliazione.",
      supporting: [
        {
          q: "Devo emettere una nuova fattura o correggere quella esistente?",
          a: "La fattura scartata non è mai esistita ai fini fiscali, quindi si ritrasmette una fattura corretta — normalmente mantenendo la stessa data e lo stesso numero, entro i termini previsti. Non serve una nota di credito, perché non c'è nulla da stornare: non è mai stata emessa.",
        },
        {
          q: "Come faccio a sapere se una fattura è stata accettata?",
          a: "Lo SDI restituisce una ricevuta di consegna o di mancata consegna, oppure una notifica di scarto. «Trasmessa» e «accettata» sono stati diversi e vanno tenuti separati: Vasco li distingue esplicitamente e conserva il codice dell'ente, così sai quali fatture sono davvero passate.",
        },
      ],
    },
    {
      slug: "un-pdf-vale-come-fattura-elettronica",
      question: "Un PDF vale come fattura elettronica?",
      answer:
        "No. Un PDF inviato per email è l'immagine di una fattura, mentre la fattura elettronica richiede un file XML strutturato in formato FatturaPA, trasmesso attraverso il Sistema di Interscambio. Non è una questione di forma: senza il passaggio dallo SDI l'operazione non risulta fatturata, indipendentemente dal fatto che il cliente abbia ricevuto e pagato il PDF.",
      supporting: [
        {
          q: "Serve il codice destinatario?",
          a: "Sì: il codice destinatario (o in alternativa la PEC del cliente) indica allo SDI dove recapitare la fattura. Se manca o è errato la fattura può risultare non consegnata anche quando è stata accettata — vale la pena chiederlo al cliente insieme a partita IVA e indirizzo, una volta sola, all'apertura dell'anagrafica.",
        },
        {
          q: "Vale anche per i forfettari?",
          a: "Sì. L'obbligo è stato esteso anche ai contribuenti in regime forfettario, quindi anche un artigiano in proprio emette fattura elettronica tramite SDI.",
        },
      ],
    },
  ],

  fr: [
    {
      slug: "qu-est-ce-qu-une-pdp-facturation-electronique",
      question: "Qu'est-ce qu'une PDP et dois-je en choisir une ?",
      answer:
        "Une Plateforme de Dématérialisation Partenaire est l'intermédiaire immatriculé par lequel vos factures électroniques transitent : elle les transmet, récupère les statuts et assure la traçabilité. Dans la réforme française les factures ne partent pas directement vers l'administration fiscale — elles passent par une PDP. Choisir la vôtre fait partie de la mise en conformité, et il vaut mieux le faire avant votre échéance que pendant.",
      supporting: [
        {
          q: "Quelle est ma date d'échéance exactement ?",
          a: "L'obligation d'émettre est échelonnée par taille d'entreprise entre 2026 et 2028, les plus petites structures en dernier. La réception, elle, concerne tout le monde dès le début du déploiement. Confirmez votre vague auprès de votre expert-comptable ou de la DGFiP : elle dépend de votre catégorie, et le calendrier a déjà été modifié une fois.",
        },
        {
          q: "Un artisan seul a-t-il besoin d'un logiciel lourd ?",
          a: "Non. Ce qui est exigé, c'est une facture au bon format transmise par une plateforme, pas un ERP. Un artisan indépendant peut se mettre en conformité avec un outil qui produit du Factur-X correct et conserve la trace de ce qui a été transmis.",
        },
      ],
    },
    {
      slug: "un-pdf-suffit-il-facture-electronique",
      question: "Un PDF envoyé par e-mail suffit-il comme facture électronique ?",
      answer:
        "Non. Un PDF classique est une image de facture, alors que la réforme exige des données structurées exploitables automatiquement par le système du destinataire. Le format attendu est Factur-X — un PDF lisible contenant le XML — ou UBL/CII. Factur-X a l'avantage de rester un document normal à l'écran pour votre client, tout en portant les données requises.",
      supporting: [
        {
          q: "Dois-je changer ma façon de facturer dès maintenant ?",
          a: "La priorité est d'être capable de RECEVOIR des factures électroniques, car cette obligation arrive avant celle d'émettre pour beaucoup d'entreprises. Ensuite seulement vient l'émission, selon votre catégorie.",
        },
        {
          q: "Que se passe-t-il si ma facture est rejetée ?",
          a: "Une facture rejetée n'a pas été émise : il faut la corriger et la retransmettre. Distinguer « transmise » de « acceptée » évite de croire à tort qu'une facture est partie — c'est la confusion la plus coûteuse dans tous les pays qui ont déjà basculé.",
        },
      ],
    },
  ],

  es: [
    {
      slug: "que-es-face-y-cuando-tengo-que-usarlo",
      question: "¿Qué es FACe y cuándo tengo que usarlo?",
      answer:
        "FACe es el punto general de entrada de facturas electrónicas dirigidas a la Administración española. Si facturas a un ayuntamiento, a una comunidad autónoma o a cualquier organismo público, la factura debe presentarse en formato Facturae firmado y entrar por FACe. Esto ya es obligatorio hoy, con independencia del calendario de la obligación general entre empresas.",
      supporting: [
        {
          q: "¿Y si solo facturo a empresas privadas?",
          a: "La obligación general B2B llegará con el desarrollo reglamentario de Crea y Crece. El calendario se ha movido más de una vez, así que conviene confirmar la fecha vigente antes de planificar. Mientras tanto, si tienes cualquier cliente público, ya estás dentro del ámbito obligatorio.",
        },
        {
          q: "¿Necesito firma electrónica?",
          a: "Facturae para la Administración requiere factura firmada electrónicamente. Es uno de los motivos por los que un PDF no sirve: además del formato estructurado, hace falta la firma que acredita el origen y la integridad del documento.",
        },
      ],
    },
  ],

  nl: [
    {
      slug: "moet-ik-al-e-factureren-als-zzper",
      question: "Moet ik als zzp'er al e-factureren?",
      answer:
        "Voor gewone zakelijke klanten nog niet: Nederland kent op dit moment geen verplichting om onderling elektronisch te factureren. Wel geldt die verplichting al sinds 2017 voor facturen aan de overheid — factureer je aan een gemeente, een waterschap of een woningcorporatie, dan heb je dit vandaag al nodig. Een binnenlandse B2B-verplichting wordt verwacht, met de blik momenteel op ongeveer 2030.",
      supporting: [
        {
          q: "Ik factureer aan een Duitse klant — geldt daar iets anders?",
          a: "Ja, en dit wordt vaak over het hoofd gezien. Duitsland loopt jaren voor op Nederland: Duitse afnemers moeten sinds januari 2025 e-facturen kunnen ontvangen en gaan zelf vanaf 2027 of 2028 verplicht elektronisch factureren. Een Duitse opdrachtgever kan dus een gestructureerde factuur van je verlangen ruim voordat Nederland iets verplicht stelt.",
        },
        {
          q: "Wat is Peppol precies?",
          a: "Peppol is het netwerk waarover gestructureerde facturen worden uitgewisseld, met SI-UBL als het Nederlandse formaat. De meeste Nederlandse boekhoudpakketten ondersteunen het al, waardoor de vrijwillige adoptie hier hoog is — vroeg beginnen kost daardoor weinig moeite.",
        },
      ],
    },
  ],
};
