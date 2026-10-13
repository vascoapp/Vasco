// Marketing-page content per locale.
// Used by app/page.tsx (en), app/nl/page.tsx (nl), app/de/page.tsx (de) and app/us/page.tsx (en-US).
// Dutch is native-Dutch, not literal-translated. NL is the lead market;
// the in-app product is Dutch UI by default for NL contractors.

export type Locale = "en" | "nl" | "de" | "en-US";

export type MarketingContent = {
  meta: {
    title: string;
    description: string;
    ogDescription: string;
  };
  nav: {
    how: string;
    pricing: string;
    faq: string;
    support: string;
    cta: string;
  };
  hero: {
    badge: string;
    title: string;
    titleAccent: string;
    sub: string;
    ctaPrimary: string;
    ctaSecondary: string;
    marketsPrefix: string;
  };
  stats: Array<{ value: string; label: string }>;
  /** "How it works": one row per app screen, alternating sides. */
  features: {
    titleLead: string;
    titleAccent: string;
    footnote: string;
    items: Array<{
      label: string;
      /** Store-capture key: /screenshots/app-<locale>-<screen>.webp */
      screen: "quote" | "invoice" | "money" | "customers" | "work";
      title: string;
      body: string;
    }>;
  };
  pricing: {
    eyebrow: string;
    titleLead: string;
    titleAccent: string;
    /** One line stating that Vasco takes no cut of payments. */
    noCommission: string;
    badge: string;
    closer: string;
    closerAccent: string;
    plans: Array<{
      name: string;
      price: string;
      period: string;
      /** Price per month when billed annually, e.g. "€32/mo billed annually". */
      annual?: string;
      tagline: string;
      features: string[];
      cta: string;
      highlight: boolean;
      badge?: string;
    }>;
  };
  trades: {
    eyebrow: string;
    titleLead: string;
    titleAccent: string;
    body: string;
    list: string[];
  };
  manifesto: {
    eyebrow: string;
    line1: string;
    line1Accent: string;
    line2: string;
    line2Accent: string;
    closer: string;
  };
  faq: {
    eyebrow: string;
    titleLead: string;
    titleAccent: string;
    items: Array<{ q: string; a: string }>;
  };
  finalCta: {
    titleLead: string;
    titleAccent: string;
    body: string;
    cta: string;
  };
  footer: {
    tagline: string;
    address: string;
    product: { title: string; links: Array<{ href: string; label: string }> };
    legal: { title: string; links: Array<{ href: string; label: string }> };
    contact: { title: string; links: Array<{ href: string; label: string }> };
    bottomCompliance: string;
  };
};

const MARKETS_EN = [
  { code: "NL", name: "Netherlands" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "UK", name: "United Kingdom" },
];

// R77 US Phase 3: US states shown as the "Working in" strip on /us.
// Top 5 launch states per the research report (CA/TX/FL/NY/IL) — these
// are the largest contractor markets and also align with our AEO page
// generation.
const MARKETS_US = [
  { code: "TX", name: "Texas" },
  { code: "CA", name: "California" },
  { code: "FL", name: "Florida" },
  { code: "NY", name: "New York" },
  { code: "IL", name: "Illinois" },
  { code: "AZ", name: "Arizona" },
];

export const MARKETS = MARKETS_EN;
export { MARKETS_EN, MARKETS_US };


// ─────────────────────────────────────────────────────────────────────────
// HONESTY RULES for this copy (2026-10-08):
//  - Not in the App Store or Google Play yet: TestFlight beta only. Say
//    "coming to iOS and Android" / "join the beta", never "available on".
//  - No AI claims. LLM features are off in production.
//  - No commission. Payments go to the contractor's OWN Mollie/Stripe
//    account; the cancelled per-invoice take rate must never reappear.
//  - Prices are the app's own: src/services/subscriptionService.ts (TIERS).
//  - No unsourced statistics, no automation that does not exist.
// ─────────────────────────────────────────────────────────────────────────

const LEGAL_LINKS_EN = [
  { href: "/legal/privacy-policy", label: "Privacy" },
  { href: "/legal/terms-of-service", label: "Terms" },
  { href: "/legal/eula", label: "EULA" },
  { href: "/legal/cookie-policy", label: "Cookies" },
  { href: "/legal/data-processing-agreement", label: "DPA" },
  { href: "/legal/acceptable-use-policy", label: "Acceptable use" },
];

const CONTACT_LINKS = [
  { href: "mailto:hello@vascobuild.com", label: "hello@vascobuild.com" },
  { href: "mailto:support@vascobuild.com", label: "support@vascobuild.com" },
  { href: "mailto:privacy@vascobuild.com", label: "privacy@vascobuild.com" },
];

