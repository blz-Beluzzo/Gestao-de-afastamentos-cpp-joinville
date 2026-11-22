import React, { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Trash2, X } from 'lucide-react';
import type { LancamentoAfastamento } from '../types/ferias';
import { calcularDiasInclusivos, formatarDataBR, formatarLotacao } from '../utils/dateUtils';

export interface PendingMutation {
  tipo: 'create' | 'update' | 'delete';
  registro: LancamentoAfastamento;
  mensagensConflito: string[];
}

interface ConfirmMutationModalProps {
  pending: PendingMutation | null;
  spreadsheetTitle: string | null;
  isSubmitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmMutationModal: React.FC<ConfirmMutationModalProps> = ({
  pending,
  spreadsheetTitle,
  isSubmitting,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!pending) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pending, isSubmitting, onCancel]);

  if (!pending) return null;

  const { tipo, registro, mensagensConflito } = pending;

  const titulo =
    tipo === 'delete'
      ? 'Confirmar exclusão de afastamento'
      : tipo === 'create'
      ? 'Confirmar novo lançamento de afastamento'
      : 'Confirmar alteração de afastamento';

  const destino = spreadsheetTitle
    ? `Planilha Google "${spreadsheetTitle}"`
    : 'Visualização local (prévia interativa)';

  const dias =
    registro.inicio && registro.fim
      ? calcularDiasInclusivos(registro.inicio, registro.fim)
      : 0;

  const periodoTexto =
    registro.inicio && registro.fim
      ? `${formatarDataBR(registro.inicio)} a ${formatarDataBR(registro.fim)} (${dias}d)`
      : 'Não definido';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-mutation-title"
    >
      <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2
            id="confirm-mutation-title"
            className="font-display text-base font-bold text-slate-900"
          >
            {titulo}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="Fechar confirmação"
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-700 leading-relaxed">
            {tipo === 'delete'
              ? 'Esta ação removerá permanentemente o registro selecionado e reavaliará os conflitos de toda a unidade.'
              : 'Revise os dados abaixo antes de gravar a alteração e recalcular todos os conflitos no calendário.'}
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-md p-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Destino</span>
              <span className="font-medium text-slate-900 text-right">{destino}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Servidor</span>
              <span className="font-semibold text-slate-900 text-right">
                {registro.servidor}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Lotação / Cargo</span>
              <span className="text-slate-900 text-right">
                {formatarLotacao(registro.equipe, registro.cargo)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Tipo de Afastamento</span>
              <span className="font-medium text-slate-900 text-right">
                {registro.tipo}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Período</span>
              <span className="font-mono tabular-nums text-slate-900 text-right">
                {periodoTexto}
              </span>
            </div>
          </div>

          {tipo !== 'delete' && mensagensConflito.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3.5 text-xs text-red-900 space-y-1.5">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>Atenção: este registro possui conflito operacional</span>
              </div>
              <ul className="list-disc pl-5 space-y-1">
                {mensagensConflito.map((msg, idx) => (
                  <li key={idx}>{msg}</li>
                ))}
              </ul>
              <p className="text-red-800 pt-1">
                Se confirmar, o período em conflito será destacado em vermelho com alerta explicativo no calendário.
              </p>
            </div>
          )}

          {tipo !== 'delete' && mensagensConflito.length === 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 text-xs text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Nenhuma infração às regras operacionais detectada.</span>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-md transition-colors disabled:opacity-60 ${
              tipo === 'delete'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[#1E3A5F] hover:bg-[#162D4A]'
            }`}
          >
            {tipo === 'delete' && <Trash2 className="w-4 h-4" aria-hidden="true" />}
            <span>
              {isSubmitting
                ? 'Sincronizando...'
                : tipo === 'delete'
                ? 'Confirmar Exclusão'
                : 'Confirmar Gravação'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
