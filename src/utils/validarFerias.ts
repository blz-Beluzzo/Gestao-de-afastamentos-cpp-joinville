import type {
  ConflitoDetalhe,
  LancamentoAfastamento,
  LancamentoAvaliado,
  PeriodoPretendidoInput,
  ResultadoValidacao,
  ServidorAgrupado,
  ServidorValidacaoInput,
} from '../types/ferias';
import {
  calcularDiasInclusivos,
  ehTerceirizado,
  formatarDataCurtaBR,
  MESES_VEDADOS,
  NOMES_MESES_COMPLETOS,
  obterMesesDoPeriodo,
  parseParaISODate,
  periodosSeSobrepoem,
} from './dateUtils';

/**
 * Core Business Rules Engine:
 * 1) Bloqueio absoluto para Dezembro, Janeiro e Fevereiro (aplicável a Férias de servidores policiais).
 * 2) Dois servidores do mesmo cargo na mesma equipe não podem ter afastamentos coincidentes.
 * 3) Delegado e Escrivão da mesma equipe não podem coincidir datas de afastamento.
 * 4) Sobreposição interna do próprio servidor em períodos simultâneos.
 */
export function validarPeriodoFerias(
  servidor: ServidorValidacaoInput,
  periodoPretendido: PeriodoPretendidoInput,
  lancamentosCadastrados: LancamentoAfastamento[]
): ResultadoValidacao {
  const inicio = parseParaISODate(periodoPretendido.inicio);
  const fim = parseParaISODate(periodoPretendido.fim);
  const tipo = servidor.tipo ?? 'Férias';
  const isTerceirizado = ehTerceirizado(servidor.equipe, servidor.cargo);

  if (!inicio || !fim) {
    return {
      valido: false,
      mensagem: 'Datas de início e fim são obrigatórias e devem estar em formato válido.',
      conflitos: [
        {
          tipo: 'DATA_INVALIDA',
          mensagem: 'Datas de início e fim inválidas ou incompletas.',
        },
      ],
    };
  }

  const dias = calcularDiasInclusivos(inicio, fim);
  if (dias <= 0) {
    return {
      valido: false,
      mensagem: 'A data de término não pode ser anterior à data de início.',
      conflitos: [
        {
          tipo: 'DATA_INVALIDA',
          mensagem: 'Data final anterior à data inicial.',
        },
      ],
    };
  }

  const conflitos: ConflitoDetalhe[] = [];

  // Regra 1: Meses vedados (Janeiro, Fevereiro e Dezembro) — aplicável a Férias de servidores policiais
  if (tipo === 'Férias' && !isTerceirizado) {
    const mesesTocados = obterMesesDoPeriodo(inicio, fim);
    const mesesVedadosTocados = mesesTocados.filter((m) =>
      (MESES_VEDADOS as readonly number[]).includes(m)
    );
    if (mesesVedadosTocados.length > 0) {
      const nomesVedados = mesesVedadosTocados
        .map((m) => NOMES_MESES_COMPLETOS[m - 1].toLowerCase())
        .join(', ');
      conflitos.push({
        tipo: 'MES_VEDADO',
        mensagem: `Mês vedado para férias: período invade ${nomesVedados} (${formatarDataCurtaBR(inicio)} a ${formatarDataCurtaBR(fim)})`,
      });
    }
  }

  for (const outro of lancamentosCadastrados) {
    if (servidor.id && outro.id === servidor.id) {
      continue;
    }

    const outroIni = parseParaISODate(outro.inicio);
    const outroFim = parseParaISODate(outro.fim);
    if (!outroIni || !outroFim) continue;

    if (!periodosSeSobrepoem(inicio, fim, outroIni, outroFim)) {
      continue;
    }

    const intervaloTexto = `${formatarDataCurtaBR(outroIni)} a ${formatarDataCurtaBR(outroFim)}`;

    // Auto-sobreposição entre lançamentos do próprio servidor
    if (outro.servidor.trim().toLowerCase() === servidor.nome.trim().toLowerCase()) {
      conflitos.push({
        tipo: 'SOBREPOSICAO_PROPRIA',
        mensagem: `Sobreposição interna: coincide com ${outro.tipo} do próprio servidor (${intervaloTexto})`,
        servidorConflitante: outro.servidor,
        cargoConflitante: outro.cargo,
        equipe: outro.equipe,
        periodoConflitante: intervaloTexto,
      });
      continue;
    }

    // Regras 2 e 3 aplicam-se apenas a equipes policiais (Delegado/Escrivão/Agente)
    if (isTerceirizado || ehTerceirizado(outro.equipe, outro.cargo)) {
      continue;
    }

    // Regras 2 e 3 aplicam-se dentro da mesma equipe
    if (outro.equipe !== servidor.equipe) {
      continue;
    }

    // Regra 2: Mesmo cargo na mesma equipe
    if (outro.cargo === servidor.cargo) {
      conflitos.push({
        tipo: 'MESMO_CARGO',
        mensagem: `Conflito por cargo (${servidor.cargo}) na equipe ${servidor.equipe}: coincide com ${outro.servidor} [${outro.tipo}] (${intervaloTexto})`,
        servidorConflitante: outro.servidor,
        cargoConflitante: outro.cargo,
        equipe: outro.equipe,
        periodoConflitante: intervaloTexto,
      });
    }

    // Regra 3: Delegado + Escrivão na mesma equipe
    const parDelegadoEscrivao =
      (servidor.cargo === 'Delegado' && outro.cargo === 'Escrivão') ||
      (servidor.cargo === 'Escrivão' && outro.cargo === 'Delegado');

    if (parDelegadoEscrivao) {
      conflitos.push({
        tipo: 'DELEGADO_ESCRIVAO',
        mensagem: `Conflito Delegado + Escrivão na equipe ${servidor.equipe}: coincide com ${outro.servidor} — ${outro.cargo} [${outro.tipo}] (${intervaloTexto})`,
        servidorConflitante: outro.servidor,
        cargoConflitante: outro.cargo,
        equipe: outro.equipe,
        periodoConflitante: intervaloTexto,
      });
    }
  }

  if (conflitos.length === 0) {
    return {
      valido: true,
      mensagem: `${tipo} regular e sem conflitos operacionais.`,
      conflitos: [],
    };
  }

  return {
    valido: false,
    mensagem: conflitos.map((c) => c.mensagem).join(' • '),
    conflitos,
  };
}

