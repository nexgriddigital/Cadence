import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PayoutFilters, PayoutRecord, Recruit } from '../types/payroll';
import { formatCurrency, formatDateShort } from './commissionEngine';

export function sanitizePdfText(input: string): string {
  return input
    .replace(/[•●]/g, '*')
    .replace(/[·]/g, '-')
    .replace(/[–—]/g, '-')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\xFF]/g, '');
}

export interface LedgerPdfSummary {
  count: number;
  gross: number;
  comm: number;
  bonus: number;
  total: number;
}

export interface LedgerPdfData {
  generatedDate: string;
  filterSummary: string;
  totals: LedgerPdfSummary;
  rows: string[][];
}

export function buildLedgerPdfData(
  payouts: PayoutRecord[],
  recruitsMap: Map<string, Recruit>,
  filters?: Partial<PayoutFilters>
): LedgerPdfData {
  const generatedDate = new Date().toISOString().slice(0, 10);

  const filterParts: string[] = [];
  if (filters?.status && filters.status !== 'All') {
    filterParts.push(`Status: ${filters.status}`);
  } else {
    filterParts.push('All statuses');
  }
  if (filters?.paymentMethod && filters.paymentMethod !== 'All') {
    filterParts.push(`Method: ${filters.paymentMethod}`);
  } else {
    filterParts.push('All payment methods');
  }
  if (filters?.search?.trim()) {
    filterParts.push(`Search: "${sanitizePdfText(filters.search.trim())}"`);
  }

  let gross = 0;
  let comm = 0;
  let bonus = 0;
  let total = 0;

  const rows = payouts.map((payout) => {
    const recruit = recruitsMap.get(payout.recruitId);
    gross += payout.grossEmployeePay;
    comm += payout.baseCommissionAmount;
    bonus += payout.totalBonusAmount;
    total += payout.totalRecruiterEarnings;

    return [
      sanitizePdfText(payout.referenceCode),
      sanitizePdfText(recruit?.name ?? 'Unknown Recruit'),
      sanitizePdfText(formatDateShort(payout.payDate)),
      sanitizePdfText(formatCurrency(payout.grossEmployeePay)),
      sanitizePdfText(formatCurrency(payout.baseCommissionAmount)),
      payout.totalBonusAmount > 0
        ? sanitizePdfText(`+${formatCurrency(payout.totalBonusAmount)}`)
        : '-',
      sanitizePdfText(formatCurrency(payout.totalRecruiterEarnings)),
      sanitizePdfText(`${payout.paymentMethod} (${payout.paymentAccountDetail})`),
      sanitizePdfText(payout.status),
    ];
  });

  return {
    generatedDate,
    filterSummary: `${filterParts.join(' | ')} | ${payouts.length} ${
      payouts.length === 1 ? 'entry' : 'entries'
    }`,
    totals: {
      count: payouts.length,
      gross,
      comm,
      bonus,
      total,
    },
    rows,
  };
}

export function createLedgerPdfDocument(
  payouts: PayoutRecord[],
  recruitsMap: Map<string, Recruit>,
  filters?: Partial<PayoutFilters>
): jsPDF {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'letter',
  });

  const data = buildLedgerPdfData(payouts, recruitsMap, filters);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 36;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('Cadence', marginX, 40);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('Recruiting Commission & Payout Ledger', marginX, 56);

  doc.setFontSize(9);
  doc.text(`Generated ${data.generatedDate}`, pageWidth - marginX, 40, {
    align: 'right',
  });
  doc.text(data.filterSummary, pageWidth - marginX, 55, {
    align: 'right',
  });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(1);
  doc.line(marginX, 68, pageWidth - marginX, 68);

  // 4-column summary boxes
  const summaryCards = [
    { label: 'EMPLOYEE PAID', value: formatCurrency(data.totals.gross) },
    { label: 'BASE COMMISSIONS', value: formatCurrency(data.totals.comm) },
    { label: 'AUTO BONUSES', value: formatCurrency(data.totals.bonus) },
    { label: 'TOTAL EARNED', value: formatCurrency(data.totals.total) },
  ];
  const gap = 10;
  const cardWidth = (pageWidth - marginX * 2 - gap * 3) / 4;
  const cardY = 80;
  const cardHeight = 46;

  summaryCards.forEach((card, idx) => {
    const x = marginX + idx * (cardWidth + gap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 4, 4, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(card.label, x + 10, cardY + 16);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(idx === 3 ? 29 : 15, idx === 3 ? 78 : 23, idx === 3 ? 216 : 42);
    doc.text(sanitizePdfText(card.value), x + 10, cardY + 34);
  });

  // Ledger table
  autoTable(doc, {
    startY: 140,
    margin: { left: marginX, right: marginX, bottom: 42 },
    head: [
      [
        'Ref',
        'Employee',
        'Pay Date',
        'Employee Paid',
        'Commission',
        'Auto Bonus',
        'Total Earned',
        'Payment Method',
        'Status',
      ],
    ],
    body: data.rows,
    foot: [
      [
        'Totals',
        `${data.totals.count} ${data.totals.count === 1 ? 'entry' : 'entries'}`,
        '',
        sanitizePdfText(formatCurrency(data.totals.gross)),
        sanitizePdfText(formatCurrency(data.totals.comm)),
        sanitizePdfText(`+${formatCurrency(data.totals.bonus)}`),
        sanitizePdfText(formatCurrency(data.totals.total)),
        '',
        '',
      ],
    ],
    showFoot: 'lastPage',
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      textColor: [30, 41, 59],
      cellPadding: { top: 6, right: 6, bottom: 6, left: 6 },
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 58 },
      1: { cellWidth: 92 },
      2: { cellWidth: 66 },
      3: { halign: 'right', cellWidth: 78 },
      4: { halign: 'right', cellWidth: 74 },
      5: { halign: 'right', cellWidth: 68 },
      6: { halign: 'right', cellWidth: 78, fontStyle: 'bold' },
      7: { cellWidth: 'auto' },
      8: { cellWidth: 58 },
    },
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Cadence Payroll & Commissions', marginX, pageHeight - 20);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - marginX, pageHeight - 20, {
      align: 'right',
    });
  }

  return doc;
}

