import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSixMonthPayoutTrend,
  calculatePayoutBreakdown,
  computeDashboardMetrics,
  computePerformanceTargetProgress,
  computeYearlyPerformanceSummary,
  exportPayoutsToCsv,
  filterPayouts,
  formatCompactCurrency,
  formatCurrency,
  getAvailablePerformanceYears,
  resolvePayoutCommissionMultiplier,
} from './commissionEngine';
import type {
  CommissionRuleSet,
  PayoutRecord,
  PerformanceTarget,
  Recruit,
} from '../types/payroll';

const defaultRules: CommissionRuleSet = {
  defaultCommissionRatePct: 12,
  highPayBonusThreshold: 4500,
  highPayBonusAmount: 250,
  tierAcceleratorThreshold: 20000,
  tierAcceleratorRatePct: 3,
  retentionMilestoneBonusAmount: 500,
};

const sampleRecruits: Recruit[] = [
  {
    id: 'rec-1',
    name: 'Elena Vance',
    role: 'Senior Backend Engineer',
    company: 'Northstar Labs',
    email: 'elena.vance@northstar.io',
    startDate: '2026-06-01',
    commissionModel: 'percentage',
    customCommissionValue: null,
    preferredPaymentMethod: 'ACH Direct Deposit',
    paymentAccountDetail: 'Chase Checking ••4821',
    active: true,
  },
  {
    id: 'rec-2',
    name: 'Marcus Chen',
    role: 'Product Designer',
    company: 'Northstar Labs',
    email: 'marcus.chen@northstar.io',
    startDate: '2026-07-15',
    commissionModel: 'flat',
    customCommissionValue: 650,
    preferredPaymentMethod: 'Wise',
    paymentAccountDetail: 'Wise USD ••9014',
    active: true,
  },
];

test('calculates standard percentage commission without bonuses below thresholds', () => {
  const result = calculatePayoutBreakdown({
    grossEmployeePay: 3000,
    recruit: sampleRecruits[0],
    rules: defaultRules,
    priorCumulativeEmployeePay: 5000,
    isRetentionMilestone: false,
  });

  assert.equal(result.commissionRateOrFlat, 12);
  assert.equal(result.baseCommissionAmount, 360);
  assert.equal(result.bonuses.length, 0);
  assert.equal(result.totalBonusAmount, 0);
  assert.equal(result.totalRecruiterEarnings, 360);
});

test('triggers high-pay bonus, tier accelerator, and retention milestone automatically', () => {
  const result = calculatePayoutBreakdown({
    grossEmployeePay: 5000,
    recruit: sampleRecruits[0],
    rules: defaultRules,
    priorCumulativeEmployeePay: 18000, // 18000 + 5000 = 23000 >= 20000
    isRetentionMilestone: true,
  });

  assert.equal(result.baseCommissionAmount, 600); // 12% of 5000
  assert.equal(result.bonuses.length, 3);
  // 250 high pay + 150 (3% of 5000) tier accelerator + 500 retention milestone = 900
  assert.equal(result.totalBonusAmount, 900);
  assert.equal(result.totalRecruiterEarnings, 1500);
});

test('respects flat commission override on recruit', () => {
  const result = calculatePayoutBreakdown({
    grossEmployeePay: 4000,
    recruit: sampleRecruits[1],
    rules: defaultRules,
    priorCumulativeEmployeePay: 0,
    isRetentionMilestone: false,
  });

  assert.equal(result.commissionModel, 'flat');
  assert.equal(result.baseCommissionAmount, 650);
  assert.equal(result.totalRecruiterEarnings, 650);
});

