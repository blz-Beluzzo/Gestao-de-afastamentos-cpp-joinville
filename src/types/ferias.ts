export type Equipe =
  | 'Alfa'
  | 'Bravo'
  | 'Charlie'
  | 'Delta'
  | 'Volante'
  | 'Coordenação';

export type Cargo = 'Delegado' | 'Escrivão' | 'Agente';

export const EQUIPES_LISTA: Equipe[] = [
  'Alfa',
  'Bravo',
  'Charlie',
  'Delta',
  'Volante',
  'Coordenação',
];

export const CARGOS_LISTA: Cargo[] = ['Delegado', 'Escrivão', 'Agente'];

export interface RegistroFerias {
  id: string;
  rowIndex?: number; // 1-based row index in Google Sheets (header = 1, data >= 2)
  equipe: Equipe;
  servidor: string;
  cargo: Cargo;
  inicio1: string; // YYYY-MM-DD or ''
  fim1: string;    // YYYY-MM-DD or ''
  inicio2: string; // YYYY-MM-DD or ''
  fim2: string;    // YYYY-MM-DD or ''
}

export type TipoConflito =
  | 'DATA_INVALIDA'
  | 'MES_VEDADO'
  | 'MESMO_CARGO'
  | 'DELEGADO_ESCRIVAO'
  | 'SOBREPOSICAO_PROPRIA';

export interface ConflitoDetalhe {
  tipo: TipoConflito;
  mensagem: string;
  servidorConflitante?: string;
  cargoConflitante?: Cargo;
  equipe?: Equipe;
  periodoConflitante?: string; // formatted DD/MM/YYYY a DD/MM/YYYY
}

export interface ResultadoValidacao {
  valido: boolean;
  mensagem: string;
  conflitos: ConflitoDetalhe[];
}

export interface ServidorValidacaoInput {
  id?: string;
  nome: string;
  equipe: Equipe;
  cargo: Cargo;
  numeroPeriodo?: 1 | 2;
}

export interface PeriodoPretendidoInput {
  inicio: string;
  fim: string;
}

export interface PeriodoAvaliado {
  numero: 1 | 2;
  inicio: string; // YYYY-MM-DD
  fim: string;    // YYYY-MM-DD
  dias: number;
  validacao: ResultadoValidacao;
}

export interface RegistroAvaliado extends RegistroFerias {
  dias1: number;
  dias2: number;
  totalDias: number;
  periodo1Avaliado: PeriodoAvaliado | null;
  periodo2Avaliado: PeriodoAvaliado | null;
  temConflito: boolean;
}

export interface DriveSpreadsheetFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface SheetTabInfo {
  sheetId: number;
  title: string;
}

export interface ConnectedSheetInfo {
  spreadsheetId: string;
  spreadsheetTitle: string;
  sheetTitle: string;
  sheetId: number;
  webViewLink?: string;
  availableTabs?: SheetTabInfo[];
}
