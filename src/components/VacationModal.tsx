import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Plus, Trash2, X } from 'lucide-react';
import {
  CARGOS_LISTA,
  Cargo,
  EQUIPES_LISTA,
  Equipe,
  LancamentoAfastamento,
  TIPOS_AFASTAMENTO_LISTA,
  TipoAfastamento,
} from '../types/ferias';
import { calcularDiasInclusivos, formatarDataBR } from '../utils/dateUtils';
import { getLeaveVisualStyle } from '../utils/leaveStyles';
import { validarPeriodoFerias } from '../utils/validarFerias';

interface VacationModalProps {
  isOpen: boolean;
  editingRecord: LancamentoAfastamento | null;
  prefillOfficer?: {
    servidor: string;
    equipe: Equipe;
    cargo: Cargo;
  } | null;
  allRecords: LancamentoAfastamento[];
  onClose: () => void;
  onSelectExistingRecord?: (record: LancamentoAfastamento) => void;
  onStartNewForOfficer?: (officer: {
    servidor: string;
    equipe: Equipe;
    cargo: Cargo;
  }) => void;
  onRequestSave: (record: LancamentoAfastamento, conflictMessages: string[]) => void;
  onRequestDelete: (record: LancamentoAfastamento) => void;
}

export const VacationModal: React.FC<VacationModalProps> = ({
  isOpen,
  editingRecord,
  prefillOfficer,
  allRecords,
  onClose,
  onSelectExistingRecord,
  onStartNewForOfficer,
  onRequestSave,
  onRequestDelete,
}) => {
  const [servidor, setServidor] = useState('');
  const [equipe, setEquipe] = useState<Equipe>('Alfa');
  const [cargo, setCargo] = useState<Cargo>('Agente');
  const [tipo, setTipo] = useState<TipoAfastamento>('Férias');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (editingRecord) {
      setServidor(editingRecord.servidor);
      setEquipe(editingRecord.equipe);
      setCargo(editingRecord.cargo);
      setTipo(editingRecord.tipo);
      setInicio(editingRecord.inicio);
      setFim(editingRecord.fim);
    } else if (prefillOfficer) {
      setServidor(prefillOfficer.servidor);
      setEquipe(prefillOfficer.equipe);
      setCargo(prefillOfficer.cargo);
      setTipo(prefillOfficer.servidor ? 'Licença-Prêmio' : 'Férias');
      setInicio('');
      setFim('');
    } else {
      setServidor('');
      setEquipe('Alfa');
      setCargo('Agente');
      setTipo('Férias');
      setInicio('');
      setFim('');
    }
    setFormError(null);
  }, [isOpen, editingRecord, prefillOfficer]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const existingOfficers = useMemo(() => {
    const mapa = new Map<string, { servidor: string; equipe: Equipe; cargo: Cargo }>();
    for (const r of allRecords) {
      const k = r.servidor.trim().toLowerCase();
      if (!mapa.has(k)) {
        mapa.set(k, { servidor: r.servidor, equipe: r.equipe, cargo: r.cargo });
      }
    }
    return Array.from(mapa.values()).sort((a, b) =>
      a.servidor.localeCompare(b.servidor, 'pt-BR')
    );
  }, [allRecords]);

  const otherLeavesOfOfficer = useMemo(() => {
    const nome = servidor.trim().toLowerCase();
    if (!nome) return [];
    return allRecords
      .filter(
        (r) =>
          r.servidor.trim().toLowerCase() === nome && r.id !== editingRecord?.id
      )
      .sort((a, b) => a.inicio.localeCompare(b.inicio));
  }, [allRecords, servidor, editingRecord]);

  const validacao = useMemo(() => {
    if (!inicio && !fim) return null;
    return validarPeriodoFerias(
      {
        id: editingRecord?.id ?? 'draft-new',
        nome: servidor.trim() || 'Novo Servidor',
        equipe,
        cargo,
        tipo,
      },
      { inicio, fim },
      allRecords
    );
  }, [inicio, fim, editingRecord, servidor, equipe, cargo, tipo, allRecords]);

  if (!isOpen) return null;

  const dias = inicio && fim ? calcularDiasInclusivos(inicio, fim) : 0;

  const handleServidorChange = (val: string) => {
    setServidor(val);
    if (!editingRecord) {
      const match = existingOfficers.find(
        (o) => o.servidor.toLowerCase() === val.trim().toLowerCase()
      );
      if (match) {
        setEquipe(match.equipe);
        setCargo(match.cargo);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nomeLimpo = servidor.trim();
    if (!nomeLimpo) {
      setFormError('Informe o nome completo do servidor.');
      return;
    }

    if (!inicio || !fim) {
      setFormError('Informe as datas de início e fim do afastamento.');
      return;
    }

    if (dias <= 0) {
      setFormError('A data final deve ser igual ou posterior à data inicial.');
      return;
    }

    const conflitos: string[] = [];
    if (validacao && !validacao.valido) {
      conflitos.push(`${tipo}: ${validacao.mensagem}`);
    }

    const updatedRecord: LancamentoAfastamento = {
      id: editingRecord?.id ?? `af-${Date.now()}`,
      rowIndex: editingRecord?.rowIndex,
      sheetFormat: editingRecord?.sheetFormat,
      legacySlot: editingRecord?.legacySlot,
      legacyTwinData: editingRecord?.legacyTwinData,
      equipe,
      servidor: nomeLimpo,
      cargo,
      tipo,
      inicio,
      fim,
    };

    onRequestSave(updatedRecord, conflitos);
  };

  const activeStyle = getLeaveVisualStyle(tipo);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vacation-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-lg max-w-2xl w-full shadow-xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2
              id="vacation-modal-title"
              className="font-display text-lg font-bold text-slate-900"
            >
              {editingRecord ? 'Editar Afastamento' : 'Novo Afastamento'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Validação automática em tempo real · CPP Joinville
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de afastamento"
            className="p-2 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {formError && (
            <div
              role="alert"
              className="bg-red-50 border border-red-200 text-red-900 text-xs px-3.5 py-2.5 rounded-md flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Officer identity fields */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label
                htmlFor="campo-servidor"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Servidor
              </label>
              <input
                id="campo-servidor"
                type="text"
                list="lista-servidores-cpp"
                value={servidor}
                onChange={(e) => handleServidorChange(e.target.value)}
                placeholder="Ex.: Cayo Filipe"
                required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F]"
              />
              <datalist id="lista-servidores-cpp">
                {existingOfficers.map((o) => (
                  <option key={o.servidor} value={o.servidor} />
                ))}
              </datalist>
            </div>

            <div>
              <label
                htmlFor="campo-equipe"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Equipe
              </label>
              <select
                id="campo-equipe"
                value={equipe}
                onChange={(e) => {
                  const nextEquipe = e.target.value as Equipe;
                  setEquipe(nextEquipe);
                  if (nextEquipe === 'Terceirizado') {
                    setCargo('Terceirizado');
                  } else if (cargo === 'Terceirizado') {
                    setCargo('Agente');
                  }
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F]"
              >
                {EQUIPES_LISTA.map((eq) => (
                  <option key={eq} value={eq}>
                    {eq}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="campo-cargo"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Cargo
              </label>
              <select
                id="campo-cargo"
                value={equipe === 'Terceirizado' ? 'Terceirizado' : cargo}
                disabled={equipe === 'Terceirizado'}
                onChange={(e) => setCargo(e.target.value as Cargo)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F] disabled:bg-slate-100 disabled:text-slate-600"
              >
                {equipe === 'Terceirizado' ? (
                  <option value="Terceirizado">Terceirizado</option>
                ) : (
                  CARGOS_LISTA.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Leave type selector */}
          <div className="space-y-1.5">
            <label
              htmlFor="campo-tipo-afastamento"
              className="block text-xs font-semibold text-slate-700"
            >
              Tipo de Afastamento
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TIPOS_AFASTAMENTO_LISTA.map((t) => {
                const st = getLeaveVisualStyle(t);
                const selected = tipo === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(t)}
                    aria-pressed={selected}
                    className={`px-3 py-2 rounded-md border text-xs font-medium flex items-center gap-2 text-left transition-colors ${
                      selected
                        ? 'border-[#1E3A5F] bg-slate-100 text-slate-900 ring-1 ring-[#1E3A5F]'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`inline-block w-3 h-3 rounded-sm border shrink-0 ${st.swatchClass}`}
                    />
                    <span className="truncate">{st.shortLabel}</span>
                  </button>
                );
              })}
            </div>
            <select
              id="campo-tipo-afastamento"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoAfastamento)}
              aria-label="Selecionar tipo de afastamento"
              className="sr-only"
            >
              {TIPOS_AFASTAMENTO_LISTA.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Period dates */}
          <div className="p-4 rounded-md border border-slate-200 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span
                  className={`inline-block w-3 h-3 rounded-sm border ${activeStyle.swatchClass}`}
                />
                <h3 className="text-sm font-semibold text-slate-900">{tipo}</h3>
              </div>
              <span className="font-mono tabular-nums text-xs text-slate-600">
                {dias > 0 ? `${dias} dia(s)` : 'Sem datas'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="campo-inicio"
                  className="block text-xs text-slate-600 mb-1"
                >
                  Data de Início
                </label>
                <input
                  id="campo-inicio"
                  type="date"
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>
              <div>
                <label
                  htmlFor="campo-fim"
                  className="block text-xs text-slate-600 mb-1"
                >
                  Data de Término
                </label>
                <input
                  id="campo-fim"
                  type="date"
                  value={fim}
                  onChange={(e) => setFim(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>
            </div>

            {validacao && (
              <div
                aria-live="polite"
                className={`text-xs px-3 py-2 rounded border flex items-start gap-2 ${
                  validacao.valido
                    ? `${activeStyle.cardClass} text-slate-900`
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                {validacao.valido ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <span>{validacao.mensagem}</span>
              </div>
            )}
          </div>

          {/* Other leaves for this officer */}
          {servidor.trim() && (otherLeavesOfOfficer.length > 0 || (editingRecord && onStartNewForOfficer)) && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">
                  Outros afastamentos de {servidor.trim()}
                </span>
                {editingRecord && onStartNewForOfficer && (
                  <button
                    type="button"
                    onClick={() =>
                      onStartNewForOfficer({
                        servidor: servidor.trim(),
                        equipe,
                        cargo,
                      })
                    }
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#1E3A5F] hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Novo afastamento para este servidor</span>
                  </button>
                )}
              </div>

              {otherLeavesOfOfficer.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {otherLeavesOfOfficer.map((other) => {
                    const st = getLeaveVisualStyle(other.tipo);
                    return (
                      <button
                        key={other.id}
                        type="button"
                        onClick={() => onSelectExistingRecord?.(other)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-mono tabular-nums ${st.blockClass}`}
                      >
                        <span className="font-sans font-semibold">{st.shortLabel}:</span>
                        <span>
                          {formatarDataBR(other.inicio)}–{formatarDataBR(other.fim)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-200">
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-600">
                Duração:{' '}
                <strong className="font-mono tabular-nums text-slate-900">
                  {dias} dia(s)
                </strong>
              </span>
              {editingRecord && (
                <button
                  type="button"
                  onClick={() => onRequestDelete(editingRecord)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 hover:text-red-800 hover:bg-red-50 px-2.5 py-1.5 rounded-md transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Excluir afastamento</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-[#1E3A5F] rounded-md hover:bg-[#162D4A] transition-colors"
              >
                {editingRecord ? 'Salvar Alterações' : 'Cadastrar Afastamento'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
