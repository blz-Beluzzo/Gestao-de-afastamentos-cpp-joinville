import type {
  ConnectedSheetInfo,
  DriveSpreadsheetFile,
  RegistroFerias,
  SheetTabInfo,
} from '../types/ferias';
import {
  calcularDiasInclusivos,
  normalizarCargo,
  normalizarEquipe,
  parseParaISODate,
} from '../utils/dateUtils';

export const SPREADSHEET_HEADERS = [
  'Equipe',
  'Servidor',
  'Cargo',
  'Início – período 1',
  'Fim – período 1',
  'Dias – período 1',
  'Início – período 2',
  'Fim – período 2',
  'Dias – período 2',
  'Total de dias',
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
    availableTabs.find((t) => /ferias|férias|escala|2027/i.test(t.title)) ||
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

function registroToSheetRow(reg: RegistroFerias): (string | number)[] {
  const d1 = reg.inicio1 && reg.fim1 ? calcularDiasInclusivos(reg.inicio1, reg.fim1) : 0;
  const d2 = reg.inicio2 && reg.fim2 ? calcularDiasInclusivos(reg.inicio2, reg.fim2) : 0;
  // Write ISO YYYY-MM-DD so Google Sheets parses dates identically in both pt_BR and en_US locales
  return [
    reg.equipe,
    reg.servidor,
    reg.cargo,
    reg.inicio1 ? parseParaISODate(reg.inicio1) : '',
    reg.fim1 ? parseParaISODate(reg.fim1) : '',
    d1 > 0 ? d1 : '',
    reg.inicio2 ? parseParaISODate(reg.inicio2) : '',
    reg.fim2 ? parseParaISODate(reg.fim2) : '',
    d2 > 0 ? d2 : '',
    d1 + d2 > 0 ? d1 + d2 : 0,
  ];
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
 * - Automatically detects the header row within the first 15 rows (handles title banners / empty top rows).
 * - If no header row exists (e.g. a blank sheet where records were written starting at Row 1), parses data from Row 1.
 * - Handles columns in flexible order and reads all rows without a 500-row cap.
 */
export function parseSheetRows(rows: (string | number)[][]): {
  registros: RegistroFerias[];
  headerRowIndex: number; // 0-based (-1 when headerless)
  lastDataRowIndex: number; // 1-based row number of last officer row (0 when empty)
  hasHeaderRow: boolean;
} {
  if (!rows || rows.length === 0) {
    return {
      registros: [],
      headerRowIndex: -1,
      lastDataRowIndex: 0,
      hasHeaderRow: false,
    };
  }

  // Locate header row in first 15 rows
  let headerRowIdx = -1;
  const searchLimit = Math.min(rows.length, 15);
  for (let r = 0; r < searchLimit; r++) {
    const rawRow = rows[r] ?? [];
    // A header row should not contain actual vacation dates
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
        h.includes('inicio') ||
        h.includes('fim') ||
        h.includes('termino') ||
        h.includes('periodo') ||
        h.includes('ferias') ||
        h.includes('dias') ||
        h.includes('total') ||
        h.includes('plantao') ||
        h.includes('setor')
    );
    if (hasServidor && hasScheduleCol) {
      headerRowIdx = r;
      break;
    }
  }

  const hasHeaderRow = headerRowIdx !== -1;
  const headerRow = hasHeaderRow
    ? (rows[headerRowIdx] ?? []).map((cell) => normalizeHeaderKey(String(cell ?? '')))
    : [];

  const findCol = (predicates: ((h: string) => boolean)[], fallbackIndex: number): number => {
    if (!hasHeaderRow) return fallbackIndex;
    for (const pred of predicates) {
      const idx = headerRow.findIndex(pred);
      if (idx !== -1) return idx;
    }
    return fallbackIndex;
  };

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
  const colIni1 = findCol(
    [
      (h) => h.includes('inicio') && h.includes('1'),
      (h) => h === 'inicio 1',
      (h) => h.includes('inicio') && !h.includes('2'),
    ],
    3
  );
  const colFim1 = findCol(
    [
      (h) => (h.includes('fim') || h.includes('termino')) && h.includes('1'),
      (h) => h === 'fim 1',
      (h) => (h.includes('fim') || h.includes('termino')) && !h.includes('2'),
    ],
    4
  );
  const colIni2 = findCol(
    [(h) => h.includes('inicio') && h.includes('2'), (h) => h === 'inicio 2'],
    6
  );
  const colFim2 = findCol(
    [
      (h) => (h.includes('fim') || h.includes('termino')) && h.includes('2'),
      (h) => h === 'fim 2',
    ],
    7
  );

  const registros: RegistroFerias[] = [];
  const startIdx = hasHeaderRow ? headerRowIdx + 1 : 0;
  let lastDataRowIndex = hasHeaderRow ? headerRowIdx + 1 : 0;

  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const nonEmptyCount = row.filter((c) => String(c ?? '').trim() !== '').length;
    if (nonEmptyCount === 0) continue;

    // When headerless, ignore single-cell banner/title rows without dates
    if (!hasHeaderRow && nonEmptyCount <= 1 && !row.some((c) => isLikelyDateCell(c))) {
      continue;
    }

    const servidorNome = String(row[colServidor] ?? '').trim();
    if (!servidorNome) continue;

    // Skip repeated summary/total rows if present
    const lowerNome = servidorNome.toLowerCase();
    if (lowerNome === 'total' || lowerNome === 'total geral') continue;

    const rowNum = i + 1; // 1-based in Google Sheets
    lastDataRowIndex = rowNum;

    const equipeRaw = String(row[colEquipe] ?? 'Alfa');
    const cargoRaw = String(row[colCargo] ?? 'Agente');

    registros.push({
      id: `sheet-row-${rowNum}`,
      rowIndex: rowNum,
      equipe: normalizarEquipe(equipeRaw),
      servidor: servidorNome,
      cargo: normalizarCargo(cargoRaw),
      inicio1: parseParaISODate(row[colIni1]),
      fim1: parseParaISODate(row[colFim1]),
      inicio2: parseParaISODate(row[colIni2]),
      fim2: parseParaISODate(row[colFim2]),
    });
  }

  return { registros, headerRowIndex: headerRowIdx, lastDataRowIndex, hasHeaderRow };
}

