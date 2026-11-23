import type {
  EscalaDiaLinha,
  EscalaMensalMap,
  SlotKey,
} from '../types/escala';
import type { ConnectedSheetInfo, LancamentoAvaliado } from '../types/ferias';
import { NOMES_MESES_COMPLETOS, NOMES_MESES_CURTOS } from '../utils/dateUtils';
import {
  emptyConvocacoesDia,
  gerarGradeEscalaMensal,
  RODAPE_CONVOCACOES_ESCALA,
  SLOT_META,
} from '../utils/escalaMensalUtils';
import {
  buildEscalaSheetValues,
  getEscalaTabTitle,
  parseEscalaSheetRows,
} from './delegadosSheetsService';

export const ESCALA_SPREADSHEET_DEFAULT_TITLE = 'Escalas_Mensais_CPP_Joinville';

export interface LoadedEscalaTabSummary {
  sheetId: number;
  tabTitle: string;
  ano: number;
  mes: number;
  diasPreenchidos: number;
}

export interface EscalaSpreadsheetInfo extends ConnectedSheetInfo {
  loadedTabs: LoadedEscalaTabSummary[];
}

function normalizeToken(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

const MONTH_NAME_MAP: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  NOMES_MESES_CURTOS.forEach((m, idx) => {
    map[normalizeToken(m)] = idx + 1;
  });
  NOMES_MESES_COMPLETOS.forEach((m, idx) => {
    map[normalizeToken(m)] = idx + 1;
  });
  return map;
})();

/**
 * Parses monthly tab titles such as:
 * - "Escala Dez-2026"
 * - "Escala Maio/2027"
 * - "Jan-2027"
 * - "05/2027" or "2027-05"
 */
export function parseEscalaTabTitle(
  title: string
): { ano: number; mes: number } | null {
  const normalized = normalizeToken(title);
  if (!normalized) return null;

  // Pattern 1: "[Escala ]<mes_texto>[-/ ]<YYYY>"
  const textMonthMatch = normalized.match(
    /(?:^|\b)([a-z]{3,10})\s*[-/\s]\s*(20\d{2})(?:\b|$)/
  );
  if (textMonthMatch) {
    const mesNum = MONTH_NAME_MAP[textMonthMatch[1]];
    const anoNum = Number(textMonthMatch[2]);
    if (mesNum && anoNum >= 2020 && anoNum <= 2100) {
      return { ano: anoNum, mes: mesNum };
    }
  }

  // Pattern 2: "[Escala ]<MM>[-/ ]<YYYY>"
  const numMonthFirst = normalized.match(
    /(?:^|\b)(0?[1-9]|1[0-2])\s*[-/]\s*(20\d{2})(?:\b|$)/
  );
  if (numMonthFirst) {
    return {
      ano: Number(numMonthFirst[2]),
      mes: Number(numMonthFirst[1]),
    };
  }

  // Pattern 3: "<YYYY>[-/ ]<MM>"
  const yearFirst = normalized.match(
    /(?:^|\b)(20\d{2})\s*[-/]\s*(0?[1-9]|1[0-2])(?:\b|$)/
  );
  if (yearFirst) {
    return {
      ano: Number(yearFirst[1]),
      mes: Number(yearFirst[2]),
    };
  }

  return null;
}

export function extractYearMonthFromIsoDate(
  isoDate: string
): { ano: number; mes: number } | null {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  if (!Number.isFinite(ano) || mes < 1 || mes > 12) return null;
  return { ano, mes };
}

export function applySlotUpdateToEscalaMap(
  prev: EscalaMensalMap,
  params: {
    isoDate: string;
    slot: SlotKey;
    values: string[];
    applyToTwin: boolean;
  }
): EscalaMensalMap {
  const { isoDate, slot, values, applyToTwin } = params;
  const cleanValues = values.map((v) => v.trim()).filter(Boolean);
  const currentDay = {
    ...emptyConvocacoesDia(),
    ...(prev[isoDate] ?? {}),
  };
  currentDay[slot] = cleanValues;
  if (applyToTwin) {
    currentDay[SLOT_META[slot].twinKey] = cleanValues;
  }

  const hasAny =
    currentDay.apcDia.length > 0 ||
    currentDay.apcNoite.length > 0 ||
    currentDay.dpcDia.length > 0 ||
    currentDay.dpcNoite.length > 0 ||
    currentDay.epcDia.length > 0 ||
    currentDay.epcNoite.length > 0;

  if (!hasAny) {
    const next = { ...prev };
    delete next[isoDate];
    return next;
  }

  return {
    ...prev,
    [isoDate]: currentDay,
  };
}

