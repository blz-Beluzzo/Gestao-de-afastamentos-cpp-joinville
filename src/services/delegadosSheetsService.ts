import {
  DELEGACIAS_LISTA,
  type DelegadoConvocavel,
  type EscalaDiaLinha,
  type EscalaMensalMap,
} from '../types/escala';
import type { ConnectedSheetInfo } from '../types/ferias';
import { NOMES_MESES_COMPLETOS, NOMES_MESES_CURTOS } from '../utils/dateUtils';
import { emptyConvocacoesDia } from '../utils/escalaMensalUtils';

export const DELEGADOS_HEADERS = ['Nome', 'Delegacia'] as const;

function normalizeKey(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ª/g, 'a')
    .replace(/º/g, 'o')
    .replace(/[–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizarDelegacia(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const target = normalizeKey(trimmed);
  const matched = DELEGACIAS_LISTA.find((d) => normalizeKey(d) === target);
  return matched ?? trimmed;
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

function formatSheetRange(sheetTitle: string, cellRange: string): string {
  const escaped = sheetTitle.replace(/'/g, "''");
  return encodeURIComponent(`'${escaped}'!${cellRange}`);
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

export function delegadoToSheetRow(d: Pick<DelegadoConvocavel, 'nome' | 'delegacia'>): string[] {
  return [d.nome.trim(), d.delegacia.trim()];
}

export function parseDelegadosRows(rows: (string | number)[][]): {
  delegados: DelegadoConvocavel[];
  headerRowIndex: number;
  lastDataRowIndex: number;
  colNome: number;
  colDelegacia: number;
} {
  if (!rows || rows.length === 0) {
    return {
      delegados: [],
      headerRowIndex: 0,
      lastDataRowIndex: 1,
      colNome: 0,
      colDelegacia: 1,
    };
  }

  let matchedHeaderIdx = -1;
  const searchLimit = Math.min(rows.length, 15);
  for (let r = 0; r < searchLimit; r++) {
    const normalizedCells = (rows[r] ?? []).map((c) => normalizeKey(String(c ?? '')));
    const hasNome = normalizedCells.some(
      (h) =>
        h.includes('nome') ||
        h.includes('delegado') ||
        h.includes('dpc') ||
        h.includes('servidor') ||
        h.includes('policial')
    );
    const hasDelegacia = normalizedCells.some(
      (h) =>
        h.includes('delegacia') ||
        h.includes('unidade') ||
        h.includes('lotacao') ||
        h === 'dp' ||
        h.includes('origem')
    );
    if (hasNome && hasDelegacia) {
      matchedHeaderIdx = r;
      break;
    }
  }

  const headerRowIdx = matchedHeaderIdx !== -1 ? matchedHeaderIdx : 0;
  const headerRow = (rows[headerRowIdx] ?? []).map((c) => normalizeKey(String(c ?? '')));

  const findCol = (preds: ((h: string) => boolean)[], fallback: number): number => {
    for (const pred of preds) {
      const idx = headerRow.findIndex(pred);
      if (idx !== -1) return idx;
    }
    return fallback;
  };

  const colNome = findCol(
    [
      (h) => h === 'nome' || h === 'delegado' || h === 'dpc',
      (h) =>
        h.includes('nome') ||
        h.includes('delegado') ||
        h.includes('servidor') ||
        h.includes('policial'),
    ],
    0
  );

  const colDelegacia = findCol(
    [
      (h) => h === 'delegacia' || h === 'unidade' || h === 'lotacao' || h === 'dp',
      (h) =>
        h.includes('delegacia') ||
        h.includes('unidade') ||
        h.includes('lotacao') ||
        h.includes('origem'),
    ],
    colNome === 0 ? 1 : 0
  );

  const delegados: DelegadoConvocavel[] = [];
  const startIdx = headerRowIdx + 1;
  let lastDataRowIndex = headerRowIdx + 1;

  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const nome = String(row[colNome] ?? '').trim();
    if (!nome) continue;
    const delegaciaRaw = String(row[colDelegacia] ?? '').trim();
    const rowNum = i + 1;
    lastDataRowIndex = rowNum;

    delegados.push({
      id: `del-row-${rowNum}`,
      rowIndex: rowNum,
      nome,
      delegacia: normalizarDelegacia(delegaciaRaw),
    });
  }

  return {
    delegados,
    headerRowIndex: headerRowIdx,
    lastDataRowIndex,
    colNome,
    colDelegacia,
  };
}

async function fetchRawValues(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string
): Promise<(string | number)[][]> {
  const range = formatSheetRange(sheetTitle, 'A:Z');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
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

export async function readDelegadosRecords(
  accessToken: string,
  sheetInfo: ConnectedSheetInfo
): Promise<DelegadoConvocavel[]> {
  const rows = await fetchRawValues(
    accessToken,
    sheetInfo.spreadsheetId,
    sheetInfo.sheetTitle
  );
  return parseDelegadosRows(rows).delegados;
}

export async function createDelegadosSpreadsheet(
  accessToken: string,
  initialDelegados: DelegadoConvocavel[]
): Promise<{ sheetInfo: ConnectedSheetInfo; delegados: DelegadoConvocavel[] }> {
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: 'Delegados_Convocacao_CPP_Joinville',
        locale: 'pt_BR',
      },
      sheets: [
        {
          properties: {
            title: 'Delegados',
            gridProperties: { frozenRowCount: 1 },
          },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    await handleGoogleApiError(
      createRes,
      'Não foi possível criar a planilha de Delegados no Google Drive.'
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
    [...DELEGADOS_HEADERS],
    ...initialDelegados.map((d) => delegadoToSheetRow(d)),
  ];

  const writeRange = formatSheetRange(sheetInfo.sheetTitle, `A1:B${values.length}`);
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
      'Planilha criada, mas houve erro ao preencher os delegados iniciais.'
    );
  }

  // Format header in institutional navy
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
                endColumnIndex: 2,
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
                endIndex: 2,
              },
            },
          },
        ],
      }),
    }
  );

  const delegados = await readDelegadosRecords(accessToken, sheetInfo);
  return { sheetInfo, delegados };
}

