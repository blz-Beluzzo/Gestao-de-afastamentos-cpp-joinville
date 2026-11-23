import type {
  AfastadoNoMesItem,
  CargoEscala,
  DelegadoConvocavel,
  EquipePlantao,
  EscalaDiaConvocacoes,
  EscalaDiaLinha,
  EscalaMensalMap,
  ResumoEscalaMensal,
  SlotKey,
  TurnoEscala,
  VacanciasDia,
} from '../types/escala';
import type { LancamentoAvaliado } from '../types/ferias';
import {
  calcularDiasInclusivos,
  ehTerceirizado,
  formatarDataBR,
  formatarDataCurtaBR,
  isoParaUTCMillis,
  NOMES_MESES_COMPLETOS,
  obterDiasDoMes,
} from './dateUtils';

/**
 * 24x72 uninterrupted rotation anchored on 01/12/2026 = Charlie.
 * Sequence: Charlie (01/12) -> Delta (02/12) -> Alfa (03/12) -> Bravo (04/12).
 * Each shift starts at 08:00 on the given date and finishes at 08:00 the next day.
 */
export const CICLO_PLANTAO_24X72: readonly EquipePlantao[] = [
  'Charlie',
  'Delta',
  'Alfa',
  'Bravo',
];

const ANCHOR_2026_12_01_UTC = Date.UTC(2026, 11, 1);

const DIAS_SEMANA_ESCALA = [
  'domingo',
  '2ª',
  '3ª',
  '4ª',
  '5ª',
  '6ª',
  'sábado',
] as const;

export const EQUIPES_SEM_DELEGADO_FIXO_PADRAO: readonly EquipePlantao[] = ['Delta'];

export const SLOT_META: Record<
  SlotKey,
  {
    key: SlotKey;
    label: string;
    cargo: CargoEscala;
    turno: TurnoEscala;
    twinKey: SlotKey;
  }
> = {
  apcDia: {
    key: 'apcDia',
    label: 'APC - dia',
    cargo: 'APC',
    turno: 'Dia',
    twinKey: 'apcNoite',
  },
  apcNoite: {
    key: 'apcNoite',
    label: 'APC - noite',
    cargo: 'APC',
    turno: 'Noite',
    twinKey: 'apcDia',
  },
  dpcDia: {
    key: 'dpcDia',
    label: 'DPC - dia',
    cargo: 'DPC',
    turno: 'Dia',
    twinKey: 'dpcNoite',
  },
  dpcNoite: {
    key: 'dpcNoite',
    label: 'DPC - noite',
    cargo: 'DPC',
    turno: 'Noite',
    twinKey: 'dpcDia',
  },
  epcDia: {
    key: 'epcDia',
    label: 'EPC - dia',
    cargo: 'EPC',
    turno: 'Dia',
    twinKey: 'epcNoite',
  },
  epcNoite: {
    key: 'epcNoite',
    label: 'EPC - noite',
    cargo: 'EPC',
    turno: 'Noite',
    twinKey: 'epcDia',
  },
};

export function emptyConvocacoesDia(): EscalaDiaConvocacoes {
  return {
    apcDia: [],
    apcNoite: [],
    dpcDia: [],
    dpcNoite: [],
    epcDia: [],
    epcNoite: [],
  };
}

export function obterEquipePlantao(isoDate: string): EquipePlantao {
  const ms = isoParaUTCMillis(isoDate);
  if (ms === null) return 'Charlie';
  const diffDays = Math.round((ms - ANCHOR_2026_12_01_UTC) / 86400000);
  const idx = ((diffDays % 4) + 4) % 4;
  return CICLO_PLANTAO_24X72[idx];
}

export function obterDiaSemanaEscala(isoDate: string): {
  label: string;
  isWeekend: boolean;
} {
  const ms = isoParaUTCMillis(isoDate);
  if (ms === null) return { label: '', isWeekend: false };
  const day = new Date(ms).getUTCDay();
  return {
    label: DIAS_SEMANA_ESCALA[day],
    isWeekend: day === 0 || day === 6,
  };
}

