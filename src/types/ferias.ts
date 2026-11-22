export type Equipe =
  | 'Alfa'
  | 'Bravo'
  | 'Charlie'
  | 'Delta'
  | 'Volante'
  | 'Coordenação'
  | 'Terceirizado';

export type Cargo = 'Delegado' | 'Escrivão' | 'Agente' | 'Terceirizado';

export type TipoAfastamento =
  | 'Férias'
  | 'Licença-Prêmio'
  | 'Curso/Convocação'
  | 'Afastamento Médico (LTS/LTF)';

export const EQUIPES_LISTA: Equipe[] = [
  'Alfa',
  'Bravo',
  'Charlie',
  'Delta',
  'Volante',
  'Coordenação',
  'Terceirizado',
];

export const CARGOS_LISTA: Cargo[] = ['Delegado', 'Escrivão', 'Agente'];

export const TIPOS_AFASTAMENTO_LISTA: TipoAfastamento[] = [
  'Férias',
  'Licença-Prêmio',
  'Curso/Convocação',
  'Afastamento Médico (LTS/LTF)',
];

export interface LancamentoAfastamento {
  id: string;
  rowIndex?: number; // 1-based row index in Google Sheets (header = 1, data >= 2)
  sheetFormat?: 'single' | 'legacy2';
  legacySlot?: 1 | 2;
  legacyTwinData?: {
    inicio: string;
    fim: string;
    tipo?: TipoAfastamento;
  };
  equipe: Equipe;
  servidor: string;
  cargo: Cargo;
  tipo: TipoAfastamento;
  inicio: string; // YYYY-MM-DD
  fim: string;    // YYYY-MM-DD
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
  tipo?: TipoAfastamento;
}

export interface PeriodoPretendidoInput {
  inicio: string;
  fim: string;
}

export interface LancamentoAvaliado extends LancamentoAfastamento {
  dias: number;
  validacao: ResultadoValidacao;
}

export interface ServidorAgrupado {
  key: string;
  servidor: string;
  equipe: Equipe;
  cargo: Cargo;
  periodos: LancamentoAvaliado[];
  totalDias: number;
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

export type SheetLayoutKind = 'single' | 'legacy2';

export interface SheetColumnMap {
  layout: SheetLayoutKind;
  headerRowIndex: number; // 0-based
  hasTipoColumn: boolean;
  colEquipe: number;
  colServidor: number;
  colCargo: number;
  colTipo: number;
  colIni1: number;
  colFim1: number;
  colDias1: number;
  colIni2: number;
  colFim2: number;
  colDias2: number;
  colTotal: number;
  colTipo2: number;
}

export interface ConnectedSheetInfo {
  spreadsheetId: string;
  spreadsheetTitle: string;
  sheetTitle: string;
  sheetId: number;
  webViewLink?: string;
  availableTabs?: SheetTabInfo[];
  columnMap?: SheetColumnMap;
}