export async function appendDelegadoRecord(
  accessToken: string,
  sheetInfo: ConnectedSheetInfo,
  delegado: DelegadoConvocavel
): Promise<DelegadoConvocavel[]> {
  const rawRows = await fetchRawValues(
    accessToken,
    sheetInfo.spreadsheetId,
    sheetInfo.sheetTitle
  );
  const sheetEmpty =
    rawRows.length === 0 ||
    rawRows.every((r) => !r || r.every((c) => String(c ?? '').trim() === ''));

  if (sheetEmpty) {
    const initRange = formatSheetRange(sheetInfo.sheetTitle, 'A1:B2');
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        sheetInfo.spreadsheetId
      )}/values/${initRange}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [[...DELEGADOS_HEADERS], delegadoToSheetRow(delegado)],
        }),
      }
    );
    if (!res.ok) {
      await handleGoogleApiError(res, 'Erro ao gravar delegado na planilha.');
    }
    return readDelegadosRecords(accessToken, sheetInfo);
  }

  const parsed = parseDelegadosRows(rawRows);
  const targetRow = Math.max(2, parsed.lastDataRowIndex + 1);
  const maxCol = Math.max(parsed.colNome, parsed.colDelegacia, 1);
  const rowValues: string[] = Array(maxCol + 1).fill('');
  rowValues[parsed.colNome] = delegado.nome.trim();
  rowValues[parsed.colDelegacia] = delegado.delegacia.trim();
  const endColLetter = indexToColumnLetter(rowValues.length - 1);

  const putRange = formatSheetRange(
    sheetInfo.sheetTitle,
    `A${targetRow}:${endColLetter}${targetRow}`
  );
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      sheetInfo.spreadsheetId
    )}/values/${putRange}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [rowValues] }),
    }
  );
  if (!res.ok) {
    await handleGoogleApiError(res, 'Erro ao adicionar delegado na planilha.');
  }
  return readDelegadosRecords(accessToken, sheetInfo);
}

