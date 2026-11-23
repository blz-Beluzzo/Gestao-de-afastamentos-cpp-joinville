import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FilePlus2,
  FileSpreadsheet,
  RefreshCw,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { DriveSpreadsheetFile } from '../types/ferias';
import type { EscalaSpreadsheetInfo } from '../services/escalaSheetsService';
import { ESCALA_SPREADSHEET_DEFAULT_TITLE } from '../services/escalaSheetsService';
import { extractSpreadsheetId } from '../services/googleSheetsService';
import { NOMES_MESES_CURTOS } from '../utils/dateUtils';

interface EscalaSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  hasToken: boolean;
  isSigningIn: boolean;
  onSignIn: () => void;
  connectedEscalaSheet: EscalaSpreadsheetInfo | null;
  driveFiles: DriveSpreadsheetFile[];
  isLoadingFiles: boolean;
  isBusySheet: boolean;
  errorMessage: string | null;
  onRefreshDriveFiles: () => void;
  onSelectSpreadsheetId: (spreadsheetId: string) => void;
  onCreateEscalaSpreadsheet: () => void;
  onReloadAllMonths: () => void;
}

export const EscalaSheetsModal: React.FC<EscalaSheetsModalProps> = ({
  isOpen,
  onClose,
  user,
  hasToken,
  isSigningIn,
  onSignIn,
  connectedEscalaSheet,
  driveFiles,
  isLoadingFiles,
  isBusySheet,
  errorMessage,
  onRefreshDriveFiles,
  onSelectSpreadsheetId,
  onCreateEscalaSpreadsheet,
  onReloadAllMonths,
}) => {
  const [linkOrId, setLinkOrId] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLocalError(null);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const id = extractSpreadsheetId(linkOrId);
    if (!id) {
      setLocalError(
        'Link ou ID inválido. Cole o endereço completo do Google Sheets ou o ID da planilha.'
      );
      return;
    }
    onSelectSpreadsheetId(id);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="escala-sheets-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-lg max-w-2xl w-full shadow-xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2
              id="escala-sheets-modal-title"
              className="font-display text-lg font-bold text-slate-900"
            >
              Planilha Exclusiva de Escalas Mensais
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              3ª planilha no Google Drive dedicada ao histórico anual · Salvamento automático por vaga e leitura de todos os meses
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar configuração da planilha de escalas"
            className="p-2 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {(errorMessage || localError) && (
            <div
              role="alert"
              className="bg-red-50 border border-red-200 text-red-900 text-xs px-3.5 py-2.5 rounded-md flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{localError || errorMessage}</span>
            </div>
          )}

          {!user || !hasToken ? (
            <div className="bg-slate-50 border border-slate-200 rounded-md p-6 text-center space-y-4">
              <div className="w-11 h-11 rounded-lg bg-[#1E3A5F]/10 text-[#1E3A5F] flex items-center justify-center mx-auto">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-sm font-semibold text-slate-900">
                  Conecte sua conta Google para vincular a planilha de Escalas Mensais
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Ao conectar a planilha exclusiva{' '}
                  <span className="font-mono text-slate-800">
                    {ESCALA_SPREADSHEET_DEFAULT_TITLE}
                  </span>
                  , todas as abas mensais do ano são carregadas automaticamente e cada convocação preenchida é gravada no Drive na hora.
                </p>
              </div>
              <div className="pt-1 flex justify-center">
                <button
                  type="button"
                  onClick={onSignIn}
                  disabled={isSigningIn}
                  className="gsi-material-button"
                >
                  <div className="gsi-material-button-content-wrapper">
                    <div className="gsi-material-button-icon">
                      <svg
                        version="1.1"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 48 48"
                        style={{ display: 'block' }}
                      >
                        <path
                          fill="#EA4335"
                          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                        />
                        <path
                          fill="#4285F4"
                          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                        />
                        <path
                          fill="#34A853"
                          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                        />
                      </svg>
                    </div>
                    <span>{isSigningIn ? 'Autenticando...' : 'Entrar com Google'}</span>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <>
              {connectedEscalaSheet && (
                <div className="p-4 border border-emerald-200 bg-emerald-50/60 rounded-md space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-emerald-900 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span>
                          Planilha ativa: {connectedEscalaSheet.spreadsheetTitle}
                        </span>
                      </div>
                      <div className="text-xs text-emerald-800">
                        Salvamento automático ativo ·{' '}
                        {connectedEscalaSheet.loadedTabs.length} aba(s) mensal(is) carregada(s)
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={onReloadAllMonths}
                        disabled={isBusySheet}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-emerald-300 text-emerald-900 rounded-md hover:bg-emerald-50 disabled:opacity-60"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${isBusySheet ? 'animate-spin' : ''}`}
                        />
                        <span>Recarregar Meses</span>
                      </button>
                      {connectedEscalaSheet.webViewLink && (
                        <a
                          href={connectedEscalaSheet.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#1E3A5F] text-white rounded-md hover:bg-[#162D4A]"
                        >
                          <span>Abrir no Sheets</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  {connectedEscalaSheet.loadedTabs.length > 0 && (
                    <div className="pt-2 border-t border-emerald-200/80 flex flex-wrap gap-1.5">
                      {connectedEscalaSheet.loadedTabs.map((tab) => (
                        <span
                          key={tab.tabTitle}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-white border border-emerald-200 text-emerald-900"
                        >
                          <span>
                            {NOMES_MESES_CURTOS[tab.mes - 1]}/{tab.ano}
                          </span>
                          <span className="text-emerald-600">
                            ({tab.diasPreenchidos}d)
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-4 p-4 border border-slate-200 rounded-md">
                <div className="space-y-0.5 max-w-md">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Criar Planilha Exclusiva de Escalas no Google Drive
                  </h3>
                  <p className="text-xs text-slate-600">
                    Cria a planilha{' '}
                    <span className="font-mono">{ESCALA_SPREADSHEET_DEFAULT_TITLE}</span>{' '}
                    com uma aba por mês (ex.:{' '}
                    <span className="font-mono">Escala Mai-2027</span>), preservando eventuais lançamentos locais já preenchidos.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onCreateEscalaSpreadsheet}
                  disabled={isBusySheet}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-[#1E3A5F] text-white rounded-md hover:bg-[#162D4A] disabled:opacity-60 whitespace-nowrap shrink-0"
                >
                  <FilePlus2 className="w-4 h-4" />
                  <span>{isBusySheet ? 'Criando...' : 'Criar Planilha'}</span>
                </button>
              </div>

              <form onSubmit={handleLinkSubmit} className="space-y-2">
                <label
                  htmlFor="campo-link-escala-sheets"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Ou vincular planilha de Escalas existente por Link ou ID
                </label>
                <div className="flex gap-2">
                  <input
                    id="campo-link-escala-sheets"
                    type="text"
                    value={linkOrId}
                    onChange={(e) => setLinkOrId(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="flex-1 px-3 py-2 text-xs font-mono border border-slate-300 rounded-md focus:outline-none focus:border-[#1E3A5F]"
                  />
                  <button
                    type="submit"
                    disabled={isBusySheet}
                    className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap shrink-0"
                  >
                    Vincular
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-700">
                    Planilhas no Google Drive
                  </h3>
                  <button
                    type="button"
                    onClick={onRefreshDriveFiles}
                    disabled={isLoadingFiles}
                    className="inline-flex items-center gap-1 text-xs text-[#1E3A5F] hover:underline"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${isLoadingFiles ? 'animate-spin' : ''}`}
                    />
                    <span>Atualizar lista</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-md divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {isLoadingFiles ? (
                    <div className="p-4 text-xs text-slate-500 text-center">
                      Buscando planilhas no Google Drive...
                    </div>
                  ) : driveFiles.length === 0 ? (
                    <div className="p-4 text-xs text-slate-500 text-center">
                      Nenhuma Planilha Google encontrada.
                    </div>
                  ) : (
                    driveFiles.map((file) => {
                      const isSelected =
                        connectedEscalaSheet?.spreadsheetId === file.id;
                      return (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() => onSelectSpreadsheetId(file.id)}
                          disabled={isBusySheet}
                          className={`w-full px-4 py-2.5 text-left flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors ${
                            isSelected ? 'bg-slate-50' : ''
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-slate-900 truncate">
                              {file.name}
                            </div>
                            {file.modifiedTime && (
                              <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                                Atualizada em{' '}
                                {new Date(file.modifiedTime).toLocaleDateString('pt-BR')}
                              </div>
                            )}
                          </div>
                          <span className="text-xs font-medium text-[#1E3A5F] shrink-0">
                            {isSelected ? 'Conectada' : 'Selecionar'}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
