// =============================================================================
// GENERATOR TRANSLATIONS — i18n for intelligence generators
// =============================================================================
// Generators run as hooks/services (not React components) so they can't use
// useTranslation(). This file provides a lookup-based translation system.
//
// Usage in generators:
//   import { gt } from '../generatorTranslations';
//   title: gt('overdue_invoices', ctx.language)
//   source: gt('source_billing', ctx.language)
// =============================================================================

import type { GeneratorLanguage } from './generators/types';

type TranslationMap = Record<GeneratorLanguage, string>;

// ---------------------------------------------------------------------------
// Translation registry — all generator-facing strings
// ---------------------------------------------------------------------------

const TRANSLATIONS: Record<string, TranslationMap> = {
  // ===== COMMON / SHARED =====
  source_billing: { nl: 'Facturatie', en: 'Billing', de: 'Rechnungswesen', fr: 'Facturation', es: 'Facturación', it: 'Fatturazione' },
  source_margin: { nl: 'Margeanalyse', en: 'Margin Analysis', de: 'Margenanalyse', fr: 'Analyse des marges', es: 'Análisis de márgenes', it: 'Analisi dei margini' },
  source_labor: { nl: 'Arbeidsanalyse', en: 'Labor Analysis', de: 'Arbeitsanalyse', fr: 'Analyse du travail', es: 'Análisis laboral', it: 'Analisi del lavoro' },
  source_compliance: { nl: 'Compliance', en: 'Compliance', de: 'Compliance', fr: 'Conformité', es: 'Cumplimiento', it: 'Conformità' },
  source_collections: { nl: 'Incasso Agent', en: 'Collections Agent', de: 'Inkasso Agent', fr: 'Agent de recouvrement', es: 'Agente de cobros', it: 'Agente di recupero crediti' },
  source_capacity: { nl: 'Capaciteitsplanner', en: 'Capacity Planner', de: 'Kapazitätsplaner', fr: 'Planificateur de capacité', es: 'Planificador de capacidad', it: 'Pianificatore di capacità' },
  source_scheduling: { nl: 'Planning', en: 'Scheduling', de: 'Terminplanung', fr: 'Planification', es: 'Planificación', it: 'Pianificazione' },
  source_savings: { nl: 'Besparingen', en: 'Savings', de: 'Einsparungen', fr: 'Économies', es: 'Ahorros', it: 'Risparmi' },
  source_procurement: { nl: 'Inkoop', en: 'Procurement', de: 'Einkauf', fr: 'Approvisionnement', es: 'Compras', it: 'Approvvigionamento' },
  source_quality: { nl: 'Kwaliteit Analyse', en: 'Quality Analysis', de: 'Qualitätsanalyse', fr: 'Analyse qualité', es: 'Análisis de calidad', it: 'Analisi qualità' },
  source_safety: { nl: 'Veiligheid Analyse', en: 'Safety Analysis', de: 'Sicherheitsanalyse', fr: 'Analyse sécurité', es: 'Análisis de seguridad', it: 'Analisi sicurezza' },
  source_crew: { nl: 'Crew Analyse', en: 'Crew Analysis', de: 'Team-Analyse', fr: 'Analyse équipe', es: 'Análisis del equipo', it: 'Analisi squadra' },
  source_cert_planner: { nl: 'Certificaat Planner', en: 'Certificate Planner', de: 'Zertifikatsplaner', fr: 'Planificateur de certificats', es: 'Planificador de certificados', it: 'Pianificatore certificati' },
  source_financial: { nl: 'Financieel', en: 'Financial', de: 'Finanziell', fr: 'Financier', es: 'Financiero', it: 'Finanziario' },
  source_estimation: { nl: 'Schattingen', en: 'Estimation', de: 'Kalkulation', fr: 'Estimation', es: 'Estimación', it: 'Stima' },
  source_customer: { nl: 'Klantrelatie', en: 'Customer Relations', de: 'Kundenbeziehung', fr: 'Relations client', es: 'Relaciones con clientes', it: 'Relazioni clienti' },
  source_weather: { nl: 'Weer & Planning', en: 'Weather & Scheduling', de: 'Wetter & Planung', fr: 'Météo & Planning', es: 'Tiempo & Planificación', it: 'Meteo & Pianificazione' },
  source_tip: { nl: 'Vasco Tip', en: 'Vasco Tip', de: 'Vasco-Tipp', fr: 'Conseil Vasco', es: 'Consejo Vasco', it: 'Consiglio Vasco' },
  source_cascade: { nl: 'Cascade Analyse', en: 'Cascade Analysis', de: 'Kaskadenanalyse', fr: 'Analyse en cascade', es: 'Análisis en cascada', it: 'Analisi a cascata' },
  source_change_order: { nl: 'Meerwerk Tracker', en: 'Change Order Tracker', de: 'Nachtragsverfolger', fr: 'Suivi des avenants', es: 'Seguimiento de cambios', it: 'Tracciamento varianti' },
  source_contingency: { nl: 'Onvoorzien Tracker', en: 'Contingency Tracker', de: 'Rückstellungsverfolgung', fr: 'Suivi des imprévus', es: 'Seguimiento de contingencias', it: 'Tracciamento imprevisti' },
  source_cross_project: { nl: 'Cross-Project Analyse', en: 'Cross-Project Analysis', de: 'Projektübergreifende Analyse', fr: 'Analyse inter-projets', es: 'Análisis entre proyectos', it: 'Analisi inter-progetto' },
  source_cross_analysis: { nl: 'Cross-analyse', en: 'Cross Analysis', de: 'Queranalyse', fr: 'Analyse croisée', es: 'Análisis cruzado', it: 'Analisi incrociata' },
  source_cross_service: { nl: 'Cross-Service Analyse', en: 'Cross-Service Analysis', de: 'Dienstübergreifende Analyse', fr: 'Analyse inter-services', es: 'Análisis entre servicios', it: 'Analisi inter-servizio' },
  source_handover: { nl: 'Oplevering Tracker', en: 'Handover Tracker', de: 'Übergabeverfolgung', fr: 'Suivi de remise', es: 'Seguimiento de entrega', it: 'Tracciamento consegna' },
  source_permits: { nl: 'Vergunningen', en: 'Permits', de: 'Genehmigungen', fr: 'Permis', es: 'Permisos', it: 'Permessi' },
  source_portfolio: { nl: 'Portfolio Analyse', en: 'Portfolio Analysis', de: 'Portfolioanalyse', fr: 'Analyse de portefeuille', es: 'Análisis de cartera', it: 'Analisi del portafoglio' },
  source_portfolio_irr: { nl: 'IRR Analyse', en: 'IRR Analysis', de: 'IRR-Analyse', fr: 'Analyse TRI', es: 'Análisis TIR', it: 'Analisi TIR' },
  source_profitability: { nl: 'Winstgevendheid', en: 'Profitability', de: 'Rentabilität', fr: 'Rentabilité', es: 'Rentabilidad', it: 'Redditività' },
  source_budget: { nl: 'Budget Analyse', en: 'Budget Analysis', de: 'Budgetanalyse', fr: 'Analyse budgétaire', es: 'Análisis presupuestario', it: 'Analisi del budget' },
  source_risk: { nl: 'Risico Analyse', en: 'Risk Analysis', de: 'Risikoanalyse', fr: 'Analyse des risques', es: 'Análisis de riesgos', it: 'Analisi dei rischi' },
  source_job_comparison: { nl: 'Klusvergelijking', en: 'Job Comparison', de: 'Auftragsvergleich', fr: 'Comparaison de travaux', es: 'Comparación de trabajos', it: 'Confronto lavori' },
  source_cashflow: { nl: 'Cash Flow Analyse', en: 'Cash Flow Analysis', de: 'Cashflow-Analyse', fr: 'Analyse de trésorerie', es: 'Análisis de flujo de caja', it: 'Analisi del flusso di cassa' },
  source_roi: { nl: 'Platform ROI', en: 'Platform ROI', de: 'Plattform-ROI', fr: 'ROI Plateforme', es: 'ROI de la plataforma', it: 'ROI della piattaforma' },
  source_approval: { nl: 'Goedkeuringen', en: 'Approvals', de: 'Freigaben', fr: 'Approbations', es: 'Aprobaciones', it: 'Approvazioni' },
  source_material: { nl: 'Materiaalanalyse', en: 'Material Analysis', de: 'Materialanalyse', fr: 'Analyse des matériaux', es: 'Análisis de materiales', it: 'Analisi dei materiali' },
  source_quote_benchmark: { nl: 'Offerte Benchmark', en: 'Quote Benchmark', de: 'Angebots-Benchmark', fr: 'Benchmark des devis', es: 'Benchmark de presupuestos', it: 'Benchmark preventivi' },
  source_vasco_ai: { nl: 'Vasco AI', en: 'Vasco AI', de: 'Vasco AI', fr: 'Vasco AI', es: 'Vasco AI', it: 'Vasco AI' },
  source_vasco_personal: { nl: 'Vasco AI (persoonlijk)', en: 'Vasco AI (personal)', de: 'Vasco AI (persönlich)', fr: 'Vasco AI (personnel)', es: 'Vasco AI (personal)', it: 'Vasco AI (personale)' },

  // ===== EVIDENCE TEMPLATES =====
  evidence_based_on_invoices: { nl: 'Op basis van {{count}} facturen', en: 'Based on {{count}} invoices', de: 'Basierend auf {{count}} Rechnungen', fr: 'Sur la base de {{count}} factures', es: 'Basado en {{count}} facturas', it: 'Basato su {{count}} fatture' },
  evidence_based_on_jobs: { nl: 'Op basis van {{count}} klussen', en: 'Based on {{count}} jobs', de: 'Basierend auf {{count}} Aufträgen', fr: 'Sur la base de {{count}} travaux', es: 'Basado en {{count}} trabajos', it: 'Basato su {{count}} lavori' },
  evidence_based_on_reports: { nl: 'Op basis van {{count}} dagrapporten', en: 'Based on {{count}} daily reports', de: 'Basierend auf {{count}} Tagesberichten', fr: 'Sur la base de {{count}} rapports', es: 'Basado en {{count}} informes', it: 'Basato su {{count}} rapporti' },
  evidence_based_on_certs: { nl: 'Op basis van je certificatenregister', en: 'Based on your certificate register', de: 'Basierend auf Ihrem Zertifikatsregister', fr: 'Sur la base de votre registre de certificats', es: 'Basado en su registro de certificados', it: 'Basato sul registro dei certificati' },

  // ===== ACTION LABELS =====
  action_send_reminder: { nl: 'Herinneringen sturen', en: 'Send reminders', de: 'Erinnerungen senden', fr: 'Envoyer des rappels', es: 'Enviar recordatorios', it: 'Inviare promemoria' },
  action_view_details: { nl: 'Bekijk details', en: 'View details', de: 'Details anzeigen', fr: 'Voir les détails', es: 'Ver detalles', it: 'Vedi dettagli' },
  action_renew_cert: { nl: 'Vernieuwing starten', en: 'Start renewal', de: 'Erneuerung starten', fr: 'Commencer le renouvellement', es: 'Iniciar renovación', it: 'Avviare il rinnovo' },
  action_optimize: { nl: 'Optimaliseren', en: 'Optimize', de: 'Optimieren', fr: 'Optimiser', es: 'Optimizar', it: 'Ottimizzare' },
  action_fill_day: { nl: 'Dag vullen', en: 'Fill day', de: 'Tag füllen', fr: 'Remplir la journée', es: 'Llenar el día', it: 'Riempire la giornata' },
  action_compare: { nl: 'Leverancier vergelijken', en: 'Compare suppliers', de: 'Lieferanten vergleichen', fr: 'Comparer les fournisseurs', es: 'Comparar proveedores', it: 'Confrontare i fornitori' },
  action_adjust_price: { nl: 'Prijzen aanpassen', en: 'Adjust prices', de: 'Preise anpassen', fr: 'Ajuster les prix', es: 'Ajustar precios', it: 'Adeguare i prezzi' },
  action_follow_up: { nl: 'Klant opvolgen', en: 'Follow up customer', de: 'Kunden nachfassen', fr: 'Relancer le client', es: 'Seguimiento al cliente', it: 'Seguire il cliente' },
  action_submit_report: { nl: 'Dagrapport invullen', en: 'Submit daily report', de: 'Tagesbericht einreichen', fr: 'Remplir le rapport journalier', es: 'Rellenar informe diario', it: 'Compilare il rapporto giornaliero' },
  action_report_incident: { nl: 'Incident melden', en: 'Report incident', de: 'Vorfall melden', fr: 'Signaler un incident', es: 'Reportar incidente', it: 'Segnalare incidente' },
  action_handle_defects: { nl: 'Gebreken afhandelen', en: 'Handle defects', de: 'Mängel bearbeiten', fr: 'Traiter les défauts', es: 'Gestionar defectos', it: 'Gestire i difetti' },
  action_restore_compliance: { nl: 'Compliance herstellen', en: 'Restore compliance', de: 'Compliance wiederherstellen', fr: 'Rétablir la conformité', es: 'Restaurar cumplimiento', it: 'Ripristinare la conformità' },

  // ===== OVERDUE INVOICE =====
  overdue_title_single: { nl: '1 verlopen factuur', en: '1 overdue invoice', de: '1 überfällige Rechnung', fr: '1 facture en retard', es: '1 factura vencida', it: '1 fattura scaduta' },
  overdue_title_multi: { nl: '{{count}} verlopen facturen', en: '{{count}} overdue invoices', de: '{{count}} überfällige Rechnungen', fr: '{{count}} factures en retard', es: '{{count}} facturas vencidas', it: '{{count}} fatture scadute' },
  overdue_implication_blocked: { nl: 'werkkapitaal geblokkeerd', en: 'working capital blocked', de: 'Betriebskapital blockiert', fr: 'fonds de roulement bloqué', es: 'capital de trabajo bloqueado', it: 'capitale circolante bloccato' },
  overdue_suggestion_phone: { nl: 'Overweeg telefonisch contact — facturen ouder dan 14 dagen vereisen persoonlijke opvolging', en: 'Consider calling — invoices over 14 days old require personal follow-up', de: 'Telefonische Nachfrage erwägen — Rechnungen älter als 14 Tage erfordern persönliche Nachverfolgung', fr: 'Envisagez un appel — les factures de plus de 14 jours nécessitent un suivi personnel', es: 'Considere llamar — facturas de más de 14 días requieren seguimiento personal', it: 'Consideri una chiamata — le fatture oltre 14 giorni richiedono un follow-up personale' },
  overdue_suggestion_email: { nl: 'Stuur een vriendelijke herinnering per e-mail', en: 'Send a friendly email reminder', de: 'Senden Sie eine freundliche E-Mail-Erinnerung', fr: 'Envoyez un rappel amical par email', es: 'Envíe un recordatorio amable por correo', it: 'Invii un promemoria cordiale via email' },
  overdue_impact_faster: { nl: 'Versnelt betaling met gemiddeld 5 dagen', en: 'Speeds up payment by an average of 5 days', de: 'Beschleunigt die Zahlung um durchschnittlich 5 Tage', fr: 'Accélère le paiement de 5 jours en moyenne', es: 'Acelera el pago en un promedio de 5 días', it: 'Accelera il pagamento di una media di 5 giorni' },

  // ===== CERT EXPIRY =====
  cert_expires_this_week: { nl: '{{name}} verloopt deze week!', en: '{{name}} expires this week!', de: '{{name}} läuft diese Woche ab!', fr: '{{name}} expire cette semaine !', es: '¡{{name}} vence esta semana!', it: '{{name}} scade questa settimana!' },
  cert_expires_in_days: { nl: '{{name}} verloopt over {{days}} dagen', en: '{{name}} expires in {{days}} days', de: '{{name}} läuft in {{days}} Tagen ab', fr: '{{name}} expire dans {{days}} jours', es: '{{name}} vence en {{days}} días', it: '{{name}} scade tra {{days}} giorni' },
  cert_renew_message: { nl: 'Vernieuw je {{type}} op tijd om werkonderbrekingen te voorkomen.', en: 'Renew your {{type}} on time to prevent work interruptions.', de: 'Erneuern Sie Ihr {{type}} rechtzeitig, um Arbeitsunterbrechungen zu vermeiden.', fr: 'Renouvelez votre {{type}} à temps pour éviter les interruptions de travail.', es: 'Renueve su {{type}} a tiempo para evitar interrupciones.', it: 'Rinnovi il {{type}} in tempo per evitare interruzioni.' },
  cert_more_expiring: { nl: 'Nog {{count}} andere items verlopen binnenkort.', en: '{{count}} more items expiring soon.', de: 'Noch {{count}} weitere Elemente laufen bald ab.', fr: 'Encore {{count}} éléments expirent bientôt.', es: '{{count}} elementos más vencen pronto.', it: 'Altri {{count}} elementi in scadenza.' },
  cert_implication_urgent: { nl: 'Verlopen certificaten kunnen leiden tot werkstop en boetes', en: 'Expired certificates can lead to work stoppage and fines', de: 'Abgelaufene Zertifikate können zu Arbeitsunterbrechungen und Bußgeldern führen', fr: 'Les certificats expirés peuvent entraîner un arrêt de travail et des amendes', es: 'Los certificados vencidos pueden causar parada laboral y multas', it: 'I certificati scaduti possono causare interruzione lavori e sanzioni' },
  cert_implication_plan: { nl: 'Tijdig vernieuwen voorkomt last-minute kosten en stress', en: 'Timely renewal prevents last-minute costs and stress', de: 'Rechtzeitige Erneuerung vermeidet Last-Minute-Kosten und Stress', fr: 'Le renouvellement à temps évite les coûts et le stress de dernière minute', es: 'La renovación oportuna evita costes y estrés de última hora', it: 'Il rinnovo tempestivo evita costi e stress dell\'ultimo minuto' },
  cert_impact_prevent: { nl: 'Voorkom werkonderbreking en boetes', en: 'Prevent work interruption and fines', de: 'Arbeitsunterbrechung und Bußgelder vermeiden', fr: 'Prévenir les interruptions et amendes', es: 'Prevenir interrupciones y multas', it: 'Prevenire interruzioni e sanzioni' },
  cert_impact_plan: { nl: 'Vernieuw op tijd — doorlooptijd is 2-4 weken', en: 'Renew on time — lead time is 2-4 weeks', de: 'Rechtzeitig erneuern — Vorlaufzeit 2-4 Wochen', fr: 'Renouvelez à temps — délai de 2 à 4 semaines', es: 'Renueve a tiempo — plazo de 2-4 semanas', it: 'Rinnovi in tempo — tempi di 2-4 settimane' },

  // ===== CREW PERFORMANCE (Site Lead) =====
  crew_utilization_dropping: { nl: 'Bezettingsgraad daalt: {{pct}}%', en: 'Utilization dropping: {{pct}}%', de: 'Auslastung sinkt: {{pct}}%', fr: 'Taux d\'occupation en baisse : {{pct}}%', es: 'Ocupación bajando: {{pct}}%', it: 'Tasso di occupazione in calo: {{pct}}%' },
  crew_low_utilization: { nl: 'Lage bezetting: {{pct}}%', en: 'Low utilization: {{pct}}%', de: 'Niedrige Auslastung: {{pct}}%', fr: 'Occupation basse : {{pct}}%', es: 'Baja ocupación: {{pct}}%', it: 'Bassa occupazione: {{pct}}%' },
  crew_report_impact: { nl: 'Consistent rapporteren verbetert voorspellingen met 40%', en: 'Consistent reporting improves predictions by 40%', de: 'Konsistente Berichte verbessern Vorhersagen um 40%', fr: 'Des rapports réguliers améliorent les prévisions de 40%', es: 'Informes consistentes mejoran predicciones un 40%', it: 'Report costanti migliorano le previsioni del 40%' },

  // ===== INCIDENT TREND (Site Lead) =====
  incident_spike: { nl: 'Incidentpiek: {{count}} deze week', en: 'Incident spike: {{count}} this week', de: 'Vorfallspitze: {{count}} diese Woche', fr: 'Pic d\'incidents : {{count}} cette semaine', es: 'Pico de incidentes: {{count}} esta semana', it: 'Picco incidenti: {{count}} questa settimana' },
  incident_high_severity: { nl: 'Ernstig incident gemeld', en: 'Serious incident reported', de: 'Schwerer Vorfall gemeldet', fr: 'Incident grave signalé', es: 'Incidente grave reportado', it: 'Incidente grave segnalato' },
  incident_near_misses: { nl: '{{count}} bijna-ongeluk(ken) deze week', en: '{{count}} near-miss(es) this week', de: '{{count}} Beinahe-Unfall/-Unfälle diese Woche', fr: '{{count}} quasi-accident(s) cette semaine', es: '{{count}} casi-accidente(s) esta semana', it: '{{count}} quasi-incidente/i questa settimana' },
  incident_report_impact: { nl: 'Elke melding verbetert het veiligheidspatroon', en: 'Every report improves the safety pattern', de: 'Jede Meldung verbessert das Sicherheitsmuster', fr: 'Chaque signalement améliore le profil de sécurité', es: 'Cada reporte mejora el patrón de seguridad', it: 'Ogni segnalazione migliora il profilo di sicurezza' },

  // ===== DEFECT CLUSTER (Site Lead) =====
  defect_concentration_trade: { nl: '{{count}}/{{total}} gebreken bij {{trade}}', en: '{{count}}/{{total}} defects at {{trade}}', de: '{{count}}/{{total}} Mängel bei {{trade}}', fr: '{{count}}/{{total}} défauts chez {{trade}}', es: '{{count}}/{{total}} defectos en {{trade}}', it: '{{count}}/{{total}} difetti presso {{trade}}' },
  defect_close_impact: { nl: 'open gebreken — snel afsluiten verlaagt herstelkosten 35%', en: 'open defects — quick closure reduces repair costs 35%', de: 'offene Mängel — schnelles Schließen senkt Reparaturkosten um 35%', fr: 'défauts ouverts — fermeture rapide réduit les coûts de 35%', es: 'defectos abiertos — cierre rápido reduce costes un 35%', it: 'difetti aperti — chiusura rapida riduce i costi del 35%' },

  // ===== CERT RENEWAL PLANNER (Site Lead) =====
  cert_planner_expired: { nl: '{{count}} verlopen certificaat(en)', en: '{{count}} expired certificate(s)', de: '{{count}} abgelaufene(s) Zertifikat(e)', fr: '{{count}} certificat(s) expiré(s)', es: '{{count}} certificado(s) vencido(s)', it: '{{count}} certificato/i scaduto/i' },
  cert_planner_batch: { nl: '{{count}} certificaten verlopen in {{month}}', en: '{{count}} certificates expire in {{month}}', de: '{{count}} Zertifikate laufen im {{month}} ab', fr: '{{count}} certificats expirent en {{month}}', es: '{{count}} certificados vencen en {{month}}', it: '{{count}} certificati scadono a {{month}}' },
  cert_planner_prevent_stop: { nl: 'Voorkom werkstop — verlopen certificaten direct vernieuwen', en: 'Prevent work stoppage — renew expired certificates immediately', de: 'Arbeitsunterbrechung vermeiden — abgelaufene Zertifikate sofort erneuern', fr: 'Prévenir l\'arrêt de travail — renouveler immédiatement', es: 'Prevenir parada — renovar certificados vencidos inmediatamente', it: 'Prevenire interruzione — rinnovare immediatamente i certificati scaduti' },
  cert_planner_spread: { nl: 'Plan vernieuwingen om piekkosten te vermijden', en: 'Plan renewals to avoid peak costs', de: 'Erneuerungen planen, um Kostenspitzen zu vermeiden', fr: 'Planifiez les renouvellements pour éviter les pics de coûts', es: 'Planifique renovaciones para evitar picos de costes', it: 'Pianifichi i rinnovi per evitare picchi di costi' },

  // ===== OVERDUE INVOICE (extended) =====
  overdue_message: { nl: '€{{amount}} uitstaand. Stuur een herinnering om sneller betaald te worden.', en: '€{{amount}} outstanding. Send a reminder to get paid faster.', de: '€{{amount}} ausstehend. Senden Sie eine Erinnerung, um schneller bezahlt zu werden.', fr: '€{{amount}} en attente. Envoyez un rappel pour être payé plus vite.', es: '€{{amount}} pendiente. Envíe un recordatorio para cobrar más rápido.', it: '€{{amount}} in sospeso. Invii un promemoria per essere pagato prima.' },

  // ===== MARGIN DRIFT =====
  margin_title_erosion: { nl: 'Marge-erosie: €{{amount}}', en: 'Margin erosion: €{{amount}}', de: 'Margenerosion: €{{amount}}', fr: 'Érosion de marge : €{{amount}}', es: 'Erosión de margen: €{{amount}}', it: 'Erosione del margine: €{{amount}}' },
  margin_title_above: { nl: 'Marge boven verwachting: +€{{amount}}', en: 'Margin above target: +€{{amount}}', de: 'Marge über Ziel: +€{{amount}}', fr: 'Marge au-dessus de l\'objectif : +€{{amount}}', es: 'Margen por encima del objetivo: +€{{amount}}', it: 'Margine sopra obiettivo: +€{{amount}}' },
  margin_message_below: { nl: 'Je marges zijn deze maand lager dan begroot. Controleer je kostenvariaties per klus.', en: 'Your margins are below budget this month. Check cost variances per job.', de: 'Ihre Margen liegen unter Budget. Prüfen Sie die Kostenabweichungen.', fr: 'Vos marges sont inférieures au budget. Vérifiez les écarts de coûts.', es: 'Márgenes por debajo del presupuesto. Revise las variaciones de costes.', it: 'Margini sotto budget. Controlla le variazioni di costo.' },
  margin_message_above: { nl: 'Je marges presteren beter dan gepland. Goed bezig!', en: 'Margins performing better than planned. Keep it up!', de: 'Margen besser als geplant. Weiter so!', fr: 'Marges meilleures que prévu. Continuez !', es: '¡Márgenes mejores de lo previsto!', it: 'Margini migliori del previsto. Continua così!' },
  margin_message: { nl: 'Je marges liggen {{pct}}% onder budget deze maand.', en: 'Your margins are {{pct}}% below budget this month.', de: 'Ihre Margen liegen diesen Monat {{pct}}% unter dem Budget.', fr: 'Vos marges sont {{pct}}% en dessous du budget ce mois-ci.', es: 'Sus márgenes están {{pct}}% por debajo del presupuesto este mes.', it: 'I tuoi margini sono {{pct}}% sotto budget questo mese.' },

  // ===== CASH GAP =====
  cashgap_title: { nl: 'Cashflow-gat: €{{amount}}', en: 'Cash flow gap: €{{amount}}', de: 'Cashflow-Lücke: €{{amount}}', fr: 'Écart de trésorerie : €{{amount}}', es: 'Brecha de flujo de caja: €{{amount}}', it: 'Gap di cassa: €{{amount}}' },
  cashgap_message: { nl: '€{{income}} verwachte inkomsten vs €{{expenses}} verwachte uitgaven in de komende {{days}} dagen.', en: '€{{income}} expected income vs €{{expenses}} expected expenses in the next {{days}} days.', de: '€{{income}} erwartete Einnahmen vs €{{expenses}} erwartete Ausgaben in den nächsten {{days}} Tagen.', fr: '€{{income}} de revenus attendus vs €{{expenses}} de dépenses prévues dans les {{days}} prochains jours.', es: '€{{income}} de ingresos esperados vs €{{expenses}} de gastos esperados en los próximos {{days}} días.', it: '€{{income}} di entrate previste vs €{{expenses}} di uscite previste nei prossimi {{days}} giorni.' },

  // ===== CAPACITY =====
  capacity_overload_title: { nl: 'Overbelast: {{pct}}% capaciteit', en: 'Overloaded: {{pct}}% capacity', de: 'Überlastet: {{pct}}% Auslastung', fr: 'Surchargé : {{pct}}% de capacité', es: 'Sobrecargado: {{pct}}% de capacidad', it: 'Sovraccarico: {{pct}}% di capacità' },
  capacity_available_title: { nl: '{{hours}} uur beschikbaar deze week', en: '{{hours}} hours available this week', de: '{{hours}} Stunden diese Woche verfügbar', fr: '{{hours}} heures disponibles cette semaine', es: '{{hours}} horas disponibles esta semana', it: '{{hours}} ore disponibili questa settimana' },

  // ===== DAILY PLANNING =====
  planning_gap_title: { nl: '{{hours}} uur gat in het rooster van vandaag', en: '{{hours}} hour gap in today\'s schedule', de: '{{hours}} Stunden Lücke im heutigen Zeitplan', fr: '{{hours}} heure(s) de creux dans le planning d\'aujourd\'hui', es: '{{hours}} hora(s) de hueco en la agenda de hoy', it: '{{hours}} ore di buco nella pianificazione di oggi' },
  planning_message: { nl: 'Je hebt vrije tijd tussen {{start}} en {{end}}. Vul het in om je omzet te maximaliseren.', en: 'You have free time between {{start}} and {{end}}. Fill it to maximize revenue.', de: 'Sie haben freie Zeit zwischen {{start}} und {{end}}. Füllen Sie diese, um Ihren Umsatz zu maximieren.', fr: 'Vous avez du temps libre entre {{start}} et {{end}}. Remplissez-le pour maximiser votre chiffre d\'affaires.', es: 'Tiene tiempo libre entre {{start}} y {{end}}. Llénelo para maximizar sus ingresos.', it: 'Hai tempo libero tra le {{start}} e le {{end}}. Riempilo per massimizzare il fatturato.' },

  // ===== DSO TREND =====
  dso_title: { nl: 'DSO gestegen naar {{days}} dagen', en: 'DSO risen to {{days}} days', de: 'DSO auf {{days}} Tage gestiegen', fr: 'DSO en hausse : {{days}} jours', es: 'DSO aumentado a {{days}} días', it: 'DSO salito a {{days}} giorni' },
  dso_message: { nl: 'Gemiddelde betaaltijd is gestegen van {{from}} naar {{to}} dagen.', en: 'Average payment time increased from {{from}} to {{to}} days.', de: 'Durchschnittliche Zahlungsfrist von {{from}} auf {{to}} Tage gestiegen.', fr: 'Le délai moyen de paiement est passé de {{from}} à {{to}} jours.', es: 'El plazo medio de pago aumentó de {{from}} a {{to}} días.', it: 'Il tempo medio di pagamento è aumentato da {{from}} a {{to}} giorni.' },

  // ===== LABOR EFFICIENCY =====
  labor_title: { nl: '{{pct}}% stilstandtijd deze maand', en: '{{pct}}% idle time this month', de: '{{pct}}% Leerlaufzeit diesen Monat', fr: '{{pct}}% de temps d\'inactivité ce mois-ci', es: '{{pct}}% de tiempo inactivo este mes', it: '{{pct}}% di tempo inattivo questo mese' },
  labor_message: { nl: '{{hours}} uur niet-productieve tijd. Routeoptimalisatie kan {{savings}} uur/week besparen.', en: '{{hours}} hours non-productive time. Travel optimization could save {{savings}} hours/week.', de: '{{hours}} Stunden nicht-produktive Zeit. Routenoptimierung könnte {{savings}} Stunden/Woche einsparen.', fr: '{{hours}} heures non productives. L\'optimisation des trajets pourrait économiser {{savings}} heures/semaine.', es: '{{hours}} horas no productivas. La optimización de rutas podría ahorrar {{savings}} horas/semana.', it: '{{hours}} ore non produttive. L\'ottimizzazione dei percorsi potrebbe risparmiare {{savings}} ore/settimana.' },

  // ===== ESTIMATION CALIBRATION =====
  estimation_title: { nl: 'Nauwkeurigheid schattingen: {{pct}}%', en: 'Estimation accuracy: {{pct}}%', de: 'Kalkulationsgenauigkeit: {{pct}}%', fr: 'Précision des estimations : {{pct}}%', es: 'Precisión de estimaciones: {{pct}}%', it: 'Precisione delle stime: {{pct}}%' },
  estimation_message: { nl: 'Je schattingen zijn gemiddeld {{pct}}% {{direction}}.', en: 'Your estimates are {{direction}} by an average of {{pct}}%.', de: 'Ihre Kalkulationen weichen im Durchschnitt um {{pct}}% {{direction}} ab.', fr: 'Vos estimations sont en moyenne {{pct}}% {{direction}}.', es: 'Sus estimaciones son en promedio {{pct}}% {{direction}}.', it: 'Le tue stime sono in media {{pct}}% {{direction}}.' },
  estimation_direction_over: { nl: 'te hoog', en: 'over', de: 'zu hoch', fr: 'trop élevé', es: 'demasiado alto', it: 'troppo alto' },
  estimation_direction_under: { nl: 'te laag', en: 'under', de: 'zu niedrig', fr: 'trop bas', es: 'demasiado bajo', it: 'troppo basso' },

  // ===== SUPPLIER PRICE (Procurement) =====
  supplier_title: { nl: 'Besparingskans: €{{amount}}', en: 'Savings opportunity: €{{amount}}', de: 'Einsparmöglichkeit: €{{amount}}', fr: 'Opportunité d\'économie : €{{amount}}', es: 'Oportunidad de ahorro: €{{amount}}', it: 'Opportunità di risparmio: €{{amount}}' },
  supplier_message: { nl: 'Stap over naar {{supplier}} voor {{material}} om €{{savings}}/bestelling te besparen.', en: 'Switch to {{supplier}} for {{material}} to save €{{savings}}/order.', de: 'Wechseln Sie zu {{supplier}} für {{material}} und sparen Sie €{{savings}}/Bestellung.', fr: 'Passez à {{supplier}} pour {{material}} et économisez €{{savings}}/commande.', es: 'Cambie a {{supplier}} para {{material}} y ahorre €{{savings}}/pedido.', it: 'Passa a {{supplier}} per {{material}} per risparmiare €{{savings}}/ordine.' },

  // ===== COMPLIANCE ALERT =====
  compliance_title: { nl: '{{count}} compliance-probleem/-problemen', en: '{{count}} compliance issue(s)', de: '{{count}} Compliance-Problem(e)', fr: '{{count}} problème(s) de conformité', es: '{{count}} problema(s) de cumplimiento', it: '{{count}} problema/i di conformità' },
  compliance_message: { nl: 'Compliance-score: {{score}}/100. {{count}} waarschuwing(en) vereisen aandacht.', en: 'Compliance score: {{score}}/100. {{count}} warning(s) require attention.', de: 'Compliance-Score: {{score}}/100. {{count}} Warnung(en) erfordern Aufmerksamkeit.', fr: 'Score de conformité : {{score}}/100. {{count}} avertissement(s) nécessitent attention.', es: 'Puntuación de cumplimiento: {{score}}/100. {{count}} advertencia(s) requieren atención.', it: 'Punteggio di conformità: {{score}}/100. {{count}} avviso/i richiedono attenzione.' },

  // ===== WEATHER SCHEDULE =====
  weather_title: { nl: 'Regen verwacht: plan buitenwerk om', en: 'Rain expected: reschedule outdoor work', de: 'Regen erwartet: Außenarbeiten umplanen', fr: 'Pluie prévue : reprogrammer les travaux extérieurs', es: 'Lluvia prevista: reprogramar trabajo exterior', it: 'Pioggia prevista: riprogrammare i lavori esterni' },
  weather_message: { nl: 'Weersvoorspelling toont regen van {{start}} tot {{end}}. Verplaats buitenwerk naar {{alternative}}.', en: 'Weather forecast shows rain from {{start}} to {{end}}. Move outdoor tasks to {{alternative}}.', de: 'Wettervorhersage zeigt Regen von {{start}} bis {{end}}. Außenarbeiten auf {{alternative}} verschieben.', fr: 'Les prévisions météo annoncent de la pluie de {{start}} à {{end}}. Déplacez les tâches extérieures vers {{alternative}}.', es: 'El pronóstico muestra lluvia de {{start}} a {{end}}. Traslade las tareas exteriores a {{alternative}}.', it: 'Le previsioni indicano pioggia dalle {{start}} alle {{end}}. Sposta i lavori esterni a {{alternative}}.' },

  // ===== GOAL PROGRESS =====
  goal_title: { nl: 'Besparingsdoel: {{pct}}% behaald', en: 'Savings goal: {{pct}}% achieved', de: 'Sparziel: {{pct}}% erreicht', fr: 'Objectif d\'économies : {{pct}}% atteint', es: 'Objetivo de ahorro: {{pct}}% alcanzado', it: 'Obiettivo di risparmio: {{pct}}% raggiunto' },
  goal_message: { nl: '€{{current}} van €{{target}} besparingsdoel bereikt deze {{period}}.', en: '€{{current}} of €{{target}} savings target reached this {{period}}.', de: '€{{current}} von €{{target}} Sparziel in diesem {{period}} erreicht.', fr: '€{{current}} sur €{{target}} d\'objectif d\'économies atteint cette {{period}}.', es: '€{{current}} de €{{target}} del objetivo de ahorro alcanzado este {{period}}.', it: '€{{current}} di €{{target}} dell\'obiettivo di risparmio raggiunto questo {{period}}.' },

  // ===== PROFITABILITY =====
  profit_title: { nl: 'Meest winstgevend: {{jobType}}', en: 'Most profitable: {{jobType}}', de: 'Am profitabelsten: {{jobType}}', fr: 'Le plus rentable : {{jobType}}', es: 'Más rentable: {{jobType}}', it: 'Più redditizio: {{jobType}}' },
  profit_message: { nl: '{{jobType}}-klussen leveren {{margin}}% marge op — {{pct}}x beter dan gemiddeld.', en: '{{jobType}} jobs deliver {{margin}}% margin — {{pct}}x better than average.', de: '{{jobType}}-Aufträge liefern {{margin}}% Marge — {{pct}}x besser als der Durchschnitt.', fr: 'Les travaux {{jobType}} génèrent {{margin}}% de marge — {{pct}}x mieux que la moyenne.', es: 'Los trabajos de {{jobType}} generan {{margin}}% de margen — {{pct}}x mejor que el promedio.', it: 'I lavori di {{jobType}} generano {{margin}}% di margine — {{pct}}x meglio della media.' },

  // ===== FINANCIAL AUDIT =====
  audit_title: { nl: '{{count}} anomalie(ën) gedetecteerd', en: '{{count}} anomaly(ies) detected', de: '{{count}} Anomalie(n) erkannt', fr: '{{count}} anomalie(s) détectée(s)', es: '{{count}} anomalía(s) detectada(s)', it: '{{count}} anomalia/e rilevata/e' },
  audit_message: { nl: 'Financiële audit vond {{count}} ongewone transactie(s) ter waarde van €{{amount}}.', en: 'Financial audit found {{count}} unusual transaction(s) worth €{{amount}}.', de: 'Finanzprüfung fand {{count}} ungewöhnliche Transaktion(en) im Wert von €{{amount}}.', fr: 'L\'audit financier a trouvé {{count}} transaction(s) inhabituelle(s) d\'une valeur de €{{amount}}.', es: 'La auditoría financiera encontró {{count}} transacción(es) inusual(es) por valor de €{{amount}}.', it: 'L\'audit finanziario ha rilevato {{count}} transazione/i insolita/e per un valore di €{{amount}}.' },

  // ===== CUSTOMER LIFECYCLE =====
  customer_at_risk_title: { nl: 'Klant dreigt af te haken: {{name}}', en: 'Customer at risk: {{name}}', de: 'Kunde gefährdet: {{name}}', fr: 'Client à risque : {{name}}', es: 'Cliente en riesgo: {{name}}', it: 'Cliente a rischio: {{name}}' },
  customer_opportunity_title: { nl: 'Upsell-kans: {{name}}', en: 'Upsell opportunity: {{name}}', de: 'Upsell-Möglichkeit: {{name}}', fr: 'Opportunité de vente additionnelle : {{name}}', es: 'Oportunidad de venta adicional: {{name}}', it: 'Opportunità di upsell: {{name}}' },

  // ===== FINANCIAL ANALYSIS (cashflow insight generator) =====
  source_financial_analysis: { nl: 'Financiële analyse', en: 'Financial Analysis', de: 'Finanzanalyse', fr: 'Analyse financière', es: 'Análisis financiero', it: 'Analisi finanziaria' },
  fin_revenue_growth_title: { nl: 'Omzet steeg {{pct}}% deze maand', en: 'Revenue grew {{pct}}% this month', de: 'Umsatz stieg {{pct}}% diesen Monat', fr: 'Le chiffre d\'affaires a augmenté de {{pct}}% ce mois', es: 'Los ingresos crecieron {{pct}}% este mes', it: 'Il fatturato è cresciuto del {{pct}}% questo mese' },
  fin_revenue_decline_title: { nl: 'Omzet daalde {{pct}}% deze maand', en: 'Revenue declined {{pct}}% this month', de: 'Umsatz sank {{pct}}% diesen Monat', fr: 'Le chiffre d\'affaires a baissé de {{pct}}% ce mois', es: 'Los ingresos cayeron {{pct}}% este mes', it: 'Il fatturato è diminuito del {{pct}}% questo mese' },
  fin_overdue_title: { nl: '{{count}} facturen achterstallig: €{{amount}}', en: '{{count}} invoices overdue: €{{amount}}', de: '{{count}} Rechnungen überfällig: €{{amount}}', fr: '{{count}} factures en retard : €{{amount}}', es: '{{count}} facturas vencidas: €{{amount}}', it: '{{count}} fatture scadute: €{{amount}}' },
  fin_concentration_title: { nl: 'Klantrisico: {{pct}}% omzet van {{name}}', en: 'Client risk: {{pct}}% revenue from {{name}}', de: 'Kundenrisiko: {{pct}}% Umsatz von {{name}}', fr: 'Risque client : {{pct}}% du CA de {{name}}', es: 'Riesgo de cliente: {{pct}}% ingresos de {{name}}', it: 'Rischio cliente: {{pct}}% fatturato da {{name}}' },
  fin_cashflow_negative_title: { nl: 'Negatieve cashflow verwacht volgende maand', en: 'Negative cashflow expected next month', de: 'Negativer Cashflow nächsten Monat erwartet', fr: 'Flux de trésorerie négatif attendu le mois prochain', es: 'Flujo de caja negativo esperado el próximo mes', it: 'Flusso di cassa negativo previsto il prossimo mese' },
  fin_winrate_drop_title: { nl: 'Offerte-succesratio gedaald naar {{pct}}%', en: 'Quote win rate dropped to {{pct}}%', de: 'Angebotsgewinnrate auf {{pct}}% gefallen', fr: 'Taux de réussite des devis tombé à {{pct}}%', es: 'Tasa de éxito de presupuestos cayó a {{pct}}%', it: 'Tasso di successo preventivi sceso al {{pct}}%' },
  fin_dso_high_title: { nl: 'Gemiddelde betaaltermijn: {{days}} dagen', en: 'Average payment time: {{days}} days', de: 'Durchschnittliche Zahlungsfrist: {{days}} Tage', fr: 'Délai de paiement moyen : {{days}} jours', es: 'Plazo medio de pago: {{days}} días', it: 'Tempo medio di pagamento: {{days}} giorni' },
  fin_action_send_invoices: { nl: 'Openstaande facturen versturen', en: 'Send pending invoices', de: 'Ausstehende Rechnungen senden', fr: 'Envoyer les factures en attente', es: 'Enviar facturas pendientes', it: 'Inviare fatture in sospeso' },
  fin_action_review_pricing: { nl: 'Prijzen herzien', en: 'Review pricing', de: 'Preise überprüfen', fr: 'Réviser les prix', es: 'Revisar precios', it: 'Rivedere i prezzi' },
  fin_action_diversify: { nl: 'Klantenbase diversifiëren', en: 'Diversify client base', de: 'Kundenbasis diversifizieren', fr: 'Diversifier la clientèle', es: 'Diversificar la cartera de clientes', it: 'Diversificare la base clienti' },
};

// ---------------------------------------------------------------------------
// Translation helper — use in generators
// ---------------------------------------------------------------------------

/**
 * Generator translate — looks up a key in the translation registry.
 * Supports interpolation: gt('overdue_title_multi', 'en', { count: 5 })
 * Falls back to Dutch if language not found.
 */
export function gt(key: string, language: GeneratorLanguage, params?: Record<string, string | number>): string {
  const entry = TRANSLATIONS[key];
  if (!entry) return key; // key not found — return key itself as fallback

  let text = entry[language] ?? entry['nl'] ?? key;

  // Simple interpolation: replace {{param}} with value
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
    }
  }

  return text;
}

// Re-export for convenience
export { TRANSLATIONS };
