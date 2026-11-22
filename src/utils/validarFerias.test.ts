import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularDiasInclusivos,
  calcularPosicaoNoAno,
  extrairAnosDosRegistros,
  normalizarCargo,
  normalizarEquipe,
  parseParaISODate,
} from './dateUtils';
import { avaliarTodosRegistros, validarPeriodoFerias } from './validarFerias';
import { SEED_FERIAS_2027 } from '../data/seedFerias2027';

test('normalização de equipe e cargo', () => {
  assert.equal(normalizarEquipe('Alpha'), 'Alfa');
  assert.equal(normalizarEquipe('alfa '), 'Alfa');
  assert.equal(normalizarEquipe('Coordenacao'), 'Coordenação');
  assert.equal(normalizarCargo('Escrivao'), 'Escrivão');
  assert.equal(normalizarCargo('DELEGADO'), 'Delegado');
});

test('conversão de datas e cálculo inclusivo de dias', () => {
  assert.equal(parseParaISODate('13/10/2027'), '2027-10-13');
  assert.equal(parseParaISODate('2027-10-13'), '2027-10-13');
  assert.equal(calcularDiasInclusivos('2027-10-13', '2027-10-13'), 1);
  assert.equal(calcularDiasInclusivos('2027-03-08', '2027-03-22'), 15);
});

test('Regra 1: bloqueia Janeiro, Fevereiro e Dezembro', () => {
  const jan = validarPeriodoFerias(
    { nome: 'Teste', equipe: 'Alfa', cargo: 'Agente' },
    { inicio: '2027-01-10', fim: '2027-01-24' },
    []
  );
  assert.equal(jan.valido, false);
  assert.equal(jan.conflitos[0].tipo, 'MES_VEDADO');

  const fev = validarPeriodoFerias(
    { nome: 'Teste', equipe: 'Alfa', cargo: 'Agente' },
    { inicio: '2027-02-01', fim: '2027-02-15' },
    []
  );
  assert.equal(fev.valido, false);
  assert.equal(fev.conflitos[0].tipo, 'MES_VEDADO');

  const dez = validarPeriodoFerias(
    { nome: 'Teste', equipe: 'Alfa', cargo: 'Agente' },
    { inicio: '2027-11-25', fim: '2027-12-05' },
    []
  );
  assert.equal(dez.valido, false);
  assert.equal(dez.conflitos[0].tipo, 'MES_VEDADO');
});

test('Regra 2: bloqueia mesmo cargo na mesma equipe, permite em equipes diferentes', () => {
  const mesmaEquipe = validarPeriodoFerias(
    { id: 'srv-04', nome: 'Rafael Borges', equipe: 'Alfa', cargo: 'Agente', numeroPeriodo: 2 },
    { inicio: '2027-10-13', fim: '2027-10-13' },
    SEED_FERIAS_2027
  );
  assert.equal(mesmaEquipe.valido, false);
  assert.ok(mesmaEquipe.conflitos.some((c) => c.tipo === 'MESMO_CARGO'));
  assert.ok(mesmaEquipe.mensagem.includes('Cayo Filipe'));

  const outraEquipe = validarPeriodoFerias(
    { nome: 'Agente Bravo', equipe: 'Bravo', cargo: 'Agente' },
    { inicio: '2027-10-13', fim: '2027-10-20' },
    SEED_FERIAS_2027
  );
  assert.equal(outraEquipe.valido, true);
});

test('Regra 3: bloqueia Delegado e Escrivão simultâneos na mesma equipe', () => {
  const conflito = validarPeriodoFerias(
    { id: 'srv-06', nome: 'Thiago Alencar', equipe: 'Bravo', cargo: 'Escrivão', numeroPeriodo: 1 },
    { inicio: '2027-05-17', fim: '2027-05-31' },
    SEED_FERIAS_2027
  );
  assert.equal(conflito.valido, false);
  assert.ok(conflito.conflitos.some((c) => c.tipo === 'DELEGADO_ESCRIVAO'));
  assert.ok(conflito.mensagem.includes('Dra. Mariana Costa'));
});

test('Revalidação em cascata atualiza blocos quando conflito é resolvido', () => {
  const inicial = avaliarTodosRegistros(SEED_FERIAS_2027);
  const cayoInicial = inicial.find((r) => r.id === 'srv-03')!;
  const rafaelInicial = inicial.find((r) => r.id === 'srv-04')!;
  assert.equal(cayoInicial.periodo2Avaliado?.validacao.valido, false);
  assert.equal(rafaelInicial.periodo2Avaliado?.validacao.valido, false);

  // Move Rafael's period 2 to July (non-conflicting)
  const atualizado = SEED_FERIAS_2027.map((r) =>
    r.id === 'srv-04' ? { ...r, inicio2: '2027-07-05', fim2: '2027-07-19' } : r
  );
  const reavaliado = avaliarTodosRegistros(atualizado);
  const cayoDepois = reavaliado.find((r) => r.id === 'srv-03')!;
  const rafaelDepois = reavaliado.find((r) => r.id === 'srv-04')!;

  assert.equal(cayoDepois.periodo2Avaliado?.validacao.valido, true);
  assert.equal(rafaelDepois.periodo2Avaliado?.validacao.valido, true);
});

test('Extrai anos dos registros e posiciona períodos de 2026 corretamente na timeline', () => {
  const anos = extrairAnosDosRegistros([
    {
      inicio1: '2026-06-06',
      fim1: '2026-06-18',
      inicio2: '2026-11-13',
      fim2: '2026-11-29',
    },
  ]);
  assert.deepEqual(anos, [2026]);

  const pos2027 = calcularPosicaoNoAno('2026-06-06', '2026-06-18', 2027);
  assert.equal(pos2027.visivel, false);

  const pos2026 = calcularPosicaoNoAno('2026-06-06', '2026-06-18', 2026);
  assert.equal(pos2026.visivel, true);
  assert.ok(pos2026.leftPct > 40 && pos2026.leftPct < 50);
  assert.ok(pos2026.widthPct > 3);
});

