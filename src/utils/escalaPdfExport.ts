import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DelegadoConvocavel, EscalaDiaLinha } from '../types/escala';
import { NOMES_MESES_COMPLETOS } from './dateUtils';
import {
  montarAssinaturaCoordenador,
  RODAPE_CONVOCACOES_ESCALA,
} from './escalaMensalUtils';

export interface GerarEscalaPdfParams {
  ano: number;
  mes: number;
  grade: EscalaDiaLinha[];
  delegados: DelegadoConvocavel[];
  delegadoCoordenador: string;
  date?: Date;
}

export function buildEscalaPdfFilename(ano: number, mes: number): string {
  const mesNome = NOMES_MESES_COMPLETOS[mes - 1] ?? String(mes);
  return `Escala_${mesNome}_${ano}_CPP_Joinville.pdf`;
}

function formatSlotText(
  items: string[],
  required: number
): { text: string; isOpenVacancy: boolean; isFilled: boolean } {
  if (items.length > 0) {
    return {
      text: items.join(' / '),
      isOpenVacancy: false,
      isFilled: true,
    };
  }
  if (required > 0) {
    return {
      text: required > 1 ? `A convocar (${required})` : 'A convocar',
      isOpenVacancy: true,
      isFilled: false,
    };
  }
  return { text: '', isOpenVacancy: false, isFilled: false };
}

