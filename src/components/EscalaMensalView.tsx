import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileDown,
  FileSpreadsheet,
  Plus,
  UploadCloud,
  Users,
} from 'lucide-react';
import type {
  DelegadoConvocavel,
  EquipePlantao,
  EscalaDiaLinha,
  EscalaMensalMap,
  SlotKey,
} from '../types/escala';
import type { ConnectedSheetInfo, LancamentoAvaliado } from '../types/ferias';
import type { EscalaSpreadsheetInfo } from '../services/escalaSheetsService';
import { getEscalaTabTitle } from '../services/delegadosSheetsService';
import {
  formatarDataBR,
  formatarDataCurtaBR,
  formatarLotacao,
  NOMES_MESES_COMPLETOS,
  NOMES_MESES_CURTOS,
} from '../utils/dateUtils';
import { getLeaveVisualStyle } from '../utils/leaveStyles';
import {
  calcularResumoEscalaMensal,
  exportEscalaMensalToCSV,
  exportEscalaMensalToHTML,
  gerarGradeEscalaMensal,
  getVacancyForSlot,
  obterAfastadosDoMes,
  RODAPE_CONVOCACOES_ESCALA,
} from '../utils/escalaMensalUtils';
import { gerarEscalaMensalPDF } from '../utils/escalaPdfExport';
import { EmitirEscalaPdfModal } from './EmitirEscalaPdfModal';
import { SlotAssignModal } from './SlotAssignModal';

interface EscalaMensalViewProps {
  lancamentos: LancamentoAvaliado[];
  ano: number;
  mes: number;
  anosDisponiveis: number[];
  onChangeAno: (ano: number) => void;
  onChangeMes: (mes: number) => void;
  escalaMap: EscalaMensalMap;
  onUpdateSlot: (params: {
    isoDate: string;
    slot: SlotKey;
    values: string[];
    applyToTwin: boolean;
  }) => void;
  delegados: DelegadoConvocavel[];
  connectedDelegadosSheet: ConnectedSheetInfo | null;
  connectedEscalaSheet: EscalaSpreadsheetInfo | null;
  hasGoogleToken: boolean;
  isAutoSavingEscala?: boolean;
  onOpenDelegadosModal: () => void;
  onOpenEscalaSheetsModal: () => void;
  onRequestSaveEscalaToSheet: (params: {
    ano: number;
    mes: number;
    grade: EscalaDiaLinha[];
    totalPreenchidos: number;
  }) => void;
  onReloadAllEscalasFromSheet: () => void;
  isBusySheet: boolean;
  onEditLancamento: (lancamento: LancamentoAvaliado) => void;
  onNotify?: (message: string) => void;
}

const SLOTS_ORDER: { key: SlotKey; headerLabel: string; group: 'APC' | 'DPC' | 'EPC' }[] = [
  { key: 'apcDia', headerLabel: 'APC - dia', group: 'APC' },
  { key: 'apcNoite', headerLabel: 'APC - noite', group: 'APC' },
  { key: 'dpcDia', headerLabel: 'DPC - dia', group: 'DPC' },
  { key: 'dpcNoite', headerLabel: 'DPC - noite', group: 'DPC' },
  { key: 'epcDia', headerLabel: 'EPC - dia', group: 'EPC' },
  { key: 'epcNoite', headerLabel: 'EPC - noite', group: 'EPC' },
];