export function isEquipePlantao(equipe: string): equipe is EquipePlantao {
  return (
    equipe === 'Alfa' ||
    equipe === 'Bravo' ||
    equipe === 'Charlie' ||
    equipe === 'Delta'
  );
}

/**
 * Returns all police/administrative leave records touching the specified reference month (1..12).
 * Terceirizados are excluded because they do not compose the 24x72 schedule or require convocation.
 */
export function obterAfastadosDoMes(
  lancamentos: LancamentoAvaliado[],
  ano: number,
  mes: number
): AfastadoNoMesItem[] {
  const diasNoMes = obterDiasDoMes(ano, mes);
  const mesInicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const mesFim = `${ano}-${String(mes).padStart(2, '0')}-${String(diasNoMes).padStart(
    2,
    '0'
  )}`;

  const items: AfastadoNoMesItem[] = [];
  for (const item of lancamentos) {
    if (!item.inicio || !item.fim) continue;
    if (ehTerceirizado(item.equipe, item.cargo)) continue;
    if (item.inicio <= mesFim && item.fim >= mesInicio) {
      const inicioNoMes = item.inicio > mesInicio ? item.inicio : mesInicio;
      const fimNoMes = item.fim < mesFim ? item.fim : mesFim;
      items.push({
        lancamento: item,
        inicioNoMes,
        fimNoMes,
        diasNoMes: calcularDiasInclusivos(inicioNoMes, fimNoMes),
        pertenceEquipePlantao: isEquipePlantao(item.equipe),
      });
    }
  }

  return items.sort((a, b) => {
    if (a.inicioNoMes !== b.inicioNoMes) {
      return a.inicioNoMes.localeCompare(b.inicioNoMes);
    }
    return a.lancamento.servidor.localeCompare(b.lancamento.servidor, 'pt-BR');
  });
}

export function calcularVacanciasDoDia(
  equipePlantao: EquipePlantao,
  afastadosEquipeNoDia: LancamentoAvaliado[],
  equipesSemDelegadoFixo: ReadonlySet<EquipePlantao> = new Set(
    EQUIPES_SEM_DELEGADO_FIXO_PADRAO
  )
): VacanciasDia {
  const motivosApc: string[] = [];
  const motivosDpc: string[] = [];
  const motivosEpc: string[] = [];

  const servidoresVistosApc = new Set<string>();
  const servidoresVistosDpc = new Set<string>();
  const servidoresVistosEpc = new Set<string>();

  for (const af of afastadosEquipeNoDia) {
    if (ehTerceirizado(af.equipe, af.cargo)) continue;
    const key = af.servidor.trim().toLowerCase();
    if (af.cargo === 'Agente' && !servidoresVistosApc.has(key)) {
      servidoresVistosApc.add(key);
      motivosApc.push(`${af.servidor} (${af.tipo})`);
    } else if (af.cargo === 'Delegado' && !servidoresVistosDpc.has(key)) {
      servidoresVistosDpc.add(key);
      motivosDpc.push(`${af.servidor} (${af.tipo})`);
    } else if (af.cargo === 'Escrivão' && !servidoresVistosEpc.has(key)) {
      servidoresVistosEpc.add(key);
      motivosEpc.push(`${af.servidor} (${af.tipo})`);
    }
  }

  let dpcCount = Math.min(1, motivosDpc.length);
  if (equipesSemDelegadoFixo.has(equipePlantao)) {
    dpcCount = 1;
    if (motivosDpc.length === 0) {
      motivosDpc.push(`Equipe ${equipePlantao} sem Delegado fixo`);
    } else {
      motivosDpc.unshift(`Equipe ${equipePlantao} sem Delegado fixo`);
    }
  }

  return {
    apc: Math.min(2, motivosApc.length),
    dpc: dpcCount,
    epc: Math.min(1, motivosEpc.length),
    motivosApc,
    motivosDpc,
    motivosEpc,
  };
}

