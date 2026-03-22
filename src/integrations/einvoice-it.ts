// =============================================================================
// E-INVOICE SERVICE — FatturaPA (Italian SDI format)
// =============================================================================
// Mandatory in Italy since 2019 for all B2B/B2C/B2G invoices
// All invoices must be transmitted via SDI (Sistema di Interscambio)
// Format: FatturaPA XML v1.2 (FPA12 for PA, FPR12 for private)
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FormatoTrasmissione = 'FPA12' | 'FPR12';
// FPA12 = Pubblica Amministrazione (public administration)
// FPR12 = Privati (B2B / B2C)

export type RegimeFiscale =
  | 'RF01' // Ordinario
  | 'RF02' // Contribuenti minimi (art.1, c.96-117, L.244/2007)
  | 'RF04' // Agricoltura e attività connesse e pesca
  | 'RF05' // Vendita sali e tabacchi
  | 'RF06' // Commercio fiammiferi
  | 'RF07' // Editoria
  | 'RF08' // Gestione servizi telefonia pubblica
  | 'RF09' // Rivendita documenti di trasporto pubblico
  | 'RF10' // Intrattenimenti, giochi e altre attività (art.74, c.6)
  | 'RF11' // Agenzie di viaggio e turismo
  | 'RF12' // Agriturismo
  | 'RF13' // Vendite a domicilio
  | 'RF14' // Rivendita beni usati / oggetti d'arte
  | 'RF15' // Agenzie di vendite all'asta
  | 'RF16' // IVA per cassa P.A. (art.6, c.5)
  | 'RF17' // IVA per cassa (art.32-bis, DL 83/2012)
  | 'RF18' // Altro
  | 'RF19'; // Regime forfettario

export type NaturaEsenzione =
  | 'N1' // Escluse ex art.15
  | 'N2.1' // Non soggette — artt. da 7 a 7-septies
  | 'N2.2' // Non soggette — altri casi
  | 'N3.1' // Non imponibili — esportazioni
  | 'N3.2' // Non imponibili — cessioni intracomunitarie
  | 'N3.3' // Non imponibili — cessioni verso San Marino
  | 'N3.4' // Non imponibili — operazioni assimilate alle cessioni all'esportazione
  | 'N3.5' // Non imponibili — a seguito di dichiarazioni d'intento
  | 'N3.6' // Non imponibili — altre operazioni
  | 'N4' // Esenti
  | 'N5' // Regime del margine / IVA non esposta
  | 'N6.1' // Inversione contabile — cessione rottami
  | 'N6.2' // Inversione contabile — cessione oro/argento
  | 'N6.3' // Inversione contabile — subappalto edilizia
  | 'N6.4' // Inversione contabile — cessione fabbricati
  | 'N6.5' // Inversione contabile — cessione telefoni
  | 'N6.6' // Inversione contabile — cessione prodotti elettronici
  | 'N6.7' // Inversione contabile — prestazioni comparto edile
  | 'N6.8' // Inversione contabile — operazioni settore energetico
  | 'N6.9' // Inversione contabile — altri casi
  | 'N7'; // IVA assolta in altro stato UE

export type EsigibilitaIVA =
  | 'I' // IVA immediata
  | 'D' // IVA differita
  | 'S'; // Scissione dei pagamenti (split payment)

export type ModalitaPagamento =
  | 'MP01' // Contanti
  | 'MP02' // Assegno
  | 'MP05' // Bonifico
  | 'MP08' // Carta di pagamento
  | 'MP12' // RIBA
  | 'MP19' // SEPA Direct Debit
  | 'MP21' // PagoPA
  | 'MP23'; // PagoPA

// Seller (Cedente/Prestatore)
export interface CedentePrestatore {
  denominazione: string; // Company name (or Nome+Cognome for individual)
  nome?: string; // First name (persona fisica)
  cognome?: string; // Last name (persona fisica)
  partitaIva: string; // P.IVA (11 digits)
  codiceFiscale?: string; // Codice Fiscale (16 chars for individual, 11 for company)
  regimeFiscale: RegimeFiscale;
  indirizzo: string;
  cap: string;
  comune: string;
  provincia: string; // 2-letter code (e.g. MI, RM, NA)
  nazione: string; // IT
  rea?: { // Camera di Commercio
    ufficio: string; // Province code
    numeroRea: string;
    capitaleSociale?: number;
    socioUnico?: 'SU' | 'SM';
    statoLiquidazione: 'LS' | 'LN';
  };
}

