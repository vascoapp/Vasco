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
  appStorePreview: {
    eyebrow: string;
    titleLead: string;
    titleAccent: string;
    footnote: string;
    screens: Array<{ src: string; label: string }>;
  };
  guideThrough: {
    eyebrow: string;
    titleLead: string;
    titleAccent: string;
    items: Array<{ no: string; label: string; title: string; body: string }>;
  };
  how: {
    eyebrow: string;
    titleLead: string;
    titleAccent: string;
    steps: Array<{ n: string; title: string; body: string }>;
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
      /** Price per month when billed annually, e.g. "€29/mo billed annually". */
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
        "Quotes, jobs, invoices and e-invoicing for plumbers, electricians, painters, carpenters and aannemers in NL, DE, FR, ES, IT and the UK. Free plan; Pro from €29/month billed annually. No commission on payments.",
      ogDescription:
        "Quotes, invoices and e-invoicing for the trades. Free plan, Pro from €29/month billed annually, no commission on payments. Coming to iOS and Android.",
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
      title: "Vasco knows",
      titleAccent: "the way.",
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
    appStorePreview: {
      eyebrow: "Inside the app",
      titleLead: "Four screens.",
      titleAccent: "One app for the paperwork.",
      footnote:
        "Screens from the app, with example data. Vasco is not in the App Store or Google Play yet.",
      screens: [
        { src: "/screenshots/app-en-1.png", label: "Today" },
        { src: "/screenshots/app-en-2.png", label: "Quote" },
        { src: "/screenshots/app-en-3.png", label: "Money" },
        { src: "/screenshots/app-en-4.png", label: "Invoice" },
      ],
    },
    guideThrough: {
      eyebrow: "What Vasco does",
      titleLead: "Your guide through the stuff",
      titleAccent: "nobody trained you for.",
      items: [
        {
          no: "01",
          label: "The admin pile",
          title: "Off the laptop.\nBack on the tools.",
          body:
            "Quotes, jobs and invoices in one place on your phone. A finished job becomes an invoice in one tap — no retyping.",
        },
        {
          no: "02",
          label: "EU compliance",
          title: "VAT. E-invoices.\nThe local rules.",
          body:
            "XRechnung, ZUGFeRD, Factur-X, Facturae, FatturaPA and Peppol. Small-business schemes such as the KOR and Kleinunternehmer. Vasco builds your invoices to the rules of the country you work in.",
        },
        {
          no: "03",
          label: "Slow payers",
          title: "Get paid.\nWithout the awkward call.",
          body:
            "A payment link on the invoice through your own Mollie or Stripe account. When an invoice is overdue, Vasco drafts a reminder for you to check and send.",
        },
      ],
    },
    how: {
      eyebrow: "How it works",
      titleLead: "Three steps.",
      titleAccent: "Quote to paid.",
      steps: [
        {
          n: "1",
          title: "Build the quote.",
          body:
            "Line items from your own price list, with Good / Better / Best options if you want them.",
        },
        {
          n: "2",
          title: "Send the quote.",
          body:
            "Your customer opens it on their phone and accepts it online. No account needed on their side.",
        },
        {
          n: "3",
          title: "Get paid.",
          body:
            "Finish the job and turn it into an invoice in one tap. Add a payment link through your own Mollie or Stripe account.",
        },
      ],
    },
    pricing: {
      eyebrow: "Pricing",
      titleLead: "Simple plans.",
      titleAccent: "No commission.",
      noCommission:
        "Vasco takes no commission on payments. Your customer pays into your own Mollie or Stripe account.",
      badge: "MOST POPULAR",
      closer: "Cancel anytime. No setup fees.",
      closerAccent: "No commission on your payments.",
      plans: [
        {
          name: "Free",
          price: "€0",
          period: "/mo",
          tagline: "Get started. No commitment.",
          features: [
            "5 active jobs",
            "10 quotes and 10 invoices a month",
            "25 customers",
            "1 country",
          ],
          cta: "Join the beta",
          highlight: false,
        },
        {
          name: "Pro",
          price: "€39",
          period: "/mo",
          annual: "or €29/mo billed annually",
          tagline: "Unlimited quotes and invoices, plus e-invoicing.",
          features: [
            "Unlimited jobs, quotes, invoices and customers",
            "E-invoicing in all 6 countries",
            "Payment links via your own Mollie or Stripe",
            "Online quote acceptance for your customers",
            "Up to 3 team members",
          ],
          cta: "Join the beta",
          highlight: true,
          badge: "MOST POPULAR",
        },
        {
          name: "Contractor",
          price: "€69",
          period: "/mo",
          annual: "or €49/mo billed annually",
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
          a: "Free is €0 with limits (5 active jobs, 10 quotes and 10 invoices a month). Pro is €39 a month, or €29 a month billed annually. Contractor is €69 a month, or €49 a month billed annually, and adds team seats. Vasco charges no commission on payments — your customers pay into your own Mollie or Stripe account.",
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
        "Offertes, klussen, facturen en e-facturen voor loodgieters, elektriciens, schilders, timmerlieden en aannemers. Gratis pakket; Pro vanaf €29 per maand bij jaarbetaling. Geen commissie op betalingen.",
      ogDescription:
        "Offertes, facturen en e-facturen voor vakmensen. Gratis pakket, Pro vanaf €29/mnd bij jaarbetaling, geen commissie op betalingen. Binnenkort voor iOS en Android.",
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
      title: "Vasco kent",
      titleAccent: "de weg.",
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
    appStorePreview: {
      eyebrow: "In de app",
      titleLead: "Vier schermen.",
      titleAccent: "Eén app voor het papierwerk.",
      footnote:
        "Schermen uit de app, met voorbeeldgegevens. Vasco staat nog niet in de App Store of Google Play.",
      screens: [
        { src: "/screenshots/app-nl-1.png", label: "Vandaag" },
        { src: "/screenshots/app-nl-2.png", label: "Offerte" },
        { src: "/screenshots/app-nl-3.png", label: "Geld" },
        { src: "/screenshots/app-nl-4.png", label: "Factuur" },
      ],
    },
    guideThrough: {
      eyebrow: "Wat Vasco doet",
      titleLead: "Je gids door alles",
      titleAccent: "waar geen opleiding voor bestaat.",
      items: [
        {
          no: "01",
          label: "De administratie",
          title: "Laptop dicht.\nGereedschap pakken.",
          body:
            "Offertes, klussen en facturen op één plek op je telefoon. Een afgeronde klus wordt met één tik een factuur — niks overtypen.",
        },
        {
          no: "02",
          label: "EU-regels",
          title: "Btw. E-facturen.\nDe regels per land.",
          body:
            "XRechnung, ZUGFeRD, Factur-X, Facturae, FatturaPA en Peppol. Regelingen als de KOR en Kleinunternehmer. Vasco maakt je facturen volgens de regels van het land waar je werkt.",
        },
        {
          no: "03",
          label: "Late betalers",
          title: "Krijg betaald.\nZonder vervelend telefoontje.",
          body:
            "Een betaallink op de factuur via je eigen Mollie- of Stripe-account. Is een factuur te laat, dan zet Vasco een herinnering klaar die jij controleert en verstuurt.",
        },
      ],
    },
    how: {
      eyebrow: "Hoe het werkt",
      titleLead: "Drie stappen.",
      titleAccent: "Van offerte tot betaald.",
      steps: [
        {
          n: "1",
          title: "Maak de offerte.",
          body:
            "Regels uit je eigen prijslijst, met Goed / Beter / Best-opties als je dat wilt.",
        },
        {
          n: "2",
          title: "Verstuur de offerte.",
          body:
            "Je klant opent hem op zijn telefoon en gaat online akkoord. Hij heeft geen account nodig.",
        },
        {
          n: "3",
          title: "Krijg betaald.",
          body:
            "Klus af? Met één tik maak je er een factuur van. Voeg een betaallink toe via je eigen Mollie- of Stripe-account.",
        },
      ],
    },
    pricing: {
      eyebrow: "Prijzen",
      titleLead: "Eenvoudige pakketten.",
      titleAccent: "Geen commissie.",
      noCommission:
        "Vasco rekent geen commissie op betalingen. Je klant betaalt op je eigen Mollie- of Stripe-account.",
      badge: "MEEST GEKOZEN",
      closer: "Maandelijks opzegbaar. Geen instapkosten.",
      closerAccent: "Geen commissie op je betalingen.",
      plans: [
        {
          name: "Gratis",
          price: "€0",
          period: "/mnd",
          tagline: "Begin meteen. Zonder verplichting.",
          features: [
            "5 actieve klussen",
            "10 offertes en 10 facturen per maand",
            "25 klanten",
            "1 land",
          ],
          cta: "Doe mee met de bèta",
          highlight: false,
        },
        {
          name: "Pro",
          price: "€39",
          period: "/mnd",
          annual: "of €29/mnd bij jaarbetaling",
          tagline: "Onbeperkt offertes en facturen, plus e-facturen.",
          features: [
            "Onbeperkt klussen, offertes, facturen en klanten",
            "E-facturen in alle 6 landen",
            "Betaallinks via je eigen Mollie of Stripe",
            "Online akkoord op offertes voor je klanten",
            "Tot 3 teamleden",
          ],
          cta: "Doe mee met de bèta",
          highlight: true,
          badge: "MEEST GEKOZEN",
        },
        {
          name: "Aannemer",
          price: "€69",
          period: "/mnd",
          annual: "of €49/mnd bij jaarbetaling",
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
          a: "Gratis kost €0, met limieten (5 actieve klussen, 10 offertes en 10 facturen per maand). Pro kost €39 per maand, of €29 per maand bij jaarbetaling. Aannemer kost €69 per maand, of €49 per maand bij jaarbetaling, en voegt teamleden toe. Vasco rekent geen commissie op betalingen — je klanten betalen op je eigen Mollie- of Stripe-account.",
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
        "Angebote, Aufträge, Rechnungen und E-Rechnungen (XRechnung, ZUGFeRD) für Installateure, Elektriker, Maler, Tischler und Bauunternehmer. Gratis-Tarif; Pro ab 29 € pro Monat bei jährlicher Zahlung. Keine Provision auf Zahlungen.",
      ogDescription:
        "Angebote, Rechnungen und E-Rechnungen für Handwerker. Gratis-Tarif, Pro ab 29 €/Monat bei jährlicher Zahlung, keine Provision auf Zahlungen. Bald für iOS und Android.",
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
      title: "Vasco kennt",
      titleAccent: "den Weg.",
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
    appStorePreview: {
      eyebrow: "In der App",
      titleLead: "Vier Bildschirme.",
      titleAccent: "Eine App für den Papierkram.",
      footnote:
        "Bildschirme aus der App, mit Beispieldaten. Vasco ist noch nicht im App Store oder bei Google Play.",
      screens: [
        { src: "/screenshots/app-de-1.png", label: "Heute" },
        { src: "/screenshots/app-de-2.png", label: "Angebot" },
        { src: "/screenshots/app-de-3.png", label: "Finanzen" },
        { src: "/screenshots/app-de-4.png", label: "Rechnung" },
      ],
    },
    guideThrough: {
      eyebrow: "Was Vasco macht",
      titleLead: "Ihr Wegweiser durch alles,",
      titleAccent: "was in keiner Ausbildung vorkommt.",
      items: [
        {
          no: "01",
          label: "Die Büroarbeit",
          title: "Laptop zu.\nWerkzeug in die Hand.",
          body:
            "Angebote, Aufträge und Rechnungen an einem Ort auf Ihrem Handy. Aus einem erledigten Auftrag wird mit einem Tippen eine Rechnung — ohne Abtippen.",
        },
        {
          no: "02",
          label: "EU-Regeln",
          title: "Umsatzsteuer. E-Rechnung.\nDie Regeln vor Ort.",
          body:
            "XRechnung, ZUGFeRD, Factur-X, Facturae, FatturaPA und Peppol. Sonderregeln wie die Kleinunternehmerregelung nach § 19 UStG. Vasco erstellt Ihre Rechnungen nach den Regeln des Landes, in dem Sie arbeiten.",
        },
        {
          no: "03",
          label: "Säumige Zahler",
          title: "Bezahlt werden.\nOhne unangenehmen Anruf.",
          body:
            "Ein Zahlungslink auf der Rechnung über Ihr eigenes Mollie- oder Stripe-Konto. Ist eine Rechnung überfällig, bereitet Vasco eine Zahlungserinnerung vor, die Sie prüfen und versenden.",
        },
      ],
    },
    how: {
      eyebrow: "So funktioniert's",
      titleLead: "Drei Schritte.",
      titleAccent: "Vom Angebot zum Geld.",
      steps: [
        {
          n: "1",
          title: "Angebot erstellen.",
          body:
            "Positionen aus Ihrer eigenen Preisliste, auf Wunsch mit den Optionen Gut / Besser / Optimal.",
        },
        {
          n: "2",
          title: "Angebot versenden.",
          body:
            "Ihr Kunde öffnet es auf dem Handy und nimmt es online an. Er braucht dafür kein Konto.",
        },
        {
          n: "3",
          title: "Bezahlt werden.",
          body:
            "Auftrag erledigt? Mit einem Tippen wird daraus eine Rechnung. Fügen Sie einen Zahlungslink über Ihr eigenes Mollie- oder Stripe-Konto hinzu.",
        },
      ],
    },
    pricing: {
      eyebrow: "Preise",
      titleLead: "Einfache Tarife.",
      titleAccent: "Keine Provision.",
      noCommission:
        "Vasco nimmt keine Provision auf Zahlungen. Ihr Kunde zahlt direkt auf Ihr eigenes Mollie- oder Stripe-Konto.",
      badge: "AM BELIEBTESTEN",
      closer: "Jederzeit kündbar. Keine Einrichtungsgebühr.",
      closerAccent: "Keine Provision auf Ihre Zahlungen.",
      plans: [
        {
          name: "Gratis",
          price: "0 €",
          period: "/Monat",
          tagline: "Sofort loslegen. Ohne Verpflichtung.",
          features: [
            "5 aktive Aufträge",
            "10 Angebote und 10 Rechnungen pro Monat",
            "25 Kunden",
            "1 Land",
          ],
          cta: "Zur Beta anmelden",
          highlight: false,
        },
        {
          name: "Pro",
          price: "39 €",
          period: "/Monat",
          annual: "oder 29 €/Monat bei jährlicher Zahlung",
          tagline: "Unbegrenzt Angebote und Rechnungen, plus E-Rechnung.",
          features: [
            "Unbegrenzt Aufträge, Angebote, Rechnungen und Kunden",
            "E-Rechnung in allen 6 Ländern",
            "Zahlungslinks über Ihr eigenes Mollie oder Stripe",
            "Online-Annahme von Angeboten für Ihre Kunden",
            "Bis zu 3 Teammitglieder",
          ],
          cta: "Zur Beta anmelden",
          highlight: true,
          badge: "AM BELIEBTESTEN",
        },
        {
          name: "Handwerker",
          price: "69 €",
          period: "/Monat",
          annual: "oder 49 €/Monat bei jährlicher Zahlung",
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
          a: "Gratis kostet 0 €, mit Grenzen (5 aktive Aufträge, 10 Angebote und 10 Rechnungen pro Monat). Pro kostet 39 € pro Monat oder 29 € pro Monat bei jährlicher Zahlung. Handwerker kostet 69 € pro Monat oder 49 € pro Monat bei jährlicher Zahlung und bringt Teamplätze mit. Vasco nimmt keine Provision auf Zahlungen — Ihre Kunden zahlen auf Ihr eigenes Mollie- oder Stripe-Konto.",
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
        "Estimates, jobs and invoices for HVAC, electrical, plumbing, roofing and remodeling pros, from your phone. Free plan; Pro from €29/month billed annually. No commission on payments.",
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
      title: "Less paperwork",
      titleAccent: "after every job.",
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
    appStorePreview: {
      eyebrow: "Inside the app",
      titleLead: "Four screens.",
      titleAccent: "One app for the paperwork.",
      footnote:
        "Screens from the app, with example data. Vasco is not in the App Store or Google Play yet.",
      screens: [
        { src: "/screenshots/app-us-1.png", label: "Today" },
        { src: "/screenshots/app-us-2.png", label: "Estimate" },
        { src: "/screenshots/app-us-3.png", label: "Money" },
        { src: "/screenshots/app-us-4.png", label: "Invoice" },
      ],
    },
    guideThrough: {
      eyebrow: "What Vasco does",
      titleLead: "The stuff trade school",
      titleAccent: "didn't teach you.",
      items: [
        {
          no: "01",
          label: "The admin pile",
          title: "Off the laptop.\nBack on the tools.",
          body:
            "Estimates, jobs and invoices in one place on your phone. A finished job becomes an invoice in one tap — no retyping.",
        },
        {
          no: "02",
          label: "Estimates",
          title: "Good. Better. Best.\nAccepted online.",
          body:
            "Offer options side by side. Your customer opens the estimate on their phone and accepts it — no account needed.",
        },
        {
          no: "03",
          label: "Slow payers",
          title: "Get paid.\nWithout the awkward call.",
          body:
            "A payment link on the invoice through your own Stripe account. When an invoice is overdue, Vasco drafts a reminder for you to check and send.",
        },
      ],
    },
    how: {
      eyebrow: "How it works",
      titleLead: "Three steps.",
      titleAccent: "Estimate to paid.",
      steps: [
        {
          n: "1",
          title: "Build the estimate.",
          body:
            "Line items from your own price list, with Good / Better / Best options if you want them.",
        },
        {
          n: "2",
          title: "Send the estimate.",
          body:
            "Your customer opens it on their phone and accepts it online. No account needed on their side.",
        },
        {
          n: "3",
          title: "Get paid.",
          body:
            "Finish the job and turn it into an invoice in one tap. Add a payment link through your own Stripe account.",
        },
      ],
    },
    pricing: {
      eyebrow: "Pricing",
      titleLead: "Simple plans.",
      titleAccent: "No commission.",
      noCommission:
        "Vasco takes no commission on payments. Your customer pays into your own payment account. Prices in EUR.",
      badge: "MOST POPULAR",
      closer: "Cancel anytime. No setup fees.",
      closerAccent: "No commission on your payments.",
      plans: [
        {
          name: "Free",
          price: "€0",
          period: "/mo",
          tagline: "Start free.",
          features: [
            "5 active jobs",
            "10 estimates and 10 invoices a month",
            "25 customers",
          ],
          cta: "Join the beta",
          highlight: false,
        },
        {
          name: "Pro",
          price: "€39",
          period: "/mo",
          annual: "or €29/mo billed annually",
          tagline: "Unlimited estimates and invoices.",
          features: [
            "Unlimited jobs, estimates, invoices and customers",
            "Payment links via your own Stripe account",
            "Online estimate acceptance for your customers",
            "Up to 3 team members",
          ],
          cta: "Join the beta",
          highlight: true,
          badge: "MOST POPULAR",
        },
        {
          name: "Contractor",
          price: "€69",
          period: "/mo",
          annual: "or €49/mo billed annually",
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
          a: "Free is €0 with limits (5 active jobs, 10 estimates and 10 invoices a month). Pro is €39 a month, or €29 a month billed annually. Contractor is €69 a month, or €49 a month billed annually, and adds team seats. Prices are in EUR. Vasco charges no commission on payments.",
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
