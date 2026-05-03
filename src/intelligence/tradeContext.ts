// =============================================================================
// TRADE CONTEXT — Trade-specific and country-specific intelligence
// =============================================================================
// Provides contextual language, seasonal advice, and customer intelligence
// for enriching AI outputs with domain knowledge.
// =============================================================================

import { MS_PER_DAY } from '../utils/timeConstants';

// ---------------------------------------------------------------------------
// Trade terminology per country
// ---------------------------------------------------------------------------

interface TradeTerms {
  jobWord: string;
  quoteWord: string;
  customerWord: string;
  certWarning?: string;
  seasonalTip?: string;
  commonMaterials: string[];
}

const TRADE_TERMS: Record<string, Record<string, TradeTerms>> = {
  plumbing: {
    NL: {
      jobWord: 'klus',
      quoteWord: 'offerte',
      customerWord: 'klant',
      certWarning: 'KIWA/SCIOS certificering verloopt — controleer voor de CV-seizoenstart',
      commonMaterials: ['koperen buis 15mm', 'PVC afvoerbuis 40mm', 'flexibele aansluitleiding', 'kraanwerk', 'sifon'],
    },
    DE: {
      jobWord: 'Auftrag',
      quoteWord: 'Angebot',
      customerWord: 'Kunde',
      certWarning: 'DVGW-Zertifizierung und Meisterbrief rechtzeitig erneuern',
      commonMaterials: ['Kupferrohr 15mm', 'HT-Rohr DN40', 'Flexschlauch', 'Eckventil', 'Siphon'],
    },
    FR: {
      jobWord: 'chantier',
      quoteWord: 'devis',
      customerWord: 'client',
      certWarning: 'Qualification RGE a renouveler avant la saison de chauffage',
      commonMaterials: ['tube cuivre 14mm', 'tube PVC 40mm', 'flexible raccord', 'robinetterie', 'siphon'],
    },
    ES: {
      jobWord: 'trabajo',
      quoteWord: 'presupuesto',
      customerWord: 'cliente',
      certWarning: 'Renovar Carne de Instalador antes de la temporada de calefaccion',
      commonMaterials: ['tubo cobre 15mm', 'tubo PVC 40mm', 'latiguillo flexible', 'griferia', 'sifon'],
    },
    IT: {
      jobWord: 'lavoro',
      quoteWord: 'preventivo',
      customerWord: 'cliente',
      certWarning: 'Rinnovare certificazione DM 37/08 Lettera A',
      commonMaterials: ['tubo rame 14mm', 'tubo PVC 40mm', 'flessibile raccordo', 'rubinetteria', 'sifone'],
    },
    UK: {
      jobWord: 'job',
      quoteWord: 'quote',
      customerWord: 'client',
      certWarning: 'Unvented hot water certificate renewal due — check before heating season',
      commonMaterials: ['15mm copper pipe', '40mm PVC waste pipe', 'flexible connector', 'tap fittings', 'bottle trap'],
    },
  },
  electrical: {
    NL: {
      jobWord: 'klus',
      quoteWord: 'offerte',
      customerWord: 'klant',
      certWarning: 'NEN 1010 certificering vernieuwing controleren',
      commonMaterials: ['VD-draad 2.5mm2', 'centraaldoos', 'wandcontactdoos', 'installatieautomaat', 'kabelgoot'],
    },
    DE: {
      jobWord: 'Auftrag',
      quoteWord: 'Angebot',
      customerWord: 'Kunde',
      certWarning: 'Elektrofachkraft-Zertifizierung und VDE-Pruefung aktuell halten',
      commonMaterials: ['NYM-J 3x1.5mm2', 'Abzweigdose', 'Steckdose', 'Leitungsschutzschalter', 'Kabelkanal'],
    },
    FR: {
      jobWord: 'chantier',
      quoteWord: 'devis',
      customerWord: 'client',
      certWarning: 'Habilitation Electrique et Consuel a renouveler',
      commonMaterials: ['cable R2V 3G1.5', 'boite de derivation', 'prise electrique', 'disjoncteur', 'goulotte'],
    },
    ES: {
      jobWord: 'trabajo',
      quoteWord: 'presupuesto',
      customerWord: 'cliente',
      certWarning: 'Renovar Certificado Instalador Electricista y REBT',
      commonMaterials: ['cable RV-K 3x1.5mm2', 'caja de derivacion', 'enchufe', 'magnetotermico', 'canaleta'],
    },
    IT: {
      jobWord: 'lavoro',
      quoteWord: 'preventivo',
      customerWord: 'cliente',
      certWarning: 'Rinnovare certificazione DM 37/08 Lettera A - Impianti Elettrici',
      commonMaterials: ['cavo FG7OR 3G1.5', 'cassetta derivazione', 'presa elettrica', 'magnetotermico', 'canalina'],
    },
    UK: {
      jobWord: 'job',
      quoteWord: 'quote',
      customerWord: 'client',
      certWarning: 'Part P competent person registration and NICEIC/ELECSA renewal due',
      commonMaterials: ['2.5mm twin & earth', 'junction box', 'double socket', 'MCB', 'mini trunking'],
    },
  },
  gas: {
    NL: {
      jobWord: 'klus',
      quoteWord: 'offerte',
      customerWord: 'klant',
      certWarning: 'Scios Scope 8 en F-gassen certificering tijdig vernieuwen',
      commonMaterials: ['gasslang', 'gasregelaar', 'CV-ketelonderdelen', 'rookgasafvoer', 'thermostaat'],
    },
    DE: {
      jobWord: 'Auftrag',
      quoteWord: 'Angebot',
      customerWord: 'Kunde',
      certWarning: 'DVGW-Zertifizierung und F-Gas Verordnung beachten',
      commonMaterials: ['Gasschlauch', 'Gasdruckregler', 'Kesselteile', 'Abgasrohr', 'Thermostat'],
    },
    FR: {
      jobWord: 'chantier',
      quoteWord: 'devis',
      customerWord: 'client',
      certWarning: 'Certification Qualigaz et PG a renouveler',
      commonMaterials: ['tuyau gaz', 'detendeur', 'pieces chaudiere', 'conduit fumee', 'thermostat'],
    },
    ES: {
      jobWord: 'trabajo',
      quoteWord: 'presupuesto',
      customerWord: 'cliente',
      certWarning: 'Renovar Certificado Instalador Gas Tipo A/B',
      commonMaterials: ['tubo gas', 'regulador gas', 'repuestos caldera', 'conducto humos', 'termostato'],
    },
    IT: {
      jobWord: 'lavoro',
      quoteWord: 'preventivo',
      customerWord: 'cliente',
      certWarning: 'Rinnovare DM 37/08 Lettera C e Certificato Prevenzione Incendi',
      commonMaterials: ['tubo gas', 'regolatore gas', 'ricambi caldaia', 'canna fumaria', 'termostato'],
    },
    UK: {
      jobWord: 'job',
      quoteWord: 'quote',
      customerWord: 'client',
      certWarning: 'Gas Safe registration is MANDATORY — check renewal date immediately',
      commonMaterials: ['gas flex connector', 'pressure regulator', 'boiler parts', 'flue pipe', 'thermostat'],
    },
  },
  painting: {
    NL: {
      jobWord: 'klus',
      quoteWord: 'offerte',
      customerWord: 'klant',
      certWarning: 'VCA-VOL veiligheidscertificaat controleren',
      commonMaterials: ['latex muurverf', 'grondverf', 'plamuur', 'schuurpapier', 'afdekfolie'],
    },
    DE: {
      jobWord: 'Auftrag',
      quoteWord: 'Angebot',
      customerWord: 'Kunde',
      certWarning: 'Meisterbrief und Gefahrstoffunterweisung aktuell halten',
      commonMaterials: ['Wandfarbe', 'Grundierung', 'Spachtelmasse', 'Schleifpapier', 'Abdeckfolie'],
    },
    FR: {
      jobWord: 'chantier',
      quoteWord: 'devis',
      customerWord: 'client',
      certWarning: 'Qualification Qualibat peinture a renouveler',
      commonMaterials: ['peinture murale', 'sous-couche', 'enduit', 'papier abrasif', 'bache de protection'],
    },
    ES: {
      jobWord: 'trabajo',
      quoteWord: 'presupuesto',
      customerWord: 'cliente',
      certWarning: 'Renovar Licencia de Actividad municipal',
      commonMaterials: ['pintura plastica', 'imprimacion', 'masilla', 'lija', 'plastico protector'],
    },
    IT: {
      jobWord: 'lavoro',
      quoteWord: 'preventivo',
      customerWord: 'cliente',
      certWarning: 'Verificare Attestazione SOA per lavori pubblici',
      commonMaterials: ['pittura murale', 'primer', 'stucco', 'carta vetrata', 'telo protettivo'],
    },
    UK: {
      jobWord: 'job',
      quoteWord: 'quote',
      customerWord: 'client',
      certWarning: 'CSCS card and public liability insurance renewal due',
      commonMaterials: ['emulsion paint', 'primer', 'filler', 'sandpaper', 'dust sheets'],
    },
  },
  carpentry: {
    NL: {
      jobWord: 'klus',
      quoteWord: 'offerte',
      customerWord: 'klant',
      certWarning: 'VCA-VOL veiligheidscertificaat controleren',
      commonMaterials: ['steigerhout', 'multiplex', 'schroeven RVS', 'houtlijm', 'beslag'],
    },
    DE: {
      jobWord: 'Auftrag',
      quoteWord: 'Angebot',
      customerWord: 'Kunde',
      certWarning: 'Meisterbrief und Maschinenschein aktuell halten',
      commonMaterials: ['Konstruktionsvollholz', 'Multiplex', 'Edelstahlschrauben', 'Holzleim', 'Beschlag'],
    },
    FR: {
      jobWord: 'chantier',
      quoteWord: 'devis',
      customerWord: 'client',
      certWarning: 'Qualification Qualibat menuiserie a renouveler',
      commonMaterials: ['bois massif', 'contreplaque', 'vis inox', 'colle a bois', 'ferrure'],
    },
    ES: {
      jobWord: 'trabajo',
      quoteWord: 'presupuesto',
      customerWord: 'cliente',
      certWarning: 'Renovar Licencia de Actividad municipal',
      commonMaterials: ['madera maciza', 'contrachapado', 'tornillos inox', 'cola de madera', 'herraje'],
    },
    IT: {
      jobWord: 'lavoro',
      quoteWord: 'preventivo',
      customerWord: 'cliente',
      certWarning: 'Verificare Attestazione SOA per lavori pubblici',
      commonMaterials: ['legno massello', 'multistrato', 'viti inox', 'colla per legno', 'ferramenta'],
    },
    UK: {
      jobWord: 'job',
      quoteWord: 'quote',
      customerWord: 'client',
      certWarning: 'CSCS card and NVQ Level 2+ renewal due',
      commonMaterials: ['structural timber', 'plywood', 'stainless screws', 'wood glue', 'ironmongery'],
    },
  },
  roofing: {
    NL: {
      jobWord: 'klus',
      quoteWord: 'offerte',
      customerWord: 'klant',
      certWarning: 'BIKUDAK certificering verloopt — controleer voor het stormseizoen',
      seasonalTip: 'Dakwerk piek maart-oktober, winterstop bij vorst',
      commonMaterials: ['dakpannen', 'bitumen', 'lood', 'dakgoten', 'EPDM', 'isolatieplaten', 'nokvorsten'],
    },
    UK: {
      jobWord: 'job',
      quoteWord: 'quote',
      customerWord: 'client',
      certWarning: 'NFRC membership renewal due — check before storm season',
      seasonalTip: 'Roofing peak March-October, avoid ice/frost',
      commonMaterials: ['roof tiles', 'felt', 'lead flashing', 'guttering', 'EPDM membrane', 'ridge tiles', 'battens'],
    },
    DE: {
      jobWord: 'Auftrag',
      quoteWord: 'Angebot',
      customerWord: 'Kunde',
      certWarning: 'Dachdecker-Meisterbrief — Fortbildung prüfen',
      seasonalTip: 'Dacharbeiten April-Oktober, Winterpause bei Frost',
      commonMaterials: ['Dachziegel', 'Bitumen', 'Bleiblech', 'Dachrinne', 'EPDM', 'Dämmplatten', 'Firstziegel'],
    },
    FR: {
      jobWord: 'chantier',
      quoteWord: 'devis',
      customerWord: 'client',
      certWarning: 'Qualibat Couverture — vérifier renouvellement',
      seasonalTip: 'Couverture avril-octobre, arrêt en hiver',
      commonMaterials: ['tuiles', 'bitume', 'plomb', 'gouttières', 'EPDM', 'isolation', 'faîtières'],
    },
    ES: {
      jobWord: 'obra',
      quoteWord: 'presupuesto',
      customerWord: 'cliente',
      certWarning: 'TPC Cubiertas — verificar renovación',
      seasonalTip: 'Tejados primavera-otoño, evitar calor extremo',
      commonMaterials: ['tejas', 'impermeabilizante', 'canalones', 'plomo', 'EPDM', 'aislamiento', 'caballetes'],
    },
    IT: {
      jobWord: 'lavoro',
      quoteWord: 'preventivo',
      customerWord: 'cliente',
      certWarning: 'SOA — verificare rinnovo',
      seasonalTip: 'Coperture aprile-ottobre, pausa invernale',
      commonMaterials: ['tegole', 'bitume', 'piombo', 'grondaie', 'EPDM', 'isolamento', 'colmi'],
    },
  },
  tiling: {
    NL: {
      jobWord: 'klus',
      quoteWord: 'offerte',
      customerWord: 'klant',
      certWarning: 'VCA-VOL veiligheidscertificaat controleren',
      seasonalTip: 'Tegelwerk het hele jaar, badkamerseizoen herfst-winter',
      commonMaterials: ['wandtegels', 'vloertegels', 'tegellijm', 'voegmortel', 'waterdichtingsmembraan', 'kruisjes', 'tegelsnijder bladen'],
    },
    UK: {
      jobWord: 'job',
      quoteWord: 'quote',
      customerWord: 'client',
      certWarning: 'CSCS card and NVQ tiling qualification renewal due',
      seasonalTip: 'Tiling year-round, bathroom season autumn-winter',
      commonMaterials: ['wall tiles', 'floor tiles', 'tile adhesive', 'grout', 'waterproof membrane', 'spacers', 'tile trim'],
    },
    DE: {
      jobWord: 'Auftrag',
      quoteWord: 'Angebot',
      customerWord: 'Kunde',
      certWarning: 'Fliesenleger-Meisterbrief — Fortbildung prüfen',
      seasonalTip: 'Fliesenarbeiten ganzjährig, Badsaison Herbst-Winter',
      commonMaterials: ['Wandfliesen', 'Bodenfliesen', 'Fliesenkleber', 'Fugenmörtel', 'Abdichtung', 'Fliesenkreuze', 'Schienenprofil'],
    },
    FR: {
      jobWord: 'chantier',
      quoteWord: 'devis',
      customerWord: 'client',
      certWarning: 'Qualibat Carrelage — vérifier renouvellement',
      seasonalTip: 'Carrelage toute l\'année, saison salles de bain automne-hiver',
      commonMaterials: ['carreaux muraux', 'carreaux sol', 'colle', 'joint', 'membrane étanche', 'croisillons', 'profilé'],
    },
    ES: {
      jobWord: 'obra',
      quoteWord: 'presupuesto',
      customerWord: 'cliente',
      certWarning: 'TPC Alicatados — verificar renovación',
      seasonalTip: 'Alicatado todo el año, temporada baños otoño-invierno',
      commonMaterials: ['azulejos', 'baldosas', 'cemento cola', 'lechada', 'membrana', 'crucetas', 'perfil'],
    },
    IT: {
      jobWord: 'lavoro',
      quoteWord: 'preventivo',
      customerWord: 'cliente',
      certWarning: 'SOA — verificare rinnovo piastrellista',
      seasonalTip: 'Piastrellatura tutto l\'anno, stagione bagni autunno-inverno',
      commonMaterials: ['piastrelle parete', 'piastrelle pavimento', 'colla', 'stucco', 'membrana', 'distanziatori', 'profilo'],
    },
  },
  plastering: {
    NL: {
      jobWord: 'klus',
      quoteWord: 'offerte',
      customerWord: 'klant',
      certWarning: 'VCA-VOL veiligheidscertificaat controleren',
      seasonalTip: 'Stucwerk ganzjährig, nieuwbouwpiek voorjaar-zomer',
      commonMaterials: ['gipspleister', 'stucmortel', 'gaasband', 'primer', 'hoekprofielen', 'spaan', 'schuurpapier'],
    },
    UK: {
      jobWord: 'job',
      quoteWord: 'quote',
      customerWord: 'client',
      certWarning: 'CSCS card and NVQ plastering qualification renewal due',
      seasonalTip: 'Plastering year-round, new-build peak spring-summer',
      commonMaterials: ['plaster', 'bonding coat', 'scrim tape', 'PVA', 'angle beads', 'trowel blades', 'sandpaper'],
    },
    DE: {
      jobWord: 'Auftrag',
      quoteWord: 'Angebot',
      customerWord: 'Kunde',
      certWarning: 'Stuckateur-Meisterbrief — Fortbildung prüfen',
      seasonalTip: 'Putzarbeiten ganzjährig, Neubausaison Frühjahr-Sommer',
      commonMaterials: ['Gipsputz', 'Stuckmörtel', 'Gewebeband', 'Grundierung', 'Eckprofile', 'Glättkelle', 'Schleifpapier'],
    },
    FR: {
      jobWord: 'chantier',
      quoteWord: 'devis',
      customerWord: 'client',
      certWarning: 'Qualibat Plâtrerie — vérifier renouvellement',
      seasonalTip: 'Plâtrerie toute l\'année, pic construction printemps-été',
      commonMaterials: ['plâtre', 'enduit', 'bande', 'primaire', 'baguettes d\'angle', 'taloche', 'papier abrasif'],
    },
    ES: {
      jobWord: 'obra',
      quoteWord: 'presupuesto',
      customerWord: 'cliente',
      certWarning: 'TPC Yesista — verificar renovación',
      seasonalTip: 'Yeso todo el año, pico obra nueva primavera-verano',
      commonMaterials: ['yeso', 'mortero', 'cinta', 'imprimación', 'cantoneras', 'llana', 'lija'],
    },
    IT: {
      jobWord: 'lavoro',
      quoteWord: 'preventivo',
      customerWord: 'cliente',
      certWarning: 'SOA — verificare rinnovo intonacatore',
      seasonalTip: 'Intonacatura tutto l\'anno, picco cantieri primavera-estate',
      commonMaterials: ['gesso', 'intonaco', 'nastro', 'primer', 'paraspigoli', 'frattazzo', 'carta vetrata'],
    },
  },
  flooring: {
    NL: {
      jobWord: 'klus',
      quoteWord: 'offerte',
      customerWord: 'klant',
      certWarning: 'VCA-VOL veiligheidscertificaat controleren',
      seasonalTip: 'Vloerenwerk het hele jaar, verhuispiek voorjaar en nazomer',
      commonMaterials: ['laminaat', 'ondervloer', 'plinten', 'PVC click', 'vinyl', 'parket', 'egalisatie'],
    },
    UK: {
      jobWord: 'job',
      quoteWord: 'quote',
      customerWord: 'client',
      certWarning: 'CSCS card and flooring NVQ renewal due',
      seasonalTip: 'Flooring year-round, moving season peak spring and autumn',
      commonMaterials: ['laminate', 'underlay', 'skirting', 'LVT', 'vinyl', 'engineered wood', 'self-leveller'],
    },
    DE: {
      jobWord: 'Auftrag',
      quoteWord: 'Angebot',
      customerWord: 'Kunde',
      certWarning: 'Bodenleger-Meisterbrief — Fortbildung prüfen',
      seasonalTip: 'Bodenbelag ganzjährig, Umzugssaison Frühjahr und Herbst',
      commonMaterials: ['Laminat', 'Trittschalldämmung', 'Sockelleisten', 'Vinyl', 'PVC', 'Parkett', 'Ausgleichsmasse'],
    },
    FR: {
      jobWord: 'chantier',
      quoteWord: 'devis',
      customerWord: 'client',
      certWarning: 'Qualibat Revêtement de sol — vérifier renouvellement',
      seasonalTip: 'Sols toute l\'année, pic déménagements printemps et automne',
      commonMaterials: ['stratifié', 'sous-couche', 'plinthes', 'vinyle', 'PVC', 'parquet', 'ragréage'],
    },
    ES: {
      jobWord: 'obra',
      quoteWord: 'presupuesto',
      customerWord: 'cliente',
      certWarning: 'TPC Solador — verificar renovación',
      seasonalTip: 'Suelos todo el año, pico mudanzas primavera y otoño',
      commonMaterials: ['laminado', 'base', 'rodapiés', 'vinilo', 'PVC', 'parquet', 'autonivelante'],
    },
    IT: {
      jobWord: 'lavoro',
      quoteWord: 'preventivo',
      customerWord: 'cliente',
      certWarning: 'SOA — verificare rinnovo pavimentista',
      seasonalTip: 'Pavimenti tutto l\'anno, picco traslochi primavera e autunno',
      commonMaterials: ['laminato', 'sottopavimento', 'battiscopa', 'vinile', 'PVC', 'parquet', 'autolivellante'],
    },
  },
  insulation: {
    NL: {
      jobWord: 'klus',
      quoteWord: 'offerte',
      customerWord: 'klant',
      certWarning: 'KIWA-BDA isolatiecertificering controleren',
      seasonalTip: 'Isolatie het hele jaar, subsidie-aanvragen piek Q1-Q2',
      commonMaterials: ['glaswol', 'PIR platen', 'dampscherm', 'tape', 'EPS', 'spouwmuuranker', 'PUR schuim'],
    },
    UK: {
      jobWord: 'job',
      quoteWord: 'quote',
      customerWord: 'client',
      certWarning: 'NIA/CIGA membership and TrustMark renewal due',
      seasonalTip: 'Insulation year-round, grant applications peak Q1-Q2',
      commonMaterials: ['mineral wool', 'PIR board', 'vapour barrier', 'tape', 'EPS', 'cavity wall ties', 'spray foam'],
    },
    DE: {
      jobWord: 'Auftrag',
      quoteWord: 'Angebot',
      customerWord: 'Kunde',
      certWarning: 'Energieberater-Zertifizierung und BAFA-Zulassung prüfen',
      seasonalTip: 'Dämmarbeiten ganzjährig, KfW-Förderung Frühjahr beantragen',
      commonMaterials: ['Mineralwolle', 'PIR Platten', 'Dampfsperre', 'Klebeband', 'EPS', 'Dübel', 'PUR Schaum'],
    },
    FR: {
      jobWord: 'chantier',
      quoteWord: 'devis',
      customerWord: 'client',
      certWarning: 'RGE Isolation — vérifier renouvellement',
      seasonalTip: 'Isolation toute l\'année, pic MaPrimeRénov\' T1-T2',
      commonMaterials: ['laine de verre', 'panneaux PIR', 'pare-vapeur', 'adhésif', 'PSE', 'chevilles', 'mousse PU'],
    },
    ES: {
      jobWord: 'obra',
      quoteWord: 'presupuesto',
      customerWord: 'cliente',
      certWarning: 'TPC Aislamiento — verificar renovación',
      seasonalTip: 'Aislamiento todo el año, subvenciones pico T1-T2',
      commonMaterials: ['lana mineral', 'panel PIR', 'barrera vapor', 'cinta', 'EPS', 'anclajes', 'espuma PU'],
    },
    IT: {
      jobWord: 'lavoro',
      quoteWord: 'preventivo',
      customerWord: 'cliente',
      certWarning: 'SOA — verificare rinnovo, Superbonus requisiti',
      seasonalTip: 'Isolamento tutto l\'anno, Superbonus/Ecobonus picco T1-T2',
      commonMaterials: ['lana minerale', 'pannelli PIR', 'barriera vapore', 'nastro', 'EPS', 'tasselli', 'schiuma PU'],
    },
  },
  solar: {
    NL: {
      jobWord: 'klus',
      quoteWord: 'offerte',
      customerWord: 'klant',
      certWarning: 'Zonnekeur certificering en NEN 1010 controleren',
      seasonalTip: 'Zonnepanelen piek voorjaar-zomer, salderingsregeling wijzigt',
      commonMaterials: ['zonnepanelen', 'omvormer', 'montagerails', 'MC4 connectors', 'kabel', 'dakbevestiging', 'meter'],
    },
    UK: {
      jobWord: 'job',
      quoteWord: 'quote',
      customerWord: 'client',
      certWarning: 'MCS certification and RECC membership renewal due',
      seasonalTip: 'Solar peak spring-summer, SEG tariff changes in April',
      commonMaterials: ['solar panels', 'inverter', 'mounting rails', 'MC4 connectors', 'cable', 'roof fixings', 'meter'],
    },
    DE: {
      jobWord: 'Auftrag',
      quoteWord: 'Angebot',
      customerWord: 'Kunde',
      certWarning: 'Elektrofachkraft-Zertifizierung und Eintragung Installateurverzeichnis prüfen',
      seasonalTip: 'Solaranlagen Frühjahr-Sommer, EEG-Vergütung prüfen',
      commonMaterials: ['Solarmodule', 'Wechselrichter', 'Montagesschienen', 'MC4 Stecker', 'Kabel', 'Dachhaken', 'Zähler'],
    },
    FR: {
      jobWord: 'chantier',
      quoteWord: 'devis',
      customerWord: 'client',
      certWarning: 'QualiPV et RGE — vérifier renouvellement',
      seasonalTip: 'Solaire pic printemps-été, tarif rachat révisé en T1',
      commonMaterials: ['panneaux solaires', 'onduleur', 'rails de montage', 'connecteurs MC4', 'câble', 'fixations', 'compteur'],
    },
    ES: {
      jobWord: 'obra',
      quoteWord: 'presupuesto',
      customerWord: 'cliente',
      certWarning: 'RITE Instalador y certificado autoconsumo — verificar',
      seasonalTip: 'Solar primavera-verano, normativa autoconsumo vigente',
      commonMaterials: ['paneles solares', 'inversor', 'rieles', 'conectores MC4', 'cable', 'fijaciones', 'contador'],
    },
    IT: {
      jobWord: 'lavoro',
      quoteWord: 'preventivo',
      customerWord: 'cliente',
      certWarning: 'DM 37/08 Lettera A e GSE — verificare rinnovo',
      seasonalTip: 'Solare primavera-estate, Superbonus/detrazione fiscale',
      commonMaterials: ['pannelli solari', 'inverter', 'guide di montaggio', 'connettori MC4', 'cavo', 'fissaggi', 'contatore'],
    },
  },
  glazing: {
    NL: {
      jobWord: 'klus',
      quoteWord: 'offerte',
      customerWord: 'klant',
      certWarning: 'KOMO/SKG certificering controleren',
      seasonalTip: 'Glaswerk het hele jaar, energielabel-renovaties piek herfst',
      commonMaterials: ['HR++ glas', 'dubbelglas', 'kit', 'glaslatten', 'afstandhouders', 'butylband', 'profielen'],
    },
    UK: {
      jobWord: 'job',
      quoteWord: 'quote',
      customerWord: 'client',
      certWarning: 'FENSA/CERTASS registration and GGF membership renewal due',
      seasonalTip: 'Glazing year-round, energy-efficiency renovations peak autumn',
      commonMaterials: ['double glazing', 'toughened glass', 'sealant', 'glazing beads', 'spacer bars', 'butyl tape', 'profiles'],
    },
    DE: {
      jobWord: 'Auftrag',
      quoteWord: 'Angebot',
      customerWord: 'Kunde',
      certWarning: 'Glaser-Meisterbrief — Fortbildung prüfen',
      seasonalTip: 'Glasarbeiten ganzjährig, Energiesanierung Herbstsaison',
      commonMaterials: ['Isolierglas', 'Sicherheitsglas', 'Silikon', 'Glasleisten', 'Abstandhalter', 'Butylband', 'Profile'],
    },
    FR: {
      jobWord: 'chantier',
      quoteWord: 'devis',
      customerWord: 'client',
      certWarning: 'Qualibat Vitrerie et RGE — vérifier renouvellement',
      seasonalTip: 'Vitrerie toute l\'année, rénovation énergétique pic automne',
      commonMaterials: ['double vitrage', 'verre trempé', 'mastic', 'parcloses', 'intercalaires', 'butyle', 'profilés'],
    },
    ES: {
      jobWord: 'obra',
      quoteWord: 'presupuesto',
      customerWord: 'cliente',
      certWarning: 'TPC Vidriero — verificar renovación',
      seasonalTip: 'Acristalamiento todo el año, rehabilitación energética pico otoño',
      commonMaterials: ['doble acristalamiento', 'vidrio templado', 'silicona', 'junquillos', 'separadores', 'butilo', 'perfiles'],
    },
    IT: {
      jobWord: 'lavoro',
      quoteWord: 'preventivo',
      customerWord: 'cliente',
      certWarning: 'SOA — verificare rinnovo vetraio',
      seasonalTip: 'Vetrature tutto l\'anno, riqualificazione energetica picco autunno',
      commonMaterials: ['vetrocamera', 'vetro temprato', 'sigillante', 'listelli', 'distanziatori', 'butile', 'profili'],
    },
  },
  landscaping: {
    NL: {
      jobWord: 'klus',
      quoteWord: 'offerte',
      customerWord: 'klant',
      certWarning: 'VCA-VOL en groenkeur certificering controleren',
      seasonalTip: 'Tuinseizoen maart-november, bestrating het hele jaar',
      commonMaterials: ['bestrating', 'grond', 'planten', 'schuttingdelen', 'vijverfolie', 'drainage', 'tuinhout'],
    },
    UK: {
      jobWord: 'job',
      quoteWord: 'quote',
      customerWord: 'client',
      certWarning: 'BALI membership and CSCS landscaping card renewal due',
      seasonalTip: 'Landscaping peak March-November, hardscaping year-round',
      commonMaterials: ['paving', 'topsoil', 'plants', 'fencing', 'pond liner', 'drainage', 'decking'],
    },
    DE: {
      jobWord: 'Auftrag',
      quoteWord: 'Angebot',
      customerWord: 'Kunde',
      certWarning: 'Landschaftsgärtner-Meisterbrief — Fortbildung prüfen',
      seasonalTip: 'Gartensaison März-November, Pflasterarbeiten ganzjährig',
      commonMaterials: ['Pflasterstein', 'Erde', 'Pflanzen', 'Zaunelemente', 'Teichfolie', 'Drainage', 'Terrassenholz'],
    },
    FR: {
      jobWord: 'chantier',
      quoteWord: 'devis',
      customerWord: 'client',
      certWarning: 'Qualipaysage — vérifier renouvellement',
      seasonalTip: 'Paysagisme mars-novembre, maçonnerie paysagère toute l\'année',
      commonMaterials: ['pavés', 'terre', 'plantes', 'clôture', 'bâche bassin', 'drainage', 'terrasse bois'],
    },
    ES: {
      jobWord: 'obra',
      quoteWord: 'presupuesto',
      customerWord: 'cliente',
      certWarning: 'TPC Jardinería — verificar renovación',
      seasonalTip: 'Jardinería primavera-otoño, evitar calor extremo verano',
      commonMaterials: ['adoquines', 'tierra', 'plantas', 'vallado', 'lámina estanque', 'drenaje', 'tarima'],
    },
    IT: {
      jobWord: 'lavoro',
      quoteWord: 'preventivo',
      customerWord: 'cliente',
      certWarning: 'SOA — verificare rinnovo paesaggista',
      seasonalTip: 'Giardinaggio marzo-novembre, pavimentazioni tutto l\'anno',
      commonMaterials: ['pavimentazione', 'terra', 'piante', 'recinzione', 'telo laghetto', 'drenaggio', 'decking'],
    },
  },
};