// Buyer (Cessionario/Committente)
export interface CessionarioCommittente {
  denominazione: string;
  nome?: string;
  cognome?: string;
  partitaIva?: string;
  codiceFiscale?: string;
  indirizzo: string;
  cap: string;
  comune: string;
  provincia: string;
  nazione: string;
  codiceDestinatario: string; // 7-char SDI code, or '0000000' if PEC
  pec?: string; // PEC email for routing (alternative to CodiceDestinatario)
}

export interface FatturaPALineItem {
  descrizione: string;
  quantita: number;
  unitaMisura?: string; // e.g. 'ore', 'pz', 'm', 'kg'
  prezzoUnitario: number;
  prezzoTotale: number;
  aliquotaIva: number; // 0 | 4 | 5 | 10 | 22
  natura?: NaturaEsenzione; // Required when aliquotaIva is 0
}

export interface FatturaPA {
  // Transmission
  formatoTrasmissione: FormatoTrasmissione;
  progressivoInvio: string; // Unique transmission ID (max 10 chars)
  codiceDestinatario: string; // 6 chars for PA, 7 chars for private

  // Seller
  cedentePrestatore: CedentePrestatore;

  // Buyer
  cessionarioCommittente: CessionarioCommittente;

  // Invoice header
  tipoDocumento: string; // TD01 (fattura), TD04 (nota credito), TD06 (parcella)
  numero: string; // Invoice number
  data: string; // YYYY-MM-DD
  divisa: string; // EUR

  // Line items
  dettaglioLinee: FatturaPALineItem[];

  // Totals
  totalNet: number;
  totalVat: number;
  totalGross: number;

  // Payment
  condizioniPagamento?: 'TP01' | 'TP02' | 'TP03'; // TP01 rate, TP02 completo, TP03 anticipo
  modalitaPagamento?: ModalitaPagamento;
  iban?: string;
  dataScadenzaPagamento?: string; // Due date YYYY-MM-DD

  // Bollo virtuale
  bolloVirtuale?: boolean; // Marca da bollo 2 EUR for exempt invoices > 77.47 EUR
  importoBollo?: number; // Default 2.00

  // Split payment (Scissione pagamenti) for PA invoices
  splitPayment?: boolean;

  // Esigibilità IVA
  esigibilitaIva?: EsigibilitaIVA;

  // Cassa previdenziale (for professionists — e.g. INPS, INARCASSA)
  cassaPrevidenziale?: {
    tipoCassa: string; // TC01 (INPS), TC22 (INARCASSA), etc.
    alCassa: number; // Percentage (e.g. 4)
    importoContributoCassa: number;
    imponibileCassa: number;
    aliquotaIva: number;
  };
}

// ---------------------------------------------------------------------------
// Italian IVA rates
// ---------------------------------------------------------------------------

export const IVA_RATES_IT = {
  ORDINARIA: 22, // Aliquota ordinaria
  RIDOTTA_10: 10, // Aliquota ridotta (ristrutturazione edilizia)
  RIDOTTA_5: 5, // Aliquota ridotta (prestazioni socio-sanitarie)
  MINIMA: 4, // Aliquota minima (beni di prima necessità)
  ESENTE: 0, // Esente (requires Natura code)
} as const;

// ---------------------------------------------------------------------------
// Generate FatturaPA XML (v1.2)
// ---------------------------------------------------------------------------

