// =============================================================================
// CUSTOMER GLOSSARY — plain-language construction terms
// =============================================================================
// For customers who don't know building but are working with a contractor.
// Each term carries a localized label + a one-sentence plain explanation in the
// 6 portal languages. Rendered by the "What do these words mean?" modal in the
// customer decision portal. Kept as data (not i18n JSON) so the term + its
// definition stay paired and easy to extend.
// =============================================================================

type Lang = 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';

export interface GlossaryEntry {
  id: string;
  term: Record<Lang, string>;
  def: Record<Lang, string>;
}

export const CUSTOMER_GLOSSARY: GlossaryEntry[] = [
  {
    id: 'quote',
    term: { en: 'Quote', nl: 'Offerte', de: 'Angebot', fr: 'Devis', es: 'Presupuesto', it: 'Preventivo' },
    def: {
      en: 'A written price for the work, agreed before it starts.',
      nl: 'Een schriftelijke prijs voor het werk, afgesproken voordat het begint.',
      de: 'Ein schriftlicher Preis für die Arbeit, vereinbart bevor sie beginnt.',
      fr: 'Un prix écrit pour les travaux, convenu avant qu’ils commencent.',
      es: 'Un precio por escrito del trabajo, acordado antes de empezar.',
      it: 'Un prezzo scritto per il lavoro, concordato prima di iniziare.',
    },
  },
  {
    id: 'deposit',
    term: { en: 'Deposit', nl: 'Aanbetaling', de: 'Anzahlung', fr: 'Acompte', es: 'Anticipo', it: 'Acconto' },
    def: {
      en: 'A part of the total you pay up front so the contractor can buy materials and start.',
      nl: 'Een deel van het totaal dat u vooraf betaalt zodat de aannemer materiaal kan kopen en kan starten.',
      de: 'Ein Teil der Summe, den Sie im Voraus zahlen, damit der Handwerker Material kaufen und beginnen kann.',
      fr: 'Une partie du total payée d’avance pour que l’artisan achète les matériaux et démarre.',
      es: 'Una parte del total que pagas por adelantado para que el profesional compre materiales y empiece.',
      it: 'Una parte del totale che paghi in anticipo così l’artigiano può comprare i materiali e iniziare.',
    },
  },
  {
    id: 'vat',
    term: { en: 'VAT', nl: 'BTW', de: 'MwSt.', fr: 'TVA', es: 'IVA', it: 'IVA' },
    def: {
      en: 'A government tax added to the price. Quotes usually show the price with and without it.',
      nl: 'Een belasting van de overheid die bij de prijs komt. Offertes tonen meestal de prijs met en zonder.',
      de: 'Eine staatliche Steuer, die zum Preis hinzukommt. Angebote zeigen meist den Preis mit und ohne.',
      fr: 'Une taxe de l’État ajoutée au prix. Les devis montrent souvent le prix avec et sans.',
      es: 'Un impuesto del Estado que se añade al precio. Los presupuestos suelen mostrarlo con y sin.',
      it: 'Una tassa statale aggiunta al prezzo. I preventivi mostrano di solito il prezzo con e senza.',
    },
  },
  {
    id: 'delivery',
    term: { en: 'Delivery date', nl: 'Leveringsdatum', de: 'Liefertermin', fr: 'Date de livraison', es: 'Fecha de entrega', it: 'Data di consegna' },
    def: {
      en: 'The day the materials or finished work are expected to arrive or be ready.',
      nl: 'De dag waarop de materialen of het afgeronde werk verwacht worden of klaar zijn.',
      de: 'Der Tag, an dem die Materialien oder die fertige Arbeit erwartet werden oder fertig sind.',
      fr: 'Le jour où les matériaux ou les travaux terminés sont attendus ou prêts.',
      es: 'El día en que se esperan o están listos los materiales o el trabajo terminado.',
      it: 'Il giorno in cui i materiali o il lavoro finito sono attesi o pronti.',
    },
  },
  {
    id: 'variation',
    term: { en: 'Additional work', nl: 'Meerwerk', de: 'Mehrarbeit', fr: 'Travaux supplémentaires', es: 'Trabajo adicional', it: 'Lavori aggiuntivi' },
    def: {
      en: 'Extra work beyond the original quote — it costs more and is agreed separately.',
      nl: 'Extra werk bovenop de oorspronkelijke offerte — dit kost meer en wordt apart afgesproken.',
      de: 'Zusätzliche Arbeit über das ursprüngliche Angebot hinaus — sie kostet mehr und wird separat vereinbart.',
      fr: 'Travaux en plus du devis initial — ils coûtent davantage et sont convenus séparément.',
      es: 'Trabajo extra más allá del presupuesto inicial — cuesta más y se acuerda aparte.',
      it: 'Lavoro extra oltre il preventivo iniziale — costa di più e si concorda a parte.',
    },
  },
  {
    id: 'handover',
    term: { en: 'Handover', nl: 'Oplevering', de: 'Abnahme', fr: 'Réception', es: 'Entrega final', it: 'Consegna finale' },
    def: {
      en: 'The moment the contractor hands the finished job back to you and you check it together.',
      nl: 'Het moment waarop de aannemer het afgeronde werk aan u teruggeeft en u het samen controleert.',
      de: 'Der Moment, in dem der Handwerker die fertige Arbeit an Sie übergibt und Sie sie gemeinsam prüfen.',
      fr: 'Le moment où l’artisan vous remet les travaux terminés et où vous les vérifiez ensemble.',
      es: 'El momento en que el profesional te entrega el trabajo terminado y lo revisáis juntos.',
      it: 'Il momento in cui l’artigiano ti riconsegna il lavoro finito e lo controllate insieme.',
    },
  },
  {
    id: 'leadtime',
    term: { en: 'Lead time', nl: 'Levertijd', de: 'Lieferzeit', fr: 'Délai', es: 'Plazo de entrega', it: 'Tempi di consegna' },
    def: {
      en: 'How long it takes for a chosen material to be available after you order it.',
      nl: 'Hoe lang het duurt voordat een gekozen materiaal beschikbaar is nadat u het bestelt.',
      de: 'Wie lange es dauert, bis ein gewähltes Material nach der Bestellung verfügbar ist.',
      fr: 'Le temps nécessaire pour qu’un matériau choisi soit disponible après la commande.',
      es: 'El tiempo que tarda en estar disponible un material elegido tras pedirlo.',
      it: 'Il tempo che serve perché un materiale scelto sia disponibile dopo l’ordine.',
    },
  },
  {
    id: 'snag',
    term: { en: 'Snags', nl: 'Restpunten', de: 'Restmängel', fr: 'Réserves', es: 'Repasos', it: 'Difetti finali' },
    def: {
      en: 'Small things still to fix or finish at the end — noted so nothing is forgotten.',
      nl: 'Kleine dingen die aan het eind nog gemaakt of afgewerkt moeten worden — genoteerd zodat niets vergeten wordt.',
      de: 'Kleine Dinge, die am Ende noch zu erledigen sind — notiert, damit nichts vergessen wird.',
      fr: 'De petites choses à corriger ou finir à la fin — notées pour ne rien oublier.',
      es: 'Pequeñas cosas por corregir o terminar al final — anotadas para que no se olvide nada.',
      it: 'Piccole cose da sistemare o finire alla fine — annotate per non dimenticare nulla.',
    },
  },
];