test('computes dashboard metrics excluding On Hold entries from active earnings', () => {
  const payouts: PayoutRecord[] = [
    {
      id: 'pay-1',
      recruitId: 'rec-1',
      payDate: '2026-10-15',
      payPeriodLabel: 'Oct 1 – Oct 15, 2026',
      grossEmployeePay: 4000,
      commissionModel: 'percentage',
      commissionRateOrFlat: 12,
      baseCommissionAmount: 480,
      bonuses: [],
      totalBonusAmount: 0,
      totalRecruiterEarnings: 480,
      paymentMethod: 'ACH Direct Deposit',
      paymentAccountDetail: 'Chase Checking ••4821',
      referenceCode: 'PAY-1001',
      status: 'Paid',
      isRetentionMilestone: false,
      notes: '',
    },
    {
      id: 'pay-2',
      recruitId: 'rec-2',
      payDate: '2026-11-01',
      payPeriodLabel: 'Oct 16 – Oct 31, 2026',
      grossEmployeePay: 5000,
      commissionModel: 'flat',
      commissionRateOrFlat: 650,
      baseCommissionAmount: 650,
      bonuses: [{ id: 'high-pay-bonus', label: 'High-Pay Bonus', amount: 250 }],
      totalBonusAmount: 250,
      totalRecruiterEarnings: 900,
      paymentMethod: 'Wise',
      paymentAccountDetail: 'Wise USD ••9014',
      referenceCode: 'PAY-1002',
      status: 'Pending',
      isRetentionMilestone: false,
      notes: '',
    },
    {
      id: 'pay-3',
      recruitId: 'rec-1',
      payDate: '2026-11-05',
      payPeriodLabel: 'Adjustment',
      grossEmployeePay: 1000,
      commissionModel: 'percentage',
      commissionRateOrFlat: 12,
      baseCommissionAmount: 120,
      bonuses: [],
      totalBonusAmount: 0,
      totalRecruiterEarnings: 120,
      paymentMethod: 'Check',
      paymentAccountDetail: 'Check #881',
      referenceCode: 'PAY-1003',
      status: 'On Hold',
      isRetentionMilestone: false,
      notes: 'Disputed hours',
    },
  ];

  const metrics = computeDashboardMetrics(payouts, sampleRecruits);
  assert.equal(metrics.totalEmployeePaid, 9000);
  assert.equal(metrics.totalCommissionsEarned, 1130);
  assert.equal(metrics.totalBonusesEarned, 250);
  assert.equal(metrics.totalRecruiterEarnings, 1380);
  assert.equal(metrics.pendingSettlementsAmount, 900);
  assert.equal(metrics.pendingSettlementsCount, 1);
  assert.equal(metrics.paidCount, 1);
  assert.equal(metrics.monthlySeries.length, 2);
  assert.equal(metrics.monthlySeries[0].totalCommissionPayout, 480);
  assert.equal(metrics.monthlySeries[1].totalCommissionPayout, 900);
});

test('limits monthlySeries to the last 6 months sorted chronologically', () => {
  const manyMonths: PayoutRecord[] = [
    '2026-04-15',
    '2026-05-15',
    '2026-06-15',
    '2026-07-15',
    '2026-08-15',
    '2026-09-15',
    '2026-10-15',
    '2026-11-15',
  ].map((payDate, idx) => ({
    id: `m-${idx}`,
    recruitId: 'rec-1',
    payDate,
    payPeriodLabel: payDate,
    grossEmployeePay: 1000 * (idx + 1),
    commissionModel: 'percentage',
    commissionRateOrFlat: 10,
    baseCommissionAmount: 100 * (idx + 1),
    bonuses: [],
    totalBonusAmount: 50,
    totalRecruiterEarnings: 100 * (idx + 1) + 50,
    paymentMethod: 'ACH Direct Deposit',
    paymentAccountDetail: 'Chase ••4821',
    referenceCode: `REF-${idx}`,
    status: 'Paid',
    isRetentionMilestone: false,
    notes: '',
  }));

  const metrics = computeDashboardMetrics(manyMonths, sampleRecruits);
  assert.equal(metrics.monthlySeries.length, 6);
  assert.equal(metrics.monthlySeries[0].monthKey, '2026-06');
  assert.equal(metrics.monthlySeries[5].monthKey, '2026-11');
  assert.equal(metrics.monthlySeries[5].totalCommissionPayout, 850);
});

