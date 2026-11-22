import type {
  ConnectedSheetInfo,
  DriveSpreadsheetFile,
  LancamentoAfastamento,
  SheetColumnMap,
  SheetTabInfo,
} from '../types/ferias';
import {
  addDaysToISODate,
  calcularDiasInclusivos,
  normalizarCargo,
  normalizarEquipe,
  normalizarTipoAfastamento,
  parseParaISODate,
} from '../utils/dateUtils';

export const SPREADSHEET_HEADERS = [
  'Equipe',
  'Servidor',
  'Cargo',
  'Tipo de Afastamento',
  'Início',
  'Fim',
  'Dias',
] as const;

export function extractSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const urlMatch = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(trimmed);
  if (urlMatch) return urlMatch[1];

  const idMatch = /^[a-zA-Z0-9-_]{20,}$/.exec(trimmed);
  if (idMatch) return idMatch[0];

  return null;
}

async function handleGoogleApiError(res: Response, fallbackMsg: string): Promise<never> {
  let detail = fallbackMsg;
  try {
    const json = await res.json();
    if (json?.error?.message) {
      detail = json.error.message;
    }
  } catch {
    // ignore parse failure
  }
  if (res.status === 401) {
    throw new Error('Sessão Google expirada. Faça login novamente com sua conta Google.');
  }
  if (res.status === 403) {
    throw new Error(`Permissão insuficiente no Google Workspace: ${detail}`);
  }
  throw new Error(detail);
}

