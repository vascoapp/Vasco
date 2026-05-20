// Marketing-page content per locale.
// Used by app/page.tsx (en) and app/nl/page.tsx (nl).
// Dutch is native-Dutch, not literal-translated. NL is the lead market;
// the in-app product is Dutch UI by default for NL contractors.

export type Locale = "en" | "nl" | "en-US";

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
    perInvoice: string;
    badge: string;
    closer: string;
    closerAccent: string;
    plans: Array<{
      name: string;
      price: string;
      period: string;
      commission: string;
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

export const content: Record<Locale, MarketingContent> = {
  en: {
    meta: {
      title: "Vasco — Your guide to running a trade business",
      description:
        "Vasco knows the way. The AI back-office for plumbers, electricians, painters, carpenters, and aannemers. Free forever — 3.5% per paid invoice. Pro from €39/mo.",
      ogDescription:
        "Free forever — 3.5% per paid invoice. Pro from €39/mo. Built for the trades across NL, DE, FR, ES, IT, UK.",
    },
    nav: {
      how: "How it works",
      pricing: "Pricing",
      faq: "FAQ",
      support: "Support",
      cta: "Get early access",
    },
    hero: {
      badge: "Coming 2026 — Join the waitlist",
      title: "Vasco knows",
      titleAccent: "the way.",
      sub:
        "Your guide to running a trade business. From quote to cash, EU compliance to chasing late payers — Vasco walks you through the parts of the job nobody trained you for.",
      ctaPrimary: "Get early access",
      ctaSecondary: "See how it works",
      marketsPrefix: "Working in",
    },
    stats: [
      { value: "8h", label: "Saved per week" },
      { value: "5", label: "Taps quote → invoice" },
      { value: "6", label: "Countries" },
      { value: "15", label: "Trades" },
    ],
    appStorePreview: {
      eyebrow: "App Store preview",
      titleLead: "Five screens.",
      titleAccent: "One app that runs your business.",
      footnote:
        "Rendered at 1320×2868 (6.9\" iPhone). These are the assets queued for App Store Connect upload.",
      screens: [
        { src: "/screenshots/1-vandaag-en.png", label: "Today's plan" },
        { src: "/screenshots/2-quote-en.png", label: "Good / Better / Best" },
        { src: "/screenshots/3-geld-en.png", label: "Get paid" },
        { src: "/screenshots/4-photo-en.png", label: "Photo → quote" },
        { src: "/screenshots/5-vat-en.png", label: "VAT prep" },
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
            "Quotes, jobs, invoices, chasers — Vasco runs the paperwork while you run the job. No more weeknights at the kitchen table catching up on admin.",
        },
        {
          no: "02",
          label: "EU compliance",
          title: "Belastingdienst.\nKvK. BTW. Done.",
          body:
            "XRechnung. Peppol. FatturaPA. KOR. Kleinunternehmer. Vasco knows the rules of every market you work in — and follows them for you.",
        },
        {
          no: "03",
          label: "Slow payers",
          title: "Get paid.\nOn time.",
          body:
            "Payment link on every invoice. Auto-chase at 14 and 30 days. Late-payment fees calculated to EU 2011/7/EU. Vasco doesn't forget.",
        },
      ],
    },
    how: {
      eyebrow: "How it works",
      titleLead: "Three steps.",
      titleAccent: "One day's work.",
      steps: [
        {
          n: "1",
          title: "Photo the job.",
          body:
            "Snap the wall, the boiler, the leak. Vasco reads the photo, drafts the quote with materials and hours.",
        },
        {
          n: "2",
          title: "Send the quote.",
          body:
            "Customer signs on their phone. Job created. Calendar blocked. No back-and-forth.",
        },
        {
          n: "3",
          title: "Get paid.",
          body:
            "Work the job, tap done. Invoice goes out with a payment link. iDEAL, card, Bancontact — your customer's choice.",
        },
      ],
    },
    pricing: {
      eyebrow: "Pricing",
      titleLead: "You only pay",
      titleAccent: "when you get paid.",
      perInvoice: "per paid invoice",
      badge: "MOST POPULAR",
      closer: "Cancel anytime. No setup fees. No termination fees.",
      closerAccent: "You only pay when you get paid.",
      plans: [
        {
          name: "Free",
          price: "€0",
          period: "/mo",
          commission: "3.5%",
          tagline: "Get started. No commitment.",
          features: [
            "5 active jobs",
            "10 quotes/month",
            "Basic compliance",
            "1 country",
          ],
          cta: "Start free",
          highlight: false,
        },
        {
          name: "Pro",
          price: "€39",
          period: "/mo",
          commission: "2%",
          tagline: "Full AI. Pays for itself.",
          features: [
            "Unlimited jobs, quotes, invoices",
            "Full EVE AI (Agent + Auditor + Analyst)",
            "ML predictions + benchmarking",
            "Purchasing agent",
            "All 6 EU countries",
          ],
          cta: "Go Pro",
          highlight: true,
          badge: "MOST POPULAR",
        },
        {
          name: "Contractor",
          price: "€69",
          period: "/mo",
          commission: "1%",
          tagline: "Team. API. White-label.",
          features: [
            "Everything in Pro",
            "15 team seats",
            "API + white-label",
            "Subcontractor portal",
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
        "From solo plumbers to multi-trade aannemers — Vasco speaks your trade, knows your suppliers, and writes your customer messages in your customer's language.",
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
      eyebrow: "Built by tradesmen, for tradesmen",
      line1: "You didn't become a plumber to learn",
      line1Accent: "VAT codes.",
      line2: "You became a plumber to",
      line2Accent: "fix things.",
      closer: "Vasco handles the rest.",
    },
    faq: {
      eyebrow: "FAQ",
      titleLead: "Questions.",
      titleAccent: "Straight answers.",
      items: [
        {
          q: "When does Vasco launch?",
          a: "iOS rolls out market-by-market starting in the Netherlands in 2026. Join the waitlist to get early access in your country.",
        },
        {
          q: "Do I need a subscription?",
          a: "Free tier is forever free — 3.5% commission on every paid invoice, no monthly fee. Pro (€39/mo) drops it to 2% and unlocks unlimited jobs, full AI, ML predictions, and the purchasing agent. Contractor (€69/mo) drops it to 1% and adds team seats, API access, and white-label. Most active contractors break even on Pro within their first invoice.",
        },
        {
          q: "What about my existing accounting software?",
          a: "Vasco connects to Moneybird, DATEV, Lexoffice, SevDesk, Pennylane, Holded, Fatture in Cloud, Xero, QuickBooks, and 10 more. Your invoices sync automatically — no double entry.",
        },
        {
          q: "Is it compliant with EU e-invoicing rules?",
          a: "Yes. XRechnung (DE), Peppol (NL/EU), Factur-X (FR), Facturae (ES), FatturaPA (IT) — Vasco generates structured e-invoices in the format each market requires.",
        },
        {
          q: "Who is Vasco for?",
          a: "Solo contractors (plumbers, electricians, painters, carpenters), multi-trade aannemers running renovation projects, and site leads managing field crews. If you work with your hands and send invoices, Vasco is for you.",
        },
      ],
    },
    finalCta: {
      titleLead: "Ship one quote today.",
      titleAccent: "Get paid tomorrow.",
      body:
        "Get early access. We'll email you when Vasco launches in your market.",
      cta: "Get early access",
    },
    footer: {
      tagline: "Your guide to running a trade business.",
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
      legal: {
        title: "Legal",
        links: [
          { href: "/legal/privacy-policy", label: "Privacy" },
          { href: "/legal/terms-of-service", label: "Terms" },
          { href: "/legal/eula", label: "EULA" },
          { href: "/legal/cookie-policy", label: "Cookies" },
          { href: "/legal/data-processing-agreement", label: "DPA" },
          { href: "/legal/acceptable-use-policy", label: "Acceptable use" },
        ],
      },
      contact: {
        title: "Contact",
        links: [
          { href: "mailto:hello@vascobuild.com", label: "hello@vascobuild.com" },
          { href: "mailto:support@vascobuild.com", label: "support@vascobuild.com" },
          { href: "mailto:privacy@vascobuild.com", label: "privacy@vascobuild.com" },
        ],
      },
      bottomCompliance: "EU datacenters · GDPR compliant · KvK 12345678",
    },
  },

  nl: {
    meta: {
      title: "Vasco — Minder admin. Meer vakwerk.",
      description:
        "Vasco kent de weg. De AI-administratie voor loodgieters, elektriciens, schilders, timmerlieden en aannemers. Voor altijd gratis — 3,5% per betaalde factuur. Pro vanaf €39/mnd.",
      ogDescription:
        "Voor altijd gratis — 3,5% per betaalde factuur. Pro vanaf €39/mnd. Voor vakmensen in NL, DE, FR, ES, IT, UK.",
    },
    nav: {
      how: "Hoe het werkt",
      pricing: "Prijzen",
      faq: "Veelgestelde vragen",
      support: "Support",
      cta: "Op de wachtlijst",
    },
    hero: {
      badge: "Live in 2026 · Schrijf je in",
      title: "Vasco kent",
      titleAccent: "de weg.",
      sub:
        "Van offerte tot factuur. Van BTW tot late betalers. Vasco doet het administratiewerk waar geen opleiding voor bestaat — zodat jij meer tijd hebt voor je vak.",
      ctaPrimary: "Op de wachtlijst",
      ctaSecondary: "Zo werkt het",
      marketsPrefix: "Actief in",
    },
    stats: [
      { value: "8u", label: "Bespaard per week" },
      { value: "5", label: "Tikken offerte → factuur" },
      { value: "6", label: "Landen" },
      { value: "15", label: "Vakgebieden" },
    ],
    appStorePreview: {
      eyebrow: "App Store-preview",
      titleLead: "Vijf schermen.",
      titleAccent: "Eén app die je bedrijf runt.",
      footnote:
        "Gerenderd op 1320×2868 (6,9\" iPhone). Dit zijn de bestanden die klaarstaan voor App Store Connect.",
      screens: [
        { src: "/screenshots/1-vandaag-nl.png", label: "Vandaag" },
        { src: "/screenshots/2-quote-nl.png", label: "Goed / Beter / Best" },
        { src: "/screenshots/3-geld-nl.png", label: "Word betaald" },
        { src: "/screenshots/4-photo-nl.png", label: "Foto → offerte" },
        { src: "/screenshots/5-vat-nl.png", label: "BTW-aangifte" },
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
            "Offertes, klussen, facturen, herinneringen — Vasco regelt het papierwerk, jij doet het werk. Geen avonden meer aan de keukentafel om de boel bij te werken.",
        },
        {
          no: "02",
          label: "EU-regels",
          title: "Belastingdienst.\nKvK. BTW. Klaar.",
          body:
            "XRechnung. Peppol. FatturaPA. KOR. Kleinunternehmer. Vasco kent de regels van elk land waar je werkt — en past ze automatisch toe.",
        },
        {
          no: "03",
          label: "Late betalers",
          title: "Krijg betaald.\nOp tijd.",
          body:
            "Betaallink op elke factuur. Automatische herinneringen na 14 en 30 dagen. Wettelijke handelsrente volgens EU 2011/7/EU. Vasco vergeet het niet.",
        },
      ],
    },
    how: {
      eyebrow: "Hoe het werkt",
      titleLead: "Drie stappen.",
      titleAccent: "Een halve dag werk.",
      steps: [
        {
          n: "1",
          title: "Foto van de klus.",
          body:
            "Maak een foto van de muur, de ketel, de lekkage. Vasco leest de foto en maakt een offerte mét materiaal en uren.",
        },
        {
          n: "2",
          title: "Verstuur de offerte.",
          body:
            "Klant tekent op zijn telefoon. Klus aangemaakt. Agenda geblokt. Geen heen-en-weer.",
        },
        {
          n: "3",
          title: "Krijg betaald.",
          body:
            "Klus af, tik op afronden. Factuur gaat de deur uit met een betaallink. iDEAL, creditcard, Bancontact — de klant kiest.",
        },
      ],
    },
    pricing: {
      eyebrow: "Prijzen",
      titleLead: "Je betaalt alleen",
      titleAccent: "als jij betaald wordt.",
      perInvoice: "per betaalde factuur",
      badge: "MEEST GEKOZEN",
      closer: "Maandelijks opzegbaar. Geen instapkosten. Geen opzegkosten.",
      closerAccent: "Je betaalt alleen als jij betaald wordt.",
      plans: [
        {
          name: "Gratis",
          price: "€0",
          period: "/mnd",
          commission: "3,5%",
          tagline: "Begin meteen. Zonder verplichting.",
          features: [
            "5 actieve klussen",
            "10 offertes per maand",
            "Basis BTW + factuurregels",
            "1 land",
          ],
          cta: "Start gratis",
          highlight: false,
        },
        {
          name: "Pro",
          price: "€39",
          period: "/mnd",
          commission: "2%",
          tagline: "Volledige AI. Verdient zich terug.",
          features: [
            "Onbeperkt klussen, offertes, facturen",
            "Volledige EVE AI (Agent + Auditor + Analist)",
            "ML-voorspellingen + benchmarks",
            "Inkoop-assistent",
            "Alle 6 EU-landen",
          ],
          cta: "Kies Pro",
          highlight: true,
          badge: "MEEST GEKOZEN",
        },
        {
          name: "Aannemer",
          price: "€69",
          period: "/mnd",
          commission: "1%",
          tagline: "Team. API. White-label.",
          features: [
            "Alles uit Pro",
            "15 teamleden",
            "API + white-label",
            "Onderaannemer-portaal",
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
        "Van zzp-loodgieter tot aannemer met meerdere ploegen — Vasco kent je vak, je leveranciers, en schrijft klantberichten in de taal van je klant.",
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
      eyebrow: "Door vakmensen, voor vakmensen",
      line1: "Je bent geen loodgieter geworden om",
      line1Accent: "btw-codes te leren.",
      line2: "Je bent loodgieter geworden om",
      line2Accent: "dingen te maken.",
      closer: "Vasco regelt de rest.",
    },
    faq: {
      eyebrow: "Veelgestelde vragen",
      titleLead: "Vragen.",
      titleAccent: "Eerlijke antwoorden.",
      items: [
        {
          q: "Wanneer is Vasco beschikbaar?",
          a: "iOS rolt land voor land uit, eerst in Nederland in 2026. Schrijf je in op de wachtlijst zodat je in jouw land als eerste aan de beurt bent.",
        },
        {
          q: "Heb ik een abonnement nodig?",
          a: "Het Gratis-pakket is voor altijd gratis — 3,5% commissie op elke betaalde factuur, verder geen vaste lasten. Pro (€39/mnd) verlaagt dat naar 2% en geeft je onbeperkt klussen, volledige AI, ML-voorspellingen en de inkoop-assistent. Aannemer (€69/mnd) verlaagt het naar 1% en voegt teamleden, API en white-label toe. De meeste vakmensen verdienen Pro al terug op hun eerste factuur.",
        },
        {
          q: "En mijn huidige boekhoudsoftware?",
          a: "Vasco koppelt met Moneybird, DATEV, Lexoffice, SevDesk, Pennylane, Holded, Fatture in Cloud, Xero, QuickBooks en nog 10 andere. Je facturen lopen automatisch door — niks dubbel invoeren.",
        },
        {
          q: "Voldoet het aan de EU e-factuur-regels?",
          a: "Ja. XRechnung (DE), Peppol (NL/EU), Factur-X (FR), Facturae (ES), FatturaPA (IT) — Vasco genereert gestructureerde e-facturen in het formaat dat elk land voorschrijft.",
        },
        {
          q: "Voor wie is Vasco?",
          a: "Zzp-vakmensen (loodgieters, elektriciens, schilders, timmerlieden), aannemers die verbouwingen draaien, en uitvoerders die ploegen aansturen. Werk je met je handen en stuur je facturen, dan is Vasco voor jou.",
        },
      ],
    },
    finalCta: {
      titleLead: "Stuur vandaag één offerte.",
      titleAccent: "Krijg morgen betaald.",
      body:
        "Schrijf je in op de wachtlijst. We mailen je zodra Vasco in jouw land live gaat.",
      cta: "Op de wachtlijst",
    },
    footer: {
      tagline: "Je gids voor het runnen van een vakmansbedrijf.",
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
      contact: {
        title: "Contact",
        links: [
          { href: "mailto:hello@vascobuild.com", label: "hello@vascobuild.com" },
          { href: "mailto:support@vascobuild.com", label: "support@vascobuild.com" },
          { href: "mailto:privacy@vascobuild.com", label: "privacy@vascobuild.com" },
        ],
      },
      bottomCompliance: "EU-datacenters · AVG-compliant · KvK 12345678",
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // en-US (R77 US Phase 3)
  // Voice: growth + revenue ("close more jobs"), not admin/compliance.
  // Per us-market-research.md Section A: US contractors think like small
  // business owners chasing leads; lead with money, not paperwork.
  // ─────────────────────────────────────────────────────────────────────
  "en-US": {
    meta: {
      title: "Vasco — Close more jobs. Get paid faster.",
      description:
        "The AI back-office for HVAC, electrical, plumbing, roofing, and remodeling pros. Estimates, invoices, scheduling, payments — done. Free forever, 3.5% per paid invoice. Pro from $79/mo.",
      ogDescription:
        "Free forever — 3.5% per paid invoice. Pro from $79/mo. Built for US contractors across all 50 states.",
    },
    nav: {
      how: "How it works",
      pricing: "Pricing",
      faq: "FAQ",
      support: "Support",
      cta: "Join waitlist",
    },
    hero: {
      badge: "Coming 2026 — Join the waitlist",
      title: "Stop losing profit",
      titleAccent: "on every job.",
      sub:
        "Vasco runs your back-office so you can run the job. Estimates, scheduling, invoices, payments — automated. No more late-night paperwork. No more chasing checks.",
      ctaPrimary: "Join waitlist",
      ctaSecondary: "See how it works",
      marketsPrefix: "Launching in",
    },
    stats: [
      { value: "8h", label: "Saved per week" },
      { value: "5", label: "Taps estimate → paid" },
      { value: "50", label: "States" },
      { value: "15", label: "Trades" },
    ],
    appStorePreview: {
      eyebrow: "App Store preview",
      titleLead: "Five screens.",
      titleAccent: "One app that runs your business.",
      footnote:
        "Rendered at 1320×2868 (6.9\" iPhone). The screenshots queued for App Store Connect submission.",
      screens: [
        { src: "/screenshots/1-vandaag-en.png", label: "Today's plan" },
        { src: "/screenshots/2-quote-en.png", label: "Good / Better / Best" },
        { src: "/screenshots/3-geld-en.png", label: "Get paid" },
        { src: "/screenshots/4-photo-en.png", label: "Photo → estimate" },
        { src: "/screenshots/5-vat-en.png", label: "Sales tax prep" },
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
            "Estimates, jobs, invoices, payment chasers — Vasco runs the paperwork while you run the job. No more weeknights at the kitchen table catching up on books.",
        },
        {
          no: "02",
          label: "State licensing + tax",
          title: "Sales tax.\nState license.\n1099s. Handled.",
          body:
            "Sales tax computed per state and city. State contractor license expiry tracked and warned 30 days out. Year-end 1099-NEC generation when you pay subs over $600.",
        },
        {
          no: "03",
          label: "Slow payers",
          title: "Get paid.\nSame day.",
          body:
            "Tap-to-pay credit card at the job, ACH on the invoice, Buy-Now-Pay-Later for big tickets. Auto-reminders at 7 and 14 days. Vasco doesn't forget — your customers shouldn't either.",
        },
      ],
    },
    how: {
      eyebrow: "How it works",
      titleLead: "Three steps.",
      titleAccent: "One day's work.",
      steps: [
        {
          n: "1",
          title: "Photo the job.",
          body:
            "Snap the AC unit, the leak, the wall. Vasco reads the photo, drafts the estimate with materials and labor hours priced for your market.",
        },
        {
          n: "2",
          title: "Send the estimate.",
          body:
            "Customer signs on their phone. Job auto-scheduled. Crew assigned. Materials ordered. Calendar blocked. No back-and-forth.",
        },
        {
          n: "3",
          title: "Get paid.",
          body:
            "Finish the job, tap done. Invoice goes out with a card/ACH/Apple Pay link. Money hits your bank — most contractors get paid before they pack up.",
        },
      ],
    },
    pricing: {
      eyebrow: "Pricing",
      titleLead: "You only pay",
      titleAccent: "when you get paid.",
      perInvoice: "per paid invoice",
      badge: "MOST POPULAR",
      closer: "Cancel anytime. No setup fees. No contracts.",
      closerAccent: "You only pay when you get paid.",
      plans: [
        {
          name: "Free",
          price: "$0",
          period: "/mo",
          commission: "3.5%",
          tagline: "Start free. Stay free.",
          features: [
            "5 active jobs",
            "10 estimates/month",
            "Card + ACH payments",
            "1 state",
          ],
          cta: "Start free",
          highlight: false,
        },
        {
          name: "Pro",
          price: "$79",
          period: "/mo",
          commission: "2%",
          tagline: "Full AI. Pays for itself in one job.",
          features: [
            "Unlimited jobs, estimates, invoices",
            "Full EVE AI (Photo-to-Estimate, auto-bids)",
            "Cohort pricing intelligence",
            "Buying agent (best supplier price)",
            "All 50 states",
          ],
          cta: "Go Pro",
          highlight: true,
          badge: "MOST POPULAR",
        },
        {
          name: "Contractor",
          price: "$149",
          period: "/mo",
          commission: "1%",
          tagline: "Crew. API. White-label.",
          features: [
            "Everything in Pro",
            "15 crew seats",
            "Dispatch + GPS tracking",
            "API + white-label",
            "Dedicated success manager",
          ],
          cta: "Talk to sales",
          highlight: false,
        },
      ],
    },
    trades: {
      eyebrow: "Built for the trades",
      titleLead: "15 trades.",
      titleAccent: "One toolbox.",
      body:
        "From solo electricians to multi-crew remodeling contractors — Vasco speaks your trade, knows your suppliers, and writes customer messages in plain English (or Spanish, if your customer prefers).",
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
      eyebrow: "Built by pros, for pros",
      line1: "You didn't go into the trades to learn",
      line1Accent: "QuickBooks.",
      line2: "You went into the trades to",
      line2Accent: "build things.",
      closer: "Vasco handles the rest.",
    },
    faq: {
      eyebrow: "FAQ",
      titleLead: "Questions.",
      titleAccent: "Straight answers.",
      items: [
        {
          q: "When does Vasco launch in the US?",
          a: "iOS rolls out state-by-state starting with Texas in 2026, then California, Florida, New York, and Illinois. Join the waitlist to lock in early access in your state.",
        },
        {
          q: "Do I need to pay a subscription?",
          a: "Free is forever free — 3.5% commission on every paid invoice, no monthly fee. Pro ($79/mo) drops it to 2% and unlocks unlimited jobs, full AI, cohort pricing intelligence, and the buying agent. Contractor ($149/mo) drops it to 1% and adds crew seats, dispatch, API, and white-label. Most active pros break even on Pro within their first invoice.",
        },
        {
          q: "Does it work with QuickBooks?",
          a: "Yes. Vasco syncs estimates, invoices, customers, and payments to QuickBooks Online. Xero, FreshBooks, and Wave coming Q3. Your accountant gets the books they expect — you stop double-entering everything.",
        },
        {
          q: "How does the sales tax work?",
          a: "Vasco computes sales tax per state and city based on the customer's address. State contractor license expiry is tracked and you get a warning 30 days out. We don't file your taxes — that's still you (or your CPA) — but we hand them a clean, audit-ready export.",
        },
        {
          q: "Can I offer financing?",
          a: "Yes — Affirm and Sunbit Buy-Now-Pay-Later integrations let your customers split big jobs (kitchen remodels, full HVAC swaps) into monthly payments. You get paid up-front; the lender carries the risk.",
        },
        {
          q: "Who is Vasco for?",
          a: "Solo pros (electricians, plumbers, HVAC techs, painters), small crews (2–5 person remodeling outfits, roofing teams), and growing service businesses ready to step off the legal pad. If you work with your hands and send invoices, Vasco is for you.",
        },
      ],
    },
    finalCta: {
      titleLead: "Send one estimate today.",
      titleAccent: "Get paid tomorrow.",
      body:
        "Join the waitlist. We'll email when Vasco goes live in your state.",
      cta: "Join waitlist",
    },
    footer: {
      tagline: "Your back-office on autopilot.",
      address: "Amsterdam, NL · Texas HQ coming 2026",
      product: {
        title: "Product",
        links: [
          { href: "#how", label: "How it works" },
          { href: "#pricing", label: "Pricing" },
          { href: "#faq", label: "FAQ" },
          { href: "/support", label: "Support" },
        ],
      },
      legal: {
        title: "Legal",
        links: [
          { href: "/legal/privacy-policy", label: "Privacy" },
          { href: "/legal/terms-of-service", label: "Terms" },
          { href: "/legal/eula", label: "EULA" },
          { href: "/legal/cookie-policy", label: "Cookies" },
          { href: "/legal/data-processing-agreement", label: "DPA" },
          { href: "/legal/acceptable-use-policy", label: "Acceptable use" },
        ],
      },
      contact: {
        title: "Contact",
        links: [
          { href: "mailto:hello@vascobuild.com", label: "hello@vascobuild.com" },
          { href: "mailto:support@vascobuild.com", label: "support@vascobuild.com" },
          { href: "mailto:privacy@vascobuild.com", label: "privacy@vascobuild.com" },
        ],
      },
      bottomCompliance: "US-East datacenter · CCPA-compliant · SOC 2 Type II coming 2026",
    },
  },
};