test('filters payouts by search query, status, and payment method', () => {
  const recruitsMap = new Map(sampleRecruits.map((r) => [r.id, r]));
  const payouts: PayoutRecord[] = [
    {
      id: 'pay-1',
      recruitId: 'rec-1',
      payDate: '2026-10-15',
      payPeriodLabel: 'Oct 1 – Oct 15, 2026',
      grossEmployeePay: 4000,
      commissionModel: 'percentage',
      commissionRateOrFlat: 12,
      baseCommissionAmount: 480,
      bonuses: [],
      totalBonusAmount: 0,
      totalRecruiterEarnings: 480,
      paymentMethod: 'ACH Direct Deposit',
      paymentAccountDetail: 'Chase ••4821',
      referenceCode: 'PAY-1001',
      status: 'Paid',
      isRetentionMilestone: false,
      notes: '',
    },
    {
      id: 'pay-2',
      recruitId: 'rec-2',
      payDate: '2026-11-01',
      payPeriodLabel: 'Oct 16 – Oct 31, 2026',
      grossEmployeePay: 5000,
      commissionModel: 'flat',
      commissionRateOrFlat: 650,
      baseCommissionAmount: 650,
      bonuses: [],
      totalBonusAmount: 0,
      totalRecruiterEarnings: 650,
      paymentMethod: 'Wise',
      paymentAccountDetail: 'Wise ••9014',
      referenceCode: 'CAD-2002',
      status: 'Pending',
      isRetentionMilestone: false,
      notes: '',
    },
  ];

  const bySearch = filterPayouts(payouts, recruitsMap, {
    search: 'marcus',
    status: 'All',
    paymentMethod: 'All',
    sortBy: 'date-desc',
  });
  assert.equal(bySearch.length, 1);
  assert.equal(bySearch[0].id, 'pay-2');

  const byPayoutId = filterPayouts(payouts, recruitsMap, {
    search: 'pay-1',
    status: 'All',
    paymentMethod: 'All',
    sortBy: 'date-desc',
  });
  assert.equal(byPayoutId.length, 1);
  assert.equal(byPayoutId[0].id, 'pay-1');

  const byRefCode = filterPayouts(payouts, recruitsMap, {
    search: 'CAD-2002',
    status: 'All',
    paymentMethod: 'All',
    sortBy: 'date-desc',
  });
  assert.equal(byRefCode.length, 1);
  assert.equal(byRefCode[0].id, 'pay-2');

  const byRecruitId = filterPayouts(payouts, recruitsMap, {
    search: 'rec-2',
    status: 'All',
    paymentMethod: 'All',
    sortBy: 'date-desc',
  });
  assert.equal(byRecruitId.length, 1);
  assert.equal(byRecruitId[0].id, 'pay-2');

  const byStatusQuery = filterPayouts(payouts, recruitsMap, {
    search: 'pending',
    status: 'All',
    paymentMethod: 'All',
    sortBy: 'date-desc',
  });
  assert.equal(byStatusQuery.length, 1);
  assert.equal(byStatusQuery[0].id, 'pay-2');

  const byMethod = filterPayouts(payouts, recruitsMap, {
    search: '',
    status: 'Paid',
    paymentMethod: 'ACH Direct Deposit',
    sortBy: 'date-desc',
  });
  assert.equal(byMethod.length, 1);
  assert.equal(byMethod[0].id, 'pay-1');
});

test('formats currency in ETB (Br) and exports CSV with ETB headers', () => {
  assert.equal(formatCurrency(4850.5), 'Br 4,850.50');
  assert.equal(formatCurrency(-120), '-Br 120.00');
  assert.equal(formatCompactCurrency(125000), 'Br 125K');

  const recruitsMap = new Map(sampleRecruits.map((r) => [r.id, r]));
  const csv = exportPayoutsToCsv(
    [
      {
        id: 'pay-1',
        recruitId: 'rec-1',
        payDate: '2026-10-15',
        payPeriodLabel: 'Oct 1 – Oct 15, 2026',
        grossEmployeePay: 4000,
        commissionModel: 'percentage',
        commissionRateOrFlat: 12,
        baseCommissionAmount: 480,
        bonuses: [],
        totalBonusAmount: 0,
        totalRecruiterEarnings: 480,
        paymentMethod: 'ACH Direct Deposit',
        paymentAccountDetail: 'Chase ••4821',
        referenceCode: 'PAY-1001',
        status: 'Paid',
        isRetentionMilestone: false,
        notes: 'Includes "Q4" bonus, verified',
      },
    ],
    recruitsMap
  );

  assert.match(csv, /^Reference,Pay Date,/);
  assert.match(csv, /Employee Gross Paid \(ETB\)/);
  assert.match(csv, /"Oct 1 – Oct 15, 2026"/);
  assert.match(csv, /"Includes ""Q4"" bonus, verified"/);
});