export const content: Record<Locale, MarketingContent> = {
  en: {
    meta: {
      title: "Vasco — Quotes, invoices and e-invoicing for the trades",
      description:
        "Quotes, jobs, invoices and e-invoicing for plumbers, electricians, painters, carpenters and aannemers in NL, DE, FR, ES, IT and the UK. Free plan; Pro from €32/month billed annually (excl. VAT). No commission on payments.",
      ogDescription:
        "Quotes, invoices and e-invoicing for the trades. Free plan, Pro from €32/month billed annually, no commission on payments. Coming to iOS and Android.",
    },
    nav: {
      how: "How it works",
      pricing: "Pricing",
      faq: "FAQ",
      support: "Support",
      cta: "Join the beta",
    },
    hero: {
      badge: "In beta — coming to iOS and Android",
      title: "Quotes and invoices,",
      titleAccent: "from your phone.",
      sub:
        "Quotes, jobs, invoices and the e-invoicing rules of the country you work in — in one app on your phone, so the paperwork takes less of your evening.",
      ctaPrimary: "Join the beta",
      ctaSecondary: "See how it works",
      marketsPrefix: "Working in",
    },
    stats: [
      { value: "6", label: "Countries" },
      { value: "15", label: "Trades" },
      { value: "6", label: "E-invoice formats" },
      { value: "0%", label: "Commission on payments" },
    ],
    features: {
      titleLead: "What you do in Vasco.",
      titleAccent: "Five screens, start to paid.",
      footnote: "Screens from the app, with example data. Vasco is not in the App Store or Google Play yet.",
      items: [
        { label: "Quote", screen: "quote", title: "Price it on site.", body: "Line items from your own price list, with Good / Better / Best options when you want them. Your customer opens the quote on their phone and accepts it online — no account needed." },
        { label: "Invoice", screen: "invoice", title: "An invoice in one tap.", body: "A finished job becomes an invoice without retyping. Vasco builds it to the rules of the country you work in — XRechnung, ZUGFeRD, Factur-X, Facturae, FatturaPA or Peppol — with a bank-transfer QR code on euro invoices." },
        { label: "Money", screen: "money", title: "See what is still open.", body: "What is due, what is late, and what came in. A payment link through your own Mollie or Stripe account; for a late invoice Vasco drafts a reminder for you to check and send." },
        { label: "Customers", screen: "customers", title: "Customers, complete.", body: "Name, address, VAT ID and e-invoice details in one place, so the invoice is right the first time." },
        { label: "Jobs", screen: "work", title: "Jobs that bill themselves.", body: "Plan the work, log hours and materials. When the job is done, Vasco invoices the agreed price — or, without one, the hours you logged and the materials you used." },
      ],
    },
    pricing: {
      eyebrow: "Pricing",
      titleLead: "Simple plans.",
      titleAccent: "No commission.",
      noCommission:
        "Vasco takes no commission on payments. Your customer pays into your own Mollie or Stripe account.",
      badge: "MOST POPULAR",
      closer: "Prices excl. VAT. Your first month of Pro is free. Cancel anytime.",
      closerAccent: "No commission on your payments.",
      plans: [
        {
          name: "Free",
          price: "€0",
          period: "/mo",
          tagline: "Get started. No commitment.",
          features: [
            "5 active jobs",
            "5 quotes and 3 invoices a month",
            "25 customers",
            "No e-invoicing — that is Pro",
          ],
          cta: "Join the beta",
          highlight: false,
        },
        {
          name: "Pro",
          price: "€39",
          period: "/mo",
          annual: "or €32/mo billed annually",
          tagline: "Unlimited quotes and invoices, plus e-invoicing.",
          features: [
            "Unlimited jobs, quotes, invoices and customers",
            "E-invoicing in all 6 countries",
            "Payment links via your own Mollie or Stripe",
            "Online quote acceptance for your customers",
            "3 team members included, up to 3 more at €10/mo each",
          ],
          cta: "Join the beta",
          highlight: true,
          badge: "MOST POPULAR",
        },
        {
          name: "Contractor",
          price: "€69",
          period: "/mo",
          annual: "or €56/mo billed annually",
          tagline: "For teams.",
          features: [
            "Everything in Pro",
            "Up to 15 team members",
            "Dedicated support",
          ],
          cta: "Talk to us",
          highlight: false,
        },
      ],
    },
    trades: {
      eyebrow: "Built for the trades",
      titleLead: "15 trades.",
      titleAccent: "One toolbox.",
      body:
        "From solo plumbers to multi-trade aannemers. Vasco speaks your trade and your customer's language — in six languages.",
      list: [
        "Plumbing",
        "Electrical",
        "Gas / HVAC",
        "Painting",
        "Carpentry",
        "Roofing",
        "Tiling",
        "Plastering",
        "Flooring",
        "Insulation",
        "Solar",
        "Glazing",
        "Landscaping",
        "Masonry",
        "Demolition",
      ],
    },
    manifesto: {
      eyebrow: "Built for tradespeople",
      line1: "You didn't become a plumber to learn",
      line1Accent: "VAT codes.",
      line2: "You became a plumber to",
      line2Accent: "fix things.",
      closer: "Vasco helps with the rest.",
    },
    faq: {
      eyebrow: "FAQ",
      titleLead: "Questions.",
      titleAccent: "Straight answers.",
      items: [
        {
          q: "Can I download Vasco yet?",
          a: "Not from the stores yet. Vasco is in a closed beta on iPhone (TestFlight) and is coming to iOS and Android. Join the beta and we will email you when there is a place for you.",
        },
        {
          q: "What does it cost?",
          a: "Prices are excluding VAT. Free is €0 with limits (5 active jobs, 5 quotes and 3 invoices a month, no e-invoicing). Pro is €39 a month, or €32 a month billed annually, with 3 team members included and up to 3 more at €10 a month each. Contractor is €69 a month, or €56 a month billed annually, for teams of up to 15. New accounts get their first month of Pro free. Vasco charges no commission on payments — your customers pay into your own Mollie or Stripe account.",
        },
        {
          q: "What about my accountant?",
          a: "Vasco gives you a VAT report per period — sales and VAT per rate, purchases, and the documents behind them — as PDF or CSV for your accountant. Vasco does not file tax returns for you.",
        },
        {
          q: "Is it compliant with EU e-invoicing rules?",
          a: "Vasco generates structured e-invoices in the format each market uses: XRechnung and ZUGFeRD (DE), Factur-X (FR), Facturae (ES), FatturaPA (IT) and Peppol (NL/EU). We check our German output against the official KoSIT validator.",
        },
        {
          q: "Who is Vasco for?",
          a: "Self-employed tradespeople (plumbers, electricians, painters, carpenters and more) and aannemers running renovation projects. If you work with your hands and send quotes and invoices, Vasco is for you.",
        },
      ],
    },
    finalCta: {
      titleLead: "Send your next quote",
      titleAccent: "from your phone.",
      body:
        "Join the beta. We'll email you when Vasco opens in your country.",
      cta: "Join the beta",
    },
    footer: {
      tagline: "Quotes, invoices and e-invoicing for the trades.",
      address: "Amsterdam, The Netherlands",
      product: {
        title: "Product",
        links: [
          { href: "#how", label: "How it works" },
          { href: "#pricing", label: "Pricing" },
          { href: "#faq", label: "FAQ" },
          { href: "/support", label: "Support" },
        ],
      },
      legal: { title: "Legal", links: LEGAL_LINKS_EN },
      contact: { title: "Contact", links: CONTACT_LINKS },
      bottomCompliance: "EU datacenters · GDPR",
    },
  },

  nl: {
    meta: {
      title: "Vasco — Offertes, facturen en e-facturen voor vakmensen",
      description:
        "Offertes, klussen, facturen en e-facturen voor loodgieters, elektriciens, schilders, timmerlieden en aannemers. Gratis pakket; Pro vanaf €32 per maand bij jaarbetaling (excl. btw). Geen commissie op betalingen.",
      ogDescription:
        "Offertes, facturen en e-facturen voor vakmensen. Gratis pakket, Pro vanaf €32/mnd bij jaarbetaling, geen commissie op betalingen. Binnenkort voor iOS en Android.",
    },
    nav: {
      how: "Hoe het werkt",
      pricing: "Prijzen",
      faq: "Veelgestelde vragen",
      support: "Support",
      cta: "Doe mee met de bèta",
    },
    hero: {
      badge: "In bèta — binnenkort voor iOS en Android",
      title: "Offertes en facturen,",
      titleAccent: "vanaf je telefoon.",
      sub:
        "Offertes, klussen, facturen en de e-factuurregels van het land waar je werkt — in één app op je telefoon. Minder avonden aan de keukentafel.",
      ctaPrimary: "Doe mee met de bèta",
      ctaSecondary: "Zo werkt het",
      marketsPrefix: "Actief in",
    },
    stats: [
      { value: "6", label: "Landen" },
      { value: "15", label: "Vakgebieden" },
      { value: "6", label: "E-factuurformaten" },
      { value: "0%", label: "Commissie op betalingen" },
    ],
    features: {
      titleLead: "Wat je in Vasco doet.",
      titleAccent: "Vijf schermen, van offerte tot betaald.",
      footnote: "Schermen uit de app, met voorbeeldgegevens. Vasco staat nog niet in de App Store of Google Play.",
      items: [
        { label: "Offerte", screen: "quote", title: "Prijs het op de klus.", body: "Regels uit je eigen prijslijst, met Goed / Beter / Best-opties als je dat wilt. Je klant opent de offerte op zijn telefoon en gaat online akkoord — zonder account." },
        { label: "Factuur", screen: "invoice", title: "Met één tik een factuur.", body: "Een afgeronde klus wordt een factuur zonder overtypen. Vasco maakt hem volgens de regels van het land waar je werkt — XRechnung, ZUGFeRD, Factur-X, Facturae, FatturaPA of Peppol — met een QR-code voor de overboeking op facturen in euro." },
        { label: "Geld", screen: "money", title: "Zie wat nog openstaat.", body: "Wat moet nog binnenkomen, wat is te laat en wat is betaald. Een betaallink via je eigen Mollie- of Stripe-account; bij een late factuur zet Vasco een herinnering klaar die jij controleert en verstuurt." },
        { label: "Klanten", screen: "customers", title: "Klanten, compleet.", body: "Naam, adres, btw-nummer en e-factuurgegevens op één plek, zodat de factuur in één keer klopt." },
        { label: "Klussen", screen: "work", title: "Klussen die zichzelf factureren.", body: "Plan het werk, schrijf uren en materiaal. Is de klus af, dan factureert Vasco de afgesproken prijs — of, zonder afspraak, de geschreven uren en het gebruikte materiaal." },
      ],
    },
    pricing: {
      eyebrow: "Prijzen",
      titleLead: "Eenvoudige pakketten.",
      titleAccent: "Geen commissie.",
      noCommission:
        "Vasco rekent geen commissie op betalingen. Je klant betaalt op je eigen Mollie- of Stripe-account.",
      badge: "MEEST GEKOZEN",
      closer: "Prijzen excl. btw. Je eerste maand Pro is gratis. Maandelijks opzegbaar.",
      closerAccent: "Geen commissie op je betalingen.",
      plans: [
        {
          name: "Gratis",
          price: "€0",
          period: "/mnd",
          tagline: "Begin meteen. Zonder verplichting.",
          features: [
            "5 actieve klussen",
            "5 offertes en 3 facturen per maand",
            "25 klanten",
            "Geen e-facturen — dat is Pro",
          ],
          cta: "Doe mee met de bèta",
          highlight: false,
        },
        {
          name: "Pro",
          price: "€39",
          period: "/mnd",
          annual: "of €32/mnd bij jaarbetaling",
          tagline: "Onbeperkt offertes en facturen, plus e-facturen.",
          features: [
            "Onbeperkt klussen, offertes, facturen en klanten",
            "E-facturen in alle 6 landen",
            "Betaallinks via je eigen Mollie of Stripe",
            "Online akkoord op offertes voor je klanten",
            "3 teamleden inbegrepen, tot 3 extra voor €10/mnd per persoon",
          ],
          cta: "Doe mee met de bèta",
          highlight: true,
          badge: "MEEST GEKOZEN",
        },
        {
          name: "Aannemer",
          price: "€69",
          period: "/mnd",
          annual: "of €56/mnd bij jaarbetaling",
          tagline: "Voor teams.",
          features: [
            "Alles uit Pro",
            "Tot 15 teamleden",
            "Persoonlijke support",
          ],
          cta: "Neem contact op",
          highlight: false,
        },
      ],
    },
    trades: {
      eyebrow: "Voor vakmensen gemaakt",
      titleLead: "15 vakgebieden.",
      titleAccent: "Eén gereedschapskist.",
      body:
        "Van zzp-loodgieter tot aannemer met meerdere ploegen. Vasco spreekt je vak en de taal van je klant — in zes talen.",
      list: [
        "Loodgieter",
        "Elektricien",
        "Gas & CV",
        "Schilder",
        "Timmerman",
        "Dakdekker",
        "Tegelzetter",
        "Stukadoor",
        "Vloerlegger",
        "Isolatie",
        "Zonnepanelen",
        "Glaszetter",
        "Hovenier",
        "Metselaar",
        "Sloopwerk",
      ],
    },
    manifesto: {
      eyebrow: "Voor vakmensen",
      line1: "Je bent geen loodgieter geworden om",
      line1Accent: "btw-codes te leren.",
      line2: "Je bent loodgieter geworden om",
      line2Accent: "dingen te maken.",
      closer: "Vasco helpt met de rest.",
    },
    faq: {
      eyebrow: "Veelgestelde vragen",
      titleLead: "Vragen.",
      titleAccent: "Eerlijke antwoorden.",
      items: [
        {
          q: "Kan ik Vasco al downloaden?",
          a: "Nog niet uit de stores. Vasco is in een besloten bèta op iPhone (TestFlight) en komt naar iOS en Android. Doe mee met de bèta, dan mailen we je zodra er plek is.",
        },
        {
          q: "Wat kost het?",
          a: "Alle prijzen zijn exclusief btw. Gratis kost €0, met limieten (5 actieve klussen, 5 offertes en 3 facturen per maand, geen e-facturen). Pro kost €39 per maand, of €32 per maand bij jaarbetaling, met 3 teamleden inbegrepen en tot 3 extra voor €10 per maand per persoon. Aannemer kost €69 per maand, of €56 per maand bij jaarbetaling, voor teams tot 15 personen. Nieuwe accounts krijgen de eerste maand Pro gratis. Vasco rekent geen commissie op betalingen — je klanten betalen op je eigen Mollie- of Stripe-account.",
        },
        {
          q: "En mijn boekhouder?",
          a: "Vasco maakt per periode een btw-overzicht — omzet en btw per tarief, inkopen en de documenten erachter — als PDF of CSV voor je boekhouder. Vasco doet geen aangifte voor je.",
        },
        {
          q: "Voldoet het aan de EU e-factuurregels?",
          a: "Vasco maakt gestructureerde e-facturen in het formaat dat elk land gebruikt: XRechnung en ZUGFeRD (DE), Factur-X (FR), Facturae (ES), FatturaPA (IT) en Peppol (NL/EU). Onze Duitse e-facturen controleren we met de officiële KoSIT-validator.",
        },
        {
          q: "Voor wie is Vasco?",
          a: "Zzp-vakmensen (loodgieters, elektriciens, schilders, timmerlieden en meer) en aannemers die verbouwingen draaien. Werk je met je handen en stuur je offertes en facturen, dan is Vasco voor jou.",
        },
      ],
    },
    finalCta: {
      titleLead: "Stuur je volgende offerte",
      titleAccent: "vanaf je telefoon.",
      body:
        "Doe mee met de bèta. We mailen je zodra Vasco in jouw land opengaat.",
      cta: "Doe mee met de bèta",
    },
    footer: {
      tagline: "Offertes, facturen en e-facturen voor vakmensen.",
      address: "Amsterdam, Nederland",
      product: {
        title: "Product",
        links: [
          { href: "#how", label: "Hoe het werkt" },
          { href: "#pricing", label: "Prijzen" },
          { href: "#faq", label: "Veelgestelde vragen" },
          { href: "/support", label: "Support" },
        ],
      },
      legal: {
        title: "Juridisch",
        links: [
          { href: "/legal/privacy-policy", label: "Privacy" },
          { href: "/legal/terms-of-service", label: "Voorwaarden" },
          { href: "/legal/eula", label: "EULA" },
          { href: "/legal/cookie-policy", label: "Cookies" },
          { href: "/legal/data-processing-agreement", label: "DPA" },
          { href: "/legal/acceptable-use-policy", label: "Gebruiksregels" },
        ],
      },
      contact: { title: "Contact", links: CONTACT_LINKS },
      bottomCompliance: "EU-datacenters · AVG",
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // de. Germany is the beachhead (memory/gtm-germany-beachhead.md). Formal
  // "Sie" throughout, as in the app and the customer pages. Same claims as
  // en — nothing here that the English page does not also state.
  // ─────────────────────────────────────────────────────────────────────
  de: {
    meta: {
      title: "Vasco — Angebote, Rechnungen und E-Rechnungen für Handwerker",
      description:
        "Angebote, Aufträge, Rechnungen und E-Rechnungen (XRechnung, ZUGFeRD) für Installateure, Elektriker, Maler, Tischler und Bauunternehmer. Gratis-Tarif; Pro ab 32 € pro Monat bei jährlicher Zahlung (zzgl. MwSt.). Keine Provision auf Zahlungen.",
      ogDescription:
        "Angebote, Rechnungen und E-Rechnungen für Handwerker. Gratis-Tarif, Pro ab 32 €/Monat bei jährlicher Zahlung, keine Provision auf Zahlungen. Bald für iOS und Android.",
    },
    nav: {
      how: "So funktioniert's",
      pricing: "Preise",
      faq: "Häufige Fragen",
      support: "Support",
      cta: "Zur Beta anmelden",
    },
    hero: {
      badge: "In der Beta — bald für iOS und Android",
      title: "Angebote und Rechnungen,",
      titleAccent: "direkt vom Handy.",
      sub:
        "Angebote, Aufträge, Rechnungen und die E-Rechnungsregeln des Landes, in dem Sie arbeiten — in einer App auf Ihrem Handy. Weniger Büroarbeit am Feierabend.",
      ctaPrimary: "Zur Beta anmelden",
      ctaSecondary: "So funktioniert's",
      marketsPrefix: "Aktiv in",
    },
    stats: [
      { value: "6", label: "Länder" },
      { value: "15", label: "Gewerke" },
      { value: "6", label: "E-Rechnungsformate" },
      { value: "0 %", label: "Provision auf Zahlungen" },
    ],
    features: {
      titleLead: "Was Sie in Vasco erledigen.",
      titleAccent: "Fünf Bildschirme, vom Angebot bis zum Geld.",
      footnote: "Bildschirme aus der App, mit Beispieldaten. Vasco ist noch nicht im App Store oder bei Google Play.",
      items: [
        { label: "Angebot", screen: "quote", title: "Preis direkt vor Ort.", body: "Positionen aus Ihrer eigenen Preisliste, auf Wunsch mit den Optionen Gut / Besser / Optimal. Ihr Kunde öffnet das Angebot auf dem Handy und nimmt es online an — ohne Konto." },
        { label: "Rechnung", screen: "invoice", title: "Rechnung mit einem Tippen.", body: "Aus einem erledigten Auftrag wird ohne Abtippen eine Rechnung. Vasco erstellt sie nach den Regeln des Landes, in dem Sie arbeiten — XRechnung, ZUGFeRD, Factur-X, Facturae, FatturaPA oder Peppol — mit QR-Code für die Überweisung auf Euro-Rechnungen." },
        { label: "Finanzen", screen: "money", title: "Sehen, was noch offen ist.", body: "Was fällig ist, was überfällig ist und was eingegangen ist. Ein Zahlungslink über Ihr eigenes Mollie- oder Stripe-Konto; bei einer überfälligen Rechnung bereitet Vasco eine Erinnerung vor, die Sie prüfen und versenden." },
        { label: "Kunden", screen: "customers", title: "Kunden, vollständig.", body: "Name, Anschrift, USt-IdNr. und E-Rechnungsdaten an einem Ort, damit die Rechnung beim ersten Mal stimmt." },
        { label: "Aufträge", screen: "work", title: "Aufträge, die sich selbst abrechnen.", body: "Arbeit planen, Stunden und Material erfassen. Ist der Auftrag erledigt, stellt Vasco den vereinbarten Preis in Rechnung — oder, ohne Vereinbarung, die erfassten Stunden und das verbrauchte Material." },
      ],
    },
    pricing: {
      eyebrow: "Preise",
      titleLead: "Einfache Tarife.",
      titleAccent: "Keine Provision.",
      noCommission:
        "Vasco nimmt keine Provision auf Zahlungen. Ihr Kunde zahlt direkt auf Ihr eigenes Mollie- oder Stripe-Konto.",
      badge: "AM BELIEBTESTEN",
      closer: "Alle Preise zzgl. MwSt. Ihr erster Monat Pro ist kostenlos. Jederzeit kündbar.",
      closerAccent: "Keine Provision auf Ihre Zahlungen.",
      plans: [
        {
          name: "Gratis",
          price: "0 €",
          period: "/Monat",
          tagline: "Sofort loslegen. Ohne Verpflichtung.",
          features: [
            "5 aktive Aufträge",
            "5 Angebote und 3 Rechnungen pro Monat",
            "25 Kunden",
            "Keine E-Rechnung — die gibt es mit Pro",
          ],
          cta: "Zur Beta anmelden",
          highlight: false,
        },
        {
          name: "Pro",
          price: "39 €",
          period: "/Monat",
          annual: "oder 32 €/Monat bei jährlicher Zahlung",
          tagline: "Unbegrenzt Angebote und Rechnungen, plus E-Rechnung.",
          features: [
            "Unbegrenzt Aufträge, Angebote, Rechnungen und Kunden",
            "E-Rechnung in allen 6 Ländern",
            "Zahlungslinks über Ihr eigenes Mollie oder Stripe",
            "Online-Annahme von Angeboten für Ihre Kunden",
            "3 Teammitglieder inklusive, bis zu 3 weitere für je 10 €/Monat",
          ],
          cta: "Zur Beta anmelden",
          highlight: true,
          badge: "AM BELIEBTESTEN",
        },
        {
          name: "Betrieb",
          price: "69 €",
          period: "/Monat",
          annual: "oder 56 €/Monat bei jährlicher Zahlung",
          tagline: "Für Teams.",
          features: [
            "Alles aus Pro",
            "Bis zu 15 Teammitglieder",
            "Persönlicher Support",
          ],
          cta: "Kontakt aufnehmen",
          highlight: false,
        },
      ],
    },
    trades: {
      eyebrow: "Fürs Handwerk gemacht",
      titleLead: "15 Gewerke.",
      titleAccent: "Ein Werkzeugkasten.",
      body:
        "Vom Ein-Mann-Betrieb bis zum Bauunternehmen mit mehreren Gewerken. Vasco spricht Ihr Handwerk und die Sprache Ihrer Kunden — in sechs Sprachen.",
      list: [
        "Sanitär",
        "Elektro",
        "Heizung & Gas",
        "Maler",
        "Tischler",
        "Dachdecker",
        "Fliesenleger",
        "Stuckateur",
        "Bodenleger",
        "Dämmung",
        "Photovoltaik",
        "Glaser",
        "Garten- und Landschaftsbau",
        "Maurer",
        "Abbruch",
      ],
    },
    manifesto: {
      eyebrow: "Für Handwerker",
      line1: "Sie sind nicht Installateur geworden, um",
      line1Accent: "Steuerschlüssel zu lernen.",
      line2: "Sie sind Installateur geworden, um",
      line2Accent: "Dinge zu reparieren.",
      closer: "Bei allem anderen hilft Vasco.",
    },
    faq: {
      eyebrow: "Häufige Fragen",
      titleLead: "Fragen.",
      titleAccent: "Klare Antworten.",
      items: [
        {
          q: "Kann ich Vasco schon herunterladen?",
          a: "Noch nicht aus den Stores. Vasco ist in einer geschlossenen Beta auf dem iPhone (TestFlight) und kommt für iOS und Android. Melden Sie sich zur Beta an, dann schreiben wir Ihnen, sobald ein Platz frei ist.",
        },
        {
          q: "Was kostet Vasco?",
          a: "Alle Preise verstehen sich zzgl. MwSt. Gratis kostet 0 €, mit Grenzen (5 aktive Aufträge, 5 Angebote und 3 Rechnungen pro Monat, keine E-Rechnung). Pro kostet 39 € pro Monat oder 32 € pro Monat bei jährlicher Zahlung, mit 3 Teammitgliedern inklusive und bis zu 3 weiteren für je 10 € pro Monat. Betrieb kostet 69 € pro Monat oder 56 € pro Monat bei jährlicher Zahlung, für Teams bis 15 Personen. Neue Konten erhalten den ersten Monat Pro kostenlos. Vasco nimmt keine Provision auf Zahlungen — Ihre Kunden zahlen auf Ihr eigenes Mollie- oder Stripe-Konto.",
        },
        {
          q: "Und mein Steuerberater?",
          a: "Vasco erstellt pro Zeitraum eine Umsatzsteuer-Übersicht — Umsätze und Umsatzsteuer je Steuersatz, Einkäufe und die zugehörigen Belege — als PDF oder CSV für Ihren Steuerberater. Vasco gibt keine Steuererklärungen für Sie ab.",
        },
        {
          q: "Erfüllt Vasco die Regeln für die E-Rechnung?",
          a: "Vasco erstellt strukturierte E-Rechnungen im Format des jeweiligen Landes: XRechnung und ZUGFeRD (DE), Factur-X (FR), Facturae (ES), FatturaPA (IT) und Peppol (NL/EU). Unsere deutschen E-Rechnungen prüfen wir mit dem offiziellen KoSIT-Validator.",
        },
        {
          q: "Für wen ist Vasco?",
          a: "Für selbstständige Handwerker (Installateure, Elektriker, Maler, Tischler und mehr) und Bauunternehmer, die Sanierungsprojekte leiten. Wenn Sie mit den Händen arbeiten und Angebote und Rechnungen schreiben, ist Vasco für Sie.",
        },
      ],
    },
    finalCta: {
      titleLead: "Ihr nächstes Angebot",
      titleAccent: "vom Handy aus.",
      body:
        "Melden Sie sich zur Beta an. Wir schreiben Ihnen, sobald Vasco in Ihrem Land startet.",
      cta: "Zur Beta anmelden",
    },
    footer: {
      tagline: "Angebote, Rechnungen und E-Rechnungen für Handwerker.",
      address: "Amsterdam, Niederlande",
      product: {
        title: "Produkt",
        links: [
          { href: "#how", label: "So funktioniert's" },
          { href: "#pricing", label: "Preise" },
          { href: "#faq", label: "Häufige Fragen" },
          { href: "/support", label: "Support" },
        ],
      },
      legal: {
        title: "Rechtliches",
        links: [
          { href: "/legal/privacy-policy", label: "Datenschutz" },
          { href: "/legal/terms-of-service", label: "AGB" },
          { href: "/legal/eula", label: "EULA" },
          { href: "/legal/cookie-policy", label: "Cookies" },
          { href: "/legal/data-processing-agreement", label: "AVV" },
          { href: "/legal/acceptable-use-policy", label: "Nutzungsregeln" },
        ],
      },
      contact: { title: "Kontakt", links: CONTACT_LINKS },
      bottomCompliance: "EU-Rechenzentren · DSGVO",
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // en-US. Prices are the app's own, which are set in EUR — no separate US
  // price list exists, so none is invented here.
  // ─────────────────────────────────────────────────────────────────────
  "en-US": {
    meta: {
      title: "Vasco — Estimates and invoices for the trades",
      description:
        "Estimates, jobs and invoices for HVAC, electrical, plumbing, roofing and remodeling pros, from your phone. Free plan; Pro from €32/month billed annually (excl. VAT). No commission on payments.",
      ogDescription:
        "Estimates, jobs and invoices from your phone. Free plan, no commission on payments. Coming to iOS and Android.",
    },
    nav: {
      how: "How it works",
      pricing: "Pricing",
      faq: "FAQ",
      support: "Support",
      cta: "Join the beta",
    },
    hero: {
      badge: "In beta — coming to iOS and Android",
      title: "Estimates and invoices,",
      titleAccent: "from your phone.",
      sub:
        "Estimates, jobs and invoices in one app on your phone. Your customer accepts the estimate online; a finished job becomes an invoice in one tap.",
      ctaPrimary: "Join the beta",
      ctaSecondary: "See how it works",
      marketsPrefix: "Planned for",
    },
    stats: [
      { value: "15", label: "Trades" },
      { value: "3", label: "Plans" },
      { value: "1", label: "Tap job → invoice" },
      { value: "0%", label: "Commission on payments" },
    ],
    features: {
      titleLead: "What you do in Vasco.",
      titleAccent: "Five screens, estimate to paid.",
      footnote: "Screens from the app, with example data. Vasco is not in the App Store or Google Play yet.",
      items: [
        { label: "Estimate", screen: "quote", title: "Price it on site.", body: "Line items from your own price list, with Good / Better / Best options when you want them. Your customer opens the estimate on their phone and accepts it online — no account needed." },
        { label: "Invoice", screen: "invoice", title: "An invoice in one tap.", body: "A finished job becomes an invoice without retyping, with a payment link through your own Stripe account." },
        { label: "Money", screen: "money", title: "See what is still open.", body: "What is due, what is late, and what came in. For a late invoice Vasco drafts a reminder for you to check and send." },
        { label: "Customers", screen: "customers", title: "Customers, complete.", body: "Name, address and contact details in one place, so the invoice is right the first time." },
        { label: "Jobs", screen: "work", title: "Jobs that bill themselves.", body: "Plan the work, log hours and materials. When the job is done, Vasco invoices the agreed price — or, without one, the hours you logged and the materials you used." },
      ],
    },
    pricing: {
      eyebrow: "Pricing",
      titleLead: "Simple plans.",
      titleAccent: "No commission.",
      noCommission:
        "Vasco takes no commission on payments. Your customer pays into your own payment account. Prices in EUR.",
      badge: "MOST POPULAR",
      closer: "Prices excl. VAT. Your first month of Pro is free. Cancel anytime.",
      closerAccent: "No commission on your payments.",
      plans: [
        {
          name: "Free",
          price: "€0",
          period: "/mo",
          tagline: "Start free.",
          features: [
            "5 active jobs",
            "5 estimates and 3 invoices a month",
            "25 customers",
          ],
          cta: "Join the beta",
          highlight: false,
        },
        {
          name: "Pro",
          price: "€39",
          period: "/mo",
          annual: "or €32/mo billed annually",
          tagline: "Unlimited estimates and invoices.",
          features: [
            "Unlimited jobs, estimates, invoices and customers",
            "Payment links via your own Stripe account",
            "Online estimate acceptance for your customers",
            "3 team members included, up to 3 more at €10/mo each",
          ],
          cta: "Join the beta",
          highlight: true,
          badge: "MOST POPULAR",
        },
        {
          name: "Contractor",
          price: "€69",
          period: "/mo",
          annual: "or €56/mo billed annually",
          tagline: "For crews.",
          features: [
            "Everything in Pro",
            "Up to 15 team members",
            "Dedicated support",
          ],
          cta: "Talk to us",
          highlight: false,
        },
      ],
    },
    trades: {
      eyebrow: "Built for the trades",
      titleLead: "15 trades.",
      titleAccent: "One toolbox.",
      body:
        "From solo electricians to multi-crew remodeling contractors. Vasco speaks your trade.",
      list: [
        "HVAC",
        "Electrical",
        "Plumbing",
        "Roofing",
        "Remodeling",
        "Painting",
        "Carpentry",
        "Tile",
        "Flooring",
        "Insulation",
        "Solar",
        "Windows & Glass",
        "Landscaping",
        "Masonry",
        "Demolition",
      ],
    },
    manifesto: {
      eyebrow: "Built for pros",
      line1: "You didn't go into the trades to learn",
      line1Accent: "bookkeeping.",
      line2: "You went into the trades to",
      line2Accent: "build things.",
      closer: "Vasco helps with the rest.",
    },
    faq: {
      eyebrow: "FAQ",
      titleLead: "Questions.",
      titleAccent: "Straight answers.",
      items: [
        {
          q: "Can I download Vasco yet?",
          a: "Not from the stores yet. Vasco is in a closed beta on iPhone (TestFlight) and is coming to iOS and Android. Join the beta and we will email you when there is a place for you.",
        },
        {
          q: "What does it cost?",
          a: "Free is €0 with limits (5 active jobs, 5 estimates and 3 invoices a month). Pro is €39 a month, or €32 a month billed annually, with 3 team members included and up to 3 more at €10 a month each. Contractor is €69 a month, or €56 a month billed annually, for crews of up to 15. New accounts get their first month of Pro free. Prices are in EUR, excluding tax. Vasco charges no commission on payments.",
        },
        {
          q: "Do you file my taxes?",
          a: "No. Vasco gives you a report of sales and tax per period as PDF or CSV for you or your accountant. Filing stays with you.",
        },
        {
          q: "Who is Vasco for?",
          a: "Solo pros (electricians, plumbers, HVAC techs, painters) and small crews. If you work with your hands and send estimates and invoices, Vasco is for you.",
        },
      ],
    },
    finalCta: {
      titleLead: "Send your next estimate",
      titleAccent: "from your phone.",
      body:
        "Join the beta. We'll email you when there is a place for you.",
      cta: "Join the beta",
    },
    footer: {
      tagline: "Estimates and invoices for the trades.",
      address: "Amsterdam, The Netherlands",
      product: {
        title: "Product",
        links: [
          { href: "#how", label: "How it works" },
          { href: "#pricing", label: "Pricing" },
          { href: "#faq", label: "FAQ" },
          { href: "/support", label: "Support" },
        ],
      },
      legal: { title: "Legal", links: LEGAL_LINKS_EN },
      contact: { title: "Contact", links: CONTACT_LINKS },
      bottomCompliance: "EU datacenters · GDPR",
    },
  },
};
