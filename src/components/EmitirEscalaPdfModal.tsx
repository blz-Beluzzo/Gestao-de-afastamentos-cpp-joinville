import React, { useEffect, useState } from 'react';
import { AlertCircle, FileDown, FileText, X } from 'lucide-react';
import { NOMES_MESES_COMPLETOS } from '../utils/dateUtils';
import {
  ASSINATURA_DIGITAL_SELO,
  COORDENADOR_TITULO_INSTITUCIONAL,
  formatarDataAssinaturaJoinville,
} from '../utils/escalaMensalUtils';

interface EmitirEscalaPdfModalProps {
  isOpen: boolean;
  ano: number;
  mes: number;
  defaultCoordenadorNome: string;
  onClose: () => void;
  onEmitPdf: (nomeCoordenador: string) => void;
}

export const EmitirEscalaPdfModal: React.FC<EmitirEscalaPdfModalProps> = ({
  isOpen,
  ano,
  mes,
  defaultCoordenadorNome,
  onClose,
  onEmitPdf,
}) => {
  const [nomeCoordenador, setNomeCoordenador] = useState(defaultCoordenadorNome);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setNomeCoordenador(defaultCoordenadorNome);
    setErro(null);
  }, [isOpen, defaultCoordenadorNome]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const mesNome = NOMES_MESES_COMPLETOS[mes - 1] ?? String(mes);
  const dataAutomatica = formatarDataAssinaturaJoinville();
  const nomePreview = nomeCoordenador.trim() || '[NOME DO DELEGADO]';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const limpo = nomeCoordenador.trim();
    if (!limpo) {
      setErro(
        'Informe o nome do Delegado Coordenador responsável por assinar a escala.'
      );
      return;
    }
    onEmitPdf(limpo);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="emitir-pdf-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full shadow-xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-[#1E3A5F]/10 text-[#1E3A5F] flex items-center justify-center">
              <FileText className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="emitir-pdf-modal-title"
                className="font-display text-base font-bold text-slate-900"
              >
                Emitir Escala Mensal em PDF
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                CRPP Joinville · {mesNome}/{ano}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar emissão de PDF"
            className="p-2 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {erro && (
            <div
              role="alert"
              className="bg-red-50 border border-red-200 text-red-900 text-xs px-3 py-2 rounded-md flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{erro}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="input-delegado-coordenador"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Nome do Delegado Coordenador
            </label>
            <input
              id="input-delegado-coordenador"
              type="text"
              autoFocus
              value={nomeCoordenador}
              onChange={(e) => {
                setNomeCoordenador(e.target.value);
                if (erro) setErro(null);
              }}
              placeholder="Ex.: Fábio Fortes"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:border-[#1E3A5F]"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              O nome informado constará abaixo da escala autorizando o plantão, com data automática de emissão.
            </p>
          </div>

          {/* Institutional signature block preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-2">
            <div className="text-[11px] font-medium text-slate-500">
              Pré-visualização da assinatura no PDF
            </div>
            <div className="bg-white border border-slate-200 rounded p-3 flex flex-wrap items-start gap-4 text-xs text-slate-900">
              <div className="font-semibold font-mono tabular-nums whitespace-nowrap">
                {dataAutomatica}
              </div>
              <div className="flex-1 text-center leading-snug min-w-[190px]">
                <div className="font-bold text-slate-900">{nomePreview}</div>
                <div className="font-bold text-slate-800">
                  {COORDENADOR_TITULO_INSTITUCIONAL}
                </div>
                <div className="text-[11px] text-slate-600">
                  {ASSINATURA_DIGITAL_SELO}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] rounded-md hover:bg-[#162D4A]"
            >
              <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Emitir PDF</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