export async function updateDelegadoRecord(
  accessToken: string,
  sheetInfo: ConnectedSheetInfo,
  delegado: DelegadoConvocavel
): Promise<DelegadoConvocavel[]> {
  if (!delegado.rowIndex || delegado.rowIndex < 2) {
    return appendDelegadoRecord(accessToken, sheetInfo, delegado);
  }

  const rawRows = await fetchRawValues(
    accessToken,
    sheetInfo.spreadsheetId,
    sheetInfo.sheetTitle
  );
  const parsed = parseDelegadosRows(rawRows);
  const maxCol = Math.max(parsed.colNome, parsed.colDelegacia, 1);
  const rowValues: string[] = Array(maxCol + 1).fill('');
  rowValues[parsed.colNome] = delegado.nome.trim();
  rowValues[parsed.colDelegacia] = delegado.delegacia.trim();
  const endColLetter = indexToColumnLetter(rowValues.length - 1);

  const range = formatSheetRange(
    sheetInfo.sheetTitle,
    `A${delegado.rowIndex}:${endColLetter}${delegado.rowIndex}`
  );
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      sheetInfo.spreadsheetId
    )}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [rowValues] }),
    }
  );
  if (!res.ok) {
    await handleGoogleApiError(res, 'Erro ao atualizar delegado na planilha.');
  }
  return readDelegadosRecords(accessToken, sheetInfo);
}

export async function deleteDelegadoRecord(
  accessToken: string,
  sheetInfo: ConnectedSheetInfo,
  delegado: DelegadoConvocavel
): Promise<DelegadoConvocavel[]> {
  const rowIndex = delegado.rowIndex;
  if (!rowIndex || rowIndex < 2) {
    return readDelegadosRecords(accessToken, sheetInfo);
  }

  const res = await fetch(
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
    }
  );
  if (!res.ok) {
    await handleGoogleApiError(res, 'Erro ao remover delegado da planilha.');
  }
  return readDelegadosRecords(accessToken, sheetInfo);
}

/**
 * Builds the Google Sheets representation of Escala Mensal matching the official table layout.
 */
export function buildEscalaSheetValues(
  ano: number,
  mes: number,
  grade: EscalaDiaLinha[]
): (string | number)[][] {
  const mesUpper = NOMES_MESES_COMPLETOS[mes - 1].toUpperCase();
  const rows: (string | number)[][] = [
    [`CRPP JOINVILLE - ESCALA ${mesUpper}/${ano}`],
    ['Escala 24x72', '', '08:00 às 08:00', 'CONVOCAÇÕES', '', '', '', '', ''],
    [
      'DIA MÊS',
      'DIA SEMANA',
      'EQUIPE',
      'APC - dia',
      'APC - noite',
      'DPC - dia',
      'DPC - noite',
      'EPC - dia',
      'EPC - noite',
    ],
  ];

  for (const r of grade) {
    rows.push([
      r.diaMes,
      r.diaSemanaLabel,
      r.equipePlantao.toUpperCase(),
      r.convocacoes.apcDia.join(' / '),
      r.convocacoes.apcNoite.join(' / '),
      r.convocacoes.dpcDia.join(' / '),
      r.convocacoes.dpcNoite.join(' / '),
      r.convocacoes.epcDia.join(' / '),
      r.convocacoes.epcNoite.join(' / '),
    ]);
  }

  return rows;
}