test('computes monthly performance target progress and excludes held or other-month payouts', () => {
  const targets: PerformanceTarget[] = [
    {
      id: 'rec-1',
      recruitId: 'rec-1',
      monthlyPayGoal: 5000,
      multiplierFactor: 1.25,
      active: true,
    },
    {
      id: 'rec-2',
      recruitId: 'rec-2',
      monthlyPayGoal: 4000,
      multiplierFactor: 1.5,
      active: false,
    },
  ];

  const payouts: PayoutRecord[] = [
    {
      id: 'p-1',
      recruitId: 'rec-1',
      payDate: '2026-11-05',
      payPeriodLabel: 'Nov 1 – Nov 15, 2026',
      grossEmployeePay: 3000,
      commissionModel: 'percentage',
      commissionRateOrFlat: 12,
      baseCommissionAmount: 360,
      bonuses: [],
      totalBonusAmount: 0,
      totalRecruiterEarnings: 360,
      paymentMethod: 'ACH Direct Deposit',
      paymentAccountDetail: 'Chase ••4821',
      referenceCode: 'PAY-1',
      status: 'Paid',
      isRetentionMilestone: false,
      notes: '',
    },
    {
      id: 'p-2',
      recruitId: 'rec-1',
      payDate: '2026-11-15',
      payPeriodLabel: 'Nov 16 – Nov 30, 2026',
      grossEmployeePay: 2500,
      commissionModel: 'percentage',
      commissionRateOrFlat: 12,
      baseCommissionAmount: 300,
      bonuses: [],
      totalBonusAmount: 0,
      totalRecruiterEarnings: 300,
      paymentMethod: 'ACH Direct Deposit',
      paymentAccountDetail: 'Chase ••4821',
      referenceCode: 'PAY-2',
      status: 'Pending',
      isRetentionMilestone: false,
      notes: '',
    },
    {
      id: 'p-held',
      recruitId: 'rec-2',
      payDate: '2026-11-10',
      payPeriodLabel: 'Nov 1 – Nov 15, 2026',
      grossEmployeePay: 5000,
      commissionModel: 'flat',
      commissionRateOrFlat: 600,
      baseCommissionAmount: 600,
      bonuses: [],
      totalBonusAmount: 0,
      totalRecruiterEarnings: 600,
      paymentMethod: 'Wise',
      paymentAccountDetail: 'Wise ••9014',
      referenceCode: 'PAY-3',
      status: 'On Hold',
      isRetentionMilestone: false,
      notes: '',
    },
    {
      id: 'p-oct',
      recruitId: 'rec-1',
      payDate: '2026-10-15',
      payPeriodLabel: 'Oct 1 – Oct 15, 2026',
      grossEmployeePay: 4000,
      commissionModel: 'percentage',
      commissionRateOrFlat: 12,
      baseCommissionAmount: 480,
      bonuses: [],
      totalBonusAmount: 0,
      totalRecruiterEarnings: 480,
      paymentMethod: 'ACH Direct Deposit',
      paymentAccountDetail: 'Chase ••4821',
      referenceCode: 'PAY-4',
      status: 'Paid',
      isRetentionMilestone: false,
      notes: '',
    },
  ];

  const progress = computePerformanceTargetProgress(
    sampleRecruits,
    payouts,
    targets,
    '2026-11'
  );

  const elena = progress.find((item) => item.recruit.id === 'rec-1')!;
  assert.equal(elena.monthlyEmployeePaid, 5500);
  assert.equal(elena.monthlyPayoutCount, 2);
  assert.equal(elena.progressPct, 100);
  assert.equal(elena.rawProgressPct, 110);
  assert.equal(elena.remainingAmount, 0);
  assert.equal(elena.goalReached, true);
  assert.equal(elena.activeMultiplier, 1.25);
  assert.equal(elena.projectedMultiplierBoost, 165); // (360 + 300) * 0.25

  const marcus = progress.find((item) => item.recruit.id === 'rec-2')!;
  assert.equal(marcus.monthlyEmployeePaid, 0); // On Hold excluded
  assert.equal(marcus.goalReached, false);
  assert.equal(marcus.activeMultiplier, 1); // Paused
  assert.equal(marcus.projectedMultiplierBoost, 0);
});

