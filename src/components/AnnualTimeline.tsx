import React, { useState } from 'react';
import { AlertTriangle, Pencil, Plus } from 'lucide-react';
import type { PeriodoAvaliado, RegistroAvaliado } from '../types/ferias';
import {
  ANO_EXERCICIO,
  calcularPosicaoNoAno,
  formatarDataBR,
  formatarDataCurtaBR,
  MESES_VEDADOS,
  NOMES_MESES_CURTOS,
  obterDiasDoMes,
  obterDiasNoAno,
} from '../utils/dateUtils';

interface AnnualTimelineProps {
  registros: RegistroAvaliado[];
  ano?: number;
  onSelectAno?: (ano: number) => void;
  highlightedRecordId?: string | null;
  highlightedServidorName?: string | null;
  onEditPeriod: (registro: RegistroAvaliado, periodo?: 1 | 2) => void;
  onCreateNew: () => void;
}

interface ActiveTooltipState {
  reg: RegistroAvaliado;
  periodo: PeriodoAvaliado;
  top: number;
  left: number;
  placeBelow: boolean;
}

export const AnnualTimeline: React.FC<AnnualTimelineProps> = ({
  registros,
  ano = ANO_EXERCICIO,
  onSelectAno,
  highlightedRecordId,
  highlightedServidorName,
  onEditPeriod,
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
        (highlightedRecordId && r.id === highlightedRecordId) ||
        (highlightedServidorName &&
          r.servidor.trim().toLowerCase() ===
            highlightedServidorName.trim().toLowerCase())
    );
    if (target && rowRefs.current[target.id]) {
      rowRefs.current[target.id]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [highlightedRecordId, highlightedServidorName, registros]);

  if (registros.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-10 text-center space-y-3">
        <p className="text-sm font-medium text-slate-800">
          Nenhum servidor encontrado com os filtros selecionados.
        </p>
        <p className="text-xs text-slate-500">
          Ajuste os filtros de equipe, cargo ou busca, ou cadastre um novo lançamento de férias.
        </p>
        <div className="pt-1">
          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] rounded-md hover:bg-[#162D4A] transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Lançamento</span>
          </button>
        </div>
      </div>
    );
  }

  const showTooltipForTarget = (
    el: HTMLElement,
    reg: RegistroAvaliado,
    periodo: PeriodoAvaliado
  ) => {
    const rect = el.getBoundingClientRect();
    const tooltipWidth = 310;
    const placeBelow = rect.top < 220;
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
    reg: RegistroAvaliado,
    periodo: PeriodoAvaliado
  ) => {
    const pos = calcularPosicaoNoAno(periodo.inicio, periodo.fim, ano);
    if (!pos.visivel) return null;

    const key = `${reg.id}-p${periodo.numero}`;
    const isConflict = !periodo.validacao.valido;

    const labelCompacto =
      pos.widthPct >= 8.5
        ? `${formatarDataCurtaBR(periodo.inicio)}–${formatarDataCurtaBR(periodo.fim)}`
        : `${periodo.dias}d`;

    return (
      <div
        key={key}
        style={{ left: `${pos.leftPct}%`, width: `${pos.widthPct}%` }}
        className="absolute top-1.5 bottom-1.5 z-10"
      >
        <button
          type="button"
          onClick={() => {
            setActiveTooltip(null);
            onEditPeriod(reg, periodo.numero);
          }}
          onMouseEnter={(e) => showTooltipForTarget(e.currentTarget, reg, periodo)}
          onMouseLeave={() => setActiveTooltip(null)}
          onFocus={(e) => showTooltipForTarget(e.currentTarget, reg, periodo)}
          onBlur={() => setActiveTooltip(null)}
          aria-label={`${reg.servidor}, ${periodo.numero}º período de ${formatarDataBR(
            periodo.inicio
          )} a ${formatarDataBR(periodo.fim)}, ${
            isConflict ? `em conflito: ${periodo.validacao.mensagem}` : 'válido'
          }. Clique para editar ou excluir.`}
          className={`w-full h-full rounded px-1 flex items-center justify-center gap-1 text-[11px] font-mono tabular-nums font-semibold border transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1E3A5F] ${
            isConflict
              ? 'bg-[#FEE2E2] hover:bg-[#FECACA] border-[#DC2626] text-[#991B1B]'
              : 'bg-[#FACC15] hover:bg-[#EAB308] border-[#CA8A04] text-[#422006]'
          }`}
        >
          {isConflict && (
            <AlertTriangle className="w-3 h-3 shrink-0 text-[#DC2626]" aria-hidden="true" />
          )}
          <span className="whitespace-nowrap">{labelCompacto}</span>
        </button>
      </div>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden relative">
      <div className="overflow-x-auto">
        <div className="min-w-[1000px]">
          {/* Header row */}
          <div className="flex border-b border-slate-200 bg-slate-50/90 text-xs font-semibold text-slate-700">
            <div className="w-[185px] sm:w-[250px] shrink-0 px-3 sm:px-4 py-3 border-r border-slate-200 sticky left-0 bg-slate-50 z-20 flex items-center justify-between">
              <span>Servidor / Lotação</span>
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

            <div className="w-[72px] shrink-0 px-3 py-3 border-l border-slate-200 text-right">
              Dias
            </div>
          </div>

          {/* Officer rows */}
          <div className="divide-y divide-slate-200">
            {registros.map((reg) => {
              const isHighlighted = Boolean(
                (highlightedRecordId && reg.id === highlightedRecordId) ||
                  (highlightedServidorName &&
                    reg.servidor.trim().toLowerCase() ===
                      highlightedServidorName.trim().toLowerCase())
              );

              return (
              <div
                key={reg.id}
                ref={(el) => {
                  rowRefs.current[reg.id] = el;
                }}
                className={`flex items-stretch transition-colors group ${
                  isHighlighted
                    ? 'bg-sky-50/90 ring-2 ring-inset ring-[#1E3A5F]'
                    : 'hover:bg-slate-50/60'
                }`}
              >
                {/* Sticky left officer info */}
                <div
                  className={`w-[185px] sm:w-[250px] shrink-0 px-3 sm:px-4 py-2.5 border-r border-slate-200 sticky left-0 z-20 flex items-center justify-between gap-2 ${
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
                      {reg.equipe} · {reg.cargo}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onEditPeriod(reg)}
                    aria-label={`Editar férias de ${reg.servidor}`}
                    className="p-1.5 rounded text-slate-400 hover:text-[#1E3A5F] hover:bg-slate-100 transition-colors shrink-0"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 12-month timeline track */}
                <div className="flex-1 relative min-h-[48px]">
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
                  {reg.periodo1Avaliado &&
                    renderPeriodoBlock(reg, reg.periodo1Avaliado)}
                  {reg.periodo2Avaliado &&
                    renderPeriodoBlock(reg, reg.periodo2Avaliado)}

                  {/* Fallback chips when periods belong to a different calendar year than `ano` */}
                  {(() => {
                    const foraDoAno = [reg.periodo1Avaliado, reg.periodo2Avaliado].filter(
                      (p): p is PeriodoAvaliado =>
                        Boolean(p && !calcularPosicaoNoAno(p.inicio, p.fim, ano).visivel)
                    );
                    if (foraDoAno.length === 0) return null;
                    return (
                      <div className="relative z-10 h-full flex items-center gap-2 px-3 py-1.5">
                        {foraDoAno.map((p) => {
                          const periodoAno = Number(p.inicio.slice(0, 4));
                          const isConflict = !p.validacao.valido;
                          return (
                            <button
                              key={`${reg.id}-off-${p.numero}`}
                              type="button"
                              onClick={() => {
                                if (onSelectAno && periodoAno >= 2000) {
                                  onSelectAno(periodoAno);
                                } else {
                                  onEditPeriod(reg, p.numero);
                                }
                              }}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono tabular-nums font-medium border transition-colors ${
                                isConflict
                                  ? 'bg-[#FEE2E2] hover:bg-[#FECACA] border-[#DC2626] text-[#991B1B]'
                                  : 'bg-[#FEF9C3] hover:bg-[#FEF08A] border-[#CA8A04] text-[#422006]'
                              }`}
                            >
                              <span>
                                {p.numero}º: {formatarDataBR(p.inicio)}–{formatarDataBR(p.fim)} ({p.dias}d)
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
                    );
                  })()}
                </div>

                {/* Right day total */}
                <div className="w-[72px] shrink-0 px-3 py-2.5 border-l border-slate-200 flex items-center justify-end gap-1 font-mono tabular-nums text-xs font-medium text-slate-700">
                  <span>{reg.totalDias}d</span>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fixed-position portal-like tooltip so it is never clipped by overflow containers */}
      {activeTooltip && (
        <div
          role="tooltip"
          style={{
            top: `${activeTooltip.top}px`,
            left: `${activeTooltip.left}px`,
            transform: activeTooltip.placeBelow ? 'none' : 'translateY(-100%)',
          }}
          className={`fixed w-[310px] p-3 rounded-md shadow-xl border text-xs leading-relaxed pointer-events-none z-50 bg-white text-slate-900 ${
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
              {activeTooltip.reg.equipe} · {activeTooltip.reg.cargo}
            </span>
          </div>

          <div className="font-mono tabular-nums text-[11px] text-slate-700 mb-1.5">
            {activeTooltip.periodo.numero}º Período:{' '}
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
              Período regular, sem conflitos operacionais.
            </div>
          )}

          <div className="text-[10px] text-slate-500 mt-1.5">
            Clique no bloco para editar ou excluir este período
          </div>
        </div>
      )}
    </div>
  );
};