const DEFAULT_TERMS: TradeTerms = {
  jobWord: 'job',
  quoteWord: 'quote',
  customerWord: 'customer',
  commonMaterials: [],
};

export function getTradeTerms(trade: string, country: string): TradeTerms {
  const normalized = trade.toLowerCase().replace(/\s+/g, '');
  const countryUpper = (country || 'NL').toUpperCase();
  return TRADE_TERMS[normalized]?.[countryUpper] ?? TRADE_TERMS[normalized]?.UK ?? DEFAULT_TERMS;
}

// ---------------------------------------------------------------------------
// Customer intelligence from job history
// ---------------------------------------------------------------------------

export interface CustomerIntelligence {
  lifetimeValue: number;
  jobCount: number;
  avgJobValue: number;
  avgDSO: number;
  isRepeatCustomer: boolean;
  lastJobDate?: string;
  paymentReliability: 'excellent' | 'good' | 'fair' | 'poor';
  escalationNeeded: boolean;
  contextLine: string;
}

/**
 * @deprecated R21: `customerTaggingService` is now the single canonical CRM
 * surface. New code should call `scoreCustomer({ customer, jobs, invoices })`
 * directly and use `contextLineFromProfile(profile)` for the VascoCard
 * `customerContext` line — both exported from `customerTaggingService.ts`.
 *
 * This function is retained as a compatibility wrapper for the 4 remaining
 * aiActionQueueService call sites (R12 deferral). The fields it computes
 * (avgDSO, paymentReliability, escalationNeeded) aren't surfaced in the
 * canonical CustomerProfile — those four sites would need restructuring
 * before this can be deleted.
 */
