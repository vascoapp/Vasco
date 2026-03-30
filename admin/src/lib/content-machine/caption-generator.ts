// ═══════════════════════════════════════════════════════════════════════════
// CONTENT MACHINE — CAPTION GENERATOR
// 6-language caption packs (organic + commerce modes) for EU6 markets
// ═══════════════════════════════════════════════════════════════════════════

import type { ContentIdea, GeneratedCaption, CaptionPack, LanguageCode } from "./types";
import { LANGUAGES } from "./types";
import { LOCALIZED_HASHTAGS } from "./seed-data";

// ─── Caption Templates by Pillar × Language × Mode ─────────────────────────

interface CaptionTemplate {
  organic: Record<LanguageCode, string[]>;
  commerce: Record<LanguageCode, string[]>;
}

const TEMPLATES: Record<string, CaptionTemplate> = {
  "money-reveal": {
    organic: {
      en: [
        "{HOOK} 💰 Real numbers, no fluff. This is what a {TRADE} actually earns. #transparency #{KEYWORD}",
        "Let's talk money. {HOOK} Every contractor deserves to know their worth. #{KEYWORD}",
      ],
      nl: [
        "{HOOK} 💰 Echte cijfers, geen onzin. Dit verdient een {TRADE} echt. #vakman #{KEYWORD}",
        "Laten we het over geld hebben. {HOOK} Elke aannemer verdient het om dit te weten. #{KEYWORD}",
      ],
      de: [
        "{HOOK} 💰 Echte Zahlen, kein Bluff. So viel verdient ein {TRADE} wirklich. #Handwerker #{KEYWORD}",
        "Reden wir über Geld. {HOOK} Jeder Handwerker sollte seinen Wert kennen. #{KEYWORD}",
      ],
      fr: [
        "{HOOK} 💰 Vrais chiffres. Voici ce que gagne vraiment un {TRADE}. #artisan #{KEYWORD}",
        "Parlons argent. {HOOK} Chaque artisan merite de connaitre sa valeur. #{KEYWORD}",
      ],
      es: [
        "{HOOK} 💰 Numeros reales. Esto es lo que gana un {TRADE} de verdad. #reformas #{KEYWORD}",
        "Hablemos de dinero. {HOOK} Todo profesional merece saber cuanto vale. #{KEYWORD}",
      ],
      it: [
        "{HOOK} 💰 Numeri reali. Ecco quanto guadagna davvero un {TRADE}. #artigiano #{KEYWORD}",
        "Parliamo di soldi. {HOOK} Ogni professionista merita sapere il suo valore. #{KEYWORD}",
      ],
    },
    commerce: {
      en: ["{HOOK} Track every euro with Vasco — free for contractors. Link in bio 📲 #{KEYWORD}"],
      nl: ["{HOOK} Volg elke euro met Vasco — gratis voor vaklui. Link in bio 📲 #{KEYWORD}"],
      de: ["{HOOK} Jeden Euro tracken mit Vasco — kostenlos fur Handwerker. Link in Bio 📲 #{KEYWORD}"],
      fr: ["{HOOK} Suivez chaque euro avec Vasco — gratuit pour artisans. Lien en bio 📲 #{KEYWORD}"],
      es: ["{HOOK} Controla cada euro con Vasco — gratis para profesionales. Link en bio 📲 #{KEYWORD}"],
      it: ["{HOOK} Traccia ogni euro con Vasco — gratis per artigiani. Link in bio 📲 #{KEYWORD}"],
    },
  },
  "speed-challenge": {
    organic: {
      en: ["{HOOK} ⚡ Time is money — especially for {TRADE}s. Watch how fast this gets done. #{KEYWORD}"],
      nl: ["{HOOK} ⚡ Tijd is geld — zeker voor {TRADE}s. Kijk hoe snel dit gaat. #{KEYWORD}"],
      de: ["{HOOK} ⚡ Zeit ist Geld — besonders fur {TRADE}. Schau wie schnell das geht. #{KEYWORD}"],
      fr: ["{HOOK} ⚡ Le temps c'est de l'argent. Regardez la vitesse. #{KEYWORD}"],
      es: ["{HOOK} ⚡ El tiempo es oro — mira que rapido. #{KEYWORD}"],
      it: ["{HOOK} ⚡ Il tempo e denaro — guarda quanto e veloce. #{KEYWORD}"],
    },
    commerce: {
      en: ["{HOOK} Stop wasting hours on admin. Vasco does it in seconds. Free download 📲 #{KEYWORD}"],
      nl: ["{HOOK} Stop met uren verspillen aan admin. Vasco doet het in seconden. Gratis 📲 #{KEYWORD}"],
      de: ["{HOOK} Schluss mit stundenlanger Verwaltung. Vasco macht es in Sekunden. Kostenlos 📲 #{KEYWORD}"],
      fr: ["{HOOK} Arretez de perdre du temps en admin. Vasco le fait en secondes. Gratuit 📲 #{KEYWORD}"],
      es: ["{HOOK} Deja de perder horas en admin. Vasco lo hace en segundos. Gratis 📲 #{KEYWORD}"],
      it: ["{HOOK} Basta perdere ore in admin. Vasco lo fa in secondi. Gratis 📲 #{KEYWORD}"],
    },
  },
  "_default": {
    organic: {
      en: ["{HOOK} 🏗️ Real {TRADE} content. No filters, no scripts — just the work. #{KEYWORD}"],
      nl: ["{HOOK} 🏗️ Echt {TRADE} content. Geen filters — gewoon het werk. #{KEYWORD}"],
      de: ["{HOOK} 🏗️ Echtes {TRADE}-Content. Keine Filter — einfach die Arbeit. #{KEYWORD}"],
      fr: ["{HOOK} 🏗️ Vrai contenu {TRADE}. Pas de filtre — juste le travail. #{KEYWORD}"],
      es: ["{HOOK} 🏗️ Contenido real de {TRADE}. Sin filtros — solo el trabajo. #{KEYWORD}"],
      it: ["{HOOK} 🏗️ Contenuto vero da {TRADE}. Niente filtri — solo il lavoro. #{KEYWORD}"],
    },
    commerce: {
      en: ["{HOOK} Try Vasco free — built for {TRADE}s who want to grow. Link in bio 📲 #{KEYWORD}"],
      nl: ["{HOOK} Probeer Vasco gratis — gemaakt voor {TRADE}s die willen groeien. Link in bio 📲 #{KEYWORD}"],
      de: ["{HOOK} Teste Vasco kostenlos — fur {TRADE}, die wachsen wollen. Link in Bio 📲 #{KEYWORD}"],
      fr: ["{HOOK} Essayez Vasco gratuitement — pour les {TRADE}s qui veulent grandir. Lien en bio 📲 #{KEYWORD}"],
      es: ["{HOOK} Prueba Vasco gratis — para {TRADE}s que quieren crecer. Link en bio 📲 #{KEYWORD}"],
      it: ["{HOOK} Prova Vasco gratis — per {TRADE} che vogliono crescere. Link in bio 📲 #{KEYWORD}"],
    },
  },
  "transformation": {
    organic: {
      en: [
        "{HOOK} 🔄 The transformation speaks for itself. #{KEYWORD}",
        "From disaster to done. {HOOK} Every {TRADE} lives for this moment. #{KEYWORD}",
      ],
      nl: ["{HOOK} 🔄 De transformatie spreekt voor zich. #{KEYWORD}"],
      de: ["{HOOK} 🔄 Die Verwandlung spricht fur sich. #{KEYWORD}"],
      fr: ["{HOOK} 🔄 La transformation parle d'elle-meme. #{KEYWORD}"],
      es: ["{HOOK} 🔄 La transformacion habla por si sola. #{KEYWORD}"],
      it: ["{HOOK} 🔄 La trasformazione parla da sola. #{KEYWORD}"],
    },
    commerce: {
      en: ["{HOOK} Document every transformation with Vasco. Free for contractors 📲 #{KEYWORD}"],
      nl: ["{HOOK} Documenteer elke transformatie met Vasco. Gratis voor vaklui 📲 #{KEYWORD}"],
      de: ["{HOOK} Dokumentiere jede Verwandlung mit Vasco. Kostenlos 📲 #{KEYWORD}"],
      fr: ["{HOOK} Documentez chaque transformation avec Vasco. Gratuit 📲 #{KEYWORD}"],
      es: ["{HOOK} Documenta cada transformacion con Vasco. Gratis 📲 #{KEYWORD}"],
      it: ["{HOOK} Documenta ogni trasformazione con Vasco. Gratis 📲 #{KEYWORD}"],
    },
  },
  "compliance-scare": {
    organic: {
      en: ["{HOOK} ⚠️ Don't get caught out. Every {TRADE} needs to check this. #{KEYWORD}"],
      nl: ["{HOOK} ⚠️ Laat je niet verrassen. Elke {TRADE} moet dit checken. #{KEYWORD}"],
      de: ["{HOOK} ⚠️ Lass dich nicht erwischen. Jeder {TRADE} muss das prufen. #{KEYWORD}"],
      fr: ["{HOOK} ⚠️ Ne vous faites pas avoir. Chaque {TRADE} doit verifier. #{KEYWORD}"],
      es: ["{HOOK} ⚠️ No te pillen. Todo {TRADE} debe revisar esto. #{KEYWORD}"],
      it: ["{HOOK} ⚠️ Non farti cogliere. Ogni {TRADE} deve controllare. #{KEYWORD}"],
    },
    commerce: {
      en: ["{HOOK} Vasco checks compliance automatically. Stay safe — download free 📲 #{KEYWORD}"],
      nl: ["{HOOK} Vasco checkt compliance automatisch. Blijf veilig — gratis downloaden 📲 #{KEYWORD}"],
      de: ["{HOOK} Vasco pruft Compliance automatisch. Bleib sicher — kostenlos 📲 #{KEYWORD}"],
      fr: ["{HOOK} Vasco verifie la conformite automatiquement. Gratuit 📲 #{KEYWORD}"],
      es: ["{HOOK} Vasco verifica el cumplimiento automaticamente. Gratis 📲 #{KEYWORD}"],
      it: ["{HOOK} Vasco verifica la conformita automaticamente. Gratis 📲 #{KEYWORD}"],
    },
  },
  "contractor-life": {
    organic: {
      en: [
        "{HOOK} 🏗️ This is real {TRADE} life. No glamour, just graft. #{KEYWORD}",
        "If you know, you know. {HOOK} Tag a {TRADE} who gets it. #{KEYWORD}",
      ],
      nl: ["{HOOK} 🏗️ Dit is het echte {TRADE}-leven. Geen glamour, gewoon werken. #{KEYWORD}"],
      de: ["{HOOK} 🏗️ Das ist echtes {TRADE}-Leben. Kein Glamour, nur Arbeit. #{KEYWORD}"],
      fr: ["{HOOK} 🏗️ La vraie vie d'un {TRADE}. Pas de glamour, juste du travail. #{KEYWORD}"],
      es: ["{HOOK} 🏗️ La vida real de un {TRADE}. Sin glamour, solo curro. #{KEYWORD}"],
      it: ["{HOOK} 🏗️ La vera vita di un {TRADE}. Niente glamour, solo lavoro. #{KEYWORD}"],
    },
    commerce: {
      en: ["{HOOK} Make the {TRADE} life easier with Vasco. Free download 📲 #{KEYWORD}"],
      nl: ["{HOOK} Maak het {TRADE}-leven makkelijker met Vasco. Gratis 📲 #{KEYWORD}"],
      de: ["{HOOK} Mach das {TRADE}-Leben einfacher mit Vasco. Kostenlos 📲 #{KEYWORD}"],
      fr: ["{HOOK} Simplifiez la vie d'artisan avec Vasco. Gratuit 📲 #{KEYWORD}"],
      es: ["{HOOK} Simplifica tu vida de {TRADE} con Vasco. Gratis 📲 #{KEYWORD}"],
      it: ["{HOOK} Semplifica la vita da {TRADE} con Vasco. Gratis 📲 #{KEYWORD}"],
    },
  },
  "tool-material": {
    organic: {
      en: ["{HOOK} 🔧 Honest review — no sponsorship, just real {TRADE} experience. #{KEYWORD}"],
      nl: ["{HOOK} 🔧 Eerlijke review — geen sponsoring, gewoon echte {TRADE}-ervaring. #{KEYWORD}"],
      de: ["{HOOK} 🔧 Ehrliches Review — kein Sponsoring, echte {TRADE}-Erfahrung. #{KEYWORD}"],
      fr: ["{HOOK} 🔧 Avis honnete — pas de sponsoring, experience reelle. #{KEYWORD}"],
      es: ["{HOOK} 🔧 Opinion honesta — sin patrocinio, experiencia real. #{KEYWORD}"],
      it: ["{HOOK} 🔧 Recensione onesta — niente sponsorizzazione, esperienza reale. #{KEYWORD}"],
    },
    commerce: {
      en: ["{HOOK} Compare tool prices with Vasco's purchasing agent. Free for contractors 📲 #{KEYWORD}"],
      nl: ["{HOOK} Vergelijk gereedschapsprijzen met Vasco. Gratis voor vaklui 📲 #{KEYWORD}"],
      de: ["{HOOK} Werkzeugpreise vergleichen mit Vasco. Kostenlos 📲 #{KEYWORD}"],
      fr: ["{HOOK} Comparez les prix d'outils avec Vasco. Gratuit 📲 #{KEYWORD}"],
      es: ["{HOOK} Compara precios de herramientas con Vasco. Gratis 📲 #{KEYWORD}"],
      it: ["{HOOK} Confronta i prezzi degli attrezzi con Vasco. Gratis 📲 #{KEYWORD}"],
    },
  },
  "business-growth": {
    organic: {
      en: ["{HOOK} 📈 Building a {TRADE} business is hard. Here's what actually works. #{KEYWORD}"],
      nl: ["{HOOK} 📈 Een {TRADE}-bedrijf opbouwen is lastig. Dit werkt echt. #{KEYWORD}"],
      de: ["{HOOK} 📈 Ein {TRADE}-Geschaft aufzubauen ist hart. Das funktioniert wirklich. #{KEYWORD}"],
      fr: ["{HOOK} 📈 Monter une boite de {TRADE}, c'est dur. Voici ce qui marche. #{KEYWORD}"],
      es: ["{HOOK} 📈 Montar un negocio de {TRADE} es duro. Esto es lo que funciona. #{KEYWORD}"],
      it: ["{HOOK} 📈 Costruire un'attivita da {TRADE} e duro. Ecco cosa funziona. #{KEYWORD}"],
    },
    commerce: {
      en: ["{HOOK} Grow your {TRADE} business with Vasco. Free download 📲 #{KEYWORD}"],
      nl: ["{HOOK} Laat je {TRADE}-bedrijf groeien met Vasco. Gratis 📲 #{KEYWORD}"],
      de: ["{HOOK} Lass dein {TRADE}-Geschaft wachsen mit Vasco. Kostenlos 📲 #{KEYWORD}"],
      fr: ["{HOOK} Developpez votre activite de {TRADE} avec Vasco. Gratuit 📲 #{KEYWORD}"],
      es: ["{HOOK} Haz crecer tu negocio de {TRADE} con Vasco. Gratis 📲 #{KEYWORD}"],
      it: ["{HOOK} Fai crescere la tua attivita da {TRADE} con Vasco. Gratis 📲 #{KEYWORD}"],
    },
  },
  "product-proof": {
    organic: {
      en: ["{HOOK} 📱 Real app, real {TRADE} workflow. No demo mode. #{KEYWORD}"],
      nl: ["{HOOK} 📱 Echte app, echte {TRADE}-workflow. Geen demo. #{KEYWORD}"],
      de: ["{HOOK} 📱 Echte App, echter {TRADE}-Workflow. Kein Demo-Modus. #{KEYWORD}"],
      fr: ["{HOOK} 📱 Appli reelle, workflow {TRADE} reel. Pas de demo. #{KEYWORD}"],
      es: ["{HOOK} 📱 App real, flujo de trabajo real de {TRADE}. Sin demo. #{KEYWORD}"],
      it: ["{HOOK} 📱 App reale, workflow da {TRADE} reale. Niente demo. #{KEYWORD}"],
    },
    commerce: {
      en: ["{HOOK} See why 10,000+ contractors use Vasco. Free download 📲 #{KEYWORD}"],
      nl: ["{HOOK} Ontdek waarom 10.000+ vaklui Vasco gebruiken. Gratis 📲 #{KEYWORD}"],
      de: ["{HOOK} Entdecke warum 10.000+ Handwerker Vasco nutzen. Kostenlos 📲 #{KEYWORD}"],
      fr: ["{HOOK} Decouvrez pourquoi 10 000+ artisans utilisent Vasco. Gratuit 📲 #{KEYWORD}"],
      es: ["{HOOK} Descubre por que 10.000+ profesionales usan Vasco. Gratis 📲 #{KEYWORD}"],
      it: ["{HOOK} Scopri perche 10.000+ professionisti usano Vasco. Gratis 📲 #{KEYWORD}"],
    },
  },
};

