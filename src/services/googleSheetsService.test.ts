import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSheetRows,
  registroToSheetRow,
  SPREADSHEET_HEADERS,
} from './googleSheetsService';

test('lê novo layout reorganizado com Tipo de Afastamento a partir da linha 2', () => {
  const rows: (string | number)[][] = [
    [...SPREADSHEET_HEADERS],
    ['Alfa', 'Dr. Eduardo Mendes', 'Delegado', 'Férias', '2027-03-08', '2027-03-22', 15],
    ['Bravo', 'Lucas Silveira', 'Agente', 'Licença-Prêmio', '05/07/2027', '19/07/2027', 15],
    ['Charlie', 'Bruno Teixeira', 'Agente', 'Afastamento Médico (LTS/LTF)', '2027-05-03', '2027-05-12', 10],
    ['Coordenação', 'Beatriz Monteiro', 'Escrivão', 'Curso/Convocação', '2027-08-02', '2027-08-16', 15],
  ];

  const parsed = parseSheetRows(rows);
  assert.equal(parsed.headerRowIndex, 0);
  assert.equal(parsed.columnMap.layout, 'single');
  assert.equal(parsed.registros.length, 4);
  assert.equal(parsed.registros[0].rowIndex, 2);
  assert.equal(parsed.registros[0].tipo, 'Férias');
  assert.equal(parsed.registros[1].tipo, 'Licença-Prêmio');
  assert.equal(parsed.registros[1].inicio, '2027-07-05');
  assert.equal(parsed.registros[2].tipo, 'Afastamento Médico (LTS/LTF)');
  assert.equal(parsed.registros[3].tipo, 'Curso/Convocação');
  assert.equal(parsed.lastDataRowIndex, 5);
});

test('sempre ignora a linha 1 (cabeçalho) e lê dados somente a partir da linha 2', () => {
  // Even if row 1 has unrecognized/custom header labels, it must never be treated as an officer row
  const rows: (string | number)[][] = [
    ['Col1', 'Col2', 'Col3', 'Col4', 'Col5', 'Col6', 'Col7'],
    ['Alfa', 'Servidor Linha 2', 'Agente', 'Licença-Prêmio', '2027-04-05', '2027-04-19', 15],
  ];

  const parsed = parseSheetRows(rows);
  assert.equal(parsed.headerRowIndex, 0);
  assert.equal(parsed.registros.length, 1);
  assert.equal(parsed.registros[0].servidor, 'Servidor Linha 2');
  assert.equal(parsed.registros[0].rowIndex, 2);
  assert.equal(parsed.registros[0].tipo, 'Licença-Prêmio');
  assert.equal(parsed.lastDataRowIndex, 2);
});

test('planilha só com cabeçalho na linha 1 retorna 0 registros e aponta próximo insert para linha 2', () => {
  const rows: (string | number)[][] = [[...SPREADSHEET_HEADERS]];
  const parsed = parseSheetRows(rows);
  assert.equal(parsed.registros.length, 0);
  assert.equal(parsed.lastDataRowIndex, 1);
});

test('detecta cabeçalho mesmo após linhas de título e linhas em branco', () => {
  const rows: (string | number)[][] = [
    ['CONTROLE DE AFASTAMENTOS - CPP JOINVILLE'],
    [],
    [...SPREADSHEET_HEADERS],
    ['Alfa', 'Novo Servidor Teste', 'Agente', 'Curso/Convocação', '10/04/2027', '24/04/2027', 15],
  ];

  const parsed = parseSheetRows(rows);
  assert.equal(parsed.headerRowIndex, 2);
  assert.equal(parsed.registros.length, 1);
  assert.equal(parsed.registros[0].servidor, 'Novo Servidor Teste');
  assert.equal(parsed.registros[0].rowIndex, 4);
  assert.equal(parsed.registros[0].tipo, 'Curso/Convocação');
  assert.equal(parsed.registros[0].inicio, '2027-04-10');
  assert.equal(parsed.registros[0].fim, '2027-04-24');
  assert.equal(parsed.lastDataRowIndex, 4);
});