export function generateFatturaPAXml(data: FatturaPA): string {
  const seller = data.cedentePrestatore;
  const buyer = data.cessionarioCommittente;

  // Build VAT summary (DatiRiepilogo)
  const vatSummary = buildDatiRiepilogo(data.dettaglioLinee, data.esigibilitaIva, data.splitPayment);

  // Build line items (DettaglioLinee)
  const dettaglioXml = data.dettaglioLinee.map((li, idx) => `
        <DettaglioLinee>
          <NumeroLinea>${idx + 1}</NumeroLinea>
          <Descrizione>${escapeXml(li.descrizione)}</Descrizione>
          <Quantita>${li.quantita.toFixed(2)}</Quantita>${li.unitaMisura ? `
          <UnitaMisura>${escapeXml(li.unitaMisura)}</UnitaMisura>` : ''}
          <PrezzoUnitario>${li.prezzoUnitario.toFixed(2)}</PrezzoUnitario>
          <PrezzoTotale>${li.prezzoTotale.toFixed(2)}</PrezzoTotale>
          <AliquotaIVA>${li.aliquotaIva.toFixed(2)}</AliquotaIVA>${li.natura ? `
          <Natura>${li.natura}</Natura>` : ''}
        </DettaglioLinee>`).join('');

  // Seller name block
  const sellerAnagraficaXml = seller.nome && seller.cognome
    ? `<Nome>${escapeXml(seller.nome)}</Nome>
              <Cognome>${escapeXml(seller.cognome)}</Cognome>`
    : `<Denominazione>${escapeXml(seller.denominazione)}</Denominazione>`;

  // Buyer name block
  const buyerAnagraficaXml = buyer.nome && buyer.cognome
    ? `<Nome>${escapeXml(buyer.nome)}</Nome>
              <Cognome>${escapeXml(buyer.cognome)}</Cognome>`
    : `<Denominazione>${escapeXml(buyer.denominazione)}</Denominazione>`;

  // REA block
  const reaXml = seller.rea ? `
          <IscrizioneREA>
            <Ufficio>${escapeXml(seller.rea.ufficio)}</Ufficio>
            <NumeroREA>${escapeXml(seller.rea.numeroRea)}</NumeroREA>${seller.rea.capitaleSociale !== undefined ? `
            <CapitaleSociale>${seller.rea.capitaleSociale.toFixed(2)}</CapitaleSociale>` : ''}${seller.rea.socioUnico ? `
            <SocioUnico>${seller.rea.socioUnico}</SocioUnico>` : ''}
            <StatoLiquidazione>${seller.rea.statoLiquidazione}</StatoLiquidazione>
          </IscrizioneREA>` : '';

  // Bollo virtuale
  const bolloXml = data.bolloVirtuale ? `
          <DatiBollo>
            <BolloVirtuale>SI</BolloVirtuale>
            <ImportoBollo>${(data.importoBollo ?? 2.00).toFixed(2)}</ImportoBollo>
          </DatiBollo>` : '';

  // Cassa previdenziale
  const cassaXml = data.cassaPrevidenziale ? `
          <DatiCassaPrevidenziale>
            <TipoCassa>${data.cassaPrevidenziale.tipoCassa}</TipoCassa>
            <AlCassa>${data.cassaPrevidenziale.alCassa.toFixed(2)}</AlCassa>
            <ImportoContributoCassa>${data.cassaPrevidenziale.importoContributoCassa.toFixed(2)}</ImportoContributoCassa>
            <ImponibileCassa>${data.cassaPrevidenziale.imponibileCassa.toFixed(2)}</ImponibileCassa>
            <AliquotaIVA>${data.cassaPrevidenziale.aliquotaIva.toFixed(2)}</AliquotaIVA>
          </DatiCassaPrevidenziale>` : '';

  // Payment block
  const paymentXml = data.condizioniPagamento ? `
      <DatiPagamento>
        <CondizioniPagamento>${data.condizioniPagamento}</CondizioniPagamento>
        <DettaglioPagamento>
          <ModalitaPagamento>${data.modalitaPagamento ?? 'MP05'}</ModalitaPagamento>
          <ImportoPagamento>${data.totalGross.toFixed(2)}</ImportoPagamento>${data.dataScadenzaPagamento ? `
          <DataScadenzaPagamento>${data.dataScadenzaPagamento}</DataScadenzaPagamento>` : ''}${data.iban ? `
          <IBAN>${escapeXml(data.iban)}</IBAN>` : ''}
        </DettaglioPagamento>
      </DatiPagamento>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  versione="${data.formatoTrasmissione}">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente>
        <IdPaese>IT</IdPaese>
        <IdCodice>${escapeXml(seller.partitaIva)}</IdCodice>
      </IdTrasmittente>
      <ProgressivoInvio>${escapeXml(data.progressivoInvio)}</ProgressivoInvio>
      <FormatoTrasmissione>${data.formatoTrasmissione}</FormatoTrasmissione>
      <CodiceDestinatario>${escapeXml(data.codiceDestinatario)}</CodiceDestinatario>${buyer.pec && data.codiceDestinatario === '0000000' ? `
      <PECDestinatario>${escapeXml(buyer.pec)}</PECDestinatario>` : ''}
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>${seller.nazione}</IdPaese>
          <IdCodice>${escapeXml(seller.partitaIva)}</IdCodice>
        </IdFiscaleIVA>${seller.codiceFiscale ? `
        <CodiceFiscale>${escapeXml(seller.codiceFiscale)}</CodiceFiscale>` : ''}
        <Anagrafica>
          ${sellerAnagraficaXml}
        </Anagrafica>
        <RegimeFiscale>${seller.regimeFiscale}</RegimeFiscale>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${escapeXml(seller.indirizzo)}</Indirizzo>
        <CAP>${escapeXml(seller.cap)}</CAP>
        <Comune>${escapeXml(seller.comune)}</Comune>
        <Provincia>${escapeXml(seller.provincia)}</Provincia>
        <Nazione>${seller.nazione}</Nazione>
      </Sede>${reaXml}
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>${buyer.partitaIva ? `
        <IdFiscaleIVA>
          <IdPaese>${buyer.nazione}</IdPaese>
          <IdCodice>${escapeXml(buyer.partitaIva)}</IdCodice>
        </IdFiscaleIVA>` : ''}${buyer.codiceFiscale ? `
        <CodiceFiscale>${escapeXml(buyer.codiceFiscale)}</CodiceFiscale>` : ''}
        <Anagrafica>
          ${buyerAnagraficaXml}
        </Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${escapeXml(buyer.indirizzo)}</Indirizzo>
        <CAP>${escapeXml(buyer.cap)}</CAP>
        <Comune>${escapeXml(buyer.comune)}</Comune>
        <Provincia>${escapeXml(buyer.provincia)}</Provincia>
        <Nazione>${buyer.nazione}</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>${escapeXml(data.tipoDocumento)}</TipoDocumento>
        <Divisa>${data.divisa}</Divisa>
        <Data>${data.data}</Data>
        <Numero>${escapeXml(data.numero)}</Numero>${bolloXml}${cassaXml}
        <ImportoTotaleDocumento>${data.totalGross.toFixed(2)}</ImportoTotaleDocumento>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>${dettaglioXml}
${vatSummary}
    </DatiBeniServizi>${paymentXml}
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDatiRiepilogo(
  items: FatturaPALineItem[],
  esigibilita?: EsigibilitaIVA,
  splitPayment?: boolean,
): string {
  const groups: Record<string, {
    imponibile: number;
    imposta: number;
    aliquota: number;
    natura?: NaturaEsenzione;
  }> = {};

  for (const item of items) {
    const key = `${item.aliquotaIva}_${item.natura ?? ''}`;
    if (!groups[key]) {
      groups[key] = {
        imponibile: 0,
        imposta: 0,
        aliquota: item.aliquotaIva,
        natura: item.natura,
      };
    }
    groups[key].imponibile += item.prezzoTotale;
    groups[key].imposta += item.prezzoTotale * (item.aliquotaIva / 100);
  }

  // Determine EsigibilitaIVA
  const esiCode = splitPayment ? 'S' : (esigibilita ?? 'I');

  return Object.values(groups).map(g => `      <DatiRiepilogo>
        <AliquotaIVA>${g.aliquota.toFixed(2)}</AliquotaIVA>${g.natura ? `
        <Natura>${g.natura}</Natura>` : ''}
        <ImponibileImporto>${g.imponibile.toFixed(2)}</ImponibileImporto>
        <Imposta>${g.imposta.toFixed(2)}</Imposta>
        <EsigibilitaIVA>${esiCode}</EsigibilitaIVA>
      </DatiRiepilogo>`).join('\n');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