test('resolves commission multiplier when monthly goal is crossed and applies multiplier bonus', () => {
  const targets: PerformanceTarget[] = [
    {
      id: 'rec-1',
      recruitId: 'rec-1',
      monthlyPayGoal: 5000,
      multiplierFactor: 1.25,
      active: true,
    },
  ];

  const priorPayouts: PayoutRecord[] = [
    {
      id: 'p-1',
      recruitId: 'rec-1',
      payDate: '2026-11-02',
      payPeriodLabel: 'Nov 1 – Nov 15, 2026',
      grossEmployeePay: 3000,
      commissionModel: 'percentage',
      commissionRateOrFlat: 12,
      baseCommissionAmount: 360,
      bonuses: [],
      totalBonusAmount: 0,
      totalRecruiterEarnings: 360,
      paymentMethod: 'ACH Direct Deposit',
      paymentAccountDetail: 'Chase ••4821',
      referenceCode: 'PAY-1',
      status: 'Paid',
      isRetentionMilestone: false,
      notes: '',
    },
  ];

  // 3000 + 1500 = 4500 < 5000 -> multiplier 1
  const belowGoal = resolvePayoutCommissionMultiplier({
    recruitId: 'rec-1',
    payDate: '2026-11-16',
    grossEmployeePay: 1500,
    payouts: priorPayouts,
    targets,
  });
  assert.equal(belowGoal, 1);

  // 3000 + 2000 = 5000 >= 5000 -> multiplier 1.25
  const reachesGoal = resolvePayoutCommissionMultiplier({
    recruitId: 'rec-1',
    payDate: '2026-11-16',
    grossEmployeePay: 2000,
    payouts: priorPayouts,
    targets,
  });
  assert.equal(reachesGoal, 1.25);

  const breakdown = calculatePayoutBreakdown({
    grossEmployeePay: 2000,
    recruit: sampleRecruits[0],
    rules: defaultRules,
    priorCumulativeEmployeePay: 3000,
    isRetentionMilestone: false,
    commissionMultiplier: reachesGoal,
  });

  // Base = 2000 * 12% = 240; multiplier bonus = 240 * 0.25 = 60
  assert.equal(breakdown.baseCommissionAmount, 240);
  assert.equal(breakdown.totalBonusAmount, 60);
  assert.equal(breakdown.totalRecruiterEarnings, 300);
  assert.equal(breakdown.bonuses.length, 1);
  assert.equal(breakdown.bonuses[0].id, 'performance-multiplier');
});

test('builds a continuous 6-month calendar payout trend zero-filling inactive months', () => {
  const payouts: PayoutRecord[] = [
    {
      id: 't-1',
      recruitId: 'rec-1',
      payDate: '2026-07-15',
      payPeriodLabel: 'Jul 2026',
      grossEmployeePay: 4000,
      commissionModel: 'percentage',
      commissionRateOrFlat: 12,
      baseCommissionAmount: 480,
      bonuses: [],
      totalBonusAmount: 0,
      totalRecruiterEarnings: 480,
      paymentMethod: 'ACH Direct Deposit',
      paymentAccountDetail: 'Chase ••4821',
      referenceCode: 'CAD-1',
      status: 'Paid',
      isRetentionMilestone: false,
      notes: '',
    },
    {
      id: 't-2',
      recruitId: 'rec-1',
      payDate: '2026-11-10',
      payPeriodLabel: 'Nov 2026',
      grossEmployeePay: 5000,
      commissionModel: 'percentage',
      commissionRateOrFlat: 12,
      baseCommissionAmount: 600,
      bonuses: [{ id: 'high-pay-bonus', label: 'High-Pay Bonus', amount: 250 }],
      totalBonusAmount: 250,
      totalRecruiterEarnings: 850,
      paymentMethod: 'ACH Direct Deposit',
      paymentAccountDetail: 'Chase ••4821',
      referenceCode: 'CAD-2',
      status: 'Paid',
      isRetentionMilestone: false,
      notes: '',
    },
    {
      id: 't-hold',
      recruitId: 'rec-1',
      payDate: '2026-09-10',
      payPeriodLabel: 'Sep 2026',
      grossEmployeePay: 3000,
      commissionModel: 'percentage',
      commissionRateOrFlat: 12,
      baseCommissionAmount: 360,
      bonuses: [],
      totalBonusAmount: 0,
      totalRecruiterEarnings: 360,
      paymentMethod: 'ACH Direct Deposit',
      paymentAccountDetail: 'Chase ••4821',
      referenceCode: 'CAD-3',
      status: 'On Hold',
      isRetentionMilestone: false,
      notes: '',
    },
  ];

  const trend = buildSixMonthPayoutTrend(payouts, '2026-11');
  assert.equal(trend.length, 6);
  assert.deepEqual(
    trend.map((p) => p.monthKey),
    ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']
  );

  // July has 1 payout
  assert.equal(trend[1].employeePaid, 4000);
  assert.equal(trend[1].totalCommissionPayout, 480);
  assert.equal(trend[1].payoutCount, 1);

  // September was On Hold -> zero-filled
  assert.equal(trend[3].totalCommissionPayout, 0);
  assert.equal(trend[3].payoutCount, 0);

  // November has 1 payout with bonus
  assert.equal(trend[5].employeePaid, 5000);
  assert.equal(trend[5].commissionEarned, 600);
  assert.equal(trend[5].bonusEarned, 250);
  assert.equal(trend[5].totalCommissionPayout, 850);
  assert.equal(trend[5].payoutCount, 1);
});

