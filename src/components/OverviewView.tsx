import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Calendar, Check, Search } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  DashboardTab,
  PayoutRecord,
  PayoutStatus,
  Recruit,
} from '../types/payroll';
import {
  type DashboardMetrics,
  type SixMonthTrendPoint,
  buildSixMonthPayoutTrend,
  computeYearlyPerformanceSummary,
  filterPayouts,
  formatCurrency,
  formatDateShort,
  getAvailablePerformanceYears,
} from '../utils/commissionEngine';
import { StatusLabel } from './StatusLabel';

interface CommissionTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: SixMonthTrendPoint }>;
}

function CommissionTooltip({ active, payload }: CommissionTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 shadow-sm text-xs space-y-1">
      <div className="flex items-center justify-between gap-4">
        <p className="font-display font-semibold text-slate-900">
          {point.label} ({point.monthKey})
        </p>
        <span className="font-mono text-[11px] text-slate-500 tabular-nums">
          {point.payoutCount} payout{point.payoutCount === 1 ? '' : 's'}
        </span>
      </div>
      <div className="flex items-center justify-between gap-5 text-slate-600">
        <span>Employee Gross Paid</span>
        <span className="font-mono text-slate-900 tabular-nums">
          {formatCurrency(point.employeePaid)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-5 text-slate-600">
        <span>Base Commission</span>
        <span className="font-mono text-slate-900 tabular-nums">
          {formatCurrency(point.commissionEarned)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-5 text-emerald-700">
        <span>Auto Bonuses</span>
        <span className="font-mono tabular-nums">
          +{formatCurrency(point.bonusEarned)}
        </span>
      </div>
      <div className="pt-1 border-t border-slate-100 flex items-center justify-between gap-5 font-semibold text-blue-700">
        <span>Total Commission Payout</span>
        <span className="font-mono tabular-nums">
          {formatCurrency(point.totalCommissionPayout)}
        </span>
      </div>
    </div>
  );
}

interface OverviewViewProps {
  metrics: DashboardMetrics;
  payouts: PayoutRecord[];
  recruitsMap: Map<string, Recruit>;
  onMarkPaid: (payoutId: string) => void;
  onInspectPayout: (payout: PayoutRecord) => void;
  onNavigateTab: (tab: DashboardTab) => void;
  onOpenRecordPayout: () => void;
}

const STATUS_TABS: Array<PayoutStatus | 'All'> = [
  'All',
  'Paid',
  'Scheduled',
  'Pending',
];

export function OverviewView({
  metrics,
  payouts,
  recruitsMap,
  onMarkPaid,
  onInspectPayout,
  onNavigateTab,
  onOpenRecordPayout,
}: OverviewViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PayoutStatus | 'All'>('All');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [trendMode, setTrendMode] = useState<'commission' | 'volume'>(
    'commission'
  );

  const recruitsList = useMemo(
    () => Array.from(recruitsMap.values()),
    [recruitsMap]
  );

  const availableYears = useMemo(
    () => getAvailablePerformanceYears(payouts, recruitsList),
    [payouts, recruitsList]
  );
  const [selectedYear, setSelectedYear] = useState<string>(
    () => availableYears[0] ?? String(new Date().getFullYear())
  );

  useEffect(() => {
    if (!availableYears.includes(selectedYear) && availableYears.length > 0) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  const yearlySummary = useMemo(
    () => computeYearlyPerformanceSummary(payouts, recruitsList, selectedYear),
    [payouts, recruitsList, selectedYear]
  );

  const filteredRecent = useMemo(() => {
    return filterPayouts(payouts, recruitsMap, {
      search,
      status: statusFilter,
      paymentMethod: 'All',
      sortBy: 'date-desc',
    }).slice(0, 7);
  }, [payouts, recruitsMap, search, statusFilter]);

  const activeMonth = useMemo(() => {
    if (metrics.monthlySeries.length === 0) return null;
    if (selectedMonthKey) {
      const found = metrics.monthlySeries.find((m) => m.monthKey === selectedMonthKey);
      if (found) return found;
    }
    return metrics.monthlySeries[metrics.monthlySeries.length - 1];
  }, [metrics.monthlySeries, selectedMonthKey]);

  const maxMonthlyEmployeePay = useMemo(() => {
    const maxVal = Math.max(...metrics.monthlySeries.map((m) => m.employeePaid), 1);
    return maxVal;
  }, [metrics.monthlySeries]);

  const sixMonthTrend = useMemo(
    () => buildSixMonthPayoutTrend(payouts),
    [payouts]
  );

  const hasSixMonthActivity = useMemo(
    () => sixMonthTrend.some((p) => p.payoutCount > 0),
    [sixMonthTrend]
  );

  const sixMonthCommissionSummary = useMemo(() => {
    const total = sixMonthTrend.reduce(
      (sum, point) => sum + point.totalCommissionPayout,
      0
    );
    const avg = sixMonthTrend.length > 0 ? total / sixMonthTrend.length : 0;
    let peak = sixMonthTrend[0] ?? null;
    for (const point of sixMonthTrend) {
      if (!peak || point.totalCommissionPayout > peak.totalCommissionPayout) {
        peak = point;
      }
    }
    return { total, avg, peak };
  }, [sixMonthTrend]);

  return (
    <div className="space-y-6">
      {/* 4-column KPI strip */}
      <section aria-label="Key financial metrics" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Total Paid to Recruits</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {formatCurrency(metrics.totalEmployeePaid)}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
            Across {metrics.paidCount} settled payouts
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Commissions Earned</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {formatCurrency(metrics.totalCommissionsEarned)}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
            {metrics.averageEffectiveRatePct.toFixed(1)}% effective total rate
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Automatic Bonuses</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
            {formatCurrency(metrics.totalBonusesEarned)}
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            High-pay, tier & retention triggers
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Pending Settlements</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-amber-700 tabular-nums">
            {formatCurrency(metrics.pendingSettlementsAmount)}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
            {metrics.pendingSettlementsCount} awaiting payout release
          </p>
        </div>
      </section>

      {/* Yearly Performance Summary Card */}
      <section
        aria-label="Yearly performance summary"
        className="bg-white border border-slate-200 rounded-xl p-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-slate-100 text-blue-700 shrink-0 mt-0.5">
              <Calendar className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Yearly Performance Summary
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Aggregated employee payouts, recruited headcount, and commissions earned for calendar year {yearlySummary.year}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label
              htmlFor="overview-year-select"
              className="text-xs font-medium text-slate-500"
            >
              Calendar Year
            </label>
            <select
              id="overview-year-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-1.5 text-xs font-mono font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">
              Total Payouts ({yearlySummary.year})
            </p>
            <p className="font-mono text-xl font-semibold text-slate-900 tabular-nums">
              {formatCurrency(yearlySummary.totalEmployeePaid)}
            </p>
            <p className="text-xs text-slate-500 tabular-nums">
              {yearlySummary.payoutCount} payout{yearlySummary.payoutCount === 1 ? '' : 's'}{' '}
              <span aria-hidden="true">·</span>{' '}
              {yearlySummary.paidPayoutCount} settled
            </p>
          </div>

          <div className="space-y-1 md:border-l md:border-slate-100 md:pl-5">
            <p className="text-xs font-medium text-slate-500">
              Number of Recruits ({yearlySummary.year})
            </p>
            <p className="font-mono text-xl font-semibold text-slate-900 tabular-nums">
              {yearlySummary.recruitsCount}
            </p>
            <p className="text-xs text-slate-500 tabular-nums">
              {yearlySummary.recruitsStartedCount} started in {yearlySummary.year}{' '}
              <span aria-hidden="true">·</span>{' '}
              {yearlySummary.recruitsPaidCount} paid
            </p>
          </div>

          <div className="space-y-1 md:border-l md:border-slate-100 md:pl-5">
            <p className="text-xs font-medium text-slate-500">
              Commission Earned ({yearlySummary.year})
            </p>
            <p className="font-mono text-xl font-semibold text-blue-700 tabular-nums">
              {formatCurrency(yearlySummary.totalCommissionEarned)}
            </p>
            <p className="text-xs text-slate-500 tabular-nums">
              {formatCurrency(yearlySummary.baseCommissionEarned)} base{' '}
              <span aria-hidden="true">·</span>{' '}
              <span className="text-emerald-700 font-medium">
                +{formatCurrency(yearlySummary.bonusesEarned)}
              </span>{' '}
              bonuses ({yearlySummary.effectiveRatePct.toFixed(1)}%)
            </p>
          </div>
        </div>
      </section>

      {/* Analytics Row: Monthly Earnings Chart + Payment Method Split */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Monthly Payout & Commission Bar Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Monthly Pay & Commission Earnings
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Select a month bar to inspect employee pay versus your commission and bonuses
              </p>
            </div>
            {activeMonth && (
              <div className="flex items-center gap-3 text-xs tabular-nums whitespace-nowrap shrink-0">
                <div>
                  <span className="text-slate-500">{activeMonth.label} Pay: </span>
                  <span className="font-mono font-medium text-slate-900">
                    {formatCurrency(activeMonth.employeePaid)}
                  </span>
                </div>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <div>
                  <span className="text-slate-500">Earned: </span>
                  <span className="font-mono font-semibold text-blue-700">
                    {formatCurrency(activeMonth.commissionEarned + activeMonth.bonusEarned)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {metrics.monthlySeries.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No monthly payout activity recorded yet.
            </div>
          ) : (
            <div className="pt-4">
              <div className="relative">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 bottom-7 flex flex-col justify-between"
                >
                  <div className="border-t border-dashed border-slate-100 w-full" />
                  <div className="border-t border-dashed border-slate-100 w-full" />
                  <div className="border-t border-dashed border-slate-100 w-full" />
                  <div className="border-t border-slate-200 w-full" />
                </div>
                <div
                  className="relative grid gap-3 items-end h-48"
                  style={{
                    gridTemplateColumns: `repeat(${metrics.monthlySeries.length}, minmax(0, 1fr))`,
                  }}
                >
                  {metrics.monthlySeries.map((point) => {
                    const isSelected = activeMonth?.monthKey === point.monthKey;
                    const totalEarnings = point.commissionEarned + point.bonusEarned;
                    const employeeHeightPct = Math.max(
                      10,
                      Math.round((point.employeePaid / maxMonthlyEmployeePay) * 100)
                    );
                    const earnedHeightPct = Math.max(
                      6,
                      Math.round((totalEarnings / maxMonthlyEmployeePay) * 100)
                    );

                    return (
                      <button
                        key={point.monthKey}
                        type="button"
                        onClick={() => setSelectedMonthKey(point.monthKey)}
                        aria-label={`${point.label}: Employee pay ${formatCurrency(point.employeePaid)}, Recruiter earnings ${formatCurrency(totalEarnings)}`}
                        className={`group flex flex-col items-center h-full justify-end rounded-lg px-2 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                          isSelected ? 'bg-slate-50/90' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <div className="w-full flex items-end justify-center gap-1.5 h-40">
                          <div
                            className={`w-5 sm:w-7 rounded-t transition-all ${
                              isSelected
                                ? 'bg-slate-800'
                                : 'bg-slate-300 group-hover:bg-slate-400'
                            }`}
                            style={{ height: `${employeeHeightPct}%` }}
                            title={`Employee Pay: ${formatCurrency(point.employeePaid)}`}
                          />
                          <div
                            className={`w-5 sm:w-7 rounded-t transition-all ${
                              isSelected
                                ? 'bg-blue-700'
                                : 'bg-blue-500/80 group-hover:bg-blue-600'
                            }`}
                            style={{ height: `${earnedHeightPct}%` }}
                            title={`Commission + Bonus: ${formatCurrency(totalEarnings)}`}
                          />
                        </div>
                        <span
                          className={`mt-2 text-xs font-medium ${
                            isSelected ? 'text-slate-900' : 'text-slate-500'
                          }`}
                        >
                          {point.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
                <div className="flex items-center gap-5">
                  <span className="inline-flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-xs bg-slate-700 inline-block" aria-hidden="true" />
                    Employee Gross Paid
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-xs bg-blue-700 inline-block" aria-hidden="true" />
                    Commission & Bonuses
                  </span>
                </div>
                {activeMonth && (
                  <span className="tabular-nums text-slate-600">
                    {activeMonth.label} breakdown: {formatCurrency(activeMonth.commissionEarned)} base{' '}
                    <span aria-hidden="true">·</span>{' '}
                    {formatCurrency(activeMonth.bonusEarned)} bonus
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Payment Method Mix */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Payment Methods
              </h2>
              <button
                type="button"
                onClick={() => onNavigateTab('payment-methods')}
                className="text-xs font-medium text-blue-700 hover:text-blue-800 inline-flex items-center gap-1 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-600 rounded"
              >
                <span>Manage</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {metrics.paymentMethodBreakdown.map((item) => (
                <div key={item.method} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800">{item.method}</span>
                    <span className="font-mono text-slate-700 tabular-nums">
                      {formatCurrency(item.employeeVolume)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-700 rounded-full"
                      style={{ width: `${Math.min(100, item.sharePct)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                    <span>
                      {item.payoutCount} payout{item.payoutCount === 1 ? '' : 's'}
                    </span>
                    <span>{item.sharePct.toFixed(1)}% of volume</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Total Recruiter Earnings</span>
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              {formatCurrency(metrics.totalRecruiterEarnings)}
            </span>
          </div>
        </div>
      </section>

      {/* Recharts 6-Month Payout Trends Line Chart */}
      <section
        aria-label="6-month payout trends and seasonal recruitment patterns"
        className="bg-white border border-slate-200 rounded-xl p-5"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              6-Month Payout Trends & Seasonal Patterns
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Continuous 6-month payout trajectory to spot seasonal recruitment peaks and commission cycles
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {hasSixMonthActivity && (
              <div className="flex flex-wrap items-center gap-3 text-xs tabular-nums whitespace-nowrap">
                <div>
                  <span className="text-slate-500">6-Mo Total: </span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatCurrency(sixMonthCommissionSummary.total)}
                  </span>
                </div>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <div>
                  <span className="text-slate-500">Monthly Avg: </span>
                  <span className="font-mono font-semibold text-blue-700">
                    {formatCurrency(sixMonthCommissionSummary.avg)}
                  </span>
                </div>
                {sixMonthCommissionSummary.peak &&
                  sixMonthCommissionSummary.peak.totalCommissionPayout > 0 && (
                    <>
                      <span className="text-slate-300" aria-hidden="true">·</span>
                      <div>
                        <span className="text-slate-500">Peak: </span>
                        <span className="font-mono font-semibold text-emerald-700">
                          {sixMonthCommissionSummary.peak.label} (
                          {formatCurrency(
                            sixMonthCommissionSummary.peak.totalCommissionPayout
                          )}
                          )
                        </span>
                      </div>
                    </>
                  )}
              </div>
            )}

            <div
              role="group"
              aria-label="Trend series view"
              className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
            >
              <button
                type="button"
                onClick={() => setTrendMode('commission')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-600 ${
                  trendMode === 'commission'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Commissions & Bonuses
              </button>
              <button
                type="button"
                onClick={() => setTrendMode('volume')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-600 ${
                  trendMode === 'volume'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Employee Pay vs. Payouts
              </button>
            </div>
          </div>
        </div>

        {!hasSixMonthActivity ? (
          <div className="py-12 text-center">
            <p className="text-sm text-slate-500">
              Record payouts to visualize your 6-month payout trend and seasonal recruitment patterns.
            </p>
          </div>
        ) : (
          <div
            data-testid="monthly-commission-line-chart"
            className="pt-5 h-72 w-full min-w-0"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={sixMonthTrend}
                margin={{ top: 10, right: 16, left: 4, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#E2E8F0"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#64748B', fontSize: 12 }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                  dy={6}
                />
                <YAxis
                  tickFormatter={(value: number) =>
                    value >= 1000
                      ? `Br ${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`
                      : `Br ${value}`
                  }
                  tick={{ fill: '#64748B', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={68}
                />
                <Tooltip
                  content={<CommissionTooltip />}
                  cursor={{
                    stroke: '#CBD5E1',
                    strokeWidth: 1,
                    strokeDasharray: '3 3',
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={32}
                  iconType="circle"
                  wrapperStyle={{ fontSize: '12px', color: '#475569' }}
                />
                {trendMode === 'commission' ? (
                  <>
                    <Line
                      type="monotone"
                      dataKey="totalCommissionPayout"
                      name="Total Commission Payout"
                      stroke="#1D4ED8"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#FFFFFF', stroke: '#1D4ED8', strokeWidth: 2 }}
                      activeDot={{
                        r: 6,
                        fill: '#1D4ED8',
                        stroke: '#FFFFFF',
                        strokeWidth: 2,
                      }}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="commissionEarned"
                      name="Base Commission"
                      stroke="#64748B"
                      strokeWidth={1.75}
                      strokeDasharray="4 4"
                      dot={{ r: 3, fill: '#FFFFFF', stroke: '#64748B', strokeWidth: 1.5 }}
                      activeDot={{ r: 5, fill: '#64748B' }}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="bonusEarned"
                      name="Auto Bonuses"
                      stroke="#047857"
                      strokeWidth={2}
                      dot={{ r: 3.5, fill: '#FFFFFF', stroke: '#047857', strokeWidth: 1.75 }}
                      activeDot={{ r: 5.5, fill: '#047857' }}
                      isAnimationActive={false}
                    />
                  </>
                ) : (
                  <>
                    <Line
                      type="monotone"
                      dataKey="employeePaid"
                      name="Employee Gross Paid"
                      stroke="#0F172A"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#FFFFFF', stroke: '#0F172A', strokeWidth: 2 }}
                      activeDot={{
                        r: 6,
                        fill: '#0F172A',
                        stroke: '#FFFFFF',
                        strokeWidth: 2,
                      }}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="totalCommissionPayout"
                      name="Total Commission Payout"
                      stroke="#1D4ED8"
                      strokeWidth={2.25}
                      dot={{ r: 4, fill: '#FFFFFF', stroke: '#1D4ED8', strokeWidth: 2 }}
                      activeDot={{
                        r: 6,
                        fill: '#1D4ED8',
                        stroke: '#FFFFFF',
                        strokeWidth: 2,
                      }}
                      isAnimationActive={false}
                    />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Recent Payouts Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Recent Payouts & Auto-Calculated Earnings
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any entry to inspect commission math or update settlement status
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search recruit or ref..."
                aria-label="Search recent payouts"
                className="pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 w-52"
              />
            </div>

            <div
              role="group"
              aria-label="Filter recent payouts by status"
              className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
            >
              {STATUS_TABS.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-600 ${
                    statusFilter === status
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredRecent.length === 0 ? (
          <div className="py-12 px-6 text-center">
            <p className="text-sm font-medium text-slate-900">No matching payouts found</p>
            <p className="text-xs text-slate-500 mt-1">
              {payouts.length === 0
                ? 'Record your first recruited employee payout to calculate commissions automatically.'
                : 'Try adjusting your search term or status filter.'}
            </p>
            <div className="mt-4">
              {payouts.length === 0 ? (
                <button
                  type="button"
                  onClick={onOpenRecordPayout}
                  className="px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
                >
                  Record First Payout
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('All');
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500 whitespace-nowrap">
                  <th className="py-3 pl-5 pr-2.5">Recruit</th>
                  <th className="py-3 px-2.5">Pay Date</th>
                  <th className="py-3 px-2.5 text-right">Employee Paid</th>
                  <th className="py-3 px-2.5 text-right">Commission</th>
                  <th className="py-3 px-2.5 text-right">Auto Bonus</th>
                  <th className="py-3 px-2.5 text-right">Your Total</th>
                  <th className="py-3 px-2.5">Method</th>
                  <th className="py-3 px-2.5">Status</th>
                  <th className="py-3 pl-2.5 pr-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredRecent.map((payout) => {
                  const recruit = recruitsMap.get(payout.recruitId);
                  return (
                    <tr
                      key={payout.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3 pl-5 pr-2.5 max-w-[195px]">
                        <button
                          type="button"
                          onClick={() => onInspectPayout(payout)}
                          className="text-left group w-full focus-visible:outline-2 focus-visible:outline-blue-600 rounded"
                        >
                          <div className="font-medium text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                            {recruit?.name ?? 'Unknown Recruit'}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {recruit?.role ?? '—'} · <span className="font-mono">{payout.referenceCode}</span>
                          </div>
                        </button>
                      </td>
                      <td className="py-3 px-2.5 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {formatDateShort(payout.payDate)}
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono text-xs text-slate-800 tabular-nums whitespace-nowrap">
                        {formatCurrency(payout.grossEmployeePay)}
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                        {formatCurrency(payout.baseCommissionAmount)}
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                        {payout.totalBonusAmount > 0 ? (
                          <span className="text-emerald-700 font-medium">
                            +{formatCurrency(payout.totalBonusAmount)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatCurrency(payout.totalRecruiterEarnings)}
                      </td>
                      <td className="py-3 px-2.5 max-w-[155px]">
                        <div className="text-xs font-medium text-slate-800 whitespace-nowrap">
                          {payout.paymentMethod}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {payout.paymentAccountDetail}
                        </div>
                      </td>
                      <td className="py-3 px-2.5">
                        <StatusLabel status={payout.status} />
                      </td>
                      <td className="py-3 pl-2.5 pr-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {(payout.status === 'Pending' || payout.status === 'Scheduled') && (
                            <button
                              type="button"
                              onClick={() => onMarkPaid(payout.id)}
                              aria-label={`Mark ${payout.referenceCode} as Paid`}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-emerald-700"
                            >
                              <Check className="w-3 h-3" aria-hidden="true" />
                              <span>Mark Paid</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onInspectPayout(payout)}
                            aria-label={`Inspect ${payout.referenceCode} details`}
                            className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-blue-600"
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {payouts.length > 7 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
            <span className="tabular-nums">
              Showing {filteredRecent.length} of {payouts.length} total payouts
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab('ledger')}
              className="font-medium text-blue-700 hover:text-blue-800 inline-flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-blue-600 rounded"
            >
              <span>Open Full Ledger</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
