import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASSINATURA_DIGITAL_SELO,
  calcularResumoEscalaMensal,
  calcularVacanciasDoDia,
  COORDENADOR_TITULO_INSTITUCIONAL,
  formatarDataAssinaturaJoinville,
  gerarGradeEscalaMensal,
  montarAssinaturaCoordenador,
  obterAfastadosDoMes,
  obterDiaSemanaEscala,
  obterEquipePlantao,
} from './escalaMensalUtils';
import { avaliarTodosLancamentos } from './validarFerias';
import { SEED_FERIAS_2027 } from '../data/seedFerias2027';

test('escala 24x72 respeita o ciclo ancorado em 01/12/2026 = Charlie', () => {
  assert.equal(obterEquipePlantao('2026-12-01'), 'Charlie');
  assert.equal(obterEquipePlantao('2026-12-02'), 'Delta');
  assert.equal(obterEquipePlantao('2026-12-03'), 'Alfa');
  assert.equal(obterEquipePlantao('2026-12-04'), 'Bravo');
  assert.equal(obterEquipePlantao('2026-12-05'), 'Charlie');
  assert.equal(obterEquipePlantao('2026-12-30'), 'Delta');
  assert.equal(obterEquipePlantao('2026-12-31'), 'Alfa');
  assert.equal(obterEquipePlantao('2027-01-01'), 'Bravo');
  assert.equal(obterEquipePlantao('2026-11-30'), 'Bravo');
  assert.equal(obterEquipePlantao('2026-11-27'), 'Charlie');
});

test('dia da semana da escala segue rótulos 2ª..6ª, sábado e domingo', () => {
  assert.equal(obterDiaSemanaEscala('2026-12-01').label, '3ª');
  assert.equal(obterDiaSemanaEscala('2026-12-01').isWeekend, false);
  assert.equal(obterDiaSemanaEscala('2026-12-05').label, 'sábado');
  assert.equal(obterDiaSemanaEscala('2026-12-05').isWeekend, true);
  assert.equal(obterDiaSemanaEscala('2026-12-06').label, 'domingo');
  assert.equal(obterDiaSemanaEscala('2026-12-06').isWeekend, true);
  assert.equal(obterDiaSemanaEscala('2026-12-31').label, '5ª');
});

test('Delta sempre exige convocação de Delegado mesmo sem afastamento lançado', () => {
  const vacDelta = calcularVacanciasDoDia('Delta', []);
  assert.equal(vacDelta.dpc, 1);
  assert.equal(vacDelta.apc, 0);
  assert.equal(vacDelta.epc, 0);
  assert.ok(vacDelta.motivosDpc[0].includes('sem Delegado fixo'));

  const vacAlfa = calcularVacanciasDoDia('Alfa', []);
  assert.equal(vacAlfa.dpc, 0);
  assert.equal(vacAlfa.apc, 0);
  assert.equal(vacAlfa.epc, 0);
});

test('calcula vacâncias de APC (até 2), DPC e EPC com base nos afastamentos do dia', () => {
  const avaliados = avaliarTodosLancamentos(SEED_FERIAS_2027);
  // Outubro/2027: Cayo Filipe (13..27/10) e Rafael Borges (10..24/10) — ambos APC Alfa
  const gradeOut2027 = gerarGradeEscalaMensal({
    ano: 2027,
    mes: 10,
    lancamentos: avaliados,
    escalaMap: {},
  });

  const diasAlfa = gradeOut2027.filter((d) => d.equipePlantao === 'Alfa');
  assert.ok(diasAlfa.length > 0);

  // Pick a day between Oct 13 and Oct 24 where Alfa is on duty
  const diaOverlap = diasAlfa.find(
    (d) => d.isoDate >= '2027-10-13' && d.isoDate <= '2027-10-24'
  );
  assert.ok(diaOverlap);
  assert.equal(diaOverlap.vacancias.apc, 2);
  assert.equal(diaOverlap.vacancias.motivosApc.length, 2);

  // Dezembro/2026: 31 dias, todas as 8 escalas de Delta têm vacância de DPC
  const gradeDez2026 = gerarGradeEscalaMensal({
    ano: 2026,
    mes: 12,
    lancamentos: avaliados,
    escalaMap: {
      '2026-12-02': {
        dpcDia: ['Paulo S.'],
        dpcNoite: ['Paulo S.'],
      },
    },
  });

  assert.equal(gradeDez2026.length, 31);
  assert.equal(gradeDez2026[0].equipePlantao, 'Charlie');
  assert.equal(gradeDez2026[1].equipePlantao, 'Delta');
  assert.equal(gradeDez2026[30].equipePlantao, 'Alfa');

  const afastadosDez2026 = obterAfastadosDoMes(avaliados, 2026, 12);
  const resumo = calcularResumoEscalaMensal(gradeDez2026, afastadosDez2026);
  // Delta works on Dec 2, 6, 10, 14, 18, 22, 26, 30 => 8 days * 2 turns (dia + noite) = 16 DPC slots
  assert.equal(resumo.totalTurnosVacancia, 16);
  assert.equal(resumo.totalTurnosPreenchidos, 2);
  assert.equal(resumo.totalTurnosPendentes, 14);
  assert.equal(resumo.diasComFuro, 7);
});

