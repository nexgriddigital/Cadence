import type {
  BonusLineItem,
  CommissionRuleSet,
  PaymentMethodType,
  PayoutCalculationResult,
  PayoutFilters,
  PayoutRecord,
  PerformanceTarget,
  Recruit,
} from '../types/payroll';

export const PAYMENT_METHOD_TYPES: PaymentMethodType[] = [
  'ACH Direct Deposit',
  'Wire Transfer',
  'Wise',
  'PayPal',
  'Check',
];

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatCurrency(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  return `${sign}Br ${formatted}`;
}

export function formatCompactCurrency(amount: number): string {
  if (Math.abs(amount) >= 100000) {
    const sign = amount < 0 ? '-' : '';
    const formatted = new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(Math.abs(amount));
    return `${sign}Br ${formatted}`;
  }
  return formatCurrency(amount);
}

export function formatDateShort(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

export function getPriorCumulativePay(
  payouts: PayoutRecord[],
  recruitId: string,
  excludePayoutId?: string
): number {
  return roundCurrency(
    payouts
      .filter((p) => p.recruitId === recruitId && p.id !== excludePayoutId && p.status !== 'On Hold')
      .reduce((sum, p) => sum + p.grossEmployeePay, 0)
  );
}

export function getMonthlyEmployeePay(
  payouts: PayoutRecord[],
  recruitId: string,
  monthKey: string,
  excludePayoutId?: string
): number {
  return roundCurrency(
    payouts
      .filter(
        (p) =>
          p.recruitId === recruitId &&
          p.id !== excludePayoutId &&
          p.status !== 'On Hold' &&
          p.payDate.startsWith(monthKey)
      )
      .reduce((sum, p) => sum + p.grossEmployeePay, 0)
  );
}

export function resolvePayoutCommissionMultiplier(params: {
  recruitId: string;
  payDate: string;
  grossEmployeePay: number;
  payouts: PayoutRecord[];
  targets: PerformanceTarget[];
}): number {
  const { recruitId, payDate, grossEmployeePay, payouts, targets } = params;
  const target = targets.find((t) => t.recruitId === recruitId);
  if (!target || !target.active || target.monthlyPayGoal <= 0 || target.multiplierFactor <= 1) {
    return 1;
  }
  const monthKey = payDate.slice(0, 7);
  if (!monthKey) return 1;
  const priorMonthlyPay = getMonthlyEmployeePay(payouts, recruitId, monthKey);
  if (priorMonthlyPay + Math.max(0, grossEmployeePay) >= target.monthlyPayGoal) {
    return target.multiplierFactor;
  }
  return 1;
}

/**
 * Automatically calculates base commission and triggered bonuses for a recruit payout.
 */
export function calculatePayoutBreakdown(params: {
  grossEmployeePay: number;
  recruit: Pick<Recruit, 'commissionModel' | 'customCommissionValue'>;
  rules: CommissionRuleSet;
  priorCumulativeEmployeePay: number;
  isRetentionMilestone: boolean;
  commissionMultiplier?: number;
}): PayoutCalculationResult {
  const {
    grossEmployeePay,
    recruit,
    rules,
    priorCumulativeEmployeePay,
    isRetentionMilestone,
    commissionMultiplier = 1,
  } = params;

  const safeGross = Math.max(0, roundCurrency(grossEmployeePay));
  const model = recruit.commissionModel;
  const rateOrFlat =
    recruit.customCommissionValue !== null
      ? recruit.customCommissionValue
      : rules.defaultCommissionRatePct;

  const baseCommissionAmount =
    model === 'flat'
      ? roundCurrency(rateOrFlat)
      : roundCurrency((safeGross * rateOrFlat) / 100);

  const bonuses: BonusLineItem[] = [];

  if (
    rules.highPayBonusThreshold > 0 &&
    rules.highPayBonusAmount > 0 &&
    safeGross >= rules.highPayBonusThreshold
  ) {
    bonuses.push({
      id: 'high-pay-bonus',
      label: `High-Pay Bonus (>= ${formatCurrency(rules.highPayBonusThreshold)})`,
      amount: roundCurrency(rules.highPayBonusAmount),
    });
  }

  const cumulativeAfter = priorCumulativeEmployeePay + safeGross;
  if (
    rules.tierAcceleratorThreshold > 0 &&
    rules.tierAcceleratorRatePct > 0 &&
    cumulativeAfter >= rules.tierAcceleratorThreshold
  ) {
    const acceleratorAmount = roundCurrency((safeGross * rules.tierAcceleratorRatePct) / 100);
    if (acceleratorAmount > 0) {
      bonuses.push({
        id: 'tier-accelerator',
        label: `Volume Accelerator (+${rules.tierAcceleratorRatePct}% over ${formatCurrency(rules.tierAcceleratorThreshold)})`,
        amount: acceleratorAmount,
      });
    }
  }

  if (isRetentionMilestone && rules.retentionMilestoneBonusAmount > 0) {
    bonuses.push({
      id: 'retention-milestone',
      label: '90-Day Retention Milestone Bonus',
      amount: roundCurrency(rules.retentionMilestoneBonusAmount),
    });
  }

  const safeMultiplier =
    Number.isFinite(commissionMultiplier) && commissionMultiplier > 1
      ? commissionMultiplier
      : 1;
  if (safeMultiplier > 1) {
    const multiplierBonus = roundCurrency(
      baseCommissionAmount * (safeMultiplier - 1)
    );
    if (multiplierBonus > 0) {
      bonuses.push({
        id: 'performance-multiplier',
        label: `Performance Multiplier (${safeMultiplier}x goal reached)`,
        amount: multiplierBonus,
      });
    }
  }

  const totalBonusAmount = roundCurrency(
    bonuses.reduce((sum, item) => sum + item.amount, 0)
  );
  const totalRecruiterEarnings = roundCurrency(baseCommissionAmount + totalBonusAmount);

  return {
    commissionModel: model,
    commissionRateOrFlat: rateOrFlat,
    baseCommissionAmount,
    bonuses,
    totalBonusAmount,
    totalRecruiterEarnings,
  };
}

export interface MonthlySeriesPoint {
  monthKey: string; // YYYY-MM
  label: string; // e.g. "Jun"
  employeePaid: number;
  commissionEarned: number;
  bonusEarned: number;
  totalCommissionPayout: number;
}

export interface SixMonthTrendPoint extends MonthlySeriesPoint {
  payoutCount: number;
}

export interface PaymentMethodSummary {
  method: PaymentMethodType;
  payoutCount: number;
  employeeVolume: number;
  recruiterEarnings: number;
  sharePct: number;
}

export interface RecruitEarningsSummary {
  recruit: Recruit;
  payoutCount: number;
  totalEmployeePaid: number;
  totalCommission: number;
  totalBonuses: number;
  totalRecruiterEarnings: number;
  lastPayDate: string | null;
}

export interface DashboardMetrics {
  totalEmployeePaid: number;
  totalCommissionsEarned: number;
  totalBonusesEarned: number;
  totalRecruiterEarnings: number;
  pendingSettlementsAmount: number;
  pendingSettlementsCount: number;
  paidCount: number;
  averageEffectiveRatePct: number;
  monthlySeries: MonthlySeriesPoint[];
  paymentMethodBreakdown: PaymentMethodSummary[];
  recruitSummaries: RecruitEarningsSummary[];
}

export function computeDashboardMetrics(
  payouts: PayoutRecord[],
  recruits: Recruit[]
): DashboardMetrics {
  const activeLedger = payouts.filter((p) => p.status !== 'On Hold');
  const paidPayouts = payouts.filter((p) => p.status === 'Paid');
  const pendingPayouts = payouts.filter(
    (p) => p.status === 'Pending' || p.status === 'Scheduled'
  );

  const totalEmployeePaid = roundCurrency(
    activeLedger.reduce((sum, p) => sum + p.grossEmployeePay, 0)
  );
  const totalCommissionsEarned = roundCurrency(
    activeLedger.reduce((sum, p) => sum + p.baseCommissionAmount, 0)
  );
  const totalBonusesEarned = roundCurrency(
    activeLedger.reduce((sum, p) => sum + p.totalBonusAmount, 0)
  );
  const totalRecruiterEarnings = roundCurrency(
    totalCommissionsEarned + totalBonusesEarned
  );

  const pendingSettlementsAmount = roundCurrency(
    pendingPayouts.reduce((sum, p) => sum + p.totalRecruiterEarnings, 0)
  );

  const averageEffectiveRatePct =
    totalEmployeePaid > 0
      ? roundCurrency((totalRecruiterEarnings / totalEmployeePaid) * 100)
      : 0;

  // Monthly aggregation sorted ascending
  const monthMap = new Map<string, MonthlySeriesPoint>();
  for (const payout of activeLedger) {
    const monthKey = payout.payDate.slice(0, 7);
    const dateObj = new Date(`${monthKey}-01T00:00:00`);
    const label = Number.isNaN(dateObj.getTime())
      ? monthKey
      : new Intl.DateTimeFormat('en-US', { month: 'short' }).format(dateObj);

    const existing = monthMap.get(monthKey) ?? {
      monthKey,
      label,
      employeePaid: 0,
      commissionEarned: 0,
      bonusEarned: 0,
      totalCommissionPayout: 0,
    };

    existing.employeePaid = roundCurrency(existing.employeePaid + payout.grossEmployeePay);
    existing.commissionEarned = roundCurrency(
      existing.commissionEarned + payout.baseCommissionAmount
    );
    existing.bonusEarned = roundCurrency(existing.bonusEarned + payout.totalBonusAmount);
    existing.totalCommissionPayout = roundCurrency(
      existing.commissionEarned + existing.bonusEarned
    );
    monthMap.set(monthKey, existing);
  }

  const monthlySeries = Array.from(monthMap.values())
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .slice(-6);

  // Payment method breakdown across active payouts
  const methodTotals = new Map<
    PaymentMethodType,
    { payoutCount: number; employeeVolume: number; recruiterEarnings: number }
  >();
  for (const method of PAYMENT_METHOD_TYPES) {
    methodTotals.set(method, { payoutCount: 0, employeeVolume: 0, recruiterEarnings: 0 });
  }
  for (const payout of activeLedger) {
    const entry = methodTotals.get(payout.paymentMethod) ?? {
      payoutCount: 0,
      employeeVolume: 0,
      recruiterEarnings: 0,
    };
    entry.payoutCount += 1;
    entry.employeeVolume = roundCurrency(entry.employeeVolume + payout.grossEmployeePay);
    entry.recruiterEarnings = roundCurrency(
      entry.recruiterEarnings + payout.totalRecruiterEarnings
    );
    methodTotals.set(payout.paymentMethod, entry);
  }

  const paymentMethodBreakdown: PaymentMethodSummary[] = PAYMENT_METHOD_TYPES.map((method) => {
    const entry = methodTotals.get(method)!;
    const sharePct =
      totalEmployeePaid > 0
        ? roundCurrency((entry.employeeVolume / totalEmployeePaid) * 100)
        : 0;
    return {
      method,
      payoutCount: entry.payoutCount,
      employeeVolume: entry.employeeVolume,
      recruiterEarnings: entry.recruiterEarnings,
      sharePct,
    };
  }).sort((a, b) => b.employeeVolume - a.employeeVolume);

  // Per-recruit summary
  const recruitSummaries: RecruitEarningsSummary[] = recruits.map((recruit) => {
    const rows = activeLedger.filter((p) => p.recruitId === recruit.id);
    const totalPaid = roundCurrency(rows.reduce((s, r) => s + r.grossEmployeePay, 0));
    const totalComm = roundCurrency(rows.reduce((s, r) => s + r.baseCommissionAmount, 0));
    const totalBonus = roundCurrency(rows.reduce((s, r) => s + r.totalBonusAmount, 0));
    const sortedDates = rows.map((r) => r.payDate).sort((a, b) => b.localeCompare(a));

    return {
      recruit,
      payoutCount: rows.length,
      totalEmployeePaid: totalPaid,
      totalCommission: totalComm,
      totalBonuses: totalBonus,
      totalRecruiterEarnings: roundCurrency(totalComm + totalBonus),
      lastPayDate: sortedDates[0] ?? null,
    };
  });

  return {
    totalEmployeePaid,
    totalCommissionsEarned,
    totalBonusesEarned,
    totalRecruiterEarnings,
    pendingSettlementsAmount,
    pendingSettlementsCount: pendingPayouts.length,
    paidCount: paidPayouts.length,
    averageEffectiveRatePct,
    monthlySeries,
    paymentMethodBreakdown,
    recruitSummaries,
  };
}

export function filterPayouts(
  payouts: PayoutRecord[],
  recruitsMap: Map<string, Recruit>,
  filters: PayoutFilters
): PayoutRecord[] {
  const query = filters.search.trim().toLowerCase();

  const filtered = payouts.filter((payout) => {
    if (filters.status !== 'All' && payout.status !== filters.status) {
      return false;
    }
    if (
      filters.paymentMethod !== 'All' &&
      payout.paymentMethod !== filters.paymentMethod
    ) {
      return false;
    }
    if (query) {
      const recruit = recruitsMap.get(payout.recruitId);
      const haystack = [
        payout.id,
        payout.recruitId,
        payout.referenceCode,
        payout.status,
        recruit?.name ?? '',
        recruit?.role ?? '',
        recruit?.company ?? '',
        payout.payPeriodLabel,
        payout.paymentMethod,
        payout.paymentAccountDetail,
        payout.notes,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });

  return filtered.sort((a, b) => {
    switch (filters.sortBy) {
      case 'date-asc':
        return a.payDate.localeCompare(b.payDate);
      case 'amount-desc':
        return b.grossEmployeePay - a.grossEmployeePay;
      case 'earnings-desc':
        return b.totalRecruiterEarnings - a.totalRecruiterEarnings;
      case 'date-desc':
      default:
        return b.payDate.localeCompare(a.payDate);
    }
  });
}

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportPayoutsToCsv(
  payouts: PayoutRecord[],
  recruitsMap: Map<string, Recruit>
): string {
  const headers = [
    'Reference',
    'Pay Date',
    'Pay Period',
    'Employee Name',
    'Role',
    'Company',
    'Employee Gross Paid (ETB)',
    'Commission Base (ETB)',
    'Automatic Bonuses (ETB)',
    'Total Recruiter Earnings (ETB)',
    'Payment Method',
    'Account / Destination',
    'Status',
    'Notes',
  ];

  const rows = payouts.map((p) => {
    const recruit = recruitsMap.get(p.recruitId);
    return [
      p.referenceCode,
      p.payDate,
      p.payPeriodLabel,
      recruit?.name ?? 'Unknown Recruit',
      recruit?.role ?? '',
      recruit?.company ?? '',
      p.grossEmployeePay.toFixed(2),
      p.baseCommissionAmount.toFixed(2),
      p.totalBonusAmount.toFixed(2),
      p.totalRecruiterEarnings.toFixed(2),
      p.paymentMethod,
      p.paymentAccountDetail,
      p.status,
      p.notes,
    ].map(escapeCsvCell);
  });

  return [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.join(','))].join(
    '\n'
  );
}

export interface PerformanceTargetProgress {
  recruit: Recruit;
  target: PerformanceTarget;
  hasSavedTarget: boolean;
  monthKey: string;
  monthlyEmployeePaid: number;
  monthlyPayoutCount: number;
  monthlyCommissionEarned: number;
  progressPct: number;
  rawProgressPct: number;
  remainingAmount: number;
  goalReached: boolean;
  activeMultiplier: number;
  projectedMultiplierBoost: number;
}

export function computePerformanceTargetProgress(
  recruits: Recruit[],
  payouts: PayoutRecord[],
  targets: PerformanceTarget[],
  monthKey: string
): PerformanceTargetProgress[] {
  const targetMap = new Map(targets.map((t) => [t.recruitId, t]));

  return recruits.map((recruit) => {
    const saved = targetMap.get(recruit.id);
    const target: PerformanceTarget = saved ?? {
      id: recruit.id,
      recruitId: recruit.id,
      monthlyPayGoal: 5000,
      multiplierFactor: 1.25,
      active: false,
    };

    const monthPayouts = payouts.filter(
      (p) =>
        p.recruitId === recruit.id &&
        p.status !== 'On Hold' &&
        p.payDate.startsWith(monthKey)
    );

    const monthlyEmployeePaid = roundCurrency(
      monthPayouts.reduce((sum, p) => sum + p.grossEmployeePay, 0)
    );
    const monthlyCommissionEarned = roundCurrency(
      monthPayouts.reduce((sum, p) => sum + p.baseCommissionAmount, 0)
    );

    const rawProgressPct =
      target.monthlyPayGoal > 0
        ? roundCurrency((monthlyEmployeePaid / target.monthlyPayGoal) * 100)
        : 0;
    const progressPct = Math.min(100, Math.max(0, rawProgressPct));
    const remainingAmount =
      target.monthlyPayGoal > 0
        ? Math.max(0, roundCurrency(target.monthlyPayGoal - monthlyEmployeePaid))
        : 0;
    const goalReached =
      target.active &&
      target.monthlyPayGoal > 0 &&
      monthlyEmployeePaid >= target.monthlyPayGoal;
    const activeMultiplier = goalReached ? target.multiplierFactor : 1;
    const projectedMultiplierBoost =
      target.active && target.multiplierFactor > 1
        ? roundCurrency(monthlyCommissionEarned * (target.multiplierFactor - 1))
        : 0;

    return {
      recruit,
      target,
      hasSavedTarget: Boolean(saved),
      monthKey,
      monthlyEmployeePaid,
      monthlyPayoutCount: monthPayouts.length,
      monthlyCommissionEarned,
      progressPct,
      rawProgressPct,
      remainingAmount,
      goalReached,
      activeMultiplier,
      projectedMultiplierBoost,
    };
  });
}

export function buildSixMonthPayoutTrend(
  payouts: PayoutRecord[],
  anchorMonthKey?: string
): SixMonthTrendPoint[] {
  const activeLedger = payouts.filter((p) => p.status !== 'On Hold');

  const todayMonth = new Date().toISOString().slice(0, 7);
  let latestMonth = todayMonth;
  if (anchorMonthKey && /^\d{4}-\d{2}$/.test(anchorMonthKey)) {
    latestMonth = anchorMonthKey;
  } else {
    for (const p of activeLedger) {
      const m = p.payDate.slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(m) && m > latestMonth) {
        latestMonth = m;
      }
    }
  }

  const [endYearStr, endMonthStr] = latestMonth.split('-');
  const endYear = Number(endYearStr);
  const endMonthIdx = Number(endMonthStr) - 1; // 0-indexed

  const monthKeys: string[] = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const dt = new Date(Date.UTC(endYear, endMonthIdx - offset, 1));
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    monthKeys.push(`${y}-${m}`);
  }

  const buckets = new Map<string, SixMonthTrendPoint>();
  for (const key of monthKeys) {
    const [y, m] = key.split('-').map(Number);
    const label = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(y, m - 1, 1)));
    buckets.set(key, {
      monthKey: key,
      label,
      employeePaid: 0,
      commissionEarned: 0,
      bonusEarned: 0,
      totalCommissionPayout: 0,
      payoutCount: 0,
    });
  }

  for (const payout of activeLedger) {
    const key = payout.payDate.slice(0, 7);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.employeePaid = roundCurrency(
      bucket.employeePaid + payout.grossEmployeePay
    );
    bucket.commissionEarned = roundCurrency(
      bucket.commissionEarned + payout.baseCommissionAmount
    );
    bucket.bonusEarned = roundCurrency(
      bucket.bonusEarned + payout.totalBonusAmount
    );
    bucket.totalCommissionPayout = roundCurrency(
      bucket.commissionEarned + bucket.bonusEarned
    );
    bucket.payoutCount += 1;
  }

  return monthKeys.map((key) => buckets.get(key)!);
}