async function fetchRawSheetValues(
  accessToken: string,
  sheetInfo: ConnectedSheetInfo
): Promise<(string | number)[][]> {
  // Read full columns A:Z without an arbitrary 500-row cap
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
): Promise<RegistroFerias[]> {
  const rows = await fetchRawSheetValues(accessToken, sheetInfo);
  return parseSheetRows(rows).registros;
}

export async function createSpreadsheet2027(
  accessToken: string,
  initialRecords: RegistroFerias[]
): Promise<{ sheetInfo: ConnectedSheetInfo; records: RegistroFerias[] }> {
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: 'Programacao_de_Ferias_CPP_2027',
        locale: 'pt_BR',
      },
      sheets: [
        {
          properties: {
            title: 'Férias 2027',
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
      'Não foi possível criar a planilha Programacao_de_Ferias_CPP_2027.'
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

  const writeRange = encodeURIComponent(`'${sheetInfo.sheetTitle}'!A1:J${values.length}`);
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
                endColumnIndex: 10,
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
                endIndex: 10,
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
  registro: RegistroFerias
): Promise<RegistroFerias[]> {
  // Inspect current rows so we place the new officer cleanly right after the last officer row
  // (avoids jumping below pre-populated empty formula rows like "0" in Total de dias)
  const rawRows = await fetchRawSheetValues(accessToken, sheetInfo);
  const sheetIsCompletelyEmpty =
    rawRows.length === 0 ||
    rawRows.every((r) => !r || r.every((c) => String(c ?? '').trim() === ''));

  if (sheetIsCompletelyEmpty) {
    // Initialize an empty tab (like a fresh "Página1") with headers in Row 1 + officer in Row 2
    const initRange = formatSheetRange(sheetInfo.sheetTitle, 'A1:J2');
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
  const targetRow = parsed.lastDataRowIndex + 1;

  if (targetRow <= rawRows.length + 1) {
    const putRange = formatSheetRange(
      sheetInfo.sheetTitle,
      `A${targetRow}:J${targetRow}`
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
        values: [registroToSheetRow(registro)],
      }),
    });

    if (!res.ok) {
      await handleGoogleApiError(res, 'Erro ao adicionar registro na planilha.');
    }
  } else {
    const range = formatSheetRange(sheetInfo.sheetTitle, 'A:J');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      sheetInfo.spreadsheetId
    )}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [registroToSheetRow(registro)],
      }),
    });

    if (!res.ok) {
      await handleGoogleApiError(res, 'Erro ao adicionar registro na planilha.');
    }
  }

  return readSheetRecords(accessToken, sheetInfo);
}

export async function updateSheetRecord(
  accessToken: string,
  sheetInfo: ConnectedSheetInfo,
  registro: RegistroFerias
): Promise<RegistroFerias[]> {
  if (!registro.rowIndex || registro.rowIndex < 1) {
    return appendSheetRecord(accessToken, sheetInfo, registro);
  }

  const range = formatSheetRange(
    sheetInfo.sheetTitle,
    `A${registro.rowIndex}:J${registro.rowIndex}`
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
      values: [registroToSheetRow(registro)],
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
  rowIndex: number
): Promise<RegistroFerias[]> {
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
