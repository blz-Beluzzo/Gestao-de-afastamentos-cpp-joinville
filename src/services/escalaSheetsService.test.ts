import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applySlotUpdateToEscalaMap,
  buildEscalaSheetValuesWithFooter,
  collectYearMonthsWithData,
  extractYearMonthFromIsoDate,
  mergeLoadedTabsIntoEscalaMap,
  parseEscalaTabTitle,
} from './escalaSheetsService';
import { parseEscalaSheetRows } from './delegadosSheetsService';
import { gerarGradeEscalaMensal, RODAPE_CONVOCACOES_ESCALA } from '../utils/escalaMensalUtils';

test('parseEscalaTabTitle reconhece abas mensais em diversos formatos e ignora abas não mensais', () => {
  assert.deepEqual(parseEscalaTabTitle('Escala Dez-2026'), { ano: 2026, mes: 12 });
  assert.deepEqual(parseEscalaTabTitle('Escala Jan-2027'), { ano: 2027, mes: 1 });
  assert.deepEqual(parseEscalaTabTitle('Escala Maio/2027'), { ano: 2027, mes: 5 });
  assert.deepEqual(parseEscalaTabTitle('Escala Março-2027'), { ano: 2027, mes: 3 });
  assert.deepEqual(parseEscalaTabTitle('08/2027'), { ano: 2027, mes: 8 });
  assert.deepEqual(parseEscalaTabTitle('2027-11'), { ano: 2027, mes: 11 });
  assert.equal(parseEscalaTabTitle('Página1'), null);
  assert.equal(parseEscalaTabTitle('Delegados'), null);
  assert.equal(parseEscalaTabTitle('Resumo Geral'), null);
});

test('extractYearMonthFromIsoDate e collectYearMonthsWithData ordenam cronologicamente meses com dados', () => {
  assert.deepEqual(extractYearMonthFromIsoDate('2027-05-03'), { ano: 2027, mes: 5 });
  assert.equal(extractYearMonthFromIsoDate('invalido'), null);

  const yearMonths = collectYearMonthsWithData(
    {
      '2027-08-10': { dpcDia: ['Caroline'] },
      '2026-12-02': { dpcDia: ['Paulo S.'], dpcNoite: ['Paulo S.'] },
      '2027-02-01': {}, // empty day must be ignored
    },
    { ano: 2027, mes: 5 }
  );

  assert.deepEqual(yearMonths, [
    { ano: 2026, mes: 12 },
    { ano: 2027, mes: 5 },
    { ano: 2027, mes: 8 },
  ]);
});

test('applySlotUpdateToEscalaMap atualiza turno único ou gêmeo e remove dias totalmente limpos', () => {
  const step1 = applySlotUpdateToEscalaMap(
    {},
    {
      isoDate: '2027-05-03',
      slot: 'dpcDia',
      values: ['Paulo S.'],
      applyToTwin: true,
    }
  );
  assert.deepEqual(step1['2027-05-03']?.dpcDia, ['Paulo S.']);
  assert.deepEqual(step1['2027-05-03']?.dpcNoite, ['Paulo S.']);

  const step2 = applySlotUpdateToEscalaMap(step1, {
    isoDate: '2027-05-03',
    slot: 'dpcDia',
    values: [],
    applyToTwin: true,
  });
  assert.equal(step2['2027-05-03'], undefined);
});

test('mergeLoadedTabsIntoEscalaMap substitui meses carregados preservando outros meses não carregados', () => {
  const merged = mergeLoadedTabsIntoEscalaMap({
    currentMap: {
      '2027-05-03': { dpcDia: ['Antigo'] },
      '2027-06-10': { epcDia: ['3ª DPCo'] },
    },
    loadedTabs: [
      {
        ano: 2027,
        mes: 5,
        map: {
          '2027-05-07': { dpcDia: ['Caroline'] },
        },
      },
      {
        ano: 2027,
        mes: 8,
        map: {
          '2027-08-12': { apcDia: ['DIC - DH'] },
        },
      },
    ],
    replaceMatchedMonths: true,
  });

  assert.equal(merged['2027-05-03'], undefined);
  assert.deepEqual(merged['2027-05-07']?.dpcDia, ['Caroline']);
  assert.deepEqual(merged['2027-06-10']?.epcDia, ['3ª DPCo']);
  assert.deepEqual(merged['2027-08-12']?.apcDia, ['DIC - DH']);
});

test('buildEscalaSheetValuesWithFooter inclui rodapé institucional sem quebrar parseEscalaSheetRows', () => {
  const grade = gerarGradeEscalaMensal({
    ano: 2027,
    mes: 5,
    lancamentos: [],
    escalaMap: {
      '2027-05-03': {
        dpcDia: ['Eli'],
        dpcNoite: ['Eli'],
      },
    },
  });

  const values = buildEscalaSheetValuesWithFooter(2027, 5, grade);
  assert.equal(values[values.length - 1][0], RODAPE_CONVOCACOES_ESCALA);

  const parsedBack = parseEscalaSheetRows(values, 2027, 5);
  assert.deepEqual(parsedBack['2027-05-03']?.dpcDia, ['Eli']);
  assert.deepEqual(parsedBack['2027-05-03']?.dpcNoite, ['Eli']);
  assert.equal(Object.keys(parsedBack).length, 1);
});
