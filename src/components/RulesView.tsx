import React from 'react';
import { AlertTriangle, CheckCircle2, Pencil, ShieldAlert } from 'lucide-react';
import type { RegistroAvaliado } from '../types/ferias';
import { formatarDataBR } from '../utils/dateUtils';

interface RulesViewProps {
  registros: RegistroAvaliado[];
  onEditPeriod: (registro: RegistroAvaliado, periodo?: 1 | 2) => void;
}

export const RulesView: React.FC<RulesViewProps> = ({ registros, onEditPeriod }) => {
  const conflitosAtivos = registros.flatMap((reg) => {
    const items: {
      registro: RegistroAvaliado;
      numero: 1 | 2;
      inicio: string;
      fim: string;
      mensagem: string;
    }[] = [];
    if (reg.periodo1Avaliado && !reg.periodo1Avaliado.validacao.valido) {
      items.push({
        registro: reg,
        numero: 1,
        inicio: reg.periodo1Avaliado.inicio,
        fim: reg.periodo1Avaliado.fim,
        mensagem: reg.periodo1Avaliado.validacao.mensagem,
      });
    }
    if (reg.periodo2Avaliado && !reg.periodo2Avaliado.validacao.valido) {
      items.push({
        registro: reg,
        numero: 2,
        inicio: reg.periodo2Avaliado.inicio,
        fim: reg.periodo2Avaliado.fim,
        mensagem: reg.periodo2Avaliado.validacao.mensagem,
      });
    }
    return items;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2">
          <div className="text-xs font-semibold text-[#1E3A5F]">01. Meses Vedados</div>
          <h3 className="font-display text-base font-bold text-slate-900">
            Bloqueio em Dezembro, Janeiro e Fevereiro
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Nenhum período de férias pode iniciar, terminar ou invadir os meses de dezembro, janeiro ou fevereiro.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2">
          <div className="text-xs font-semibold text-[#1E3A5F]">02. Mesmo Cargo</div>
          <h3 className="font-display text-base font-bold text-slate-900">
            Vedação de Coincidência na Equipe
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Dois servidores com o mesmo cargo (Delegado, Escrivão ou Agente) pertencentes à mesma equipe não podem sobrepor datas.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2">
          <div className="text-xs font-semibold text-[#1E3A5F]">03. Chefia de Plantão</div>
          <h3 className="font-display text-base font-bold text-slate-900">
            Delegado + Escrivão na Equipe
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Dentro da mesma equipe, o Delegado e o Escrivão não podem usufruir férias simultaneamente.
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
              Todos os períodos cadastrados estão regulares.
            </p>
            <p className="text-xs text-slate-500">
              Nenhuma violação às regras operacionais foi identificada na escala atual.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {conflitosAtivos.map((item) => (
              <div
                key={`${item.registro.id}-p${item.numero}`}
                className="px-5 py-4 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/70"
              >
                <div className="space-y-1 max-w-3xl">
                  <div className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span className="font-semibold text-slate-900">
                      {item.registro.servidor}
                    </span>
                    <span className="text-xs text-slate-500">
                      {item.registro.equipe} · {item.registro.cargo} · {item.numero}º Período (
                      <span className="font-mono tabular-nums">
                        {formatarDataBR(item.inicio)} a {formatarDataBR(item.fim)}
                      </span>
                      )
                    </span>
                  </div>
                  <p className="text-xs text-red-800 pl-6">{item.mensagem}</p>
                </div>

                <button
                  type="button"
                  onClick={() => onEditPeriod(item.registro, item.numero)}
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
