import type { RegistroAvaliado } from '../types/ferias';
import { formatarDataBR } from './dateUtils';

function escapeCsvCell(val: string | number): string {
  const str = String(val ?? '');
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCSV(registros: RegistroAvaliado[], fileName = 'Programacao_Ferias_CPP_2027.csv') {
  const headers = [
    'Equipe',
    'Servidor',
    'Cargo',
    'Início – período 1',
    'Fim – período 1',
    'Dias – período 1',
    'Início – período 2',
    'Fim – período 2',
    'Dias – período 2',
    'Total de dias',
    'Situação',
    'Detalhamento de Conflitos',
  ];

  const rows = registros.map((r) => {
    const conflitos: string[] = [];
    if (r.periodo1Avaliado && !r.periodo1Avaliado.validacao.valido) {
      conflitos.push(`P1: ${r.periodo1Avaliado.validacao.mensagem}`);
    }
    if (r.periodo2Avaliado && !r.periodo2Avaliado.validacao.valido) {
      conflitos.push(`P2: ${r.periodo2Avaliado.validacao.mensagem}`);
    }
    return [
      r.equipe,
      r.servidor,
      r.cargo,
      formatarDataBR(r.inicio1),
      formatarDataBR(r.fim1),
      r.dias1 || '',
      formatarDataBR(r.inicio2),
      formatarDataBR(r.fim2),
      r.dias2 || '',
      r.totalDias,
      r.temConflito ? 'Conflito' : 'Válido',
      conflitos.join(' | '),
    ]
      .map(escapeCsvCell)
      .join(';');
  });

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
  registros: RegistroAvaliado[],
  fileName = 'Relatorio_Ferias_CPP_Joinville_2027.html'
) {
  const totalConflitos = registros.filter((r) => r.temConflito).length;
  const rowsHtml = registros
    .map((r) => {
      const p1Conflict = r.periodo1Avaliado && !r.periodo1Avaliado.validacao.valido;
      const p2Conflict = r.periodo2Avaliado && !r.periodo2Avaliado.validacao.valido;
      const p1Text = r.inicio1
        ? `${formatarDataBR(r.inicio1)} a ${formatarDataBR(r.fim1)} (${r.dias1}d)`
        : '—';
      const p2Text = r.inicio2
        ? `${formatarDataBR(r.inicio2)} a ${formatarDataBR(r.fim2)} (${r.dias2}d)`
        : '—';

      const obs = [
        p1Conflict ? `P1: ${r.periodo1Avaliado!.validacao.mensagem}` : '',
        p2Conflict ? `P2: ${r.periodo2Avaliado!.validacao.mensagem}` : '',
      ]
        .filter(Boolean)
        .join(' • ');

      return `
      <tr>
        <td>${escapeHtml(r.equipe)}</td>
        <td><strong>${escapeHtml(r.servidor)}</strong></td>
        <td>${escapeHtml(r.cargo)}</td>
        <td class="${p1Conflict ? 'cell-conflict' : r.inicio1 ? 'cell-valid' : ''}">${escapeHtml(p1Text)}</td>
        <td class="${p2Conflict ? 'cell-conflict' : r.inicio2 ? 'cell-valid' : ''}">${escapeHtml(p2Text)}</td>
        <td class="num">${r.totalDias}</td>
        <td>${obs ? `<span class="err">${escapeHtml(obs)}</span>` : '<span class="ok">Regular</span>'}</td>
      </tr>`;
    })
    .join('');

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Programação de Férias — CPP Joinville (2027)</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0F172A; background: #F8FAFC; margin: 32px; }
  h1 { color: #1E3A5F; font-size: 20px; margin-bottom: 4px; }
  p.meta { color: #475569; font-size: 13px; margin-top: 0; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; background: #FFF; font-size: 13px; border: 1px solid #E2E8F0; }
  th { background: #1E3A5F; color: #FFF; text-align: left; padding: 10px 12px; font-weight: 600; }
  td { padding: 9px 12px; border-bottom: 1px solid #E2E8F0; vertical-align: top; }
  .num { font-variant-numeric: tabular-nums; text-align: right; font-weight: 600; }
  .cell-valid { background: #FEF9C3; color: #422006; font-variant-numeric: tabular-nums; }
  .cell-conflict { background: #FEE2E2; color: #991B1B; font-variant-numeric: tabular-nums; font-weight: 600; }
  .ok { color: #15803D; font-weight: 600; }
  .err { color: #991B1B; font-size: 12px; }
</style>
</head>
<body>
  <h1>Programação de Férias — CPP Joinville (2027)</h1>
  <p class="meta">Total de servidores: ${registros.length} · Servidores com pendência/conflito: ${totalConflitos} · Gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
  <table>
    <thead>
      <tr>
        <th>Equipe</th>
        <th>Servidor</th>
        <th>Cargo</th>
        <th>1º Período</th>
        <th>2º Período</th>
        <th style="text-align:right">Total (dias)</th>
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
