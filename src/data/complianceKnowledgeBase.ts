// =============================================================================
// COMPLIANCE KNOWLEDGE BASE — Structured data for EU6 construction compliance
// =============================================================================
// SOURCE OF TRUTH: EU5_Compliance_Bible.txt (src/data/EU5_Compliance_Bible.txt)
// This file extracts and structures the Bible's rules into app-ready data.
// All compliance screens, EVE Auditor, and admin dashboard read from here.
//
// Last synced with Bible: 2026-03-28
// To update: edit EU5_Compliance_Bible.txt, then update this structured extract.
// For live strategy: see docs/live-compliance-strategy.md
// =============================================================================

import {
  ComplianceKnowledgeBase,
  CountryCode,
  LanguageCode,
  LocalizedText,
} from '../domain/complianceKnowledge';

const countryLanguage: Record<CountryCode, LanguageCode> = {
  UK: 'en',
  NL: 'nl',
  DE: 'de',
  FR: 'fr',
  ES: 'es',
  IT: 'it',
};

const mergeLocalization = (
  value: string | undefined,
  localizations: LocalizedText | undefined,
  language: LanguageCode,
): LocalizedText | undefined => {
  if (!value && !localizations) {
    return undefined;
  }
  const next: LocalizedText = { ...(localizations ?? {}) };
  if (value) {
    if (!next.en) {
      next.en = value;
    }
    if (!next[language]) {
      const translated = translationOverrides[language]?.[value];
      next[language] = translated ?? value;
    }
  }
  return next;
};

