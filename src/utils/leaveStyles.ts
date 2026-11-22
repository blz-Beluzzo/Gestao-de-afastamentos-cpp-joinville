import type { TipoAfastamento } from '../types/ferias';

export interface LeaveVisualStyle {
  label: string;
  shortLabel: string;
  blockClass: string;
  swatchClass: string;
  cardClass: string;
  textMutedClass: string;
  htmlCellClass: string;
  htmlCellCss: string;
}

export const LEAVE_TYPE_STYLES: Record<TipoAfastamento, LeaveVisualStyle> = {
  'Férias': {
    label: 'Férias',
    shortLabel: 'Férias',
    blockClass: 'bg-[#FACC15] hover:bg-[#EAB308] border-[#CA8A04] text-[#422006]',
    swatchClass: 'bg-[#FACC15] border-[#CA8A04]',
    cardClass: 'bg-amber-50/70 border-amber-300/80',
    textMutedClass: 'text-[#854D0E]',
    htmlCellClass: 'cell-ferias',
    htmlCellCss: 'background: #FEF9C3; color: #422006;',
  },
  'Licença-Prêmio': {
    label: 'Licença-Prêmio',
    shortLabel: 'Lic. Prêmio',
    blockClass: 'bg-[#DBEAFE] hover:bg-[#BFDBFE] border-[#2563EB] text-[#1E3A8A]',
    swatchClass: 'bg-[#DBEAFE] border-[#2563EB]',
    cardClass: 'bg-blue-50/70 border-blue-200',
    textMutedClass: 'text-[#1E40AF]',
    htmlCellClass: 'cell-licenca',
    htmlCellCss: 'background: #DBEAFE; color: #1E3A8A;',
  },
  'Curso/Convocação': {
    label: 'Curso/Convocação',
    shortLabel: 'Curso',
    blockClass: 'bg-[#EDE9FE] hover:bg-[#DDD6FE] border-[#7C3AED] text-[#4C1D95]',
    swatchClass: 'bg-[#EDE9FE] border-[#7C3AED]',
    cardClass: 'bg-violet-50/70 border-violet-200',
    textMutedClass: 'text-[#5B21B6]',
    htmlCellClass: 'cell-curso',
    htmlCellCss: 'background: #EDE9FE; color: #4C1D95;',
  },
  'Afastamento Médico (LTS/LTF)': {
    label: 'Afastamento Médico (LTS/LTF)',
    shortLabel: 'LTS/LTF',
    blockClass: 'bg-[#D1FAE5] hover:bg-[#A7F3D0] border-[#059669] text-[#064E3B]',
    swatchClass: 'bg-[#D1FAE5] border-[#059669]',
    cardClass: 'bg-emerald-50/70 border-emerald-200',
    textMutedClass: 'text-[#065F46]',
    htmlCellClass: 'cell-medico',
    htmlCellCss: 'background: #D1FAE5; color: #064E3B;',
  },
};

export const CONFLICT_BLOCK_CLASS =
  'bg-[#FEE2E2] hover:bg-[#FECACA] border-[#DC2626] text-[#991B1B]';

export function getLeaveVisualStyle(tipo: TipoAfastamento): LeaveVisualStyle {
  return LEAVE_TYPE_STYLES[tipo] ?? LEAVE_TYPE_STYLES['Férias'];
}