export function getCustomerIntelligence(
  customerId: string,
  jobs: any[],
  invoices: any[],
): CustomerIntelligence {
  const customerJobs = jobs.filter(j => j.customerId === customerId);
  const customerInvoices = invoices.filter(i =>
    i.customerId === customerId || i.customer === customerId
  );

  const jobCount = customerJobs.length;
  const isRepeatCustomer = jobCount >= 2;

  // Lifetime value from paid invoices
  const paidInvoices = customerInvoices.filter(i => i.status === 'paid');
  const lifetimeValue = paidInvoices.reduce((s: number, i: any) => s + (i.amount ?? i.total ?? 0), 0);
  const avgJobValue = jobCount > 0 ? Math.round(lifetimeValue / jobCount) : 0;

  // Average days-sales-outstanding (payment speed)
  const dsoValues: number[] = [];
  for (const inv of paidInvoices) {
    const sentDate = inv.sentAt || inv.createdAt || inv.lastUpdated;
    const paidDate = inv.paidAt || inv.lastUpdated;
    if (sentDate && paidDate) {
      const sent = new Date(sentDate).getTime();
      const paid = new Date(paidDate).getTime();
      if (paid > sent) {
        dsoValues.push(Math.ceil((paid - sent) / MS_PER_DAY));
      }
    }
  }
  const avgDSO = dsoValues.length > 0
    ? Math.round(dsoValues.reduce((a, b) => a + b, 0) / dsoValues.length)
    : 0;

  // Payment reliability
  const overdueInvoices = customerInvoices.filter(i => i.status === 'overdue');
  let paymentReliability: 'excellent' | 'good' | 'fair' | 'poor' = 'good';
  if (paidInvoices.length >= 3 && avgDSO <= 14 && overdueInvoices.length === 0) {
    paymentReliability = 'excellent';
  } else if (overdueInvoices.length >= 2 || avgDSO > 45) {
    paymentReliability = 'poor';
  } else if (overdueInvoices.length === 1 || avgDSO > 30) {
    paymentReliability = 'fair';
  }

  // Escalation needed: multiple overdue invoices
  const escalationNeeded = overdueInvoices.length >= 2;

  // Last job date
  const completedJobs = customerJobs
    .filter(j => j.status === 'completed' || j.status === 'gereed')
    .sort((a: any, b: any) => (b.completedAt || b.lastUpdated || '').localeCompare(a.completedAt || a.lastUpdated || ''));
  const lastJobDate = completedJobs[0]?.completedAt || completedJobs[0]?.lastUpdated;

  // Context line — the one-liner summary
  const parts: string[] = [];
  if (isRepeatCustomer) {
    parts.push(`Repeat customer`);
  }
  if (lifetimeValue > 0) {
    parts.push(`\u20AC${lifetimeValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
  }
  if (jobCount > 0) {
    parts.push(`${jobCount} job${jobCount !== 1 ? 's' : ''}`);
  }
  if (avgDSO > 0) {
    parts.push(`pays in ${avgDSO}d`);
  }
  if (escalationNeeded) {
    parts.push(`${overdueInvoices.length} overdue — escalation needed`);
  } else if (paymentReliability === 'excellent') {
    parts.push(`excellent payer`);
  } else if (paymentReliability === 'poor') {
    parts.push(`slow payer`);
  }

  const contextLine = parts.length > 0 ? parts.join(', ') : '';

  return {
    lifetimeValue,
    jobCount,
    avgJobValue,
    avgDSO,
    isRepeatCustomer,
    lastJobDate,
    paymentReliability,
    escalationNeeded,
    contextLine,
  };
}

// ---------------------------------------------------------------------------
// Seasonal / quarterly context
// ---------------------------------------------------------------------------

interface SeasonalEntry {
  months: number[]; // 0-based months this applies to
  tip: string;
}

const SEASONAL_TIPS: Record<string, SeasonalEntry[]> = {
  plumbing: [
    { months: [9, 10, 11, 0, 1, 2], tip: 'CV/heating season is peak — prioritize boiler maintenance quotes and emergency capacity' },
    { months: [3, 4, 5, 6, 7, 8], tip: 'Summer is new-build and renovation season — focus on bathroom and kitchen installs' },
    { months: [7, 8], tip: 'Prepare for heating season: stock CV parts, check KIWA/SCIOS cert dates, send maintenance reminders' },
  ],
  electrical: [
    { months: [3, 4, 5, 6, 7, 8], tip: 'Construction boom Q2-Q3 — new-build and renovation electrical work peaks now' },
    { months: [9, 10], tip: 'NEN/VDE inspection season — many commercial buildings need annual electrical inspections' },
    { months: [11, 0, 1, 2], tip: 'Indoor season — focus on panel upgrades, smart home installs, and EV charger quotes' },
  ],
  gas: [
    { months: [7, 8], tip: 'Heating season prep starts now — schedule boiler servicing and F-gas system checks' },
    { months: [9, 10, 11, 0, 1, 2], tip: 'Peak heating season — emergency callouts increase, keep parts stocked' },
    { months: [3, 4, 5, 6], tip: 'Off-season for heating — focus on gas installation for new builds and renovations' },
    { months: [5], tip: 'F-gas regulation deadline approaching — verify your certification is current' },
  ],
  painting: [
    { months: [3, 4, 5, 6, 7, 8], tip: 'Exterior painting season — maximize outdoor projects before autumn rain' },
    { months: [9, 10, 11, 0, 1, 2], tip: 'Interior season — kitchens, living rooms, and commercial repaints are year-round work' },
    { months: [2, 3], tip: 'Spring rush coming — send quote reminders to last year\'s exterior customers now' },
  ],
  carpentry: [
    { months: [3, 4, 5, 6, 7, 8], tip: 'Renovation peak — decks, extensions, and outdoor structures are in high demand' },
    { months: [9, 10], tip: 'Wrap up outdoor carpentry before winter — focus on weatherproofing and finishing' },
    { months: [11, 0, 1, 2], tip: 'Indoor season — kitchens, built-in wardrobes, and interior trim work' },
    { months: [1, 2], tip: 'Pre-season prep: send quotes for spring renovation projects now to fill the pipeline' },
  ],
  roofing: [
    { months: [2, 3, 4, 5, 6, 7, 8, 9], tip: 'Peak roofing season — schedule flat roof and re-tile projects before autumn storms' },
    { months: [10, 11], tip: 'Storm season approaching — emergency repair demand increases, stock lead and EPDM' },
    { months: [0, 1], tip: 'Winter slowdown — focus on inspections, quotes for spring, and indoor roof-space insulation' },
    { months: [1, 2], tip: 'Pre-season prep: send roof inspection reminders and schedule spring re-roofing projects' },
  ],
  tiling: [
    { months: [8, 9, 10, 11], tip: 'Bathroom renovation season — tiling demand peaks as homeowners prep for winter' },
    { months: [3, 4, 5, 6, 7], tip: 'New-build and renovation season — kitchen and floor tiling in high demand' },
    { months: [0, 1, 2], tip: 'Quieter season — focus on commercial tiling projects and send follow-up quotes' },
  ],
  plastering: [
    { months: [3, 4, 5, 6, 7, 8], tip: 'Construction boom — new-build plastering and renovation skimming peak now' },
    { months: [9, 10, 11, 0, 1, 2], tip: 'Interior season — rendering, skimming, and decorative plasterwork year-round indoors' },
    { months: [1, 2], tip: 'Pre-season: quote for spring renovation plastering projects to fill the pipeline' },
  ],
  flooring: [
    { months: [3, 4, 5], tip: 'Spring moving season — flooring demand peaks with home purchases and renovations' },
    { months: [8, 9, 10], tip: 'Autumn moving season — second peak for flooring installations' },
    { months: [6, 7], tip: 'Summer renovations — engineered wood and LVT popular for holiday home upgrades' },
    { months: [11, 0, 1, 2], tip: 'Quieter months — focus on commercial projects and send quotes for spring installs' },
  ],
  insulation: [
    { months: [0, 1, 2, 3], tip: 'Grant application season — help customers apply for energy efficiency subsidies' },
    { months: [4, 5, 6, 7, 8], tip: 'Peak installation season — cavity wall, loft, and external wall insulation in demand' },
    { months: [9, 10, 11], tip: 'Pre-winter rush — homeowners want insulation before heating season, urgent demand' },
  ],
  solar: [
    { months: [2, 3, 4, 5, 6, 7], tip: 'Peak solar season — longer days mean more installations and better yield demos' },
    { months: [8, 9], tip: 'Post-summer demand — customers who saw high energy bills want solar before winter' },
    { months: [10, 11, 0, 1], tip: 'Off-peak — focus on quotes, battery storage add-ons, and grant applications' },
    { months: [0, 1], tip: 'New year tariff changes — update pricing and check feed-in tariff adjustments' },
  ],
  glazing: [
    { months: [8, 9, 10], tip: 'Energy efficiency season — double glazing demand peaks before winter heating costs' },
    { months: [3, 4, 5, 6, 7], tip: 'Renovation season — window and door replacements for new builds and extensions' },
    { months: [11, 0, 1, 2], tip: 'Emergency glass repairs increase in winter storms — keep toughened glass in stock' },
  ],
  landscaping: [
    { months: [2, 3, 4, 5], tip: 'Spring rush — garden design, planting, and patio projects in highest demand' },
    { months: [6, 7, 8], tip: 'Summer peak — decking, fencing, and outdoor living spaces are top sellers' },
    { months: [9, 10], tip: 'Autumn wrap-up — hardscaping, drainage, and winter prep before ground freezes' },
    { months: [11, 0, 1], tip: 'Winter slowdown — focus on planning, quotes, and indoor hardscape projects' },
  ],
};

const COUNTRY_SEASONAL_NOTES: Record<string, Record<number, string>> = {
  NL: {
    0: 'BTW aangifte Q4 deadline nadert',
    3: 'BTW aangifte Q1 deadline nadert',
    6: 'BTW aangifte Q2 deadline nadert — zomervakantie plannen?',
    9: 'BTW aangifte Q3 deadline nadert',
  },
  DE: {
    0: 'Umsatzsteuervoranmeldung Q4 Frist',
    3: 'Umsatzsteuervoranmeldung Q1 Frist',
    6: 'Umsatzsteuervoranmeldung Q2 Frist',
    9: 'Umsatzsteuervoranmeldung Q3 Frist',
  },
  FR: {
    0: 'Declaration TVA T4 a deposer',
    3: 'Declaration TVA T1 a deposer',
    6: 'Declaration TVA T2 a deposer',
    9: 'Declaration TVA T3 a deposer',
  },
  ES: {},
  IT: {},
  UK: {
    0: 'VAT return Q4 deadline approaching',
    3: 'VAT return Q1 deadline approaching',
    6: 'VAT return Q2 deadline approaching',
    9: 'VAT return Q3 deadline approaching',
  },
};

export function getSeasonalContext(trade: string, country: string): string {
  const month = new Date().getMonth();
  const normalized = trade.toLowerCase().replace(/\s+/g, '');
  const countryUpper = (country || 'NL').toUpperCase();

  // Find the most specific seasonal tip for this trade + month
  const tradeTips = SEASONAL_TIPS[normalized] ?? [];
  const matchingTips = tradeTips.filter(t => t.months.includes(month));
  const tradeTip = matchingTips.length > 0 ? matchingTips[0].tip : '';

  // Add country-specific note if available
  const countryNote = COUNTRY_SEASONAL_NOTES[countryUpper]?.[month] ?? '';

  if (tradeTip && countryNote) {
    return `${tradeTip}. ${countryNote}`;
  }
  return tradeTip || countryNote || '';
}