const translationOverrides: Record<LanguageCode, Record<string, string>> = {
  en: {},
  nl: {
    'Electrician': 'Elektricien',
    'Gas': 'Gas',
    'Plumbing and HVAC': 'Loodgieter en HVAC',
    'Roofing and Envelope': 'Dakbedekking en Gevel',
    'Energy Renovation': 'Energierenovatie',
    'Painting and Decorating': 'Schilderen en Afwerking',
    'Carpentry and Joinery': 'Timmerwerk en Schrijnwerk',
    'Flooring and Tiling': 'Vloeren en Tegelwerk',
    'Plastering and Drywall': 'Stukadoorswerk en Gipsplaten',
    'Glazing and Windows': 'Beglazing en Ramen',
    'Insulation': 'Isolatie',
    'Masonry and Brickwork': 'Metselwerk',
    'Concrete and Structural': 'Beton en Constructie',
    'Demolition and Strip-out': 'Sloop en Strippen',
    'Scaffolding and Work at Height': 'Steigerbouw en Werken op Hoogte',
    'Metalwork and Welding': 'Metaalwerk en Lassen',
    'Waterproofing and Sealants': 'Waterdichting en Kitten',
    'Groundworks and Excavation': 'Grondwerken en Uitgraving',
    'Paving and Landscaping': 'Bestrating en Landschapsinrichting',
    'Fire Protection': 'Brandbeveiliging',
    'Solar and PV': 'Zonne-energie en PV',
    'Elevators and Lifts': 'Liften',
    'Arbowet compliance': 'Arbowet-naleving',
    'Work must comply with Working Conditions Act and risk assessment.':
      'Werk moet voldoen aan de Arbeidsomstandighedenwet en een risico-inventarisatie en -evaluatie.',
    'NEN 1010 compliance': 'NEN 1010-naleving',
    'Low voltage installation standard for design and installation.':
      'Norm voor ontwerp en aanleg van laagspanningsinstallaties.',
    'NEN 3140 compliance': 'NEN 3140-naleving',
    'Safe operation and inspection procedures for electrical installations.':
      'Veilige bedrijfsvoering en inspectieprocedures voor elektrische installaties.',
    'Documentation and handover': 'Documentatie en overdracht',
    'Provide test results, as-built documentation, and user guidance.':
      'Lever testresultaten, as-built documentatie en gebruikersinstructies.',
    'Periodic inspection planning': 'Periodieke inspectieplanning',
    'Define inspection intervals and document NEN 3140 inspection plan.':
      'Bepaal inspectie-intervallen en documenteer het NEN 3140-inspectieplan.',
    'Testing and inspection completed': 'Testen en inspectie voltooid',
    'As-built documentation uploaded': 'As-built-documentatie geüpload',
    'NEN 3140 inspection plan recorded': 'NEN 3140-inspectieplan vastgelegd',
    'Gas work follows safety requirements and NEN standards.':
      'Gaswerkzaamheden volgen veiligheidsvereisten en NEN-normen.',
    'NEN 1078/8078 guidance': 'NEN 1078/8078-richtlijn',
    'Gas pipework guidance via NPR 3378-4.':
      'Richtlijn voor gasleidingen via NPR 3378-4.',
    'Tightness testing and documentation': 'Dichtheidsproef en documentatie',
    'Maintain tightness test and commissioning records.':
      'Onderhoud dichtheidsproef- en inbedrijfstellingsregistraties.',
    'Ventilation and combustion safety': 'Ventilatie en verbrandingsveiligheid',
    'Confirm ventilation and combustion air requirements are met.':
      'Bevestig dat ventilatie- en verbrandingsluchtvereisten zijn gehaald.',
    'Commissioning and safety checks recorded': 'Inbedrijfstelling en veiligheidscontroles vastgelegd',
    'Emergency isolation labeling confirmed': 'Noodafsluiting en labeling bevestigd',
    'Ventilation checks documented': 'Ventilatiecontroles gedocumenteerd',
    'NEN 1006 compliance': 'NEN 1006-naleving',
    'Drinking water installations must meet NEN 1006 requirements.':
      'Drinkwaterinstallaties moeten voldoen aan NEN 1006.',
    'BBL compliance': 'BBL-naleving',
    'Building requirements for installations under BBL.':
      'Bouwregels voor installaties onder het BBL.',
    'F-gas compliance for refrigerants': 'F-gas-naleving voor koelmiddelen',
    'Refrigerant handling requires F-gas certified personnel/company.':
      'Het omgaan met koelmiddelen vereist F-gas-gecertificeerd personeel/bedrijf.',
    'Commissioning and handover': 'Inbedrijfstelling en overdracht',
    'Provide commissioning results and maintenance guidance.':
      'Lever inbedrijfstellingsresultaten en onderhoudsinstructies.',
    'Legionella prevention': 'Legionellapreventie',
    'Apply water hygiene controls and document legionella prevention measures.':
      'Pas waterhygienemaatregelen toe en documenteer legionellapreventie.',
    'Water hygiene and commissioning complete': 'Waterhygiene en inbedrijfstelling voltooid',
    'O&M documents uploaded': 'O&M-documenten geüpload',
    'Legionella controls documented': 'Legionellamaatregelen gedocumenteerd',
    'Roof and envelope must meet BBL requirements.':
      'Dak en gevel moeten voldoen aan BBL-eisen.',
    'Envelope documentation': 'Gevel-/schildocumentatie',
    'Provide as-built details, product approvals, and warranties.':
      'Lever as-built details, productgoedkeuringen en garanties.',
    'Structural and wind loading checks': 'Constructieve en windbelastingcontroles',
    'Confirm structural capacity and wind loading compliance for roof systems.':
      'Bevestig constructieve capaciteit en windbelasting voor daksystemen.',
    'Roof system installed per design': 'Daksysteem volgens ontwerp uitgevoerd',
    'Roof build-up and warranty docs uploaded': 'Dakopbouw- en garantiedocumenten geüpload',
    'Structural and wind load checks recorded': 'Constructieve en windbelastingcontroles vastgelegd',
    'BENG compliance': 'BENG-naleving',
    'Energy performance must meet BENG/BBL requirements.':
      'Energieprestatie moet voldoen aan BENG/BBL-eisen.',
    'Energy documentation and handover': 'Energiedocumentatie en overdracht',
    'Provide calculations, commissioning results, and user guidance.':
      'Lever berekeningen, inbedrijfstellingsresultaten en gebruikersinstructies.',
    'Ventilation provision': 'Ventilatievoorziening',
    'Ensure ventilation performance is documented after retrofit.':
      'Documenteer ventilatieprestaties na renovatie.',
    'BENG impact documented': 'BENG-impact gedocumenteerd',
    'Energy compliance documents uploaded': 'Energiecompliance-documenten geüpload',
    'Ventilation performance recorded': 'Ventilatieprestatie vastgelegd',
    'Hazardous substances and risk assessment required.':
      'Gevaarlijke stoffen en risico-inventarisatie vereist.',
    'Product and waste documentation': 'Product- en afvaldocumentatie',
    'Maintain product data sheets and waste handling records.':
      'Onderhoud productdatasheets en afvalverwerkingsregistraties.',
    'RI and E with hazardous substances': 'RI&E met gevaarlijke stoffen',
    'SDS for coatings': 'SDS voor coatings',
    'PPE and ventilation in place': 'PBM en ventilatie aanwezig',
    'Waste handling recorded': 'Afvalverwerking vastgelegd',
    'Wood dust controls required.': 'Houtstofbeheersing vereist.',
    'Material documentation': 'Materiaaldocumentatie',
    'Record timber treatment and fixings used.':
      'Leg houtbehandeling en gebruikte bevestigingen vast.',
    'RI and E for dust/manual handling': 'RI&E voor stof/handmatige handling',
    'Dust extraction active': 'Stofafzuiging actief',
    'Material approvals uploaded': 'Materiaalgoedkeuringen geüpload',
    'Silica dust and adhesives controls.': 'Beheersing van kwartsstof en lijmen.',
    'Subfloor documentation': 'Ondergrond-documentatie',
    'Record subfloor condition and moisture tests.':
      'Leg ondergrondconditie en vochtmetingen vast.',
    'SDS for adhesives/grouts': 'SDS voor lijmen/voegen',
    'Dust controls active': 'Stofbeheersing actief',
    'Moisture test results uploaded': 'Vochtmeetresultaten geüpload',
    'Dust controls required.': 'Stofbeheersing vereist.',
    'Surface preparation documentation': 'Documentatie van ondergrondvoorbereiding',
    'Record surface prep and finish specification.':
      'Leg ondergrondvoorbereiding en afwerkspecificatie vast.',
    'SDS for compounds': 'SDS voor compounds',
    'Surface prep recorded': 'Ondergrondvoorbereiding vastgelegd',
    'Manual handling and sealant safety.':
      'Handmatige handling en kitveiligheid.',
    'Safety glazing documentation': 'Documentatie veiligheidsglas',
    'Record safety glass specification and location.':
      'Leg veiligheidsglasspecificatie en locatie vast.',
    'SDS for sealants': 'SDS voor kitten',
    'Safe handling plan in place': 'Veilig hanteerplan aanwezig',
    'Safety glass schedule uploaded': 'Veiligheidsglasschema geüpload',
    'Fiber exposure controls required.': 'Beheersing van vezelblootstelling vereist.',
    'Thermal performance documentation': 'Documentatie thermische prestatie',
    'Record insulation type, thickness, and performance values.':
      'Leg isolatietype, dikte en prestatie vast.',
    'SDS for insulation products': 'SDS voor isolatieproducten',
    'PPE and dust control in place': 'PBM en stofbeheersing aanwezig',
    'Insulation specs recorded': 'Isolatiespecificaties vastgelegd',
    'Cement and silica dust controls.': 'Beheersing van cement- en kwartsstof.',
    'Record mortar mix and masonry materials used.':
      'Leg mortelmix en metselmaterialen vast.',
    'SDS for mortar/cement': 'SDS voor mortel/cement',
    'Mortar mix recorded': 'Mortelmix vastgelegd',
    'Wet cement controls required.': 'Beheersing van nat cement vereist.',
    'Pour and curing records': 'Stort- en curingregistraties',
    'Maintain pour logs and curing/strength records.':
      'Onderhoud stortlogboeken en curing/sterkteregistraties.',
    'SDS for cement/admixtures': 'SDS voor cement/toevoegingen',
    'PPE and wash stations in place': 'PBM en wasstations aanwezig',
    'Pour log uploaded': 'Stortlogboek geüpload',
    'Demolition hazards and dust controls required.':
      'Sloopgevaren en stofbeheersing vereist.',
    'Survey and waste documentation': 'Inventarisatie- en afvaldocumentatie',
    'Maintain survey records and waste transfer documentation.':
      'Onderhoud inventarisaties en afvaltransportdocumenten.',
    'Waste disposal records': 'Afvalverwerkingsregistraties',
    'Demolition risk assessment complete': 'Sloop-risicoanalyse voltooid',
    'Waste transfer docs uploaded': 'Afvaltransportdocumenten geüpload',
    'Work at height controls required.': 'Beheersing van werken op hoogte vereist.',
    'Inspection and tag documentation': 'Inspectie- en tagdocumentatie',
    'Maintain inspection records and tagging status.':
      'Onderhoud inspectieregistraties en tagstatus.',
    'Scaffold inspection log': 'Steigerinspectielog',
    'Scaffold inspected before use': 'Steiger geinspecteerd voor gebruik',
    'Daily pre-use checks recorded': 'Dagelijkse voorgebruikcontroles vastgelegd',
    'Welding fume controls required.': 'Beheersing van lasrook vereist.',
    'Welding procedure documentation': 'Lasprocedure-documentatie',
    'Maintain welding procedures and material traceability.':
      'Onderhoud lasprocedures en materiaaltraceerbaarheid.',
    'Extraction and PPE plan': 'Afzuig- en PBM-plan',
    'Hot works permit': 'Heetwerkvergunning',
    'Hot works controls active': 'Heetwerkmaatregelen actief',
    'Welding procedure uploaded': 'Lasprocedure geüpload',
    'Sealant and solvent controls required.':
      'Beheersing van kitten en oplosmiddelen vereist.',
    'Waterproofing documentation': 'Documentatie waterdichting',
    'Maintain product approvals and testing records.':
      'Onderhoud productgoedkeuringen en testregistraties.',
    'Ventilation in place': 'Ventilatie aanwezig',
    'Waterproofing test recorded': 'Waterdichtheidstest vastgelegd',
    'Excavation safety controls required.':
      'Veiligheidsmaatregelen voor graafwerk vereist.',
    'Permit and shoring documentation': 'Vergunning- en beschoeiingsdocumentatie',
    'Maintain permits, shoring designs, and inspections.':
      'Onderhoud vergunningen, beschoeiingsontwerpen en inspecties.',
    'Utility locate and permit to dig': 'Kabels/leidingen lokaliseren en graafvergunning',
    'Utilities located and marked': 'Kabels/leidingen gelokaliseerd en gemarkeerd',
    'Permit and inspection docs uploaded': 'Vergunning- en inspectiedocumenten geüpload',
    'Equipment and chemical safety controls required.':
      'Beheersing van apparatuur en chemicaliën vereist.',
    'Drainage and falls documentation': 'Documentatie afwatering en afschot',
    'Record drainage design, falls, and sub-base preparation.':
      'Leg afwateringsontwerp, afschot en funderingslaag vast.',
    'PPE and equipment checks': 'PBM- en apparatuurscontroles',
    'Safe work setup confirmed': 'Veilige werkopstelling bevestigd',
    'Drainage falls recorded': 'Afschot vastgelegd',
    'Fire safety compliance': 'Brandveiligheidsnaleving',
    'Fire system documentation': 'Documentatie brandbeveiligingssysteem',
    'Maintain product certifications and commissioning data.':
      'Onderhoud productcertificeringen en inbedrijfstellingsgegevens.',
    'Tested system installation': 'Installatie volgens getest systeem',
    'Install fire stopping to tested system details and manufacturer guidance.':
      'Installeer brandwering volgens getest systeem en fabrikantvoorschrift.',
    'Fire system commissioning certificates': 'Inbedrijfstellingscertificaten brandbeveiliging',
    'Fire system installed per spec': 'Brandbeveiliging volgens specificatie geplaatst',
    'Fire system docs uploaded': 'Brandbeveiligingsdocumenten geüpload',
    'Fire stopping photo evidence captured': 'Foto-evidence brandwering vastgelegd',
    'PV documentation and handover': 'PV-documentatie en overdracht',
    'Provide commissioning results, inverter settings, and O&M manuals.':
      'Lever inbedrijfstellingsresultaten, omvormerinstellingen en O&M-handleidingen.',
    'Grid connection compliance': 'Netkoppeling naleving',
    'Record distribution grid notifications or approvals where required.':
      'Leg netbeheerdermeldingen of goedkeuringen vast waar vereist.',
    'PV commissioning certificate': 'PV-inbedrijfstellingscertificaat',
    'Electrical signoff completed': 'Elektrische oplevering voltooid',
    'PV commissioning and O&M pack uploaded': 'PV-inbedrijfstelling en O&M-pakket geüpload',
    'Grid notification recorded': 'Netmelding vastgelegd',
    'Lift safety compliance': 'Liftveiligheidsnaleving',
    'Lift handover and maintenance documentation':
      'Lift-oplevering en onderhoudsdocumentatie',
    'Provide commissioning, inspection, and maintenance handover records.':
      'Lever inbedrijfstelling, inspectie en onderhoudsoverdracht.',
    'Ensure periodic inspection schedule is documented and followed.':
      'Zorg dat periodieke inspectieplanning is vastgelegd en gevolgd.',
    'Installation certificate': 'Installatiecertificaat',
    'Periodic inspection logs': 'Periodieke inspectielogboeken',
    'Commissioning completed': 'Inbedrijfstelling voltooid',
    'Maintenance handover uploaded': 'Onderhoudsoverdracht geüpload',
    'Inspection schedule recorded': 'Inspectieplanning vastgelegd',
    'KVK registration check': 'KVK-registratiecontrole',
    'Validate company registration in KVK.':
      'Valideer bedrijfsregistratie in de KVK.',
    'KVK number': 'KVK-nummer',
    'Registration status': 'Registratiestatus',
    'Legal form': 'Rechtsvorm',
    'Registered address': 'Geregistreerd adres',
    'VCA certificate check': 'VCA-certificaatcontrole',
    'Verify VCA diploma or certificate validity.':
      'Verifieer geldigheid van VCA-diploma of certificaat.',
    'Diploma number': 'Diplomanummer',
    'Holder name': 'Naam houder',
    'Date of birth': 'Geboortedatum',
    'Certificate status': 'Certificaatstatus',
    'Certificate type': 'Certificaattype',
    'Valid until': 'Geldig tot',
    'F-gas certification check': 'F-gas-certificatiecontrole',
    'Verify company and personnel F-gas certification for refrigerants.':
      'Verifieer F-gas-certificering van bedrijf en personeel.',
    'Company registration number': 'Bedrijfsregistratienummer',
    'Certified personnel ID': 'ID gecertificeerd personeel',
    'Certification status': 'Certificeringsstatus',
    'Scope/category': 'Scope/categorie',
    'Expiry date': 'Vervaldatum',
  },
  de: {
    'Electrician': 'Elektriker',
    'Gas': 'Gas',
    'Plumbing and HVAC': 'Sanitär und HLK',
    'Roofing and Envelope': 'Dach und Gebäudehülle',
    'Energy Renovation': 'Energiesanierung',
    'Painting and Decorating': 'Maler- und Lackierarbeiten',
    'Carpentry and Joinery': 'Zimmerei und Tischlerei',
    'Flooring and Tiling': 'Bodenbeläge und Fliesen',
    'Plastering and Drywall': 'Putz und Trockenbau',
    'Glazing and Windows': 'Verglasung und Fenster',
    'Insulation': 'Dämmung',
    'Masonry and Brickwork': 'Mauerwerk',
    'Concrete and Structural': 'Beton und Tragwerk',
    'Demolition and Strip-out': 'Abbruch und Rückbau',
    'Scaffolding and Work at Height': 'Gerüstbau und Arbeiten in der Höhe',
    'Metalwork and Welding': 'Metallbau und Schweißen',
    'Waterproofing and Sealants': 'Abdichtung und Dichtstoffe',
    'Groundworks and Excavation': 'Tiefbau und Erdarbeiten',
    'Paving and Landscaping': 'Pflaster- und Landschaftsbau',
    'Fire Protection': 'Brandschutz',
    'Solar and PV': 'Solar und PV',
    'Elevators and Lifts': 'Aufzüge und Lifte',
    'Handwerksrolle registration': 'Handwerksrolle-Registrierung',
    'Electrical trade is regulated and requires Handwerksrolle registration.':
      'Das Elektrohandwerk ist reglementiert und erfordert die Eintragung in die Handwerksrolle.',
    'DIN VDE 0100 compliance': 'DIN VDE 0100-Konformität',
    'Low voltage installations must follow DIN VDE 0100 series.':
      'Niederspannungsanlagen müssen der DIN VDE 0100-Reihe entsprechen.',
    'Documentation and handover': 'Dokumentation und Übergabe',
    'Provide test results, as-built documentation, and user guidance.':
      'Stellen Sie Prüfergebnisse, Bestandsdokumentation (As-Built) und Benutzerhinweise bereit.',
    'VDE testing and inspection': 'VDE-Prüfung und Inspektion',
    'Perform and document installation testing in line with VDE requirements.':
      'Führen Sie Installationsprüfungen gemäß VDE durch und dokumentieren Sie diese.',
    'Testing and documentation complete': 'Prüfung und Dokumentation abgeschlossen',
    'As-built documentation uploaded': 'Bestandsdokumentation (As-Built) hochgeladen',
    'VDE test results uploaded': 'VDE-Prüfergebnisse hochgeladen',
    'DVGW/TRGI compliance': 'DVGW/TRGI-Konformität',
    'Gas installations must follow DVGW/TRGI rules.':
      'Gasinstallationen müssen den DVGW/TRGI-Regeln folgen.',
    'Tightness testing and documentation': 'Dichtheitsprüfung und Dokumentation',
    'Maintain tightness test and commissioning records.':
      'Dichtheitsprüfungen und Inbetriebnahmeprotokolle dokumentieren.',
    'Ventilation and combustion safety': 'Lüftung und Verbrennungssicherheit',
    'Confirm ventilation and combustion air requirements are met.':
      'Bestätigen Sie, dass Lüftungs- und Verbrennungsluftanforderungen erfüllt sind.',
    'Commissioning tests recorded': 'Inbetriebnahmeprüfungen dokumentiert',
    'Emergency isolation labeling confirmed': 'Notabschaltung und Kennzeichnung bestätigt',
    'Ventilation checks documented': 'Lüftungsprüfungen dokumentiert',
    'TRWI compliance': 'TRWI-Konformität',
    'Drinking water installations follow DIN EN 806 and DIN 1988 (TRWI).':
      'Trinkwasserinstallationen folgen DIN EN 806 und DIN 1988 (TRWI).',
    'F-gas compliance for refrigerants': 'F-Gas-Konformität für Kältemittel',
    'Refrigerant handling requires F-gas certified personnel/company.':
      'Der Umgang mit Kältemitteln erfordert F-Gas-zertifiziertes Personal/Firma.',
    'Commissioning and handover': 'Inbetriebnahme und Übergabe',
    'Provide commissioning results and maintenance guidance.':
      'Stellen Sie Inbetriebnahmeergebnisse und Wartungshinweise bereit.',
    'Water hygiene controls': 'Wasserhygienemaßnahmen',
    'Document water hygiene and legionella prevention measures.':
      'Dokumentieren Sie Wasserhygiene- und Legionellenpräventionsmaßnahmen.',
    'Hot water hygiene controls confirmed': 'Warmwasserhygiene-Maßnahmen bestätigt',
    'O&M documents uploaded': 'Betriebs- und Wartungsunterlagen hochgeladen',
    'Water hygiene controls documented': 'Wasserhygiene-Maßnahmen dokumentiert',
    'LBO/MBO compliance': 'LBO/MBO-Konformität',
    'Roofing must comply with state building codes.':
    'Dacharbeiten müssen den Landesbauordnungen entsprechen.',
    'GEG energy compliance': 'GEG-Energieanforderungen',
    'Insulation and energy performance must meet GEG.':
    'Dämmung und Energieperformance müssen dem GEG entsprechen.',
    'Envelope documentation': 'Dokumentation Gebäudehülle',
    'Provide as-built details, product approvals, and warranties.':
      'Stellen Sie As-Built-Details, Produktzulassungen und Garantien bereit.',
    'Structural and wind loading checks': 'Statische und Windlastprüfungen',
    'Confirm structural capacity and wind loading compliance for roof systems.':
      'Bestätigen Sie statische Tragfähigkeit und Windlasten für Dächer.',
    'Roof system installed per approved design':
      'Dachsystem gemäß genehmigtem Entwurf installiert',
    'Roof build-up and warranty docs uploaded':
      'Dachaufbau- und Garantiedokumente hochgeladen',
    'Structural and wind load checks recorded':
      'Statische und Windlastprüfungen dokumentiert',
    'GEG compliance': 'GEG-Konformität',
    'Energy renovation must meet GEG requirements.':
      'Energiesanierung muss GEG-Anforderungen erfüllen.',
    'Energy documentation and handover': 'Energiedokumentation und Übergabe',
    'Provide calculations, commissioning results, and user guidance.':
      'Stellen Sie Berechnungen, Inbetriebnahmeergebnisse und Benutzerhinweise bereit.',
    'Ventilation provision': 'Lüftungsanforderungen',
    'Ensure ventilation performance is documented after retrofit.':
      'Stellen Sie sicher, dass die Lüftungsleistung nach Sanierung dokumentiert ist.',
    'GEG documentation complete': 'GEG-Dokumentation abgeschlossen',
    'Energy compliance documents uploaded':
      'Energie-Konformitätsdokumente hochgeladen',
    'Ventilation performance recorded': 'Lüftungsleistung dokumentiert',
    'GefStoffV compliance': 'GefStoffV-Konformität',
    'Hazardous substances controls required.':
      'Kontrollen für Gefahrstoffe sind erforderlich.',
    'Product and waste documentation': 'Produkt- und Abfalldokumentation',
    'Maintain product data sheets and waste handling records.':
      'Produktdatenblätter und Entsorgungsnachweise pflegen.',
    'SDS for coatings': 'SDS für Beschichtungen',
    'PPE and ventilation in place': 'PSA und Lüftung vorhanden',
    'Waste handling recorded': 'Abfallentsorgung dokumentiert',
    'Wood dust controls required.': 'Holzstaubkontrollen erforderlich.',
    'Material documentation': 'Materialdokumentation',
    'Record timber treatment and fixings used.':
      'Holzbehandlung und verwendete Befestigungen dokumentieren.',
    'Dust control plan': 'Staubschutzplan',
    'Dust controls active': 'Staubschutz aktiv',
    'Material approvals uploaded': 'Materialfreigaben hochgeladen',
    'Silica dust and adhesives controls.':
      'Kontrollen für Quarzstaub und Klebstoffe.',
    'Subfloor documentation': 'Untergrunddokumentation',
    'Record subfloor condition and moisture tests.':
      'Untergrundzustand und Feuchtemessungen dokumentieren.',
    'SDS for adhesives': 'SDS für Klebstoffe',
    'Moisture test results uploaded': 'Feuchtemessungen hochgeladen',
    'Dust controls required.': 'Staubschutz erforderlich.',
    'Surface preparation documentation': 'Dokumentation der Untergrundvorbereitung',
    'Record surface prep and finish specification.':
      'Untergrundvorbereitung und Endbeschichtung dokumentieren.',
    'SDS for compounds': 'SDS für Spachtelmassen',
    'Surface prep recorded': 'Untergrundvorbereitung dokumentiert',
    'Sealant and handling safety.': 'Dichtstoff- und Handhabungssicherheit.',
    'Safety glazing documentation': 'Dokumentation Sicherheitsverglasung',
    'Record safety glass specification and location.':
      'Sicherheitsglas-Spezifikation und Einbauort dokumentieren.',
    'SDS for sealants': 'SDS für Dichtstoffe',
    'Safe handling plan in place': 'Sicherer Handhabungsplan vorhanden',
    'Safety glass schedule uploaded': 'Sicherheitsglasplan hochgeladen',
    'Fiber exposure controls.': 'Kontrollen für Faserexposition.',
    'Thermal performance documentation': 'Dokumentation der Wärmeleistung',
    'Record insulation type, thickness, and performance values.':
    'Dämmtyp, -dicke und Leistungswerte dokumentieren.',
    'SDS for insulation products': 'SDS für Dämmstoffe',
    'PPE and dust control in place': 'PSA und Staubschutz vorhanden',
    'Insulation specs recorded': 'Dämmspezifikationen dokumentiert',
    'Cement and silica dust controls.': 'Kontrollen für Zement- und Quarzstaub.',
    'Record mortar mix and masonry materials used.':
      'Mörtelmischung und Mauerwerksmaterialien dokumentieren.',
    'SDS for mortar/cement': 'SDS für Mörtel/Zement',
    'Mortar mix recorded': 'Mörtelmischung dokumentiert',
    'Wet cement controls.': 'Kontrollen für Nasszement.',
    'Pour and curing records': 'Guss- und Nachbehandlungsprotokolle',
    'Maintain pour logs and curing/strength records.':
      'Gussprotokolle und Nachbehandlungs/Festigkeitsnachweise pflegen.',
    'SDS for cement/admixtures': 'SDS für Zement/Zusatzmittel',
    'PPE and wash stations in place': 'PSA und Waschstationen vorhanden',
    'Pour log uploaded': 'Gussprotokoll hochgeladen',
    'Demolition dust and hazardous materials controls.':
      'Kontrollen für Abbruchstaub und Gefahrstoffe.',
    'Survey and waste documentation': 'Bestands- und Abfalldokumentation',
    'Maintain survey records and waste transfer documentation.':
      'Bestandsunterlagen und Abfallübergaben dokumentieren.',
    'Waste disposal records': 'Abfallentsorgungsnachweise',
    'Demolition risk assessment complete': 'Abbruch-Risikoanalyse abgeschlossen',
    'Waste transfer docs uploaded': 'Abfallübergabedokumente hochgeladen',
    'Work at height controls': 'Arbeiten-in-der-Höhe-Maßnahmen',
    'Scaffold inspection and safety controls required.':
      'Gerüstprüfung und Sicherheitsmaßnahmen erforderlich.',
    'Inspection and tag documentation': 'Prüf- und Kennzeichnungsdokumentation',
    'Maintain inspection records and tagging status.':
      'Prüfprotokolle und Kennzeichnungsstatus pflegen.',
    'Scaffold inspection log': 'Gerüstprüfprotokoll',
    'Scaffold inspected before use': 'Gerüst vor Nutzung geprüft',
    'Daily pre-use checks recorded': 'Tägliche Vorbenutzungsprüfungen dokumentiert',
    'Welding fume controls required.': 'Schweißrauchkontrollen erforderlich.',
    'Welding procedure documentation': 'Schweißverfahrensdokumentation',
    'Maintain welding procedures and material traceability.':
      'Schweißverfahren und Materialrückverfolgbarkeit dokumentieren.',
    'Extraction and PPE plan': 'Absaug- und PSA-Plan',
    'Hot works permit': 'Erlaubnis für Heißarbeiten',
    'Hot works controls active': 'Heißarbeitsmaßnahmen aktiv',
    'Welding procedure uploaded': 'Schweißverfahren hochgeladen',
    'Sealant and solvent controls.': 'Dichtstoff- und Lösemittelkontrollen.',
    'Waterproofing documentation': 'Abdichtungsdokumentation',
    'Maintain product approvals and testing records.':
      'Produktzulassungen und Prüfnachweise pflegen.',
    'Ventilation in place': 'Lüftung vorhanden',
    'Waterproofing test recorded': 'Abdichtungsprüfung dokumentiert',
    'Excavation safety controls': 'Maßnahmen für Aushubsicherheit',
    'Risk assessment and utility avoidance required.':
      'Gefährdungsbeurteilung und Leitungsvermeidung erforderlich.',
    'Permit and shoring documentation': 'Genehmigungs- und Verbau-Dokumentation',
    'Maintain permits, shoring designs, and inspections.':
      'Genehmigungen, Verbaupläne und Inspektionen dokumentieren.',
    'Utility locate and permit to dig': 'Leitungsauskunft und Grabgenehmigung',
    'Utilities located and marked': 'Leitungen geortet und markiert',
    'Permit and inspection docs uploaded': 'Genehmigungs- und Prüfdokumente hochgeladen',
    'Chemical and equipment safety controls.':
      'Kontrollen für Chemikalien und Ausrüstung.',
    'Drainage and falls documentation': 'Entwässerungs- und Gefälledokumentation',
    'Record drainage design, falls, and sub-base preparation.':
      'Entwässerung, Gefälle und Unterbau dokumentieren.',
    'PPE and equipment checks': 'PSA- und Ausrüstungsprüfungen',
    'Safe work setup confirmed': 'Sichere Arbeitsumgebung bestätigt',
    'Drainage falls recorded': 'Gefälle dokumentiert',
    'Fire safety compliance': 'Brandschutzkonformität',
    'Fire system documentation': 'Brandschutzdokumentation',
    'Maintain product certifications and commissioning data.':
      'Produktzertifikate und Inbetriebnahmedaten pflegen.',
    'Tested system installation': 'Installation nach geprüftem System',
    'Install fire stopping to tested system details and manufacturer guidance.':
      'Brandschutzabschottung gemäß geprüftem System und Herstellerangaben installieren.',
    'Fire stopping approvals/certifications': 'Brandschutz-Zulassungen/Zertifikate',
    'Fire system installed per spec': 'Brandschutzsystem gemäß Spezifikation installiert',
    'Fire system docs uploaded': 'Brandschutzdokumente hochgeladen',
    'Fire stopping photo evidence captured': 'Foto-Nachweis der Abschottung erfasst',
    'PV documentation and handover': 'PV-Dokumentation und Übergabe',
    'Provide commissioning results, inverter settings, and O&M manuals.':
      'Stellen Sie Inbetriebnahmeergebnisse, Wechselrichtereinstellungen und O&M-Handbücher bereit.',
    'Grid connection compliance': 'Netzanschluss-Konformität',
    'Record distribution grid notifications or approvals where required.':
      'Netzmeldungen oder Genehmigungen dokumentieren, falls erforderlich.',
    'PV commissioning certificate': 'PV-Inbetriebnahmezertifikat',
    'Electrical signoff completed': 'Elektrische Abnahme abgeschlossen',
    'PV commissioning and O&M pack uploaded':
      'PV-Inbetriebnahme und O&M-Paket hochgeladen',
    'Grid notification recorded': 'Netzmeldung dokumentiert',
    'Lift safety compliance': 'Aufzugs-Sicherheitskonformität',
    'Lift handover and maintenance documentation':
      'Aufzugsübergabe und Wartungsdokumentation',
    'Provide commissioning, inspection, and maintenance handover records.':
    'Inbetriebnahme-, Prüf- und Wartungsübergaben bereitstellen.',
    'Periodic inspection planning': 'Periodische Prüfplanung',
    'Ensure periodic inspection schedule is documented and followed.':
    'Stellen Sie sicher, dass Prüfpläne dokumentiert und eingehalten werden.',
    'Installation certificate': 'Installationszertifikat',
    'Periodic inspection logs': 'Periodische Prüfprotokolle',
    'Commissioning completed': 'Inbetriebnahme abgeschlossen',
    'Maintenance handover uploaded': 'Wartungsübergabe hochgeladen',
    'Inspection schedule recorded': 'Prüfplan dokumentiert',
    'Handwerksrolle registration check': 'Handwerksrolle-Registrierungsprüfung',
    'Verify company registration for regulated trades.':
      'Unternehmensregistrierung für reglementierte Gewerke prüfen.',
    'Company name': 'Firmenname',
    'Registration status': 'Registrierungsstatus',
    'Registered trade': 'Eingetragenes Gewerk',
    'Responsible chamber': 'Zuständige Kammer',
    'DVGW/TRGI verification': 'DVGW/TRGI-Prüfung',
    'Verify gas installation qualification and scope.':
      'Gasinstallationsqualifikation und -umfang prüfen.',
    'Registration ID': 'Registrierungs-ID',
    'Qualification status': 'Qualifikationsstatus',
    'Scope of gas work': 'Umfang der Gasarbeiten',
    'Valid until': 'Gültig bis',
  },
  fr: {
    'Electrician': 'Électricien',
    'Gas': 'Gaz',
    'Plumbing and HVAC': 'Plomberie et CVC',
    'Roofing and Envelope': 'Toiture et Enveloppe',
    'Energy Renovation': 'Rénovation énergétique',
    'Painting and Decorating': 'Peinture et Décoration',
    'Carpentry and Joinery': 'Menuiserie',
    'Flooring and Tiling': 'Revêtements de sol et Carrelage',
    'Plastering and Drywall': 'Plâtrerie et Plaques de plâtre',
    'Glazing and Windows': 'Vitrage et Fenêtres',
    'Insulation': 'Isolation',
    'Masonry and Brickwork': 'Maçonnerie',
    'Concrete and Structural': 'Béton et Structure',
    'Demolition and Strip-out': 'Démolition et Curage',
    'Scaffolding and Work at Height': 'Échafaudage et Travail en hauteur',
    'Metalwork and Welding': 'Métallerie et Soudage',
    'Waterproofing and Sealants': 'Étanchéité et Joints',
    'Groundworks and Excavation': 'Terrassement et Excavation',
    'Paving and Landscaping': 'Voirie et Paysagisme',
    'Fire Protection': 'Protection incendie',
    'Solar and PV': 'Solaire et PV',
    'Elevators and Lifts': 'Ascenseurs',
    'NF C 15-100 compliance': 'Conformité NF C 15-100',
    'Low voltage installations must meet NF C 15-100.':
      'Les installations basse tension doivent respecter la NF C 15-100.',
    'CONSUEL attestation': 'Attestation CONSUEL',
    'Conformity attestation required before first energization.':
      'Attestation de conformité requise avant la première mise sous tension.',
    'Documentation and handover': 'Documentation et remise',
    'Provide test results, as-built documentation, and user guidance.':
      'Fournir les résultats d’essais, la documentation « tel que construit » et les consignes utilisateur.',
    'Testing and conformity': 'Essais et conformité',
    'Perform and document installation testing per NF C 15-100 and CONSUEL requirements.':
      'Réaliser et documenter les essais selon NF C 15-100 et CONSUEL.',
    'Testing and conformity documents prepared':
      'Documents d’essais et de conformité préparés',
    'As-built documentation uploaded': 'Documentation « tel que construit » téléversée',
    'CONSUEL dossier prepared and recorded':
      'Dossier CONSUEL préparé et enregistré',
    'NF DTU 61.1 compliance': 'Conformité NF DTU 61.1',
    'Domestic gas installations must follow NF DTU 61.1.':
      'Les installations gaz domestiques doivent respecter la NF DTU 61.1.',
    'Tightness testing and documentation':
      'Essais d’étanchéité et documentation',
    'Maintain tightness test and commissioning records.':
      'Tenir les essais d’étanchéité et les procès-verbaux de mise en service.',
    'Ventilation and combustion safety':
      'Sécurité ventilation et combustion',
    'Confirm ventilation and combustion air requirements are met.':
      'Confirmer que les exigences de ventilation et d’air de combustion sont respectées.',
    'Commissioning checks recorded': 'Contrôles de mise en service enregistrés',
    'Emergency isolation labeling confirmed':
      'Signalisation des coupures d’urgence confirmée',
    'Ventilation checks documented': 'Contrôles de ventilation documentés',
    'NF DTU 60.1 compliance': 'Conformité NF DTU 60.1',
    'Plumbing installations must follow NF DTU 60.1.':
      'Les installations de plomberie doivent respecter la NF DTU 60.1.',
    'F-gas compliance for refrigerants':
      'Conformité F-gaz pour les fluides frigorigènes',
    'Refrigerant handling requires F-gas certified personnel/company.':
      'La manipulation des fluides frigorigènes requiert une certification F-gaz.',
    'Commissioning and handover': 'Mise en service et remise',
    'Provide commissioning results and maintenance guidance.':
      'Fournir les résultats de mise en service et les consignes de maintenance.',
    'Water hygiene controls': 'Contrôles d’hygiène de l’eau',
    'Document water hygiene and legionella prevention measures.':
      'Documenter les mesures d’hygiène de l’eau et de prévention de la légionelle.',
    'Hot water safety controls verified':
      'Contrôles de sécurité eau chaude vérifiés',
    'O&M documents uploaded': 'Documents d’exploitation et de maintenance téléversés',
    'Water hygiene controls documented':
      'Mesures d’hygiène de l’eau documentées',
    'NF DTU roofing compliance': 'Conformité NF DTU toiture',
    'Roofing must follow relevant NF DTU rules.':
      'La toiture doit respecter les règles NF DTU applicables.',
    'Envelope documentation': 'Documentation enveloppe',
    'Provide as-built details, product approvals, and warranties.':
      'Fournir les détails as-built, agréments produits et garanties.',
    'Structural and wind loading checks':
      'Vérifications structurelles et de charges de vent',
    'Confirm structural capacity and wind loading compliance for roof systems.':
      'Confirmer la capacité structurelle et les charges de vent.',
    'Roof system installed per DTU':
      'Système de toiture posé selon DTU',
    'Roof build-up and warranty docs uploaded':
      'Composition de toiture et garanties téléversées',
    'Structural and wind load checks recorded':
      'Vérifications structurelles et charges de vent enregistrées',
    'RE2020 compliance': 'Conformité RE2020',
    'Energy and environmental requirements for new construction.':
      'Exigences énergétiques et environnementales pour les constructions neuves.',
    'Energy documentation and handover':
      'Documentation énergétique et remise',
    'Provide calculations, commissioning results, and user guidance.':
      'Fournir les calculs, résultats de mise en service et consignes utilisateur.',
    'Ventilation provision': 'Ventilation',
    'Ensure ventilation performance is documented after retrofit.':
      'S’assurer que la performance de ventilation est documentée après rénovation.',
    'RE2020 or energy documentation complete':
      'Documentation RE2020 ou énergétique complète',
    'Energy compliance documents uploaded':
      'Documents de conformité énergétique téléversés',
    'Ventilation performance recorded':
      'Performance de ventilation enregistrée',
    'DUERP risk assessment': 'Évaluation des risques DUERP',
    'Risk assessment for paints and solvents required.':
      'Évaluation des risques pour peintures et solvants requise.',
    'Product and waste documentation': 'Documentation produits et déchets',
    'Maintain product data sheets and waste handling records.':
      'Tenir les fiches produits et les registres de gestion des déchets.',
    'SDS for coatings': 'FDS pour revêtements',
    'PPE and ventilation in place': 'EPI et ventilation en place',
    'Waste handling recorded': 'Gestion des déchets enregistrée',
    'Dust and manual handling risks assessed.':
      'Risques de poussières et de manutention évalués.',
    'Material documentation': 'Documentation matériaux',
    'Record timber treatment and fixings used.':
      'Documenter le traitement du bois et les fixations utilisées.',
    'Dust control plan': 'Plan de maîtrise des poussières',
    'Dust controls active': 'Maîtrise des poussières active',
    'Material approvals uploaded': 'Agréments matériaux téléversés',
    'Silica dust and adhesives controls.':
      'Maîtrise des poussières de silice et des colles.',
    'Subfloor documentation': 'Documentation du support',
    'Record subfloor condition and moisture tests.':
      'Documenter l’état du support et les tests d’humidité.',
    'SDS for adhesives': 'FDS pour colles',
    'Moisture test results uploaded':
      'Résultats des tests d’humidité téléversés',
    'Dust controls required.': 'Maîtrise des poussières requise.',
    'Surface preparation documentation':
      'Documentation de préparation des surfaces',
    'Record surface prep and finish specification.':
      'Documenter la préparation de surface et la finition.',
    'SDS for compounds': 'FDS pour enduits',
    'Surface prep recorded': 'Préparation de surface enregistrée',
    'Handling and sealant risks assessed.':
      'Risques de manutention et de mastic évalués.',
    'Safety glazing documentation': 'Documentation vitrage de sécurité',
    'Record safety glass specification and location.':
      'Documenter la spécification et l’emplacement du vitrage de sécurité.',
    'SDS for sealants': 'FDS pour mastics',
    'Safe handling plan in place': 'Plan de manutention sécurisée en place',
    'Safety glass schedule uploaded':
      'Plan de vitrage de sécurité téléversé',
    'Fiber exposure controls required.':
      'Contrôles d’exposition aux fibres requis.',
    'Thermal performance documentation':
      'Documentation de performance thermique',
    'Record insulation type, thickness, and performance values.':
      'Documenter le type d’isolant, l’épaisseur et les performances.',
    'SDS for insulation products': 'FDS pour produits isolants',
    'PPE and dust control in place': 'EPI et maîtrise des poussières en place',
    'Insulation specs recorded': 'Spécifications d’isolant enregistrées',
    'Cement and silica dust controls.':
      'Maîtrise des poussières de ciment et de silice.',
    'Record mortar mix and masonry materials used.':
      'Documenter le dosage du mortier et les matériaux de maçonnerie.',
    'SDS for mortar/cement': 'FDS pour mortier/ciment',
    'Mortar mix recorded': 'Dosage du mortier enregistré',
    'Wet cement controls required.':
      'Maîtrise du ciment humide requise.',
    'Pour and curing records': 'Enregistrements de coulage et cure',
    'Maintain pour logs and curing/strength records.':
      'Tenir les journaux de coulage et les résultats de cure/résistance.',
    'SDS for cement/admixtures': 'FDS pour ciment/adjuvants',
    'PPE and wash stations in place': 'EPI et postes de lavage en place',
    'Pour log uploaded': 'Journal de coulage téléversé',
    'Demolition hazards and dust controls required.':
      'Risques de démolition et maîtrise des poussières requis.',
    'Survey and waste documentation': 'Documentation relevés et déchets',
    'Maintain survey records and waste transfer documentation.':
      'Tenir les relevés et les bordereaux de suivi des déchets.',
    'Waste disposal records': 'Registres d’évacuation des déchets',
    'Demolition risk assessment complete':
      'Évaluation des risques de démolition terminée',
    'Waste transfer docs uploaded': 'Bordereaux de déchets téléversés',
    'Work at height controls required.':
      'Mesures de travail en hauteur requises.',
    'Inspection and tag documentation':
      'Documentation d’inspection et de marquage',
    'Maintain inspection records and tagging status.':
      'Tenir les inspections et le statut de marquage.',
    'Scaffold inspection log': 'Registre d’inspection d’échafaudage',
    'Scaffold inspected before use': 'Échafaudage inspecté avant usage',
    'Daily pre-use checks recorded':
      'Contrôles journaliers avant usage enregistrés',
    'Welding fume controls required.':
      'Maîtrise des fumées de soudage requise.',
    'Welding procedure documentation':
      'Documentation des procédures de soudage',
    'Maintain welding procedures and material traceability.':
      'Tenir les procédures de soudage et la traçabilité des matériaux.',
    'Extraction and PPE plan': 'Plan d’extraction et EPI',
    'Hot works permit': 'Permis de feu',
    'Hot works controls active': 'Mesures de permis de feu actives',
    'Welding procedure uploaded': 'Procédure de soudage téléversée',
    'Sealant and solvent controls required.':
      'Maîtrise des mastics et solvants requise.',
    'Waterproofing documentation': 'Documentation d’étanchéité',
    'Maintain product approvals and testing records.':
      'Tenir les agréments produits et les résultats d’essais.',
    'Ventilation in place': 'Ventilation en place',
    'Waterproofing test recorded': 'Essai d’étanchéité enregistré',
    'Excavation safety controls required.':
      'Mesures de sécurité en excavation requises.',
    'Permit and shoring documentation':
      'Documentation des permis et blindages',
    'Maintain permits, shoring designs, and inspections.':
      'Tenir les permis, plans de blindage et inspections.',
    'Utility locate and permit to dig':
      'Localisation réseaux et autorisation de fouille',
    'Utilities located and marked':
      'Réseaux localisés et marqués',
    'Permit and inspection docs uploaded':
      'Permis et inspections téléversés',
    'Equipment and chemical safety controls required.':
      'Mesures de sécurité pour équipements et produits chimiques requises.',
    'Drainage and falls documentation':
      'Documentation drainage et pentes',
    'Record drainage design, falls, and sub-base preparation.':
      'Documenter le drainage, les pentes et la préparation du support.',
    'PPE and equipment checks': 'Vérifications EPI et équipements',
    'Safe work setup confirmed': 'Mise en place sécurisée confirmée',
    'Drainage falls recorded': 'Pentes de drainage enregistrées',
    'Fire safety compliance': 'Conformité sécurité incendie',
    'Fire system documentation': 'Documentation système incendie',
    'Maintain product certifications and commissioning data.':
      'Tenir les certifications produits et les données de mise en service.',
    'Tested system installation': 'Installation selon système testé',
    'Install fire stopping to tested system details and manufacturer guidance.':
      'Installer le coupe-feu selon le système testé et les prescriptions fabricant.',
    'Fire system commissioning certificates':
      'Certificats de mise en service incendie',
    'Fire system installed per spec':
      'Système incendie installé selon la spécification',
    'Fire system docs uploaded': 'Documents système incendie téléversés',
    'Fire stopping photo evidence captured':
      'Preuves photo du coupe-feu capturées',
    'PV documentation and handover': 'Documentation PV et remise',
    'Provide commissioning results, inverter settings, and O&M manuals.':
      'Fournir les résultats de mise en service, réglages onduleur et manuels O&M.',
    'Grid connection compliance':
      'Conformité de raccordement au réseau',
    'Record distribution grid notifications or approvals where required.':
      'Enregistrer les notifications ou autorisations du gestionnaire de réseau.',
    'PV commissioning certificate': 'Certificat de mise en service PV',
    'Electrical signoff completed':
      'Validation électrique terminée',
    'PV commissioning and O&M pack uploaded':
      'Dossier de mise en service PV et O&M téléversé',
    'Grid notification recorded': 'Notification réseau enregistrée',
    'Lift safety compliance': 'Conformité sécurité ascenseurs',
    'Lift handover and maintenance documentation':
      'Documentation de remise et maintenance ascenseurs',
    'Provide commissioning, inspection, and maintenance handover records.':
      'Fournir les PV de mise en service, d’inspection et de maintenance.',
    'Periodic inspection planning': 'Planification des inspections périodiques',
    'Ensure periodic inspection schedule is documented and followed.':
      'Assurer la documentation et le suivi du planning d’inspection.',
    'Installation certificate': 'Certificat d’installation',
    'Periodic inspection logs': 'Registres d’inspection périodique',
    'Commissioning completed': 'Mise en service terminée',
    'Maintenance handover uploaded':
      'Remise de maintenance téléversée',
    'Inspection schedule recorded': 'Planning d’inspection enregistré',
    'RGE qualification check': 'Vérification qualification RGE',
    'Verify RGE category matches energy renovation scope.':
      'Vérifier la catégorie RGE adaptée au périmètre des travaux.',
    'Company name': 'Nom de l’entreprise',
    'Postal code': 'Code postal',
    'RGE status': 'Statut RGE',
    'RGE category': 'Catégorie RGE',
    'Decennial insurance verification':
      'Vérification assurance décennale',
    'Verify decennial liability insurance coverage for construction trades.':
      'Vérifier la couverture décennale pour les métiers du bâtiment.',
    'Policy number': 'Numéro de police',
    'Insurer name': 'Nom de l’assureur',
    'Coverage status': 'Statut de couverture',
    'Coverage start date': 'Date de début de couverture',
    'Coverage end date': 'Date de fin de couverture',
    'Covered trade scope': 'Périmètre couvert',
  },
  es: {
    'Electrician': 'Electricista',
    'Gas': 'Gas',
    'Plumbing and HVAC': 'Fontanería y Climatización',
    'Roofing and Envelope': 'Cubiertas y Envolvente',
    'Energy Renovation': 'Rehabilitación energética',
    'Painting and Decorating': 'Pintura y Decoración',
    'Carpentry and Joinery': 'Carpintería',
    'Flooring and Tiling': 'Suelos y Alicatados',
    'Plastering and Drywall': 'Yesería y Pladur',
    'Glazing and Windows': 'Acristalamiento y Ventanas',
    'Insulation': 'Aislamiento',
    'Masonry and Brickwork': 'Albañilería',
    'Concrete and Structural': 'Hormigón y Estructuras',
    'Demolition and Strip-out': 'Demolición y Desescombro',
    'Scaffolding and Work at Height': 'Andamios y Trabajo en Altura',
    'Metalwork and Welding': 'Metalistería y Soldadura',
    'Waterproofing and Sealants': 'Impermeabilización y Selladores',
    'Groundworks and Excavation': 'Movimiento de Tierras y Excavación',
    'Paving and Landscaping': 'Pavimentación y Paisajismo',
    'Fire Protection': 'Protección contra Incendios',
    'Solar and PV': 'Solar y FV',
    'Elevators and Lifts': 'Ascensores',
    'REBT compliance': 'Cumplimiento REBT',
    'Low voltage installations must follow REBT (RD 842/2002).':
      'Las instalaciones de baja tensión deben cumplir el REBT (RD 842/2002).',
    'Documentation and handover': 'Documentación y entrega',
    'Provide test results, as-built documentation, and user guidance.':
      'Aportar resultados de pruebas, documentación «as-built» y guía de usuario.',
    'Testing and conformity': 'Pruebas y conformidad',
    'Perform and document installation testing per REBT requirements.':
      'Realizar y documentar las pruebas según REBT.',
    'Testing and inspection complete': 'Pruebas e inspección completadas',
    'As-built documentation uploaded': 'Documentación «as-built» cargada',
    'REBT test results uploaded': 'Resultados de pruebas REBT cargados',
    'Gas regulation compliance': 'Cumplimiento normativa gas',
    'Gas installations must follow RD 919/2006.':
      'Las instalaciones de gas deben cumplir RD 919/2006.',
    'Tightness testing and documentation':
      'Pruebas de estanqueidad y documentación',
    'Maintain tightness test and commissioning records.':
      'Mantener registros de estanqueidad y puesta en servicio.',
    'Ventilation and combustion safety':
      'Seguridad de ventilación y combustión',
    'Confirm ventilation and combustion air requirements are met.':
      'Confirmar requisitos de ventilación y aire de combustión.',
    'Commissioning recorded': 'Puesta en servicio registrada',
    'Emergency isolation labeling confirmed':
      'Señalización de aislamiento de emergencia confirmada',
    'Ventilation checks documented': 'Comprobaciones de ventilación documentadas',
    'CTE DB HS compliance': 'Cumplimiento CTE DB HS',
    'Water supply requirements under CTE DB HS.':
      'Requisitos de suministro de agua según CTE DB HS.',
    'RITE compliance': 'Cumplimiento RITE',
    'Thermal installations must meet RITE.':
      'Las instalaciones térmicas deben cumplir RITE.',
    'F-gas compliance for refrigerants':
      'Cumplimiento F-gas para refrigerantes',
    'Refrigerant handling requires F-gas certified personnel/company.':
      'La manipulación de refrigerantes requiere certificación F-gas.',
    'Commissioning and handover': 'Puesta en servicio y entrega',
    'Provide commissioning results and maintenance guidance.':
      'Aportar resultados de puesta en servicio y guía de mantenimiento.',
    'Water hygiene controls': 'Controles de higiene del agua',
    'Document water hygiene and legionella prevention measures.':
      'Documentar medidas de higiene del agua y prevención de legionela.',
    'Commissioning and maintenance log set':
      'Registro de puesta en servicio y mantenimiento establecido',
    'O&M documents uploaded': 'Documentos O&M cargados',
    'Water hygiene controls documented':
      'Controles de higiene del agua documentados',
    'CTE compliance': 'Cumplimiento CTE',
    'Roofing must meet CTE DB SE/HS/HE requirements.':
      'La cubierta debe cumplir CTE DB SE/HS/HE.',
    'Envelope documentation': 'Documentación de la envolvente',
    'Provide as-built details, product approvals, and warranties.':
      'Aportar detalles as-built, aprobaciones de producto y garantías.',
    'Structural and wind loading checks':
      'Comprobaciones estructurales y de carga de viento',
    'Confirm structural capacity and wind loading compliance for roof systems.':
      'Confirmar capacidad estructural y cargas de viento.',
    'Roof system installed per CTE':
      'Sistema de cubierta instalado según CTE',
    'Roof build-up and warranty docs uploaded':
      'Documentos de sistema de cubierta y garantías cargados',
    'Structural and wind load checks recorded':
      'Comprobaciones estructurales y de viento registradas',
    'CTE DB HE compliance': 'Cumplimiento CTE DB HE',
    'Energy performance must meet DB HE.':
      'El rendimiento energético debe cumplir DB HE.',
    'Energy documentation and handover':
      'Documentación energética y entrega',
    'Provide calculations, commissioning results, and user guidance.':
      'Aportar cálculos, resultados de puesta en servicio y guía de usuario.',
    'Ventilation provision': 'Ventilación',
    'Ensure ventilation performance is documented after retrofit.':
      'Asegurar que la ventilación se documenta tras la reforma.',
    'Energy compliance documentation complete':
      'Documentación de cumplimiento energético completa',
    'Energy compliance documents uploaded':
      'Documentos de cumplimiento energético cargados',
    'Ventilation performance recorded':
      'Rendimiento de ventilación registrado',
    'PRL compliance': 'Cumplimiento PRL',
    'Occupational risk prevention for hazardous substances.':
      'Prevención de riesgos laborales para sustancias peligrosas.',
    'Product and waste documentation': 'Documentación de productos y residuos',
    'Maintain product data sheets and waste handling records.':
      'Mantener fichas de producto y registros de gestión de residuos.',
    'SDS for coatings': 'FDS para recubrimientos',
    'PPE and ventilation in place': 'EPI y ventilación disponibles',
    'Waste handling recorded': 'Gestión de residuos registrada',
    'Dust and manual handling risks assessed.':
      'Riesgos de polvo y manipulación manual evaluados.',
    'Material documentation': 'Documentación de materiales',
    'Record timber treatment and fixings used.':
      'Registrar tratamiento de madera y fijaciones usadas.',
    'Dust control plan': 'Plan de control de polvo',
    'Dust controls active': 'Control de polvo activo',
    'Material approvals uploaded': 'Aprobaciones de materiales cargadas',
    'Silica dust and adhesives controls.':
      'Control de polvo de sílice y adhesivos.',
    'Subfloor documentation': 'Documentación de la base',
    'Record subfloor condition and moisture tests.':
      'Registrar estado de la base y pruebas de humedad.',
    'SDS for adhesives': 'FDS para adhesivos',
    'Moisture test results uploaded':
      'Resultados de humedad cargados',
    'Dust controls required.': 'Control de polvo requerido.',
    'Surface preparation documentation': 'Documentación de preparación de superficies',
    'Record surface prep and finish specification.':
      'Registrar preparación y especificación de acabado.',
    'SDS for compounds': 'FDS para pastas',
    'Surface prep recorded': 'Preparación de superficie registrada',
    'Handling and sealant risks assessed.':
      'Riesgos de manipulación y sellantes evaluados.',
    'Safety glazing documentation': 'Documentación de acristalamiento de seguridad',
    'Record safety glass specification and location.':
      'Registrar especificación y ubicación del vidrio de seguridad.',
    'SDS for sealants': 'FDS para sellantes',
    'Safe handling plan in place': 'Plan de manipulación segura en vigor',
    'Safety glass schedule uploaded':
      'Plan de vidrio de seguridad cargado',
    'Fiber exposure controls required.':
      'Control de exposición a fibras requerido.',
    'Thermal performance documentation': 'Documentación de rendimiento térmico',
    'Record insulation type, thickness, and performance values.':
      'Registrar tipo de aislamiento, espesor y rendimiento.',
    'SDS for insulation products': 'FDS para productos aislantes',
    'PPE and dust control in place':
      'EPI y control de polvo en su sitio',
    'Insulation specs recorded': 'Especificaciones de aislamiento registradas',
    'Cement and silica dust controls.':
      'Control de polvo de cemento y sílice.',
    'Record mortar mix and masonry materials used.':
      'Registrar mezcla de mortero y materiales de albañilería.',
    'SDS for mortar/cement': 'FDS para mortero/cemento',
    'Mortar mix recorded': 'Mezcla de mortero registrada',
    'Wet cement controls required.':
      'Control de cemento húmedo requerido.',
    'Pour and curing records': 'Registros de vertido y curado',
    'Maintain pour logs and curing/strength records.':
      'Mantener registros de vertido y curado/resistencia.',
    'SDS for cement/admixtures': 'FDS para cemento/aditivos',
    'PPE and wash stations in place':
      'EPI y estaciones de lavado en su sitio',
    'Pour log uploaded': 'Registro de vertido cargado',
    'Demolition hazards and dust controls required.':
      'Riesgos de demolición y control de polvo requeridos.',
    'Survey and waste documentation': 'Documentación de inspección y residuos',
    'Maintain survey records and waste transfer documentation.':
      'Mantener registros y documentación de traslado de residuos.',
    'Waste disposal records': 'Registros de eliminación de residuos',
    'Demolition risk assessment complete':
      'Evaluación de riesgos de demolición completada',
    'Waste transfer docs uploaded':
      'Documentos de traslado de residuos cargados',
    'Work at height controls required.':
      'Control de trabajo en altura requerido.',
    'Inspection and tag documentation':
      'Documentación de inspección y etiquetado',
    'Maintain inspection records and tagging status.':
      'Mantener registros de inspección y estado de etiquetado.',
    'Scaffold inspection log': 'Registro de inspección de andamios',
    'Scaffold inspected before use': 'Andamio inspeccionado antes de uso',
    'Daily pre-use checks recorded':
      'Comprobaciones diarias antes de uso registradas',
    'Welding fume controls required.':
      'Control de humos de soldadura requerido.',
    'Welding procedure documentation':
      'Documentación de procedimientos de soldadura',
    'Maintain welding procedures and material traceability.':
      'Mantener procedimientos de soldadura y trazabilidad de materiales.',
    'Extraction and PPE plan': 'Plan de extracción y EPI',
    'Hot works permit': 'Permiso de trabajos en caliente',
    'Hot works controls active': 'Controles de trabajos en caliente activos',
    'Welding procedure uploaded': 'Procedimiento de soldadura cargado',
    'Sealant and solvent controls required.':
      'Control de sellantes y disolventes requerido.',
    'Waterproofing documentation': 'Documentación de impermeabilización',
    'Maintain product approvals and testing records.':
      'Mantener aprobaciones de producto y registros de pruebas.',
    'Ventilation in place': 'Ventilación en su sitio',
    'Waterproofing test recorded': 'Prueba de impermeabilización registrada',
    'Excavation safety controls required.':
      'Control de seguridad en excavación requerido.',
    'Permit and shoring documentation':
      'Documentación de permisos y entibación',
    'Maintain permits, shoring designs, and inspections.':
      'Mantener permisos, diseños de entibación e inspecciones.',
    'Utility locate and permit to dig':
      'Localización de servicios y permiso de excavación',
    'Utilities located and marked': 'Servicios localizados y marcados',
    'Permit and inspection docs uploaded':
      'Documentos de permisos e inspección cargados',
    'Equipment and chemical safety controls required.':
      'Control de seguridad de equipos y químicos requerido.',
    'Drainage and falls documentation':
      'Documentación de drenaje y pendientes',
    'Record drainage design, falls, and sub-base preparation.':
      'Registrar diseño de drenaje, pendientes y preparación de base.',
    'PPE and equipment checks': 'Comprobaciones de EPI y equipos',
    'Safe work setup confirmed': 'Montaje de trabajo seguro confirmado',
    'Drainage falls recorded': 'Pendientes de drenaje registradas',
    'Fire safety compliance': 'Cumplimiento de seguridad contra incendios',
    'Fire system documentation': 'Documentación de sistemas contra incendios',
    'Maintain product certifications and commissioning data.':
      'Mantener certificaciones de producto y datos de puesta en marcha.',
    'Tested system installation': 'Instalación según sistema ensayado',
    'Install fire stopping to tested system details and manufacturer guidance.':
      'Instalar sellado cortafuegos según sistema ensayado y fabricante.',
    'Fire system commissioning certificates':
      'Certificados de puesta en marcha contra incendios',
    'Fire system installed per spec':
      'Sistema contra incendios instalado según especificación',
    'Fire system docs uploaded': 'Documentos de sistema contra incendios cargados',
    'Fire stopping photo evidence captured':
      'Evidencia fotográfica de sellado cortafuegos capturada',
    'PV documentation and handover':
      'Documentación FV y entrega',
    'Provide commissioning results, inverter settings, and O&M manuals.':
      'Aportar resultados de puesta en marcha, ajustes del inversor y manuales O&M.',
    'Grid connection compliance':
      'Cumplimiento de conexión a red',
    'Record distribution grid notifications or approvals where required.':
      'Registrar notificaciones o aprobaciones del operador de red.',
    'PV commissioning certificate':
      'Certificado de puesta en marcha FV',
    'Electrical signoff completed': 'Aprobación eléctrica completada',
    'PV commissioning and O&M pack uploaded':
      'Paquete de puesta en marcha FV y O&M cargado',
    'Grid notification recorded': 'Notificación a red registrada',
    'Lift safety compliance': 'Cumplimiento de seguridad de ascensores',
    'Lift handover and maintenance documentation':
      'Documentación de entrega y mantenimiento de ascensores',
    'Provide commissioning, inspection, and maintenance handover records.':
      'Aportar registros de puesta en marcha, inspección y mantenimiento.',
    'Periodic inspection planning':
      'Planificación de inspecciones periódicas',
    'Ensure periodic inspection schedule is documented and followed.':
      'Asegurar que el plan de inspecciones se documenta y se cumple.',
    'Installation certificate': 'Certificado de instalación',
    'Periodic inspection logs': 'Registros de inspección periódica',
    'Commissioning completed': 'Puesta en marcha completada',
    'Maintenance handover uploaded': 'Entrega de mantenimiento cargada',
    'Inspection schedule recorded':
      'Plan de inspecciones registrado',
    'REA registration check': 'Comprobación de registro REA',
    'Verify construction company accreditation.':
      'Verificar acreditación de empresa constructora.',
    'CIF/NIF/NIE/REA': 'CIF/NIF/NIE/REA',
    'REA status': 'Estado REA',
    'Registry details': 'Detalles del registro',
    'Installer accreditation check':
      'Comprobación de acreditación de instalador',
    'Verify regional installer accreditation for regulated trades.':
      'Verificar acreditación regional de instaladores para oficios regulados.',
    'Region/Autonomous community': 'Región/Comunidad autónoma',
    'Installer registry ID': 'ID de registro de instalador',
    'Trade category': 'Categoría del oficio',
    'Accreditation status': 'Estado de acreditación',
    'Scope/category': 'Alcance/categoría',
  },
  it: {
    'Electrician': 'Elettricista',
    'Gas': 'Gas',
    'Plumbing and HVAC': 'Idraulica e Climatizzazione',
    'Roofing and Envelope': 'Coperture e Involucro',
    'Energy Renovation': 'Riqualificazione energetica',
    'Painting and Decorating': 'Pittura e Decorazione',
    'Carpentry and Joinery': 'Carpenteria e Falegnameria',
    'Flooring and Tiling': 'Pavimenti e Piastrelle',
    'Plastering and Drywall': 'Intonaci e Cartongesso',
    'Glazing and Windows': 'Vetrate e Finestre',
    'Insulation': 'Isolamento',
    'Masonry and Brickwork': 'Muratura',
    'Concrete and Structural': 'Calcestruzzo e Strutture',
    'Demolition and Strip-out': 'Demolizione e Smontaggio',
    'Scaffolding and Work at Height': 'Ponteggi e Lavori in quota',
    'Metalwork and Welding': 'Carpenteria metallica e Saldatura',
    'Waterproofing and Sealants': 'Impermeabilizzazione e Sigillanti',
    'Groundworks and Excavation': 'Scavi e Movimento terra',
    'Paving and Landscaping': 'Pavimentazioni e Paesaggistica',
    'Fire Protection': 'Protezione antincendio',
    'Solar and PV': 'Solare e FV',
    'Elevators and Lifts': 'Ascensori',
    'DM 37/2008 compliance': 'Conformità DM 37/2008',
    'Electrical systems require declaration of conformity.':
      'Gli impianti elettrici richiedono la dichiarazione di conformità.',
    'Documentation and handover': 'Documentazione e consegna',
    'Provide test results, as-built documentation, and user guidance.':
      'Fornire risultati di prova, documentazione «as-built» e istruzioni utente.',
    'Declaration issued and stored':
      'Dichiarazione rilasciata e archiviata',
    'As-built documentation uploaded': 'Documentazione «as-built» caricata',
    'Gas systems require declaration of conformity.':
      'Gli impianti gas richiedono la dichiarazione di conformità.',
    'UNI 7129 compliance': 'Conformità UNI 7129',
    'Domestic gas installations follow UNI 7129 series.':
      'Gli impianti gas domestici seguono la serie UNI 7129.',
    'Tightness testing and documentation':
      'Prove di tenuta e documentazione',
    'Maintain tightness test and commissioning records.':
      'Mantenere registri delle prove di tenuta e della messa in servizio.',
    'Commissioning records complete': 'Registri di messa in servizio completi',
    'Emergency isolation labeling confirmed':
      'Segnaletica di isolamento di emergenza confermata',
    'Plumbing systems require declaration of conformity.':
      'Gli impianti idraulici richiedono la dichiarazione di conformità.',
    'DPR 74/2013 compliance': 'Conformità DPR 74/2013',
    'Thermal systems require maintenance and inspection records.':
      'Gli impianti termici richiedono registri di manutenzione e ispezione.',
    'F-gas compliance for refrigerants':
      'Conformita F-gas per refrigeranti',
    'Refrigerant handling requires F-gas certified personnel/company.':
      'La gestione dei refrigeranti richiede personale/azienda certificata F-gas.',
    'Commissioning and handover': 'Messa in servizio e consegna',
    'Provide commissioning results and maintenance guidance.':
      'Fornire risultati di messa in servizio e istruzioni di manutenzione.',
    'Maintenance and inspection scheduled':
      'Manutenzione e ispezione pianificate',
    'O&M documents uploaded': 'Documenti O&M caricati',
    'NTC 2018 compliance': 'Conformità NTC 2018',
    'Structural requirements for roofing and envelope.':
      'Requisiti strutturali per coperture e involucro.',
    'Envelope documentation': 'Documentazione involucro',
    'Provide as-built details, product approvals, and warranties.':
      'Fornire dettagli as-built, approvazioni di prodotto e garanzie.',
    'Roof system installed per design':
      'Sistema di copertura installato secondo progetto',
    'Roof build-up and warranty docs uploaded':
      'Documenti di stratigrafia e garanzia caricati',
    'D.Lgs 192/2005 compliance': 'Conformità D.Lgs 192/2005',
    'Energy performance rules and APE required.':
      'Regole di prestazione energetica e APE richieste.',
    'Energy documentation and handover':
      'Documentazione energetica e consegna',
    'Provide calculations, commissioning results, and user guidance.':
      'Fornire calcoli, risultati di messa in servizio e istruzioni utente.',
    'Energy documentation complete': 'Documentazione energetica completa',
    'Energy compliance documents uploaded':
      'Documenti di conformita energetica caricati',
    'D.Lgs 81/2008 compliance': 'Conformità D.Lgs 81/2008',
    'Risk assessment for hazardous substances.':
      'Valutazione dei rischi per sostanze pericolose.',
    'Product and waste documentation':
      'Documentazione prodotti e rifiuti',
    'Maintain product data sheets and waste handling records.':
      'Mantenere schede prodotto e registri gestione rifiuti.',
    'SDS for coatings': 'SDS per rivestimenti',
    'PPE and ventilation in place':
      'DPI e ventilazione disponibili',
    'Waste handling recorded': 'Gestione rifiuti registrata',
    'Dust and manual handling risks assessed.':
      'Rischi di polveri e movimentazione manuale valutati.',
    'Material documentation': 'Documentazione materiali',
    'Record timber treatment and fixings used.':
      'Registrare trattamento del legno e fissaggi utilizzati.',
    'Dust control plan': 'Piano di controllo polveri',
    'Dust controls active': 'Controllo polveri attivo',
    'Material approvals uploaded': 'Approvazioni materiali caricate',
    'Silica dust and adhesives controls.':
      'Controlli polveri di silice e adesivi.',
    'Subfloor documentation': 'Documentazione sottofondo',
    'Record subfloor condition and moisture tests.':
      'Registrare condizioni del sottofondo e test di umidita.',
    'SDS for adhesives': 'SDS per adesivi',
    'Moisture test results uploaded':
      'Risultati test di umidita caricati',
    'Dust controls required.': 'Controllo polveri richiesto.',
    'Surface preparation documentation':
      'Documentazione preparazione superfici',
    'Record surface prep and finish specification.':
      'Registrare preparazione superficie e specifica finitura.',
    'SDS for compounds': 'SDS per composti',
    'Surface prep recorded': 'Preparazione superficie registrata',
    'Handling and sealant risks assessed.':
      'Rischi di movimentazione e sigillanti valutati.',
    'Safety glazing documentation':
      'Documentazione vetri di sicurezza',
    'Record safety glass specification and location.':
      'Registrare specifica e posizione del vetro di sicurezza.',
    'SDS for sealants': 'SDS per sigillanti',
    'Safe handling plan in place': 'Piano di movimentazione sicura attivo',
    'Safety glass schedule uploaded':
      'Piano vetri di sicurezza caricato',
    'Fiber exposure controls required.':
      'Controlli esposizione fibre richiesti.',
    'Thermal performance documentation':
      'Documentazione prestazioni termiche',
    'Record insulation type, thickness, and performance values.':
      'Registrare tipo, spessore e prestazioni dell’isolamento.',
    'SDS for insulation products': 'SDS per prodotti isolanti',
    'PPE and dust control in place':
      'DPI e controllo polveri presenti',
    'Insulation specs recorded':
      'Specifiche isolamento registrate',
    'Cement and silica dust controls.':
      'Controlli polveri di cemento e silice.',
    'Record mortar mix and masonry materials used.':
      'Registrare miscela malta e materiali di muratura.',
    'SDS for mortar/cement': 'SDS per malta/cemento',
    'Mortar mix recorded': 'Miscela malta registrata',
    'Wet cement controls required.':
      'Controlli per cemento umido richiesti.',
    'Pour and curing records':
      'Registri di getto e stagionatura',
    'Maintain pour logs and curing/strength records.':
      'Mantenere registri di getto e stagionatura/resistenza.',
    'SDS for cement/admixtures': 'SDS per cemento/additivi',
    'PPE and wash stations in place':
      'DPI e stazioni di lavaggio presenti',
    'Pour log uploaded': 'Registro getto caricato',
    'Demolition hazards and dust controls required.':
      'Rischi demolizione e controllo polveri richiesti.',
    'Survey and waste documentation':
      'Documentazione rilievi e rifiuti',
    'Maintain survey records and waste transfer documentation.':
      'Mantenere rilievi e documenti di trasferimento rifiuti.',
    'Waste disposal records': 'Registri smaltimento rifiuti',
    'Demolition risk assessment complete':
      'Valutazione rischi demolizione completata',
    'Waste transfer docs uploaded':
      'Documenti trasferimento rifiuti caricati',
    'Work at height controls required.':
      'Controlli lavori in quota richiesti.',
    'Inspection and tag documentation':
      'Documentazione ispezione e tag',
    'Maintain inspection records and tagging status.':
      'Mantenere registri ispezioni e stato tag.',
    'Scaffold inspection log': 'Registro ispezione ponteggi',
    'Scaffold inspected before use':
      'Ponteggio ispezionato prima dell’uso',
    'Daily pre-use checks recorded':
      'Controlli giornalieri pre-uso registrati',
    'Welding fume controls required.':
      'Controlli fumi di saldatura richiesti.',
    'Welding procedure documentation':
      'Documentazione procedure di saldatura',
    'Maintain welding procedures and material traceability.':
      'Mantenere procedure di saldatura e tracciabilita materiali.',
    'Extraction and PPE plan': 'Piano di aspirazione e DPI',
    'Hot works permit': 'Permesso lavori a caldo',
    'Hot works controls active':
      'Controlli lavori a caldo attivi',
    'Welding procedure uploaded': 'Procedura saldatura caricata',
    'Sealant and solvent controls required.':
      'Controlli sigillanti e solventi richiesti.',
    'Waterproofing documentation': 'Documentazione impermeabilizzazione',
    'Maintain product approvals and testing records.':
      'Mantenere approvazioni prodotti e registri prove.',
    'Ventilation in place': 'Ventilazione presente',
    'Waterproofing test recorded':
      'Test impermeabilizzazione registrato',
    'Excavation safety controls required.':
      'Controlli sicurezza scavo richiesti.',
    'Permit and shoring documentation':
      'Documentazione permessi e puntellamenti',
    'Maintain permits, shoring designs, and inspections.':
      'Mantenere permessi, progetti di puntellamento e ispezioni.',
    'Utility locate and permit to dig':
      'Localizzazione sottoservizi e permesso scavo',
    'Utilities located and marked':
      'Sottoservizi localizzati e marcati',
    'Permit and inspection docs uploaded':
      'Documenti permessi e ispezioni caricati',
    'Equipment and chemical safety controls required.':
      'Controlli sicurezza attrezzature e sostanze richiesti.',
    'Drainage and falls documentation':
      'Documentazione drenaggi e pendenze',
    'Record drainage design, falls, and sub-base preparation.':
      'Registrare progetto drenaggi, pendenze e sottofondo.',
    'PPE and equipment checks': 'Controlli DPI e attrezzature',
    'Safe work setup confirmed': 'Allestimento sicuro confermato',
    'Drainage falls recorded': 'Pendenze drenaggio registrate',
    'Fire safety compliance': 'Conformità antincendio',
    'Fire system documentation': 'Documentazione impianto antincendio',
    'Maintain product certifications and commissioning data.':
      'Mantenere certificazioni prodotto e dati di messa in servizio.',
    'Tested system installation':
      'Installazione secondo sistema testato',
    'Install fire stopping to tested system details and manufacturer guidance.':
      'Installare compartimentazioni secondo sistema testato e indicazioni produttore.',
    'Fire system commissioning certificates':
      'Certificati di messa in servizio antincendio',
    'Fire system installed per spec':
      'Impianto antincendio installato secondo specifica',
    'Fire system docs uploaded':
      'Documenti impianto antincendio caricati',
    'Fire stopping photo evidence captured':
      'Evidenze fotografiche compartimentazione acquisite',
    'PV documentation and handover':
      'Documentazione FV e consegna',
    'Provide commissioning results, inverter settings, and O&M manuals.':
      'Fornire risultati di messa in servizio, impostazioni inverter e manuali O&M.',
    'Grid connection compliance':
      'Conformità di connessione alla rete',
    'Record distribution grid notifications or approvals where required.':
      'Registrare notifiche o approvazioni del gestore di rete.',
    'PV commissioning certificate':
      'Certificato di messa in servizio FV',
    'Electrical signoff completed':
      'Collaudo elettrico completato',
    'PV commissioning and O&M pack uploaded':
      'Pacchetto di messa in servizio FV e O&M caricato',
    'Grid notification recorded':
      'Notifica rete registrata',
    'Lift safety compliance': 'Conformità sicurezza ascensori',
    'Lift handover and maintenance documentation':
      'Documentazione consegna e manutenzione ascensori',
    'Provide commissioning, inspection, and maintenance handover records.':
      'Fornire registri di messa in servizio, ispezione e manutenzione.',
    'Periodic inspection planning':
      'Pianificazione ispezioni periodiche',
    'Ensure periodic inspection schedule is documented and followed.':
      'Assicurare pianificazione ispezioni documentata e rispettata.',
    'Installation certificate': 'Certificato di installazione',
    'Periodic inspection logs': 'Registri ispezioni periodiche',
    'Commissioning completed': 'Messa in servizio completata',
    'Maintenance handover uploaded':
      'Consegna manutenzione caricata',
    'Inspection schedule recorded': 'Piano ispezioni registrato',
    'DM 37/2008 qualification check':
      'Verifica qualificazione DM 37/2008',
    'Verify company is qualified for installation systems.':
      'Verificare che l’azienda sia qualificata per gli impianti.',
    'Company registration identifier':
      'Identificativo registrazione azienda',
    'Qualification status': 'Stato qualificazione',
    'Responsible technical person': 'Responsabile tecnico',
  },
};

