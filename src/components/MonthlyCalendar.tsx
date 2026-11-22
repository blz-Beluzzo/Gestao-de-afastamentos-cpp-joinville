import React, { useMemo, useState } from 'react';
import { AlertTriangle, Calendar, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import type { LancamentoAvaliado } from '../types/ferias';
import {
  ANO_EXERCICIO,
  formatarDataBR,
  formatarLotacao,
  MESES_VEDADOS,
  NOMES_MESES_COMPLETOS,
  NOMES_MESES_CURTOS,
  obterDiaSemanaInicioMes,
  obterDiasDoMes,
} from '../utils/dateUtils';
import { CONFLICT_BLOCK_CLASS, getLeaveVisualStyle } from '../utils/leaveStyles';

interface MonthlyCalendarProps {
  lancamentos: LancamentoAvaliado[];
  ano?: number;
  onSelectAno?: (ano: number) => void;
  onEditLancamento: (lancamento: LancamentoAvaliado) => void;
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const MonthlyCalendar: React.FC<MonthlyCalendarProps> = ({
  lancamentos,
  ano = ANO_EXERCICIO,
  onSelectAno,
  onEditLancamento,
}) => {
  const [mesSelecionado, setMesSelecionado] = useState<number>(10);
  const [diaSelecionado, setDiaSelecionado] = useState<string>(`${ano}-10-13`);
  const [hoveredTip, setHoveredTip] = useState<string | null>(null);

  const ehMesVedado = (MESES_VEDADOS as readonly number[]).includes(mesSelecionado);
  const diasNoMes = obterDiasDoMes(ano, mesSelecionado);
  const offsetInicio = obterDiaSemanaInicioMes(ano, mesSelecionado);

  const afastamentosPorDia = useMemo(() => {
    const mapa = new Map<string, LancamentoAvaliado[]>();

    for (let d = 1; d <= diasNoMes; d++) {
      const isoDia = `${ano}-${String(mesSelecionado).padStart(
        2,
        '0'
      )}-${String(d).padStart(2, '0')}`;
      const lista = lancamentos.filter(
        (item) => item.inicio && item.fim && item.inicio <= isoDia && item.fim >= isoDia
      );
      mapa.set(isoDia, lista);
    }

    return mapa;
  }, [lancamentos, ano, mesSelecionado, diasNoMes]);

  const afastadosPorMesResumo = useMemo(() => {
    return Array.from({ length: 12 }, (_, idx) => {
      const mes = idx + 1;
      const prefixoIni = `${ano}-${String(mes).padStart(2, '0')}-01`;
      const ultimoDia = obterDiasDoMes(ano, mes);
      const prefixoFim = `${ano}-${String(mes).padStart(2, '0')}-${String(
        ultimoDia
      ).padStart(2, '0')}`;

      const servidoresSet = new Set<string>();
      let conflitos = 0;
      for (const item of lancamentos) {
        if (item.inicio && item.fim && item.inicio <= prefixoFim && item.fim >= prefixoIni) {
          servidoresSet.add(`${item.equipe}|${item.servidor.toLowerCase()}`);
          if (!item.validacao.valido) {
            conflitos += 1;
          }
        }
      }
      return { mes, count: servidoresSet.size, conflitos };
    });
  }, [lancamentos, ano]);

  // Keep selected date aligned with `ano` and jump to first occupied month if current month has 0 entries
  React.useEffect(() => {
    const currentResumo = afastadosPorMesResumo[mesSelecionado - 1];
    if (currentResumo && currentResumo.count > 0) {
      if (!diaSelecionado.startsWith(`${ano}-`)) {
        const prefixo = `${ano}-${String(mesSelecionado).padStart(2, '0')}`;
        const firstInMonth = lancamentos.find(
          (p) =>
            p.inicio <=
              `${prefixo}-${String(obterDiasDoMes(ano, mesSelecionado)).padStart(2, '0')}` &&
            p.fim >= `${prefixo}-01`
        );
        setDiaSelecionado(
          firstInMonth && firstInMonth.inicio >= `${prefixo}-01`
            ? firstInMonth.inicio
            : `${prefixo}-01`
        );
      }
      return;
    }

    const anoIni = `${ano}-01-01`;
    const anoFim = `${ano}-12-31`;
    const firstPeriodInYear = lancamentos.find(
      (p) => p.inicio <= anoFim && p.fim >= anoIni
    );

    if (firstPeriodInYear) {
      const targetIso =
        firstPeriodInYear.inicio >= anoIni ? firstPeriodInYear.inicio : anoIni;
      const targetMonth = Number(targetIso.slice(5, 7));
      if (targetMonth >= 1 && targetMonth <= 12) {
        setMesSelecionado(targetMonth);
      }
      setDiaSelecionado(targetIso);
    } else if (!diaSelecionado.startsWith(`${ano}-`)) {
      setDiaSelecionado(`${ano}-${String(mesSelecionado).padStart(2, '0')}-01`);
    }
  }, [ano, lancamentos, afastadosPorMesResumo, mesSelecionado, diaSelecionado]);

  const selecionarMes = (novoMes: number) => {
    setMesSelecionado(novoMes);
    setDiaSelecionado(`${ano}-${String(novoMes).padStart(2, '0')}-01`);
  };

  const handleDateLookup = (iso: string) => {
    if (!iso) return;
    const [yStr, mStr] = iso.split('-');
    const yNum = Number(yStr);
    const mes = Number(mStr);
    if (yNum >= 2000 && yNum <= 2100 && yNum !== ano && onSelectAno) {
      onSelectAno(yNum);
    }
    if (mes >= 1 && mes <= 12) {
      setMesSelecionado(mes);
    }
    setDiaSelecionado(iso);
  };

  const afastadosDiaSelecionado = useMemo(() => {
    return lancamentos.filter(
      (item) =>
        item.inicio &&
        item.fim &&
        item.inicio <= diaSelecionado &&
        item.fim >= diaSelecionado
    );
  }, [lancamentos, diaSelecionado]);

  return (
    <div className="space-y-4">
      {/* 12-Month navigation bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-2 flex items-center gap-1 overflow-x-auto">
        {NOMES_MESES_CURTOS.map((nome, idx) => {
          const mes = idx + 1;
          const active = mes === mesSelecionado;
          const vedado = (MESES_VEDADOS as readonly number[]).includes(mes);
          const info = afastadosPorMesResumo[idx];

          return (
            <button
              key={mes}
              type="button"
              onClick={() => selecionarMes(mes)}
              className={`flex-1 min-w-[76px] px-2.5 py-2 rounded-md text-xs transition-colors flex flex-col items-center gap-0.5 ${
                active
                  ? 'bg-[#1E3A5F] text-white font-semibold'
                  : vedado
                  ? 'bg-vedado-hatch text-slate-600 hover:bg-slate-200/70'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>{nome}</span>
              <span
                className={`text-[10px] font-mono tabular-nums ${
                  active
                    ? 'text-slate-200'
                    : info.conflitos > 0
                    ? 'text-red-600 font-semibold'
                    : 'text-slate-500'
                }`}
              >
                {vedado && info.count === 0 ? 'Vedado' : `${info.count} serv.`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main split: 7-col grid + Day details panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => selecionarMes(mesSelecionado > 1 ? mesSelecionado - 1 : 12)}
                aria-label="Mês anterior"
                className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 text-slate-700"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h2 className="font-display text-base font-bold text-slate-900">
                {NOMES_MESES_COMPLETOS[mesSelecionado - 1]} de {ano}
              </h2>
              <button
                type="button"
                onClick={() => selecionarMes(mesSelecionado < 12 ? mesSelecionado + 1 : 1)}
                aria-label="Próximo mês"
                className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 text-slate-700"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {ehMesVedado && (
              <span className="text-xs font-medium text-red-700">
                Mês vedado para férias (Regra 1)
              </span>
            )}
          </div>

          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
            {DIAS_SEMANA.map((d) => (
              <div key={d} className="py-2 text-center border-r border-slate-200 last:border-r-0">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {Array.from({ length: offsetInicio }).map((_, idx) => (
              <div
                key={`empty-${idx}`}
                className="min-h-[96px] border-r border-b border-slate-100 bg-slate-50/40"
              />
            ))}

            {Array.from({ length: diasNoMes }, (_, idx) => {
              const dia = idx + 1;
              const isoDia = `${ano}-${String(mesSelecionado).padStart(
                2,
                '0'
              )}-${String(dia).padStart(2, '0')}`;
              const afastados = afastamentosPorDia.get(isoDia) ?? [];
              const isSelected = diaSelecionado === isoDia;

              return (
                <div
                  key={isoDia}
                  className={`min-h-[96px] border-r border-b border-slate-200 p-1.5 flex flex-col gap-1 transition-colors ${
                    ehMesVedado ? 'bg-vedado-hatch' : 'bg-white'
                  } ${isSelected ? 'ring-2 ring-inset ring-[#1E3A5F]' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => setDiaSelecionado(isoDia)}
                    className="self-start text-xs font-mono tabular-nums font-semibold text-slate-700 hover:text-[#1E3A5F] px-1 rounded"
                    aria-label={`Selecionar dia ${formatarDataBR(isoDia)}`}
                  >
                    {dia}
                  </button>

                  <div className="space-y-1">
                    {afastados.slice(0, 3).map((item) => {
                      const isConflict = !item.validacao.valido;
                      const leaveStyle = getLeaveVisualStyle(item.tipo);
                      const tipKey = `${isoDia}-${item.id}`;
                      const showTip = hoveredTip === tipKey;

                      return (
                        <div key={tipKey} className="relative">
                          <button
                            type="button"
                            onClick={() => onEditLancamento(item)}
                            onMouseEnter={() => setHoveredTip(tipKey)}
                            onMouseLeave={() => setHoveredTip(null)}
                            onFocus={() => setHoveredTip(tipKey)}
                            onBlur={() => setHoveredTip(null)}
                            className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium border flex items-center gap-1 truncate ${
                              isConflict ? CONFLICT_BLOCK_CLASS : leaveStyle.blockClass
                            }`}
                          >
                            {isConflict && (
                              <AlertTriangle className="w-2.5 h-2.5 shrink-0 text-[#DC2626]" />
                            )}
                            <span className="truncate">{item.servidor}</span>
                          </button>

                          {showTip && (
                            <div
                              role="tooltip"
                              className="absolute bottom-full left-0 mb-1.5 w-64 p-2.5 rounded-md bg-white border border-slate-300 shadow-lg text-[11px] text-slate-900 z-30 pointer-events-none"
                            >
                              <div className="font-semibold">
                                {item.servidor} ({formatarLotacao(item.equipe, item.cargo)})
                              </div>
                              <div className="text-slate-700 font-medium mt-0.5">
                                {item.tipo}
                              </div>
                              <div className="font-mono tabular-nums text-slate-600 mt-0.5">
                                {formatarDataBR(item.inicio)} a {formatarDataBR(item.fim)}
                              </div>
                              {isConflict && (
                                <div className="mt-1 text-red-800 bg-red-50 border border-red-200 rounded p-1.5">
                                  {item.validacao.mensagem}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {afastados.length > 3 && (
                      <button
                        type="button"
                        onClick={() => setDiaSelecionado(isoDia)}
                        className="text-[10px] font-medium text-[#1E3A5F] hover:underline px-1"
                      >
                        +{afastados.length - 3} afastado(s)
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right-hand daily lookup & absent officers inspector */}
        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="space-y-2 pb-3 border-b border-slate-200">
            <label
              htmlFor="busca-data-especifica"
              className="block text-xs font-semibold text-slate-700"
            >
              Consultar afastados por data
            </label>
            <div className="relative">
              <input
                id="busca-data-especifica"
                type="date"
                value={diaSelecionado}
                onChange={(e) => handleDateLookup(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-md focus:outline-none focus:border-[#1E3A5F]"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
                <span>Dia {formatarDataBR(diaSelecionado)}</span>
              </h3>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {afastadosDiaSelecionado.length} afastado(s)
              </span>
            </div>

            {afastadosDiaSelecionado.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center border border-dashed border-slate-200 rounded-md">
                Nenhum servidor afastado nesta data.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {afastadosDiaSelecionado.map((item) => {
                  const isConflict = !item.validacao.valido;
                  const leaveStyle = getLeaveVisualStyle(item.tipo);
                  return (
                    <li
                      key={item.id}
                      className={`p-3 rounded-md border text-xs space-y-1.5 ${
                        isConflict ? 'bg-red-50/70 border-red-200' : leaveStyle.cardClass
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-slate-900">
                            {item.servidor}
                          </div>
                          <div className="text-slate-600">
                            {formatarLotacao(item.equipe, item.cargo)} ·{' '}
                            <span className="font-medium text-slate-800">{item.tipo}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onEditLancamento(item)}
                          aria-label={`Editar afastamento de ${item.servidor}`}
                          className="p-1.5 rounded text-slate-600 hover:text-[#1E3A5F] hover:bg-white transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="font-mono tabular-nums text-[11px] text-slate-700">
                        {formatarDataBR(item.inicio)} a {formatarDataBR(item.fim)} ({item.dias}d)
                      </div>

                      {isConflict && (
                        <div className="text-[11px] text-red-900 flex items-start gap-1.5 pt-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                          <span>{item.validacao.mensagem}</span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