export interface YearlyPerformanceSummary {
  year: string;
  payoutCount: number;
  paidPayoutCount: number;
  totalEmployeePaid: number;
  baseCommissionEarned: number;
  bonusesEarned: number;
  totalCommissionEarned: number;
  recruitsCount: number;
  recruitsStartedCount: number;
  recruitsPaidCount: number;
  effectiveRatePct: number;
}

export function getAvailablePerformanceYears(
  payouts: PayoutRecord[],
  recruits: Recruit[],
  currentYear = String(new Date().getFullYear())
): string[] {
  const years = new Set<string>([currentYear]);
  for (const p of payouts) {
    const y = p.payDate.slice(0, 4);
    if (/^\d{4}$/.test(y)) years.add(y);
  }
  for (const r of recruits) {
    const y = r.startDate.slice(0, 4);
    if (/^\d{4}$/.test(y)) years.add(y);
  }
  return Array.from(years).sort((a, b) => b.localeCompare(a));
}

export function computeYearlyPerformanceSummary(
  payouts: PayoutRecord[],
  recruits: Recruit[],
  year: string
): YearlyPerformanceSummary {
  const yearPrefix = `${year}-`;
  const yearPayouts = payouts.filter(
    (p) => p.status !== 'On Hold' && p.payDate.startsWith(yearPrefix)
  );
  const paidPayoutCount = yearPayouts.filter((p) => p.status === 'Paid').length;

  const totalEmployeePaid = roundCurrency(
    yearPayouts.reduce((sum, p) => sum + p.grossEmployeePay, 0)
  );
  const baseCommissionEarned = roundCurrency(
    yearPayouts.reduce((sum, p) => sum + p.baseCommissionAmount, 0)
  );
  const bonusesEarned = roundCurrency(
    yearPayouts.reduce((sum, p) => sum + p.totalBonusAmount, 0)
  );
  const totalCommissionEarned = roundCurrency(
    baseCommissionEarned + bonusesEarned
  );

  const startedIds = new Set(
    recruits
      .filter((r) => r.startDate.startsWith(yearPrefix))
      .map((r) => r.id)
  );
  const paidIds = new Set(yearPayouts.map((p) => p.recruitId));
  const combinedIds = new Set([...startedIds, ...paidIds]);

  const effectiveRatePct =
    totalEmployeePaid > 0
      ? roundCurrency((totalCommissionEarned / totalEmployeePaid) * 100)
      : 0;

  return {
    year,
    payoutCount: yearPayouts.length,
    paidPayoutCount,
    totalEmployeePaid,
    baseCommissionEarned,
    bonusesEarned,
    totalCommissionEarned,
    recruitsCount: combinedIds.size,
    recruitsStartedCount: startedIds.size,
    recruitsPaidCount: paidIds.size,
    effectiveRatePct,
  };
}