const withLocalizations = (base: ComplianceKnowledgeBase): ComplianceKnowledgeBase => ({
  ...base,
  countries: base.countries.map((country) => {
    const language = countryLanguage[country.country];
    return {
      ...country,
      trades: country.trades.map((trade) => ({
        ...trade,
        tradeLabelLocalizations: mergeLocalization(
          trade.tradeLabel,
          trade.tradeLabelLocalizations,
          language,
        ),
        requirements: trade.requirements.map((requirement) => ({
          ...requirement,
          titleLocalizations: mergeLocalization(
            requirement.title,
            requirement.titleLocalizations,
            language,
          ),
          descriptionLocalizations: mergeLocalization(
            requirement.description,
            requirement.descriptionLocalizations,
            language,
          ),
          applicabilityNotesLocalizations: mergeLocalization(
            requirement.applicabilityNotes,
            requirement.applicabilityNotesLocalizations,
            language,
          ),
        })),
        evidence: trade.evidence.map((evidence) => ({
          ...evidence,
          labelLocalizations: mergeLocalization(
            evidence.label,
            evidence.labelLocalizations,
            language,
          ),
          descriptionLocalizations: mergeLocalization(
            evidence.description,
            evidence.descriptionLocalizations,
            language,
          ),
        })),
        checklists: trade.checklists.map((checklist) => ({
          ...checklist,
          labelLocalizations: mergeLocalization(
            checklist.label,
            checklist.labelLocalizations,
            language,
          ),
          helpTextLocalizations: mergeLocalization(
            checklist.helpText,
            checklist.helpTextLocalizations,
            language,
          ),
        })),
      })),
      registryChecks: country.registryChecks.map((registry) => ({
        ...registry,
        labelLocalizations: mergeLocalization(
          registry.label,
          registry.labelLocalizations,
          language,
        ),
        descriptionLocalizations: mergeLocalization(
          registry.description,
          registry.descriptionLocalizations,
          language,
        ),
        inputs: registry.inputs.map((input) => ({
          ...input,
          labelLocalizations: mergeLocalization(
            input.label,
            input.labelLocalizations,
            language,
          ),
        })),
        outputs: registry.outputs.map((output) => ({
          ...output,
          labelLocalizations: mergeLocalization(
            output.label,
            output.labelLocalizations,
            language,
          ),
        })),
      })),
    };
  }),
});