export function collectYearMonthsWithData(
  escalaMap: EscalaMensalMap,
  ensureYearMonth?: { ano: number; mes: number }
): { ano: number; mes: number }[] {
  const map = new Map<string, { ano: number; mes: number }>();

  for (const [isoDate, day] of Object.entries(escalaMap)) {
    if (!day) continue;
    const hasAny =
      (day.apcDia?.length ?? 0) > 0 ||
      (day.apcNoite?.length ?? 0) > 0 ||
      (day.dpcDia?.length ?? 0) > 0 ||
      (day.dpcNoite?.length ?? 0) > 0 ||
      (day.epcDia?.length ?? 0) > 0 ||
      (day.epcNoite?.length ?? 0) > 0;
    if (!hasAny) continue;

    const ym = extractYearMonthFromIsoDate(isoDate);
    if (ym) {
      map.set(`${ym.ano}-${String(ym.mes).padStart(2, '0')}`, ym);
    }
  }

  if (ensureYearMonth) {
    const key = `${ensureYearMonth.ano}-${String(ensureYearMonth.mes).padStart(2, '0')}`;
    if (!map.has(key)) {
      map.set(key, ensureYearMonth);
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes
  );
}

export function mergeLoadedTabsIntoEscalaMap(params: {
  currentMap: EscalaMensalMap;
  loadedTabs: { ano: number; mes: number; map: EscalaMensalMap }[];
  replaceMatchedMonths?: boolean;
}): EscalaMensalMap {
  const { currentMap, loadedTabs, replaceMatchedMonths = true } = params;
  const next: EscalaMensalMap = { ...currentMap };

  if (replaceMatchedMonths) {
    const matchedPrefixes = new Set(
      loadedTabs.map((t) => `${t.ano}-${String(t.mes).padStart(2, '0')}-`)
    );
    for (const isoDate of Object.keys(next)) {
      for (const prefix of matchedPrefixes) {
        if (isoDate.startsWith(prefix)) {
          delete next[isoDate];
          break;
        }
      }
    }
  }

  for (const tab of loadedTabs) {
    for (const [isoDate, day] of Object.entries(tab.map)) {
      next[isoDate] = day;
    }
  }

  return next;
}

export function buildEscalaSheetValuesWithFooter(
  ano: number,
  mes: number,
  grade: EscalaDiaLinha[]
): (string | number)[][] {
  const rows = buildEscalaSheetValues(ano, mes, grade);
  rows.push([RODAPE_CONVOCACOES_ESCALA, '', '', '', '', '', '', '', '']);
  return rows;
}

function formatSheetRange(sheetTitle: string, cellRange: string): string {
  const escaped = sheetTitle.replace(/'/g, "''");
  return `'${escaped}'!${cellRange}`;
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

function buildFormatRequests(sheetId: number, grade: EscalaDiaLinha[], footerRowIndex: number) {
  const requests: Record<string, unknown>[] = [
    // Title row A1:I1 merge / bold
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 9,
        },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, fontSize: 11 },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(textFormat,horizontalAlignment)',
      },
    },
    // Top subheader row 2
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1,
          endRowIndex: 2,
          startColumnIndex: 0,
          endColumnIndex: 9,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.973, green: 0.98, blue: 0.988 },
            textFormat: { bold: true },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
      },
    },
    // DIA MÊS / DIA SEMANA / EQUIPE header
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 2,
          endRowIndex: 3,
          startColumnIndex: 0,
          endColumnIndex: 3,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.945, green: 0.961, blue: 0.976 },
            textFormat: { bold: true },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
      },
    },
    // APC blue
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
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
      },
    },
    // DPC green
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
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
      },
    },
    // EPC yellow
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
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
      },
    },
  ];

  // Subtle gray background on weekend rows, white on weekdays
  grade.forEach((day, idx) => {
    const rowIndex = 3 + idx;
    const bg = day.isFimDeSemana
      ? { red: 0.91, green: 0.922, blue: 0.937 }
      : { red: 1, green: 1, blue: 1 };
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: rowIndex,
          endRowIndex: rowIndex + 1,
          startColumnIndex: 0,
          endColumnIndex: 9,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: bg,
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment)',
      },
    });
  });

  // Footer note row
  requests.push({
    repeatCell: {
      range: {
        sheetId,
        startRowIndex: footerRowIndex,
        endRowIndex: footerRowIndex + 1,
        startColumnIndex: 0,
        endColumnIndex: 9,
      },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.973, green: 0.98, blue: 0.988 },
          textFormat: { fontSize: 9 },
          horizontalAlignment: 'LEFT',
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
    },
  });

  return requests;
}

