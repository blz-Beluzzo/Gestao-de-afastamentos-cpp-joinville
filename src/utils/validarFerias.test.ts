import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularDiasInclusivos,
  calcularPosicaoNoAno,
  ehTerceirizado,
  extrairAnosDosRegistros,
  formatarLotacao,
  normalizarCargo,
  normalizarEquipe,
  normalizarTipoAfastamento,
  parseParaISODate,
} from './dateUtils';
import {
  agruparPorServidor,
  avaliarTodosLancamentos,
  validarPeriodoFerias,
} from './validarFerias';
import { SEED_FERIAS_2027 } from '../data/seedFerias2027';

test('normalização de equipe, cargo, lotação e tipo de afastamento', () => {
  assert.equal(normalizarEquipe('Alpha'), 'Alfa');
  assert.equal(normalizarEquipe('alfa '), 'Alfa');
  assert.equal(normalizarEquipe('Coordenacao'), 'Coordenação');
  assert.equal(normalizarEquipe('Terceirizados'), 'Terceirizado');
  assert.equal(normalizarCargo('Escrivao'), 'Escrivão');
  assert.equal(normalizarCargo('DELEGADO'), 'Delegado');
  assert.equal(normalizarCargo('Terceirizada'), 'Terceirizado');
  assert.equal(formatarLotacao('Terceirizado', 'Terceirizado'), 'Terceirizado');
  assert.equal(formatarLotacao('Alfa', 'Delegado'), 'Alfa · Delegado');
  assert.equal(normalizarTipoAfastamento('Licenca Premio'), 'Licença-Prêmio');
  assert.equal(normalizarTipoAfastamento('Curso / Convocação'), 'Curso/Convocação');
  assert.equal(normalizarTipoAfastamento('LTS'), 'Afastamento Médico (LTS/LTF)');
  assert.equal(normalizarTipoAfastamento('Afastamento Médico (LTS/LTF)'), 'Afastamento Médico (LTS/LTF)');
  assert.equal(normalizarTipoAfastamento(''), 'Férias');
});

test('conversão de datas e cálculo inclusivo de dias', () => {
  assert.equal(parseParaISODate('13/10/2027'), '2027-10-13');
  assert.equal(parseParaISODate('2027-10-13'), '2027-10-13');
  assert.equal(calcularDiasInclusivos('2027-10-13', '2027-10-13'), 1);
  assert.equal(calcularDiasInclusivos('2027-03-08', '2027-03-22'), 15);
});

test('Regra 1: bloqueia Férias em Janeiro, Fevereiro e Dezembro, mas permite outros afastamentos', () => {
  const janFerias = validarPeriodoFerias(
    { nome: 'Teste', equipe: 'Alfa', cargo: 'Agente', tipo: 'Férias' },
    { inicio: '2027-01-10', fim: '2027-01-24' },
    []
  );
  assert.equal(janFerias.valido, false);
  assert.equal(janFerias.conflitos[0].tipo, 'MES_VEDADO');

  const fevFerias = validarPeriodoFerias(
    { nome: 'Teste', equipe: 'Alfa', cargo: 'Agente', tipo: 'Férias' },
    { inicio: '2027-02-01', fim: '2027-02-15' },
    []
  );
  assert.equal(fevFerias.valido, false);
  assert.equal(fevFerias.conflitos[0].tipo, 'MES_VEDADO');

  const dezFerias = validarPeriodoFerias(
    { nome: 'Teste', equipe: 'Alfa', cargo: 'Agente', tipo: 'Férias' },
    { inicio: '2027-11-25', fim: '2027-12-05' },
    []
  );
  assert.equal(dezFerias.valido, false);
  assert.equal(dezFerias.conflitos[0].tipo, 'MES_VEDADO');

  const janMedico = validarPeriodoFerias(
    {
      nome: 'Teste',
      equipe: 'Alfa',
      cargo: 'Agente',
      tipo: 'Afastamento Médico (LTS/LTF)',
    },
    { inicio: '2027-01-10', fim: '2027-01-20' },
    []
  );
  assert.equal(janMedico.valido, true);

  const fevCurso = validarPeriodoFerias(
    { nome: 'Teste', equipe: 'Alfa', cargo: 'Agente', tipo: 'Curso/Convocação' },
    { inicio: '2027-02-05', fim: '2027-02-10' },
    []
  );
  assert.equal(fevCurso.valido, true);
});

