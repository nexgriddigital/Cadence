import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLedgerPdfData,
  createLedgerPdfDocument,
  createPayoutReceiptPdfDocument,
  sanitizePdfText,
} from './pdfExport';
import type { PayoutRecord, Recruit } from '../types/payroll';

const recruits: Recruit[] = [
  {
    id: 'rec-1',
    name: "Liam O’Connor",
    role: 'Security Engineer',
    company: 'Northstar Systems',
    email: 'liam@northstarsys.com',
    startDate: '2026-10-01',
    commissionModel: 'percentage',
    customCommissionValue: 12,
    preferredPaymentMethod: 'ACH Direct Deposit',
    paymentAccountDetail: 'Chase Checking ••4821',
    active: true,
  },
];

const payouts: PayoutRecord[] = [
  {
    id: 'pay-1',
    recruitId: 'rec-1',
    payDate: '2026-11-15',
    payPeriodLabel: 'Nov 1 – Nov 15, 2026',
    grossEmployeePay: 4800,
    commissionModel: 'percentage',
    commissionRateOrFlat: 12,
    baseCommissionAmount: 576,
    bonuses: [
      { id: 'high-pay-bonus', label: 'High-Pay Bonus (>= Br 4,500.00)', amount: 250 },
    ],
    totalBonusAmount: 250,
    totalRecruiterEarnings: 826,
    paymentMethod: 'ACH Direct Deposit',
    paymentAccountDetail: 'Chase Checking ••4821',
    referenceCode: 'CAD-2601',
    status: 'Paid',
    isRetentionMilestone: false,
    notes: 'Settled via ACH · Confirmed',
  },
];

const recruitsMap = new Map(recruits.map((r) => [r.id, r]));

test('sanitizes unicode bullets, dashes, and curly quotes for standard PDF fonts', () => {
  assert.equal(sanitizePdfText("Liam O’Connor ••4821 – Paid"), "Liam O'Connor **4821 - Paid");
});

test('builds ledger PDF summary and formatted ETB (Br) rows', () => {
  const result = buildLedgerPdfData(payouts, recruitsMap, {
    status: 'Paid',
    paymentMethod: 'All',
    search: 'Liam',
  });

  assert.equal(result.totals.count, 1);
  assert.equal(result.totals.gross, 4800);
  assert.equal(result.totals.comm, 576);
  assert.equal(result.totals.bonus, 250);
  assert.equal(result.totals.total, 826);
  assert.match(result.filterSummary, /Status: Paid/);
  assert.match(result.filterSummary, /1 entry/);
  assert.equal(result.rows[0][0], 'CAD-2601');
  assert.equal(result.rows[0][1], "Liam O'Connor");
  assert.equal(result.rows[0][3], 'Br 4,800.00');
  assert.equal(result.rows[0][6], 'Br 826.00');
});

test('generates valid PDF binary output for full ledger and single payout receipt', () => {
  const ledgerDoc = createLedgerPdfDocument(payouts, recruitsMap);
  const ledgerBytes = ledgerDoc.output('arraybuffer');
  const ledgerHeader = new TextDecoder().decode(new Uint8Array(ledgerBytes).slice(0, 5));
  assert.equal(ledgerHeader, '%PDF-');
  assert.ok(ledgerBytes.byteLength > 1000);

  const receiptDoc = createPayoutReceiptPdfDocument(payouts[0], recruits[0]);
  const receiptBytes = receiptDoc.output('arraybuffer');
  const receiptHeader = new TextDecoder().decode(new Uint8Array(receiptBytes).slice(0, 5));
  assert.equal(receiptHeader, '%PDF-');
  assert.ok(receiptBytes.byteLength > 1000);
});