/**
 * Reevaluates ALL leave entries in cascade whenever the schedule changes.
 */
export function avaliarTodosLancamentos(
  lancamentos: LancamentoAfastamento[]
): LancamentoAvaliado[] {
  return lancamentos.map((item) => {
    const inicio = parseParaISODate(item.inicio);
    const fim = parseParaISODate(item.fim);
    const dias = inicio && fim ? calcularDiasInclusivos(inicio, fim) : 0;

    return {
      ...item,
      inicio,
      fim,
      dias,
      validacao: validarPeriodoFerias(
        {
          id: item.id,
          nome: item.servidor,
          equipe: item.equipe,
          cargo: item.cargo,
          tipo: item.tipo,
        },
        { inicio, fim },
        lancamentos
      ),
    };
  });
}

/**
 * Groups evaluated leave entries by officer (Servidor + Equipe + Cargo) for the annual timeline.
 */
export function agruparPorServidor(
  lancamentosAvaliados: LancamentoAvaliado[]
): ServidorAgrupado[] {
  const mapa = new Map<string, ServidorAgrupado>();

  for (const item of lancamentosAvaliados) {
    const key = `${item.equipe}|${item.servidor.trim().toLowerCase()}|${item.cargo}`;
    const existing = mapa.get(key);
    if (existing) {
      existing.periodos.push(item);
      existing.totalDias += item.dias;
      if (!item.validacao.valido) {
        existing.temConflito = true;
      }
    } else {
      mapa.set(key, {
        key,
        servidor: item.servidor,
        equipe: item.equipe,
        cargo: item.cargo,
        periodos: [item],
        totalDias: item.dias,
        temConflito: !item.validacao.valido,
      });
    }
  }

  // Sort each officer's periods chronologically
  for (const grupo of mapa.values()) {
    grupo.periodos.sort((a, b) => a.inicio.localeCompare(b.inicio));
  }

  return Array.from(mapa.values());
}