// ─── Utility ───────────────────────────────────────────────────────────────

function randomId(): string {
  return `cap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getPillarSlug(pillarId: string): string {
  const map: Record<string, string> = {
    "pil-money": "money-reveal",
    "pil-speed": "speed-challenge",
    "pil-transform": "transformation",
    "pil-compliance": "compliance-scare",
    "pil-life": "contractor-life",
    "pil-tool": "tool-material",
    "pil-growth": "business-growth",
    "pil-proof": "product-proof",
  };
  return map[pillarId] ?? "_default";
}

function getTradeNameFromIdea(idea: ContentIdea): string {
  const map: Record<string, string> = {
    "trade-plumbing": "plumber",
    "trade-electrical": "electrician",
    "trade-painting": "painter",
    "trade-carpentry": "carpenter",
    "trade-tiling": "tiler",
    "trade-roofing": "roofer",
    "trade-hvac": "HVAC tech",
  };
  return map[idea.tradeId ?? ""] ?? "contractor";
}

function fillCaption(template: string, idea: ContentIdea): string {
  const trade = getTradeNameFromIdea(idea);
  return template
    .replace(/\{HOOK\}/g, idea.hook)
    .replace(/\{TRADE\}/g, trade)
    .replace(/\{KEYWORD\}/g, idea.targetKeyword.replace(/\s+/g, ""));
}

function localizeHashtags(idea: ContentIdea, lang: LanguageCode): string[] {
  const base = LOCALIZED_HASHTAGS[lang] ?? LOCALIZED_HASHTAGS.en;
  return base.slice(0, 4);
}

// ─── Caption Generator ─────────────────────────────────────────────────────

export function generateCaptions(idea: ContentIdea): GeneratedCaption[] {
  const pillarSlug = getPillarSlug(idea.pillarId);
  const templates = TEMPLATES[pillarSlug] ?? TEMPLATES["_default"];
  const captions: GeneratedCaption[] = [];

  for (const lang of LANGUAGES) {
    // Organic
    const organicTemplates = templates.organic[lang] ?? TEMPLATES["_default"].organic[lang];
    const organicText = fillCaption(pickRandom(organicTemplates), idea);
    captions.push({
      id: randomId(),
      ideaId: idea.id,
      languageCode: lang,
      caption: organicText,
      hashtags: localizeHashtags(idea, lang),
      cta: "",
      seoKeyword: idea.targetKeyword,
      mode: "organic",
    });

    // Commerce
    const commerceTemplates = templates.commerce[lang] ?? TEMPLATES["_default"].commerce[lang];
    const commerceText = fillCaption(pickRandom(commerceTemplates), idea);
    captions.push({
      id: randomId(),
      ideaId: idea.id,
      languageCode: lang,
      caption: commerceText,
      hashtags: localizeHashtags(idea, lang),
      cta: idea.cta,
      seoKeyword: idea.targetKeyword,
      mode: "commerce",
    });
  }

  return captions;
}

export function generateCaptionPack(idea: ContentIdea): CaptionPack {
  const allCaptions = generateCaptions(idea);
  const captions = {} as CaptionPack["captions"];

  for (const lang of LANGUAGES) {
    const organic = allCaptions.find((c) => c.languageCode === lang && c.mode === "organic")!;
    const commerce = allCaptions.find((c) => c.languageCode === lang && c.mode === "commerce")!;
    captions[lang] = { organic, commerce };
  }

  return {
    ideaId: idea.id,
    ideaTitle: idea.title,
    hook: idea.hook,
    captions,
  };
}

export function generateCaptionPacks(ideas: ContentIdea[]): CaptionPack[] {
  return ideas.map(generateCaptionPack);
}