export const EscalaMensalView: React.FC<EscalaMensalViewProps> = ({
  lancamentos,
  ano,
  mes,
  anosDisponiveis,
  onChangeAno,
  onChangeMes,
  escalaMap,
  onUpdateSlot,
  delegados,
  connectedDelegadosSheet,
  connectedEscalaSheet,
  hasGoogleToken,
  isAutoSavingEscala = false,
  onOpenDelegadosModal,
  onOpenEscalaSheetsModal,
  onRequestSaveEscalaToSheet,
  onReloadAllEscalasFromSheet,
  isBusySheet,
  onEditLancamento,
  onNotify,
}) => {
  const [filtroEquipeEscala, setFiltroEquipeEscala] = useState<EquipePlantao | 'Todas'>('Todas');
  const [apenasComVacancia, setApenasComVacancia] = useState(false);
  const [highlightedOfficerKey, setHighlightedOfficerKey] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{
    row: EscalaDiaLinha;
    slot: SlotKey;
  } | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [coordenadorNome, setCoordenadorNome] = useState<string>(() => {
    try {
      return localStorage.getItem('cpp_joinville_delegado_coordenador') ?? '';
    } catch {
      return '';
    }
  });

  const delegaciaPorNome = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of delegados) {
      map.set(d.nome.trim().toLowerCase(), d.delegacia);
    }
    return map;
  }, [delegados]);

  const afastadosMes = useMemo(
    () => obterAfastadosDoMes(lancamentos, ano, mes),
    [lancamentos, ano, mes]
  );

  const gradeCompleta = useMemo(
    () =>
      gerarGradeEscalaMensal({
        ano,
        mes,
        lancamentos,
        escalaMap,
      }),
    [ano, mes, lancamentos, escalaMap]
  );

  const resumo = useMemo(
    () => calcularResumoEscalaMensal(gradeCompleta, afastadosMes),
    [gradeCompleta, afastadosMes]
  );

  const resumo12Meses = useMemo(() => {
    return Array.from({ length: 12 }, (_, idx) => {
      const m = idx + 1;
      const af = obterAfastadosDoMes(lancamentos, ano, m);
      const gr = gerarGradeEscalaMensal({ ano, mes: m, lancamentos, escalaMap });
      const res = calcularResumoEscalaMensal(gr, af);
      return {
        mes: m,
        afastados: res.totalAfastadosMes,
        pendentes: res.totalTurnosPendentes,
      };
    });
  }, [lancamentos, ano, escalaMap]);

  const gradeVisivel = useMemo(() => {
    return gradeCompleta.filter((row) => {
      if (filtroEquipeEscala !== 'Todas' && row.equipePlantao !== filtroEquipeEscala) {
        return false;
      }
      if (apenasComVacancia) {
        const hasAnyVac =
          row.vacancias.apc > 0 || row.vacancias.dpc > 0 || row.vacancias.epc > 0;
        if (!hasAnyVac) return false;
      }
      return true;
    });
  }, [gradeCompleta, filtroEquipeEscala, apenasComVacancia]);

  const highlightedOfficerItem = useMemo(() => {
    if (!highlightedOfficerKey) return null;
    return (
      afastadosMes.find(
        (a) =>
          `${a.lancamento.id}` === highlightedOfficerKey
      ) ?? null
    );
  }, [afastadosMes, highlightedOfficerKey]);

  const mesNomeCompleto = NOMES_MESES_COMPLETOS[mes - 1];
  const anosUnicos = useMemo(() => {
    const set = new Set<number>([2026, 2027, ano, ...anosDisponiveis]);
    return Array.from(set).sort((a, b) => a - b);
  }, [anosDisponiveis, ano]);

  const canSyncEscalaSheet = hasGoogleToken && Boolean(connectedEscalaSheet);
  const currentTabTitle = getEscalaTabTitle(ano, mes);

  const renderSlotCell = (row: EscalaDiaLinha, slot: SlotKey) => {
    const assigned = row.convocacoes[slot];
    const vac = getVacancyForSlot(row.vacancias, slot);
    const hasVacancy = vac.required > 0;
    const isMissing = assigned.length < vac.required;
    const isDpc = slot === 'dpcDia' || slot === 'dpcNoite';

    const motivoTitle =
      vac.motivos.length > 0
        ? `Vacância: ${vac.motivos.join('; ')}`
        : 'Equipe fixa completa (clique para atribuir manualmente se necessário)';

    const labelTexto =
      assigned.length > 0
        ? assigned.join(' / ')
        : hasVacancy
        ? 'A convocar'
        : 'Sem vacância';

    return (
      <td
        key={slot}
        className={`border-r border-slate-200 last:border-r-0 p-1 align-middle min-w-[112px] ${
          isMissing
            ? 'bg-amber-50/70'
            : row.isFimDeSemana
            ? 'bg-slate-100/70'
            : 'bg-white'
        }`}
      >
        <button
          type="button"
          onClick={() => setEditingCell({ row, slot })}
          title={motivoTitle}
          aria-label={`Dia ${formatarDataBR(row.isoDate)}, Equipe ${row.equipePlantao}, ${
            SLOTS_ORDER.find((s) => s.key === slot)?.headerLabel
          }: ${labelTexto}`}
          className={`w-full min-h-[34px] px-1.5 py-1 rounded text-center transition-colors flex flex-col items-center justify-center leading-tight focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1E3A5F] ${
            isMissing
              ? 'border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950'
              : assigned.length > 0
              ? 'border border-slate-300 bg-white hover:bg-slate-50 text-slate-900'
              : 'border border-transparent hover:border-slate-300 hover:bg-slate-100/80 text-slate-400'
          }`}
        >
          {assigned.length > 0 ? (
            <>
              {assigned.map((val, idx) => {
                const delOrigem = isDpc
                  ? delegaciaPorNome.get(val.trim().toLowerCase())
                  : undefined;
                return (
                  <div key={`${val}-${idx}`} className="w-full truncate">
                    <div className="text-[11px] font-semibold text-slate-900 truncate">
                      {val}
                    </div>
                    {delOrigem && (
                      <div className="text-[10px] text-slate-500 truncate">
                        {delOrigem}
                      </div>
                    )}
                  </div>
                );
              })}
              {isMissing && (
                <span className="text-[10px] font-semibold text-amber-800 mt-0.5">
                  +{vac.required - assigned.length} vaga
                </span>
              )}
            </>
          ) : hasVacancy ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-900">
              <Plus className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span>
                {vac.required > 1 ? `Convocar (${vac.required})` : 'Convocar'}
              </span>
            </span>
          ) : (
            <span className="text-[11px] opacity-0 group-hover/row:opacity-100 transition-opacity">
              +
            </span>
          )}
        </button>
      </td>
    );
  };

  return (
    <div className="space-y-3.5">
      {/* Header & actions */}
      <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h1 className="font-display text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            Escala Mensal de Convocações · {mesNomeCompleto} / {ano}
          </h1>
          <p className="text-xs text-slate-600">
            {connectedEscalaSheet ? (
              <>
                Conectada à 3ª planilha{' '}
                <strong className="font-medium text-slate-900">
                  {connectedEscalaSheet.spreadsheetTitle}
                </strong>{' '}
                ·{' '}
                {isAutoSavingEscala
                  ? 'Salvando vaga automaticamente no Drive...'
                  : 'Salvamento automático ativo ao preencher vagas'}
              </>
            ) : (
              <>
                Rodízio 24x72 (08:00 às 08:00) · Delta sem Delegado fixo · Vacâncias detectadas pelos afastamentos de {mesNomeCompleto}/{ano}
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenEscalaSheetsModal}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
              connectedEscalaSheet
                ? 'text-emerald-900 bg-emerald-50/70 border-emerald-300 hover:bg-emerald-100/70'
                : 'text-[#1E3A5F] bg-white border-slate-300 hover:bg-slate-50'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              {connectedEscalaSheet
                ? `Planilha de Escalas (${connectedEscalaSheet.loadedTabs.length} abas)`
                : 'Planilha de Escalas'}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenDelegadosModal}
            title={
              connectedDelegadosSheet
                ? `Sincronizada com ${connectedDelegadosSheet.spreadsheetTitle}`
                : 'Gerenciar Delegados (Prévia Local)'
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1E3A5F] bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Users className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Delegados ({delegados.length})</span>
            {connectedDelegadosSheet && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-emerald-600"
                aria-label="Planilha de delegados conectada"
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsPdfModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#1E3A5F] rounded-md hover:bg-[#162D4A] transition-colors whitespace-nowrap"
          >
            <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Gerar PDF</span>
          </button>

          <button
            type="button"
            onClick={() => exportEscalaMensalToCSV(ano, mes, gradeCompleta)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Exportar CSV</span>
          </button>

          <button
            type="button"
            onClick={() =>
              exportEscalaMensalToHTML(
                ano,
                mes,
                gradeCompleta,
                afastadosMes,
                delegados,
                coordenadorNome.trim() || undefined
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Imprimir / HTML</span>
          </button>

          {canSyncEscalaSheet && (
            <>
              <button
                type="button"
                onClick={onReloadAllEscalasFromSheet}
                disabled={isBusySheet || isAutoSavingEscala}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-60 transition-colors whitespace-nowrap"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Recarregar Meses</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onRequestSaveEscalaToSheet({
                    ano,
                    mes,
                    grade: gradeCompleta,
                    totalPreenchidos: resumo.totalTurnosPreenchidos,
                  })
                }
                disabled={isBusySheet || isAutoSavingEscala}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-60 transition-colors whitespace-nowrap"
              >
                <UploadCloud className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Salvar Mês no Sheets</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 4-column summary KPIs */}
      <section
        aria-label="Resumo da escala mensal"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-2.5">
          <div className="text-xs text-slate-500">Afastados no Mês</div>
          <div className="mt-0.5 font-mono tabular-nums text-xl font-bold text-slate-900">
            {resumo.totalAfastadosMes}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg px-4 py-2.5">
          <div className="text-xs text-slate-500">Turnos c/ Vacância (12h)</div>
          <div className="mt-0.5 font-mono tabular-nums text-xl font-bold text-slate-900">
            {resumo.totalTurnosVacancia}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg px-4 py-2.5">
          <div className="text-xs text-slate-500">Vacâncias em Aberto</div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span
              className={`font-mono tabular-nums text-xl font-bold ${
                resumo.totalTurnosPendentes > 0
                  ? 'text-amber-700'
                  : 'text-emerald-700'
              }`}
            >
              {resumo.totalTurnosPendentes}
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              ({resumo.totalTurnosPreenchidos}/{resumo.totalTurnosVacancia} preenchidos)
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg px-4 py-2.5">
          <div className="text-xs text-slate-500">Planilha de Escalas (3ª Planilha)</div>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-900 truncate">
              {connectedEscalaSheet
                ? `${connectedEscalaSheet.spreadsheetTitle}`
                : 'Prévia Local (sem nuvem)'}
            </span>
            <button
              type="button"
              onClick={onOpenEscalaSheetsModal}
              className="text-xs font-medium text-[#1E3A5F] hover:underline shrink-0"
            >
              {connectedEscalaSheet ? 'Gerenciar' : 'Vincular'}
            </button>
          </div>
        </div>
      </section>

      {/* Month & Year navigation strip */}
      <div className="bg-white border border-slate-200 rounded-lg p-2.5 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 pr-2 border-r border-slate-200">
          <button
            type="button"
            onClick={() => {
              if (mes === 1) {
                onChangeAno(ano - 1);
                onChangeMes(12);
              } else {
                onChangeMes(mes - 1);
              }
            }}
            aria-label="Mês anterior da escala"
            className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 text-slate-700"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <select
            value={ano}
            onChange={(e) => onChangeAno(Number(e.target.value))}
            aria-label="Ano da escala mensal"
            className="px-2.5 py-1.5 text-xs font-mono font-semibold border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:border-[#1E3A5F]"
          >
            {anosUnicos.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              if (mes === 12) {
                onChangeAno(ano + 1);
                onChangeMes(1);
              } else {
                onChangeMes(mes + 1);
              }
            }}
            aria-label="Próximo mês da escala"
            className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 text-slate-700"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 flex items-center gap-1 overflow-x-auto">
          {NOMES_MESES_CURTOS.map((nome, idx) => {
            const m = idx + 1;
            const active = m === mes;
            const info = resumo12Meses[idx];
            return (
              <button
                key={m}
                type="button"
                onClick={() => onChangeMes(m)}
                className={`flex-1 min-w-[66px] px-2 py-1.5 rounded-md text-xs transition-colors flex flex-col items-center gap-0.5 ${
                  active
                    ? 'bg-[#1E3A5F] text-white font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>{nome}</span>
                <span
                  className={`text-[10px] font-mono tabular-nums ${
                    active
                      ? 'text-slate-200'
                      : info.pendentes > 0
                      ? 'text-amber-700 font-semibold'
                      : 'text-slate-500'
                  }`}
                >
                  {info.afastados > 0
                    ? `${info.afastados} afast.`
                    : `${info.pendentes} vag.`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main 12-column split: Schedule Table (left) + Absent Officers in Reference Month (right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <section
          aria-label="Grade da Escala Mensal"
          className="xl:col-span-9 bg-white border border-slate-200 rounded-lg overflow-hidden"
        >
          {/* Table filter bar */}
          <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
            <div className="font-display text-sm font-bold text-slate-900 tracking-tight">
              CRPP JOINVILLE - ESCALA {mesNomeCompleto.toUpperCase()}/{ano}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={filtroEquipeEscala}
                onChange={(e) =>
                  setFiltroEquipeEscala(e.target.value as EquipePlantao | 'Todas')
                }
                aria-label="Filtrar escala por equipe"
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-800 focus:outline-none focus:border-[#1E3A5F]"
              >
                <option value="Todas">Todas as equipes</option>
                <option value="Alfa">Equipe Alfa</option>
                <option value="Bravo">Equipe Bravo</option>
                <option value="Charlie">Equipe Charlie</option>
                <option value="Delta">Equipe Delta</option>
              </select>

              <label
                htmlFor="chk-apenas-vacancia"
                className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none"
              >
                <input
                  id="chk-apenas-vacancia"
                  type="checkbox"
                  checked={apenasComVacancia}
                  onChange={(e) => setApenasComVacancia(e.target.checked)}
                  className="rounded border-slate-300 text-[#1E3A5F] focus:ring-[#1E3A5F]"
                />
                <span>Apenas dias com vacância</span>
              </label>
            </div>
          </div>

          {/* Schedule table matching official spreadsheet layout */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-300 text-slate-800 font-semibold">
                  <th
                    colSpan={2}
                    className="py-2 px-2 text-center border-r border-slate-300"
                  >
                    Escala 24x72
                  </th>
                  <th className="py-2 px-2 text-center border-r border-slate-300 font-mono tabular-nums whitespace-nowrap">
                    08:00 às 08:00
                  </th>
                  <th colSpan={6} className="py-2 px-2 text-center tracking-wide">
                    CONVOCAÇÕES
                  </th>
                </tr>
                <tr className="border-b border-slate-300 text-[11px] font-bold">
                  <th className="py-2 px-2 text-center bg-slate-100 text-slate-800 border-r border-slate-300 whitespace-nowrap">
                    DIA MÊS
                  </th>
                  <th className="py-2 px-2 text-center bg-slate-100 text-slate-800 border-r border-slate-300 whitespace-nowrap">
                    DIA SEMANA
                  </th>
                  <th className="py-2 px-2 text-center bg-slate-100 text-slate-800 border-r border-slate-300 whitespace-nowrap">
                    EQUIPE
                  </th>
                  <th className="py-2 px-2 text-center bg-[#DBEAFE] text-[#1E3A8A] border-r border-slate-300 whitespace-nowrap">
                    APC - dia
                  </th>
                  <th className="py-2 px-2 text-center bg-[#DBEAFE] text-[#1E3A8A] border-r border-slate-300 whitespace-nowrap">
                    APC - noite
                  </th>
                  <th className="py-2 px-2 text-center bg-[#DCFCE7] text-[#14532D] border-r border-slate-300 whitespace-nowrap">
                    DPC - dia
                  </th>
                  <th className="py-2 px-2 text-center bg-[#DCFCE7] text-[#14532D] border-r border-slate-300 whitespace-nowrap">
                    DPC - noite
                  </th>
                  <th className="py-2 px-2 text-center bg-[#FEF3C7] text-[#78350F] border-r border-slate-300 whitespace-nowrap">
                    EPC - dia
                  </th>
                  <th className="py-2 px-2 text-center bg-[#FEF3C7] text-[#78350F] whitespace-nowrap">
                    EPC - noite
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {gradeVisivel.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-xs text-slate-500">
                      Nenhum dia corresponde aos filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  gradeVisivel.map((row) => {
                    const isOfficerMatch = Boolean(
                      highlightedOfficerItem &&
                        row.afastadosEquipeNoDia.some(
                          (a) => a.id === highlightedOfficerItem.lancamento.id
                        )
                    );

                    return (
                      <tr
                        key={row.isoDate}
                        className={`group/row transition-colors ${
                          isOfficerMatch
                            ? 'bg-sky-50/90 ring-2 ring-inset ring-[#1E3A5F]'
                            : row.isFimDeSemana
                            ? 'bg-slate-50/90 hover:bg-slate-100/70'
                            : 'bg-white hover:bg-slate-50/60'
                        }`}
                      >
                        <td className="py-1.5 px-2 text-center font-mono tabular-nums font-semibold text-slate-800 border-r border-slate-200">
                          {row.diaMes}
                        </td>
                        <td className="py-1.5 px-2 text-center text-slate-700 border-r border-slate-200 whitespace-nowrap">
                          {row.diaSemanaLabel}
                        </td>
                        <td className="py-1.5 px-2 text-center font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                          {row.equipePlantao.toUpperCase()}
                        </td>
                        {SLOTS_ORDER.map((s) => renderSlotCell(row, s.key))}
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-300">
                  <td
                    colSpan={9}
                    className="py-2 px-3 text-[11px] text-slate-700 text-left font-medium"
                  >
                    {RODAPE_CONVOCACOES_ESCALA}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* Right reference panel: Absent officers in the selected month */}
        <aside
          aria-label="Afastamentos no mês de referência"
          className="xl:col-span-3 bg-white border border-slate-200 rounded-lg p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
              <span>Afastados em {mesNomeCompleto}</span>
            </h3>
            <span className="font-mono tabular-nums text-xs text-slate-500">
              {afastadosMes.length} reg.
            </span>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Servidores terceirizados não compõem a escala. Clique em um afastamento de equipe 24x72 para destacar os plantões correspondentes.
          </p>

          {afastadosMes.length === 0 ? (
            <div className="py-6 px-3 text-center border border-dashed border-slate-200 rounded-md space-y-1.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto" />
              <p className="text-xs font-medium text-slate-800">
                Nenhum afastamento registrado em {mesNomeCompleto}/{ano}.
              </p>
              <p className="text-[11px] text-slate-500">
                Apenas a vacância fixa de Delegado da equipe Delta permanece ativa neste mês.
              </p>
            </div>
          ) : (
            <ul className="space-y-2 max-h-[680px] overflow-y-auto pr-0.5">
              {afastadosMes.map((item) => {
                const r = item.lancamento;
                const isConflict = !r.validacao.valido;
                const st = getLeaveVisualStyle(r.tipo);
                const isSelected = highlightedOfficerKey === r.id;

                return (
                  <li
                    key={`${r.id}-${item.inicioNoMes}`}
                    className={`rounded-md border p-2.5 text-xs transition-colors ${
                      isSelected
                        ? 'border-[#1E3A5F] bg-sky-50/70 ring-1 ring-[#1E3A5F]'
                        : isConflict
                        ? 'border-red-200 bg-red-50/60'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setHighlightedOfficerKey(isSelected ? null : r.id)
                        }
                        className="text-left min-w-0 flex-1"
                      >
                        <div className="font-semibold text-slate-900 truncate flex items-center gap-1.5">
                          <span className="truncate">{r.servidor}</span>
                          {isConflict && (
                            <AlertTriangle
                              className="w-3.5 h-3.5 text-red-600 shrink-0"
                              aria-label="Conflito operacional"
                            />
                          )}
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          {formatarLotacao(r.equipe, r.cargo)}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => onEditLancamento(r)}
                        className="text-[11px] font-medium text-[#1E3A5F] hover:underline shrink-0"
                      >
                        Ver
                      </button>
                    </div>

                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-700">
                      <span
                        className={`inline-block w-2.5 h-2.5 rounded-sm border shrink-0 ${st.swatchClass}`}
                      />
                      <span className="truncate font-medium">{r.tipo}</span>
                    </div>

                    <div className="mt-1 flex items-center justify-between gap-2 font-mono tabular-nums text-[11px] text-slate-600">
                      <span>
                        {formatarDataCurtaBR(item.inicioNoMes)}–
                        {formatarDataCurtaBR(item.fimNoMes)} ({item.diasNoMes}d)
                      </span>
                      {!item.pertenceEquipePlantao && (
                        <span className="font-sans text-[10px] text-slate-500">
                          Fora 24x72
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>

      <SlotAssignModal
        isOpen={Boolean(editingCell)}
        row={editingCell?.row ?? null}
        slot={editingCell?.slot ?? null}
        delegados={delegados}
        onClose={() => setEditingCell(null)}
        onSave={(params) => {
          onUpdateSlot(params);
          setEditingCell(null);
        }}
        onOpenDelegadosModal={onOpenDelegadosModal}
        connectedEscalaSheetTitle={connectedEscalaSheet?.spreadsheetTitle ?? null}
        mesTabTitle={currentTabTitle}
      />

      <EmitirEscalaPdfModal
        isOpen={isPdfModalOpen}
        ano={ano}
        mes={mes}
        defaultCoordenadorNome={coordenadorNome}
        onClose={() => setIsPdfModalOpen(false)}
        onEmitPdf={(nome) => {
          try {
            localStorage.setItem('cpp_joinville_delegado_coordenador', nome);
          } catch {
            // ignore storage errors
          }
          setCoordenadorNome(nome);
          const result = gerarEscalaMensalPDF({
            ano,
            mes,
            grade: gradeCompleta,
            delegados,
            delegadoCoordenador: nome,
          });
          setIsPdfModalOpen(false);
          onNotify?.(
            `PDF "${result.filename}" gerado com assinatura de ${result.assinatura.nome}.`
          );
        }}
      />
    </div>
  );
};