test('Regra 2: bloqueia mesmo cargo na mesma equipe inclusive entre tipos distintos', () => {
  const mesmaEquipe = validarPeriodoFerias(
    {
      id: 'srv-04-p2',
      nome: 'Rafael Borges',
      equipe: 'Alfa',
      cargo: 'Agente',
      tipo: 'Licença-Prêmio',
    },
    { inicio: '2027-10-13', fim: '2027-10-15' },
    SEED_FERIAS_2027
  );
  assert.equal(mesmaEquipe.valido, false);
  assert.ok(mesmaEquipe.conflitos.some((c) => c.tipo === 'MESMO_CARGO'));
  assert.ok(mesmaEquipe.mensagem.includes('Cayo Filipe'));

  const outraEquipe = validarPeriodoFerias(
    {
      nome: 'Agente Bravo',
      equipe: 'Bravo',
      cargo: 'Agente',
      tipo: 'Licença-Prêmio',
    },
    { inicio: '2027-10-13', fim: '2027-10-20' },
    SEED_FERIAS_2027
  );
  assert.equal(outraEquipe.valido, true);
});

test('Regra 3: bloqueia Delegado e Escrivão simultâneos na mesma equipe', () => {
  const conflito = validarPeriodoFerias(
    {
      id: 'srv-06-p1',
      nome: 'Thiago Alencar',
      equipe: 'Bravo',
      cargo: 'Escrivão',
      tipo: 'Férias',
    },
    { inicio: '2027-05-17', fim: '2027-05-31' },
    SEED_FERIAS_2027
  );
  assert.equal(conflito.valido, false);
  assert.ok(conflito.conflitos.some((c) => c.tipo === 'DELEGADO_ESCRIVAO'));
  assert.ok(conflito.mensagem.includes('Dra. Mariana Costa'));
});

test('Revalidação em cascata e agrupamento por servidor funcionam corretamente', () => {
  const inicial = avaliarTodosLancamentos(SEED_FERIAS_2027);
  const cayoInicial = inicial.find((r) => r.id === 'srv-03-p2')!;
  const rafaelInicial = inicial.find((r) => r.id === 'srv-04-p2')!;
  assert.equal(cayoInicial.validacao.valido, false);
  assert.equal(rafaelInicial.validacao.valido, false);

  // Move Rafael's period 2 to July (non-conflicting)
  const atualizado = SEED_FERIAS_2027.map((r) =>
    r.id === 'srv-04-p2' ? { ...r, inicio: '2027-07-05', fim: '2027-07-19' } : r
  );
  const reavaliado = avaliarTodosLancamentos(atualizado);
  const cayoDepois = reavaliado.find((r) => r.id === 'srv-03-p2')!;
  const rafaelDepois = reavaliado.find((r) => r.id === 'srv-04-p2')!;

  assert.equal(cayoDepois.validacao.valido, true);
  assert.equal(rafaelDepois.validacao.valido, true);

  const agrupados = agruparPorServidor(reavaliado);
  assert.equal(agrupados.length, 22);
  const policiais = agrupados.filter((s) => !ehTerceirizado(s.equipe, s.cargo));
  const terceirizados = agrupados.filter((s) => ehTerceirizado(s.equipe, s.cargo));
  assert.equal(policiais.length, 20);
  assert.equal(terceirizados.length, 2);
  const eduardo = agrupados.find((s) => s.servidor === 'Dr. Eduardo Mendes')!;
  assert.equal(eduardo.periodos.length, 3);
});

test('Terceirizados ficam separados da escala policial e não sofrem conflito de equipe policial', () => {
  const janTerceirizado = validarPeriodoFerias(
    { nome: 'Novo Terceirizado', equipe: 'Terceirizado', cargo: 'Terceirizado', tipo: 'Férias' },
    { inicio: '2027-01-10', fim: '2027-01-24' },
    SEED_FERIAS_2027
  );
  assert.equal(janTerceirizado.valido, true);

  const overlapOutroTerceirizado = validarPeriodoFerias(
    { nome: 'Outro Terceirizado', equipe: 'Terceirizado', cargo: 'Terceirizado', tipo: 'Férias' },
    { inicio: '2027-05-05', fim: '2027-05-15' },
    SEED_FERIAS_2027
  );
  assert.equal(overlapOutroTerceirizado.valido, true);

  const autoSobreposicaoTerceirizado = validarPeriodoFerias(
    { nome: 'Cláudia Pereira', equipe: 'Terceirizado', cargo: 'Terceirizado', tipo: 'Licença-Prêmio' },
    { inicio: '2027-05-10', fim: '2027-05-20' },
    SEED_FERIAS_2027
  );
  assert.equal(autoSobreposicaoTerceirizado.valido, false);
  assert.equal(autoSobreposicaoTerceirizado.conflitos[0].tipo, 'SOBREPOSICAO_PROPRIA');
});

test('Extrai anos dos registros e posiciona períodos de 2026 corretamente na timeline', () => {
  const anos = extrairAnosDosRegistros([
    {
      inicio: '2026-06-06',
      fim: '2026-06-18',
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