/**
 * Loads ALL monthly tabs ("Escala <Mês>-<Ano>") from the dedicated Escalas Mensais spreadsheet
 * in a single batchGet request, returning the metadata + consolidated EscalaMensalMap.
 */
export async function loadAllEscalasFromSpreadsheet(
  accessToken: string,
  spreadsheetId: string
): Promise<{
  sheetInfo: EscalaSpreadsheetInfo;
  escalaMap: EscalaMensalMap;
}> {
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}?fields=${encodeURIComponent(
    'spreadsheetId,properties(title),spreadsheetUrl,sheets(properties(sheetId,title))'
  )}`;

  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!metaRes.ok) {
    await handleGoogleApiError(
      metaRes,
      'Não foi possível acessar a planilha de Escalas Mensais no Google Drive.'
    );
  }

  const meta = await metaRes.json();
  const rawTabs: { sheetId: number; title: string }[] = (meta.sheets ?? []).map(
    (s: { properties: { sheetId: number; title: string } }) => ({
      sheetId: s.properties.sheetId,
      title: s.properties.title,
    })
  );

  const matchedTabs = rawTabs
    .map((tab) => {
      const parsed = parseEscalaTabTitle(tab.title);
      if (!parsed) return null;
      return {
        ...tab,
        ano: parsed.ano,
        mes: parsed.mes,
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null)
    .sort((a, b) => (a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes));

  let escalaMap: EscalaMensalMap = {};
  const loadedTabs: LoadedEscalaTabSummary[] = [];

  if (matchedTabs.length > 0) {
    const query = matchedTabs
      .map((t) => `ranges=${encodeURIComponent(formatSheetRange(t.title, 'A:I'))}`)
      .join('&');
    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchGet?${query}&valueRenderOption=UNFORMATTED_VALUE`;

    const batchRes = await fetch(batchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!batchRes.ok) {
      await handleGoogleApiError(
        batchRes,
        'Erro ao ler as abas mensais da planilha de Escalas.'
      );
    }

    const batchData = await batchRes.json();
    const valueRanges: { values?: (string | number)[][] }[] =
      batchData.valueRanges ?? [];

    const parsedTabs = matchedTabs.map((tab, idx) => {
      const rows = valueRanges[idx]?.values ?? [];
      const tabMap = parseEscalaSheetRows(rows, tab.ano, tab.mes);
      const diasPreenchidos = Object.keys(tabMap).length;
      loadedTabs.push({
        sheetId: tab.sheetId,
        tabTitle: tab.title,
        ano: tab.ano,
        mes: tab.mes,
        diasPreenchidos,
      });
      return {
        ano: tab.ano,
        mes: tab.mes,
        map: tabMap,
      };
    });

    escalaMap = mergeLoadedTabsIntoEscalaMap({
      currentMap: {},
      loadedTabs: parsedTabs,
      replaceMatchedMonths: true,
    });
  }

  const firstTab = rawTabs[0] ?? { sheetId: 0, title: 'Escala' };
  const sheetInfo: EscalaSpreadsheetInfo = {
    spreadsheetId: meta.spreadsheetId || spreadsheetId,
    spreadsheetTitle: meta.properties?.title || ESCALA_SPREADSHEET_DEFAULT_TITLE,
    sheetTitle: loadedTabs[0]?.tabTitle || firstTab.title,
    sheetId: loadedTabs[0]?.sheetId ?? firstTab.sheetId,
    webViewLink: meta.spreadsheetUrl,
    availableTabs: rawTabs,
    loadedTabs,
  };

  return { sheetInfo, escalaMap };
}

/**
 * Creates a brand-new 3rd spreadsheet exclusively for Escalas Mensais, seeding
 * tabs for any months with existing local data plus the active reference month.
 */
