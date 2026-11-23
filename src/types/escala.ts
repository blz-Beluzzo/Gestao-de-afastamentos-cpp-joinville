import type { LancamentoAvaliado } from './ferias';

export type EquipePlantao = 'Alfa' | 'Bravo' | 'Charlie' | 'Delta';

export type SlotKey =
  | 'apcDia'
  | 'apcNoite'
  | 'dpcDia'
  | 'dpcNoite'
  | 'epcDia'
  | 'epcNoite';

export type CargoEscala = 'APC' | 'DPC' | 'EPC';
export type TurnoEscala = 'Dia' | 'Noite';

export const DELEGACIAS_LISTA = [
  'DRP - Delegacia Regional de Polícia',
  'DIC - DCE',
  'DIC - DECOD',
  'DIC - DRR',
  'DIC - DEGRIM',
  'DIC - DH',
  'DIC - DPA',
  'DEACLE - Joinville',
  'DEAM - Joinville',
  'DPCAI - Joinville',
  '1ª DPCo',
  '2ª DPCo',
  '3ª DPCo',
  '4ª DPCo',
  '5ª DPCo',
  '6ª DPCo',
  '7ª DPCo',
  'Araquari - DPCO',
  'Araquari - DPCAMI',
  'São Francisco do Sul - DPCO',
  'São Francisco do Sul - DPCAMI',
  'Balneário Barra do Sul - DPMU',
  'Itapoá - DPCO',
  'Garuva - DPCO',
] as const;

export interface DelegadoConvocavel {
  id: string;
  rowIndex?: number; // 1-based in Google Sheets
  nome: string;
  delegacia: string;
}

export interface EscalaDiaConvocacoes {
  apcDia: string[];
  apcNoite: string[];
  dpcDia: string[];
  dpcNoite: string[];
  epcDia: string[];
  epcNoite: string[];
}

export type EscalaMensalMap = Record<string, Partial<EscalaDiaConvocacoes>>;

export interface VacanciasDia {
  apc: number;
  dpc: number;
  epc: number;
  motivosApc: string[];
  motivosDpc: string[];
  motivosEpc: string[];
}

export interface EscalaDiaLinha {
  isoDate: string;
  diaMes: number;
  diaSemanaLabel: string;
  isFimDeSemana: boolean;
  equipePlantao: EquipePlantao;
  afastadosEquipeNoDia: LancamentoAvaliado[];
  vacancias: VacanciasDia;
  convocacoes: EscalaDiaConvocacoes;
}

export interface AfastadoNoMesItem {
  lancamento: LancamentoAvaliado;
  inicioNoMes: string;
  fimNoMes: string;
  diasNoMes: number;
  pertenceEquipePlantao: boolean;
}

export interface ResumoEscalaMensal {
  totalAfastadosMes: number;
  totalTurnosVacancia: number;
  totalTurnosPreenchidos: number;
  totalTurnosPendentes: number;
  diasComFuro: number;
}
