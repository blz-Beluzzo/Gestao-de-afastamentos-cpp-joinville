import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  GanttChartSquare,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  CARGOS_LISTA,
  Cargo,
  ConnectedSheetInfo,
  DriveSpreadsheetFile,
  EQUIPES_LISTA,
  Equipe,
  RegistroAvaliado,
  RegistroFerias,
} from './types/ferias';
import { SEED_FERIAS_2027 } from './data/seedFerias2027';
import { ANO_EXERCICIO, extrairAnosDosRegistros } from './utils/dateUtils';
import { avaliarTodosRegistros } from './utils/validarFerias';
import { exportToCSV, exportToStandaloneHTML } from './utils/exportUtils';
import {
  getAccessToken,
  googleSignIn,
  initAuth,
  logout,
} from './services/googleAuth';
import {
  appendSheetRecord,
  createSpreadsheet2027,
  deleteSheetRecord,
  getSpreadsheetMetadata,
  listDriveSpreadsheets,
  readSheetRecords,
  updateSheetRecord,
} from './services/googleSheetsService';
import { ActiveTab, TopBar } from './components/TopBar';
import { AnnualTimeline } from './components/AnnualTimeline';
import { MonthlyCalendar } from './components/MonthlyCalendar';
import { RulesView } from './components/RulesView';
import { VacationModal } from './components/VacationModal';
import {
  ConfirmMutationModal,
  PendingMutation,
} from './components/ConfirmMutationModal';
import { SheetsConnectModal } from './components/SheetsConnectModal';

