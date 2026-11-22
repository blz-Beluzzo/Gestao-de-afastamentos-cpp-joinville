import type { Cargo, Equipe, TipoAfastamento } from '../types/ferias';

export const ANO_EXERCICIO = 2027;
export const MESES_VEDADOS = [1, 2, 12] as const; // Janeiro, Fevereiro, Dezembro

export const NOMES_MESES_CURTOS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const;

export const NOMES_MESES_COMPLETOS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

export function normalizarEquipe(valor: string): Equipe {
  const limpo = valor
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (limpo === 'alpha' || limpo === 'alfa') return 'Alfa';
  if (limpo === 'bravo') return 'Bravo';
  if (limpo === 'charlie') return 'Charlie';
  if (limpo === 'delta') return 'Delta';
  if (limpo === 'volante') return 'Volante';
  if (limpo === 'coordenacao' || limpo === 'coord') return 'Coordenação';
  if (limpo.includes('terceiriz')) return 'Terceirizado';
  return 'Alfa';
}

export function normalizarCargo(valor: string): Cargo {
  const limpo = valor
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (limpo.includes('delegad')) return 'Delegado';
  if (limpo.includes('escriv')) return 'Escrivão';
  if (limpo.includes('terceiriz')) return 'Terceirizado';
  return 'Agente';
}

export function ehTerceirizado(equipe: Equipe, cargo?: Cargo): boolean {
  return equipe === 'Terceirizado' || cargo === 'Terceirizado';
}

export function formatarLotacao(equipe: Equipe, cargo: Cargo): string {
  if (equipe === 'Terceirizado' && cargo === 'Terceirizado') {
    return 'Terceirizado';
  }
  return `${equipe} · ${cargo}`;
}

