import React, { useEffect } from 'react';
import { FileSpreadsheet, Trash2, X } from 'lucide-react';
import type { DelegadoConvocavel } from '../types/escala';

export type PendingEscalaOrDelegadoMutation =
  | {
      kind: 'delegado';
      action: 'create' | 'update' | 'delete';
      delegado: DelegadoConvocavel;
      spreadsheetTitle: string | null;
      sheetTitle: string | null;
    }
  | {
      kind: 'saveEscala';
      ano: number;
      mesNome: string;
      tabTitle: string;
      spreadsheetTitle: string;
      totalDias: number;
      totalPreenchidos: number;
    };

interface ConfirmDelegadoOrEscalaModalProps {
  pending: PendingEscalaOrDelegadoMutation | null;
  isSubmitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDelegadoOrEscalaModal: React.FC<
  ConfirmDelegadoOrEscalaModalProps
> = ({ pending, isSubmitting, onConfirm, onCancel }) => {
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

  const isDelete = pending.kind === 'delegado' && pending.action === 'delete';

  let title = '';
  let description = '';
  if (pending.kind === 'delegado') {
    if (pending.action === 'delete') {
      title = 'Confirmar remoção de delegado';
      description =
        'Este delegado será removido da lista de convocação oficial.';
    } else if (pending.action === 'create') {
      title = 'Confirmar cadastro de delegado';
      description =
        'Revise os dados abaixo antes de gravar o delegado na planilha.';
    } else {
      title = 'Confirmar atualização de delegado';
      description =
        'Revise as alterações abaixo antes de atualizar o cadastro do delegado.';
    }
  } else {
    title = `Gravar Escala de ${pending.mesNome}/${pending.ano} no Google Sheets`;
    description = `Será criada ou atualizada a aba "${pending.tabTitle}" na planilha "${pending.spreadsheetTitle}" com a tabela completa de 24x72 e convocações.`;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-escala-mutation-title"
    >
      <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2
            id="confirm-escala-mutation-title"
            className="font-display text-base font-bold text-slate-900"
          >
            {title}
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
          <p className="text-sm text-slate-700 leading-relaxed">{description}</p>

          {pending.kind === 'delegado' ? (
            <div className="bg-slate-50 border border-slate-200 rounded-md p-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Destino</span>
                <span className="font-medium text-slate-900 text-right">
                  {pending.spreadsheetTitle
                    ? `Planilha "${pending.spreadsheetTitle}" (${pending.sheetTitle})`
                    : 'Lista local (prévia)'}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Delegado</span>
                <span className="font-semibold text-slate-900 text-right">
                  {pending.delegado.nome}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Delegacia de Origem</span>
                <span className="text-slate-900 text-right">
                  {pending.delegado.delegacia}
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-md p-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Planilha</span>
                <span className="font-medium text-slate-900 text-right">
                  {pending.spreadsheetTitle}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Aba de Destino</span>
                <span className="font-mono text-slate-900 text-right">
                  {pending.tabTitle}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Dias na Escala</span>
                <span className="font-mono tabular-nums text-slate-900 text-right">
                  {pending.totalDias} dias
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Turnos Preenchidos</span>
                <span className="font-mono tabular-nums text-slate-900 text-right">
                  {pending.totalPreenchidos}
                </span>
              </div>
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
              isDelete
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[#1E3A5F] hover:bg-[#162D4A]'
            }`}
          >
            {isDelete ? (
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
            )}
            <span>
              {isSubmitting
                ? 'Sincronizando...'
                : isDelete
                ? 'Confirmar Remoção'
                : 'Confirmar Gravação'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
