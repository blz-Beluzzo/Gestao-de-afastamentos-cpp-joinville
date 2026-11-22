import React from 'react';
import { AlertTriangle, CheckCircle2, Pencil, ShieldAlert } from 'lucide-react';
import type { LancamentoAvaliado } from '../types/ferias';
import { formatarDataBR, formatarLotacao } from '../utils/dateUtils';

interface RulesViewProps {
  lancamentos: LancamentoAvaliado[];
  onEditLancamento: (lancamento: LancamentoAvaliado) => void;
}

export const RulesView: React.FC<RulesViewProps> = ({
  lancamentos,
  onEditLancamento,
}) => {
  const conflitosAtivos = lancamentos.filter((item) => !item.validacao.valido);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2">
          <div className="text-xs font-semibold text-[#1E3A5F]">01. Meses Vedados (Férias)</div>
          <h3 className="font-display text-base font-bold text-slate-900">
            Bloqueio em Dezembro, Janeiro e Fevereiro
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Nenhum período de férias pode iniciar, terminar ou invadir os meses de dezembro, janeiro ou fevereiro. Licenças-prêmio, cursos e afastamentos médicos (LTS/LTF) não sofrem esse bloqueio.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2">
          <div className="text-xs font-semibold text-[#1E3A5F]">02. Mesmo Cargo</div>
          <h3 className="font-display text-base font-bold text-slate-900">
            Vedação de Coincidência na Equipe
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Dois servidores com o mesmo cargo (Delegado, Escrivão ou Agente) pertencentes à mesma equipe policial não podem sobrepor datas de afastamento.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2">
          <div className="text-xs font-semibold text-[#1E3A5F]">03. Chefia de Plantão</div>
          <h3 className="font-display text-base font-bold text-slate-900">
            Delegado + Escrivão na Equipe
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Dentro da mesma equipe, o Delegado e o Escrivão não podem permanecer afastados simultaneamente.
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
            <h2 className="font-display text-base font-bold text-slate-900">
              Conflitos Detectados na Escala Atual
            </h2>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-600">
            {conflitosAtivos.length} ocorrência(s)
          </span>
        </div>

        {conflitosAtivos.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto" />
            <p className="text-sm font-medium text-slate-900">
              Todos os afastamentos cadastrados estão regulares.
            </p>
            <p className="text-xs text-slate-500">
              Nenhuma violação às regras operacionais foi identificada na escala atual.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {conflitosAtivos.map((item) => (
              <div
                key={item.id}
                className="px-5 py-4 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/70"
              >
                <div className="space-y-1 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span className="font-semibold text-slate-900">
                      {item.servidor}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatarLotacao(item.equipe, item.cargo)} · {item.tipo} (
                      <span className="font-mono tabular-nums">
                        {formatarDataBR(item.inicio)} a {formatarDataBR(item.fim)}
                      </span>
                      )
                    </span>
                  </div>
                  <p className="text-xs text-red-800 pl-6">{item.validacao.mensagem}</p>
                </div>

                <button
                  type="button"
                  onClick={() => onEditLancamento(item)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1E3A5F] bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Corrigir período</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