function splitCellValues(val: string | number | undefined): string[] {
  const s = String(val ?? '').trim();
  if (!s) return [];
  return s
    .split(/\s*\/\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function parseEscalaSheetRows(
  rows: (string | number)[][],
  ano: number,
  mes: number
): EscalaMensalMap {
  const map: EscalaMensalMap = {};
  if (!rows || rows.length === 0) return map;

  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const joined = (rows[i] ?? []).map((c) => normalizeKey(String(c ?? ''))).join('|');
    if (joined.includes('apc') && joined.includes('dpc') && joined.includes('epc')) {
      headerIdx = i;
      break;
    }
  }

  const startIdx = headerIdx !== -1 ? headerIdx + 1 : 0;
  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const diaNum = Math.trunc(Number(row[0]));
    if (!Number.isFinite(diaNum) || diaNum < 1 || diaNum > 31) continue;

    const isoDate = `${ano}-${String(mes).padStart(2, '0')}-${String(diaNum).padStart(
      2,
      '0'
    )}`;
    const conv = emptyConvocacoesDia();
    conv.apcDia = splitCellValues(row[3]);
    conv.apcNoite = splitCellValues(row[4]);
    conv.dpcDia = splitCellValues(row[5]);
    conv.dpcNoite = splitCellValues(row[6]);
    conv.epcDia = splitCellValues(row[7]);
    conv.epcNoite = splitCellValues(row[8]);

    if (
      conv.apcDia.length ||
      conv.apcNoite.length ||
      conv.dpcDia.length ||
      conv.dpcNoite.length ||
      conv.epcDia.length ||
      conv.epcNoite.length
    ) {
      map[isoDate] = conv;
    }
  }

  return map;
}

export function getEscalaTabTitle(ano: number, mes: number): string {
  return `Escala ${NOMES_MESES_CURTOS[mes - 1]}-${ano}`;
}

export async function saveEscalaMensalToSheet(
  accessToken: string,
  spreadsheetId: string,
  ano: number,
  mes: number,
  grade: EscalaDiaLinha[]
): Promise<{ sheetTitle: string }> {
  const tabTitle = getEscalaTabTitle(ano, mes);

  // Inspect existing tabs
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}?fields=${encodeURIComponent('sheets(properties(sheetId,title))')}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!metaRes.ok) {
    await handleGoogleApiError(metaRes, 'Erro ao consultar abas da planilha.');
  }
  const meta = await metaRes.json();
  const existingTab = (meta.sheets ?? []).find(
    (s: { properties: { sheetId: number; title: string } }) =>
      s.properties.title.toLowerCase() === tabTitle.toLowerCase()
  );

  let sheetId: number;
  let finalTitle = tabTitle;

  if (existingTab) {
    sheetId = existingTab.properties.sheetId;
    finalTitle = existingTab.properties.title;
  } else {
    const addRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [{ addSheet: { properties: { title: tabTitle } } }],
        }),
      }
    );
    if (!addRes.ok) {
      await handleGoogleApiError(addRes, `Não foi possível criar a aba "${tabTitle}".`);
    }
    const added = await addRes.json();
    sheetId = added.replies[0].addSheet.properties.sheetId;
  }

  const values = buildEscalaSheetValues(ano, mes, grade);
  const putRange = formatSheetRange(finalTitle, `A1:I${values.length}`);

  const putRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${putRange}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  );
  if (!putRes.ok) {
    await handleGoogleApiError(putRes, 'Erro ao gravar Escala Mensal no Google Sheets.');
  }

  // Format header colors matching the official table (blue APC, green DPC, yellow EPC)
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
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
                sheetId,
                startRowIndex: 2,
                endRowIndex: 3,
                startColumnIndex: 3,
                endColumnIndex: 5,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.576, green: 0.773, blue: 0.992 },
                  textFormat: { bold: true },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          },
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: 2,
                endRowIndex: 3,
                startColumnIndex: 5,
                endColumnIndex: 7,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.525, green: 0.937, blue: 0.675 },
                  textFormat: { bold: true },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          },
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: 2,
                endRowIndex: 3,
                startColumnIndex: 7,
                endColumnIndex: 9,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.992, green: 0.878, blue: 0.278 },
                  textFormat: { bold: true },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          },
        ],
      }),
    }
  );

  return { sheetTitle: finalTitle };
}

export async function loadEscalaMensalFromSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
  ano: number,
  mes: number
): Promise<EscalaMensalMap> {
  const rows = await fetchRawValues(accessToken, spreadsheetId, sheetTitle);
  return parseEscalaSheetRows(rows, ano, mes);
}