export function exportLedgerToPdf(
  payouts: PayoutRecord[],
  recruitsMap: Map<string, Recruit>,
  filters?: Partial<PayoutFilters>
): void {
  const doc = createLedgerPdfDocument(payouts, recruitsMap, filters);
  const dateStamp = new Date().toISOString().slice(0, 10);
  doc.save(`cadence-payout-ledger-${dateStamp}.pdf`);
}

export function createPayoutReceiptPdfDocument(
  payout: PayoutRecord,
  recruit: Recruit | null
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 44;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text('Cadence', marginX, 50);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('Payout & Commission Statement', marginX, 66);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizePdfText(payout.referenceCode), pageWidth - marginX, 50, {
    align: 'right',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    sanitizePdfText(`Status: ${payout.status}`),
    pageWidth - marginX,
    66,
    { align: 'right' }
  );

  doc.setDrawColor(226, 232, 240);
  doc.line(marginX, 82, pageWidth - marginX, 82);

  const metaRows = [
    ['Recruited Employee', sanitizePdfText(recruit?.name ?? 'Unknown Recruit')],
    [
      'Role & Company',
      sanitizePdfText(
        recruit ? `${recruit.role} - ${recruit.company}` : 'Not specified'
      ),
    ],
    ['Pay Date', sanitizePdfText(formatDateShort(payout.payDate))],
    ['Pay Period', sanitizePdfText(payout.payPeriodLabel)],
    [
      'Employee Gross Paid',
      sanitizePdfText(formatCurrency(payout.grossEmployeePay)),
    ],
    [
      'Payment Rail',
      sanitizePdfText(`${payout.paymentMethod} (${payout.paymentAccountDetail})`),
    ],
  ];

  autoTable(doc, {
    startY: 98,
    margin: { left: marginX, right: marginX },
    body: metaRows,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 9.5,
      textColor: [30, 41, 59],
      cellPadding: { top: 6, right: 8, bottom: 6, left: 8 },
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
    },
    columnStyles: {
      0: { cellWidth: 150, fontStyle: 'bold', textColor: [100, 116, 139] },
      1: { cellWidth: 'auto' },
    },
  });

  const breakdownStartY =
    ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY ?? 240) + 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Commission & Bonus Breakdown', marginX, breakdownStartY);

  const breakdownRows: string[][] = [
    [
      sanitizePdfText(
        `Base Commission (${
          payout.commissionModel === 'flat'
            ? `${formatCurrency(payout.commissionRateOrFlat)} flat`
            : `${payout.commissionRateOrFlat}%`
        })`
      ),
      sanitizePdfText(formatCurrency(payout.baseCommissionAmount)),
    ],
  ];

  if (payout.bonuses.length === 0) {
    breakdownRows.push(['Triggered Bonuses', 'Br 0.00']);
  } else {
    for (const bonus of payout.bonuses) {
      breakdownRows.push([
        sanitizePdfText(bonus.label),
        sanitizePdfText(`+${formatCurrency(bonus.amount)}`),
      ]);
    }
  }

  autoTable(doc, {
    startY: breakdownStartY + 10,
    margin: { left: marginX, right: marginX },
    head: [['Line Item', 'Amount (ETB)']],
    body: breakdownRows,
    foot: [
      [
        'Total Recruiter Earnings',
        sanitizePdfText(formatCurrency(payout.totalRecruiterEarnings)),
      ],
    ],
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 9.5,
      textColor: [30, 41, 59],
      cellPadding: { top: 7, right: 8, bottom: 7, left: 8 },
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [29, 78, 216],
      fontStyle: 'bold',
      fontSize: 10.5,
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 130 },
    },
  });

  if (payout.notes.trim()) {
    const notesY =
      ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
        ?.finalY ?? 420) + 24;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Ledger Notes', marginX, notesY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    const wrapped = doc.splitTextToSize(
      sanitizePdfText(payout.notes),
      pageWidth - marginX * 2
    );
    doc.text(wrapped, marginX, notesY + 16);
  }

  return doc;
}

export function exportPayoutReceiptToPdf(
  payout: PayoutRecord,
  recruit: Recruit | null
): void {
  const doc = createPayoutReceiptPdfDocument(payout, recruit);
  const safeRef = sanitizePdfText(payout.referenceCode).replace(/[^a-zA-Z0-9_-]/g, '-');
  doc.save(`cadence-payout-${safeRef}.pdf`);
}
