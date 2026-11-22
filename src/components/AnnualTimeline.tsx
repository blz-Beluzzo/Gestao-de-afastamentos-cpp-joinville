import React, { useState } from 'react';
import { AlertTriangle, Pencil, Plus } from 'lucide-react';
import type { LancamentoAvaliado, ServidorAgrupado } from '../types/ferias';
import {
  ANO_EXERCICIO,
  calcularPosicaoNoAno,
  formatarDataBR,
  formatarDataCurtaBR,
  formatarLotacao,
  MESES_VEDADOS,
  NOMES_MESES_CURTOS,
  obterDiasDoMes,
  obterDiasNoAno,
  periodosSeSobrepoem,
} from '../utils/dateUtils';
import { CONFLICT_BLOCK_CLASS, getLeaveVisualStyle } from '../utils/leaveStyles';

interface AnnualTimelineProps {
  registros: ServidorAgrupado[];
  ano?: number;
  title?: string;
  sectionAriaLabel?: string;
  emptyTitle?: string;
  emptySubtitle?: string;
  emptyActionLabel?: string;
  onSelectAno?: (ano: number) => void;
  highlightedRecordId?: string | null;
  highlightedServidorName?: string | null;
  onEditLancamento: (lancamento: LancamentoAvaliado) => void;
  onCreateNewForOfficer?: (servidor: ServidorAgrupado) => void;
  onCreateNew: () => void;
}

interface ActiveTooltipState {
  reg: ServidorAgrupado;
  periodo: LancamentoAvaliado;
  top: number;
  left: number;
  placeBelow: boolean;
}

function assignLanes(periodos: LancamentoAvaliado[]): {
  laneById: Map<string, number>;
  laneCount: number;
} {
  const laneEnds: string[] = [];
  const laneById = new Map<string, number>();

  for (const p of periodos) {
    let assigned = -1;
    for (let i = 0; i < laneEnds.length; i++) {
      if (!periodosSeSobrepoem(p.inicio, p.fim, laneEnds[i], laneEnds[i]) && p.inicio > laneEnds[i]) {
        assigned = i;
        laneEnds[i] = p.fim;
        break;
      }
    }
    if (assigned === -1) {
      assigned = laneEnds.length;
      laneEnds.push(p.fim);
    }
    laneById.set(p.id, assigned);
  }

  return { laneById, laneCount: Math.max(1, laneEnds.length) };
}