export function gerarGradeEscalaMensal(params: {
  ano: number;
  mes: number;
  lancamentos: LancamentoAvaliado[];
  escalaMap: EscalaMensalMap;
  equipesSemDelegadoFixo?: ReadonlySet<EquipePlantao>;
}): EscalaDiaLinha[] {
  const {
    ano,
    mes,
    lancamentos,
    escalaMap,
    equipesSemDelegadoFixo = new Set(EQUIPES_SEM_DELEGADO_FIXO_PADRAO),
  } = params;

  const diasNoMes = obterDiasDoMes(ano, mes);
  const linhas: EscalaDiaLinha[] = [];

  for (let dia = 1; dia <= diasNoMes; dia++) {
    const isoDate = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(
      2,
      '0'
    )}`;
    const equipePlantao = obterEquipePlantao(isoDate);
    const { label: diaSemanaLabel, isWeekend } = obterDiaSemanaEscala(isoDate);

    const afastadosEquipeNoDia = lancamentos.filter(
      (item) =>
        !ehTerceirizado(item.equipe, item.cargo) &&
        item.equipe === equipePlantao &&
        item.inicio &&
        item.fim &&
        item.inicio <= isoDate &&
        item.fim >= isoDate
    );

    const vacancias = calcularVacanciasDoDia(
      equipePlantao,
      afastadosEquipeNoDia,
      equipesSemDelegadoFixo
    );

    const saved = escalaMap[isoDate];
    const convocacoes: EscalaDiaConvocacoes = {
      apcDia: [...(saved?.apcDia ?? [])],
      apcNoite: [...(saved?.apcNoite ?? [])],
      dpcDia: [...(saved?.dpcDia ?? [])],
      dpcNoite: [...(saved?.dpcNoite ?? [])],
      epcDia: [...(saved?.epcDia ?? [])],
      epcNoite: [...(saved?.epcNoite ?? [])],
    };

    linhas.push({
      isoDate,
      diaMes: dia,
      diaSemanaLabel,
      isFimDeSemana: isWeekend,
      equipePlantao,
      afastadosEquipeNoDia,
      vacancias,
      convocacoes,
    });
  }

  return linhas;
}

export function getVacancyForSlot(vacancias: VacanciasDia, slot: SlotKey): {
  required: number;
  motivos: string[];
} {
  if (slot === 'apcDia' || slot === 'apcNoite') {
    return { required: vacancias.apc, motivos: vacancias.motivosApc };
  }
  if (slot === 'dpcDia' || slot === 'dpcNoite') {
    return { required: vacancias.dpc, motivos: vacancias.motivosDpc };
  }
  return { required: vacancias.epc, motivos: vacancias.motivosEpc };
}

export function calcularResumoEscalaMensal(
  grade: EscalaDiaLinha[],
  afastadosMes: AfastadoNoMesItem[]
): ResumoEscalaMensal {
  const servidoresUnicos = new Set<string>();
  for (const item of afastadosMes) {
    servidoresUnicos.add(
      `${item.lancamento.equipe}|${item.lancamento.servidor.trim().toLowerCase()}`
    );
  }

  let totalTurnosVacancia = 0;
  let totalTurnosPreenchidos = 0;
  let diasComFuro = 0;

  const slotKeys: SlotKey[] = [
    'apcDia',
    'apcNoite',
    'dpcDia',
    'dpcNoite',
    'epcDia',
    'epcNoite',
  ];

  for (const row of grade) {
    let diaTemFuro = false;
    for (const key of slotKeys) {
      const { required } = getVacancyForSlot(row.vacancias, key);
      if (required > 0) {
        totalTurnosVacancia += required;
        const filled = Math.min(required, row.convocacoes[key].length);
        totalTurnosPreenchidos += filled;
        if (filled < required) {
          diaTemFuro = true;
        }
      }
    }
    if (diaTemFuro) {
      diasComFuro += 1;
    }
  }

  return {
    totalAfastadosMes: servidoresUnicos.size,
    totalTurnosVacancia,
    totalTurnosPreenchidos,
    totalTurnosPendentes: Math.max(0, totalTurnosVacancia - totalTurnosPreenchidos),
    diasComFuro,
  };
}

function escapeCsvCell(val: string | number): string {
  const str = String(val ?? '');
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportEscalaMensalToCSV(
  ano: number,
  mes: number,
  grade: EscalaDiaLinha[]
) {
  const mesNome = NOMES_MESES_COMPLETOS[mes - 1];
  const headers = [
    'DIA MÊS',
    'DIA SEMANA',
    'EQUIPE',
    'APC - dia',
    'APC - noite',
    'DPC - dia',
    'DPC - noite',
    'EPC - dia',
    'EPC - noite',
    'Vacâncias Detectadas',
  ];

  const rows = grade.map((r) => {
    const vacText = [
      ...r.vacancias.motivosApc.map((m) => `APC: ${m}`),
      ...r.vacancias.motivosDpc.map((m) => `DPC: ${m}`),
      ...r.vacancias.motivosEpc.map((m) => `EPC: ${m}`),
    ].join(' | ');

    return [
      r.diaMes,
      r.diaSemanaLabel,
      r.equipePlantao.toUpperCase(),
      r.convocacoes.apcDia.join(' / '),
      r.convocacoes.apcNoite.join(' / '),
      r.convocacoes.dpcDia.join(' / '),
      r.convocacoes.dpcNoite.join(' / '),
      r.convocacoes.epcDia.join(' / '),
      r.convocacoes.epcNoite.join(' / '),
      vacText,
    ]
      .map(escapeCsvCell)
      .join(';');
  });

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Escala_${mesNome}_${ano}_CPP_Joinville.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const COORDENADOR_TITULO_INSTITUCIONAL = 'Delegado de Polícia Civil';
export const ASSINATURA_DIGITAL_SELO = '(assinado digitalmente)';
export const RODAPE_CONVOCACOES_ESCALA =
  'Convocações: Plantão diurno 12h: 08h00 às 20h00 / Noturno 12h: 20h00 às 08h00 - Ambos a serem cumpridos nesta CRPP sob o regime presencial.';

export function formatarDataAssinaturaJoinville(date: Date = new Date()): string {
  const dia = String(date.getDate()).padStart(2, '0');
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const ano = date.getFullYear();
  return `Joinville, ${dia}/${mes}/${ano}`;
}

export interface AssinaturaCoordenadorInfo {
  localData: string;
  nome: string;
  cargo: string;
  seloDigital: string;
}

export function montarAssinaturaCoordenador(
  nomeDelegado: string,
  date: Date = new Date()
): AssinaturaCoordenadorInfo {
  const nomeLimpo = nomeDelegado.trim();
  if (!nomeLimpo) {
    throw new Error('Informe o nome do Delegado Coordenador para assinar a escala.');
  }
  return {
    localData: formatarDataAssinaturaJoinville(date),
    nome: nomeLimpo,
    cargo: COORDENADOR_TITULO_INSTITUCIONAL,
    seloDigital: ASSINATURA_DIGITAL_SELO,
  };
}

export function exportEscalaMensalToHTML(
  ano: number,
  mes: number,
  grade: EscalaDiaLinha[],
  afastadosMes: AfastadoNoMesItem[],
  delegados: DelegadoConvocavel[],
  delegadoCoordenador?: string
) {
  const mesNome = NOMES_MESES_COMPLETOS[mes - 1];
  const delegaciaPorNome = new Map<string, string>();
  for (const d of delegados) {
    delegaciaPorNome.set(d.nome.trim().toLowerCase(), d.delegacia);
  }

  const formatCell = (items: string[], required: number, isDpc = false) => {
    if (items.length > 0) {
      return items
        .map((val) => {
          const del = isDpc ? delegaciaPorNome.get(val.trim().toLowerCase()) : undefined;
          return del
            ? `<strong>${escapeHtml(val)}</strong><div class="sub">${escapeHtml(del)}</div>`
            : `<strong>${escapeHtml(val)}</strong>`;
        })
        .join('<br/>');
    }
    if (required > 0) {
      return `<span class="vac">A convocar (${required})</span>`;
    }
    return '';
  };

  const rowsHtml = grade
    .map((r) => {
      return `<tr class="${r.isFimDeSemana ? 'weekend' : ''}">
        <td class="num">${r.diaMes}</td>
        <td class="ctr">${escapeHtml(r.diaSemanaLabel)}</td>
        <td class="ctr eq">${escapeHtml(r.equipePlantao.toUpperCase())}</td>
        <td class="ctr ${r.vacancias.apc > 0 && r.convocacoes.apcDia.length < r.vacancias.apc ? 'vac-cell' : ''}">${formatCell(r.convocacoes.apcDia, r.vacancias.apc)}</td>
        <td class="ctr ${r.vacancias.apc > 0 && r.convocacoes.apcNoite.length < r.vacancias.apc ? 'vac-cell' : ''}">${formatCell(r.convocacoes.apcNoite, r.vacancias.apc)}</td>
        <td class="ctr ${r.vacancias.dpc > 0 && r.convocacoes.dpcDia.length < r.vacancias.dpc ? 'vac-cell' : ''}">${formatCell(r.convocacoes.dpcDia, r.vacancias.dpc, true)}</td>
        <td class="ctr ${r.vacancias.dpc > 0 && r.convocacoes.dpcNoite.length < r.vacancias.dpc ? 'vac-cell' : ''}">${formatCell(r.convocacoes.dpcNoite, r.vacancias.dpc, true)}</td>
        <td class="ctr ${r.vacancias.epc > 0 && r.convocacoes.epcDia.length < r.vacancias.epc ? 'vac-cell' : ''}">${formatCell(r.convocacoes.epcDia, r.vacancias.epc)}</td>
        <td class="ctr ${r.vacancias.epc > 0 && r.convocacoes.epcNoite.length < r.vacancias.epc ? 'vac-cell' : ''}">${formatCell(r.convocacoes.epcNoite, r.vacancias.epc)}</td>
      </tr>`;
    })
    .join('');

  const assinatura =
    delegadoCoordenador && delegadoCoordenador.trim()
      ? montarAssinaturaCoordenador(delegadoCoordenador)
      : null;

  const assinaturaHtml = assinatura
    ? `<div class="sig-wrap">
        <div class="sig-date">${escapeHtml(assinatura.localData)}</div>
        <div class="sig-center">
          <div class="sig-name">${escapeHtml(assinatura.nome)}</div>
          <div class="sig-role">${escapeHtml(assinatura.cargo)}</div>
          <div class="sig-digital">${escapeHtml(assinatura.seloDigital)}</div>
        </div>
      </div>`
    : '';

  const afastadosHtml =
    afastadosMes.length === 0
      ? '<p class="meta">Nenhum afastamento registrado para este mês.</p>'
      : `<table class="af-table">
          <thead>
            <tr>
              <th>Servidor</th>
              <th>Equipe / Cargo</th>
              <th>Tipo</th>
              <th>Período Total</th>
              <th>No Mês</th>
            </tr>
          </thead>
          <tbody>
            ${afastadosMes
              .map(
                (a) => `<tr>
                <td><strong>${escapeHtml(a.lancamento.servidor)}</strong></td>
                <td>${escapeHtml(a.lancamento.equipe)} · ${escapeHtml(a.lancamento.cargo)}</td>
                <td>${escapeHtml(a.lancamento.tipo)}</td>
                <td class="num">${escapeHtml(formatarDataBR(a.lancamento.inicio))} a ${escapeHtml(formatarDataBR(a.lancamento.fim))}</td>
                <td class="num">${escapeHtml(formatarDataCurtaBR(a.inicioNoMes))}–${escapeHtml(formatarDataCurtaBR(a.fimNoMes))} (${a.diasNoMes}d)</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>`;

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>CRPP JOINVILLE - ESCALA ${escapeHtml(mesNome.toUpperCase())}/${ano}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0F172A; background: #FFF; margin: 24px; }
  h1 { text-align: center; font-size: 16px; margin: 0 0 12px; letter-spacing: 0.02em; }
  h2 { font-size: 14px; margin: 24px 0 8px; color: #1E3A5F; }
  .meta { font-size: 12px; color: #475569; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #334155; padding: 4px 6px; }
  .ctr { text-align: center; }
  .num { text-align: center; font-variant-numeric: tabular-nums; font-weight: 600; }
  .eq { font-weight: 600; }
  .top-group { background: #F8FAFC; font-weight: 700; }
  .hdr-base { background: #F1F5F9; font-weight: 700; }
  .hdr-apc { background: #93C5FD; color: #0F172A; font-weight: 700; }
  .hdr-dpc { background: #86EFAC; color: #0F172A; font-weight: 700; }
  .hdr-epc { background: #FDE047; color: #0F172A; font-weight: 700; }
  .weekend { background: #F1F5F9; }
  .vac-cell { background: #FEF3C7; }
  .vac { color: #92400E; font-size: 11px; font-weight: 600; }
  .sub { font-size: 10px; color: #475569; font-weight: 400; }
  .foot-note { text-align: left; font-size: 11px; padding: 6px 8px; background: #FFFFFF; }
  .sig-wrap { display: flex; align-items: flex-start; margin-top: 18px; gap: 24px; }
  .sig-date { font-size: 12px; font-weight: 700; white-space: nowrap; }
  .sig-center { flex: 1; text-align: center; font-size: 12px; line-height: 1.45; }
  .sig-name { font-weight: 700; }
  .sig-role { font-weight: 700; }
  .sig-digital { font-size: 11px; color: #334155; }
  .af-table th { background: #1E3A5F; color: #FFF; text-align: left; border-color: #CBD5E1; padding: 6px 8px; }
  .af-table td { border-color: #CBD5E1; padding: 5px 8px; }
  @media print { body { margin: 10px; } }
</style>
</head>
<body>
  <h1>CRPP JOINVILLE - ESCALA ${escapeHtml(mesNome.toUpperCase())}/${ano}</h1>
  <table>
    <thead>
      <tr class="top-group">
        <th colspan="2">Escala 24x72</th>
        <th>08:00 às 08:00</th>
        <th colspan="6">CONVOCAÇÕES</th>
      </tr>
      <tr>
        <th class="hdr-base">DIA MÊS</th>
        <th class="hdr-base">DIA SEMANA</th>
        <th class="hdr-base">EQUIPE</th>
        <th class="hdr-apc">APC - dia</th>
        <th class="hdr-apc">APC - noite</th>
        <th class="hdr-dpc">DPC - dia</th>
        <th class="hdr-dpc">DPC - noite</th>
        <th class="hdr-epc">EPC - dia</th>
        <th class="hdr-epc">EPC - noite</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      <tr>
        <td colspan="9" class="foot-note">${escapeHtml(RODAPE_CONVOCACOES_ESCALA)}</td>
      </tr>
    </tbody>
  </table>
  ${assinaturaHtml}
  <h2>Afastamentos no Mês de Referência</h2>
  ${afastadosHtml}
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Escala_${mesNome}_${ano}_CPP_Joinville.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
