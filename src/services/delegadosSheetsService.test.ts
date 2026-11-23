import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEscalaSheetValues,
  delegadoToSheetRow,
  normalizarDelegacia,
  parseDelegadosRows,
  parseEscalaSheetRows,
} from './delegadosSheetsService';
import { gerarGradeEscalaMensal } from '../utils/escalaMensalUtils';

test('normalizarDelegacia reconhece delegacias oficiais ignorando maiúsculas e acentos', () => {
  assert.equal(normalizarDelegacia('1a dpco'), '1ª DPCo');
  assert.equal(normalizarDelegacia('DEAM - Joinville'), 'DEAM - Joinville');
  assert.equal(normalizarDelegacia('sao francisco do sul - dpcami'), 'São Francisco do Sul - DPCAMI');
  assert.equal(normalizarDelegacia('DIC - DH'), 'DIC - DH');
  assert.equal(normalizarDelegacia('Delegacia Custom'), 'Delegacia Custom');
});

test('parseDelegadosRows lê tabela de delegados com variações de cabeçalho a partir da linha seguinte', () => {
  const rows: (string | number)[][] = [
    ['RELAÇÃO DE DELEGADOS PARA CONVOCAÇÃO'],
    ['Nome do Delegado', 'Delegacia de Origem'],
    ['Paulo S.', '1ª dpco'],
    ['Caroline', 'DEAM - Joinville'],
    ['', ''],
    ['Filipe B.', 'DIC - DH'],
  ];

  const parsed = parseDelegadosRows(rows);
  assert.equal(parsed.headerRowIndex, 1);
  assert.equal(parsed.delegados.length, 3);
  assert.equal(parsed.delegados[0].nome, 'Paulo S.');
  assert.equal(parsed.delegados[0].delegacia, '1ª DPCo');
  assert.equal(parsed.delegados[0].rowIndex, 3);
  assert.equal(parsed.delegados[2].rowIndex, 6);
  assert.equal(parsed.lastDataRowIndex, 6);
});

test('delegadoToSheetRow gera linha [nome, delegacia]', () => {
  assert.deepEqual(
    delegadoToSheetRow({ nome: 'Eli ', delegacia: ' Araquari - DPCO' }),
    ['Eli', 'Araquari - DPCO']
  );
});

test('buildEscalaSheetValues e parseEscalaSheetRows preservam os lançamentos da Escala Mensal', () => {
  const grade = gerarGradeEscalaMensal({
    ano: 2026,
    mes: 12,
    lancamentos: [],
    escalaMap: {
      '2026-12-02': {
        dpcDia: ['Paulo S.'],
        dpcNoite: ['Paulo S.'],
      },
      '2026-12-03': {
        apcDia: ['DIC - DH', '3ª DPCo'],
        epcNoite: ['DEACLE - Joinville'],
      },
    },
  });

  const values = buildEscalaSheetValues(2026, 12, grade);
  assert.equal(values[0][0], 'CRPP JOINVILLE - ESCALA DEZEMBRO/2026');
  assert.equal(values[2][0], 'DIA MÊS');
  assert.equal(values[3][0], 1);
  assert.equal(values[3][2], 'CHARLIE');
  assert.equal(values[4][5], 'Paulo S.');

  const parsedMap = parseEscalaSheetRows(values, 2026, 12);
  assert.deepEqual(parsedMap['2026-12-02']?.dpcDia, ['Paulo S.']);
  assert.deepEqual(parsedMap['2026-12-02']?.dpcNoite, ['Paulo S.']);
  assert.deepEqual(parsedMap['2026-12-03']?.apcDia, ['DIC - DH', '3ª DPCo']);
  assert.deepEqual(parsedMap['2026-12-03']?.epcNoite, ['DEACLE - Joinville']);
});
