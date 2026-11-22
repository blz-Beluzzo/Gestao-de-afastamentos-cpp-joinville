import type { LancamentoAvaliado } from '../types/ferias';
import { formatarDataBR } from './dateUtils';
import { getLeaveVisualStyle } from './leaveStyles';

function escapeCsvCell(val: string | number): string {
  const str = String(val ?? '');
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCSV(
  lancamentos: LancamentoAvaliado[],
  fileName = 'Controle_Afastamentos_CPP_Joinville.csv'
) {
  const headers = [
    'Equipe',
    'Servidor',
    'Cargo',
    'Tipo de Afastamento',
    'Início',
    'Fim',
    'Dias',
    'Situação',
    'Detalhamento de Conflitos',
  ];

  const rows = lancamentos.map((r) =>
    [
      r.equipe,
      r.servidor,
      r.cargo,
      r.tipo,
      formatarDataBR(r.inicio),
      formatarDataBR(r.fim),
      r.dias || '',
      r.validacao.valido ? 'Regular' : 'Conflito',
      r.validacao.valido ? '' : r.validacao.mensagem,
    ]
      .map(escapeCsvCell)
      .join(';')
  );

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function exportToStandaloneHTML(
  lancamentos: LancamentoAvaliado[],
  fileName = 'Relatorio_Afastamentos_CPP_Joinville.html'
) {
  const totalConflitos = lancamentos.filter((r) => !r.validacao.valido).length;
  const rowsHtml = lancamentos
    .map((r) => {
      const hasConflict = !r.validacao.valido;
      const periodoText = r.inicio
        ? `${formatarDataBR(r.inicio)} a ${formatarDataBR(r.fim)}`
        : '—';
      const style = getLeaveVisualStyle(r.tipo);

      return `
      <tr>
        <td>${escapeHtml(r.equipe)}</td>
        <td><strong>${escapeHtml(r.servidor)}</strong></td>
        <td>${escapeHtml(r.cargo)}</td>
        <td class="${hasConflict ? 'cell-conflict' : style.htmlCellClass}">${escapeHtml(r.tipo)}</td>
        <td class="num">${escapeHtml(periodoText)}</td>
        <td class="num">${r.dias}</td>
        <td>${hasConflict ? `<span class="err">${escapeHtml(r.validacao.mensagem)}</span>` : '<span class="ok">Regular</span>'}</td>
      </tr>`;
    })
    .join('');

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Controle de Afastamentos - CPP Joinville</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0F172A; background: #F8FAFC; margin: 32px; }
  h1 { color: #1E3A5F; font-size: 20px; margin-bottom: 4px; }
  p.meta { color: #475569; font-size: 13px; margin-top: 0; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; background: #FFF; font-size: 13px; border: 1px solid #E2E8F0; }
  th { background: #1E3A5F; color: #FFF; text-align: left; padding: 10px 12px; font-weight: 600; }
  td { padding: 9px 12px; border-bottom: 1px solid #E2E8F0; vertical-align: top; }
  .num { font-variant-numeric: tabular-nums; text-align: right; font-weight: 600; }
  .cell-ferias { background: #FEF9C3; color: #422006; font-weight: 600; }
  .cell-licenca { background: #DBEAFE; color: #1E3A8A; font-weight: 600; }
  .cell-curso { background: #EDE9FE; color: #4C1D95; font-weight: 600; }
  .cell-medico { background: #D1FAE5; color: #064E3B; font-weight: 600; }
  .cell-conflict { background: #FEE2E2; color: #991B1B; font-weight: 600; }
  .ok { color: #15803D; font-weight: 600; }
  .err { color: #991B1B; font-size: 12px; }
</style>
</head>
<body>
  <h1>Controle de Afastamentos - CPP Joinville</h1>
  <p class="meta">Total de lançamentos: ${lancamentos.length} · Lançamentos com pendência/conflito: ${totalConflitos} · Gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
  <table>
    <thead>
      <tr>
        <th>Equipe</th>
        <th>Servidor</th>
        <th>Cargo</th>
        <th>Tipo de Afastamento</th>
        <th style="text-align:right">Período</th>
        <th style="text-align:right">Dias</th>
        <th>Validação Operacional</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