export function gerarEscalaMensalPDF(params: GerarEscalaPdfParams): {
  filename: string;
  assinatura: ReturnType<typeof montarAssinaturaCoordenador>;
} {
  const { ano, mes, grade, delegadoCoordenador, date = new Date() } = params;
  const assinatura = montarAssinaturaCoordenador(delegadoCoordenador, date);
  const mesNome = NOMES_MESES_COMPLETOS[mes - 1] ?? String(mes);
  const filename = buildEscalaPdfFilename(ano, mes);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header title matching spreadsheet layout
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `CRPP JOINVILLE - ESCALA ${mesNome.toUpperCase()}/${ano}`,
    pageWidth / 2,
    13,
    { align: 'center' }
  );

  // Build table body rows
  const bodyRows = grade.map((row) => {
    const apcDia = formatSlotText(row.convocacoes.apcDia, row.vacancias.apc);
    const apcNoite = formatSlotText(row.convocacoes.apcNoite, row.vacancias.apc);
    const dpcDia = formatSlotText(row.convocacoes.dpcDia, row.vacancias.dpc);
    const dpcNoite = formatSlotText(row.convocacoes.dpcNoite, row.vacancias.dpc);
    const epcDia = formatSlotText(row.convocacoes.epcDia, row.vacancias.epc);
    const epcNoite = formatSlotText(row.convocacoes.epcNoite, row.vacancias.epc);

    const makeSlotCell = (slot: ReturnType<typeof formatSlotText>) => {
      const fillColor: [number, number, number] = slot.isFilled
        ? row.isFimDeSemana
          ? [180, 185, 194]
          : [253, 224, 106]
        : slot.isOpenVacancy
        ? [254, 243, 199]
        : row.isFimDeSemana
        ? [229, 231, 235]
        : [255, 255, 255];

      const textColor: [number, number, number] = slot.isOpenVacancy
        ? [146, 64, 14]
        : [15, 23, 42];

      return {
        content: slot.text,
        styles: {
          fillColor,
          textColor,
          fontStyle: slot.isFilled ? ('bold' as const) : ('normal' as const),
          fontSize: slot.isOpenVacancy ? 6.8 : 7.5,
        },
      };
    };

    const baseFill: [number, number, number] = row.isFimDeSemana
      ? [229, 231, 235]
      : [255, 255, 255];

    return [
      {
        content: String(row.diaMes),
        styles: { fillColor: baseFill, fontStyle: 'bold' as const },
      },
      {
        content: row.diaSemanaLabel,
        styles: { fillColor: baseFill },
      },
      {
        content: row.equipePlantao.toUpperCase(),
        styles: { fillColor: baseFill, fontStyle: 'bold' as const },
      },
      makeSlotCell(apcDia),
      makeSlotCell(apcNoite),
      makeSlotCell(dpcDia),
      makeSlotCell(dpcNoite),
      makeSlotCell(epcDia),
      makeSlotCell(epcNoite),
    ];
  });

  // Footer row spanning all 9 columns inside table border (as in reference image)
  bodyRows.push([
    {
      content: RODAPE_CONVOCACOES_ESCALA,
      colSpan: 9,
      styles: {
        halign: 'left',
        fillColor: [255, 255, 255],
        textColor: [15, 23, 42],
        fontSize: 7.2,
        fontStyle: 'normal',
        cellPadding: { top: 2, right: 2.5, bottom: 2, left: 2.5 },
      },
    } as unknown as (typeof bodyRows)[number][number],
  ]);

  autoTable(doc, {
    startY: 17,
    margin: { left: 10, right: 10, bottom: 12 },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      halign: 'center',
      valign: 'middle',
      cellPadding: { top: 1.35, right: 1.2, bottom: 1.35, left: 1.2 },
      lineColor: [30, 41, 59],
      lineWidth: 0.25,
      textColor: [15, 23, 42],
      overflow: 'linebreak',
    },
    head: [
      [
        {
          content: 'Escala 24x72',
          colSpan: 2,
          styles: {
            fillColor: [248, 250, 252],
            fontStyle: 'bold',
            fontSize: 7.8,
          },
        },
        {
          content: '08:00 às 08:00',
          styles: {
            fillColor: [248, 250, 252],
            fontStyle: 'bold',
            fontSize: 7.5,
          },
        },
        {
          content: 'CONVOCAÇÕES',
          colSpan: 6,
          styles: {
            fillColor: [248, 250, 252],
            fontStyle: 'bold',
            fontSize: 7.8,
          },
        },
      ],
      [
        {
          content: 'DIA MÊS',
          styles: { fillColor: [241, 245, 249], fontStyle: 'bold' },
        },
        {
          content: 'DIA SEMANA',
          styles: { fillColor: [241, 245, 249], fontStyle: 'bold' },
        },
        {
          content: 'EQUIPE',
          styles: { fillColor: [241, 245, 249], fontStyle: 'bold' },
        },
        {
          content: 'APC - dia',
          styles: { fillColor: [103, 158, 235], fontStyle: 'bold' },
        },
        {
          content: 'APC - noite',
          styles: { fillColor: [103, 158, 235], fontStyle: 'bold' },
        },
        {
          content: 'DPC - dia',
          styles: { fillColor: [117, 198, 126], fontStyle: 'bold' },
        },
        {
          content: 'DPC - noite',
          styles: { fillColor: [117, 198, 126], fontStyle: 'bold' },
        },
        {
          content: 'EPC - dia',
          styles: { fillColor: [242, 204, 65], fontStyle: 'bold' },
        },
        {
          content: 'EPC - noite',
          styles: { fillColor: [242, 204, 65], fontStyle: 'bold' },
        },
      ],
    ],
    body: bodyRows,
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 18 },
      2: { cellWidth: 20 },
      3: { cellWidth: 23 },
      4: { cellWidth: 23 },
      5: { cellWidth: 23 },
      6: { cellWidth: 23 },
      7: { cellWidth: 23 },
      8: { cellWidth: 23 },
    },
  });

  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? 230;

  let sigY = finalY + 9;
  if (sigY + 18 > pageHeight - 10) {
    doc.addPage();
    sigY = 24;
  }

  // Left: automatic date without time ("Joinville, DD/MM/AAAA")
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(assinatura.localData, 12, sigY);

  // Centered institutional coordinator signature block:
  // [NOME]
  // Delegado de Polícia Civil
  // (assinado digitalmente)
  const sigCenterX = pageWidth / 2 + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(assinatura.nome, sigCenterX, sigY, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(assinatura.cargo, sigCenterX, sigY + 5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(assinatura.seloDigital, sigCenterX, sigY + 9.8, { align: 'center' });

  doc.save(filename);
  return { filename, assinatura };
}
