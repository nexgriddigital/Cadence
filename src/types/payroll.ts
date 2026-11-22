export type PaymentMethodType =
  | 'ACH Direct Deposit'
  | 'Wire Transfer'
  | 'Wise'
  | 'PayPal'
  | 'Check';

export type PayoutStatus = 'Paid' | 'Scheduled' | 'Pending' | 'On Hold';

export type CommissionModel = 'percentage' | 'flat';

export type DashboardTab =
  | 'overview'
  | 'ledger'
  | 'applicants'
  | 'forms'
  | 'recruits'
  | 'payment-methods'
  | 'rules';

export type ApplicantStage =
  | 'New'
  | 'Screening'
  | 'Interview'
  | 'Offer'
  | 'Hired'
  | 'Rejected';

export type InviteCodeStatus = 'Active' | 'Used' | 'Revoked';

export type ExamTestType =
  | 'english_comm'
  | 'analytical_logic'
  | 'technical_ops'
  | 'role_scenario';

export type TestAssignmentStatus = 'Assigned' | 'Passed' | 'Failed';

export interface ExamFormQuestionMap {
  qFullName: string;
  qEmail: string;
  qTargetRole: string;
  qDuolingoScore: string;
  qDuolingoProof: string;
  qScenario: string;
  qTrickConstraint: string;
  qTrickLogic: string;
  qTrickCanary: string;
}

export interface ExamFormRecord extends ExamFormQuestionMap {
  id: string;
  googleFormId: string;
  testType: ExamTestType;
  title: string;
  responderUri: string;
  editUrl: string;
}

export interface ExamSubmissionRecord {
  id: string;
  googleFormId: string;
  testType: ExamTestType;
  responseId: string;
  applicantName: string;
  applicantEmail: string;
  targetRole: string;
  duolingoScore: number;
  duolingoProof: string;
  duolingoPassed: boolean;
  canaryTriggered: boolean;
  trickQuestionsPassed: boolean;
  aiLikelihoodPct: number;
  aiSuspected: boolean;
  qualityScore: number;
  passed: boolean;
  flags: string[];
  summary: string;
  inviteCode: string | null;
  submittedAt: string;
}

export interface ApplicantTestAssignment {
  id: string;
  applicantId: string;
  applicantName: string;
  applicantEmail: string;
  testType: ExamTestType;
  googleFormId: string;
  formTitle: string;
  responderUri: string;
  status: TestAssignmentStatus;
  submissionId: string | null;
  duolingoScore: number;
  aiLikelihoodPct: number;
  qualityScore: number;
  assignedAt: string;
  completedAt: string;
}

export interface ApplicantInvite {
  code: string;
  recruiterUid: string;
  applicantName: string;
  applicantEmail: string;
  targetRole: string;
  duolingoScore: number;
  examScore: number;
  aiLikelihoodPct: number;
  status: InviteCodeStatus;
  usedByUid: string | null;
}

export interface ApplicantProfile {
  uid: string;
  recruiterUid: string;
  inviteCode: string;
  name: string;
  email: string;
  targetRole: string;
  duolingoScore: number;
  examScore: number;
  aiLikelihoodPct: number;
  status: 'Approved';
}

export interface Applicant {
  id: string;
  name: string;
  email: string;
  phone: string;
  targetRole: string;
  targetCompany: string;
  source: string;
  appliedDate: string; // YYYY-MM-DD
  expectedSalary: number;
  stage: ApplicantStage;
  notes: string;
  convertedRecruitId: string | null;
}

export interface Recruit {
  id: string;
  name: string;
  role: string;
  company: string;
  email: string;
  startDate: string; // YYYY-MM-DD
  commissionModel: CommissionModel;
  /** Percentage (e.g. 12 for 12%) or flat USD per pay period; null uses global default */
  customCommissionValue: number | null;
  preferredPaymentMethod: PaymentMethodType;
  /** Masked account or handle, e.g. "Chase Checking ••4821" */
  paymentAccountDetail: string;
  active: boolean;
}

export interface CommissionRuleSet {
  defaultCommissionRatePct: number; // e.g. 12 (%)
  highPayBonusThreshold: number; // e.g. 4500 ($)
  highPayBonusAmount: number; // e.g. 250 ($)
  tierAcceleratorThreshold: number; // cumulative employee paid e.g. 20000 ($)
  tierAcceleratorRatePct: number; // extra % e.g. 3 (%)
  retentionMilestoneBonusAmount: number; // e.g. 500 ($)
}

export interface PerformanceTarget {
  id: string; // matches recruitId
  recruitId: string;
  monthlyPayGoal: number;
  multiplierFactor: number;
  active: boolean;
}

export interface BonusLineItem {
  id: string;
  label: string;
  amount: number;
}

export interface PayoutRecord {
  id: string;
  recruitId: string;
  payDate: string; // YYYY-MM-DD
  payPeriodLabel: string; // e.g. "Nov 1 – Nov 15, 2026"
  grossEmployeePay: number;
  commissionModel: CommissionModel;
  commissionRateOrFlat: number;
  baseCommissionAmount: number;
  bonuses: BonusLineItem[];
  totalBonusAmount: number;
  totalRecruiterEarnings: number;
  paymentMethod: PaymentMethodType;
  paymentAccountDetail: string;
  referenceCode: string;
  status: PayoutStatus;
  isRetentionMilestone: boolean;
  notes: string;
}

export interface PayoutCalculationResult {
  commissionModel: CommissionModel;
  commissionRateOrFlat: number;
  baseCommissionAmount: number;
  bonuses: BonusLineItem[];
  totalBonusAmount: number;
  totalRecruiterEarnings: number;
}

export interface PayoutFilters {
  search: string;
  status: PayoutStatus | 'All';
  paymentMethod: PaymentMethodType | 'All';
  sortBy: 'date-desc' | 'date-asc' | 'amount-desc' | 'earnings-desc';
}
