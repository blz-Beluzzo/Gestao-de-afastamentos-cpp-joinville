import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eraser, Trash2, X } from 'lucide-react';
import {
  CARGOS_LISTA,
  Cargo,
  EQUIPES_LISTA,
  Equipe,
  RegistroFerias,
} from '../types/ferias';
import { calcularDiasInclusivos } from '../utils/dateUtils';
import { validarPeriodoFerias } from '../utils/validarFerias';

interface VacationModalProps {
  isOpen: boolean;
  editingRecord: RegistroFerias | null;
  focusPeriod?: 1 | 2;
  allRecords: RegistroFerias[];
  onClose: () => void;
  onRequestSave: (record: RegistroFerias, conflictMessages: string[]) => void;
  onRequestDelete: (record: RegistroFerias) => void;
}

export const VacationModal: React.FC<VacationModalProps> = ({
  isOpen,
  editingRecord,
  focusPeriod,
  allRecords,
  onClose,
  onRequestSave,
  onRequestDelete,
}) => {
  const [servidor, setServidor] = useState('');
  const [equipe, setEquipe] = useState<Equipe>('Alfa');
  const [cargo, setCargo] = useState<Cargo>('Agente');
  const [inicio1, setInicio1] = useState('');
  const [fim1, setFim1] = useState('');
  const [inicio2, setInicio2] = useState('');
  const [fim2, setFim2] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (editingRecord) {
      setServidor(editingRecord.servidor);
      setEquipe(editingRecord.equipe);
      setCargo(editingRecord.cargo);
      setInicio1(editingRecord.inicio1);
      setFim1(editingRecord.fim1);
      setInicio2(editingRecord.inicio2);
      setFim2(editingRecord.fim2);
    } else {
      setServidor('');
      setEquipe('Alfa');
      setCargo('Agente');
      setInicio1('');
      setFim1('');
      setInicio2('');
      setFim2('');
    }
    setFormError(null);
  }, [isOpen, editingRecord]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const previewRecords = useMemo(() => {
    const draft: RegistroFerias = {
      id: editingRecord?.id ?? 'draft-new',
      rowIndex: editingRecord?.rowIndex,
      equipe,
      servidor: servidor.trim() || 'Novo Servidor',
      cargo,
      inicio1,
      fim1,
      inicio2,
      fim2,
    };
    if (editingRecord) {
      return allRecords.map((r) => (r.id === editingRecord.id ? draft : r));
    }
    return [...allRecords, draft];
  }, [allRecords, editingRecord, equipe, servidor, cargo, inicio1, fim1, inicio2, fim2]);

  const validacaoP1 = useMemo(() => {
    if (!inicio1 && !fim1) return null;
    return validarPeriodoFerias(
      {
        id: editingRecord?.id ?? 'draft-new',
        nome: servidor.trim() || 'Novo Servidor',
        equipe,
        cargo,
        numeroPeriodo: 1,
      },
      { inicio: inicio1, fim: fim1 },
      previewRecords
    );
  }, [inicio1, fim1, editingRecord, servidor, equipe, cargo, previewRecords]);

  const validacaoP2 = useMemo(() => {
    if (!inicio2 && !fim2) return null;
    return validarPeriodoFerias(
      {
        id: editingRecord?.id ?? 'draft-new',
        nome: servidor.trim() || 'Novo Servidor',
        equipe,
        cargo,
        numeroPeriodo: 2,
      },
      { inicio: inicio2, fim: fim2 },
      previewRecords
    );
  }, [inicio2, fim2, editingRecord, servidor, equipe, cargo, previewRecords]);

  if (!isOpen) return null;

  const dias1 = inicio1 && fim1 ? calcularDiasInclusivos(inicio1, fim1) : 0;
  const dias2 = inicio2 && fim2 ? calcularDiasInclusivos(inicio2, fim2) : 0;
  const totalDias = dias1 + dias2;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nomeLimpo = servidor.trim();
    if (!nomeLimpo) {
      setFormError('Informe o nome completo do servidor.');
      return;
    }

    const p1Preenchido = Boolean(inicio1 || fim1);
    const p2Preenchido = Boolean(inicio2 || fim2);

    if (p1Preenchido && (!inicio1 || !fim1)) {
      setFormError('Complete ambas as datas (início e fim) do 1º período ou limpe-o.');
      return;
    }
    if (p2Preenchido && (!inicio2 || !fim2)) {
      setFormError('Complete ambas as datas (início e fim) do 2º período ou limpe-o.');
      return;
    }
    if (p1Preenchido && dias1 <= 0) {
      setFormError('No 1º período, a data final deve ser igual ou posterior à data inicial.');
      return;
    }
    if (p2Preenchido && dias2 <= 0) {
      setFormError('No 2º período, a data final deve ser igual ou posterior à data inicial.');
      return;
    }

    const conflitos: string[] = [];
    if (validacaoP1 && !validacaoP1.valido) {
      conflitos.push(`1º Período: ${validacaoP1.mensagem}`);
    }
    if (validacaoP2 && !validacaoP2.valido) {
      conflitos.push(`2º Período: ${validacaoP2.mensagem}`);
    }

    const updatedRecord: RegistroFerias = {
      id: editingRecord?.id ?? `srv-${Date.now()}`,
      rowIndex: editingRecord?.rowIndex,
      equipe,
      servidor: nomeLimpo,
      cargo,
      inicio1,
      fim1,
      inicio2,
      fim2,
    };

    onRequestSave(updatedRecord, conflitos);
  };

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
              {editingRecord ? 'Editar Programação de Férias' : 'Novo Lançamento de Férias'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Validação automática em tempo real · Exercício 2027
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de férias"
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
                value={servidor}
                onChange={(e) => setServidor(e.target.value)}
                placeholder="Ex.: Cayo Filipe"
                required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F]"
              />
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
                onChange={(e) => setEquipe(e.target.value as Equipe)}
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
                value={cargo}
                onChange={(e) => setCargo(e.target.value as Cargo)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F]"
              >
                {CARGOS_LISTA.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Period 1 */}
          <div
            className={`p-4 rounded-md border ${
              focusPeriod === 1 ? 'border-[#1E3A5F] bg-slate-50/70' : 'border-slate-200 bg-slate-50/40'
            } space-y-3`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-slate-900">1º Período</h3>
                <span className="font-mono tabular-nums text-xs text-slate-600">
                  {dias1 > 0 ? `${dias1} dia(s)` : 'Sem datas'}
                </span>
              </div>
              {(inicio1 || fim1) && (
                <button
                  type="button"
                  onClick={() => {
                    setInicio1('');
                    setFim1('');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>Limpar 1º período</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="campo-inicio-1"
                  className="block text-xs text-slate-600 mb-1"
                >
                  Início – 1º período
                </label>
                <input
                  id="campo-inicio-1"
                  type="date"
                  value={inicio1}
                  onChange={(e) => setInicio1(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>
              <div>
                <label
                  htmlFor="campo-fim-1"
                  className="block text-xs text-slate-600 mb-1"
                >
                  Fim – 1º período
                </label>
                <input
                  id="campo-fim-1"
                  type="date"
                  value={fim1}
                  onChange={(e) => setFim1(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>
            </div>

            {((inicio1 && !inicio1.startsWith('2027-')) ||
              (fim1 && !fim1.startsWith('2027-'))) && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 bg-white border border-slate-200 rounded px-2.5 py-1.5">
                <span>
                  Ano selecionado:{' '}
                  <strong className="font-mono text-slate-900">
                    {(inicio1 || fim1).slice(0, 4)}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (inicio1) setInicio1(`2027-${inicio1.slice(5)}`);
                    if (fim1) setFim1(`2027-${fim1.slice(5)}`);
                  }}
                  className="text-[#1E3A5F] font-medium hover:underline"
                >
                  Ajustar para 2027
                </button>
              </div>
            )}

            {validacaoP1 && (
              <div
                aria-live="polite"
                className={`text-xs px-3 py-2 rounded border flex items-start gap-2 ${
                  validacaoP1.valido
                    ? 'bg-[#FEF9C3] border-[#CA8A04]/40 text-[#422006]'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                {validacaoP1.valido ? (
                  <CheckCircle2 className="w-4 h-4 text-[#A16207] shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <span>{validacaoP1.mensagem}</span>
              </div>
            )}
          </div>

          {/* Period 2 */}
          <div
            className={`p-4 rounded-md border ${
              focusPeriod === 2 ? 'border-[#1E3A5F] bg-slate-50/70' : 'border-slate-200 bg-slate-50/40'
            } space-y-3`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-slate-900">2º Período</h3>
                <span className="font-mono tabular-nums text-xs text-slate-600">
                  {dias2 > 0 ? `${dias2} dia(s)` : 'Sem datas'}
                </span>
              </div>
              {(inicio2 || fim2) && (
                <button
                  type="button"
                  onClick={() => {
                    setInicio2('');
                    setFim2('');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>Limpar 2º período</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="campo-inicio-2"
                  className="block text-xs text-slate-600 mb-1"
                >
                  Início – 2º período
                </label>
                <input
                  id="campo-inicio-2"
                  type="date"
                  value={inicio2}
                  onChange={(e) => setInicio2(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>
              <div>
                <label
                  htmlFor="campo-fim-2"
                  className="block text-xs text-slate-600 mb-1"
                >
                  Fim – 2º período
                </label>
                <input
                  id="campo-fim-2"
                  type="date"
                  value={fim2}
                  onChange={(e) => setFim2(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>
            </div>

            {((inicio2 && !inicio2.startsWith('2027-')) ||
              (fim2 && !fim2.startsWith('2027-'))) && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 bg-white border border-slate-200 rounded px-2.5 py-1.5">
                <span>
                  Ano selecionado:{' '}
                  <strong className="font-mono text-slate-900">
                    {(inicio2 || fim2).slice(0, 4)}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (inicio2) setInicio2(`2027-${inicio2.slice(5)}`);
                    if (fim2) setFim2(`2027-${fim2.slice(5)}`);
                  }}
                  className="text-[#1E3A5F] font-medium hover:underline"
                >
                  Ajustar para 2027
                </button>
              </div>
            )}

            {validacaoP2 && (
              <div
                aria-live="polite"
                className={`text-xs px-3 py-2 rounded border flex items-start gap-2 ${
                  validacaoP2.valido
                    ? 'bg-[#FEF9C3] border-[#CA8A04]/40 text-[#422006]'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                {validacaoP2.valido ? (
                  <CheckCircle2 className="w-4 h-4 text-[#A16207] shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <span>{validacaoP2.mensagem}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-200">
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-600">
                Total programado:{' '}
                <strong className="font-mono tabular-nums text-slate-900">
                  {totalDias} dia(s)
                </strong>
              </span>
              {editingRecord && (
                <button
                  type="button"
                  onClick={() => onRequestDelete(editingRecord)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 hover:text-red-800 hover:bg-red-50 px-2.5 py-1.5 rounded-md transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Excluir servidor</span>
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
                {editingRecord ? 'Salvar Alterações' : 'Cadastrar Férias'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