export default function App() {
  const [registros, setRegistros] = useState<RegistroFerias[]>(SEED_FERIAS_2027);
  const [activeTab, setActiveTab] = useState<ActiveTab>('cronograma');
  const [anoSelecionado, setAnoSelecionado] = useState<number>(ANO_EXERCICIO);

  // Filters
  const [filtroEquipe, setFiltroEquipe] = useState<Equipe | 'Todas'>('Todas');
  const [filtroCargo, setFiltroCargo] = useState<Cargo | 'Todos'>('Todos');
  const [filtroStatus, setFiltroStatus] = useState<'Todos' | 'Conflitos' | 'Validos'>('Todos');
  const [buscaServidor, setBuscaServidor] = useState('');

  // Google Workspace Auth & Sheets state
  const [user, setUser] = useState<User | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [connectedSheet, setConnectedSheet] = useState<ConnectedSheetInfo | null>(null);
  const [driveFiles, setDriveFiles] = useState<DriveSpreadsheetFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isBusySheet, setIsBusySheet] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Modals
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  const [isVacationModalOpen, setIsVacationModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RegistroFerias | null>(null);
  const [focusPeriod, setFocusPeriod] = useState<1 | 2 | undefined>(undefined);
  const [pendingMutation, setPendingMutation] = useState<PendingMutation | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [highlightedRecordId, setHighlightedRecordId] = useState<string | null>(null);
  const [highlightedServidorName, setHighlightedServidorName] = useState<string | null>(
    null
  );

  const LAST_SHEET_STORAGE_KEY = 'cpp_joinville_last_sheet';

  useEffect(() => {
    const unsubscribe = initAuth(
      (loggedUser, token) => {
        setUser(loggedUser);
        setHasToken(Boolean(token));
      },
      (loggedUser) => {
        setUser(loggedUser);
        setHasToken(false);
        setConnectedSheet(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const anosDisponiveis = useMemo(() => {
    const anos = new Set<number>([2026, ANO_EXERCICIO, anoSelecionado]);
    for (const a of extrairAnosDosRegistros(registros)) {
      anos.add(a);
    }
    return Array.from(anos).sort((a, b) => a - b);
  }, [registros, anoSelecionado]);

  const sincronizarAnoParaRegistros = (
    novosRegistros: RegistroFerias[],
    preferencia?: number
  ) => {
    const anosPresentes = extrairAnosDosRegistros(novosRegistros);
    if (anosPresentes.length === 0) return;
    if (preferencia && anosPresentes.includes(preferencia)) {
      setAnoSelecionado(preferencia);
      return;
    }
    if (!anosPresentes.includes(anoSelecionado)) {
      setAnoSelecionado(
        anosPresentes.includes(ANO_EXERCICIO) ? ANO_EXERCICIO : anosPresentes[0]
      );
    }
  };

  // Cascade validation across all records whenever records state changes
  const registrosAvaliados: RegistroAvaliado[] = useMemo(
    () => avaliarTodosRegistros(registros),
    [registros]
  );

  const registrosFiltrados = useMemo(() => {
    const termo = buscaServidor.trim().toLowerCase();
    return registrosAvaliados.filter((reg) => {
      if (filtroEquipe !== 'Todas' && reg.equipe !== filtroEquipe) return false;
      if (filtroCargo !== 'Todos' && reg.cargo !== filtroCargo) return false;
      if (filtroStatus === 'Conflitos' && !reg.temConflito) return false;
      if (filtroStatus === 'Validos' && reg.temConflito) return false;
      if (termo && !reg.servidor.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [registrosAvaliados, filtroEquipe, filtroCargo, filtroStatus, buscaServidor]);

  const kpis = useMemo(() => {
    let periodosValidos = 0;
    let periodosConflito = 0;
    for (const r of registrosAvaliados) {
      if (r.periodo1Avaliado) {
        if (r.periodo1Avaliado.validacao.valido) periodosValidos += 1;
        else periodosConflito += 1;
      }
      if (r.periodo2Avaliado) {
        if (r.periodo2Avaliado.validacao.valido) periodosValidos += 1;
        else periodosConflito += 1;
      }
    }
    return {
      totalServidores: registrosAvaliados.length,
      periodosValidos,
      periodosConflito,
    };
  }, [registrosAvaliados]);

  const loadDriveFiles = async (tokenOverride?: string) => {
    const token = tokenOverride ?? (await getAccessToken());
    if (!token) return;
    setIsLoadingFiles(true);
    setSheetError(null);
    try {
      const files = await listDriveSpreadsheets(token);
      setDriveFiles(files);
    } catch (err: unknown) {
      setSheetError(
        err instanceof Error ? err.message : 'Falha ao listar planilhas do Drive.'
      );
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const getSheetStorageKey = (u?: User | null) =>
    `${LAST_SHEET_STORAGE_KEY}:${(u?.email || u?.uid || 'default').toLowerCase()}`;

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setSheetError(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setHasToken(true);

        // Auto-reconnect only the spreadsheet previously connected by THIS Google account
        let autoLoaded = false;
        try {
          const savedRaw = localStorage.getItem(getSheetStorageKey(res.user));
          if (savedRaw) {
            const saved = JSON.parse(savedRaw) as {
              spreadsheetId?: string;
              sheetTitle?: string;
            };
            if (saved?.spreadsheetId) {
              autoLoaded = await handleSelectSpreadsheet(
                saved.spreadsheetId,
                saved.sheetTitle,
                res.accessToken,
                res.user
              );
            }
          }
        } catch {
          // ignore storage errors
        }

        if (!autoLoaded) {
          setIsSheetsModalOpen(true);
        }
        await loadDriveFiles(res.accessToken);
      }
    } catch (err: unknown) {
      setSheetError(
        err instanceof Error ? err.message : 'Erro ao autenticar com o Google.'
      );
      setIsSheetsModalOpen(true);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setHasToken(false);
    setConnectedSheet(null);
    setDriveFiles([]);
    setRegistros(SEED_FERIAS_2027);
    setAnoSelecionado(ANO_EXERCICIO);
    try {
      localStorage.removeItem(LAST_SHEET_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
    setFeedbackMessage('Desconectado do Google Workspace. Exibindo prévia local.');
  };

  const handleSelectSpreadsheet = async (
    spreadsheetId: string,
    preferredTabTitle?: string,
    tokenOverride?: string,
    userOverride?: User | null
  ): Promise<boolean> => {
    const token = tokenOverride ?? (await getAccessToken());
    if (!token) {
      setSheetError('Token expirado. Entre novamente com sua conta Google.');
      return false;
    }
    setIsBusySheet(true);
    setSheetError(null);
    try {
      const info = await getSpreadsheetMetadata(
        token,
        spreadsheetId,
        preferredTabTitle
      );
      const rows = await readSheetRecords(token, info);
      setConnectedSheet(info);
      setRegistros(rows);
      sincronizarAnoParaRegistros(rows);
      try {
        localStorage.setItem(
          getSheetStorageKey(userOverride ?? user),
          JSON.stringify({
            spreadsheetId: info.spreadsheetId,
            sheetTitle: info.sheetTitle,
          })
        );
      } catch {
        // ignore storage errors
      }
      if (!preferredTabTitle) {
        setIsSheetsModalOpen(false);
      }
      setFeedbackMessage(
        `Planilha "${info.spreadsheetTitle}" (aba "${info.sheetTitle}") carregada com ${rows.length} servidor(es).`
      );
      return true;
    } catch (err: unknown) {
      setSheetError(
        err instanceof Error ? err.message : 'Erro ao abrir a planilha selecionada.'
      );
      return false;
    } finally {
      setIsBusySheet(false);
    }
  };

  const handleCreateSpreadsheet2027 = async () => {
    const token = await getAccessToken();
    if (!token) {
      setSheetError('Token expirado. Entre novamente com sua conta Google.');
      return;
    }
    setIsBusySheet(true);
    setSheetError(null);
    try {
      const { sheetInfo, records } = await createSpreadsheet2027(token, registros);
      setConnectedSheet(sheetInfo);
      setRegistros(records);
      sincronizarAnoParaRegistros(records);
      try {
        localStorage.setItem(
          getSheetStorageKey(user),
          JSON.stringify({
            spreadsheetId: sheetInfo.spreadsheetId,
            sheetTitle: sheetInfo.sheetTitle,
          })
        );
      } catch {
        // ignore storage errors
      }
      setIsSheetsModalOpen(false);
      setFeedbackMessage(
        `Planilha "${sheetInfo.spreadsheetTitle}" criada no Google Drive e sincronizada.`
      );
      await loadDriveFiles(token);
    } catch (err: unknown) {
      setSheetError(
        err instanceof Error ? err.message : 'Erro ao criar a planilha no Google Drive.'
      );
    } finally {
      setIsBusySheet(false);
    }
  };

  const handleReloadConnectedSheet = async () => {
    if (!connectedSheet) return;
    await handleSelectSpreadsheet(
      connectedSheet.spreadsheetId,
      connectedSheet.sheetTitle
    );
  };

  const openEditPeriod = (reg: RegistroAvaliado, periodo?: 1 | 2) => {
    setEditingRecord(reg);
    setFocusPeriod(periodo);
    setIsVacationModalOpen(true);
  };

  const openCreateNew = () => {
    setEditingRecord(null);
    setFocusPeriod(undefined);
    setIsVacationModalOpen(true);
  };

  const handleRequestSave = (record: RegistroFerias, conflictMessages: string[]) => {
    setPendingMutation({
      tipo: editingRecord ? 'update' : 'create',
      registro: record,
      mensagensConflito: conflictMessages,
    });
  };

  const handleRequestDelete = (record: RegistroFerias) => {
    setPendingMutation({
      tipo: 'delete',
      registro: record,
      mensagensConflito: [],
    });
  };

  const executeConfirmedMutation = async () => {
    if (!pendingMutation) return;
    setIsMutating(true);
    setSheetError(null);

    try {
      const { tipo, registro } = pendingMutation;

      if (connectedSheet && hasToken) {
        const token = await getAccessToken();
        if (!token) {
          throw new Error('Sessão Google expirada. Faça login novamente.');
        }

        let updatedRows: RegistroFerias[];
        if (tipo === 'create') {
          updatedRows = await appendSheetRecord(token, connectedSheet, registro);
        } else if (tipo === 'update') {
          updatedRows = await updateSheetRecord(token, connectedSheet, registro);
        } else {
          if (registro.rowIndex && registro.rowIndex >= 1) {
            updatedRows = await deleteSheetRecord(
              token,
              connectedSheet,
              registro.rowIndex
            );
          } else {
            updatedRows = await readSheetRecords(token, connectedSheet);
          }
        }
        setRegistros(updatedRows);
        const anosRegistro =
          tipo === 'delete' ? [] : extrairAnosDosRegistros([registro]);
        sincronizarAnoParaRegistros(updatedRows, anosRegistro[0]);
        if (tipo !== 'delete' && updatedRows.length === 0) {
          setSheetError(
            `O registro de ${registro.servidor} foi gravado na aba "${connectedSheet.sheetTitle}", mas nenhuma linha pôde ser lida de volta. Verifique as colunas da planilha.`
          );
        }
        setFeedbackMessage(
          tipo === 'delete'
            ? `Registro de ${registro.servidor} excluído da planilha (${updatedRows.length} servidor(es) na aba "${connectedSheet.sheetTitle}").`
            : `Alteração de ${registro.servidor} salva no Google Sheets (${updatedRows.length} servidor(es) na aba "${connectedSheet.sheetTitle}").`
        );
      } else {
        // Local interactive preview mode
        let nextRecords: RegistroFerias[];
        if (tipo === 'create') {
          nextRecords = [...registros, registro];
        } else if (tipo === 'update') {
          nextRecords = registros.map((r) => (r.id === registro.id ? registro : r));
        } else {
          nextRecords = registros.filter((r) => r.id !== registro.id);
        }
        setRegistros(nextRecords);
        const anosRegistro =
          tipo === 'delete' ? [] : extrairAnosDosRegistros([registro]);
        sincronizarAnoParaRegistros(nextRecords, anosRegistro[0]);
        setFeedbackMessage(
          tipo === 'delete'
            ? `Registro de ${registro.servidor} removido na prévia local e escala reavaliada.`
            : `Lançamento de ${registro.servidor} atualizado na prévia local e escala reavaliada.`
        );
      }

      // Ensure newly created or edited officers are never hidden by active filters
      if (tipo === 'create' || tipo === 'update') {
        setFiltroEquipe('Todas');
        setFiltroCargo('Todos');
        setFiltroStatus('Todos');
        setBuscaServidor('');
        if (activeTab === 'regras' && tipo === 'create') {
          setActiveTab('cronograma');
        }
        setHighlightedRecordId(registro.id);
        setHighlightedServidorName(registro.servidor);
        setTimeout(() => {
          setHighlightedRecordId(null);
          setHighlightedServidorName(null);
        }, 4500);
      }

      setPendingMutation(null);
      setIsVacationModalOpen(false);
    } catch (err: unknown) {
      setSheetError(
        err instanceof Error ? err.message : 'Falha ao sincronizar alteração.'
      );
      setPendingMutation(null);
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      <TopBar
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onOpenSheetsModal={() => {
          setIsSheetsModalOpen(true);
          if (hasToken) void loadDriveFiles();
        }}
        user={user}
        hasToken={hasToken}
        connectedSheet={connectedSheet}
        onQuickSignIn={handleSignIn}
        isSigningIn={isSigningIn}
      />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Page title & workspace context */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight text-balance">
              Programação de Férias — CPP Joinville (2027)
            </h1>
            <p className="text-xs sm:text-sm text-slate-600">
              {connectedSheet ? (
                <>
                  Sincronizado com Google Sheets:{' '}
                  <strong className="font-medium text-slate-900">
                    {connectedSheet.spreadsheetTitle}
                  </strong>{' '}
                  · Aba <span className="font-mono">{connectedSheet.sheetTitle}</span>
                </>
              ) : (
                <>
                  Prévia interativa carregada com os 20 servidores da unidade ·{' '}
                  <button
                    type="button"
                    onClick={() => setIsSheetsModalOpen(true)}
                    className="text-[#1E3A5F] font-medium hover:underline"
                  >
                    Vincular Planilha no Google Drive
                  </button>
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {connectedSheet && hasToken && (
              <button
                type="button"
                onClick={handleReloadConnectedSheet}
                disabled={isBusySheet}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#1E3A5F] bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-60 transition-colors whitespace-nowrap"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isBusySheet ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span>{isBusySheet ? 'Sincronizando...' : 'Sincronizar Planilha'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => exportToCSV(registrosAvaliados)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Exportar CSV</span>
            </button>
            <button
              type="button"
              onClick={() => exportToStandaloneHTML(registrosAvaliados)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Relatório HTML</span>
            </button>
            <button
              type="button"
              onClick={openCreateNew}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] rounded-md hover:bg-[#162D4A] transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Novo Período</span>
            </button>
          </div>
        </div>

        {/* Feedback / error banners */}
        {feedbackMessage && (
          <div className="bg-white border border-slate-200 rounded-md px-4 py-2.5 flex items-center justify-between gap-4 text-xs text-slate-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{feedbackMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackMessage(null)}
              className="text-slate-500 hover:text-slate-900 font-medium"
            >
              Fechar
            </button>
          </div>
        )}

        {sheetError && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 rounded-md px-4 py-2.5 flex items-center justify-between gap-4 text-xs text-red-900"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{sheetError}</span>
            </div>
            <button
              type="button"
              onClick={() => setSheetError(null)}
              className="text-red-800 hover:underline font-medium"
            >
              Fechar
            </button>
          </div>
        )}

        {/* 4-column summary KPI strip */}
        <section
          aria-label="Indicadores da programação"
          className="grid grid-cols-2 lg:grid-cols-4 gap-3"
        >
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
            <div className="text-xs text-slate-500">Servidores na Escala</div>
            <div className="mt-1 font-mono tabular-nums text-xl font-bold text-slate-900">
              {kpis.totalServidores}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
            <div className="text-xs text-slate-500">Períodos Válidos (Amarelo)</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono tabular-nums text-xl font-bold text-[#854D0E]">
                {kpis.periodosValidos}
              </span>
              <span className="inline-block w-3 h-3 rounded-sm bg-[#FACC15] border border-[#CA8A04]" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
            <div className="text-xs text-slate-500">Períodos em Conflito (Vermelho)</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono tabular-nums text-xl font-bold text-[#991B1B]">
                {kpis.periodosConflito}
              </span>
              {kpis.periodosConflito > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('regras')}
                  className="text-xs text-red-700 hover:underline font-medium"
                >
                  Ver detalhes
                </button>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
            <div className="text-xs text-slate-500">Base de Dados</div>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <span className="text-sm font-semibold text-slate-900">
                {connectedSheet ? 'Google Sheets' : 'Prévia Local'}
              </span>
              <button
                type="button"
                onClick={() => setIsSheetsModalOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#1E3A5F] hover:underline shrink-0"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{connectedSheet ? 'Trocar' : 'Conectar'}</span>
              </button>
            </div>
          </div>
        </section>

        {/* Workspace toolbar: view toggle + filters */}
        <section
          aria-label="Filtros e visualização"
          className="bg-white border border-slate-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            <button
              type="button"
              onClick={() => setActiveTab('cronograma')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                activeTab === 'cronograma'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GanttChartSquare className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Cronograma Anual</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('mensal')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                activeTab === 'mensal'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Calendário Mensal</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 flex-1 justify-end">
            <div className="relative min-w-[190px] flex-1 max-w-[260px]">
              <Search
                className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={buscaServidor}
                onChange={(e) => setBuscaServidor(e.target.value)}
                placeholder="Buscar servidor..."
                aria-label="Buscar servidor por nome"
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:border-[#1E3A5F]"
              />
            </div>

            <select
              value={filtroEquipe}
              onChange={(e) => setFiltroEquipe(e.target.value as Equipe | 'Todas')}
              aria-label="Filtrar por equipe"
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-800 focus:outline-none focus:border-[#1E3A5F]"
            >
              <option value="Todas">Todas as equipes</option>
              {EQUIPES_LISTA.map((eq) => (
                <option key={eq} value={eq}>
                  Equipe {eq}
                </option>
              ))}
            </select>

            <select
              value={filtroCargo}
              onChange={(e) => setFiltroCargo(e.target.value as Cargo | 'Todos')}
              aria-label="Filtrar por cargo"
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-800 focus:outline-none focus:border-[#1E3A5F]"
            >
              <option value="Todos">Todos os cargos</option>
              {CARGOS_LISTA.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={anoSelecionado}
              onChange={(e) => setAnoSelecionado(Number(e.target.value))}
              aria-label="Ano do cronograma"
              className="px-3 py-1.5 text-xs font-mono font-medium border border-slate-300 rounded-md bg-white text-slate-800 focus:outline-none focus:border-[#1E3A5F]"
            >
              {anosDisponiveis.map((ano) => (
                <option key={ano} value={ano}>
                  Ano {ano}
                </option>
              ))}
            </select>

            <select
              value={filtroStatus}
              onChange={(e) =>
                setFiltroStatus(e.target.value as 'Todos' | 'Conflitos' | 'Validos')
              }
              aria-label="Filtrar por situação"
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-800 focus:outline-none focus:border-[#1E3A5F]"
            >
              <option value="Todos">Todas as situações</option>
              <option value="Conflitos">Apenas conflitos</option>
              <option value="Validos">Apenas regulares</option>
            </select>
          </div>
        </section>

        {/* Legend bar + active filter count indicator */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600 px-1">
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex items-center gap-2">
              <span className="inline-block w-4 h-3 rounded-sm bg-[#FACC15] border border-[#CA8A04]" />
              <span>Período válido (regular)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-4 h-3 rounded-sm bg-[#FEE2E2] border border-[#DC2626]" />
              <span>Período em conflito (passe o cursor para detalhes)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-4 h-3 rounded-sm bg-vedado-hatch border border-slate-300" />
              <span>Meses vedados (Jan, Fev e Dez)</span>
            </div>
          </div>

          {(filtroEquipe !== 'Todas' ||
            filtroCargo !== 'Todos' ||
            filtroStatus !== 'Todos' ||
            buscaServidor.trim() !== '') && (
            <div className="flex items-center gap-2 text-xs text-slate-700">
              <span className="font-mono tabular-nums">
                Exibindo {registrosFiltrados.length} de {registrosAvaliados.length} servidor(es)
              </span>
              <button
                type="button"
                onClick={() => {
                  setFiltroEquipe('Todas');
                  setFiltroCargo('Todos');
                  setFiltroStatus('Todos');
                  setBuscaServidor('');
                }}
                className="text-[#1E3A5F] font-medium hover:underline"
              >
                Limpar filtros
              </button>
            </div>
          )}
        </div>

        {/* Active View */}
        {activeTab === 'cronograma' && (
          <AnnualTimeline
            registros={registrosFiltrados}
            ano={anoSelecionado}
            onSelectAno={setAnoSelecionado}
            highlightedRecordId={highlightedRecordId}
            highlightedServidorName={highlightedServidorName}
            onEditPeriod={openEditPeriod}
            onCreateNew={openCreateNew}
          />
        )}

        {activeTab === 'mensal' && (
          <MonthlyCalendar
            registros={registrosFiltrados}
            ano={anoSelecionado}
            onSelectAno={setAnoSelecionado}
            onEditPeriod={openEditPeriod}
          />
        )}

        {activeTab === 'regras' && (
          <RulesView registros={registrosAvaliados} onEditPeriod={openEditPeriod} />
        )}
      </main>

      <VacationModal
        isOpen={isVacationModalOpen}
        editingRecord={editingRecord}
        focusPeriod={focusPeriod}
        allRecords={registros}
        onClose={() => setIsVacationModalOpen(false)}
        onRequestSave={handleRequestSave}
        onRequestDelete={handleRequestDelete}
      />

      <ConfirmMutationModal
        pending={pendingMutation}
        spreadsheetTitle={connectedSheet?.spreadsheetTitle ?? null}
        isSubmitting={isMutating}
        onConfirm={executeConfirmedMutation}
        onCancel={() => setPendingMutation(null)}
      />

      <SheetsConnectModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        user={user}
        hasToken={hasToken}
        isSigningIn={isSigningIn}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        connectedSheet={connectedSheet}
        driveFiles={driveFiles}
        isLoadingFiles={isLoadingFiles}
        isBusySheet={isBusySheet}
        errorMessage={sheetError}
        onRefreshDriveFiles={() => loadDriveFiles()}
        onSelectSpreadsheetId={handleSelectSpreadsheet}
        onCreateSpreadsheet2027={handleCreateSpreadsheet2027}
        onReloadConnectedSheet={handleReloadConnectedSheet}
      />
    </div>
  );
}
