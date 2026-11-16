import type { CommissionRuleSet } from '../types/payroll';

export const DEFAULT_RULES: CommissionRuleSet = {
  defaultCommissionRatePct: 12,
  highPayBonusThreshold: 4500,
  highPayBonusAmount: 250,
  tierAcceleratorThreshold: 20000,
  tierAcceleratorRatePct: 3,
  retentionMilestoneBonusAmount: 500,
};

export const LEGACY_DEMO_RECRUIT_IDS = new Set([
  'rec-elena',
  'rec-marcus',
  'rec-priya',
  'rec-devon',
  'rec-sofia',
  'rec-liam',
]);

export const LEGACY_DEMO_PAYOUT_IDS = new Set([
  'pay-01',
  'pay-02',
  'pay-03',
  'pay-04',
  'pay-05',
  'pay-06',
  'pay-07',
  'pay-08',
  'pay-09',
  'pay-10',
  'pay-11',
  'pay-12',
]);