test('aggregates yearly performance summary across payouts, recruits, and commissions for a calendar year', () => {
  const recruits: Recruit[] = [
    {
      ...sampleRecruits[0],
      id: 'rec-2025',
      startDate: '2025-11-01',
    },
    {
      ...sampleRecruits[1],
      id: 'rec-2026-a',
      startDate: '2026-03-10',
    },
    {
      ...sampleRecruits[0],
      id: 'rec-2026-b',
      startDate: '2026-09-01',
    },
  ];

  const payouts: PayoutRecord[] = [
    {
      id: 'y-2025',
      recruitId: 'rec-2025',
      payDate: '2025-12-15',
      payPeriodLabel: 'Dec 2025',
      grossEmployeePay: 3000,
      commissionModel: 'percentage',
      commissionRateOrFlat: 10,
      baseCommissionAmount: 300,
      bonuses: [],
      totalBonusAmount: 0,
      totalRecruiterEarnings: 300,
      paymentMethod: 'ACH Direct Deposit',
      paymentAccountDetail: 'Chase ••4821',
      referenceCode: 'CAD-100',
      status: 'Paid',
      isRetentionMilestone: false,
      notes: '',
    },
    {
      id: 'y-2026-1',
      recruitId: 'rec-2025', // started in 2025, paid in 2026
      payDate: '2026-02-15',
      payPeriodLabel: 'Feb 2026',
      grossEmployeePay: 4000,
      commissionModel: 'percentage',
      commissionRateOrFlat: 12,
      baseCommissionAmount: 480,
      bonuses: [{ id: 'b1', label: 'Bonus', amount: 120 }],
      totalBonusAmount: 120,
      totalRecruiterEarnings: 600,
      paymentMethod: 'ACH Direct Deposit',
      paymentAccountDetail: 'Chase ••4821',
      referenceCode: 'CAD-101',
      status: 'Paid',
      isRetentionMilestone: false,
      notes: '',
    },
    {
      id: 'y-2026-2',
      recruitId: 'rec-2026-a',
      payDate: '2026-11-10',
      payPeriodLabel: 'Nov 2026',
      grossEmployeePay: 6000,
      commissionModel: 'percentage',
      commissionRateOrFlat: 12,
      baseCommissionAmount: 720,
      bonuses: [],
      totalBonusAmount: 0,
      totalRecruiterEarnings: 720,
      paymentMethod: 'Wise',
      paymentAccountDetail: 'Wise ••9014',
      referenceCode: 'CAD-102',
      status: 'Pending',
      isRetentionMilestone: false,
      notes: '',
    },
    {
      id: 'y-2026-hold',
      recruitId: 'rec-2026-b',
      payDate: '2026-11-12',
      payPeriodLabel: 'Nov 2026',
      grossEmployeePay: 5000,
      commissionModel: 'percentage',
      commissionRateOrFlat: 12,
      baseCommissionAmount: 600,
      bonuses: [],
      totalBonusAmount: 0,
      totalRecruiterEarnings: 600,
      paymentMethod: 'Wise',
      paymentAccountDetail: 'Wise ••9014',
      referenceCode: 'CAD-103',
      status: 'On Hold',
      isRetentionMilestone: false,
      notes: '',
    },
  ];

  const years = getAvailablePerformanceYears(payouts, recruits, '2026');
  assert.deepEqual(years, ['2026', '2025']);

  const summary2026 = computeYearlyPerformanceSummary(payouts, recruits, '2026');
  assert.equal(summary2026.year, '2026');
  assert.equal(summary2026.payoutCount, 2); // On Hold excluded
  assert.equal(summary2026.paidPayoutCount, 1);
  assert.equal(summary2026.totalEmployeePaid, 10000);
  assert.equal(summary2026.baseCommissionEarned, 1200);
  assert.equal(summary2026.bonusesEarned, 120);
  assert.equal(summary2026.totalCommissionEarned, 1320);
  assert.equal(summary2026.effectiveRatePct, 13.2);
  // Union: rec-2026-a (started+paid), rec-2026-b (started in 2026), rec-2025 (paid in 2026)
  assert.equal(summary2026.recruitsCount, 3);
  assert.equal(summary2026.recruitsStartedCount, 2);
  assert.equal(summary2026.recruitsPaidCount, 2);
});



