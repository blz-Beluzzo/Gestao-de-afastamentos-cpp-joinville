import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSheetRows } from './googleSheetsService';

test('detecta cabeçalho mesmo após linhas de título e linhas em branco', () => {
  const rows: (string | number)[][] = [
    ['PROGRAMAÇÃO DE FÉRIAS 2027 - CPP JOINVILLE'],
    [],
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
    ['Alfa', 'Novo Servidor Teste', 'Agente', '10/04/2027', '24/04/2027', 15, '', '', '', 15],
  ];

  const parsed = parseSheetRows(rows);
  assert.equal(parsed.headerRowIndex, 2);
  assert.equal(parsed.registros.length, 1);
  assert.equal(parsed.registros[0].servidor, 'Novo Servidor Teste');
  assert.equal(parsed.registros[0].rowIndex, 4);
  assert.equal(parsed.registros[0].inicio1, '2027-04-10');
  assert.equal(parsed.registros[0].fim1, '2027-04-24');
  assert.equal(parsed.lastDataRowIndex, 4);
});

test('lê registros além da linha 500 ignorando linhas de fórmula vazias', () => {
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
    ['Bravo', 'Servidor Linha 2', 'Delegado', '2027-05-03', '2027-05-17', 15, '', '', '', 15],
  ];

  // Simulate 510 empty pre-formatted formula rows containing 0 in Total de dias
  for (let i = 0; i < 510; i++) {
    rows.push(['', '', '', '', '', '', '', '', '', 0]);
  }
  rows.push(['Charlie', 'Servidor Linha 513', 'Escrivão', '2027-08-02', '2027-08-16', 15, '', '', '', 15]);

  const parsed = parseSheetRows(rows);
  assert.equal(parsed.registros.length, 2);
  assert.equal(parsed.registros[1].servidor, 'Servidor Linha 513');
  assert.equal(parsed.registros[1].rowIndex, 513);
});

test('lê servidor gravado na linha 1 quando a planilha não possui linha de cabeçalho', () => {
  const rows: (string | number)[][] = [
    ['Alfa', 'Servidor Linha 1', 'Agente', '2027-04-05', '2027-04-19', 15, '', '', '', 15],
  ];

  const parsed = parseSheetRows(rows);
  assert.equal(parsed.hasHeaderRow, false);
  assert.equal(parsed.registros.length, 1);
  assert.equal(parsed.registros[0].servidor, 'Servidor Linha 1');
  assert.equal(parsed.registros[0].rowIndex, 1);
  assert.equal(parsed.registros[0].equipe, 'Alfa');
  assert.equal(parsed.registros[0].inicio1, '2027-04-05');
  assert.equal(parsed.lastDataRowIndex, 1);
});

test('ignora título de uma célula sem cabeçalho e lê dados a partir da linha seguinte', () => {
  const rows: (string | number)[][] = [
    ['CPP JOINVILLE - FÉRIAS 2027'],
    ['Delta', 'Servidor Sem Cabeçalho', 'Delegado', '2027-07-01', '2027-07-15', 15, '', '', '', 15],
  ];

  const parsed = parseSheetRows(rows);
  assert.equal(parsed.hasHeaderRow, false);
  assert.equal(parsed.registros.length, 1);
  assert.equal(parsed.registros[0].servidor, 'Servidor Sem Cabeçalho');
  assert.equal(parsed.registros[0].rowIndex, 2);
});

test('reconhece variações de cabeçalho em português', () => {
  const rows: (string | number)[][] = [
    ['Plantão', 'Policial', 'Função', 'Início 1', 'Término 1', 'Dias 1', 'Início 2', 'Término 2'],
    ['Bravo', 'Agente Exemplo', 'Escrivão', '10/06/2027', '24/06/2027', 15, '', ''],
  ];

  const parsed = parseSheetRows(rows);
  assert.equal(parsed.hasHeaderRow, true);
  assert.equal(parsed.registros.length, 1);
  assert.equal(parsed.registros[0].servidor, 'Agente Exemplo');
  assert.equal(parsed.registros[0].equipe, 'Bravo');
  assert.equal(parsed.registros[0].cargo, 'Escrivão');
  assert.equal(parsed.registros[0].inicio1, '2027-06-10');
});

test('planilha completamente vazia retorna 0 servidores e hasHeaderRow false', () => {
  const parsed = parseSheetRows([]);
  assert.equal(parsed.hasHeaderRow, false);
  assert.equal(parsed.registros.length, 0);
  assert.equal(parsed.lastDataRowIndex, 0);
});

