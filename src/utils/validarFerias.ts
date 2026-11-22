import type {
  ConflitoDetalhe,
  PeriodoAvaliado,
  PeriodoPretendidoInput,
  RegistroAvaliado,
  RegistroFerias,
  ResultadoValidacao,
  ServidorValidacaoInput,
} from '../types/ferias';
import {
  calcularDiasInclusivos,
  formatarDataCurtaBR,
  MESES_VEDADOS,
  NOMES_MESES_COMPLETOS,
  obterMesesDoPeriodo,
  parseParaISODate,
  periodosSeSobrepoem,
} from './dateUtils';

interface PeriodoExpandido {
  registroId: string;
  numeroPeriodo: 1 | 2;
  servidor: string;
  equipe: RegistroFerias['equipe'];
  cargo: RegistroFerias['cargo'];
  inicio: string;
  fim: string;
}

function expandirPeriodos(feriasCadastradas: RegistroFerias[]): PeriodoExpandido[] {
  const lista: PeriodoExpandido[] = [];
  for (const reg of feriasCadastradas) {
    const ini1 = parseParaISODate(reg.inicio1);
    const fim1 = parseParaISODate(reg.fim1);
    if (ini1 && fim1) {
      lista.push({
        registroId: reg.id,
        numeroPeriodo: 1,
        servidor: reg.servidor,
        equipe: reg.equipe,
        cargo: reg.cargo,
        inicio: ini1,
        fim: fim1,
      });
    }

    const ini2 = parseParaISODate(reg.inicio2);
    const fim2 = parseParaISODate(reg.fim2);
    if (ini2 && fim2) {
      lista.push({
        registroId: reg.id,
        numeroPeriodo: 2,
        servidor: reg.servidor,
        equipe: reg.equipe,
        cargo: reg.cargo,
        inicio: ini2,
        fim: fim2,
      });
    }
  }
  return lista;
}

/**
 * Core Business Rules Engine:
 * 1) Bloqueio absoluto para Dezembro, Janeiro e Fevereiro.
 * 2) Dois servidores do mesmo cargo na mesma equipe não podem ter férias coincidentes.
 * 3) Delegado e Escrivão da mesma equipe não podem coincidir datas.
 */
export function validarPeriodoFerias(
  servidor: ServidorValidacaoInput,
  periodoPretendido: PeriodoPretendidoInput,
  feriasCadastradas: RegistroFerias[]
): ResultadoValidacao {
  const inicio = parseParaISODate(periodoPretendido.inicio);
  const fim = parseParaISODate(periodoPretendido.fim);

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

  // Regra 1: Meses vedados (Janeiro, Fevereiro e Dezembro)
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
      mensagem: `Mês vedado: período invade ${nomesVedados} (${formatarDataCurtaBR(inicio)} a ${formatarDataCurtaBR(fim)})`,
    });
  }

  const todosPeriodos = expandirPeriodos(feriasCadastradas);

  for (const outro of todosPeriodos) {
    // Ignore the exact period currently being edited/evaluated
    const mesmoRegistro = servidor.id && outro.registroId === servidor.id;
    if (
      mesmoRegistro &&
      servidor.numeroPeriodo &&
      outro.numeroPeriodo === servidor.numeroPeriodo
    ) {
      continue;
    }

    if (!periodosSeSobrepoem(inicio, fim, outro.inicio, outro.fim)) {
      continue;
    }

    const intervaloTexto = `${formatarDataCurtaBR(outro.inicio)} a ${formatarDataCurtaBR(outro.fim)}`;

    // Auto-sobreposição entre Período 1 e Período 2 do próprio servidor
    if (mesmoRegistro || outro.servidor.trim().toLowerCase() === servidor.nome.trim().toLowerCase()) {
      conflitos.push({
        tipo: 'SOBREPOSICAO_PROPRIA',
        mensagem: `Sobreposição interna: coincide com o ${outro.numeroPeriodo}º período do próprio servidor (${intervaloTexto})`,
        servidorConflitante: outro.servidor,
        cargoConflitante: outro.cargo,
        equipe: outro.equipe,
        periodoConflitante: intervaloTexto,
      });
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
        mensagem: `Conflito por cargo (${servidor.cargo}) na equipe ${servidor.equipe}: coincide com ${outro.servidor} (${intervaloTexto})`,
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
        mensagem: `Conflito Delegado + Escrivão na equipe ${servidor.equipe}: coincide com ${outro.servidor} — ${outro.cargo} (${intervaloTexto})`,
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
      mensagem: 'Período válido e sem conflitos operacionais.',
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
 * Reevaluates ALL records in cascade whenever the vacation list changes.
 */
export function avaliarTodosRegistros(registros: RegistroFerias[]): RegistroAvaliado[] {
  return registros.map((reg) => {
    const ini1 = parseParaISODate(reg.inicio1);
    const fim1 = parseParaISODate(reg.fim1);
    const ini2 = parseParaISODate(reg.inicio2);
    const fim2 = parseParaISODate(reg.fim2);

    const dias1 = ini1 && fim1 ? calcularDiasInclusivos(ini1, fim1) : 0;
    const dias2 = ini2 && fim2 ? calcularDiasInclusivos(ini2, fim2) : 0;

    let periodo1Avaliado: PeriodoAvaliado | null = null;
    if (ini1 || fim1) {
      periodo1Avaliado = {
        numero: 1,
        inicio: ini1,
        fim: fim1,
        dias: dias1,
        validacao: validarPeriodoFerias(
          {
            id: reg.id,
            nome: reg.servidor,
            equipe: reg.equipe,
            cargo: reg.cargo,
            numeroPeriodo: 1,
          },
          { inicio: ini1, fim: fim1 },
          registros
        ),
      };
    }

    let periodo2Avaliado: PeriodoAvaliado | null = null;
    if (ini2 || fim2) {
      periodo2Avaliado = {
        numero: 2,
        inicio: ini2,
        fim: fim2,
        dias: dias2,
        validacao: validarPeriodoFerias(
          {
            id: reg.id,
            nome: reg.servidor,
            equipe: reg.equipe,
            cargo: reg.cargo,
            numeroPeriodo: 2,
          },
          { inicio: ini2, fim: fim2 },
          registros
        ),
      };
    }

    const temConflito = Boolean(
      (periodo1Avaliado && !periodo1Avaliado.validacao.valido) ||
        (periodo2Avaliado && !periodo2Avaliado.validacao.valido)
    );

    return {
      ...reg,
      inicio1: ini1,
      fim1: fim1,
      inicio2: ini2,
      fim2: fim2,
      dias1,
      dias2,
      totalDias: dias1 + dias2,
      periodo1Avaliado,
      periodo2Avaliado,
      temConflito,
    };
  });
}