export function normalizarTipoAfastamento(valor: string | undefined | null): TipoAfastamento {
  const limpo = String(valor ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (!limpo || limpo.includes('feria')) return 'Férias';
  if (
    limpo.includes('premio') ||
    limpo.includes('licenca premio') ||
    limpo.includes('licenca-premio') ||
    /\blp\b/.test(limpo)
  ) {
    return 'Licença-Prêmio';
  }
  if (
    limpo.includes('curso') ||
    limpo.includes('convoc') ||
    limpo.includes('capacit') ||
    limpo.includes('trein') ||
    limpo.includes('seminario') ||
    limpo.includes('instrucao')
  ) {
    return 'Curso/Convocação';
  }
  if (
    limpo.includes('medic') ||
    limpo.includes('lts') ||
    limpo.includes('ltf') ||
    limpo.includes('saude') ||
    limpo.includes('atestado') ||
    limpo.includes('doenca') ||
    limpo.includes('tratamento')
  ) {
    return 'Afastamento Médico (LTS/LTF)';
  }
  return 'Férias';
}

export function addDaysToISODate(isoDate: string, deltaDays: number): string {
  const ms = isoParaUTCMillis(isoDate);
  if (ms === null) return '';
  const d = new Date(ms + deltaDays * 86400000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Converts DD/MM/YYYY, YYYY-MM-DD, or Google Sheets serial date number to YYYY-MM-DD.
 * Returns '' if empty or invalid.
 */
export function parseParaISODate(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number' && !Number.isNaN(valor)) {
    // Google Sheets / Excel serial date (epoch 1899-12-30)
    const utcMillis = Math.round((valor - 25569) * 86400 * 1000);
    const d = new Date(utcMillis);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const str = String(valor).trim();
  if (!str) return '';

  // Already YYYY-MM-DD
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(str);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    if (dataEhValida(y, m, d)) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return '';
  }

  // DD/MM/YYYY or DD/MM/YY
  const brMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(str);
  if (brMatch) {
    const d = Number(brMatch[1]);
    const m = Number(brMatch[2]);
    let y = Number(brMatch[3]);
    if (y < 100) y += 2000;
    if (dataEhValida(y, m, d)) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return '';
  }

  return '';
}

export function dataEhValida(ano: number, mes: number, dia: number): boolean {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || ano < 2000 || ano > 2100) {
    return false;
  }
  const dt = new Date(Date.UTC(ano, mes - 1, dia));
  return (
    dt.getUTCFullYear() === ano &&
    dt.getUTCMonth() === mes - 1 &&
    dt.getUTCDate() === dia
  );
}

export function isoParaUTCMillis(isoDate: string): number | null {
  const iso = parseParaISODate(isoDate);
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function formatarDataBR(isoDate: string): string {
  const iso = parseParaISODate(isoDate);
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function formatarDataCurtaBR(isoDate: string): string {
  const iso = parseParaISODate(isoDate);
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export function calcularDiasInclusivos(inicio: string, fim: string): number {
  const startMs = isoParaUTCMillis(inicio);
  const endMs = isoParaUTCMillis(fim);
  if (startMs === null || endMs === null || endMs < startMs) return 0;
  return Math.round((endMs - startMs) / 86400000) + 1;
}

export function periodosSeSobrepoem(
  inicioA: string,
  fimA: string,
  inicioB: string,
  fimB: string
): boolean {
  const a1 = isoParaUTCMillis(inicioA);
  const a2 = isoParaUTCMillis(fimA);
  const b1 = isoParaUTCMillis(inicioB);
  const b2 = isoParaUTCMillis(fimB);
  if (a1 === null || a2 === null || b1 === null || b2 === null) return false;
  if (a2 < a1 || b2 < b1) return false;
  return a1 <= b2 && b1 <= a2;
}

/**
 * Returns all calendar months (1..12) touched by [inicio, fim].
 */
export function obterMesesDoPeriodo(inicio: string, fim: string): number[] {
  const isoIni = parseParaISODate(inicio);
  const isoFim = parseParaISODate(fim);
  if (!isoIni || !isoFim) return [];

  const [y1, m1] = isoIni.split('-').map(Number);
  const [y2, m2] = isoFim.split('-').map(Number);
  if (y2 < y1 || (y2 === y1 && m2 < m1)) return [];

  const meses = new Set<number>();
  let curY = y1;
  let curM = m1;
  let guard = 0;

  while ((curY < y2 || (curY === y2 && curM <= m2)) && guard < 36) {
    meses.add(curM);
    curM += 1;
    if (curM > 12) {
      curM = 1;
      curY += 1;
    }
    guard += 1;
  }

  return Array.from(meses);
}

export function ehAnoBissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

export function obterDiasNoAno(ano: number): number {
  return ehAnoBissexto(ano) ? 366 : 365;
}

/**
 * Computes left% and width% within the given calendar year (clamped to Jan 1..Dec 31 of that year).
 */
export function calcularPosicaoNoAno(
  inicio: string,
  fim: string,
  ano: number
): { leftPct: number; widthPct: number; visivel: boolean } {
  const startMs = isoParaUTCMillis(inicio);
  const endMs = isoParaUTCMillis(fim);
  if (startMs === null || endMs === null || endMs < startMs) {
    return { leftPct: 0, widthPct: 0, visivel: false };
  }

  const anoInicioMs = Date.UTC(ano, 0, 1);
  const anoFimMs = Date.UTC(ano, 11, 31);
  const totalDiasAno = obterDiasNoAno(ano);

  if (endMs < anoInicioMs || startMs > anoFimMs) {
    return { leftPct: 0, widthPct: 0, visivel: false };
  }

  const clampedStart = Math.max(startMs, anoInicioMs);
  const clampedEnd = Math.min(endMs, anoFimMs);

  const offsetDays = Math.round((clampedStart - anoInicioMs) / 86400000);
  const spanDays = Math.round((clampedEnd - clampedStart) / 86400000) + 1;

  const leftPct = (offsetDays / totalDiasAno) * 100;
  const widthPct = Math.max((spanDays / totalDiasAno) * 100, 0.9); // minimum clickable/visible sliver

  return { leftPct, widthPct, visivel: true };
}

/**
 * Computes left% and width% within the 2027 calendar year (clamped to 2027-01-01..2027-12-31).
 */
export function calcularPosicaoNoAno2027(
  inicio: string,
  fim: string
): { leftPct: number; widthPct: number; visivel: boolean } {
  return calcularPosicaoNoAno(inicio, fim, ANO_EXERCICIO);
}

/**
 * Extracts all distinct calendar years touched by leave periods across records.
 */
export function extrairAnosDosRegistros(
  registros: {
    inicio?: string;
    fim?: string;
    inicio1?: string;
    fim1?: string;
    inicio2?: string;
    fim2?: string;
  }[]
): number[] {
  const anos = new Set<number>();
  const addSpan = (ini?: string, fim?: string) => {
    const isoIni = parseParaISODate(ini);
    const isoFim = parseParaISODate(fim);
    if (!isoIni || !isoFim) return;
    const y1 = Number(isoIni.slice(0, 4));
    const y2 = Number(isoFim.slice(0, 4));
    if (y1 >= 2000 && y2 <= 2100 && y2 >= y1) {
      for (let y = y1; y <= y2 && y - y1 <= 5; y++) {
        anos.add(y);
      }
    }
  };
  for (const r of registros) {
    addSpan(r.inicio, r.fim);
    addSpan(r.inicio1, r.fim1);
    addSpan(r.inicio2, r.fim2);
  }
  return Array.from(anos).sort((a, b) => a - b);
}

export function obterDiasDoMes(ano: number, mes1a12: number): number {
  return new Date(Date.UTC(ano, mes1a12, 0)).getUTCDate();
}

export function obterDiaSemanaInicioMes(ano: number, mes1a12: number): number {
  // 0 = Sunday .. 6 = Saturday
  return new Date(Date.UTC(ano, mes1a12 - 1, 1)).getUTCDay();
}

