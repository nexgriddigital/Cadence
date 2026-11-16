import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Target } from 'lucide-react';
import type {
  CommissionRuleSet,
  PayoutRecord,
  PerformanceTarget,
  Recruit,
} from '../types/payroll';
import type { PerformanceTargetInput } from '../hooks/usePayrollStore';
import {
  calculatePayoutBreakdown,
  computePerformanceTargetProgress,
  formatCurrency,
} from '../utils/commissionEngine';

interface RulesViewProps {
  rules: CommissionRuleSet;
  recruits: Recruit[];
  payouts: PayoutRecord[];
  performanceTargets: PerformanceTarget[];
  onSaveRules: (rules: CommissionRuleSet) => void;
  onSavePerformanceTarget: (input: PerformanceTargetInput) => void;
}

interface TargetDraft {
  monthlyPayGoal: string;
  multiplierFactor: string;
  active: boolean;
}

function formatMonthLabel(monthKey: string): string {
  const parsed = new Date(`${monthKey}-01T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return monthKey;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

export function RulesView({
  rules,
  recruits,
  payouts,
  performanceTargets,
  onSaveRules,
  onSavePerformanceTarget,
}: RulesViewProps) {
  const [form, setForm] = useState<CommissionRuleSet>(rules);
  const [savedBanner, setSavedBanner] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setForm(rules);
  }, [rules]);

  // Simulator state
  const [simGrossPay, setSimGrossPay] = useState('5000');
  const [simPriorCumulative, setSimPriorCumulative] = useState('18000');
  const [simRetention, setSimRetention] = useState(false);

  const simResult = useMemo(() => {
    const gross = Number(simGrossPay) || 0;
    const prior = Number(simPriorCumulative) || 0;
    return calculatePayoutBreakdown({
      grossEmployeePay: gross,
      recruit: { commissionModel: 'percentage', customCommissionValue: null },
      rules: form,
      priorCumulativeEmployeePay: prior,
      isRetentionMilestone: simRetention,
    });
  }, [simGrossPay, simPriorCumulative, simRetention, form]);

  // Performance Targets state
  const currentMonthKey = useMemo(
    () => new Date().toISOString().slice(0, 7),
    []
  );
  const availableMonths = useMemo(() => {
    const set = new Set<string>([currentMonthKey]);
    for (const p of payouts) {
      const m = p.payDate.slice(0, 7);
      if (m) set.add(m);
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [payouts, currentMonthKey]);

  const [selectedMonth, setSelectedMonth] = useState<string>(
    availableMonths[0] ?? currentMonthKey
  );

  useEffect(() => {
    if (!availableMonths.includes(selectedMonth) && availableMonths.length > 0) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  const targetProgressRows = useMemo(
    () =>
      computePerformanceTargetProgress(
        recruits,
        payouts,
        performanceTargets,
        selectedMonth
      ),
    [recruits, payouts, performanceTargets, selectedMonth]
  );

  const [drafts, setDrafts] = useState<Record<string, TargetDraft>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [savedTargetId, setSavedTargetId] = useState<string | null>(null);

  useEffect(() => {
    const targetMap = new Map(performanceTargets.map((t) => [t.recruitId, t]));
    const next: Record<string, TargetDraft> = {};
    for (const recruit of recruits) {
      const saved = targetMap.get(recruit.id);
      next[recruit.id] = {
        monthlyPayGoal: String(saved?.monthlyPayGoal ?? 5000),
        multiplierFactor: String(saved?.multiplierFactor ?? 1.25),
        active: saved?.active ?? false,
      };
    }
    setDrafts(next);
  }, [recruits, performanceTargets]);

  const unlockedCount = useMemo(
    () => targetProgressRows.filter((r) => r.goalReached).length,
    [targetProgressRows]
  );
  const enabledCount = useMemo(
    () => targetProgressRows.filter((r) => r.target.active).length,
    [targetProgressRows]
  );

  const handleTargetSave = (recruitId: string) => {
    const draft = drafts[recruitId];
    if (!draft) return;

    const goal = Number(draft.monthlyPayGoal);
    const mult = Number(draft.multiplierFactor);

    if (!Number.isFinite(goal) || goal < 0 || goal > 10000000) {
      setRowErrors((prev) => ({
        ...prev,
        [recruitId]: 'Monthly goal must be between Br 0 and Br 10,000,000.',
      }));
      return;
    }
    if (!Number.isFinite(mult) || mult < 1 || mult > 5) {
      setRowErrors((prev) => ({
        ...prev,
        [recruitId]: 'Multiplier must be between 1.0x and 5.0x.',
      }));
      return;
    }

    setRowErrors((prev) => {
      const copy = { ...prev };
      delete copy[recruitId];
      return copy;
    });

    onSavePerformanceTarget({
      recruitId,
      monthlyPayGoal: goal,
      multiplierFactor: mult,
      active: draft.active,
    });
    setSavedTargetId(recruitId);
    window.setTimeout(() => {
      setSavedTargetId((current) => (current === recruitId ? null : current));
    }, 2500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !Number.isFinite(form.defaultCommissionRatePct) ||
      form.defaultCommissionRatePct < 0 ||
      form.defaultCommissionRatePct > 100 ||
      !Number.isFinite(form.tierAcceleratorRatePct) ||
      form.tierAcceleratorRatePct < 0 ||
      form.tierAcceleratorRatePct > 100
    ) {
      setErrorMsg('Percentage rates must be between 0% and 100%.');
      return;
    }
    if (
      !Number.isFinite(form.highPayBonusThreshold) ||
      form.highPayBonusThreshold < 0 ||
      form.highPayBonusThreshold > 10000000 ||
      !Number.isFinite(form.highPayBonusAmount) ||
      form.highPayBonusAmount < 0 ||
      form.highPayBonusAmount > 1000000 ||
      !Number.isFinite(form.tierAcceleratorThreshold) ||
      form.tierAcceleratorThreshold < 0 ||
      form.tierAcceleratorThreshold > 100000000 ||
      !Number.isFinite(form.retentionMilestoneBonusAmount) ||
      form.retentionMilestoneBonusAmount < 0 ||
      form.retentionMilestoneBonusAmount > 1000000
    ) {
      setErrorMsg('Amount thresholds and bonus values are out of allowed bounds.');
      return;
    }

    setErrorMsg('');
    onSaveRules(form);
    setSavedBanner(true);
    window.setTimeout(() => setSavedBanner(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Rules Configuration Form */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 space-y-6"
        >
          <div className="border-b border-slate-100 pb-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Automatic Commission & Bonus Triggers
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              New payouts recorded in the ledger automatically apply these base rates and bonus rules unless a recruit has a custom override.
            </p>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg"
            >
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label
                htmlFor="rule-default-rate"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Default Commission Rate (%)
              </label>
              <input
                id="rule-default-rate"
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={form.defaultCommissionRatePct}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    defaultCommissionRatePct: Number(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Applied when a recruit has no custom rate.
              </p>
            </div>

            <div>
              <label
                htmlFor="rule-retention-bonus"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                90-Day Retention Milestone Bonus (Br)
              </label>
              <input
                id="rule-retention-bonus"
                type="number"
                step="25"
                min="0"
                value={form.retentionMilestoneBonusAmount}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    retentionMilestoneBonusAmount: Number(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Awarded when marking a payout as a 90-day milestone.
              </p>
            </div>

            <div>
              <label
                htmlFor="rule-high-pay-threshold"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                High-Pay Single Payout Threshold (Br)
              </label>
              <input
                id="rule-high-pay-threshold"
                type="number"
                step="100"
                min="0"
                value={form.highPayBonusThreshold}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    highPayBonusThreshold: Number(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Triggers bonus when single payout meets or exceeds this amount.
              </p>
            </div>

            <div>
              <label
                htmlFor="rule-high-pay-bonus"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                High-Pay Bonus Amount (Br)
              </label>
              <input
                id="rule-high-pay-bonus"
                type="number"
                step="25"
                min="0"
                value={form.highPayBonusAmount}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    highPayBonusAmount: Number(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="rule-tier-threshold"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Cumulative Tier Accelerator Threshold (Br)
              </label>
              <input
                id="rule-tier-threshold"
                type="number"
                step="500"
                min="0"
                value={form.tierAcceleratorThreshold}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    tierAcceleratorThreshold: Number(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Triggers once cumulative employee pay crosses this mark.
              </p>
            </div>

            <div>
              <label
                htmlFor="rule-tier-rate"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Tier Accelerator Extra Rate (%)
              </label>
              <input
                id="rule-tier-rate"
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={form.tierAcceleratorRatePct}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    tierAcceleratorRatePct: Number(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
            <div className="text-xs">
              {savedBanner && (
                <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  <span>Commission rules updated</span>
                </span>
              )}
            </div>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-blue-700"
            >
              Save Rules
            </button>
          </div>
        </form>

        {/* Live Payout Simulator */}
        <aside className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Live Rule Simulator
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Preview automatic commissions and bonuses against your rules
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="sim-gross-pay"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Employee Gross Pay (Br)
              </label>
              <input
                id="sim-gross-pay"
                type="number"
                min="0"
                step="100"
                value={simGrossPay}
                onChange={(e) => setSimGrossPay(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="sim-prior-pay"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Prior Cumulative Paid to Employee (Br)
              </label>
              <input
                id="sim-prior-pay"
                type="number"
                min="0"
                step="500"
                value={simPriorCumulative}
                onChange={(e) => setSimPriorCumulative(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={simRetention}
                onChange={(e) => setSimRetention(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
              />
              <span>Include 90-Day Retention Milestone</span>
            </label>
          </div>

          <div className="pt-4 border-t border-slate-200 space-y-2.5 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span>Base Commission ({simResult.commissionRateOrFlat}%)</span>
              <span className="font-mono font-medium text-slate-900 tabular-nums">
                {formatCurrency(simResult.baseCommissionAmount)}
              </span>
            </div>

            {simResult.bonuses.length === 0 ? (
              <div className="flex items-center justify-between text-slate-400">
                <span>Automatic Bonuses</span>
                <span className="font-mono tabular-nums">Br 0.00</span>
              </div>
            ) : (
              simResult.bonuses.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-2 text-emerald-700"
                >
                  <span className="truncate">{b.label}</span>
                  <span className="font-mono font-medium tabular-nums shrink-0">
                    +{formatCurrency(b.amount)}
                  </span>
                </div>
              ))
            )}

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-sm font-semibold text-slate-900">
              <span>Total Recruiter Payout</span>
              <span className="font-mono text-blue-700 tabular-nums">
                {formatCurrency(simResult.totalRecruiterEarnings)}
              </span>
            </div>
          </div>
        </aside>
      </div>

      {/* Performance Targets Section */}
      <section
        aria-labelledby="performance-targets-heading"
        className="bg-white border border-slate-200 rounded-xl overflow-hidden"
      >
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-slate-100 text-blue-700 shrink-0 mt-0.5">
              <Target className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="performance-targets-heading"
                className="font-display text-base font-semibold text-slate-900"
              >
                Performance Targets
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Set monthly pay volume goals per recruited employee and track progress toward automatic commission multipliers
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
              {unlockedCount} / {enabledCount} unlocked in{' '}
              {formatMonthLabel(selectedMonth)}
            </span>
            <label htmlFor="target-month-select" className="sr-only">
              Select target tracking month
            </label>
            <select
              id="target-month-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            >
              {availableMonths.map((monthKey) => (
                <option key={monthKey} value={monthKey}>
                  {formatMonthLabel(monthKey)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {targetProgressRows.length === 0 ? (
          <div className="py-12 px-6 text-center text-sm text-slate-500">
            Add recruited employees to configure monthly performance targets and commission multipliers.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {targetProgressRows.map((row) => {
              const draft = drafts[row.recruit.id] ?? {
                monthlyPayGoal: String(row.target.monthlyPayGoal),
                multiplierFactor: String(row.target.multiplierFactor),
                active: row.target.active,
              };
              const rowErr = rowErrors[row.recruit.id];
              const isJustSaved = savedTargetId === row.recruit.id;

              const barColor = !row.target.active
                ? 'bg-slate-300'
                : row.goalReached
                  ? 'bg-emerald-600'
                  : 'bg-blue-700';

              return (
                <div
                  key={row.recruit.id}
                  className="p-5 grid grid-cols-1 xl:grid-cols-12 gap-4 items-center"
                >
                  {/* Employee Info */}
                  <div className="xl:col-span-3 min-w-0">
                    <div className="font-medium text-sm text-slate-900 truncate">
                      {row.recruit.name}
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      {row.recruit.role} · {row.recruit.company}
                    </div>
                  </div>

                  {/* Goal + Multiplier + Active Controls */}
                  <div className="xl:col-span-4 grid grid-cols-3 gap-2.5 items-end">
                    <div>
                      <label
                        htmlFor={`goal-${row.recruit.id}`}
                        className="block text-[11px] font-medium text-slate-600 mb-1"
                      >
                        Monthly Goal (Br)
                      </label>
                      <input
                        id={`goal-${row.recruit.id}`}
                        type="number"
                        min="0"
                        max="10000000"
                        step="100"
                        value={draft.monthlyPayGoal}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [row.recruit.id]: {
                              ...draft,
                              monthlyPayGoal: e.target.value,
                            },
                          }))
                        }
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`mult-${row.recruit.id}`}
                        className="block text-[11px] font-medium text-slate-600 mb-1"
                      >
                        Multiplier (x)
                      </label>
                      <input
                        id={`mult-${row.recruit.id}`}
                        type="number"
                        min="1"
                        max="5"
                        step="0.05"
                        value={draft.multiplierFactor}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [row.recruit.id]: {
                              ...draft,
                              multiplierFactor: e.target.value,
                            },
                          }))
                        }
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                      />
                    </div>

                    <label className="flex items-center gap-2 pb-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draft.active}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [row.recruit.id]: {
                              ...draft,
                              active: e.target.checked,
                            },
                          }))
                        }
                        className="w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                      />
                      <span>Enabled</span>
                    </label>
                  </div>

                  {/* Progress Bar & Multiplier Status */}
                  <div className="xl:col-span-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-mono text-slate-800 tabular-nums">
                        {formatCurrency(row.monthlyEmployeePaid)} /{' '}
                        {formatCurrency(row.target.monthlyPayGoal)}
                      </span>
                      <span
                        className={`font-mono font-medium tabular-nums ${
                          !row.target.active
                            ? 'text-slate-400'
                            : row.goalReached
                              ? 'text-emerald-700'
                              : 'text-blue-700'
                        }`}
                      >
                        {row.rawProgressPct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${row.progressPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      {!row.target.active ? (
                        <span className="text-slate-400">
                          Target paused · enable to track multiplier
                        </span>
                      ) : row.goalReached ? (
                        <span className="font-medium text-emerald-700">
                          {row.target.multiplierFactor}x Multiplier Unlocked
                        </span>
                      ) : (
                        <span className="text-slate-500 tabular-nums">
                          {formatCurrency(row.remainingAmount)} remaining to unlock{' '}
                          {row.target.multiplierFactor}x
                        </span>
                      )}
                      {row.goalReached && row.projectedMultiplierBoost > 0 && (
                        <span className="font-mono text-emerald-700 tabular-nums">
                          +{formatCurrency(row.projectedMultiplierBoost)} est.
                        </span>
                      )}
                    </div>
                    {rowErr && (
                      <p role="alert" className="text-[11px] font-medium text-red-700">
                        {rowErr}
                      </p>
                    )}
                  </div>

                  {/* Save Action */}
                  <div className="xl:col-span-1 flex items-center justify-end gap-2">
                    {isJustSaved ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 whitespace-nowrap">
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Saved</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleTargetSave(row.recruit.id)}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-600"
                      >
                        Save
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