test('obterAfastadosDoMes recorta corretamente o período ao mês de referência e exclui terceirizados', () => {
  const avaliados = avaliarTodosLancamentos(SEED_FERIAS_2027);
  // Juliana Freitas has 2027-11-22 to 2027-12-06
  const afastadosDez2027 = obterAfastadosDoMes(avaliados, 2027, 12);
  assert.equal(afastadosDez2027.length, 1);
  assert.equal(afastadosDez2027[0].lancamento.servidor, 'Juliana Freitas');
  assert.equal(afastadosDez2027[0].inicioNoMes, '2027-12-01');
  assert.equal(afastadosDez2027[0].fimNoMes, '2027-12-06');
  assert.equal(afastadosDez2027[0].diasNoMes, 6);
  assert.equal(afastadosDez2027[0].pertenceEquipePlantao, true);

  // Maio/2027: Cláudia Pereira (Terceirizado, 05..24/05) NÃO deve aparecer nos afastados da escala
  const afastadosMai2027 = obterAfastadosDoMes(avaliados, 2027, 5);
  assert.equal(
    afastadosMai2027.some((a) => a.lancamento.equipe === 'Terceirizado'),
    false
  );
  assert.equal(
    afastadosMai2027.some((a) => a.lancamento.servidor === 'Cláudia Pereira'),
    false
  );
  assert.equal(afastadosMai2027.length, 6);

  // Agosto/2027: Sérgio Almeida (Terceirizado, 11..20/08) NÃO deve aparecer nos afastados da escala
  const afastadosAgo2027 = obterAfastadosDoMes(avaliados, 2027, 8);
  assert.equal(
    afastadosAgo2027.some((a) => a.lancamento.equipe === 'Terceirizado'),
    false
  );
  assert.equal(
    afastadosAgo2027.some((a) => a.lancamento.servidor === 'Sérgio Almeida'),
    false
  );
  assert.equal(afastadosAgo2027.length, 4);

  // Mesmo se um registro tiver cargo Terceirizado com outra equipe, não entra na grade nem gera vacância
  const registroCargoTerc = {
    id: 'terc-custom',
    equipe: 'Alfa' as const,
    servidor: 'Terceirizado Avulso',
    cargo: 'Terceirizado' as const,
    tipo: 'Férias' as const,
    inicio: '2026-12-03',
    fim: '2026-12-03',
  };
  const avaliadoComTerc = avaliarTodosLancamentos([registroCargoTerc]);
  assert.equal(obterAfastadosDoMes(avaliadoComTerc, 2026, 12).length, 0);
  const grade = gerarGradeEscalaMensal({
    ano: 2026,
    mes: 12,
    lancamentos: avaliadoComTerc,
    escalaMap: {},
  });
  assert.equal(grade[2].afastadosEquipeNoDia.length, 0);
  assert.equal(grade[2].vacancias.apc, 0);
});

test('montarAssinaturaCoordenador formata padrão institucional com data automática sem horário', () => {
  const refDate = new Date(2026, 9, 27, 15, 42, 10); // 27/10/2026 15:42:10
  const dataTxt = formatarDataAssinaturaJoinville(refDate);
  assert.equal(dataTxt, 'Joinville, 27/10/2026');
  assert.equal(dataTxt.includes(':'), false);

  const assinatura = montarAssinaturaCoordenador('  Fábio Fortes  ', refDate);
  assert.equal(assinatura.localData, 'Joinville, 27/10/2026');
  assert.equal(assinatura.nome, 'Fábio Fortes');
  assert.equal(assinatura.cargo, COORDENADOR_TITULO_INSTITUCIONAL);
  assert.equal(assinatura.cargo, 'Delegado de Polícia Civil');
  assert.equal(assinatura.seloDigital, ASSINATURA_DIGITAL_SELO);
  assert.equal(assinatura.seloDigital, '(assinado digitalmente)');

  assert.throws(() => montarAssinaturaCoordenador('   ', refDate));
});