test('suporta planilhas legadas com 2 períodos na mesma linha lendo a partir da linha 2', () => {
  const rows: (string | number)[][] = [
    [
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
    ],
    [
      'Bravo',
      'Servidor Legado',
      'Delegado',
      '2027-05-03',
      '2027-05-17',
      15,
      '2027-09-01',
      '2027-09-15',
      15,
      30,
    ],
  ];

  const parsed = parseSheetRows(rows);
  assert.equal(parsed.columnMap.layout, 'legacy2');
  assert.equal(parsed.registros.length, 2);
  assert.equal(parsed.registros[0].rowIndex, 2);
  assert.equal(parsed.registros[0].legacySlot, 1);
  assert.equal(parsed.registros[0].tipo, 'Férias');
  assert.equal(parsed.registros[1].legacySlot, 2);
  assert.equal(parsed.registros[1].inicio, '2027-09-01');
});

test('lê registros além da linha 500 ignorando linhas de fórmula vazias', () => {
  const rows: (string | number)[][] = [
    [...SPREADSHEET_HEADERS],
    ['Bravo', 'Servidor Linha 2', 'Delegado', 'Férias', '2027-05-03', '2027-05-17', 15],
  ];

  for (let i = 0; i < 510; i++) {
    rows.push(['', '', '', '', '', '', '']);
  }
  rows.push(['Charlie', 'Servidor Linha 513', 'Escrivão', 'Licença-Prêmio', '2027-08-02', '2027-08-16', 15]);

  const parsed = parseSheetRows(rows);
  assert.equal(parsed.registros.length, 2);
  assert.equal(parsed.registros[1].servidor, 'Servidor Linha 513');
  assert.equal(parsed.registros[1].rowIndex, 513);
  assert.equal(parsed.registros[1].tipo, 'Licença-Prêmio');
});

test('registroToSheetRow gera 7 colunas na ordem correta', () => {
  const row = registroToSheetRow({
    id: 't1',
    equipe: 'Delta',
    servidor: 'Aline Ferreira',
    cargo: 'Agente',
    tipo: 'Afastamento Médico (LTS/LTF)',
    inicio: '2027-06-07',
    fim: '2027-06-21',
  });
  assert.deepEqual(row, [
    'Delta',
    'Aline Ferreira',
    'Agente',
    'Afastamento Médico (LTS/LTF)',
    '2027-06-07',
    '2027-06-21',
    15,
  ]);
});

test('lê cabeçalhos "Afastamento / Data inicial do Afastamento / Data final do Afastamento" e preenche lançamento com apenas 1 data informada', () => {
  const rows: (string | number)[][] = [
    [
      'Equipe',
      'Servidor',
      'Cargo',
      'Afastamento',
      'Data inicial do Afastamento',
      'Data final do Afastamento',
      'Dias de Afastamento',
    ],
    ['Alfa', 'DANILO BESSA BRILHANTE', 'Delegado', 'Férias', '', '', ''],
    ['Terceirizado', 'IRENE APARECIDA DE ANDRADE', 'Terceirizado', 'Afastamento Médico (LTS/LTF)', '2026-11-09', '2026-11-11', 3],
    ['Terceirizado', 'HYORRAN PATRICK COSTA PEREIRA', 'Terceirizado', 'Férias', '2026-12-21', '2027-01-21', 32],
    ['Terceirizado', 'HYORRAN PATRICK COSTA PEREIRA', 'Terceirizado', 'Curso/Convocação', '', '2026-11-11', 1],
  ];

  const parsed = parseSheetRows(rows);
  assert.equal(parsed.columnMap.colTipo, 3);
  assert.equal(parsed.columnMap.colIni1, 4);
  assert.equal(parsed.columnMap.colFim1, 5);
  assert.equal(parsed.columnMap.colDias1, 6);
  assert.equal(parsed.registros.length, 3);

  assert.equal(parsed.registros[0].servidor, 'IRENE APARECIDA DE ANDRADE');
  assert.equal(parsed.registros[0].tipo, 'Afastamento Médico (LTS/LTF)');
  assert.equal(parsed.registros[0].inicio, '2026-11-09');
  assert.equal(parsed.registros[0].fim, '2026-11-11');

  assert.equal(parsed.registros[1].tipo, 'Férias');
  assert.equal(parsed.registros[2].servidor, 'HYORRAN PATRICK COSTA PEREIRA');
  assert.equal(parsed.registros[2].tipo, 'Curso/Convocação');
  assert.equal(parsed.registros[2].inicio, '2026-11-11');
  assert.equal(parsed.registros[2].fim, '2026-11-11');
});