export async function createEscalaSpreadsheet(params: {
  accessToken: string;
  anoAtual: number;
  mesAtual: number;
  escalaMap: EscalaMensalMap;
  lancamentos: LancamentoAvaliado[];
}): Promise<{
  sheetInfo: EscalaSpreadsheetInfo;
  escalaMap: EscalaMensalMap;
}> {
  const { accessToken, anoAtual, mesAtual, escalaMap, lancamentos } = params;
  const yearMonths = collectYearMonthsWithData(escalaMap, {
    ano: anoAtual,
    mes: mesAtual,
  });

  const sheetsConfig = yearMonths.map((ym) => ({
    properties: {
      title: getEscalaTabTitle(ym.ano, ym.mes),
      gridProperties: { frozenRowCount: 3 },
    },
  }));

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: ESCALA_SPREADSHEET_DEFAULT_TITLE,
        locale: 'pt_BR',
      },
      sheets: sheetsConfig,
    }),
  });

  if (!createRes.ok) {
    await handleGoogleApiError(
      createRes,
      'Não foi possível criar a planilha exclusiva de Escalas Mensais no Google Drive.'
    );
  }

  const created = await createRes.json();
  const spreadsheetId: string = created.spreadsheetId;
  const createdSheets: { properties: { sheetId: number; title: string } }[] =
    created.sheets ?? [];

  const batchValueData: { range: string; values: (string | number)[][] }[] = [];
  const formatRequests: Record<string, unknown>[] = [];

  yearMonths.forEach((ym, idx) => {
    const tabProp = createdSheets[idx]?.properties;
    const tabTitle = tabProp?.title || getEscalaTabTitle(ym.ano, ym.mes);
    const grade = gerarGradeEscalaMensal({
      ano: ym.ano,
      mes: ym.mes,
      lancamentos,
      escalaMap,
    });
    const values = buildEscalaSheetValuesWithFooter(ym.ano, ym.mes, grade);
    batchValueData.push({
      range: formatSheetRange(tabTitle, `A1:I${values.length}`),
      values,
    });
    if (tabProp) {
      formatRequests.push(
        ...buildFormatRequests(tabProp.sheetId, grade, values.length - 1)
      );
    }
  });

  if (batchValueData.length > 0) {
    const writeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: batchValueData,
        }),
      }
    );
    if (!writeRes.ok) {
      await handleGoogleApiError(
        writeRes,
        'Planilha criada, mas houve erro ao preencher as abas iniciais de Escala Mensal.'
      );
    }
  }

  if (formatRequests.length > 0) {
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
        body: JSON.stringify({ requests: formatRequests }),
      }
    );
  }

  const loaded = await loadAllEscalasFromSpreadsheet(accessToken, spreadsheetId);
  return loaded;
}

/**
 * Upserts a single monthly tab ("Escala <Mês>-<Ano>") inside the dedicated
 * Escalas Mensais spreadsheet (used automatically when saving any slot).
 */
export async function upsertEscalaMonthInSpreadsheet(params: {
  accessToken: string;
  spreadsheetId: string;
  ano: number;
  mes: number;
  grade: EscalaDiaLinha[];
}): Promise<{
  sheetTitle: string;
  sheetId: number;
  diasPreenchidos: number;
}> {
  const { accessToken, spreadsheetId, ano, mes, grade } = params;
  const targetTitle = getEscalaTabTitle(ano, mes);

  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}?fields=${encodeURIComponent('sheets(properties(sheetId,title))')}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!metaRes.ok) {
    await handleGoogleApiError(
      metaRes,
      'Erro ao consultar abas da planilha de Escalas Mensais.'
    );
  }

  const meta = await metaRes.json();
  const existingTab = (meta.sheets ?? []).find((s: { properties: { sheetId: number; title: string } }) => {
    const t = s.properties.title;
    if (t.toLowerCase() === targetTitle.toLowerCase()) return true;
    const parsed = parseEscalaTabTitle(t);
    return parsed?.ano === ano && parsed?.mes === mes;
  });

  let sheetId: number;
  let finalTitle = targetTitle;

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
          requests: [
            {
              addSheet: {
                properties: {
                  title: targetTitle,
                  gridProperties: { frozenRowCount: 3 },
                },
              },
            },
          ],
        }),
      }
    );
    if (!addRes.ok) {
      await handleGoogleApiError(
        addRes,
        `Não foi possível criar a aba "${targetTitle}" na planilha de Escalas.`
      );
    }
    const added = await addRes.json();
    sheetId = added.replies[0].addSheet.properties.sheetId;
  }

  const values = buildEscalaSheetValuesWithFooter(ano, mes, grade);
  const putRange = encodeURIComponent(
    formatSheetRange(finalTitle, `A1:I${values.length}`)
  );

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
    await handleGoogleApiError(
      putRes,
      `Erro ao gravar a aba "${finalTitle}" no Google Sheets.`
    );
  }

  // Apply clean table formatting
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
        requests: buildFormatRequests(sheetId, grade, values.length - 1),
      }),
    }
  );

  const diasPreenchidos = grade.filter(
    (d) =>
      d.convocacoes.apcDia.length > 0 ||
      d.convocacoes.apcNoite.length > 0 ||
      d.convocacoes.dpcDia.length > 0 ||
      d.convocacoes.dpcNoite.length > 0 ||
      d.convocacoes.epcDia.length > 0 ||
      d.convocacoes.epcNoite.length > 0
  ).length;

  return {
    sheetTitle: finalTitle,
    sheetId,
    diasPreenchidos,
  };
}
