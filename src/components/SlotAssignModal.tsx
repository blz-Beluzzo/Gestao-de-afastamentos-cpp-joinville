import React, { useEffect, useMemo, useState } from 'react';
import { Check, Plus, Search, Trash2, Users, X } from 'lucide-react';
import {
  DELEGACIAS_LISTA,
  type DelegadoConvocavel,
  type EscalaDiaLinha,
  type SlotKey,
} from '../types/escala';
import { formatarDataBR } from '../utils/dateUtils';
import { getVacancyForSlot, SLOT_META } from '../utils/escalaMensalUtils';

interface SlotAssignModalProps {
  isOpen: boolean;
  row: EscalaDiaLinha | null;
  slot: SlotKey | null;
  delegados: DelegadoConvocavel[];
  onClose: () => void;
  onSave: (params: {
    isoDate: string;
    slot: SlotKey;
    values: string[];
    applyToTwin: boolean;
  }) => void;
  onOpenDelegadosModal: () => void;
  connectedEscalaSheetTitle?: string | null;
  mesTabTitle?: string;
}

export const SlotAssignModal: React.FC<SlotAssignModalProps> = ({
  isOpen,
  row,
  slot,
  delegados,
  onClose,
  onSave,
  onOpenDelegadosModal,
  connectedEscalaSheetTitle,
  mesTabTitle,
}) => {
  const [search, setSearch] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [applyToTwin, setApplyToTwin] = useState(false);

  useEffect(() => {
    if (!isOpen || !row || !slot) return;
    const current = row.convocacoes[slot] ?? [];
    setSelectedValues([...current]);
    setSearch('');
    setCustomValue('');

    const meta = SLOT_META[slot];
    const twinVac = getVacancyForSlot(row.vacancias, meta.twinKey);
    const twinCurrent = row.convocacoes[meta.twinKey] ?? [];
    // Suggest applying to the other 12h turn when it also has an open vacancy
    setApplyToTwin(twinVac.required > 0 && twinCurrent.length === 0);
  }, [isOpen, row, slot]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const meta = slot ? SLOT_META[slot] : null;
  const vacancy = row && slot ? getVacancyForSlot(row.vacancias, slot) : null;
  const maxSelectable = Math.max(1, vacancy?.required ?? 1);

  const filteredDelegados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return delegados;
    return delegados.filter(
      (d) =>
        d.nome.toLowerCase().includes(q) ||
        d.delegacia.toLowerCase().includes(q)
    );
  }, [delegados, search]);

  const filteredDelegacias = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [...DELEGACIAS_LISTA];
    return DELEGACIAS_LISTA.filter((del) => del.toLowerCase().includes(q));
  }, [search]);

  if (!isOpen || !row || !slot || !meta || !vacancy) return null;

  const isDpc = meta.cargo === 'DPC';

  const handleSelectOption = (optionValue: string) => {
    if (maxSelectable === 1) {
      onSave({
        isoDate: row.isoDate,
        slot,
        values: [optionValue],
        applyToTwin,
      });
      return;
    }

    setSelectedValues((prev) => {
      if (prev.includes(optionValue)) {
        return prev.filter((v) => v !== optionValue);
      }
      if (prev.length >= maxSelectable) {
        return [...prev.slice(1), optionValue];
      }
      return [...prev, optionValue];
    });
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customValue.trim();
    if (!trimmed) return;
    if (maxSelectable === 1) {
      onSave({
        isoDate: row.isoDate,
        slot,
        values: [trimmed],
        applyToTwin,
      });
      return;
    }
    if (!selectedValues.includes(trimmed)) {
      const next =
        selectedValues.length >= maxSelectable
          ? [...selectedValues.slice(1), trimmed]
          : [...selectedValues, trimmed];
      setSelectedValues(next);
    }
    setCustomValue('');
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="slot-assign-title"
    >
      <div className="bg-white border border-slate-200 rounded-lg max-w-xl w-full shadow-xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2
              id="slot-assign-title"
              className="font-display text-base font-bold text-slate-900"
            >
              Preencher Convocação · {meta.label}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
              {formatarDataBR(row.isoDate)} ({row.diaSemanaLabel}) · Equipe{' '}
              {row.equipePlantao.toUpperCase()} · Turno 12h (
              {meta.turno === 'Dia' ? '08h às 20h' : '20h às 08h'})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar seleção de convocação"
            className="p-2 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Vacancy context */}
          <div
            className={`rounded-md border px-3.5 py-2.5 text-xs ${
              vacancy.required > 0
                ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            {vacancy.required > 0 ? (
              <div className="space-y-1">
                <div className="font-semibold">
                  Vacância detectada ({vacancy.required}{' '}
                  {vacancy.required === 1 ? 'vaga' : 'vagas'}):
                </div>
                <ul className="space-y-0.5 text-amber-900">
                  {vacancy.motivos.map((m, idx) => (
                    <li key={idx}>· {m}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div>
                Equipe fixa completa para este cargo nesta data. Preenchimento opcional caso deseje registrar reforço manual.
              </div>
            )}
          </div>

          {/* Twin turn toggle */}
          <div className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md">
            <label
              htmlFor="chk-aplicar-turno-gemeo"
              className="text-xs font-medium text-slate-800 cursor-pointer flex items-center gap-2"
            >
              <input
                id="chk-aplicar-turno-gemeo"
                type="checkbox"
                checked={applyToTwin}
                onChange={(e) => setApplyToTwin(e.target.checked)}
                className="rounded border-slate-300 text-[#1E3A5F] focus:ring-[#1E3A5F]"
              />
              <span>
                Aplicar também em <strong>{SLOT_META[meta.twinKey].label}</strong> (completar 24h)
              </span>
            </label>

            {isDpc && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDelegadosModal();
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#1E3A5F] hover:underline shrink-0"
              >
                <Users className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Gerenciar Delegados</span>
              </button>
            )}
          </div>

          {/* Search box */}
          <div className="relative">
            <Search
              className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                isDpc
                  ? 'Buscar delegado ou delegacia...'
                  : 'Filtrar delegacia...'
              }
              aria-label={
                isDpc ? 'Buscar delegado ou delegacia' : 'Filtrar delegacia'
              }
              className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>

          {/* Options list */}
          {isDpc ? (
            <div className="border border-slate-200 rounded-md divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {filteredDelegados.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  Nenhum delegado encontrado com esse filtro.
                </div>
              ) : (
                filteredDelegados.map((del) => {
                  const isSelected = selectedValues.includes(del.nome);
                  return (
                    <button
                      key={del.id}
                      type="button"
                      onClick={() => handleSelectOption(del.nome)}
                      className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors ${
                        isSelected ? 'bg-sky-50/70' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {del.nome}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {del.delegacia}
                        </div>
                      </div>
                      {isSelected ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#1E3A5F] shrink-0">
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Selecionado</span>
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-slate-500 shrink-0">
                          Selecionar
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            <div className="border border-slate-200 rounded-md divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {filteredDelegacias.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  Nenhuma delegacia encontrada com esse filtro.
                </div>
              ) : (
                filteredDelegacias.map((delegacia) => {
                  const isSelected = selectedValues.includes(delegacia);
                  return (
                    <button
                      key={delegacia}
                      type="button"
                      onClick={() => handleSelectOption(delegacia)}
                      className={`w-full px-3.5 py-2 text-left flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors ${
                        isSelected ? 'bg-sky-50/70' : ''
                      }`}
                    >
                      <span className="text-xs font-medium text-slate-900 truncate">
                        {delegacia}
                      </span>
                      {isSelected && (
                        <Check
                          className="w-3.5 h-3.5 text-[#1E3A5F] shrink-0"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* Custom / manual entry fallback */}
          <form onSubmit={handleAddCustom} className="flex gap-2">
            <input
              type="text"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              placeholder={
                isDpc
                  ? 'Ou digite outro nome de delegado...'
                  : 'Ou digite outra unidade...'
              }
              aria-label="Entrada manual de convocação"
              className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-[#1E3A5F]"
            />
            <button
              type="submit"
              disabled={!customValue.trim()}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-800 text-white rounded-md hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Usar</span>
            </button>
          </form>

          {connectedEscalaSheetTitle && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-[11px] text-emerald-900">
              Salvamento automático ativo: a alteração será gravada na aba{' '}
              <span className="font-mono font-semibold">{mesTabTitle}</span> da planilha{' '}
              <strong>{connectedEscalaSheetTitle}</strong>.
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() =>
              onSave({
                isoDate: row.isoDate,
                slot,
                values: [],
                applyToTwin,
              })
            }
            disabled={(row.convocacoes[slot]?.length ?? 0) === 0 && selectedValues.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 rounded-md disabled:opacity-40 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Limpar turno</span>
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            {maxSelectable > 1 && (
              <button
                type="button"
                onClick={() =>
                  onSave({
                    isoDate: row.isoDate,
                    slot,
                    values: selectedValues,
                    applyToTwin,
                  })
                }
                className="px-4 py-1.5 text-xs font-medium text-white bg-[#1E3A5F] rounded-md hover:bg-[#162D4A] transition-colors"
              >
                {connectedEscalaSheetTitle
                  ? `Salvar e Sincronizar (${selectedValues.length}/${maxSelectable})`
                  : `Salvar (${selectedValues.length}/${maxSelectable})`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
