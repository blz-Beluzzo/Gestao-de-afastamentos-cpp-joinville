import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ExternalLink,
  FilePlus2,
  FileSpreadsheet,
  LogOut,
  RefreshCw,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { ConnectedSheetInfo, DriveSpreadsheetFile } from '../types/ferias';
import { extractSpreadsheetId } from '../services/googleSheetsService';

interface SheetsConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  hasToken: boolean;
  isSigningIn: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  connectedSheet: ConnectedSheetInfo | null;
  driveFiles: DriveSpreadsheetFile[];
  isLoadingFiles: boolean;
  isBusySheet: boolean;
  errorMessage: string | null;
  onRefreshDriveFiles: () => void;
  onSelectSpreadsheetId: (spreadsheetId: string, preferredTabTitle?: string) => void;
  onCreateSpreadsheet2027: () => void;
  onReloadConnectedSheet: () => void;
}

export const SheetsConnectModal: React.FC<SheetsConnectModalProps> = ({
  isOpen,
  onClose,
  user,
  hasToken,
  isSigningIn,
  onSignIn,
  onSignOut,
  connectedSheet,
  driveFiles,
  isLoadingFiles,
  isBusySheet,
  errorMessage,
  onRefreshDriveFiles,
  onSelectSpreadsheetId,
  onCreateSpreadsheet2027,
  onReloadConnectedSheet,
}) => {
  const [linkOrId, setLinkOrId] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
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
      aria-labelledby="sheets-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-lg max-w-2xl w-full shadow-xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2
              id="sheets-modal-title"
              className="font-display text-lg font-bold text-slate-900"
            >
              Integração Google Drive e Google Sheets
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Base de dados oficial da delegacia sincronizada diretamente com Planilhas Google
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar configuração de planilha"
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
                  Conecte sua conta Google da unidade
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Autorize o acesso ao Google Drive e Google Sheets para listar planilhas existentes ou criar automaticamente a planilha{' '}
                  <span className="font-mono text-slate-800">
                    Controle_de_Afastamentos_CPP_Joinville
                  </span>{' '}
                  com cabeçalho na linha 1 e coluna própria para tipo de afastamento.
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
                    <span>
                      {isSigningIn ? 'Autenticando...' : 'Entrar com Google'}
                    </span>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Signed in account bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-md">
                <div className="text-xs">
                  <span className="text-slate-500">Conectado como </span>
                  <strong className="text-slate-900">
                    {user.displayName || user.email}
                  </strong>
                  {user.email && user.displayName && (
                    <span className="text-slate-500"> · {user.email}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-red-700 px-2.5 py-1 rounded hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Desconectar</span>
                </button>
              </div>

              {/* Currently connected sheet */}
              {connectedSheet && (
                <div className="p-4 border border-emerald-200 bg-emerald-50/60 rounded-md space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-emerald-900">
                        Planilha ativa: {connectedSheet.spreadsheetTitle}
                      </div>
                      <div className="text-xs text-emerald-800">
                        Aba selecionada:{' '}
                        <span className="font-mono">{connectedSheet.sheetTitle}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={onReloadConnectedSheet}
                        disabled={isBusySheet}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-emerald-300 text-emerald-900 rounded-md hover:bg-emerald-50 disabled:opacity-60"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${isBusySheet ? 'animate-spin' : ''}`}
                        />
                        <span>Sincronizar</span>
                      </button>
                      {connectedSheet.webViewLink && (
                        <a
                          href={connectedSheet.webViewLink}
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

                  {connectedSheet.availableTabs &&
                    connectedSheet.availableTabs.length > 1 && (
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-emerald-200/80">
                        <label
                          htmlFor="seletor-aba-planilha"
                          className="text-xs font-medium text-emerald-900"
                        >
                          Trocar aba da planilha:
                        </label>
                        <select
                          id="seletor-aba-planilha"
                          value={connectedSheet.sheetTitle}
                          onChange={(e) =>
                            onSelectSpreadsheetId(
                              connectedSheet.spreadsheetId,
                              e.target.value
                            )
                          }
                          disabled={isBusySheet}
                          className="px-2.5 py-1 text-xs border border-emerald-300 rounded bg-white text-slate-900 focus:outline-none focus:border-[#1E3A5F]"
                        >
                          {connectedSheet.availableTabs.map((tab) => (
                            <option key={tab.sheetId} value={tab.title}>
                              {tab.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                </div>
              )}

              {/* Create new 2027 spreadsheet */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 border border-slate-200 rounded-md">
                <div className="space-y-0.5 max-w-md">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Criar Planilha de Afastamentos no Google Drive
                  </h3>
                  <p className="text-xs text-slate-600">
                    Gera uma nova planilha com cabeçalho na linha 1 (Equipe, Servidor, Cargo, Tipo de Afastamento, Início, Fim, Dias) e dados a partir da linha 2.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onCreateSpreadsheet2027}
                  disabled={isBusySheet}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-[#1E3A5F] text-white rounded-md hover:bg-[#162D4A] disabled:opacity-60 whitespace-nowrap shrink-0"
                >
                  <FilePlus2 className="w-4 h-4" />
                  <span>
                    {isBusySheet ? 'Criando...' : 'Criar Planilha'}
                  </span>
                </button>
              </div>

              {/* Paste link or ID */}
              <form onSubmit={handleLinkSubmit} className="space-y-2">
                <label
                  htmlFor="campo-link-planilha"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Ou vincular planilha existente por Link ou ID
                </label>
                <div className="flex gap-2">
                  <input
                    id="campo-link-planilha"
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

              {/* Drive spreadsheets list */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-700">
                    Planilhas encontradas no Google Drive
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

                <div className="border border-slate-200 rounded-md divide-y divide-slate-100 max-h-52 overflow-y-auto">
                  {isLoadingFiles ? (
                    <div className="p-4 text-xs text-slate-500 text-center">
                      Buscando planilhas no Google Drive...
                    </div>
                  ) : driveFiles.length === 0 ? (
                    <div className="p-4 text-xs text-slate-500 text-center">
                      Nenhuma Planilha Google encontrada. Crie uma nova planilha acima ou cole um link compartilhado.
                    </div>
                  ) : (
                    driveFiles.map((file) => {
                      const isSelected = connectedSheet?.spreadsheetId === file.id;
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
