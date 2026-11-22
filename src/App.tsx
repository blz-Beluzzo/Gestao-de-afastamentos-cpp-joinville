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
  LancamentoAfastamento,
  LancamentoAvaliado,
  ServidorAgrupado,
  TIPOS_AFASTAMENTO_LISTA,
  TipoAfastamento,
} from './types/ferias';
import { SEED_FERIAS_2027 } from './data/seedFerias2027';
import { ANO_EXERCICIO, ehTerceirizado, extrairAnosDosRegistros } from './utils/dateUtils';
import { getLeaveVisualStyle } from './utils/leaveStyles';
import { agruparPorServidor, avaliarTodosLancamentos } from './utils/validarFerias';
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
  const [lancamentos, setLancamentos] = useState<LancamentoAfastamento[]>(SEED_FERIAS_2027);
  const [activeTab, setActiveTab] = useState<ActiveTab>('cronograma');
  const [anoSelecionado, setAnoSelecionado] = useState<number>(ANO_EXERCICIO);

  // Filters
  const [filtroEquipe, setFiltroEquipe] = useState<Equipe | 'Todas'>('Todas');
  const [filtroCargo, setFiltroCargo] = useState<Cargo | 'Todos'>('Todos');
  const [filtroTipo, setFiltroTipo] = useState<TipoAfastamento | 'Todos'>('Todos');
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
  const [editingRecord, setEditingRecord] = useState<LancamentoAfastamento | null>(null);
  const [prefillOfficer, setPrefillOfficer] = useState<{
    servidor: string;
    equipe: Equipe;
    cargo: Cargo;
  } | null>(null);
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
    for (const a of extrairAnosDosRegistros(lancamentos)) {
      anos.add(a);
    }
    return Array.from(anos).sort((a, b) => a - b);
  }, [lancamentos, anoSelecionado]);

  const sincronizarAnoParaRegistros = (
    novosRegistros: LancamentoAfastamento[],
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

  // Cascade validation across all leave entries whenever list changes
  const lancamentosAvaliados: LancamentoAvaliado[] = useMemo(
    () => avaliarTodosLancamentos(lancamentos),
    [lancamentos]
  );

  const lancamentosFiltrados = useMemo(() => {
    const termo = buscaServidor.trim().toLowerCase();
    return lancamentosAvaliados.filter((reg) => {
      if (filtroEquipe !== 'Todas' && reg.equipe !== filtroEquipe) return false;
      if (filtroCargo !== 'Todos' && reg.cargo !== filtroCargo) return false;
      if (filtroTipo !== 'Todos' && reg.tipo !== filtroTipo) return false;
      if (filtroStatus === 'Conflitos' && reg.validacao.valido) return false;
      if (filtroStatus === 'Validos' && !reg.validacao.valido) return false;
      if (termo && !reg.servidor.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [
    lancamentosAvaliados,
    filtroEquipe,
    filtroCargo,
    filtroTipo,
    filtroStatus,
    buscaServidor,
  ]);

  const servidoresAgrupados: ServidorAgrupado[] = useMemo(
    () => agruparPorServidor(lancamentosFiltrados),
    [lancamentosFiltrados]
  );

  const servidoresPoliciais: ServidorAgrupado[] = useMemo(
    () => servidoresAgrupados.filter((s) => !ehTerceirizado(s.equipe, s.cargo)),
    [servidoresAgrupados]
  );

  const servidoresTerceirizados: ServidorAgrupado[] = useMemo(
    () => servidoresAgrupados.filter((s) => ehTerceirizado(s.equipe, s.cargo)),
    [servidoresAgrupados]
  );

  const totalServidoresUnicos = useMemo(
    () => agruparPorServidor(lancamentosAvaliados).length,
    [lancamentosAvaliados]
  );

  const kpis = useMemo(() => {
    let periodosValidos = 0;
    let periodosConflito = 0;
    for (const r of lancamentosAvaliados) {
      if (r.validacao.valido) periodosValidos += 1;
      else periodosConflito += 1;
    }
    return {
      totalServidores: totalServidoresUnicos,
      periodosValidos,
      periodosConflito,
    };
  }, [lancamentosAvaliados, totalServidoresUnicos]);

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
    setLancamentos(SEED_FERIAS_2027);
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
      setLancamentos(rows);
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
        `Planilha "${info.spreadsheetTitle}" (aba "${info.sheetTitle}") carregada com ${rows.length} afastamento(s).`
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
      const { sheetInfo, records } = await createSpreadsheet2027(token, lancamentos);
      setConnectedSheet(sheetInfo);
      setLancamentos(records);
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

  const openEditLancamento = (lanc: LancamentoAfastamento) => {
    setEditingRecord(lanc);
    setPrefillOfficer(null);
    setIsVacationModalOpen(true);
  };

  const openCreateNew = () => {
    setEditingRecord(null);
    setPrefillOfficer(null);
    setIsVacationModalOpen(true);
  };

  const openCreateNewTerceirizado = () => {
    setEditingRecord(null);
    setPrefillOfficer({
      servidor: '',
      equipe: 'Terceirizado',
      cargo: 'Terceirizado',
    });
    setIsVacationModalOpen(true);
  };

  const openCreateNewForOfficer = (officer: {
    servidor: string;
    equipe: Equipe;
    cargo: Cargo;
  }) => {
    setEditingRecord(null);
    setPrefillOfficer({
      servidor: officer.servidor,
      equipe: officer.equipe,
      cargo: officer.cargo,
    });
    setIsVacationModalOpen(true);
  };

  const handleRequestSave = (
    record: LancamentoAfastamento,
    conflictMessages: string[]
  ) => {
    setPendingMutation({
      tipo: editingRecord ? 'update' : 'create',
      registro: record,
      mensagensConflito: conflictMessages,
    });
  };

  const handleRequestDelete = (record: LancamentoAfastamento) => {
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

        let updatedRows: LancamentoAfastamento[];
        if (tipo === 'create') {
          updatedRows = await appendSheetRecord(token, connectedSheet, registro);
        } else if (tipo === 'update') {
          updatedRows = await updateSheetRecord(token, connectedSheet, registro);
        } else {
          updatedRows = await deleteSheetRecord(token, connectedSheet, registro);
        }
        setLancamentos(updatedRows);
        const anosRegistro =
          tipo === 'delete' ? [] : extrairAnosDosRegistros([registro]);
        sincronizarAnoParaRegistros(updatedRows, anosRegistro[0]);
        if (tipo !== 'delete' && updatedRows.length === 0) {
          setSheetError(
            `O lançamento de ${registro.servidor} foi gravado na aba "${connectedSheet.sheetTitle}", mas nenhuma linha pôde ser lida de volta. Verifique as colunas a partir da linha 2.`
          );
        }
        setFeedbackMessage(
          tipo === 'delete'
            ? `Afastamento de ${registro.servidor} excluído da planilha (${updatedRows.length} lançamento(s) na aba "${connectedSheet.sheetTitle}").`
            : `Lançamento (${registro.tipo}) de ${registro.servidor} salvo no Google Sheets (${updatedRows.length} lançamento(s) na aba "${connectedSheet.sheetTitle}").`
        );
      } else {
        // Local interactive preview mode
        let nextRecords: LancamentoAfastamento[];
        if (tipo === 'create') {
          nextRecords = [...lancamentos, registro];
        } else if (tipo === 'update') {
          nextRecords = lancamentos.map((r) => (r.id === registro.id ? registro : r));
        } else {
          nextRecords = lancamentos.filter((r) => r.id !== registro.id);
        }
        setLancamentos(nextRecords);
        const anosRegistro =
          tipo === 'delete' ? [] : extrairAnosDosRegistros([registro]);
        sincronizarAnoParaRegistros(nextRecords, anosRegistro[0]);
        setFeedbackMessage(
          tipo === 'delete'
            ? `Afastamento de ${registro.servidor} removido na prévia local e escala reavaliada.`
            : `Lançamento (${registro.tipo}) de ${registro.servidor} atualizado na prévia local e escala reavaliada.`
        );
      }

      if (tipo === 'create' || tipo === 'update') {
        setFiltroEquipe('Todas');
        setFiltroCargo('Todos');
        setFiltroTipo('Todos');
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

  const hasActiveFilters =
    filtroEquipe !== 'Todas' ||
    filtroCargo !== 'Todos' ||
    filtroTipo !== 'Todos' ||
    filtroStatus !== 'Todos' ||
    buscaServidor.trim() !== '';

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
              Controle de Afastamentos - CPP Joinville
            </h1>
            <p className="text-xs sm:text-sm text-slate-600">
              {connectedSheet ? (
                <>
                  Sincronizado com Google Sheets:{' '}
                  <strong className="font-medium text-slate-900">
                    {connectedSheet.spreadsheetTitle}
                  </strong>{' '}
                  · Aba <span className="font-mono">{connectedSheet.sheetTitle}</span> (leitura a partir da linha 2)
                </>
              ) : (
                <>
                  Prévia interativa carregada com {totalServidoresUnicos} servidores da unidade ·{' '}
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
              onClick={() => exportToCSV(lancamentosAvaliados)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Exportar CSV</span>
            </button>
            <button
              type="button"
              onClick={() => exportToStandaloneHTML(lancamentosAvaliados)}
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
              <span>Novo Afastamento</span>
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
            <div className="text-xs text-slate-500">Afastamentos Regulares</div>
            <div className="mt-1 font-mono tabular-nums text-xl font-bold text-slate-900">
              {kpis.periodosValidos}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
            <div className="text-xs text-slate-500">Afastamentos em Conflito</div>
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

          <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
            <div className="relative min-w-[170px] flex-1 max-w-[230px]">
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
              value={filtroTipo}
              onChange={(e) =>
                setFiltroTipo(e.target.value as TipoAfastamento | 'Todos')
              }
              aria-label="Filtrar por tipo de afastamento"
              className="max-w-[195px] px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-800 focus:outline-none focus:border-[#1E3A5F]"
            >
              <option value="Todos">Todos os tipos</option>
              {TIPOS_AFASTAMENTO_LISTA.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <select
              value={filtroEquipe}
              onChange={(e) => setFiltroEquipe(e.target.value as Equipe | 'Todas')}
              aria-label="Filtrar por equipe"
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-800 focus:outline-none focus:border-[#1E3A5F]"
            >
              <option value="Todas">Todas as equipes</option>
              {EQUIPES_LISTA.map((eq) => (
                <option key={eq} value={eq}>
                  {eq === 'Terceirizado' ? 'Terceirizados' : `Equipe ${eq}`}
                </option>
              ))}
            </select>

            <select
              value={filtroCargo}
              onChange={(e) => setFiltroCargo(e.target.value as Cargo | 'Todos')}
              aria-label="Filtrar por cargo"
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-800 focus:outline-none focus:border-[#1E3A5F]"
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
              className="px-2.5 py-1.5 text-xs font-mono font-medium border border-slate-300 rounded-md bg-white text-slate-800 focus:outline-none focus:border-[#1E3A5F]"
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
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-800 focus:outline-none focus:border-[#1E3A5F]"
            >
              <option value="Todos">Todas as situações</option>
              <option value="Conflitos">Apenas conflitos</option>
              <option value="Validos">Apenas regulares</option>
            </select>
          </div>
        </section>

        {/* Legend bar + active filter count indicator */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600 px-1">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {TIPOS_AFASTAMENTO_LISTA.map((tipo) => {
              const st = getLeaveVisualStyle(tipo);
              return (
                <div key={tipo} className="flex items-center gap-2">
                  <span
                    className={`inline-block w-4 h-3 rounded-sm border ${st.swatchClass}`}
                  />
                  <span>{st.label}</span>
                </div>
              );
            })}
            <div className="flex items-center gap-2">
              <span className="inline-block w-4 h-3 rounded-sm bg-[#FEE2E2] border border-[#DC2626]" />
              <span>Conflito operacional</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-4 h-3 rounded-sm bg-vedado-hatch border border-slate-300" />
              <span>Meses vedados p/ férias (Jan, Fev e Dez)</span>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex items-center gap-2 text-xs text-slate-700">
              <span className="font-mono tabular-nums">
                Exibindo {servidoresAgrupados.length} de {totalServidoresUnicos} servidor(es)
              </span>
              <button
                type="button"
                onClick={() => {
                  setFiltroEquipe('Todas');
                  setFiltroCargo('Todos');
                  setFiltroTipo('Todos');
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
          <div className="space-y-6">
            {filtroEquipe === 'Terceirizado' ? (
              <AnnualTimeline
                registros={servidoresTerceirizados}
                ano={anoSelecionado}
                title="Terceirizados"
                sectionAriaLabel="Cronograma de terceirizados"
                emptyTitle="Nenhum terceirizado encontrado com os filtros selecionados."
                emptySubtitle="Ajuste os filtros ou cadastre um novo afastamento na equipe Terceirizado."
                emptyActionLabel="Cadastrar Terceirizado"
                onSelectAno={setAnoSelecionado}
                highlightedRecordId={highlightedRecordId}
                highlightedServidorName={highlightedServidorName}
                onEditLancamento={openEditLancamento}
                onCreateNewForOfficer={openCreateNewForOfficer}
                onCreateNew={openCreateNewTerceirizado}
              />
            ) : servidoresPoliciais.length === 0 && servidoresTerceirizados.length === 0 ? (
              <AnnualTimeline
                registros={[]}
                ano={anoSelecionado}
                title="Servidor / Lotação"
                sectionAriaLabel="Cronograma anual"
                onSelectAno={setAnoSelecionado}
                highlightedRecordId={highlightedRecordId}
                highlightedServidorName={highlightedServidorName}
                onEditLancamento={openEditLancamento}
                onCreateNewForOfficer={openCreateNewForOfficer}
                onCreateNew={openCreateNew}
              />
            ) : (
              <>
                {(servidoresPoliciais.length > 0 || !hasActiveFilters) && (
                  <AnnualTimeline
                    registros={servidoresPoliciais}
                    ano={anoSelecionado}
                    title="Servidor / Lotação"
                    sectionAriaLabel="Cronograma de servidores policiais"
                    onSelectAno={setAnoSelecionado}
                    highlightedRecordId={highlightedRecordId}
                    highlightedServidorName={highlightedServidorName}
                    onEditLancamento={openEditLancamento}
                    onCreateNewForOfficer={openCreateNewForOfficer}
                    onCreateNew={openCreateNew}
                  />
                )}

                {(servidoresTerceirizados.length > 0 ||
                  (!hasActiveFilters &&
                    filtroEquipe === 'Todas' &&
                    filtroCargo === 'Todos')) && (
                  <AnnualTimeline
                    registros={servidoresTerceirizados}
                    ano={anoSelecionado}
                    title="Terceirizados"
                    sectionAriaLabel="Cronograma de terceirizados"
                    emptyTitle="Nenhum terceirizado cadastrado."
                    emptySubtitle="Cadastre um colaborador na equipe Terceirizado para acompanhar seus afastamentos nesta seção."
                    emptyActionLabel="Cadastrar Terceirizado"
                    onSelectAno={setAnoSelecionado}
                    highlightedRecordId={highlightedRecordId}
                    highlightedServidorName={highlightedServidorName}
                    onEditLancamento={openEditLancamento}
                    onCreateNewForOfficer={openCreateNewForOfficer}
                    onCreateNew={openCreateNewTerceirizado}
                  />
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'mensal' && (
          <MonthlyCalendar
            lancamentos={lancamentosFiltrados}
            ano={anoSelecionado}
            onSelectAno={setAnoSelecionado}
            onEditLancamento={openEditLancamento}
          />
        )}

        {activeTab === 'regras' && (
          <RulesView
            lancamentos={lancamentosAvaliados}
            onEditLancamento={openEditLancamento}
          />
        )}
      </main>

      <VacationModal
        isOpen={isVacationModalOpen}
        editingRecord={editingRecord}
        prefillOfficer={prefillOfficer}
        allRecords={lancamentos}
        onClose={() => setIsVacationModalOpen(false)}
        onSelectExistingRecord={(rec) => {
          setEditingRecord(rec);
          setPrefillOfficer(null);
        }}
        onStartNewForOfficer={(officer) => {
          setEditingRecord(null);
          setPrefillOfficer(officer);
        }}
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