const rawComplianceKnowledgeBase: ComplianceKnowledgeBase = {
  version: '0.1.0',
  countries: [
    {
      country: 'UK',
      trades: [
        {
          tradeId: 'electrician',
          tradeLabel: 'Electrician',
          tradeLabelLocalizations: { en: 'Electrician' },
          projectScope: 'all',
          requirements: [
            {
              id: 'uk-elec-part-p',
              title: 'Part P compliance for domestic work',
              description:
                'Domestic electrical work must follow Part P rules for design, inspection, testing, and notification.',
              level: 'mandatory',
              roleScope: 'contractor',
              applicabilityNotes: 'Applies to dwellings in England; devolved nations differ.',
            },
            {
              id: 'uk-elec-eicr-rental',
              title: 'Periodic inspection for rental properties',
              description:
                'Rental properties require inspection and testing at least every 5 years by a qualified person, with an EICR report.',
              level: 'mandatory',
              roleScope: 'contractor',
              applicabilityNotes: 'Applies to rented homes in England.',
            },
            {
              id: 'uk-elec-docs',
              title: 'Electrical documentation and handover',
              description: 'Provide test results, circuit schedules, and as-built documentation to the client.',
              level: 'mandatory',
              roleScope: 'contractor',
            },
            {
              id: 'uk-elec-bs7671',
              title: 'BS 7671 compliance',
              description: 'Installation, inspection, and testing must align with BS 7671 requirements.',
              level: 'mandatory',
              roleScope: 'contractor',
            },
            {
              id: 'uk-elec-eaw',
              title: 'Electricity at Work Regulations',
              description: 'Electrical work must be planned and carried out safely under Electricity at Work duties.',
              level: 'mandatory',
              roleScope: 'contractor',
            },
          ],
          evidence: [
            {
              id: 'uk-elec-cps',
              label: 'Competent Person Scheme registration',
              description: 'Proof of registration for self-certification (if used).',
              required: true,
            },
            {
              id: 'uk-elec-eic',
              label: 'Electrical Installation Certificate / Minor Works Certificate',
              required: true,
            },
            {
              id: 'uk-elec-eicr',
              label: 'EICR report + remedial works confirmation',
              description: 'Required for rental properties.',
              required: false,
            },
          ],
          checklists: [
            { id: 'uk-elec-prejob', label: 'Confirm scope is notifiable under Part P', required: true },
            { id: 'uk-elec-testing', label: 'Inspection and testing completed; certificate issued', required: true },
            { id: 'uk-elec-rental', label: 'EICR provided to landlord/tenant where required', required: false },
            { id: 'uk-elec-handover', label: 'As-built documentation and circuit schedules uploaded', required: true },
            { id: 'uk-elec-bs7671-check', label: 'BS 7671 test results reviewed and uploaded', required: true },
          ],
        },
        {
          tradeId: 'gas',
          tradeLabel: 'Gas',
          tradeLabelLocalizations: { en: 'Gas' },
          projectScope: 'all',
          requirements: [
            {
              id: 'uk-gas-gsiur',
              title: 'Gas Safety (Installation and Use) Regulations',
              description: 'Gas work must follow GSIUR and be performed by Gas Safe registered engineers.',
              level: 'mandatory',
              roleScope: 'contractor',
            },
            {
              id: 'uk-gas-testing',
              title: 'Tightness testing and commissioning',
              description: 'Gas installations require tightness testing and documented commissioning.',
              level: 'mandatory',
              roleScope: 'contractor',
            },
            {
              id: 'uk-gas-flue',
              title: 'Flue and ventilation compliance',
              description: 'Ensure flueing and ventilation meet applicable gas safety requirements.',
              level: 'mandatory',
              roleScope: 'contractor',
            },
            {
              id: 'uk-gas-co',
              title: 'Carbon monoxide safety',
              description: 'Install and document CO alarm provision where required.',
              level: 'mandatory',
              roleScope: 'contractor',
            },
          ],
          evidence: [
            { id: 'uk-gas-safe', label: 'Gas Safe registration + engineer scope', required: true },
            { id: 'uk-gas-commission', label: 'Gas commissioning / safety check records', required: true },
            { id: 'uk-gas-landlord', label: 'Landlord gas safety records (if applicable)', required: false },
          ],
          checklists: [
            { id: 'uk-gas-verify', label: 'Verify Gas Safe status before work', required: true },
            { id: 'uk-gas-records', label: 'Commissioning and safety records completed', required: true },
            { id: 'uk-gas-isolation', label: 'Emergency isolation labeling and access confirmed', required: true },
            { id: 'uk-gas-vent', label: 'Flue and ventilation checks recorded', required: true },
          ],
        },
        {
          tradeId: 'plumbing_hvac',
          tradeLabel: 'Plumbing and HVAC',
          tradeLabelLocalizations: { en: 'Plumbing and HVAC' },
          projectScope: 'all',
          requirements: [
            {
              id: 'uk-water-fittings',
              title: 'Water fittings compliance',
              description: 'Water fittings and installations must comply with Water Fittings Regulations.',
              level: 'mandatory',
              roleScope: 'contractor',
            },
            {
              id: 'uk-hot-water',
              title: 'Hot water safety and efficiency',
              description: 'Hot water systems must meet Approved Document G requirements.',
              level: 'mandatory',
              roleScope: 'contractor',
            },
            {
              id: 'uk-fgas',
              title: 'F-gas compliance for refrigerants',
              description: 'HVAC systems with refrigerants require F-gas certified personnel/company.',
              level: 'mandatory',
              roleScope: 'contractor',
            },
            {
              id: 'uk-plumb-docs',
              title: 'System commissioning and handover',
              description: 'Provide commissioning results, manuals, and maintenance guidance for installed systems.',
              level: 'mandatory',
              roleScope: 'contractor',
            },
            {
              id: 'uk-plumb-legionella',
              title: 'Water hygiene and legionella controls',
              description: 'Apply water hygiene controls and document risk mitigation for stagnant systems.',
              level: 'mandatory',
              roleScope: 'contractor',
            },
            {
              id: 'uk-plumb-backflow-controls',
              title: 'Backflow prevention controls',
              description: 'Backflow protection must be selected and installed to appropriate risk category.',
              level: 'mandatory',
              roleScope: 'contractor',
            },
          ],
          evidence: [
            { id: 'uk-plumb-backflow', label: 'Backflow protection evidence', required: true },
            { id: 'uk-plumb-commission', label: 'Hot water commissioning record', required: true },
            { id: 'uk-plumb-unvented', label: 'Unvented cylinder qualification + certificate', required: false },
            { id: 'uk-plumb-fgas', label: 'F-gas certification + handling log', required: false },
          ],
          checklists: [
            { id: 'uk-plumb-fit', label: 'Water fittings and backflow controls confirmed', required: true },
            { id: 'uk-plumb-hot', label: 'Hot water safety controls verified', required: true },
            { id: 'uk-plumb-handover', label: 'Commissioning and O&M documents uploaded', required: true },
            { id: 'uk-plumb-hygiene', label: 'Water hygiene controls documented', required: true },
          ],
        },
        {
          tradeId: 'roofing_envelope',
          tradeLabel: 'Roofing and Envelope',
          tradeLabelLocalizations: { en: 'Roofing and Envelope' },
          projectScope: 'all',
          requirements: [
            { id: 'uk-roof-structure', title: 'Structure compliance', description: 'Follow Approved Document A for structural elements.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'uk-roof-moisture', title: 'Moisture protection', description: 'Follow Approved Document C for moisture resistance.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'uk-roof-energy', title: 'Energy performance', description: 'Follow Approved Document L for thermal performance.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'uk-roof-docs', title: 'Envelope documentation', description: 'Provide as-built details, product approvals, and warranties.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'uk-roof-height', title: 'Work at Height controls', description: 'Roofing work must comply with Work at Height Regulations.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'uk-roof-fire', title: 'Fire performance of roof systems', description: 'Roof systems must meet applicable fire performance requirements (Part B).', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'uk-roof-struct', label: 'Structural calculations / design', required: true },
            { id: 'uk-roof-water', label: 'Waterproofing system documentation', required: true },
            { id: 'uk-roof-thermal', label: 'Insulation / U value evidence', required: true },
          ],
          checklists: [
            { id: 'uk-roof-struct-check', label: 'Structural design verified', required: true },
            { id: 'uk-roof-moist-check', label: 'Moisture control details installed', required: true },
            { id: 'uk-roof-handover', label: 'Roof build-up and warranty documents uploaded', required: true },
            { id: 'uk-roof-height-check', label: 'Work at height plan and inspections recorded', required: true },
          ],
        },
        {
          tradeId: 'energy_renovation',
          tradeLabel: 'Energy Renovation',
          tradeLabelLocalizations: { en: 'Energy Renovation' },
          projectScope: 'renovation',
          requirements: [
            { id: 'uk-energy-part-l', title: 'Part L compliance', description: 'Energy performance must meet Part L requirements.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'uk-energy-docs', title: 'Energy documentation and handover', description: 'Provide calculations, commissioning results, and user guidance.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'uk-energy-vent', title: 'Ventilation provision', description: 'Ensure adequate ventilation in line with Part F requirements.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'uk-energy-calcs', label: 'Part L compliance calculations', required: true },
            { id: 'uk-energy-epc', label: 'EPC before/after renovation', required: true },
            { id: 'uk-energy-commission', label: 'System commissioning record', required: true },
          ],
          checklists: [
            { id: 'uk-energy-pre', label: 'Pre retrofit EPC or baseline recorded', required: true },
            { id: 'uk-energy-post', label: 'Post retrofit EPC or performance recorded', required: true },
            { id: 'uk-energy-handover', label: 'Energy compliance documents uploaded', required: true },
            { id: 'uk-energy-vent-check', label: 'Ventilation performance documented', required: true },
          ],
        },
        {
          tradeId: 'painting',
          tradeLabel: 'Painting and Decorating',
          tradeLabelLocalizations: { en: 'Painting and Decorating' },
          projectScope: 'all',
          requirements: [
            { id: 'uk-paint-coshh', title: 'COSHH controls', description: 'Hazardous substances must be assessed and controlled.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'uk-paint-docs', title: 'Product and waste documentation', description: 'Keep product data sheets and waste handling records.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'uk-paint-coshh', label: 'COSHH assessment for paints/solvents/dust', required: true },
            { id: 'uk-paint-sds', label: 'SDS for coatings used', required: true },
            { id: 'uk-paint-waste', label: 'Hazardous waste disposal record', required: false },
          ],
          checklists: [
            { id: 'uk-paint-ppe', label: 'PPE and ventilation in place', required: true },
            { id: 'uk-paint-sds', label: 'SDS available on site', required: true },
            { id: 'uk-paint-waste-check', label: 'Waste handling and disposal recorded', required: true },
          ],
        },
        {
          tradeId: 'carpentry',
          tradeLabel: 'Carpentry and Joinery',
          tradeLabelLocalizations: { en: 'Carpentry and Joinery' },
          projectScope: 'all',
          requirements: [
            { id: 'uk-carp-coshh', title: 'Wood dust controls', description: 'COSHH applies to wood dust and treated timber.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'uk-carp-docs', title: 'Material and fixings documentation', description: 'Record timber treatment, fixings, and product approvals.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'uk-carp-coshh', label: 'COSHH assessment for wood dust', required: true },
            { id: 'uk-carp-extract', label: 'Dust extraction/ventilation plan', required: true },
          ],
          checklists: [
            { id: 'uk-carp-dust', label: 'Dust controls active', required: true },
            { id: 'uk-carp-tools', label: 'Tool safety checks complete', required: true },
            { id: 'uk-carp-handover', label: 'Material approvals and method statements uploaded', required: true },
          ],
        },
        {
          tradeId: 'flooring',
          tradeLabel: 'Flooring and Tiling',
          tradeLabelLocalizations: { en: 'Flooring and Tiling' },
          projectScope: 'all',
          requirements: [
            { id: 'uk-floor-coshh', title: 'Silica dust and adhesives controls', description: 'COSHH applies to dust and adhesives.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'uk-floor-docs', title: 'Subfloor and moisture documentation', description: 'Record subfloor condition and moisture tests before installation.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'uk-floor-coshh', label: 'COSHH assessment for dust/adhesives', required: true },
            { id: 'uk-floor-sds', label: 'SDS for adhesives/grouts', required: true },
          ],
          checklists: [
            { id: 'uk-floor-dust', label: 'Dust control plan active', required: true },
            { id: 'uk-floor-ppe', label: 'PPE in use', required: true },
            { id: 'uk-floor-moisture', label: 'Moisture test results uploaded', required: true },
          ],
        },
        {
          tradeId: 'plastering',
          tradeLabel: 'Plastering and Drywall',
          tradeLabelLocalizations: { en: 'Plastering and Drywall' },
          projectScope: 'all',
          requirements: [
            { id: 'uk-plaster-coshh', title: 'Dust controls', description: 'COSHH applies to dust and compounds.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'uk-plaster-docs', title: 'Surface prep and finish documentation', description: 'Record surface preparation and finish specification.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'uk-plaster-coshh', label: 'COSHH assessment for dust/compounds', required: true },
            { id: 'uk-plaster-sds', label: 'SDS for compounds', required: true },
          ],
          checklists: [
            { id: 'uk-plaster-dust', label: 'Dust control plan active', required: true },
            { id: 'uk-plaster-finish', label: 'Surface prep and finish recorded', required: true },
          ],
        },
        {
          tradeId: 'glazing',
          tradeLabel: 'Glazing and Windows',
          tradeLabelLocalizations: { en: 'Glazing and Windows' },
          projectScope: 'all',
          requirements: [
            { id: 'uk-glaze-coshh', title: 'Sealant handling controls', description: 'COSHH applies to sealants and adhesives.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'uk-glaze-docs', title: 'Safety glazing documentation', description: 'Record safety glass specification and installation location.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'uk-glaze-sds', label: 'SDS for sealants', required: true },
            { id: 'uk-glaze-handling', label: 'Glass handling and lifting plan', required: true },
          ],
          checklists: [
            { id: 'uk-glaze-lift', label: 'Safe lifting/handling in place', required: true },
            { id: 'uk-glaze-safety', label: 'Safety glass schedule uploaded', required: true },
          ],
        },
        {
          tradeId: 'insulation',
          tradeLabel: 'Insulation',
          tradeLabelLocalizations: { en: 'Insulation' },
          projectScope: 'all',
          requirements: [
            { id: 'uk-insul-coshh', title: 'Fiber handling controls', description: 'COSHH applies to insulation fibers and dust.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'uk-insul-docs', title: 'Thermal performance documentation', description: 'Record insulation type, thickness, and performance values.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'uk-insul-sds', label: 'SDS for insulation products', required: true },
            { id: 'uk-insul-ppe', label: 'PPE and dust control plan', required: true },
          ],
          checklists: [
            { id: 'uk-insul-dust', label: 'Dust controls active', required: true },
            { id: 'uk-insul-thermal', label: 'Insulation specs and thickness recorded', required: true },
          ],
        },
        {
          tradeId: 'masonry',
          tradeLabel: 'Masonry and Brickwork',
          tradeLabelLocalizations: { en: 'Masonry and Brickwork' },
          projectScope: 'all',
          requirements: [
            { id: 'uk-masonry-coshh', title: 'Cement and silica dust controls', description: 'COSHH applies to cement and dust.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'uk-masonry-docs', title: 'Mortar mix and material documentation', description: 'Record mortar mix design and block/brick specifications.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'uk-masonry-sds', label: 'SDS for mortar/cement', required: true },
            { id: 'uk-masonry-dust', label: 'Dust control plan', required: true },
          ],
          checklists: [
            { id: 'uk-masonry-ppe', label: 'PPE in use', required: true },
            { id: 'uk-masonry-mix', label: 'Mortar mix and materials recorded', required: true },
          ],
        },
        {
          tradeId: 'concrete',
          tradeLabel: 'Concrete and Structural',
          tradeLabelLocalizations: { en: 'Concrete and Structural' },
          projectScope: 'all',
          requirements: [
            { id: 'uk-concrete-coshh', title: 'Wet cement controls', description: 'COSHH applies to wet cement.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'uk-concrete-docs', title: 'Pour and curing records', description: 'Maintain concrete pour logs and curing/strength records.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'uk-concrete-sds', label: 'SDS for cement/admixtures', required: true },
            { id: 'uk-concrete-ppe', label: 'PPE and wash station plan', required: true },
          ],
          checklists: [
            { id: 'uk-concrete-safety', label: 'Skin/eye protection measures in place', required: true },
            { id: 'uk-concrete-pour', label: 'Pour log and curing records uploaded', required: true },
          ],
        },
        {
          tradeId: 'demolition',
          tradeLabel: 'Demolition and Strip-out',
          tradeLabelLocalizations: { en: 'Demolition and Strip-out' },
          projectScope: 'all',
          requirements: [
            { id: 'uk-demo-coshh', title: 'Dust and hazardous materials control', description: 'COSHH applies to dust and hazardous materials.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'uk-demo-docs', title: 'Survey and waste documentation', description: 'Maintain survey records and waste transfer documentation.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'uk-demo-dust', label: 'Dust suppression plan', required: true },
            { id: 'uk-demo-waste', label: 'Waste disposal records', required: true },
          ],
          checklists: [
            { id: 'uk-demo-risk', label: 'Demolition risk assessment complete', required: true },
            { id: 'uk-demo-waste-docs', label: 'Survey and waste transfer docs uploaded', required: true },
          ],
        },
        {
          tradeId: 'scaffolding',
          tradeLabel: 'Scaffolding and Work at Height',
          tradeLabelLocalizations: { en: 'Scaffolding and Work at Height' },
          projectScope: 'all',
          requirements: [
            { id: 'uk-scaffold-height', title: 'Work at height controls', description: 'Fall protection and inspection routines required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'uk-scaffold-docs', title: 'Inspection and tag documentation', description: 'Maintain inspection records and tagging status.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'uk-scaffold-inspect', label: 'Scaffold inspection log', required: true },
            { id: 'uk-scaffold-training', label: 'Training/competency record', required: true },
          ],
          checklists: [
            { id: 'uk-scaffold-check', label: 'Scaffold inspected before use', required: true },
            { id: 'uk-scaffold-daily', label: 'Daily pre-use checks recorded', required: true },
          ],
        },
        {
          tradeId: 'metalwork',
          tradeLabel: 'Metalwork and Welding',
          tradeLabelLocalizations: { en: 'Metalwork and Welding' },
          projectScope: 'all',
          requirements: [
            { id: 'uk-weld-coshh', title: 'Welding fumes controls', description: 'COSHH applies to welding fumes.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'uk-weld-docs', title: 'Welding procedure documentation', description: 'Maintain welding procedure and material traceability records.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'uk-weld-extract', label: 'Extraction/ventilation plan', required: true },
            { id: 'uk-weld-hot', label: 'Hot works permit', required: true },
          ],
          checklists: [
            { id: 'uk-weld-fire', label: 'Fire watch and hot works controls in place', required: true },
            { id: 'uk-weld-procedure', label: 'Welding procedure and material traceability uploaded', required: true },
          ],
        },
        {
          tradeId: 'waterproofing',
          tradeLabel: 'Waterproofing and Sealants',
          tradeLabelLocalizations: { en: 'Waterproofing and Sealants' },
          projectScope: 'all',
          requirements: [
            { id: 'uk-water-coshh', title: 'Sealant/solvent controls', description: 'COSHH applies to sealants and solvents.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'uk-water-docs', title: 'Waterproofing system documentation', description: 'Maintain product approvals, details, and testing records.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'uk-water-sds', label: 'SDS for sealants', required: true },
            { id: 'uk-water-ppe', label: 'PPE and ventilation plan', required: true },
          ],
          checklists: [
            { id: 'uk-water-vent', label: 'Ventilation in place', required: true },
            { id: 'uk-water-test', label: 'Waterproofing test/inspection recorded', required: true },
          ],
        },
        {
          tradeId: 'groundworks',
          tradeLabel: 'Groundworks and Excavation',
          tradeLabelLocalizations: { en: 'Groundworks and Excavation' },
          projectScope: 'all',
          requirements: [
            { id: 'uk-ground-risk', title: 'Excavation safety controls', description: 'Risk assessment and utility avoidance required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'uk-ground-docs', title: 'Permit and shoring documentation', description: 'Maintain permits, shoring designs, and trench inspections.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'uk-ground-permit', label: 'Permit to dig / utility locate records', required: true },
            { id: 'uk-ground-soil', label: 'Soil contamination assessment (if applicable)', required: false },
          ],
          checklists: [
            { id: 'uk-ground-utilities', label: 'Utilities located and marked', required: true },
            { id: 'uk-ground-permit-docs', label: 'Permit to dig and inspections uploaded', required: true },
          ],
        },
        {
          tradeId: 'paving',
          tradeLabel: 'Paving and Landscaping',
          tradeLabelLocalizations: { en: 'Paving and Landscaping' },
          projectScope: 'all',
          requirements: [
            { id: 'uk-pave-coshh', title: 'Chemical and dust controls', description: 'COSHH applies to dust and chemicals.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'uk-pave-docs', title: 'Drainage and falls documentation', description: 'Record drainage design, falls, and sub-base preparation.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'uk-pave-coshh', label: 'COSHH assessment for dust/chemicals', required: true },
          ],
          checklists: [
            { id: 'uk-pave-ppe', label: 'PPE in use', required: true },
            { id: 'uk-pave-drainage', label: 'Drainage falls and sub-base checks recorded', required: true },
          ],
        },
        {
          tradeId: 'fire_protection',
          tradeLabel: 'Fire Protection',
          tradeLabelLocalizations: { en: 'Fire Protection' },
          projectScope: 'all',
          requirements: [
            { id: 'uk-fire-regs', title: 'Fire safety compliance', description: 'Fire stopping and systems must meet building regulations.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'uk-fire-docs', title: 'Fire system documentation', description: 'Maintain product certifications, installation records, and commissioning data.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'uk-fire-install-method', title: 'Tested system installation', description: 'Fire stopping must be installed to tested system details and manufacturer guidance.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'uk-fire-cert', label: 'Fire stopping product certification', required: true },
            { id: 'uk-fire-commission', label: 'Alarm/sprinkler commissioning certificates', required: false },
          ],
          checklists: [
            { id: 'uk-fire-install', label: 'Fire stopping installed per spec', required: true },
            { id: 'uk-fire-trace', label: 'Fire product certifications and commissioning uploaded', required: true },
            { id: 'uk-fire-photo', label: 'Fire stopping photo evidence captured', required: true },
          ],
        },
        {
          tradeId: 'solar_pv',
          tradeLabel: 'Solar and PV',
          tradeLabelLocalizations: { en: 'Solar and PV' },
          projectScope: 'all',
          requirements: [
            { id: 'uk-solar-part-l', title: 'Part L energy compliance', description: 'Solar systems must be accounted for in energy compliance.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'uk-solar-docs', title: 'PV documentation and handover', description: 'Provide commissioning results, inverter settings, and O&M manuals.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'uk-solar-grid', title: 'Grid connection compliance', description: 'Comply with applicable grid connection notification requirements.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'uk-solar-commission', label: 'PV/solar commissioning certificate', required: true },
            { id: 'uk-solar-om', label: 'O and M manual and warranty', required: true },
          ],
          checklists: [
            { id: 'uk-solar-signoff', label: 'Electrical signoff completed', required: true },
            { id: 'uk-solar-handover', label: 'PV commissioning and O&M pack uploaded', required: true },
            { id: 'uk-solar-grid-check', label: 'Grid notification recorded', required: true },
          ],
        },
        {
          tradeId: 'elevators',
          tradeLabel: 'Elevators and Lifts',
          tradeLabelLocalizations: { en: 'Elevators and Lifts' },
          projectScope: 'all',
          requirements: [
            { id: 'uk-lift-safety', title: 'Lift safety certification', description: 'Installations require certification and periodic inspections.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'uk-lift-docs', title: 'Lift handover and maintenance documentation', description: 'Provide commissioning, inspection, and maintenance handover records.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'uk-lift-loler', title: 'LOLER/PUWER inspections', description: 'Ensure inspections align with lifting equipment safety requirements.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'uk-lift-install', label: 'Installation certificate', required: true },
            { id: 'uk-lift-inspect', label: 'Periodic inspection logs', required: true },
          ],
          checklists: [
            { id: 'uk-lift-commission', label: 'Commissioning completed', required: true },
            { id: 'uk-lift-handover', label: 'Maintenance and inspection handover uploaded', required: true },
            { id: 'uk-lift-inspect-check', label: 'Inspection schedule recorded', required: true },
          ],
        },
      ],
      registryChecks: [
        {
          id: 'uk-competent-person-scheme',
          label: 'Competent Person Scheme verification',
          description: 'Verify scheme membership for domestic electrical work.',
          inputs: [
            { key: 'membershipNumber', label: 'Membership number', required: true },
            { key: 'schemeProvider', label: 'Scheme provider', required: true },
          ],
          outputs: [
            { key: 'status', label: 'Registration status', required: true },
            { key: 'expiryDate', label: 'Expiry date', required: false },
            { key: 'scope', label: 'Scope of work', required: true },
          ],
        },
        {
          id: 'uk-gas-safe',
          label: 'Gas Safe verification',
          description: 'Verify Gas Safe registration and scope.',
          inputs: [
            { key: 'registrationNumber', label: 'Registration number', required: true },
          ],
          outputs: [
            { key: 'status', label: 'Registration status', required: true },
            { key: 'scope', label: 'Scope of appliances', required: true },
            { key: 'expiryDate', label: 'Expiry date', required: true },
          ],
        },
        {
          id: 'uk-fgas',
          label: 'F-gas verification',
          description: 'Verify F-gas company and personnel certification.',
          inputs: [
            { key: 'companyReg', label: 'Company registration number', required: true },
          ],
          outputs: [
            { key: 'status', label: 'Certification status', required: true },
            { key: 'expiryDate', label: 'Expiry date', required: true },
            { key: 'personnel', label: 'Certified personnel list', required: true },
          ],
        },
      ],
    },
    {
      country: 'NL',
      trades: [
        {
          tradeId: 'electrician',
          tradeLabel: 'Electrician',
          tradeLabelLocalizations: { en: 'Electrician', nl: 'Elektricien' },
          projectScope: 'all',
          requirements: [
            { id: 'nl-elec-arbowet', title: 'Arbowet compliance', description: 'Work must comply with Working Conditions Act and risk assessment.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-elec-nen1010', title: 'NEN 1010 compliance', description: 'Low voltage installation standard for design and installation.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-elec-nen3140', title: 'NEN 3140 compliance', description: 'Safe operation and inspection procedures for electrical installations.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-elec-docs', title: 'Documentation and handover', description: 'Provide test results, as-built documentation, and user guidance.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-elec-inspect', title: 'Periodic inspection planning', description: 'Define inspection intervals and document NEN 3140 inspection plan.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'nl-elec-nen1010', label: 'NEN 1010 compliance evidence', required: true },
            { id: 'nl-elec-nen3140', label: 'NEN 3140 procedures and inspection logs', required: true },
            { id: 'nl-elec-rie', label: 'Risk assessment (RI and E)', required: true },
          ],
          checklists: [
            { id: 'nl-elec-test', label: 'Testing and inspection completed', required: true },
            { id: 'nl-elec-handover', label: 'As-built documentation uploaded', required: true },
            { id: 'nl-elec-plan', label: 'NEN 3140 inspection plan recorded', required: true },
          ],
        },
        {
          tradeId: 'gas',
          tradeLabel: 'Gas',
          tradeLabelLocalizations: { en: 'Gas', nl: 'Gas' },
          projectScope: 'all',
          requirements: [
            { id: 'nl-gas-arbowet', title: 'Arbowet compliance', description: 'Gas work follows safety requirements and NEN standards.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-gas-nen1078', title: 'NEN 1078/8078 guidance', description: 'Gas pipework guidance via NPR 3378-4.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-gas-docs', title: 'Tightness testing and documentation', description: 'Maintain tightness test and commissioning records.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-gas-vent', title: 'Ventilation and combustion safety', description: 'Confirm ventilation and combustion air requirements are met.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'nl-gas-nen', label: 'NEN 1078/8078 compliance evidence', required: true },
            { id: 'nl-gas-npr', label: 'NPR 3378 guidance notes', required: false },
            { id: 'nl-gas-flue', label: 'NEN 2757 flue system checks', required: false },
          ],
          checklists: [
            { id: 'nl-gas-commission', label: 'Commissioning and safety checks recorded', required: true },
            { id: 'nl-gas-isolation', label: 'Emergency isolation labeling confirmed', required: true },
            { id: 'nl-gas-vent-check', label: 'Ventilation checks documented', required: true },
          ],
        },
        {
          tradeId: 'plumbing_hvac',
          tradeLabel: 'Plumbing and HVAC',
          tradeLabelLocalizations: { en: 'Plumbing and HVAC', nl: 'Loodgieter en HVAC' },
          projectScope: 'all',
          requirements: [
            { id: 'nl-plumb-nen1006', title: 'NEN 1006 compliance', description: 'Drinking water installations must meet NEN 1006 requirements.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-plumb-bbl', title: 'BBL compliance', description: 'Building requirements for installations under BBL.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-plumb-fgas', title: 'F-gas compliance for refrigerants', description: 'Refrigerant handling requires F-gas certified personnel/company.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-plumb-stek', title: 'STEK-certificering voor koudemiddelen', description: 'Bedrijfscertificering verplicht voor werken met koudemiddelen (STEK).', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-plumb-fgas-reg', title: 'F-gassenregistratie (EU 517/2014)', description: 'Registratie en rapportage van gefluoreerde broeikasgassen conform EU-verordening 517/2014.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-plumb-docs', title: 'Commissioning and handover', description: 'Provide commissioning results and maintenance guidance.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-plumb-legionella', title: 'Legionella prevention', description: 'Apply water hygiene controls and document legionella prevention measures.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'nl-plumb-nen1006', label: 'NEN 1006 compliance evidence', required: true },
            { id: 'nl-plumb-commission', label: 'Pressure test and commissioning record', required: true },
            { id: 'nl-plumb-fgas', label: 'F-gas certification + handling log', required: false },
          ],
          checklists: [
            { id: 'nl-plumb-water', label: 'Water hygiene and commissioning complete', required: true },
            { id: 'nl-plumb-handover', label: 'O&M documents uploaded', required: true },
            { id: 'nl-plumb-hygiene', label: 'Legionella controls documented', required: true },
          ],
        },
        {
          tradeId: 'roofing_envelope',
          tradeLabel: 'Roofing and Envelope',
          tradeLabelLocalizations: { en: 'Roofing and Envelope', nl: 'Dakbedekking en Gevel' },
          projectScope: 'all',
          requirements: [
            { id: 'nl-roof-bbl', title: 'BBL compliance', description: 'Roof and envelope must meet BBL requirements.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-roof-docs', title: 'Envelope documentation', description: 'Provide as-built details, product approvals, and warranties.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-roof-structure', title: 'Structural and wind loading checks', description: 'Confirm structural capacity and wind loading compliance for roof systems.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'nl-roof-struct', label: 'Structural calculations and drawings', required: true },
            { id: 'nl-roof-water', label: 'Roof build-up and waterproofing system proof', required: true },
            { id: 'nl-roof-thermal', label: 'Thermal performance evidence', required: true },
          ],
          checklists: [
            { id: 'nl-roof-check', label: 'Roof system installed per design', required: true },
            { id: 'nl-roof-handover', label: 'Roof build-up and warranty docs uploaded', required: true },
            { id: 'nl-roof-structure-check', label: 'Structural and wind load checks recorded', required: true },
          ],
        },
        {
          tradeId: 'energy_renovation',
          tradeLabel: 'Energy Renovation',
          tradeLabelLocalizations: { en: 'Energy Renovation', nl: 'Energierenovatie' },
          projectScope: 'renovation',
          requirements: [
            { id: 'nl-energy-beng', title: 'BENG compliance', description: 'Energy performance must meet BENG/BBL requirements.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-energy-docs', title: 'Energy documentation and handover', description: 'Provide calculations, commissioning results, and user guidance.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-energy-vent', title: 'Ventilation provision', description: 'Ensure ventilation performance is documented after retrofit.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'nl-energy-beng', label: 'BENG calculations (NTA 8800)', required: true },
            { id: 'nl-energy-ep', label: 'Energy label registration', required: true },
          ],
          checklists: [
            { id: 'nl-energy-impact', label: 'BENG impact documented', required: true },
            { id: 'nl-energy-handover', label: 'Energy compliance documents uploaded', required: true },
            { id: 'nl-energy-vent-check', label: 'Ventilation performance recorded', required: true },
          ],
        },
        { tradeId: 'painting', tradeLabel: 'Painting and Decorating', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Painting and Decorating', nl: 'Schilderen en Afwerking' },
          requirements: [{ id: 'nl-paint-arbowet', title: 'Arbowet compliance', description: 'Hazardous substances and risk assessment required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-paint-docs', title: 'Product and waste documentation', description: 'Maintain product data sheets and waste handling records.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'nl-paint-rie', label: 'RI and E with hazardous substances', required: true }, { id: 'nl-paint-sds', label: 'SDS for coatings', required: true }],
          checklists: [{ id: 'nl-paint-ppe', label: 'PPE and ventilation in place', required: true }, { id: 'nl-paint-waste', label: 'Waste handling recorded', required: true }] },
        { tradeId: 'carpentry', tradeLabel: 'Carpentry and Joinery', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Carpentry and Joinery', nl: 'Timmerwerk en Schrijnwerk' },
          requirements: [{ id: 'nl-carp-arbowet', title: 'Arbowet compliance', description: 'Wood dust controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-carp-docs', title: 'Material documentation', description: 'Record timber treatment and fixings used.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'nl-carp-rie', label: 'RI and E for dust/manual handling', required: true }],
          checklists: [{ id: 'nl-carp-dust', label: 'Dust extraction active', required: true }, { id: 'nl-carp-handover', label: 'Material approvals uploaded', required: true }] },
        { tradeId: 'flooring', tradeLabel: 'Flooring and Tiling', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Flooring and Tiling', nl: 'Vloeren en Tegelwerk' },
          requirements: [{ id: 'nl-floor-arbowet', title: 'Arbowet compliance', description: 'Silica dust and adhesives controls.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-floor-docs', title: 'Subfloor documentation', description: 'Record subfloor condition and moisture tests.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'nl-floor-sds', label: 'SDS for adhesives/grouts', required: true }],
          checklists: [{ id: 'nl-floor-dust', label: 'Dust controls active', required: true }, { id: 'nl-floor-moisture', label: 'Moisture test results uploaded', required: true }] },
        { tradeId: 'plastering', tradeLabel: 'Plastering and Drywall', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Plastering and Drywall', nl: 'Stukadoorswerk en Gipsplaten' },
          requirements: [{ id: 'nl-plaster-arbowet', title: 'Arbowet compliance', description: 'Dust controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-plaster-docs', title: 'Surface preparation documentation', description: 'Record surface prep and finish specification.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'nl-plaster-sds', label: 'SDS for compounds', required: true }],
          checklists: [{ id: 'nl-plaster-dust', label: 'Dust controls active', required: true }, { id: 'nl-plaster-finish', label: 'Surface prep recorded', required: true }] },
        { tradeId: 'glazing', tradeLabel: 'Glazing and Windows', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Glazing and Windows', nl: 'Beglazing en Ramen' },
          requirements: [{ id: 'nl-glaze-arbowet', title: 'Arbowet compliance', description: 'Manual handling and sealant safety.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-glaze-docs', title: 'Safety glazing documentation', description: 'Record safety glass specification and location.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'nl-glaze-sds', label: 'SDS for sealants', required: true }],
          checklists: [{ id: 'nl-glaze-handling', label: 'Safe handling plan in place', required: true }, { id: 'nl-glaze-safety', label: 'Safety glass schedule uploaded', required: true }] },
        { tradeId: 'insulation', tradeLabel: 'Insulation', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Insulation', nl: 'Isolatie' },
          requirements: [{ id: 'nl-insul-arbowet', title: 'Arbowet compliance', description: 'Fiber exposure controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-insul-docs', title: 'Thermal performance documentation', description: 'Record insulation type, thickness, and performance values.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'nl-insul-sds', label: 'SDS for insulation products', required: true }],
          checklists: [{ id: 'nl-insul-ppe', label: 'PPE and dust control in place', required: true }, { id: 'nl-insul-thermal', label: 'Insulation specs recorded', required: true }] },
        { tradeId: 'masonry', tradeLabel: 'Masonry and Brickwork', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Masonry and Brickwork', nl: 'Metselwerk' },
          requirements: [{ id: 'nl-masonry-arbowet', title: 'Arbowet compliance', description: 'Cement and silica dust controls.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-masonry-docs', title: 'Material documentation', description: 'Record mortar mix and masonry materials used.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'nl-masonry-sds', label: 'SDS for mortar/cement', required: true }],
          checklists: [{ id: 'nl-masonry-dust', label: 'Dust controls active', required: true }, { id: 'nl-masonry-mix', label: 'Mortar mix recorded', required: true }] },
        { tradeId: 'concrete', tradeLabel: 'Concrete and Structural', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Concrete and Structural', nl: 'Beton en Constructie' },
          requirements: [{ id: 'nl-concrete-arbowet', title: 'Arbowet compliance', description: 'Wet cement controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-concrete-docs', title: 'Pour and curing records', description: 'Maintain pour logs and curing/strength records.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'nl-concrete-sds', label: 'SDS for cement/admixtures', required: true }],
          checklists: [{ id: 'nl-concrete-ppe', label: 'PPE and wash stations in place', required: true }, { id: 'nl-concrete-pour', label: 'Pour log uploaded', required: true }] },
        { tradeId: 'demolition', tradeLabel: 'Demolition and Strip-out', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Demolition and Strip-out', nl: 'Sloop en Strippen' },
          requirements: [{ id: 'nl-demo-arbowet', title: 'Arbowet compliance', description: 'Demolition hazards and dust controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-demo-docs', title: 'Survey and waste documentation', description: 'Maintain survey records and waste transfer documentation.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-demo-asbest-inv', title: 'Asbestinventarisatie verplicht (SC-540)', description: 'Asbestinventarisatie door gecertificeerd bureau (SC-540) vóór aanvang sloopwerkzaamheden.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-demo-asbest-verw', title: 'Gecertificeerd asbestverwijderingsbedrijf (SC-530)', description: 'Asbestverwijdering uitsluitend door SC-530 gecertificeerd bedrijf.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'nl-demo-waste', label: 'Waste disposal records', required: true }],
          checklists: [{ id: 'nl-demo-risk', label: 'Demolition risk assessment complete', required: true }, { id: 'nl-demo-waste-docs', label: 'Waste transfer docs uploaded', required: true }] },
        { tradeId: 'scaffolding', tradeLabel: 'Scaffolding and Work at Height', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Scaffolding and Work at Height', nl: 'Steigerbouw en Werken op Hoogte' },
          requirements: [{ id: 'nl-scaffold-arbowet', title: 'Arbowet compliance', description: 'Work at height controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-scaffold-docs', title: 'Inspection and tag documentation', description: 'Maintain inspection records and tagging status.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'nl-scaffold-inspect', label: 'Scaffold inspection log', required: true }],
          checklists: [{ id: 'nl-scaffold-check', label: 'Scaffold inspected before use', required: true }, { id: 'nl-scaffold-daily', label: 'Daily pre-use checks recorded', required: true }] },
        { tradeId: 'metalwork', tradeLabel: 'Metalwork and Welding', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Metalwork and Welding', nl: 'Metaalwerk en Lassen' },
          requirements: [{ id: 'nl-weld-arbowet', title: 'Arbowet compliance', description: 'Welding fume controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-weld-docs', title: 'Welding procedure documentation', description: 'Maintain welding procedures and material traceability.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'nl-weld-extract', label: 'Extraction and PPE plan', required: true }, { id: 'nl-weld-hot', label: 'Hot works permit', required: true }],
          checklists: [{ id: 'nl-weld-fire', label: 'Hot works controls active', required: true }, { id: 'nl-weld-procedure', label: 'Welding procedure uploaded', required: true }] },
        { tradeId: 'waterproofing', tradeLabel: 'Waterproofing and Sealants', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Waterproofing and Sealants', nl: 'Waterdichting en Kitten' },
          requirements: [{ id: 'nl-water-arbowet', title: 'Arbowet compliance', description: 'Sealant and solvent controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-water-docs', title: 'Waterproofing documentation', description: 'Maintain product approvals and testing records.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'nl-water-sds', label: 'SDS for sealants', required: true }],
          checklists: [{ id: 'nl-water-vent', label: 'Ventilation in place', required: true }, { id: 'nl-water-test', label: 'Waterproofing test recorded', required: true }] },
        { tradeId: 'groundworks', tradeLabel: 'Groundworks and Excavation', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Groundworks and Excavation', nl: 'Grondwerken en Uitgraving' },
          requirements: [{ id: 'nl-ground-arbowet', title: 'Arbowet compliance', description: 'Excavation safety controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-ground-docs', title: 'Permit and shoring documentation', description: 'Maintain permits, shoring designs, and inspections.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'nl-ground-permit', label: 'Utility locate and permit to dig', required: true }],
          checklists: [{ id: 'nl-ground-utilities', label: 'Utilities located and marked', required: true }, { id: 'nl-ground-permit-docs', label: 'Permit and inspection docs uploaded', required: true }] },
        { tradeId: 'paving', tradeLabel: 'Paving and Landscaping', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Paving and Landscaping', nl: 'Bestrating en Landschapsinrichting' },
          requirements: [{ id: 'nl-pave-arbowet', title: 'Arbowet compliance', description: 'Equipment and chemical safety controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-pave-docs', title: 'Drainage and falls documentation', description: 'Record drainage design, falls, and sub-base preparation.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'nl-pave-ppe', label: 'PPE and equipment checks', required: true }],
          checklists: [{ id: 'nl-pave-safe', label: 'Safe work setup confirmed', required: true }, { id: 'nl-pave-drainage', label: 'Drainage falls recorded', required: true }] },
        { tradeId: 'fire_protection', tradeLabel: 'Fire Protection', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Fire Protection', nl: 'Brandbeveiliging' },
          requirements: [{ id: 'nl-fire-bbl', title: 'BBL fire safety compliance', description: 'Fire safety systems must meet BBL requirements.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-fire-docs', title: 'Fire system documentation', description: 'Maintain product certifications and commissioning data.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-fire-tested', title: 'Tested system installation', description: 'Install fire stopping to tested system details and manufacturer guidance.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'nl-fire-cert', label: 'Fire system commissioning certificates', required: true }],
          checklists: [{ id: 'nl-fire-install', label: 'Fire system installed per spec', required: true }, { id: 'nl-fire-trace', label: 'Fire system docs uploaded', required: true }, { id: 'nl-fire-photo', label: 'Fire stopping photo evidence captured', required: true }] },
        { tradeId: 'solar_pv', tradeLabel: 'Solar and PV', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Solar and PV', nl: 'Zonne-energie en PV' },
          requirements: [{ id: 'nl-solar-beng', title: 'BENG impact documented', description: 'PV systems must be accounted for in energy performance.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-solar-docs', title: 'PV documentation and handover', description: 'Provide commissioning results, inverter settings, and O&M manuals.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-solar-grid', title: 'Grid connection compliance', description: 'Record distribution grid notifications or approvals where required.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'nl-solar-commission', label: 'PV commissioning certificate', required: true }],
          checklists: [{ id: 'nl-solar-signoff', label: 'Electrical signoff completed', required: true }, { id: 'nl-solar-handover', label: 'PV commissioning and O&M pack uploaded', required: true }, { id: 'nl-solar-grid-check', label: 'Grid notification recorded', required: true }] },
        { tradeId: 'elevators', tradeLabel: 'Elevators and Lifts', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Elevators and Lifts', nl: 'Liften' },
          requirements: [{ id: 'nl-lift-bbl', title: 'Lift safety compliance', description: 'Installations require certification and inspections.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-lift-docs', title: 'Lift handover and maintenance documentation', description: 'Provide commissioning, inspection, and maintenance handover records.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'nl-lift-inspect', title: 'Periodic inspection planning', description: 'Ensure periodic inspection schedule is documented and followed.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'nl-lift-install', label: 'Installation certificate', required: true }, { id: 'nl-lift-inspect', label: 'Periodic inspection logs', required: true }],
          checklists: [{ id: 'nl-lift-commission', label: 'Commissioning completed', required: true }, { id: 'nl-lift-handover', label: 'Maintenance handover uploaded', required: true }, { id: 'nl-lift-inspect-check', label: 'Inspection schedule recorded', required: true }] },
      ],
      registryChecks: [
        {
          id: 'nl-kvk',
          label: 'KVK registration check',
          description: 'Validate company registration in KVK.',
          inputs: [{ key: 'kvkNumber', label: 'KVK number', required: true }],
          outputs: [
            { key: 'status', label: 'Registration status', required: true },
            { key: 'legalForm', label: 'Legal form', required: true },
            { key: 'address', label: 'Registered address', required: true },
          ],
        },
        {
          id: 'nl-vca',
          label: 'VCA certificate check',
          description: 'Verify VCA diploma or certificate validity.',
          inputs: [
            { key: 'diplomaNumber', label: 'Diploma number', required: false },
            { key: 'holderName', label: 'Holder name', required: false },
            { key: 'dateOfBirth', label: 'Date of birth', required: false },
          ],
          outputs: [
            { key: 'status', label: 'Certificate status', required: true },
            { key: 'type', label: 'Certificate type', required: true },
            { key: 'validUntil', label: 'Valid until', required: true },
          ],
        },
        {
          id: 'nl-fgas',
          label: 'F-gas certification check',
          description: 'Verify company and personnel F-gas certification for refrigerants.',
          inputs: [
            { key: 'companyReg', label: 'Company registration number', required: true },
            { key: 'personnelId', label: 'Certified personnel ID', required: false },
          ],
          outputs: [
            { key: 'status', label: 'Certification status', required: true },
            { key: 'expiryDate', label: 'Expiry date', required: true },
            { key: 'scope', label: 'Scope/category', required: true },
          ],
        },
      ],
    },
    {
      country: 'DE',
      trades: [
        {
          tradeId: 'electrician',
          tradeLabel: 'Electrician',
          tradeLabelLocalizations: { en: 'Electrician', de: 'Elektriker' },
          projectScope: 'all',
          requirements: [
            { id: 'de-elec-hwo', title: 'Handwerksrolle registration', description: 'Electrical trade is regulated and requires Handwerksrolle registration.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-elec-vde', title: 'DIN VDE 0100 compliance', description: 'Low voltage installations must follow DIN VDE 0100 series.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-elec-docs', title: 'Documentation and handover', description: 'Provide test results, as-built documentation, and user guidance.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-elec-testing', title: 'VDE testing and inspection', description: 'Perform and document installation testing in line with VDE requirements.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'de-elec-handwerksrolle', label: 'Handwerksrolle registration proof', required: true },
            { id: 'de-elec-vde', label: 'VDE 0100 compliance/testing documentation', required: true },
          ],
          checklists: [
            { id: 'de-elec-testing', label: 'Testing and documentation complete', required: true },
            { id: 'de-elec-handover', label: 'As-built documentation uploaded', required: true },
            { id: 'de-elec-vde-check', label: 'VDE test results uploaded', required: true },
          ],
        },
        {
          tradeId: 'gas',
          tradeLabel: 'Gas',
          tradeLabelLocalizations: { en: 'Gas', de: 'Gas' },
          projectScope: 'all',
          requirements: [
            { id: 'de-gas-dvgw', title: 'DVGW/TRGI compliance', description: 'Gas installations must follow DVGW/TRGI rules.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-gas-docs', title: 'Tightness testing and documentation', description: 'Maintain tightness test and commissioning records.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-gas-vent', title: 'Ventilation and combustion safety', description: 'Confirm ventilation and combustion air requirements are met.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'de-gas-dvgw', label: 'DVGW/TRGI compliance checklist', required: true },
            { id: 'de-gas-test', label: 'Pressure/tightness test records', required: true },
          ],
          checklists: [
            { id: 'de-gas-commission', label: 'Commissioning tests recorded', required: true },
            { id: 'de-gas-isolation', label: 'Emergency isolation labeling confirmed', required: true },
            { id: 'de-gas-vent-check', label: 'Ventilation checks documented', required: true },
          ],
        },
        {
          tradeId: 'plumbing_hvac',
          tradeLabel: 'Plumbing and HVAC',
          tradeLabelLocalizations: { en: 'Plumbing and HVAC', de: 'Sanitär und HLK' },
          projectScope: 'all',
          requirements: [
            { id: 'de-plumb-trwi', title: 'TRWI compliance', description: 'Drinking water installations follow DIN EN 806 and DIN 1988 (TRWI).', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-plumb-fgas', title: 'F-gas compliance for refrigerants', description: 'Refrigerant handling requires F-gas certified personnel/company.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-plumb-docs', title: 'Commissioning and handover', description: 'Provide commissioning results and maintenance guidance.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-plumb-legionella', title: 'Water hygiene controls', description: 'Document water hygiene and legionella prevention measures.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'de-plumb-trwi', label: 'TRWI/DIN EN 806/DIN 1988 compliance checklist', required: true },
            { id: 'de-plumb-commission', label: 'Pressure test and commissioning record', required: true },
            { id: 'de-plumb-fgas', label: 'F-gas certification + handling log', required: false },
          ],
          checklists: [
            { id: 'de-plumb-hygiene', label: 'Hot water hygiene controls confirmed', required: true },
            { id: 'de-plumb-handover', label: 'O&M documents uploaded', required: true },
            { id: 'de-plumb-hygiene-docs', label: 'Water hygiene controls documented', required: true },
          ],
        },
        {
          tradeId: 'roofing_envelope',
          tradeLabel: 'Roofing and Envelope',
          tradeLabelLocalizations: { en: 'Roofing and Envelope', de: 'Dach und Gebäudehülle' },
          projectScope: 'all',
          requirements: [
            { id: 'de-roof-lbo', title: 'LBO/MBO compliance', description: 'Roofing must comply with state building codes.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-roof-geg', title: 'GEG energy compliance', description: 'Insulation and energy performance must meet GEG.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-roof-docs', title: 'Envelope documentation', description: 'Provide as-built details, product approvals, and warranties.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-roof-structure', title: 'Structural and wind loading checks', description: 'Confirm structural capacity and wind loading compliance for roof systems.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'de-roof-struct', label: 'Structural calculations and drawings', required: true },
            { id: 'de-roof-thermal', label: 'GEG insulation compliance evidence', required: true },
          ],
          checklists: [
            { id: 'de-roof-check', label: 'Roof system installed per approved design', required: true },
            { id: 'de-roof-handover', label: 'Roof build-up and warranty docs uploaded', required: true },
            { id: 'de-roof-structure-check', label: 'Structural and wind load checks recorded', required: true },
          ],
        },
        {
          tradeId: 'energy_renovation',
          tradeLabel: 'Energy Renovation',
          tradeLabelLocalizations: { en: 'Energy Renovation', de: 'Energiesanierung' },
          projectScope: 'renovation',
          requirements: [
            { id: 'de-energy-geg', title: 'GEG compliance', description: 'Energy renovation must meet GEG requirements.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-energy-docs', title: 'Energy documentation and handover', description: 'Provide calculations, commissioning results, and user guidance.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-energy-vent', title: 'Ventilation provision', description: 'Ensure ventilation performance is documented after retrofit.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'de-energy-ausweis', label: 'Energy certificate (Energieausweis)', required: true },
            { id: 'de-energy-commission', label: 'System commissioning records', required: true },
          ],
          checklists: [
            { id: 'de-energy-doc', label: 'GEG documentation complete', required: true },
            { id: 'de-energy-handover', label: 'Energy compliance documents uploaded', required: true },
            { id: 'de-energy-vent-check', label: 'Ventilation performance recorded', required: true },
          ],
        },
        { tradeId: 'painting', tradeLabel: 'Painting and Decorating', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Painting and Decorating', de: 'Maler- und Lackierarbeiten' },
          requirements: [{ id: 'de-paint-gefstoffv', title: 'GefStoffV compliance', description: 'Hazardous substances controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-paint-docs', title: 'Product and waste documentation', description: 'Maintain product data sheets and waste handling records.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'de-paint-sds', label: 'SDS for coatings', required: true }],
          checklists: [{ id: 'de-paint-ppe', label: 'PPE and ventilation in place', required: true }, { id: 'de-paint-waste', label: 'Waste handling recorded', required: true }] },
        { tradeId: 'carpentry', tradeLabel: 'Carpentry and Joinery', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Carpentry and Joinery', de: 'Zimmerei und Tischlerei' },
          requirements: [{ id: 'de-carp-gefstoffv', title: 'GefStoffV compliance', description: 'Wood dust controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-carp-docs', title: 'Material documentation', description: 'Record timber treatment and fixings used.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'de-carp-dust', label: 'Dust control plan', required: true }],
          checklists: [{ id: 'de-carp-dust', label: 'Dust controls active', required: true }, { id: 'de-carp-handover', label: 'Material approvals uploaded', required: true }] },
        { tradeId: 'flooring', tradeLabel: 'Flooring and Tiling', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Flooring and Tiling', de: 'Bodenbelaege und Fliesen' },
          requirements: [{ id: 'de-floor-gefstoffv', title: 'GefStoffV compliance', description: 'Silica dust and adhesives controls.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-floor-docs', title: 'Subfloor documentation', description: 'Record subfloor condition and moisture tests.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'de-floor-sds', label: 'SDS for adhesives', required: true }],
          checklists: [{ id: 'de-floor-dust', label: 'Dust controls active', required: true }, { id: 'de-floor-moisture', label: 'Moisture test results uploaded', required: true }] },
        { tradeId: 'plastering', tradeLabel: 'Plastering and Drywall', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Plastering and Drywall', de: 'Putz und Trockenbau' },
          requirements: [{ id: 'de-plaster-gefstoffv', title: 'GefStoffV compliance', description: 'Dust controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-plaster-docs', title: 'Surface preparation documentation', description: 'Record surface prep and finish specification.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'de-plaster-sds', label: 'SDS for compounds', required: true }],
          checklists: [{ id: 'de-plaster-dust', label: 'Dust controls active', required: true }, { id: 'de-plaster-finish', label: 'Surface prep recorded', required: true }] },
        { tradeId: 'glazing', tradeLabel: 'Glazing and Windows', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Glazing and Windows', de: 'Verglasung und Fenster' },
          requirements: [{ id: 'de-glaze-gefstoffv', title: 'GefStoffV compliance', description: 'Sealant and handling safety.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-glaze-docs', title: 'Safety glazing documentation', description: 'Record safety glass specification and location.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'de-glaze-sds', label: 'SDS for sealants', required: true }],
          checklists: [{ id: 'de-glaze-handling', label: 'Safe handling plan in place', required: true }, { id: 'de-glaze-safety', label: 'Safety glass schedule uploaded', required: true }] },
        { tradeId: 'insulation', tradeLabel: 'Insulation', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Insulation', de: 'Dämmung' },
          requirements: [{ id: 'de-insul-gefstoffv', title: 'GefStoffV compliance', description: 'Fiber exposure controls.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-insul-docs', title: 'Thermal performance documentation', description: 'Record insulation type, thickness, and performance values.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'de-insul-sds', label: 'SDS for insulation products', required: true }],
          checklists: [{ id: 'de-insul-ppe', label: 'PPE and dust control in place', required: true }, { id: 'de-insul-thermal', label: 'Insulation specs recorded', required: true }] },
        { tradeId: 'masonry', tradeLabel: 'Masonry and Brickwork', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Masonry and Brickwork', de: 'Mauerwerk' },
          requirements: [{ id: 'de-masonry-gefstoffv', title: 'GefStoffV compliance', description: 'Cement and silica dust controls.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-masonry-docs', title: 'Material documentation', description: 'Record mortar mix and masonry materials used.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'de-masonry-sds', label: 'SDS for mortar/cement', required: true }],
          checklists: [{ id: 'de-masonry-dust', label: 'Dust controls active', required: true }, { id: 'de-masonry-mix', label: 'Mortar mix recorded', required: true }] },
        { tradeId: 'concrete', tradeLabel: 'Concrete and Structural', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Concrete and Structural', de: 'Beton und Tragwerk' },
          requirements: [{ id: 'de-concrete-gefstoffv', title: 'GefStoffV compliance', description: 'Wet cement controls.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-concrete-docs', title: 'Pour and curing records', description: 'Maintain pour logs and curing/strength records.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'de-concrete-sds', label: 'SDS for cement/admixtures', required: true }],
          checklists: [{ id: 'de-concrete-ppe', label: 'PPE and wash stations in place', required: true }, { id: 'de-concrete-pour', label: 'Pour log uploaded', required: true }] },
        { tradeId: 'demolition', tradeLabel: 'Demolition and Strip-out', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Demolition and Strip-out', de: 'Abbruch und Rückbau' },
          requirements: [{ id: 'de-demo-gefstoffv', title: 'GefStoffV compliance', description: 'Demolition dust and hazardous materials controls.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-demo-docs', title: 'Survey and waste documentation', description: 'Maintain survey records and waste transfer documentation.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'de-demo-waste', label: 'Waste disposal records', required: true }],
          checklists: [{ id: 'de-demo-risk', label: 'Demolition risk assessment complete', required: true }, { id: 'de-demo-waste-docs', label: 'Waste transfer docs uploaded', required: true }] },
        { tradeId: 'scaffolding', tradeLabel: 'Scaffolding and Work at Height', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Scaffolding and Work at Height', de: 'Gerüstbau und Arbeiten in der Höhe' },
          requirements: [{ id: 'de-scaffold-safety', title: 'Work at height controls', description: 'Scaffold inspection and safety controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-scaffold-docs', title: 'Inspection and tag documentation', description: 'Maintain inspection records and tagging status.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'de-scaffold-inspect', label: 'Scaffold inspection log', required: true }],
          checklists: [{ id: 'de-scaffold-check', label: 'Scaffold inspected before use', required: true }, { id: 'de-scaffold-daily', label: 'Daily pre-use checks recorded', required: true }] },
        { tradeId: 'metalwork', tradeLabel: 'Metalwork and Welding', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Metalwork and Welding', de: 'Metallbau und Schweißen' },
          requirements: [{ id: 'de-weld-gefstoffv', title: 'GefStoffV compliance', description: 'Welding fume controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-weld-docs', title: 'Welding procedure documentation', description: 'Maintain welding procedures and material traceability.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'de-weld-extract', label: 'Extraction and PPE plan', required: true }, { id: 'de-weld-hot', label: 'Hot works permit', required: true }],
          checklists: [{ id: 'de-weld-fire', label: 'Hot works controls active', required: true }, { id: 'de-weld-procedure', label: 'Welding procedure uploaded', required: true }] },
        { tradeId: 'waterproofing', tradeLabel: 'Waterproofing and Sealants', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Waterproofing and Sealants', de: 'Abdichtung und Dichtstoffe' },
          requirements: [{ id: 'de-water-gefstoffv', title: 'GefStoffV compliance', description: 'Sealant and solvent controls.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-water-docs', title: 'Waterproofing documentation', description: 'Maintain product approvals and testing records.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'de-water-sds', label: 'SDS for sealants', required: true }],
          checklists: [{ id: 'de-water-vent', label: 'Ventilation in place', required: true }, { id: 'de-water-test', label: 'Waterproofing test recorded', required: true }] },
        { tradeId: 'groundworks', tradeLabel: 'Groundworks and Excavation', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Groundworks and Excavation', de: 'Tiefbau und Erdarbeiten' },
          requirements: [{ id: 'de-ground-safety', title: 'Excavation safety controls', description: 'Risk assessment and utility avoidance required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-ground-docs', title: 'Permit and shoring documentation', description: 'Maintain permits, shoring designs, and inspections.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'de-ground-permit', label: 'Utility locate and permit to dig', required: true }],
          checklists: [{ id: 'de-ground-utilities', label: 'Utilities located and marked', required: true }, { id: 'de-ground-permit-docs', label: 'Permit and inspection docs uploaded', required: true }] },
        { tradeId: 'paving', tradeLabel: 'Paving and Landscaping', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Paving and Landscaping', de: 'Pflaster- und Landschaftsbau' },
          requirements: [{ id: 'de-pave-gefstoffv', title: 'GefStoffV compliance', description: 'Chemical and equipment safety controls.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-pave-docs', title: 'Drainage and falls documentation', description: 'Record drainage design, falls, and sub-base preparation.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'de-pave-ppe', label: 'PPE and equipment checks', required: true }],
          checklists: [{ id: 'de-pave-safe', label: 'Safe work setup confirmed', required: true }, { id: 'de-pave-drainage', label: 'Drainage falls recorded', required: true }] },
        { tradeId: 'fire_protection', tradeLabel: 'Fire Protection', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Fire Protection', de: 'Brandschutz' },
          requirements: [{ id: 'de-fire-lbo', title: 'Fire safety compliance', description: 'Fire systems must meet LBO and approvals.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-fire-docs', title: 'Fire system documentation', description: 'Maintain product certifications and commissioning data.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-fire-tested', title: 'Tested system installation', description: 'Install fire stopping to tested system details and manufacturer guidance.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'de-fire-cert', label: 'Fire stopping approvals/certifications', required: true }],
          checklists: [{ id: 'de-fire-install', label: 'Fire system installed per spec', required: true }, { id: 'de-fire-trace', label: 'Fire system docs uploaded', required: true }, { id: 'de-fire-photo', label: 'Fire stopping photo evidence captured', required: true }] },
        { tradeId: 'solar_pv', tradeLabel: 'Solar and PV', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Solar and PV', de: 'Solar und PV' },
          requirements: [{ id: 'de-solar-geg', title: 'GEG energy compliance', description: 'PV systems must be documented in energy compliance.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-solar-docs', title: 'PV documentation and handover', description: 'Provide commissioning results, inverter settings, and O&M manuals.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-solar-grid', title: 'Grid connection compliance', description: 'Record distribution grid notifications or approvals where required.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'de-solar-commission', label: 'PV commissioning certificate', required: true }],
          checklists: [{ id: 'de-solar-signoff', label: 'Electrical signoff completed', required: true }, { id: 'de-solar-handover', label: 'PV commissioning and O&M pack uploaded', required: true }, { id: 'de-solar-grid-check', label: 'Grid notification recorded', required: true }] },
        { tradeId: 'elevators', tradeLabel: 'Elevators and Lifts', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Elevators and Lifts', de: 'Aufzüge und Lifte' },
          requirements: [{ id: 'de-lift-safety', title: 'Lift safety compliance', description: 'Installations require certification and inspections.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-lift-docs', title: 'Lift handover and maintenance documentation', description: 'Provide commissioning, inspection, and maintenance handover records.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'de-lift-inspect', title: 'Periodic inspection planning', description: 'Ensure periodic inspection schedule is documented and followed.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'de-lift-install', label: 'Installation certificate', required: true }, { id: 'de-lift-inspect', label: 'Periodic inspection logs', required: true }],
          checklists: [{ id: 'de-lift-commission', label: 'Commissioning completed', required: true }, { id: 'de-lift-handover', label: 'Maintenance handover uploaded', required: true }, { id: 'de-lift-inspect-check', label: 'Inspection schedule recorded', required: true }] },
      ],
      registryChecks: [
        {
          id: 'de-handwerksrolle',
          label: 'Handwerksrolle registration check',
          description: 'Verify company registration for regulated trades.',
          inputs: [{ key: 'companyName', label: 'Company name', required: true }],
          outputs: [
            { key: 'status', label: 'Registration status', required: true },
            { key: 'trade', label: 'Registered trade', required: true },
            { key: 'chamber', label: 'Responsible chamber', required: true },
          ],
        },
        {
          id: 'de-dvgw',
          label: 'DVGW/TRGI verification',
          description: 'Verify gas installation qualification and scope.',
          inputs: [
            { key: 'companyName', label: 'Company name', required: true },
            { key: 'registrationId', label: 'Registration ID', required: false },
          ],
          outputs: [
            { key: 'status', label: 'Qualification status', required: true },
            { key: 'scope', label: 'Scope of gas work', required: true },
            { key: 'validUntil', label: 'Valid until', required: false },
          ],
        },
      ],
    },
    {
      country: 'FR',
      trades: [
        {
          tradeId: 'electrician',
          tradeLabel: 'Electrician',
          tradeLabelLocalizations: { en: 'Electrician', fr: 'Électricien' },
          projectScope: 'all',
          requirements: [
            { id: 'fr-elec-nfc15', title: 'NF C 15-100 compliance', description: 'Low voltage installations must meet NF C 15-100.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'fr-elec-consuel', title: 'CONSUEL attestation', description: 'Conformity attestation required before first energization.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'fr-elec-docs', title: 'Documentation and handover', description: 'Provide test results, as-built documentation, and user guidance.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'fr-elec-testing', title: 'Testing and conformity', description: 'Perform and document installation testing per NF C 15-100 and CONSUEL requirements.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'fr-elec-nfc15', label: 'NF C 15-100 compliance evidence', required: true },
            { id: 'fr-elec-consuel', label: 'CONSUEL attestation', required: true },
          ],
          checklists: [
            { id: 'fr-elec-test', label: 'Testing and conformity documents prepared', required: true },
            { id: 'fr-elec-handover', label: 'As-built documentation uploaded', required: true },
            { id: 'fr-elec-consuel-check', label: 'CONSUEL dossier prepared and recorded', required: true },
          ],
        },
        {
          tradeId: 'gas',
          tradeLabel: 'Gas',
          tradeLabelLocalizations: { en: 'Gas', fr: 'Gaz' },
          projectScope: 'all',
          requirements: [
            { id: 'fr-gas-dtu611', title: 'NF DTU 61.1 compliance', description: 'Domestic gas installations must follow NF DTU 61.1.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'fr-gas-docs', title: 'Tightness testing and documentation', description: 'Maintain tightness test and commissioning records.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'fr-gas-vent', title: 'Ventilation and combustion safety', description: 'Confirm ventilation and combustion air requirements are met.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'fr-gas-dtu', label: 'NF DTU 61.1 compliance evidence', required: true },
            { id: 'fr-gas-cert', label: 'Gas installation certificate (if required)', required: false },
          ],
          checklists: [
            { id: 'fr-gas-commission', label: 'Commissioning checks recorded', required: true },
            { id: 'fr-gas-isolation', label: 'Emergency isolation labeling confirmed', required: true },
            { id: 'fr-gas-vent-check', label: 'Ventilation checks documented', required: true },
          ],
        },
        {
          tradeId: 'plumbing_hvac',
          tradeLabel: 'Plumbing and HVAC',
          tradeLabelLocalizations: { en: 'Plumbing and HVAC', fr: 'Plomberie et CVC' },
          projectScope: 'all',
          requirements: [
            { id: 'fr-plumb-dtu601', title: 'NF DTU 60.1 compliance', description: 'Plumbing installations must follow NF DTU 60.1.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'fr-plumb-fgas', title: 'F-gas compliance for refrigerants', description: 'Refrigerant handling requires F-gas certified personnel/company.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'fr-plumb-docs', title: 'Commissioning and handover', description: 'Provide commissioning results and maintenance guidance.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'fr-plumb-hygiene', title: 'Water hygiene controls', description: 'Document water hygiene and legionella prevention measures.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'fr-plumb-dtu', label: 'NF DTU 60.1 compliance evidence', required: true },
            { id: 'fr-plumb-commission', label: 'Pressure test and commissioning record', required: true },
            { id: 'fr-plumb-fgas', label: 'F-gas certification + handling log', required: false },
          ],
          checklists: [
            { id: 'fr-plumb-hot', label: 'Hot water safety controls verified', required: true },
            { id: 'fr-plumb-handover', label: 'O&M documents uploaded', required: true },
            { id: 'fr-plumb-hygiene-docs', label: 'Water hygiene controls documented', required: true },
          ],
        },
        {
          tradeId: 'roofing_envelope',
          tradeLabel: 'Roofing and Envelope',
          tradeLabelLocalizations: { en: 'Roofing and Envelope', fr: 'Toiture et Enveloppe' },
          projectScope: 'all',
          requirements: [
            { id: 'fr-roof-dtu', title: 'NF DTU roofing compliance', description: 'Roofing must follow relevant NF DTU rules.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'fr-roof-docs', title: 'Envelope documentation', description: 'Provide as-built details, product approvals, and warranties.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'fr-roof-structure', title: 'Structural and wind loading checks', description: 'Confirm structural capacity and wind loading compliance for roof systems.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'fr-roof-water', label: 'Waterproofing system documentation', required: true },
          ],
          checklists: [
            { id: 'fr-roof-check', label: 'Roof system installed per DTU', required: true },
            { id: 'fr-roof-handover', label: 'Roof build-up and warranty docs uploaded', required: true },
            { id: 'fr-roof-structure-check', label: 'Structural and wind load checks recorded', required: true },
          ],
        },
        {
          tradeId: 'energy_renovation',
          tradeLabel: 'Energy Renovation',
          tradeLabelLocalizations: { en: 'Energy Renovation', fr: 'Rénovation énergétique' },
          projectScope: 'renovation',
          requirements: [
            { id: 'fr-re2020', title: 'RE2020 compliance', description: 'Energy and environmental requirements for new construction.', level: 'mandatory', roleScope: 'contractor', applicabilityNotes: 'Applies to new build; renovation uses applicable energy performance rules.' },
            { id: 'fr-energy-docs', title: 'Energy documentation and handover', description: 'Provide calculations, commissioning results, and user guidance.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'fr-energy-vent', title: 'Ventilation provision', description: 'Ensure ventilation performance is documented after retrofit.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'fr-dpe', label: 'Energy performance certificate (DPE)', required: true },
          ],
          checklists: [
            { id: 'fr-energy-doc', label: 'RE2020 or energy documentation complete', required: true },
            { id: 'fr-energy-handover', label: 'Energy compliance documents uploaded', required: true },
            { id: 'fr-energy-vent-check', label: 'Ventilation performance recorded', required: true },
          ],
        },
        { tradeId: 'painting', tradeLabel: 'Painting and Decorating', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Painting and Decorating', fr: 'Peinture et Décoration' },
          requirements: [{ id: 'fr-paint-duerp', title: 'DUERP risk assessment', description: 'Risk assessment for paints and solvents required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'fr-paint-docs', title: 'Product and waste documentation', description: 'Maintain product data sheets and waste handling records.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'fr-paint-sds', label: 'SDS for coatings', required: true }],
          checklists: [{ id: 'fr-paint-ppe', label: 'PPE and ventilation in place', required: true }, { id: 'fr-paint-waste', label: 'Waste handling recorded', required: true }] },
        { tradeId: 'carpentry', tradeLabel: 'Carpentry and Joinery', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Carpentry and Joinery', fr: 'Menuiserie' },
          requirements: [{ id: 'fr-carp-duerp', title: 'DUERP risk assessment', description: 'Dust and manual handling risks assessed.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'fr-carp-docs', title: 'Material documentation', description: 'Record timber treatment and fixings used.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'fr-carp-dust', label: 'Dust control plan', required: true }],
          checklists: [{ id: 'fr-carp-dust', label: 'Dust controls active', required: true }, { id: 'fr-carp-handover', label: 'Material approvals uploaded', required: true }] },
        { tradeId: 'flooring', tradeLabel: 'Flooring and Tiling', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Flooring and Tiling', fr: 'Revêtements de sol et Carrelage' },
          requirements: [{ id: 'fr-floor-duerp', title: 'DUERP risk assessment', description: 'Silica dust and adhesives controls.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'fr-floor-docs', title: 'Subfloor documentation', description: 'Record subfloor condition and moisture tests.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'fr-floor-sds', label: 'SDS for adhesives', required: true }],
          checklists: [{ id: 'fr-floor-dust', label: 'Dust controls active', required: true }, { id: 'fr-floor-moisture', label: 'Moisture test results uploaded', required: true }] },
        { tradeId: 'plastering', tradeLabel: 'Plastering and Drywall', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Plastering and Drywall', fr: 'Plâtrerie et Plaques de plâtre' },
          requirements: [{ id: 'fr-plaster-duerp', title: 'DUERP risk assessment', description: 'Dust controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'fr-plaster-docs', title: 'Surface preparation documentation', description: 'Record surface prep and finish specification.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'fr-plaster-sds', label: 'SDS for compounds', required: true }],
          checklists: [{ id: 'fr-plaster-dust', label: 'Dust controls active', required: true }, { id: 'fr-plaster-finish', label: 'Surface prep recorded', required: true }] },
        { tradeId: 'glazing', tradeLabel: 'Glazing and Windows', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Glazing and Windows', fr: 'Vitrage et Fenêtres' },
          requirements: [{ id: 'fr-glaze-duerp', title: 'DUERP risk assessment', description: 'Handling and sealant risks assessed.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'fr-glaze-docs', title: 'Safety glazing documentation', description: 'Record safety glass specification and location.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'fr-glaze-sds', label: 'SDS for sealants', required: true }],
          checklists: [{ id: 'fr-glaze-handling', label: 'Safe handling plan in place', required: true }, { id: 'fr-glaze-safety', label: 'Safety glass schedule uploaded', required: true }] },
        { tradeId: 'insulation', tradeLabel: 'Insulation', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Insulation', fr: 'Isolation' },
          requirements: [{ id: 'fr-insul-duerp', title: 'DUERP risk assessment', description: 'Fiber exposure controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'fr-insul-docs', title: 'Thermal performance documentation', description: 'Record insulation type, thickness, and performance values.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'fr-insul-sds', label: 'SDS for insulation products', required: true }],
          checklists: [{ id: 'fr-insul-ppe', label: 'PPE and dust control in place', required: true }, { id: 'fr-insul-thermal', label: 'Insulation specs recorded', required: true }] },
        { tradeId: 'masonry', tradeLabel: 'Masonry and Brickwork', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Masonry and Brickwork', fr: 'Maçonnerie' },
          requirements: [{ id: 'fr-masonry-duerp', title: 'DUERP risk assessment', description: 'Cement and silica dust controls.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'fr-masonry-docs', title: 'Material documentation', description: 'Record mortar mix and masonry materials used.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'fr-masonry-sds', label: 'SDS for mortar/cement', required: true }],
          checklists: [{ id: 'fr-masonry-dust', label: 'Dust controls active', required: true }, { id: 'fr-masonry-mix', label: 'Mortar mix recorded', required: true }] },
        { tradeId: 'concrete', tradeLabel: 'Concrete and Structural', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Concrete and Structural', fr: 'Béton et Structure' },
          requirements: [{ id: 'fr-concrete-duerp', title: 'DUERP risk assessment', description: 'Wet cement controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'fr-concrete-docs', title: 'Pour and curing records', description: 'Maintain pour logs and curing/strength records.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'fr-concrete-sds', label: 'SDS for cement/admixtures', required: true }],
          checklists: [{ id: 'fr-concrete-ppe', label: 'PPE and wash stations in place', required: true }, { id: 'fr-concrete-pour', label: 'Pour log uploaded', required: true }] },
        { tradeId: 'demolition', tradeLabel: 'Demolition and Strip-out', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Demolition and Strip-out', fr: 'Démolition et Curage' },
          requirements: [{ id: 'fr-demo-duerp', title: 'DUERP risk assessment', description: 'Demolition hazards and dust controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'fr-demo-docs', title: 'Survey and waste documentation', description: 'Maintain survey records and waste transfer documentation.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'fr-demo-waste', label: 'Waste disposal records', required: true }],
          checklists: [{ id: 'fr-demo-risk', label: 'Demolition risk assessment complete', required: true }, { id: 'fr-demo-waste-docs', label: 'Waste transfer docs uploaded', required: true }] },
        { tradeId: 'scaffolding', tradeLabel: 'Scaffolding and Work at Height', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Scaffolding and Work at Height', fr: 'Échafaudage et Travail en hauteur' },
          requirements: [{ id: 'fr-scaffold-duerp', title: 'DUERP risk assessment', description: 'Work at height controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'fr-scaffold-docs', title: 'Inspection and tag documentation', description: 'Maintain inspection records and tagging status.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'fr-scaffold-inspect', label: 'Scaffold inspection log', required: true }],
          checklists: [{ id: 'fr-scaffold-check', label: 'Scaffold inspected before use', required: true }, { id: 'fr-scaffold-daily', label: 'Daily pre-use checks recorded', required: true }] },
        { tradeId: 'metalwork', tradeLabel: 'Metalwork and Welding', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Metalwork and Welding', fr: 'Métallerie et Soudage' },
          requirements: [{ id: 'fr-weld-duerp', title: 'DUERP risk assessment', description: 'Welding fume controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'fr-weld-docs', title: 'Welding procedure documentation', description: 'Maintain welding procedures and material traceability.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'fr-weld-extract', label: 'Extraction and PPE plan', required: true }, { id: 'fr-weld-hot', label: 'Hot works permit', required: true }],
          checklists: [{ id: 'fr-weld-fire', label: 'Hot works controls active', required: true }, { id: 'fr-weld-procedure', label: 'Welding procedure uploaded', required: true }] },
        { tradeId: 'waterproofing', tradeLabel: 'Waterproofing and Sealants', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Waterproofing and Sealants', fr: 'Étanchéité et Joints' },
          requirements: [{ id: 'fr-water-duerp', title: 'DUERP risk assessment', description: 'Sealant and solvent controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'fr-water-docs', title: 'Waterproofing documentation', description: 'Maintain product approvals and testing records.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'fr-water-sds', label: 'SDS for sealants', required: true }],
          checklists: [{ id: 'fr-water-vent', label: 'Ventilation in place', required: true }, { id: 'fr-water-test', label: 'Waterproofing test recorded', required: true }] },
        { tradeId: 'groundworks', tradeLabel: 'Groundworks and Excavation', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Groundworks and Excavation', fr: 'Terrassement et Excavation' },
          requirements: [{ id: 'fr-ground-duerp', title: 'DUERP risk assessment', description: 'Excavation safety controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'fr-ground-docs', title: 'Permit and shoring documentation', description: 'Maintain permits, shoring designs, and inspections.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'fr-ground-permit', label: 'Utility locate and permit to dig', required: true }],
          checklists: [{ id: 'fr-ground-utilities', label: 'Utilities located and marked', required: true }, { id: 'fr-ground-permit-docs', label: 'Permit and inspection docs uploaded', required: true }] },
        { tradeId: 'paving', tradeLabel: 'Paving and Landscaping', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Paving and Landscaping', fr: 'Voirie et Paysagisme' },
          requirements: [{ id: 'fr-pave-duerp', title: 'DUERP risk assessment', description: 'Equipment and chemical safety controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'fr-pave-docs', title: 'Drainage and falls documentation', description: 'Record drainage design, falls, and sub-base preparation.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'fr-pave-ppe', label: 'PPE and equipment checks', required: true }],
          checklists: [{ id: 'fr-pave-safe', label: 'Safe work setup confirmed', required: true }, { id: 'fr-pave-drainage', label: 'Drainage falls recorded', required: true }] },
        { tradeId: 'fire_protection', tradeLabel: 'Fire Protection', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Fire Protection', fr: 'Protection incendie' },
          requirements: [{ id: 'fr-fire-safety', title: 'Fire safety compliance', description: 'Fire systems require certification and commissioning.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'fr-fire-docs', title: 'Fire system documentation', description: 'Maintain product certifications and commissioning data.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'fr-fire-tested', title: 'Tested system installation', description: 'Install fire stopping to tested system details and manufacturer guidance.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'fr-fire-cert', label: 'Fire system commissioning certificates', required: true }],
          checklists: [{ id: 'fr-fire-install', label: 'Fire system installed per spec', required: true }, { id: 'fr-fire-trace', label: 'Fire system docs uploaded', required: true }, { id: 'fr-fire-photo', label: 'Fire stopping photo evidence captured', required: true }] },
        { tradeId: 'solar_pv', tradeLabel: 'Solar and PV', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Solar and PV', fr: 'Solaire et PV' },
          requirements: [{ id: 'fr-solar-re2020', title: 'RE2020 impact', description: 'PV systems must be documented in energy compliance.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'fr-solar-docs', title: 'PV documentation and handover', description: 'Provide commissioning results, inverter settings, and O&M manuals.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'fr-solar-grid', title: 'Grid connection compliance', description: 'Record distribution grid notifications or approvals where required.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'fr-solar-commission', label: 'PV commissioning certificate', required: true }],
          checklists: [{ id: 'fr-solar-signoff', label: 'Electrical signoff completed', required: true }, { id: 'fr-solar-handover', label: 'PV commissioning and O&M pack uploaded', required: true }, { id: 'fr-solar-grid-check', label: 'Grid notification recorded', required: true }] },
        { tradeId: 'elevators', tradeLabel: 'Elevators and Lifts', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Elevators and Lifts', fr: 'Ascenseurs' },
          requirements: [{ id: 'fr-lift-safety', title: 'Lift safety compliance', description: 'Installations require certification and inspections.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'fr-lift-docs', title: 'Lift handover and maintenance documentation', description: 'Provide commissioning, inspection, and maintenance handover records.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'fr-lift-inspect', title: 'Periodic inspection planning', description: 'Ensure periodic inspection schedule is documented and followed.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'fr-lift-install', label: 'Installation certificate', required: true }, { id: 'fr-lift-inspect', label: 'Periodic inspection logs', required: true }],
          checklists: [{ id: 'fr-lift-commission', label: 'Commissioning completed', required: true }, { id: 'fr-lift-handover', label: 'Maintenance handover uploaded', required: true }, { id: 'fr-lift-inspect-check', label: 'Inspection schedule recorded', required: true }] },
      ],
      registryChecks: [
        {
          id: 'fr-rge',
          label: 'RGE qualification check',
          description: 'Verify RGE category matches energy renovation scope.',
          inputs: [{ key: 'companyName', label: 'Company name', required: true }, { key: 'postalCode', label: 'Postal code', required: true }],
          outputs: [{ key: 'status', label: 'RGE status', required: true }, { key: 'category', label: 'RGE category', required: true }],
        },
        {
          id: 'fr-decennial',
          label: 'Decennial insurance verification',
          description: 'Verify decennial liability insurance coverage for construction trades.',
          inputs: [
            { key: 'policyNumber', label: 'Policy number', required: true },
            { key: 'insurer', label: 'Insurer name', required: true },
            { key: 'companyName', label: 'Company name', required: true },
          ],
          outputs: [
            { key: 'status', label: 'Coverage status', required: true },
            { key: 'coverageStart', label: 'Coverage start date', required: true },
            { key: 'coverageEnd', label: 'Coverage end date', required: true },
            { key: 'scope', label: 'Covered trade scope', required: true },
          ],
        },
      ],
    },
    {
      country: 'ES',
      trades: [
        {
          tradeId: 'electrician',
          tradeLabel: 'Electrician',
          tradeLabelLocalizations: { en: 'Electrician', es: 'Electricista' },
          projectScope: 'all',
          requirements: [
            { id: 'es-elec-rebt', title: 'REBT compliance', description: 'Low voltage installations must follow REBT (RD 842/2002).', level: 'mandatory', roleScope: 'contractor' },
            { id: 'es-elec-docs', title: 'Documentation and handover', description: 'Provide test results, as-built documentation, and user guidance.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'es-elec-testing', title: 'Testing and conformity', description: 'Perform and document installation testing per REBT requirements.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'es-elec-rebt', label: 'REBT compliance documents', required: true },
            { id: 'es-elec-installer', label: 'Installer accreditation (regional)', required: true },
          ],
          checklists: [
            { id: 'es-elec-testing', label: 'Testing and inspection complete', required: true },
            { id: 'es-elec-handover', label: 'As-built documentation uploaded', required: true },
            { id: 'es-elec-rebt-check', label: 'REBT test results uploaded', required: true },
          ],
        },
        {
          tradeId: 'gas',
          tradeLabel: 'Gas',
          tradeLabelLocalizations: { en: 'Gas', es: 'Gas' },
          projectScope: 'all',
          requirements: [
            { id: 'es-gas-rd919', title: 'Gas regulation compliance', description: 'Gas installations must follow RD 919/2006.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'es-gas-docs', title: 'Tightness testing and documentation', description: 'Maintain tightness test and commissioning records.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'es-gas-vent', title: 'Ventilation and combustion safety', description: 'Confirm ventilation and combustion air requirements are met.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'es-gas-installer', label: 'Installer authorization/registration', required: true },
            { id: 'es-gas-commission', label: 'Gas installation commissioning certificate', required: true },
          ],
          checklists: [
            { id: 'es-gas-commission', label: 'Commissioning recorded', required: true },
            { id: 'es-gas-isolation', label: 'Emergency isolation labeling confirmed', required: true },
            { id: 'es-gas-vent-check', label: 'Ventilation checks documented', required: true },
          ],
        },
        {
          tradeId: 'plumbing_hvac',
          tradeLabel: 'Plumbing and HVAC',
          tradeLabelLocalizations: { en: 'Plumbing and HVAC', es: 'Fontanería y Climatización' },
          projectScope: 'all',
          requirements: [
            { id: 'es-plumb-cte', title: 'CTE DB HS compliance', description: 'Water supply requirements under CTE DB HS.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'es-plumb-rite', title: 'RITE compliance', description: 'Thermal installations must meet RITE.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'es-plumb-fgas', title: 'F-gas compliance for refrigerants', description: 'Refrigerant handling requires F-gas certified personnel/company.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'es-plumb-docs', title: 'Commissioning and handover', description: 'Provide commissioning results and maintenance guidance.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'es-plumb-hygiene', title: 'Water hygiene controls', description: 'Document water hygiene and legionella prevention measures.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'es-plumb-cte', label: 'CTE DB HS compliance evidence', required: true },
            { id: 'es-plumb-rite', label: 'RITE commissioning/maintenance record', required: true },
            { id: 'es-plumb-fgas', label: 'F-gas certification + handling log', required: false },
          ],
          checklists: [
            { id: 'es-plumb-commission', label: 'Commissioning and maintenance log set', required: true },
            { id: 'es-plumb-handover', label: 'O&M documents uploaded', required: true },
            { id: 'es-plumb-hygiene-docs', label: 'Water hygiene controls documented', required: true },
          ],
        },
        {
          tradeId: 'roofing_envelope',
          tradeLabel: 'Roofing and Envelope',
          tradeLabelLocalizations: { en: 'Roofing and Envelope', es: 'Cubiertas y Envolvente' },
          projectScope: 'all',
          requirements: [
            { id: 'es-roof-cte', title: 'CTE compliance', description: 'Roofing must meet CTE DB SE/HS/HE requirements.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'es-roof-docs', title: 'Envelope documentation', description: 'Provide as-built details, product approvals, and warranties.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'es-roof-structure', title: 'Structural and wind loading checks', description: 'Confirm structural capacity and wind loading compliance for roof systems.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'es-roof-struct', label: 'CTE DB SE structural calculations', required: true },
            { id: 'es-roof-moist', label: 'CTE DB HS moisture protection evidence', required: true },
            { id: 'es-roof-energy', label: 'CTE DB HE energy compliance evidence', required: true },
          ],
          checklists: [
            { id: 'es-roof-check', label: 'Roof system installed per CTE', required: true },
            { id: 'es-roof-handover', label: 'Roof build-up and warranty docs uploaded', required: true },
            { id: 'es-roof-structure-check', label: 'Structural and wind load checks recorded', required: true },
          ],
        },
        {
          tradeId: 'energy_renovation',
          tradeLabel: 'Energy Renovation',
          tradeLabelLocalizations: { en: 'Energy Renovation', es: 'Rehabilitación energética' },
          projectScope: 'renovation',
          requirements: [
            { id: 'es-energy-cte', title: 'CTE DB HE compliance', description: 'Energy performance must meet DB HE.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'es-energy-docs', title: 'Energy documentation and handover', description: 'Provide calculations, commissioning results, and user guidance.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'es-energy-vent', title: 'Ventilation provision', description: 'Ensure ventilation performance is documented after retrofit.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'es-energy-he', label: 'DB HE compliance report', required: true },
          ],
          checklists: [
            { id: 'es-energy-doc', label: 'Energy compliance documentation complete', required: true },
            { id: 'es-energy-handover', label: 'Energy compliance documents uploaded', required: true },
            { id: 'es-energy-vent-check', label: 'Ventilation performance recorded', required: true },
          ],
        },
        { tradeId: 'painting', tradeLabel: 'Painting and Decorating', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Painting and Decorating', es: 'Pintura y Decoración' },
          requirements: [{ id: 'es-paint-prl', title: 'PRL compliance', description: 'Occupational risk prevention for hazardous substances.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'es-paint-docs', title: 'Product and waste documentation', description: 'Maintain product data sheets and waste handling records.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'es-paint-sds', label: 'SDS for coatings', required: true }],
          checklists: [{ id: 'es-paint-ppe', label: 'PPE and ventilation in place', required: true }, { id: 'es-paint-waste', label: 'Waste handling recorded', required: true }] },
        { tradeId: 'carpentry', tradeLabel: 'Carpentry and Joinery', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Carpentry and Joinery', es: 'Carpintería' },
          requirements: [{ id: 'es-carp-prl', title: 'PRL compliance', description: 'Dust and manual handling risks assessed.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'es-carp-docs', title: 'Material documentation', description: 'Record timber treatment and fixings used.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'es-carp-dust', label: 'Dust control plan', required: true }],
          checklists: [{ id: 'es-carp-dust', label: 'Dust controls active', required: true }, { id: 'es-carp-handover', label: 'Material approvals uploaded', required: true }] },
        { tradeId: 'flooring', tradeLabel: 'Flooring and Tiling', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Flooring and Tiling', es: 'Suelos y Alicatados' },
          requirements: [{ id: 'es-floor-prl', title: 'PRL compliance', description: 'Silica dust and adhesives controls.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'es-floor-docs', title: 'Subfloor documentation', description: 'Record subfloor condition and moisture tests.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'es-floor-sds', label: 'SDS for adhesives', required: true }],
          checklists: [{ id: 'es-floor-dust', label: 'Dust controls active', required: true }, { id: 'es-floor-moisture', label: 'Moisture test results uploaded', required: true }] },
        { tradeId: 'plastering', tradeLabel: 'Plastering and Drywall', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Plastering and Drywall', es: 'Yesería y Pladur' },
          requirements: [{ id: 'es-plaster-prl', title: 'PRL compliance', description: 'Dust controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'es-plaster-docs', title: 'Surface preparation documentation', description: 'Record surface prep and finish specification.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'es-plaster-sds', label: 'SDS for compounds', required: true }],
          checklists: [{ id: 'es-plaster-dust', label: 'Dust controls active', required: true }, { id: 'es-plaster-finish', label: 'Surface prep recorded', required: true }] },
        { tradeId: 'glazing', tradeLabel: 'Glazing and Windows', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Glazing and Windows', es: 'Acristalamiento y Ventanas' },
          requirements: [{ id: 'es-glaze-prl', title: 'PRL compliance', description: 'Handling and sealant risks assessed.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'es-glaze-docs', title: 'Safety glazing documentation', description: 'Record safety glass specification and location.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'es-glaze-sds', label: 'SDS for sealants', required: true }],
          checklists: [{ id: 'es-glaze-handling', label: 'Safe handling plan in place', required: true }, { id: 'es-glaze-safety', label: 'Safety glass schedule uploaded', required: true }] },
        { tradeId: 'insulation', tradeLabel: 'Insulation', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Insulation', es: 'Aislamiento' },
          requirements: [{ id: 'es-insul-prl', title: 'PRL compliance', description: 'Fiber exposure controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'es-insul-docs', title: 'Thermal performance documentation', description: 'Record insulation type, thickness, and performance values.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'es-insul-sds', label: 'SDS for insulation products', required: true }],
          checklists: [{ id: 'es-insul-ppe', label: 'PPE and dust control in place', required: true }, { id: 'es-insul-thermal', label: 'Insulation specs recorded', required: true }] },
        { tradeId: 'masonry', tradeLabel: 'Masonry and Brickwork', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Masonry and Brickwork', es: 'Albañilería' },
          requirements: [{ id: 'es-masonry-prl', title: 'PRL compliance', description: 'Cement and silica dust controls.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'es-masonry-docs', title: 'Material documentation', description: 'Record mortar mix and masonry materials used.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'es-masonry-sds', label: 'SDS for mortar/cement', required: true }],
          checklists: [{ id: 'es-masonry-dust', label: 'Dust controls active', required: true }, { id: 'es-masonry-mix', label: 'Mortar mix recorded', required: true }] },
        { tradeId: 'concrete', tradeLabel: 'Concrete and Structural', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Concrete and Structural', es: 'Hormigón y Estructuras' },
          requirements: [{ id: 'es-concrete-prl', title: 'PRL compliance', description: 'Wet cement controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'es-concrete-docs', title: 'Pour and curing records', description: 'Maintain pour logs and curing/strength records.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'es-concrete-sds', label: 'SDS for cement/admixtures', required: true }],
          checklists: [{ id: 'es-concrete-ppe', label: 'PPE and wash stations in place', required: true }, { id: 'es-concrete-pour', label: 'Pour log uploaded', required: true }] },
        { tradeId: 'demolition', tradeLabel: 'Demolition and Strip-out', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Demolition and Strip-out', es: 'Demolición y Desescombro' },
          requirements: [{ id: 'es-demo-prl', title: 'PRL compliance', description: 'Demolition hazards and dust controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'es-demo-docs', title: 'Survey and waste documentation', description: 'Maintain survey records and waste transfer documentation.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'es-demo-waste', label: 'Waste disposal records', required: true }],
          checklists: [{ id: 'es-demo-risk', label: 'Demolition risk assessment complete', required: true }, { id: 'es-demo-waste-docs', label: 'Waste transfer docs uploaded', required: true }] },
        { tradeId: 'scaffolding', tradeLabel: 'Scaffolding and Work at Height', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Scaffolding and Work at Height', es: 'Andamios y Trabajo en Altura' },
          requirements: [{ id: 'es-scaffold-prl', title: 'PRL compliance', description: 'Work at height controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'es-scaffold-docs', title: 'Inspection and tag documentation', description: 'Maintain inspection records and tagging status.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'es-scaffold-inspect', label: 'Scaffold inspection log', required: true }],
          checklists: [{ id: 'es-scaffold-check', label: 'Scaffold inspected before use', required: true }, { id: 'es-scaffold-daily', label: 'Daily pre-use checks recorded', required: true }] },
        { tradeId: 'metalwork', tradeLabel: 'Metalwork and Welding', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Metalwork and Welding', es: 'Metalistería y Soldadura' },
          requirements: [{ id: 'es-weld-prl', title: 'PRL compliance', description: 'Welding fume controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'es-weld-docs', title: 'Welding procedure documentation', description: 'Maintain welding procedures and material traceability.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'es-weld-extract', label: 'Extraction and PPE plan', required: true }, { id: 'es-weld-hot', label: 'Hot works permit', required: true }],
          checklists: [{ id: 'es-weld-fire', label: 'Hot works controls active', required: true }, { id: 'es-weld-procedure', label: 'Welding procedure uploaded', required: true }] },
        { tradeId: 'waterproofing', tradeLabel: 'Waterproofing and Sealants', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Waterproofing and Sealants', es: 'Impermeabilización y Selladores' },
          requirements: [{ id: 'es-water-prl', title: 'PRL compliance', description: 'Sealant and solvent controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'es-water-docs', title: 'Waterproofing documentation', description: 'Maintain product approvals and testing records.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'es-water-sds', label: 'SDS for sealants', required: true }],
          checklists: [{ id: 'es-water-vent', label: 'Ventilation in place', required: true }, { id: 'es-water-test', label: 'Waterproofing test recorded', required: true }] },
        { tradeId: 'groundworks', tradeLabel: 'Groundworks and Excavation', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Groundworks and Excavation', es: 'Movimiento de Tierras y Excavación' },
          requirements: [{ id: 'es-ground-prl', title: 'PRL compliance', description: 'Excavation safety controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'es-ground-docs', title: 'Permit and shoring documentation', description: 'Maintain permits, shoring designs, and inspections.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'es-ground-permit', label: 'Utility locate and permit to dig', required: true }],
          checklists: [{ id: 'es-ground-utilities', label: 'Utilities located and marked', required: true }, { id: 'es-ground-permit-docs', label: 'Permit and inspection docs uploaded', required: true }] },
        { tradeId: 'paving', tradeLabel: 'Paving and Landscaping', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Paving and Landscaping', es: 'Pavimentación y Paisajismo' },
          requirements: [{ id: 'es-pave-prl', title: 'PRL compliance', description: 'Equipment and chemical safety controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'es-pave-docs', title: 'Drainage and falls documentation', description: 'Record drainage design, falls, and sub-base preparation.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'es-pave-ppe', label: 'PPE and equipment checks', required: true }],
          checklists: [{ id: 'es-pave-safe', label: 'Safe work setup confirmed', required: true }, { id: 'es-pave-drainage', label: 'Drainage falls recorded', required: true }] },
        { tradeId: 'fire_protection', tradeLabel: 'Fire Protection', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Fire Protection', es: 'Protección contra Incendios' },
          requirements: [{ id: 'es-fire-cte', title: 'CTE DB SI compliance', description: 'Fire safety systems must meet DB SI.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'es-fire-docs', title: 'Fire system documentation', description: 'Maintain product certifications and commissioning data.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'es-fire-cert', label: 'Fire system commissioning certificates', required: true }],
          checklists: [{ id: 'es-fire-install', label: 'Fire system installed per spec', required: true }, { id: 'es-fire-trace', label: 'Fire system docs uploaded', required: true }] },
        { tradeId: 'solar_pv', tradeLabel: 'Solar and PV', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Solar and PV', es: 'Solar y FV' },
          requirements: [{ id: 'es-solar-cte', title: 'CTE DB HE compliance', description: 'PV systems must be documented in energy compliance.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'es-solar-docs', title: 'PV documentation and handover', description: 'Provide commissioning results, inverter settings, and O&M manuals.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'es-solar-commission', label: 'PV commissioning certificate', required: true }],
          checklists: [{ id: 'es-solar-signoff', label: 'Electrical signoff completed', required: true }, { id: 'es-solar-handover', label: 'PV commissioning and O&M pack uploaded', required: true }] },
        { tradeId: 'elevators', tradeLabel: 'Elevators and Lifts', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Elevators and Lifts', es: 'Ascensores' },
          requirements: [{ id: 'es-lift-cte', title: 'Lift safety compliance', description: 'Installations require certification and inspections.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'es-lift-docs', title: 'Lift handover and maintenance documentation', description: 'Provide commissioning, inspection, and maintenance handover records.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'es-lift-install', label: 'Installation certificate', required: true }, { id: 'es-lift-inspect', label: 'Periodic inspection logs', required: true }],
          checklists: [{ id: 'es-lift-commission', label: 'Commissioning completed', required: true }, { id: 'es-lift-handover', label: 'Maintenance handover uploaded', required: true }] },
      ],
      registryChecks: [
        {
          id: 'es-rea',
          label: 'REA registration check',
          description: 'Verify construction company accreditation.',
          inputs: [{ key: 'identifier', label: 'CIF/NIF/NIE/REA', required: true }],
          outputs: [
            { key: 'status', label: 'REA status', required: true },
            { key: 'registry', label: 'Registry details', required: true },
          ],
        },
        {
          id: 'es-installer',
          label: 'Installer accreditation check',
          description: 'Verify regional installer accreditation for regulated trades.',
          inputs: [
            { key: 'region', label: 'Region/Autonomous community', required: true },
            { key: 'registryId', label: 'Installer registry ID', required: true },
            { key: 'trade', label: 'Trade category', required: true },
          ],
          outputs: [
            { key: 'status', label: 'Accreditation status', required: true },
            { key: 'scope', label: 'Scope/category', required: true },
            { key: 'validUntil', label: 'Valid until', required: false },
          ],
        },
      ],
    },
    {
      country: 'IT',
      trades: [
        {
          tradeId: 'electrician',
          tradeLabel: 'Electrician',
          tradeLabelLocalizations: { en: 'Electrician', it: 'Elettricista' },
          projectScope: 'all',
          requirements: [
            { id: 'it-elec-dm37', title: 'DM 37/2008 compliance', description: 'Electrical systems require declaration of conformity.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'it-elec-docs', title: 'Documentation and handover', description: 'Provide test results, as-built documentation, and user guidance.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'it-elec-doc', label: 'Declaration of Conformity', required: true },
            { id: 'it-elec-project', label: 'Technical project/method statement', required: true },
          ],
          checklists: [
            { id: 'it-elec-doc', label: 'Declaration issued and stored', required: true },
            { id: 'it-elec-handover', label: 'As-built documentation uploaded', required: true },
          ],
        },
        {
          tradeId: 'gas',
          tradeLabel: 'Gas',
          tradeLabelLocalizations: { en: 'Gas', it: 'Gas' },
          projectScope: 'all',
          requirements: [
            { id: 'it-gas-dm37', title: 'DM 37/2008 compliance', description: 'Gas systems require declaration of conformity.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'it-gas-uni7129', title: 'UNI 7129 compliance', description: 'Domestic gas installations follow UNI 7129 series.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'it-gas-docs', title: 'Tightness testing and documentation', description: 'Maintain tightness test and commissioning records.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'it-gas-doc', label: 'Declaration of Conformity', required: true },
            { id: 'it-gas-uni', label: 'UNI 7129 compliance records', required: true },
          ],
          checklists: [
            { id: 'it-gas-commission', label: 'Commissioning records complete', required: true },
            { id: 'it-gas-isolation', label: 'Emergency isolation labeling confirmed', required: true },
          ],
        },
        {
          tradeId: 'plumbing_hvac',
          tradeLabel: 'Plumbing and HVAC',
          tradeLabelLocalizations: { en: 'Plumbing and HVAC', it: 'Idraulica e Climatizzazione' },
          projectScope: 'all',
          requirements: [
            { id: 'it-plumb-dm37', title: 'DM 37/2008 compliance', description: 'Plumbing systems require declaration of conformity.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'it-hvac-dpr74', title: 'DPR 74/2013 compliance', description: 'Thermal systems require maintenance and inspection records.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'it-hvac-fgas', title: 'F-gas compliance for refrigerants', description: 'Refrigerant handling requires F-gas certified personnel/company.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'it-plumb-docs', title: 'Commissioning and handover', description: 'Provide commissioning results and maintenance guidance.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'it-plumb-doc', label: 'Declaration of Conformity', required: true },
            { id: 'it-hvac-libretto', label: 'Thermal system logbook and maintenance', required: true },
            { id: 'it-hvac-fgas', label: 'F-gas certification + handling log', required: false },
          ],
          checklists: [
            { id: 'it-hvac-maint', label: 'Maintenance and inspection scheduled', required: true },
            { id: 'it-plumb-handover', label: 'O&M documents uploaded', required: true },
          ],
        },
        {
          tradeId: 'roofing_envelope',
          tradeLabel: 'Roofing and Envelope',
          tradeLabelLocalizations: { en: 'Roofing and Envelope', it: 'Coperture e Involucro' },
          projectScope: 'all',
          requirements: [
            { id: 'it-roof-ntc', title: 'NTC 2018 compliance', description: 'Structural requirements for roofing and envelope.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'it-roof-docs', title: 'Envelope documentation', description: 'Provide as-built details, product approvals, and warranties.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'it-roof-struct', label: 'Structural calculations + NTC statement', required: true },
          ],
          checklists: [
            { id: 'it-roof-check', label: 'Roof system installed per design', required: true },
            { id: 'it-roof-handover', label: 'Roof build-up and warranty docs uploaded', required: true },
          ],
        },
        {
          tradeId: 'energy_renovation',
          tradeLabel: 'Energy Renovation',
          tradeLabelLocalizations: { en: 'Energy Renovation', it: 'Riqualificazione energetica' },
          projectScope: 'renovation',
          requirements: [
            { id: 'it-energy-dlgs192', title: 'D.Lgs 192/2005 compliance', description: 'Energy performance rules and APE required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'it-energy-docs', title: 'Energy documentation and handover', description: 'Provide calculations, commissioning results, and user guidance.', level: 'mandatory', roleScope: 'contractor' },
          ],
          evidence: [
            { id: 'it-energy-ape', label: 'APE before/after renovation', required: true },
          ],
          checklists: [
            { id: 'it-energy-doc', label: 'Energy documentation complete', required: true },
            { id: 'it-energy-handover', label: 'Energy compliance documents uploaded', required: true },
          ],
        },
        { tradeId: 'painting', tradeLabel: 'Painting and Decorating', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Painting and Decorating', it: 'Pittura e Decorazione' },
          requirements: [{ id: 'it-paint-dlgs81', title: 'D.Lgs 81/2008 compliance', description: 'Risk assessment for hazardous substances.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'it-paint-docs', title: 'Product and waste documentation', description: 'Maintain product data sheets and waste handling records.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'it-paint-sds', label: 'SDS for coatings', required: true }],
          checklists: [{ id: 'it-paint-ppe', label: 'PPE and ventilation in place', required: true }, { id: 'it-paint-waste', label: 'Waste handling recorded', required: true }] },
        { tradeId: 'carpentry', tradeLabel: 'Carpentry and Joinery', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Carpentry and Joinery', it: 'Carpenteria e Falegnameria' },
          requirements: [{ id: 'it-carp-dlgs81', title: 'D.Lgs 81/2008 compliance', description: 'Dust and manual handling risks assessed.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'it-carp-docs', title: 'Material documentation', description: 'Record timber treatment and fixings used.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'it-carp-dust', label: 'Dust control plan', required: true }],
          checklists: [{ id: 'it-carp-dust', label: 'Dust controls active', required: true }, { id: 'it-carp-handover', label: 'Material approvals uploaded', required: true }] },
        { tradeId: 'flooring', tradeLabel: 'Flooring and Tiling', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Flooring and Tiling', it: 'Pavimenti e Piastrelle' },
          requirements: [{ id: 'it-floor-dlgs81', title: 'D.Lgs 81/2008 compliance', description: 'Silica dust and adhesives controls.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'it-floor-docs', title: 'Subfloor documentation', description: 'Record subfloor condition and moisture tests.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'it-floor-sds', label: 'SDS for adhesives', required: true }],
          checklists: [{ id: 'it-floor-dust', label: 'Dust controls active', required: true }, { id: 'it-floor-moisture', label: 'Moisture test results uploaded', required: true }] },
        { tradeId: 'plastering', tradeLabel: 'Plastering and Drywall', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Plastering and Drywall', it: 'Intonaci e Cartongesso' },
          requirements: [{ id: 'it-plaster-dlgs81', title: 'D.Lgs 81/2008 compliance', description: 'Dust controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'it-plaster-docs', title: 'Surface preparation documentation', description: 'Record surface prep and finish specification.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'it-plaster-sds', label: 'SDS for compounds', required: true }],
          checklists: [{ id: 'it-plaster-dust', label: 'Dust controls active', required: true }, { id: 'it-plaster-finish', label: 'Surface prep recorded', required: true }] },
        { tradeId: 'glazing', tradeLabel: 'Glazing and Windows', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Glazing and Windows', it: 'Vetrate e Finestre' },
          requirements: [{ id: 'it-glaze-dlgs81', title: 'D.Lgs 81/2008 compliance', description: 'Handling and sealant risks assessed.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'it-glaze-docs', title: 'Safety glazing documentation', description: 'Record safety glass specification and location.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'it-glaze-sds', label: 'SDS for sealants', required: true }],
          checklists: [{ id: 'it-glaze-handling', label: 'Safe handling plan in place', required: true }, { id: 'it-glaze-safety', label: 'Safety glass schedule uploaded', required: true }] },
        { tradeId: 'insulation', tradeLabel: 'Insulation', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Insulation', it: 'Isolamento' },
          requirements: [{ id: 'it-insul-dlgs81', title: 'D.Lgs 81/2008 compliance', description: 'Fiber exposure controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'it-insul-docs', title: 'Thermal performance documentation', description: 'Record insulation type, thickness, and performance values.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'it-insul-sds', label: 'SDS for insulation products', required: true }],
          checklists: [{ id: 'it-insul-ppe', label: 'PPE and dust control in place', required: true }, { id: 'it-insul-thermal', label: 'Insulation specs recorded', required: true }] },
        { tradeId: 'masonry', tradeLabel: 'Masonry and Brickwork', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Masonry and Brickwork', it: 'Muratura' },
          requirements: [{ id: 'it-masonry-dlgs81', title: 'D.Lgs 81/2008 compliance', description: 'Cement and silica dust controls.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'it-masonry-docs', title: 'Material documentation', description: 'Record mortar mix and masonry materials used.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'it-masonry-sds', label: 'SDS for mortar/cement', required: true }],
          checklists: [{ id: 'it-masonry-dust', label: 'Dust controls active', required: true }, { id: 'it-masonry-mix', label: 'Mortar mix recorded', required: true }] },
        { tradeId: 'concrete', tradeLabel: 'Concrete and Structural', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Concrete and Structural', it: 'Calcestruzzo e Strutture' },
          requirements: [{ id: 'it-concrete-dlgs81', title: 'D.Lgs 81/2008 compliance', description: 'Wet cement controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'it-concrete-docs', title: 'Pour and curing records', description: 'Maintain pour logs and curing/strength records.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'it-concrete-sds', label: 'SDS for cement/admixtures', required: true }],
          checklists: [{ id: 'it-concrete-ppe', label: 'PPE and wash stations in place', required: true }, { id: 'it-concrete-pour', label: 'Pour log uploaded', required: true }] },
        { tradeId: 'demolition', tradeLabel: 'Demolition and Strip-out', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Demolition and Strip-out', it: 'Demolizione e Smontaggio' },
          requirements: [{ id: 'it-demo-dlgs81', title: 'D.Lgs 81/2008 compliance', description: 'Demolition hazards and dust controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'it-demo-docs', title: 'Survey and waste documentation', description: 'Maintain survey records and waste transfer documentation.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'it-demo-waste', label: 'Waste disposal records', required: true }],
          checklists: [{ id: 'it-demo-risk', label: 'Demolition risk assessment complete', required: true }, { id: 'it-demo-waste-docs', label: 'Waste transfer docs uploaded', required: true }] },
        { tradeId: 'scaffolding', tradeLabel: 'Scaffolding and Work at Height', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Scaffolding and Work at Height', it: 'Ponteggi e Lavori in quota' },
          requirements: [{ id: 'it-scaffold-dlgs81', title: 'D.Lgs 81/2008 compliance', description: 'Work at height controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'it-scaffold-docs', title: 'Inspection and tag documentation', description: 'Maintain inspection records and tagging status.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'it-scaffold-inspect', label: 'Scaffold inspection log', required: true }],
          checklists: [{ id: 'it-scaffold-check', label: 'Scaffold inspected before use', required: true }, { id: 'it-scaffold-daily', label: 'Daily pre-use checks recorded', required: true }] },
        { tradeId: 'metalwork', tradeLabel: 'Metalwork and Welding', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Metalwork and Welding', it: 'Carpenteria metallica e Saldatura' },
          requirements: [{ id: 'it-weld-dlgs81', title: 'D.Lgs 81/2008 compliance', description: 'Welding fume controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'it-weld-docs', title: 'Welding procedure documentation', description: 'Maintain welding procedures and material traceability.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'it-weld-extract', label: 'Extraction and PPE plan', required: true }, { id: 'it-weld-hot', label: 'Hot works permit', required: true }],
          checklists: [{ id: 'it-weld-fire', label: 'Hot works controls active', required: true }, { id: 'it-weld-procedure', label: 'Welding procedure uploaded', required: true }] },
        { tradeId: 'waterproofing', tradeLabel: 'Waterproofing and Sealants', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Waterproofing and Sealants', it: 'Impermeabilizzazione e Sigillanti' },
          requirements: [{ id: 'it-water-dlgs81', title: 'D.Lgs 81/2008 compliance', description: 'Sealant and solvent controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'it-water-docs', title: 'Waterproofing documentation', description: 'Maintain product approvals and testing records.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'it-water-sds', label: 'SDS for sealants', required: true }],
          checklists: [{ id: 'it-water-vent', label: 'Ventilation in place', required: true }, { id: 'it-water-test', label: 'Waterproofing test recorded', required: true }] },
        { tradeId: 'groundworks', tradeLabel: 'Groundworks and Excavation', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Groundworks and Excavation', it: 'Scavi e Movimento terra' },
          requirements: [{ id: 'it-ground-dlgs81', title: 'D.Lgs 81/2008 compliance', description: 'Excavation safety controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'it-ground-docs', title: 'Permit and shoring documentation', description: 'Maintain permits, shoring designs, and inspections.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'it-ground-permit', label: 'Utility locate and permit to dig', required: true }],
          checklists: [{ id: 'it-ground-utilities', label: 'Utilities located and marked', required: true }, { id: 'it-ground-permit-docs', label: 'Permit and inspection docs uploaded', required: true }] },
        { tradeId: 'paving', tradeLabel: 'Paving and Landscaping', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Paving and Landscaping', it: 'Pavimentazioni e Paesaggistica' },
          requirements: [{ id: 'it-pave-dlgs81', title: 'D.Lgs 81/2008 compliance', description: 'Equipment and chemical safety controls required.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'it-pave-docs', title: 'Drainage and falls documentation', description: 'Record drainage design, falls, and sub-base preparation.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'it-pave-ppe', label: 'PPE and equipment checks', required: true }],
          checklists: [{ id: 'it-pave-safe', label: 'Safe work setup confirmed', required: true }, { id: 'it-pave-drainage', label: 'Drainage falls recorded', required: true }] },
        { tradeId: 'fire_protection', tradeLabel: 'Fire Protection', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Fire Protection', it: 'Protezione antincendio' },
          requirements: [{ id: 'it-fire-dlgs81', title: 'Fire safety compliance', description: 'Fire systems require certification and commissioning.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'it-fire-docs', title: 'Fire system documentation', description: 'Maintain product certifications and commissioning data.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'it-fire-cert', label: 'Fire system commissioning certificates', required: true }],
          checklists: [{ id: 'it-fire-install', label: 'Fire system installed per spec', required: true }, { id: 'it-fire-trace', label: 'Fire system docs uploaded', required: true }] },
        { tradeId: 'solar_pv', tradeLabel: 'Solar and PV', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Solar and PV', it: 'Solare e FV' },
          requirements: [{ id: 'it-solar-dlgs192', title: 'Energy compliance', description: 'PV systems must be documented for energy performance.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'it-solar-docs', title: 'PV documentation and handover', description: 'Provide commissioning results, inverter settings, and O&M manuals.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'it-solar-commission', label: 'PV commissioning certificate', required: true }],
          checklists: [{ id: 'it-solar-signoff', label: 'Electrical signoff completed', required: true }, { id: 'it-solar-handover', label: 'PV commissioning and O&M pack uploaded', required: true }] },
        { tradeId: 'elevators', tradeLabel: 'Elevators and Lifts', projectScope: 'all',
          tradeLabelLocalizations: { en: 'Elevators and Lifts', it: 'Ascensori' },
          requirements: [{ id: 'it-lift-dm37', title: 'DM 37/2008 compliance', description: 'Lift installations require qualified company and certification.', level: 'mandatory', roleScope: 'contractor' },
            { id: 'it-lift-docs', title: 'Lift handover and maintenance documentation', description: 'Provide commissioning, inspection, and maintenance handover records.', level: 'mandatory', roleScope: 'contractor' }],
          evidence: [{ id: 'it-lift-install', label: 'Installation certificate', required: true }, { id: 'it-lift-inspect', label: 'Periodic inspection logs', required: true }],
          checklists: [{ id: 'it-lift-commission', label: 'Commissioning completed', required: true }, { id: 'it-lift-handover', label: 'Maintenance handover uploaded', required: true }] },
      ],
      registryChecks: [
        {
          id: 'it-dm37',
          label: 'DM 37/2008 qualification check',
          description: 'Verify company is qualified for installation systems.',
          inputs: [{ key: 'companyId', label: 'Company registration identifier', required: true }],
          outputs: [
            { key: 'status', label: 'Qualification status', required: true },
            { key: 'responsiblePerson', label: 'Responsible technical person', required: true },
          ],
        },
      ],
    },
  ],
};

export const complianceKnowledgeBase = withLocalizations(rawComplianceKnowledgeBase);