export async function listDriveSpreadsheets(
  accessToken: string
): Promise<DriveSpreadsheetFile[]> {
  const q = encodeURIComponent(
    "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
  );
  const fields = encodeURIComponent('files(id,name,modifiedTime,webViewLink)');
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime desc&pageSize=25&fields=${fields}&supportsAllDrives=true&includeItemsFromAllDrives=true`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    await handleGoogleApiError(res, 'Erro ao listar planilhas no Google Drive.');
  }

  const data = await res.json();
  return (data.files ?? []) as DriveSpreadsheetFile[];
}

export async function getSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string,
  preferredSheetTitle?: string
): Promise<ConnectedSheetInfo> {
  const fields = encodeURIComponent(
    'spreadsheetId,properties.title,spreadsheetUrl,sheets(properties(sheetId,title,index))'
  );
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}?fields=${fields}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    await handleGoogleApiError(res, 'Não foi possível acessar os metadados da planilha.');
  }

  const data = await res.json();
  const rawSheets: { properties: { sheetId: number; title: string; index: number } }[] =
    data.sheets ?? [];
  if (rawSheets.length === 0) {
    throw new Error('A planilha selecionada não possui nenhuma aba.');
  }

  const sortedSheets = [...rawSheets].sort(
    (a, b) => (a.properties.index ?? 0) - (b.properties.index ?? 0)
  );
  const availableTabs: SheetTabInfo[] = sortedSheets.map((s) => ({
    sheetId: s.properties.sheetId,
    title: s.properties.title,
  }));

  const matched =
    (preferredSheetTitle &&
      availableTabs.find((t) => t.title === preferredSheetTitle)) ||
    availableTabs.find((t) => /afastamento|ferias|férias|escala|2027/i.test(t.title)) ||
    availableTabs[0];

  return {
    spreadsheetId: data.spreadsheetId,
    spreadsheetTitle: data.properties?.title || 'Planilha Sem Título',
    sheetTitle: matched.title,
    sheetId: matched.sheetId,
    webViewLink: data.spreadsheetUrl,
    availableTabs,
  };
}

function normalizeHeaderKey(header: string): string {
  return header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function indexToColumnLetter(idx: number): string {
  let n = idx + 1;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters || 'A';
}

export function registroToSheetRow(reg: LancamentoAfastamento): (string | number)[] {
  const d = reg.inicio && reg.fim ? calcularDiasInclusivos(reg.inicio, reg.fim) : 0;
  // Write ISO YYYY-MM-DD so Google Sheets parses dates identically in both pt_BR and en_US locales
  return [
    reg.equipe,
    reg.servidor,
    reg.cargo,
    reg.tipo,
    reg.inicio ? parseParaISODate(reg.inicio) : '',
    reg.fim ? parseParaISODate(reg.fim) : '',
    d > 0 ? d : '',
  ];
}

function buildRowFromColumnMap(
  reg: LancamentoAfastamento,
  colMap?: SheetColumnMap
): { values: (string | number)[]; endColLetter: string } {
  if (!colMap || colMap.layout === 'single') {
    const row = registroToSheetRow(reg);
    if (!colMap) {
      return { values: row, endColLetter: 'G' };
    }

    const maxIdx = Math.max(
      colMap.colEquipe,
      colMap.colServidor,
      colMap.colCargo,
      colMap.colTipo,
      colMap.colIni1,
      colMap.colFim1,
      colMap.colDias1,
      6
    );
    const out: (string | number)[] = Array(maxIdx + 1).fill('');
    const d = reg.inicio && reg.fim ? calcularDiasInclusivos(reg.inicio, reg.fim) : 0;
    if (colMap.colEquipe >= 0) out[colMap.colEquipe] = reg.equipe;
    if (colMap.colServidor >= 0) out[colMap.colServidor] = reg.servidor;
    if (colMap.colCargo >= 0) out[colMap.colCargo] = reg.cargo;
    if (colMap.hasTipoColumn && colMap.colTipo >= 0) out[colMap.colTipo] = reg.tipo;
    if (colMap.colIni1 >= 0) out[colMap.colIni1] = reg.inicio ? parseParaISODate(reg.inicio) : '';
    if (colMap.colFim1 >= 0) out[colMap.colFim1] = reg.fim ? parseParaISODate(reg.fim) : '';
    if (colMap.colDias1 >= 0) out[colMap.colDias1] = d > 0 ? d : '';

    return { values: out, endColLetter: indexToColumnLetter(out.length - 1) };
  }

  // Legacy 2-period-per-row sheet compatibility
  const slot = reg.legacySlot ?? 1;
  const p1Ini =
    slot === 1 ? parseParaISODate(reg.inicio) : parseParaISODate(reg.legacyTwinData?.inicio);
  const p1Fim =
    slot === 1 ? parseParaISODate(reg.fim) : parseParaISODate(reg.legacyTwinData?.fim);
  const p2Ini =
    slot === 2 ? parseParaISODate(reg.inicio) : parseParaISODate(reg.legacyTwinData?.inicio);
  const p2Fim =
    slot === 2 ? parseParaISODate(reg.fim) : parseParaISODate(reg.legacyTwinData?.fim);

  const d1 = p1Ini && p1Fim ? calcularDiasInclusivos(p1Ini, p1Fim) : 0;
  const d2 = p2Ini && p2Fim ? calcularDiasInclusivos(p2Ini, p2Fim) : 0;

  const maxIdx = Math.max(
    colMap.colEquipe,
    colMap.colServidor,
    colMap.colCargo,
    colMap.colTipo,
    colMap.colIni1,
    colMap.colFim1,
    colMap.colDias1,
    colMap.colIni2,
    colMap.colFim2,
    colMap.colDias2,
    colMap.colTotal,
    colMap.colTipo2,
    9
  );
  const out: (string | number)[] = Array(maxIdx + 1).fill('');
  if (colMap.colEquipe >= 0) out[colMap.colEquipe] = reg.equipe;
  if (colMap.colServidor >= 0) out[colMap.colServidor] = reg.servidor;
  if (colMap.colCargo >= 0) out[colMap.colCargo] = reg.cargo;
  if (colMap.hasTipoColumn && colMap.colTipo >= 0) {
    out[colMap.colTipo] = slot === 1 ? reg.tipo : reg.legacyTwinData?.tipo ?? reg.tipo;
  }
  if (colMap.colTipo2 >= 0) {
    out[colMap.colTipo2] = slot === 2 ? reg.tipo : reg.legacyTwinData?.tipo ?? reg.tipo;
  }
  if (colMap.colIni1 >= 0) out[colMap.colIni1] = p1Ini;
  if (colMap.colFim1 >= 0) out[colMap.colFim1] = p1Fim;
  if (colMap.colDias1 >= 0) out[colMap.colDias1] = d1 > 0 ? d1 : '';
  if (colMap.colIni2 >= 0) out[colMap.colIni2] = p2Ini;
  if (colMap.colFim2 >= 0) out[colMap.colFim2] = p2Fim;
  if (colMap.colDias2 >= 0) out[colMap.colDias2] = d2 > 0 ? d2 : '';
  if (colMap.colTotal >= 0) out[colMap.colTotal] = d1 + d2 > 0 ? d1 + d2 : 0;

  return { values: out, endColLetter: indexToColumnLetter(out.length - 1) };
}

function formatSheetRange(sheetTitle: string, cellRange: string): string {
  const escaped = sheetTitle.replace(/'/g, "''");
  return encodeURIComponent(`'${escaped}'!${cellRange}`);
}

function isLikelyDateCell(val: string | number | undefined): boolean {
  if (typeof val === 'number') {
    return val > 30000 && val < 80000;
  }
  const s = String(val ?? '').trim();
  return /^\d{4}-\d{1,2}-\d{1,2}$/.test(s) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s);
}

/**
 * Pure parser for Google Sheets rows.
 * - Always treats Row 1 (or the detected header row within rows 1..15) as header,
 *   reading data strictly starting from Row 2 (or the row immediately below the header).
 * - Supports both the reorganized single-entry layout
 *   (Equipe | Servidor | Cargo | Tipo de Afastamento | Início | Fim | Dias)
 *   and legacy 2-period-per-row spreadsheets.
 */
export function parseSheetRows(rows: (string | number)[][]): {
  registros: LancamentoAfastamento[];
  headerRowIndex: number; // 0-based
  lastDataRowIndex: number; // 1-based row number of last data row (at least 1 when header exists)
  hasHeaderRow: boolean;
  columnMap: SheetColumnMap;
} {
  const defaultColumnMap: SheetColumnMap = {
    layout: 'single',
    headerRowIndex: 0,
    hasTipoColumn: true,
    colEquipe: 0,
    colServidor: 1,
    colCargo: 2,
    colTipo: 3,
    colIni1: 4,
    colFim1: 5,
    colDias1: 6,
    colIni2: -1,
    colFim2: -1,
    colDias2: -1,
    colTotal: -1,
    colTipo2: -1,
  };

  if (!rows || rows.length === 0) {
    return {
      registros: [],
      headerRowIndex: 0,
      lastDataRowIndex: 1,
      hasHeaderRow: false,
      columnMap: defaultColumnMap,
    };
  }

  // Locate explicit header row within first 15 rows; if none matched, Row 1 (index 0) is still treated as header
  let matchedHeaderIdx = -1;
  const searchLimit = Math.min(rows.length, 15);
  for (let r = 0; r < searchLimit; r++) {
    const rawRow = rows[r] ?? [];
    if (rawRow.some((c) => isLikelyDateCell(c))) continue;

    const normalizedCells = rawRow.map((c) => normalizeHeaderKey(String(c ?? '')));
    const hasServidor = normalizedCells.some(
      (h) =>
        h.includes('servidor') ||
        h.includes('nome') ||
        h.includes('funcionario') ||
        h.includes('colaborador') ||
        h.includes('policial')
    );
    const hasScheduleCol = normalizedCells.some(
      (h) =>
        h.includes('equipe') ||
        h.includes('cargo') ||
        h.includes('funcao') ||
        h.includes('tipo') ||
        h.includes('afastamento') ||
        h.includes('inicio') ||
        h.includes('saida') ||
        h.includes('fim') ||
        h.includes('termino') ||
        h.includes('retorno') ||
        h.includes('periodo') ||
        h.includes('ferias') ||
        h.includes('dias') ||
        h.includes('total') ||
        h.includes('plantao') ||
        h.includes('setor')
    );
    if (hasServidor && hasScheduleCol) {
      matchedHeaderIdx = r;
      break;
    }
  }

  // Always start reading data from at least Row 2 (index 1)
  const headerRowIdx = matchedHeaderIdx !== -1 ? matchedHeaderIdx : 0;
  const headerRow = (rows[headerRowIdx] ?? []).map((cell) =>
    normalizeHeaderKey(String(cell ?? ''))
  );
  const headerMatchedByKeywords = matchedHeaderIdx !== -1;

  const findOptionalCol = (predicates: ((h: string) => boolean)[]): number => {
    for (const pred of predicates) {
      const idx = headerRow.findIndex(pred);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const findCol = (predicates: ((h: string) => boolean)[], fallbackIndex: number): number => {
    const idx = findOptionalCol(predicates);
    return idx !== -1 ? idx : fallbackIndex;
  };

  const colIni2Detected = findOptionalCol([
    (h) => (h.includes('inicio') || h.includes('saida')) && h.includes('2'),
    (h) => h === 'inicio 2',
  ]);
  const colFim2Detected = findOptionalCol([
    (h) => (h.includes('fim') || h.includes('termino') || h.includes('retorno')) && h.includes('2'),
    (h) => h === 'fim 2',
  ]);
  const isLegacy2 = colIni2Detected !== -1 || colFim2Detected !== -1;

  const colEquipe = findCol(
    [(h) => h.includes('equipe') || h.includes('plantao') || h.includes('setor')],
    0
  );
  const colServidor = findCol(
    [
      (h) =>
        h.includes('servidor') ||
        h.includes('nome') ||
        h.includes('funcionario') ||
        h.includes('colaborador') ||
        h.includes('policial'),
    ],
    1
  );
  const colCargo = findCol([(h) => h.includes('cargo') || h.includes('funcao')], 2);

  const isDateOrDaysHeader = (h: string) =>
    h.includes('data') ||
    h.includes('inicio') ||
    h.includes('inicial') ||
    h.includes('fim') ||
    h.includes('final') ||
    h.includes('termino') ||
    h.includes('retorno') ||
    h.includes('saida') ||
    h.includes('dias') ||
    h.includes('total');

  const colTipoDetected = findOptionalCol([
    (h) =>
      (h === 'tipo' ||
        h === 'afastamento' ||
        h === 'tipo de afastamento' ||
        h === 'tipo afastamento') &&
      !h.includes('2'),
    (h) =>
      !isDateOrDaysHeader(h) &&
      (h.includes('tipo') ||
        h.includes('afastamento') ||
        h.includes('motivo') ||
        h.includes('categoria') ||
        h.includes('natureza')) &&
      !h.includes('2'),
  ]);
  const colTipo2Detected = findOptionalCol([
    (h) =>
      !isDateOrDaysHeader(h) &&
      (h.includes('tipo') || h.includes('afastamento') || h.includes('motivo')) &&
      h.includes('2'),
  ]);

  let colIni1: number;
  let colFim1: number;
  let colDias1: number;
  let hasTipoColumn: boolean;
  let colTipo: number;

  if (isLegacy2) {
    colIni1 = findCol(
      [
        (h) => (h.includes('inicio') || h.includes('inicial') || h.includes('saida')) && h.includes('1'),
        (h) => h === 'inicio 1',
        (h) => (h.includes('inicio') || h.includes('inicial') || h.includes('saida')) && !h.includes('2'),
      ],
      3
    );
    colFim1 = findCol(
      [
        (h) =>
          (h.includes('fim') || h.includes('final') || h.includes('termino') || h.includes('retorno')) &&
          h.includes('1'),
        (h) => h === 'fim 1',
        (h) =>
          (h.includes('fim') || h.includes('final') || h.includes('termino') || h.includes('retorno')) &&
          !h.includes('2'),
      ],
      4
    );
    colDias1 = findOptionalCol([(h) => h.includes('dias') && !h.includes('2')]);
    hasTipoColumn = colTipoDetected !== -1;
    colTipo = colTipoDetected;
  } else {
    hasTipoColumn = headerMatchedByKeywords ? colTipoDetected !== -1 : true;
    colTipo = colTipoDetected !== -1 ? colTipoDetected : hasTipoColumn ? 3 : -1;
    const dateStartFallback = hasTipoColumn ? 4 : 3;

    colIni1 = findCol(
      [
        (h) =>
          (h.includes('inicio') ||
            h.includes('inicial') ||
            h.includes('saida') ||
            h.includes('data ini')) &&
          !h.includes('2'),
        (h) => h.includes('inicio') && h.includes('1'),
      ],
      dateStartFallback
    );
    colFim1 = findCol(
      [
        (h) =>
          (h.includes('fim') ||
            h.includes('final') ||
            h.includes('termino') ||
            h.includes('retorno') ||
            h.includes('data fin')) &&
          !h.includes('2'),
      ],
      dateStartFallback + 1
    );
    colDias1 = findCol([(h) => h === 'dias' || h.includes('dias')], dateStartFallback + 2);
  }

  const colDias2 = isLegacy2
    ? findOptionalCol([(h) => h.includes('dias') && h.includes('2')])
    : -1;
  const colTotal = isLegacy2 ? findOptionalCol([(h) => h.includes('total')]) : -1;

  const columnMap: SheetColumnMap = {
    layout: isLegacy2 ? 'legacy2' : 'single',
    headerRowIndex: headerRowIdx,
    hasTipoColumn,
    colEquipe,
    colServidor,
    colCargo,
    colTipo,
    colIni1,
    colFim1,
    colDias1,
    colIni2: colIni2Detected,
    colFim2: colFim2Detected,
    colDias2,
    colTotal,
    colTipo2: colTipo2Detected,
  };

  const registros: LancamentoAfastamento[] = [];
  const startIdx = headerRowIdx + 1; // Strictly row 2+ when header is row 1
  let lastDataRowIndex = headerRowIdx + 1;

  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const nonEmptyCount = row.filter((c) => String(c ?? '').trim() !== '').length;
    if (nonEmptyCount === 0) continue;

    const servidorNome = String(row[colServidor] ?? '').trim();
    if (!servidorNome) continue;

    const lowerNome = servidorNome.toLowerCase();
    if (lowerNome === 'total' || lowerNome === 'total geral') continue;

    const rowNum = i + 1; // 1-based in Google Sheets (>= 2)
    lastDataRowIndex = rowNum;

    const equipe = normalizarEquipe(String(row[colEquipe] ?? 'Alfa'));
    const cargo = normalizarCargo(String(row[colCargo] ?? 'Agente'));

    if (isLegacy2) {
      const ini1 = parseParaISODate(row[colIni1]);
      const fim1 = parseParaISODate(row[colFim1]);
      const ini2 =
        colIni2Detected !== -1 ? parseParaISODate(row[colIni2Detected]) : '';
      const fim2 =
        colFim2Detected !== -1 ? parseParaISODate(row[colFim2Detected]) : '';

      const tipo1 =
        hasTipoColumn && colTipo >= 0
          ? normalizarTipoAfastamento(String(row[colTipo] ?? ''))
          : 'Férias';
      const tipo2 =
        colTipo2Detected >= 0
          ? normalizarTipoAfastamento(String(row[colTipo2Detected] ?? ''))
          : tipo1;

      if (ini1 && fim1) {
        registros.push({
          id: `sheet-row-${rowNum}-p1`,
          rowIndex: rowNum,
          sheetFormat: 'legacy2',
          legacySlot: 1,
          legacyTwinData: ini2 && fim2 ? { inicio: ini2, fim: fim2, tipo: tipo2 } : undefined,
          equipe,
          servidor: servidorNome,
          cargo,
          tipo: tipo1,
          inicio: ini1,
          fim: fim1,
        });
      }

      if (ini2 && fim2) {
        registros.push({
          id: `sheet-row-${rowNum}-p2`,
          rowIndex: rowNum,
          sheetFormat: 'legacy2',
          legacySlot: 2,
          legacyTwinData: ini1 && fim1 ? { inicio: ini1, fim: fim1, tipo: tipo1 } : undefined,
          equipe,
          servidor: servidorNome,
          cargo,
          tipo: tipo2,
          inicio: ini2,
          fim: fim2,
        });
      }
      continue;
    }

    // Single-entry-per-row format
    // Fallback resilience if an unlabelled Row 1 sheet omitted the Tipo column and put dates in col 3 & 4
    let tipoStr = hasTipoColumn && colTipo >= 0 ? String(row[colTipo] ?? '') : '';
    let iniRaw = row[colIni1];
    let fimRaw = row[colFim1];

    if (!headerMatchedByKeywords && isLikelyDateCell(row[3]) && isLikelyDateCell(row[4])) {
      tipoStr = 'Férias';
      iniRaw = row[3];
      fimRaw = row[4];
    }

    let inicio = parseParaISODate(iniRaw);
    let fim = parseParaISODate(fimRaw);
    const tipo = normalizarTipoAfastamento(tipoStr);

    if (!inicio && !fim) continue;

    const diasInformados =
      colDias1 >= 0 ? Math.trunc(Number(row[colDias1] ?? 0)) : 0;

    if (inicio && !fim) {
      fim =
        diasInformados >= 1
          ? addDaysToISODate(inicio, diasInformados - 1)
          : inicio;
    } else if (!inicio && fim) {
      inicio =
        diasInformados >= 1
          ? addDaysToISODate(fim, -(diasInformados - 1))
          : fim;
    }

    registros.push({
      id: `sheet-row-${rowNum}`,
      rowIndex: rowNum,
      sheetFormat: 'single',
      equipe,
      servidor: servidorNome,
      cargo,
      tipo,
      inicio,
      fim,
    });
  }

  return {
    registros,
    headerRowIndex: headerRowIdx,
    lastDataRowIndex,
    hasHeaderRow: true,
    columnMap,
  };
}

async function fetchRawSheetValues(
  accessToken: string,
  sheetInfo: ConnectedSheetInfo
): Promise<(string | number)[][]> {
  const range = formatSheetRange(sheetInfo.sheetTitle, 'A:Z');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    sheetInfo.spreadsheetId
  )}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    await handleGoogleApiError(res, 'Erro ao ler dados da planilha no Google Sheets.');
  }

  const data = await res.json();
  return (data.values ?? []) as (string | number)[][];
}

export async function readSheetRecords(
  accessToken: string,
  sheetInfo: ConnectedSheetInfo
): Promise<LancamentoAfastamento[]> {
  const rows = await fetchRawSheetValues(accessToken, sheetInfo);
  const parsed = parseSheetRows(rows);
  sheetInfo.columnMap = parsed.columnMap;
  return parsed.registros;
}

export async function createSpreadsheet2027(
  accessToken: string,
  initialRecords: LancamentoAfastamento[]
): Promise<{ sheetInfo: ConnectedSheetInfo; records: LancamentoAfastamento[] }> {
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: 'Controle_de_Afastamentos_CPP_Joinville',
        locale: 'pt_BR',
      },
      sheets: [
        {
          properties: {
            title: 'Afastamentos 2027',
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    await handleGoogleApiError(
      createRes,
      'Não foi possível criar a planilha Controle_de_Afastamentos_CPP_Joinville.'
    );
  }

  const created = await createRes.json();
  const sheetProp = created.sheets[0].properties;
  const sheetInfo: ConnectedSheetInfo = {
    spreadsheetId: created.spreadsheetId,
    spreadsheetTitle: created.properties.title,
    sheetTitle: sheetProp.title,
    sheetId: sheetProp.sheetId,
    webViewLink: created.spreadsheetUrl,
    availableTabs: [{ sheetId: sheetProp.sheetId, title: sheetProp.title }],
  };

  const values = [
    [...SPREADSHEET_HEADERS],
    ...initialRecords.map((r) => registroToSheetRow(r)),
  ];

  const writeRange = encodeURIComponent(`'${sheetInfo.sheetTitle}'!A1:G${values.length}`);
  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      sheetInfo.spreadsheetId
    )}/values/${writeRange}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  );

  if (!writeRes.ok) {
    await handleGoogleApiError(
      writeRes,
      'Planilha criada, mas houve erro ao preencher os registros iniciais.'
    );
  }

  // Format header row cleanly in institutional navy
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      sheetInfo.spreadsheetId
    )}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: sheetInfo.sheetId,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: SPREADSHEET_HEADERS.length,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.118, green: 0.227, blue: 0.373 },
                  textFormat: {
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                    bold: true,
                  },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          },
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: sheetInfo.sheetId,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: SPREADSHEET_HEADERS.length,
              },
            },
          },
        ],
      }),
    }
  );

  const records = await readSheetRecords(accessToken, sheetInfo);
  return { sheetInfo, records };
}

export async function appendSheetRecord(
  accessToken: string,
  sheetInfo: ConnectedSheetInfo,
  registro: LancamentoAfastamento
): Promise<LancamentoAfastamento[]> {
  const rawRows = await fetchRawSheetValues(accessToken, sheetInfo);
  const sheetIsCompletelyEmpty =
    rawRows.length === 0 ||
    rawRows.every((r) => !r || r.every((c) => String(c ?? '').trim() === ''));

  if (sheetIsCompletelyEmpty) {
    const initRange = formatSheetRange(sheetInfo.sheetTitle, 'A1:G2');
    const initUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      sheetInfo.spreadsheetId
    )}/values/${initRange}?valueInputOption=USER_ENTERED`;

    const res = await fetch(initUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [[...SPREADSHEET_HEADERS], registroToSheetRow(registro)],
      }),
    });

    if (!res.ok) {
      await handleGoogleApiError(res, 'Erro ao adicionar registro na planilha.');
    }

    return readSheetRecords(accessToken, sheetInfo);
  }

  const parsed = parseSheetRows(rawRows);
  const targetRow = Math.max(2, parsed.lastDataRowIndex + 1);
  const { values, endColLetter } = buildRowFromColumnMap(registro, parsed.columnMap);

  const putRange = formatSheetRange(
    sheetInfo.sheetTitle,
    `A${targetRow}:${endColLetter}${targetRow}`
  );
  const putUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    sheetInfo.spreadsheetId
  )}/values/${putRange}?valueInputOption=USER_ENTERED`;

  const res = await fetch(putUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [values],
    }),
  });

  if (!res.ok) {
    await handleGoogleApiError(res, 'Erro ao adicionar registro na planilha.');
  }

  return readSheetRecords(accessToken, sheetInfo);
}

export async function updateSheetRecord(
  accessToken: string,
  sheetInfo: ConnectedSheetInfo,
  registro: LancamentoAfastamento
): Promise<LancamentoAfastamento[]> {
  if (!registro.rowIndex || registro.rowIndex < 2) {
    return appendSheetRecord(accessToken, sheetInfo, registro);
  }

  const rawRows = await fetchRawSheetValues(accessToken, sheetInfo);
  const parsed = parseSheetRows(rawRows);
  const { values, endColLetter } = buildRowFromColumnMap(registro, parsed.columnMap);

  const range = formatSheetRange(
    sheetInfo.sheetTitle,
    `A${registro.rowIndex}:${endColLetter}${registro.rowIndex}`
  );
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    sheetInfo.spreadsheetId
  )}/values/${range}?valueInputOption=USER_ENTERED`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [values],
    }),
  });

  if (!res.ok) {
    await handleGoogleApiError(res, 'Erro ao atualizar registro na planilha.');
  }

  return readSheetRecords(accessToken, sheetInfo);
}

export async function deleteSheetRecord(
  accessToken: string,
  sheetInfo: ConnectedSheetInfo,
  registro: LancamentoAfastamento
): Promise<LancamentoAfastamento[]> {
  const rowIndex = registro.rowIndex;
  if (!rowIndex || rowIndex < 2) {
    return readSheetRecords(accessToken, sheetInfo);
  }

  // If this came from a legacy 2-period row and has a sibling period in the same row, clear only this slot
  if (registro.sheetFormat === 'legacy2' && registro.legacyTwinData) {
    const cleared: LancamentoAfastamento = {
      ...registro,
      inicio: '',
      fim: '',
    };
    return updateSheetRecord(accessToken, sheetInfo, cleared);
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    sheetInfo.spreadsheetId
  )}:batchUpdate`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheetInfo.sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1,
              endIndex: rowIndex,
            },
          },
        },
      ],
    }),
  });

  if (!res.ok) {
    await handleGoogleApiError(res, 'Erro ao excluir linha na planilha.');
  }

  return readSheetRecords(accessToken, sheetInfo);
}