export const AnnualTimeline: React.FC<AnnualTimelineProps> = ({
  registros,
  ano = ANO_EXERCICIO,
  title = 'Servidor / Lotação',
  sectionAriaLabel,
  emptyTitle = 'Nenhum servidor encontrado com os filtros selecionados.',
  emptySubtitle = 'Ajuste os filtros de equipe, cargo, tipo ou busca, ou cadastre um novo afastamento.',
  emptyActionLabel = 'Novo Afastamento',
  onSelectAno,
  highlightedRecordId,
  highlightedServidorName,
  onEditLancamento,
  onCreateNewForOfficer,
  onCreateNew,
}) => {
  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltipState | null>(
    null
  );
  const rowRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  const mesesLargurasPct = React.useMemo(() => {
    const totalDiasAno = obterDiasNoAno(ano);
    return Array.from({ length: 12 }, (_, idx) => {
      const dias = obterDiasDoMes(ano, idx + 1);
      return {
        mes: idx + 1,
        nome: NOMES_MESES_CURTOS[idx],
        widthPct: (dias / totalDiasAno) * 100,
        vedado: (MESES_VEDADOS as readonly number[]).includes(idx + 1),
      };
    });
  }, [ano]);

  React.useEffect(() => {
    const target = registros.find(
      (r) =>
        (highlightedRecordId &&
          r.periodos.some((p) => p.id === highlightedRecordId)) ||
        (highlightedServidorName &&
          r.servidor.trim().toLowerCase() ===
            highlightedServidorName.trim().toLowerCase())
    );
    if (target && rowRefs.current[target.key]) {
      rowRefs.current[target.key]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [highlightedRecordId, highlightedServidorName, registros]);

  if (registros.length === 0) {
    return (
      <section
        aria-label={sectionAriaLabel ?? title}
        className="bg-white border border-slate-200 rounded-lg overflow-hidden"
      >
        <div className="overflow-x-auto">
          <div className="min-w-[1000px]">
            <div className="flex border-b border-slate-200 bg-slate-50/90 text-xs font-semibold text-slate-700">
              <div className="w-[195px] sm:w-[260px] shrink-0 px-3 sm:px-4 py-3 border-r border-slate-200 sticky left-0 bg-slate-50 z-20 flex items-center justify-between">
                <span>{title}</span>
                <span className="font-mono text-[11px] text-slate-500">{ano}</span>
              </div>

              <div className="flex-1 flex">
                {mesesLargurasPct.map((m) => (
                  <div
                    key={m.mes}
                    style={{ width: `${m.widthPct}%` }}
                    className={`py-2.5 text-center border-r border-slate-200 last:border-r-0 ${
                      m.vedado ? 'bg-vedado-hatch text-slate-600' : 'text-slate-800'
                    }`}
                  >
                    <div>{m.nome}</div>
                    {m.vedado && (
                      <div className="text-[10px] font-normal text-slate-500 leading-tight">
                        Vedado
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 text-center space-y-2.5">
          <p className="text-sm font-medium text-slate-800">{emptyTitle}</p>
          <p className="text-xs text-slate-500">{emptySubtitle}</p>
          <div className="pt-1">
            <button
              type="button"
              onClick={onCreateNew}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] rounded-md hover:bg-[#162D4A] transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{emptyActionLabel}</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  const showTooltipForTarget = (
    el: HTMLElement,
    reg: ServidorAgrupado,
    periodo: LancamentoAvaliado
  ) => {
    const rect = el.getBoundingClientRect();
    const tooltipWidth = 320;
    const placeBelow = rect.top < 230;
    const rawLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
    const maxLeft =
      typeof window !== 'undefined' ? window.innerWidth - tooltipWidth - 16 : rawLeft;
    const clampedLeft = Math.max(16, Math.min(rawLeft, maxLeft));

    setActiveTooltip({
      reg,
      periodo,
      top: placeBelow ? rect.bottom + 8 : rect.top - 8,
      left: clampedLeft,
      placeBelow,
    });
  };

  const renderPeriodoBlock = (
    reg: ServidorAgrupado,
    periodo: LancamentoAvaliado,
    laneIndex: number,
    laneCount: number
  ) => {
    const pos = calcularPosicaoNoAno(periodo.inicio, periodo.fim, ano);
    if (!pos.visivel) return null;

    const isConflict = !periodo.validacao.valido;
    const leaveStyle = getLeaveVisualStyle(periodo.tipo);

    const visualWidthPct = Math.max(pos.widthPct, 1.8);
    const visualLeftPct = Math.min(pos.leftPct, 100 - visualWidthPct);

    const isTiny = visualWidthPct < 2.8;
    const isMedium = visualWidthPct >= 2.8 && visualWidthPct < 8.5;

    const labelCompacto =
      pos.widthPct >= 11 && periodo.tipo !== 'Férias'
        ? `${leaveStyle.shortLabel} · ${formatarDataCurtaBR(periodo.inicio)}–${formatarDataCurtaBR(periodo.fim)}`
        : pos.widthPct >= 8.5
        ? `${formatarDataCurtaBR(periodo.inicio)}–${formatarDataCurtaBR(periodo.fim)}`
        : `${periodo.dias}d`;

    const laneHeightPct = 100 / laneCount;
    const topPct = laneIndex * laneHeightPct;

    return (
      <div
        key={periodo.id}
        style={{
          left: `${visualLeftPct}%`,
          width: `${visualWidthPct}%`,
          top: laneCount > 1 ? `calc(${topPct}% + 3px)` : '6px',
          height: laneCount > 1 ? `calc(${laneHeightPct}% - 6px)` : 'calc(100% - 12px)',
        }}
        className="absolute z-10"
      >
        <button
          type="button"
          onClick={() => {
            setActiveTooltip(null);
            onEditLancamento(periodo);
          }}
          onMouseEnter={(e) => showTooltipForTarget(e.currentTarget, reg, periodo)}
          onMouseLeave={() => setActiveTooltip(null)}
          onFocus={(e) => showTooltipForTarget(e.currentTarget, reg, periodo)}
          onBlur={() => setActiveTooltip(null)}
          aria-label={`${reg.servidor}, ${periodo.tipo} de ${formatarDataBR(
            periodo.inicio
          )} a ${formatarDataBR(periodo.fim)}, ${
            isConflict ? `em conflito: ${periodo.validacao.mensagem}` : 'regular'
          }. Clique para editar ou excluir.`}
          className={`w-full h-full rounded flex items-center justify-center font-mono tabular-nums font-semibold border transition-transform duration-150 overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1E3A5F] ${
            isTiny
              ? 'px-0 text-[9px] tracking-tighter gap-0'
              : isMedium
              ? 'px-0.5 text-[10px] gap-0.5'
              : 'px-1.5 text-[11px] gap-1'
          } ${isConflict ? CONFLICT_BLOCK_CLASS : leaveStyle.blockClass}`}
        >
          {isConflict && !isTiny && (
            <AlertTriangle
              className={`${isMedium ? 'w-2.5 h-2.5' : 'w-3 h-3'} shrink-0 text-[#DC2626]`}
              aria-hidden="true"
            />
          )}
          <span className={`whitespace-nowrap ${pos.widthPct >= 8.5 ? 'truncate' : ''}`}>
            {labelCompacto}
          </span>
        </button>
      </div>
    );
  };

  return (
    <section
      aria-label={sectionAriaLabel ?? title}
      className="bg-white border border-slate-200 rounded-lg overflow-hidden relative"
    >
      <div className="overflow-x-auto">
        <div className="min-w-[1000px]">
          {/* Header row */}
          <div className="flex border-b border-slate-200 bg-slate-50/90 text-xs font-semibold text-slate-700">
            <div className="w-[195px] sm:w-[260px] shrink-0 px-3 sm:px-4 py-3 border-r border-slate-200 sticky left-0 bg-slate-50 z-20 flex items-center justify-between">
              <span>{title}</span>
              <span className="font-mono text-[11px] text-slate-500">{ano}</span>
            </div>

            <div className="flex-1 flex">
              {mesesLargurasPct.map((m) => (
                <div
                  key={m.mes}
                  style={{ width: `${m.widthPct}%` }}
                  className={`py-2.5 text-center border-r border-slate-200 last:border-r-0 ${
                    m.vedado ? 'bg-vedado-hatch text-slate-600' : 'text-slate-800'
                  }`}
                >
                  <div>{m.nome}</div>
                  {m.vedado && (
                    <div className="text-[10px] font-normal text-slate-500 leading-tight">
                      Vedado
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Officer rows */}
          <div className="divide-y divide-slate-200">
            {registros.map((reg) => {
              const isHighlighted = Boolean(
                (highlightedRecordId &&
                  reg.periodos.some((p) => p.id === highlightedRecordId)) ||
                  (highlightedServidorName &&
                    reg.servidor.trim().toLowerCase() ===
                      highlightedServidorName.trim().toLowerCase())
              );

              const periodosNoAno = reg.periodos.filter(
                (p) => calcularPosicaoNoAno(p.inicio, p.fim, ano).visivel
              );
              const { laneById, laneCount } = assignLanes(periodosNoAno);
              const rowMinHeight = laneCount > 1 ? laneCount * 36 + 8 : 48;

              return (
                <div
                  key={reg.key}
                  ref={(el) => {
                    rowRefs.current[reg.key] = el;
                  }}
                  className={`flex items-stretch transition-colors group ${
                    isHighlighted
                      ? 'bg-sky-50/90 ring-2 ring-inset ring-[#1E3A5F]'
                      : 'hover:bg-slate-50/60'
                  }`}
                >
                  {/* Sticky left officer info */}
                  <div
                    className={`w-[195px] sm:w-[260px] shrink-0 px-3 sm:px-4 py-2.5 border-r border-slate-200 sticky left-0 z-20 flex items-center justify-between gap-2 ${
                      isHighlighted
                        ? 'bg-sky-50'
                        : 'bg-white group-hover:bg-slate-50/95'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-medium text-slate-900 truncate">
                          {reg.servidor}
                        </span>
                        {reg.temConflito && (
                          <AlertTriangle
                            className="w-3.5 h-3.5 text-red-600 shrink-0"
                            aria-label="Possui conflito"
                          />
                        )}
                      </div>
                      <div className="text-[11px] sm:text-xs text-slate-500 truncate">
                        {formatarLotacao(reg.equipe, reg.cargo)}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {onCreateNewForOfficer && (
                        <button
                          type="button"
                          onClick={() => onCreateNewForOfficer(reg)}
                          aria-label={`Adicionar afastamento para ${reg.servidor}`}
                          title={`Adicionar afastamento para ${reg.servidor}`}
                          className="p-1.5 rounded text-slate-400 hover:text-[#1E3A5F] hover:bg-slate-100 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {reg.periodos[0] && (
                        <button
                          type="button"
                          onClick={() => onEditLancamento(reg.periodos[0])}
                          aria-label={`Editar afastamentos de ${reg.servidor}`}
                          title={`Editar afastamentos de ${reg.servidor}`}
                          className="p-1.5 rounded text-slate-400 hover:text-[#1E3A5F] hover:bg-slate-100 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 12-month timeline track */}
                  <div
                    className="flex-1 relative"
                    style={{ minHeight: `${rowMinHeight}px` }}
                  >
                    {/* Background month grid lines + hatched restricted months */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {mesesLargurasPct.map((m) => (
                        <div
                          key={m.mes}
                          style={{ width: `${m.widthPct}%` }}
                          className={`h-full border-r border-slate-100 last:border-r-0 ${
                            m.vedado ? 'bg-vedado-hatch' : ''
                          }`}
                        />
                      ))}
                    </div>

                    {/* Period blocks */}
                    {periodosNoAno.map((p) =>
                      renderPeriodoBlock(reg, p, laneById.get(p.id) ?? 0, laneCount)
                    )}

                    {/* Fallback buttons when periods belong to a different calendar year than `ano` */}
                    {periodosNoAno.length === 0 && reg.periodos.length > 0 && (
                      <div className="relative z-10 h-full flex items-center flex-wrap gap-2 px-3 py-1.5">
                        {reg.periodos.map((p) => {
                          const periodoAno = Number(p.inicio.slice(0, 4));
                          const isConflict = !p.validacao.valido;
                          const leaveStyle = getLeaveVisualStyle(p.tipo);
                          return (
                            <button
                              key={`${p.id}-off`}
                              type="button"
                              onClick={() => {
                                if (onSelectAno && periodoAno >= 2000) {
                                  onSelectAno(periodoAno);
                                } else {
                                  onEditLancamento(p);
                                }
                              }}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono tabular-nums font-medium border transition-colors ${
                                isConflict ? CONFLICT_BLOCK_CLASS : leaveStyle.blockClass
                              }`}
                            >
                              <span>
                                {leaveStyle.shortLabel}: {formatarDataBR(p.inicio)}–{formatarDataBR(p.fim)} ({p.dias}d)
                              </span>
                              {onSelectAno && periodoAno >= 2000 && (
                                <span className="underline font-sans font-semibold">
                                  Ver {periodoAno}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fixed-position tooltip */}
      {activeTooltip && (
        <div
          role="tooltip"
          style={{
            top: `${activeTooltip.top}px`,
            left: `${activeTooltip.left}px`,
            transform: activeTooltip.placeBelow ? 'none' : 'translateY(-100%)',
          }}
          className={`fixed w-[320px] p-3 rounded-md shadow-xl border text-xs leading-relaxed pointer-events-none z-50 bg-white text-slate-900 ${
            activeTooltip.periodo.validacao.valido
              ? 'border-slate-300'
              : 'border-red-300'
          }`}
        >
          <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-slate-100">
            <span className="font-semibold text-slate-900 truncate">
              {activeTooltip.reg.servidor}
            </span>
            <span className="text-[11px] text-slate-500 shrink-0">
              {formatarLotacao(activeTooltip.reg.equipe, activeTooltip.reg.cargo)}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-800 mb-1">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-sm border shrink-0 ${
                getLeaveVisualStyle(activeTooltip.periodo.tipo).swatchClass
              }`}
            />
            <span>{activeTooltip.periodo.tipo}</span>
          </div>

          <div className="font-mono tabular-nums text-[11px] text-slate-700 mb-1.5">
            {formatarDataBR(activeTooltip.periodo.inicio)} a{' '}
            {formatarDataBR(activeTooltip.periodo.fim)} (
            {activeTooltip.periodo.dias} dia
            {activeTooltip.periodo.dias !== 1 ? 's' : ''})
          </div>

          {!activeTooltip.periodo.validacao.valido ? (
            <div className="bg-red-50 border border-red-200 rounded p-2 text-red-900 space-y-1">
              <div className="font-semibold flex items-center gap-1.5 text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <span>Conflito detectado</span>
              </div>
              <ul className="space-y-1 text-[11px]">
                {activeTooltip.periodo.validacao.conflitos.map((c, idx) => (
                  <li key={idx}>• {c.mensagem}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
              Afastamento regular, sem conflitos operacionais.
            </div>
          )}

          <div className="text-[10px] text-slate-500 mt-1.5">
            Clique no bloco para editar ou excluir este afastamento
          </div>
        </div>
      )}
    </section>
  );
};
