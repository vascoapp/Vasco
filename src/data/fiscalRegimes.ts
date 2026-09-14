// =============================================================================
// FatturaPA RegimeFiscale — the codes an Italian seller must declare
// =============================================================================
// The codes are the `RegimeFiscale` type in src/integrations/einvoice-it.ts, and
// the descriptions are the Agenzia delle Entrate's own names for each regime.
// They are deliberately NOT translated: this is a statutory identifier the
// contractor matches against their own tax position (and their accountant's
// paperwork), in Italian, whatever language the app is in. RF03 does not exist
// (abolished). There is no default — RF01 on a forfettario is an invoice SDI
// accepts and that is fiscally wrong (see einvoiceMapping.ts).
import type { RegimeFiscale } from '../integrations/einvoice-it';

export const REGIMI_FISCALI: ReadonlyArray<{ code: RegimeFiscale; label: string }> = [
  { code: 'RF01', label: 'Ordinario' },
  { code: 'RF19', label: 'Regime forfettario' },
  { code: 'RF02', label: 'Contribuenti minimi' },
  { code: 'RF17', label: 'IVA per cassa' },
  { code: 'RF16', label: 'IVA per cassa P.A.' },
  { code: 'RF04', label: 'Agricoltura e attività connesse e pesca' },
  { code: 'RF05', label: 'Vendita sali e tabacchi' },
  { code: 'RF06', label: 'Commercio fiammiferi' },
  { code: 'RF07', label: 'Editoria' },
  { code: 'RF08', label: 'Gestione servizi telefonia pubblica' },
  { code: 'RF09', label: 'Rivendita documenti di trasporto pubblico e di sosta' },
  { code: 'RF10', label: 'Intrattenimenti, giochi e altre attività (art. 74, c. 6)' },
  { code: 'RF11', label: 'Agenzie di viaggi e turismo' },
  { code: 'RF12', label: 'Agriturismo' },
  { code: 'RF13', label: 'Vendite a domicilio' },
  { code: 'RF14', label: 'Rivendita beni usati, oggetti d’arte e da collezione' },
  { code: 'RF15', label: 'Agenzie di vendite all’asta' },
  { code: 'RF18', label: 'Altro' },
];
