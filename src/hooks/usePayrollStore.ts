import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  DEFAULT_RULES,
  LEGACY_DEMO_PAYOUT_IDS,
  LEGACY_DEMO_RECRUIT_IDS,
} from '../data/seedData';
import { useFirebaseAuth } from '../contexts/FirebaseContext';
import {
  OperationType,
  db,
  handleFirestoreError,
  isWorkspaceAccessAllowed,
} from '../firebase';
import type {
  Applicant,
  ApplicantInvite,
  ApplicantStage,
  ApplicantTestAssignment,
  CommissionModel,
  CommissionRuleSet,
  ExamFormQuestionMap,
  ExamFormRecord,
  ExamSubmissionRecord,
  ExamTestType,
  InviteCodeStatus,
  PaymentMethodType,
  PayoutRecord,
  PayoutStatus,
  PerformanceTarget,
  Recruit,
  TestAssignmentStatus,
} from '../types/payroll';
import {
  calculatePayoutBreakdown,
  computeDashboardMetrics,
  getPriorCumulativePay,
  resolvePayoutCommissionMultiplier,
} from '../utils/commissionEngine';
import {
  EXAM_TEST_TYPES,
  generateInviteCode,
  getExamTestSpec,
  isValidExamTestType,
  MIN_DUOLINGO_SCORE,
} from '../utils/examBlueprint';

export interface NewPayoutInput {
  recruitId: string;
  payDate: string;
  payPeriodLabel: string;
  grossEmployeePay: number;
  paymentMethod: PaymentMethodType;
  paymentAccountDetail: string;
  status: PayoutStatus;
  isRetentionMilestone: boolean;
  notes: string;
}

export interface RecruitInput {
  name: string;
  role: string;
  company: string;
  email: string;
  startDate: string;
  commissionModel: CommissionModel;
  customCommissionValue: number | null;
  preferredPaymentMethod: PaymentMethodType;
  paymentAccountDetail: string;
  active: boolean;
}

export interface PerformanceTargetInput {
  recruitId: string;
  monthlyPayGoal: number;
  multiplierFactor: number;
  active: boolean;
}

export interface ApplicantInput {
  name: string;
  email: string;
  phone: string;
  targetRole: string;
  targetCompany: string;
  source: string;
  appliedDate: string;
  expectedSalary: number;
  stage: ApplicantStage;
  notes: string;
  convertedRecruitId?: string | null;
}

export interface SaveExamFormInput extends ExamFormQuestionMap {
  googleFormId: string;
  testType: ExamTestType;
  title: string;
  responderUri: string;
  editUrl: string;
}

export interface SaveExamSubmissionInput {
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
  submittedAt: string;
}

function clampText(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

export function usePayrollStore() {
  const { user, authReady, applicantProfile } = useFirebaseAuth();

  const [recruits, setRecruits] = useState<Recruit[]>([]);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [rules, setRules] = useState<CommissionRuleSet>(DEFAULT_RULES);
  const [performanceTargets, setPerformanceTargets] = useState<
    PerformanceTarget[]
  >([]);
  const [examForms, setExamForms] = useState<ExamFormRecord[]>([]);
  const [examSubmissions, setExamSubmissions] = useState<
    ExamSubmissionRecord[]
  >([]);
  const [applicantTests, setApplicantTests] = useState<
    ApplicantTestAssignment[]
  >([]);
  const [applicantInvites, setApplicantInvites] = useState<ApplicantInvite[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Ensure workspace root and default rules exist on login, remove any legacy demo docs, then subscribe
  useEffect(() => {
    if (!authReady) return;
    if (!user || !isWorkspaceAccessAllowed(user) || applicantProfile) {
      setRecruits([]);
      setApplicants([]);
      setPayouts([]);
      setRules(DEFAULT_RULES);
      setPerformanceTargets([]);
      setExamForms([]);
      setExamSubmissions([]);
      setApplicantTests([]);
      setApplicantInvites([]);
      setLoading(false);
      setSyncError(null);
      return;
    }

    let cancelled = false;
    let unsubRules: (() => void) | undefined;
    let unsubRecruits: (() => void) | undefined;
    let unsubApplicants: (() => void) | undefined;
    let unsubPayouts: (() => void) | undefined;
    let unsubTargets: (() => void) | undefined;
    let unsubExamForms: (() => void) | undefined;
    let unsubExamSubmissions: (() => void) | undefined;
    let unsubApplicantTests: (() => void) | undefined;
    let unsubInvites: (() => void) | undefined;

    const uid = user.uid;
    const initialDisplayName = clampText(
      user.displayName?.trim() ||
        user.email?.split('@')[0]?.trim() ||
        'Recruiter',
      120
    );
    const userDocRef = doc(db, 'users', uid);
    const rulesDocRef = doc(db, 'users', uid, 'settings', 'commissionRules');
    const recruitsColRef = collection(db, 'users', uid, 'recruits');
    const applicantsColRef = collection(db, 'users', uid, 'applicants');
    const payoutsColRef = collection(db, 'users', uid, 'payouts');
    const targetsColRef = collection(db, 'users', uid, 'performanceTargets');
    const examFormsColRef = collection(db, 'users', uid, 'examForms');
    const examSubmissionsColRef = collection(
      db,
      'users',
      uid,
      'examSubmissions'
    );
    const applicantTestsColRef = collection(db, 'users', uid, 'applicantTests');
    const invitesColRef = collection(db, 'applicantInvites');

    async function bootstrapAndSubscribe() {
      setLoading(true);
      setSyncError(null);

      try {
        const userSnap = await getDoc(userDocRef);
        if (!userSnap.exists()) {
          const initBatch = writeBatch(db);
          initBatch.set(userDocRef, {
            uid,
            displayName: initialDisplayName,
            seededDemo: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          initBatch.set(rulesDocRef, {
            ownerId: uid,
            ...DEFAULT_RULES,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          await initBatch.commit();
        } else {
          if (userSnap.data()?.seededDemo === true) {
            // One-time cleanup of previously seeded demo records while preserving user-created entries
            const [payoutSnaps, targetSnaps, recruitSnaps] = await Promise.all([
              getDocs(query(payoutsColRef, where('ownerId', '==', uid))),
              getDocs(query(targetsColRef, where('ownerId', '==', uid))),
              getDocs(query(recruitsColRef, where('ownerId', '==', uid))),
            ]);

            const cleanupBatch = writeBatch(db);
            for (const d of payoutSnaps.docs) {
              const recruitId = String(d.data().recruitId ?? '');
              if (
                LEGACY_DEMO_PAYOUT_IDS.has(d.id) ||
                LEGACY_DEMO_RECRUIT_IDS.has(recruitId)
              ) {
                cleanupBatch.delete(d.ref);
              }
            }
            for (const d of targetSnaps.docs) {
              const recruitId = String(d.data().recruitId ?? d.id);
              if (
                LEGACY_DEMO_RECRUIT_IDS.has(d.id) ||
                LEGACY_DEMO_RECRUIT_IDS.has(recruitId)
              ) {
                cleanupBatch.delete(d.ref);
              }
            }
            for (const d of recruitSnaps.docs) {
              if (LEGACY_DEMO_RECRUIT_IDS.has(d.id)) {
                cleanupBatch.delete(d.ref);
              }
            }
            cleanupBatch.update(userDocRef, {
              seededDemo: false,
              updatedAt: serverTimestamp(),
            });
            await cleanupBatch.commit();
          }

          // Ensure commissionRules exists if a secondary device joins a partial workspace
          const rulesSnap = await getDoc(rulesDocRef);
          if (!rulesSnap.exists()) {
            await setDoc(rulesDocRef, {
              ownerId: uid,
              ...DEFAULT_RULES,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }
      } catch (error) {
        if (!cancelled) {
          setSyncError(
            error instanceof Error ? error.message : 'Failed to initialize workspace.'
          );
          setLoading(false);
        }
        try {
          handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
        } catch {
          return;
        }
      }

      if (cancelled) return;

      let rulesLoaded = false;
      let recruitsLoaded = false;
      let applicantsLoaded = false;
      let payoutsLoaded = false;
      let targetsLoaded = false;
      const markReadyIfAllLoaded = () => {
        if (
          rulesLoaded &&
          recruitsLoaded &&
          applicantsLoaded &&
          payoutsLoaded &&
          targetsLoaded &&
          !cancelled
        ) {
          setLoading(false);
        }
      };

      unsubRules = onSnapshot(
        rulesDocRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const d = snapshot.data();
            setRules({
              defaultCommissionRatePct: Number(d.defaultCommissionRatePct ?? 12),
              highPayBonusThreshold: Number(d.highPayBonusThreshold ?? 4500),
              highPayBonusAmount: Number(d.highPayBonusAmount ?? 250),
              tierAcceleratorThreshold: Number(d.tierAcceleratorThreshold ?? 20000),
              tierAcceleratorRatePct: Number(d.tierAcceleratorRatePct ?? 3),
              retentionMilestoneBonusAmount: Number(
                d.retentionMilestoneBonusAmount ?? 500
              ),
            });
          }
          rulesLoaded = true;
          markReadyIfAllLoaded();
        },
        (error) => {
          setSyncError('Unable to sync commission rules.');
          setLoading(false);
          handleFirestoreError(
            error,
            OperationType.GET,
            `users/${uid}/settings/commissionRules`
          );
        }
      );

      unsubRecruits = onSnapshot(
        query(recruitsColRef, where('ownerId', '==', uid)),
        (snapshot) => {
          const next: Recruit[] = snapshot.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              id: docSnap.id,
              name: String(d.name ?? ''),
              role: String(d.role ?? ''),
              company: String(d.company ?? ''),
              email: String(d.email ?? ''),
              startDate: String(d.startDate ?? ''),
              commissionModel:
                d.commissionModel === 'flat' ? 'flat' : 'percentage',
              customCommissionValue:
                typeof d.customCommissionValue === 'number'
                  ? d.customCommissionValue
                  : null,
              preferredPaymentMethod:
                d.preferredPaymentMethod as PaymentMethodType,
              paymentAccountDetail: String(d.paymentAccountDetail ?? ''),
              active: Boolean(d.active ?? true),
            };
          });
          setRecruits(next);
          recruitsLoaded = true;
          markReadyIfAllLoaded();
        },
        (error) => {
          setSyncError('Unable to sync recruited employees.');
          setLoading(false);
          handleFirestoreError(
            error,
            OperationType.LIST,
            `users/${uid}/recruits`
          );
        }
      );

      unsubPayouts = onSnapshot(
        query(payoutsColRef, where('ownerId', '==', uid)),
        (snapshot) => {
          const next: PayoutRecord[] = snapshot.docs
            .map((docSnap): PayoutRecord => {
              const d = docSnap.data();
              const commissionModel: CommissionModel =
                d.commissionModel === 'flat' ? 'flat' : 'percentage';
              return {
                id: docSnap.id,
                recruitId: String(d.recruitId ?? ''),
                payDate: String(d.payDate ?? ''),
                payPeriodLabel: String(d.payPeriodLabel ?? ''),
                grossEmployeePay: Number(d.grossEmployeePay ?? 0),
                commissionModel,
                commissionRateOrFlat: Number(d.commissionRateOrFlat ?? 0),
                baseCommissionAmount: Number(d.baseCommissionAmount ?? 0),
                bonuses: Array.isArray(d.bonuses) ? d.bonuses : [],
                totalBonusAmount: Number(d.totalBonusAmount ?? 0),
                totalRecruiterEarnings: Number(d.totalRecruiterEarnings ?? 0),
                paymentMethod: d.paymentMethod as PaymentMethodType,
                paymentAccountDetail: String(d.paymentAccountDetail ?? ''),
                referenceCode: String(d.referenceCode ?? ''),
                status: d.status as PayoutStatus,
                isRetentionMilestone: Boolean(d.isRetentionMilestone),
                notes: String(d.notes ?? ''),
              };
            })
            .sort((a, b) => b.payDate.localeCompare(a.payDate));

          setPayouts(next);
          payoutsLoaded = true;
          markReadyIfAllLoaded();
        },
        (error) => {
          setSyncError('Unable to sync payout ledger.');
          setLoading(false);
          handleFirestoreError(
            error,
            OperationType.LIST,
            `users/${uid}/payouts`
          );
        }
      );

      unsubTargets = onSnapshot(
        query(targetsColRef, where('ownerId', '==', uid)),
        (snapshot) => {
          const next: PerformanceTarget[] = snapshot.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              id: docSnap.id,
              recruitId: String(d.recruitId ?? docSnap.id),
              monthlyPayGoal: Number(d.monthlyPayGoal ?? 0),
              multiplierFactor: Number(d.multiplierFactor ?? 1),
              active: Boolean(d.active ?? true),
            };
          });
          setPerformanceTargets(next);
          targetsLoaded = true;
          markReadyIfAllLoaded();
        },
        (error) => {
          setSyncError('Unable to sync performance targets.');
          setLoading(false);
          handleFirestoreError(
            error,
            OperationType.LIST,
            `users/${uid}/performanceTargets`
          );
        }
      );
      unsubApplicants = onSnapshot(
        query(applicantsColRef, where('ownerId', '==', uid)),
        (snapshot) => {
          const validStages: ApplicantStage[] = [
            'New',
            'Screening',
            'Interview',
            'Offer',
            'Hired',
            'Rejected',
          ];
          const next: Applicant[] = snapshot.docs
            .map((docSnap): Applicant => {
              const d = docSnap.data();
              const stage = validStages.includes(d.stage as ApplicantStage)
                ? (d.stage as ApplicantStage)
                : 'New';
              return {
                id: docSnap.id,
                name: String(d.name ?? ''),
                email: String(d.email ?? ''),
                phone: String(d.phone ?? ''),
                targetRole: String(d.targetRole ?? ''),
                targetCompany: String(d.targetCompany ?? ''),
                source: String(d.source ?? ''),
                appliedDate: String(d.appliedDate ?? ''),
                expectedSalary: Number(d.expectedSalary ?? 0),
                stage,
                notes: String(d.notes ?? ''),
                convertedRecruitId:
                  typeof d.convertedRecruitId === 'string' &&
                  d.convertedRecruitId.length > 0
                    ? d.convertedRecruitId
                    : null,
              };
            })
            .sort((a, b) => b.appliedDate.localeCompare(a.appliedDate));
          setApplicants(next);
          applicantsLoaded = true;
          markReadyIfAllLoaded();
        },
        (error) => {
          setSyncError('Unable to sync applicants.');
          setLoading(false);
          handleFirestoreError(
            error,
            OperationType.LIST,
            `users/${uid}/applicants`
          );
        }
      );

      unsubExamForms = onSnapshot(
        query(examFormsColRef, where('ownerId', '==', uid)),
        (snapshot) => {
          const next: ExamFormRecord[] = snapshot.docs.map((docSnap) => {
            const d = docSnap.data();
            const testType: ExamTestType = isValidExamTestType(d.testType)
              ? d.testType
              : 'english_comm';
            return {
              id: docSnap.id,
              googleFormId: String(d.googleFormId ?? ''),
              testType,
              title: String(d.title ?? ''),
              responderUri: String(d.responderUri ?? ''),
              editUrl: String(d.editUrl ?? ''),
              qFullName: String(d.qFullName ?? ''),
              qEmail: String(d.qEmail ?? ''),
              qTargetRole: String(d.qTargetRole ?? ''),
              qDuolingoScore: String(d.qDuolingoScore ?? ''),
              qDuolingoProof: String(d.qDuolingoProof ?? ''),
              qScenario: String(d.qScenario ?? ''),
              qTrickConstraint: String(d.qTrickConstraint ?? ''),
              qTrickLogic: String(d.qTrickLogic ?? ''),
              qTrickCanary: String(d.qTrickCanary ?? ''),
            };
          });
          setExamForms(next);
        },
        (error) => {
          setSyncError('Unable to sync linked Google Forms.');
          handleFirestoreError(
            error,
            OperationType.LIST,
            `users/${uid}/examForms`
          );
        }
      );

      unsubExamSubmissions = onSnapshot(
        query(examSubmissionsColRef, where('ownerId', '==', uid)),
        (snapshot) => {
          const next: ExamSubmissionRecord[] = snapshot.docs
            .map((docSnap) => {
              const d = docSnap.data();
              const testType: ExamTestType = isValidExamTestType(d.testType)
                ? d.testType
                : 'english_comm';
              return {
                id: docSnap.id,
                googleFormId: String(d.googleFormId ?? ''),
                testType,
                responseId: String(d.responseId ?? ''),
                applicantName: String(d.applicantName ?? ''),
                applicantEmail: String(d.applicantEmail ?? ''),
                targetRole: String(d.targetRole ?? ''),
                duolingoScore: Number(d.duolingoScore ?? 0),
                duolingoProof: String(d.duolingoProof ?? ''),
                duolingoPassed: Boolean(d.duolingoPassed),
                canaryTriggered: Boolean(d.canaryTriggered),
                trickQuestionsPassed: Boolean(d.trickQuestionsPassed),
                aiLikelihoodPct: Number(d.aiLikelihoodPct ?? 0),
                aiSuspected: Boolean(d.aiSuspected),
                qualityScore: Number(d.qualityScore ?? 0),
                passed: Boolean(d.passed),
                flags: Array.isArray(d.flags) ? d.flags.map(String) : [],
                summary: String(d.summary ?? ''),
                inviteCode:
                  typeof d.inviteCode === 'string' && d.inviteCode.length > 0
                    ? d.inviteCode
                    : null,
                submittedAt: String(d.submittedAt ?? ''),
              };
            })
            .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
          setExamSubmissions(next);
        },
        (error) => {
          setSyncError('Unable to sync exam submissions.');
          handleFirestoreError(
            error,
            OperationType.LIST,
            `users/${uid}/examSubmissions`
          );
        }
      );

      unsubApplicantTests = onSnapshot(
        query(applicantTestsColRef, where('ownerId', '==', uid)),
        (snapshot) => {
          const validStatuses: TestAssignmentStatus[] = [
            'Assigned',
            'Passed',
            'Failed',
          ];
          const next: ApplicantTestAssignment[] = snapshot.docs.map((docSnap) => {
            const d = docSnap.data();
            const testType: ExamTestType = isValidExamTestType(d.testType)
              ? d.testType
              : 'english_comm';
            const status = validStatuses.includes(d.status as TestAssignmentStatus)
              ? (d.status as TestAssignmentStatus)
              : 'Assigned';
            return {
              id: docSnap.id,
              applicantId: String(d.applicantId ?? ''),
              applicantName: String(d.applicantName ?? ''),
              applicantEmail: String(d.applicantEmail ?? ''),
              testType,
              googleFormId: String(d.googleFormId ?? ''),
              formTitle: String(d.formTitle ?? getExamTestSpec(testType).label),
              responderUri: String(d.responderUri ?? ''),
              status,
              submissionId:
                typeof d.submissionId === 'string' && d.submissionId.length > 0
                  ? d.submissionId
                  : null,
              duolingoScore: Number(d.duolingoScore ?? 0),
              aiLikelihoodPct: Number(d.aiLikelihoodPct ?? 0),
              qualityScore: Number(d.qualityScore ?? 0),
              assignedAt: String(d.assignedAt ?? ''),
              completedAt: String(d.completedAt ?? ''),
            };
          });
          setApplicantTests(next);
        },
        (error) => {
          setSyncError('Unable to sync applicant test assignments.');
          handleFirestoreError(
            error,
            OperationType.LIST,
            `users/${uid}/applicantTests`
          );
        }
      );

      unsubInvites = onSnapshot(
        query(invitesColRef, where('recruiterUid', '==', uid)),
        (snapshot) => {
          const validStatuses: InviteCodeStatus[] = ['Active', 'Used', 'Revoked'];
          const next: ApplicantInvite[] = snapshot.docs.map((docSnap) => {
            const d = docSnap.data();
            const status = validStatuses.includes(d.status as InviteCodeStatus)
              ? (d.status as InviteCodeStatus)
              : 'Active';
            return {
              code: String(d.code ?? docSnap.id),
              recruiterUid: String(d.recruiterUid ?? uid),
              applicantName: String(d.applicantName ?? ''),
              applicantEmail: String(d.applicantEmail ?? ''),
              targetRole: String(d.targetRole ?? ''),
              duolingoScore: Number(d.duolingoScore ?? 100),
              examScore: Number(d.examScore ?? 0),
              aiLikelihoodPct: Number(d.aiLikelihoodPct ?? 0),
              status,
              usedByUid:
                typeof d.usedByUid === 'string' && d.usedByUid.length > 0
                  ? d.usedByUid
                  : null,
            };
          });
          setApplicantInvites(next);
        },
        (error) => {
          setSyncError('Unable to sync applicant registration codes.');
          handleFirestoreError(error, OperationType.LIST, 'applicantInvites');
        }
      );
    }

    void bootstrapAndSubscribe();

    return () => {
      cancelled = true;
      unsubRules?.();
      unsubRecruits?.();
      unsubApplicants?.();
      unsubPayouts?.();
      unsubTargets?.();
      unsubExamForms?.();
      unsubExamSubmissions?.();
      unsubApplicantTests?.();
      unsubInvites?.();
    };
  }, [authReady, user, applicantProfile]);

  const recruitsMap = useMemo(
    () => new Map(recruits.map((r) => [r.id, r])),
    [recruits]
  );

  const metrics = useMemo(
    () => computeDashboardMetrics(payouts, recruits),
    [payouts, recruits]
  );

  const recordPayout = useCallback(
    async (input: NewPayoutInput): Promise<PayoutRecord | null> => {
      if (!user) return null;
      const recruit = recruits.find((r) => r.id === input.recruitId);
      if (!recruit) return null;

      const priorPay = getPriorCumulativePay(payouts, recruit.id);
      const multiplier = resolvePayoutCommissionMultiplier({
        recruitId: recruit.id,
        payDate: input.payDate,
        grossEmployeePay: input.grossEmployeePay,
        payouts,
        targets: performanceTargets,
      });
      const calc = calculatePayoutBreakdown({
        grossEmployeePay: input.grossEmployeePay,
        recruit,
        rules,
        priorCumulativeEmployeePay: priorPay,
        isRetentionMilestone: input.isRetentionMilestone,
        commissionMultiplier: multiplier,
      });

      const refSuffix = `${String(Date.now()).slice(-4)}${Math.random()
        .toString(36)
        .slice(2, 4)
        .toUpperCase()}`;
      const referenceCode = `CAD-${refSuffix}`;
      const newId = `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const path = `users/${user.uid}/payouts/${newId}`;

      const payload: Omit<PayoutRecord, 'id'> = {
        recruitId: recruit.id,
        payDate: input.payDate,
        payPeriodLabel: clampText(input.payPeriodLabel, 80),
        grossEmployeePay: Math.round(input.grossEmployeePay * 100) / 100,
        commissionModel: calc.commissionModel,
        commissionRateOrFlat: calc.commissionRateOrFlat,
        baseCommissionAmount: calc.baseCommissionAmount,
        bonuses: calc.bonuses,
        totalBonusAmount: calc.totalBonusAmount,
        totalRecruiterEarnings: calc.totalRecruiterEarnings,
        paymentMethod: input.paymentMethod,
        paymentAccountDetail: clampText(input.paymentAccountDetail, 160),
        referenceCode,
        status: input.status,
        isRetentionMilestone: input.isRetentionMilestone,
        notes: clampText(input.notes, 500),
      };

      try {
        await setDoc(doc(db, 'users', user.uid, 'payouts', newId), {
          ownerId: user.uid,
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return { id: newId, ...payload };
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    },
    [user, recruits, payouts, rules, performanceTargets]
  );

  const updatePayoutStatus = useCallback(
    async (payoutId: string, status: PayoutStatus) => {
      if (!user) return;
      const path = `users/${user.uid}/payouts/${payoutId}`;
      try {
        await updateDoc(doc(db, 'users', user.uid, 'payouts', payoutId), {
          status,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    [user]
  );

  const updatePayoutNotes = useCallback(
    async (payoutId: string, notes: string) => {
      if (!user) return;
      const path = `users/${user.uid}/payouts/${payoutId}`;
      try {
        await updateDoc(doc(db, 'users', user.uid, 'payouts', payoutId), {
          notes: clampText(notes, 500),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    [user]
  );

  const deletePayout = useCallback(
    async (payoutId: string) => {
      if (!user) return;
      const path = `users/${user.uid}/payouts/${payoutId}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'payouts', payoutId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    [user]
  );

  const addRecruit = useCallback(
    async (input: RecruitInput): Promise<Recruit | null> => {
      if (!user) return null;
      const newId = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const path = `users/${user.uid}/recruits/${newId}`;

      const payload: Omit<Recruit, 'id'> = {
        name: clampText(input.name, 120),
        role: clampText(input.role, 120),
        company: clampText(input.company, 120),
        email: clampText(input.email, 160),
        startDate: input.startDate,
        commissionModel: input.commissionModel,
        customCommissionValue: input.customCommissionValue,
        preferredPaymentMethod: input.preferredPaymentMethod,
        paymentAccountDetail: clampText(input.paymentAccountDetail, 160),
        active: input.active,
      };

      try {
        await setDoc(doc(db, 'users', user.uid, 'recruits', newId), {
          ownerId: user.uid,
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return { id: newId, ...payload };
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    },
    [user]
  );

  const updateRecruit = useCallback(
    async (recruitId: string, input: Partial<RecruitInput>) => {
      if (!user) return;
      const path = `users/${user.uid}/recruits/${recruitId}`;
      const sanitized: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };
      if (input.name !== undefined) sanitized.name = clampText(input.name, 120);
      if (input.role !== undefined) sanitized.role = clampText(input.role, 120);
      if (input.company !== undefined)
        sanitized.company = clampText(input.company, 120);
      if (input.email !== undefined) sanitized.email = clampText(input.email, 160);
      if (input.startDate !== undefined) sanitized.startDate = input.startDate;
      if (input.commissionModel !== undefined)
        sanitized.commissionModel = input.commissionModel;
      if (input.customCommissionValue !== undefined)
        sanitized.customCommissionValue = input.customCommissionValue;
      if (input.preferredPaymentMethod !== undefined)
        sanitized.preferredPaymentMethod = input.preferredPaymentMethod;
      if (input.paymentAccountDetail !== undefined)
        sanitized.paymentAccountDetail = clampText(input.paymentAccountDetail, 160);
      if (input.active !== undefined) sanitized.active = input.active;

      try {
        await updateDoc(
          doc(db, 'users', user.uid, 'recruits', recruitId),
          sanitized
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    [user]
  );

  const deleteRecruit = useCallback(
    async (recruitId: string) => {
      if (!user) return;
      const relatedPayouts = payouts.filter((p) => p.recruitId === recruitId);
      const hasTarget = performanceTargets.some((t) => t.id === recruitId);
      const path = `users/${user.uid}/recruits/${recruitId}`;
      try {
        const batch = writeBatch(db);
        for (const p of relatedPayouts) {
          batch.delete(doc(db, 'users', user.uid, 'payouts', p.id));
        }
        if (hasTarget) {
          batch.delete(doc(db, 'users', user.uid, 'performanceTargets', recruitId));
        }
        batch.delete(doc(db, 'users', user.uid, 'recruits', recruitId));
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    [user, payouts, performanceTargets]
  );

  const updateRules = useCallback(
    async (nextRules: CommissionRuleSet) => {
      if (!user) return;
      const rulesRef = doc(db, 'users', user.uid, 'settings', 'commissionRules');
      const path = `users/${user.uid}/settings/commissionRules`;
      let isUpdate = true;
      try {
        const snap = await getDoc(rulesRef);
        isUpdate = snap.exists();
        if (isUpdate) {
          await updateDoc(rulesRef, {
            ...nextRules,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(rulesRef, {
            ownerId: user.uid,
            ...nextRules,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(
          error,
          isUpdate ? OperationType.UPDATE : OperationType.CREATE,
          path
        );
      }
    },
    [user]
  );

  const savePerformanceTarget = useCallback(
    async (input: PerformanceTargetInput) => {
      if (!user) return;
      const targetRef = doc(
        db,
        'users',
        user.uid,
        'performanceTargets',
        input.recruitId
      );
      const path = `users/${user.uid}/performanceTargets/${input.recruitId}`;
      let existing = performanceTargets.some((t) => t.id === input.recruitId);

      try {
        const currentSnap = await getDoc(targetRef);
        existing = currentSnap.exists();
        if (existing) {
          await updateDoc(targetRef, {
            monthlyPayGoal: Math.round(input.monthlyPayGoal * 100) / 100,
            multiplierFactor: Math.round(input.multiplierFactor * 100) / 100,
            active: input.active,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(targetRef, {
            ownerId: user.uid,
            recruitId: input.recruitId,
            monthlyPayGoal: Math.round(input.monthlyPayGoal * 100) / 100,
            multiplierFactor: Math.round(input.multiplierFactor * 100) / 100,
            active: input.active,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(
          error,
          existing ? OperationType.UPDATE : OperationType.CREATE,
          path
        );
      }
    },
    [user, performanceTargets]
  );

  const addApplicant = useCallback(
    async (input: ApplicantInput): Promise<Applicant | null> => {
      if (!user) return null;
      const newId = `app-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const path = `users/${user.uid}/applicants/${newId}`;
      const assignedAt = new Date().toISOString();

      const payload: Omit<Applicant, 'id'> = {
        name: clampText(input.name, 120),
        email: clampText(input.email, 160),
        phone: clampText(input.phone, 40),
        targetRole: clampText(input.targetRole, 120),
        targetCompany: clampText(input.targetCompany, 120),
        source: clampText(input.source, 80),
        appliedDate: input.appliedDate,
        expectedSalary: Math.max(0, Math.round(input.expectedSalary * 100) / 100),
        stage: input.stage,
        notes: clampText(input.notes, 500),
        convertedRecruitId: input.convertedRecruitId ?? null,
      };

      const formsByType = new Map(examForms.map((f) => [f.testType, f]));
      const normalizedEmail = payload.email.toLowerCase();

      try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'users', user.uid, 'applicants', newId), {
          ownerId: user.uid,
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Automatically assign all 4 Google Forms screening tests to every new applicant
        for (const testType of EXAM_TEST_TYPES) {
          const spec = getExamTestSpec(testType);
          const connectedForm = formsByType.get(testType);
          const existingSubmission = examSubmissions.find(
            (s) =>
              s.testType === testType &&
              s.applicantEmail.trim().toLowerCase() === normalizedEmail
          );
          const assignmentId = `${newId}_${testType}`;
          const assignmentStatus: TestAssignmentStatus = existingSubmission
            ? existingSubmission.passed
              ? 'Passed'
              : 'Failed'
            : 'Assigned';

          batch.set(doc(db, 'users', user.uid, 'applicantTests', assignmentId), {
            ownerId: user.uid,
            applicantId: newId,
            applicantName: payload.name,
            applicantEmail: payload.email,
            testType,
            googleFormId: connectedForm?.googleFormId ?? '',
            formTitle: clampText(connectedForm?.title || spec.label, 160),
            responderUri: connectedForm?.responderUri ?? '',
            status: assignmentStatus,
            submissionId: existingSubmission?.id ?? null,
            duolingoScore: existingSubmission?.duolingoScore ?? 0,
            aiLikelihoodPct: existingSubmission?.aiLikelihoodPct ?? 0,
            qualityScore: existingSubmission?.qualityScore ?? 0,
            assignedAt,
            completedAt: existingSubmission?.submittedAt ?? '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        await batch.commit();
        return { id: newId, ...payload };
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    },
    [user, examForms, examSubmissions]
  );

  const assignMissingTestsForApplicant = useCallback(
    async (applicant: Applicant) => {
      if (!user) return;
      const existingTypes = new Set(
        applicantTests
          .filter((t) => t.applicantId === applicant.id)
          .map((t) => t.testType)
      );
      const missingTypes = EXAM_TEST_TYPES.filter((t) => !existingTypes.has(t));
      if (missingTypes.length === 0) return;

      const assignedAt = new Date().toISOString();
      const formsByType = new Map(examForms.map((f) => [f.testType, f]));
      const normalizedEmail = applicant.email.trim().toLowerCase();
      const path = `users/${user.uid}/applicantTests`;

      try {
        const batch = writeBatch(db);
        for (const testType of missingTypes) {
          const spec = getExamTestSpec(testType);
          const connectedForm = formsByType.get(testType);
          const existingSubmission = examSubmissions.find(
            (s) =>
              s.testType === testType &&
              s.applicantEmail.trim().toLowerCase() === normalizedEmail
          );
          const assignmentId = `${applicant.id}_${testType}`;
          const assignmentStatus: TestAssignmentStatus = existingSubmission
            ? existingSubmission.passed
              ? 'Passed'
              : 'Failed'
            : 'Assigned';

          batch.set(doc(db, 'users', user.uid, 'applicantTests', assignmentId), {
            ownerId: user.uid,
            applicantId: applicant.id,
            applicantName: clampText(applicant.name, 120),
            applicantEmail: clampText(applicant.email, 160),
            testType,
            googleFormId: connectedForm?.googleFormId ?? '',
            formTitle: clampText(connectedForm?.title || spec.label, 160),
            responderUri: connectedForm?.responderUri ?? '',
            status: assignmentStatus,
            submissionId: existingSubmission?.id ?? null,
            duolingoScore: existingSubmission?.duolingoScore ?? 0,
            aiLikelihoodPct: existingSubmission?.aiLikelihoodPct ?? 0,
            qualityScore: existingSubmission?.qualityScore ?? 0,
            assignedAt,
            completedAt: existingSubmission?.submittedAt ?? '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    },
    [user, applicantTests, examForms, examSubmissions]
  );

  const updateApplicant = useCallback(
    async (applicantId: string, input: Partial<ApplicantInput>) => {
      if (!user) return;
      const path = `users/${user.uid}/applicants/${applicantId}`;
      const sanitized: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };
      if (input.name !== undefined) sanitized.name = clampText(input.name, 120);
      if (input.email !== undefined) sanitized.email = clampText(input.email, 160);
      if (input.phone !== undefined) sanitized.phone = clampText(input.phone, 40);
      if (input.targetRole !== undefined)
        sanitized.targetRole = clampText(input.targetRole, 120);
      if (input.targetCompany !== undefined)
        sanitized.targetCompany = clampText(input.targetCompany, 120);
      if (input.source !== undefined) sanitized.source = clampText(input.source, 80);
      if (input.appliedDate !== undefined) sanitized.appliedDate = input.appliedDate;
      if (input.expectedSalary !== undefined)
        sanitized.expectedSalary = Math.max(
          0,
          Math.round(input.expectedSalary * 100) / 100
        );
      if (input.stage !== undefined) sanitized.stage = input.stage;
      if (input.notes !== undefined) sanitized.notes = clampText(input.notes, 500);
      if (input.convertedRecruitId !== undefined)
        sanitized.convertedRecruitId = input.convertedRecruitId;

      const relatedTests =
        input.name !== undefined || input.email !== undefined
          ? applicantTests.filter((t) => t.applicantId === applicantId)
          : [];

      try {
        if (relatedTests.length > 0) {
          const batch = writeBatch(db);
          batch.update(
            doc(db, 'users', user.uid, 'applicants', applicantId),
            sanitized
          );
          for (const test of relatedTests) {
            const testPatch: Record<string, unknown> = {
              updatedAt: serverTimestamp(),
            };
            if (input.name !== undefined) {
              testPatch.applicantName = clampText(input.name, 120);
            }
            if (input.email !== undefined) {
              testPatch.applicantEmail = clampText(input.email, 160);
            }
            batch.update(
              doc(db, 'users', user.uid, 'applicantTests', test.id),
              testPatch
            );
          }
          await batch.commit();
        } else {
          await updateDoc(
            doc(db, 'users', user.uid, 'applicants', applicantId),
            sanitized
          );
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    [user, applicantTests]
  );

  const updateApplicantStage = useCallback(
    async (applicantId: string, stage: ApplicantStage) => {
      await updateApplicant(applicantId, { stage });
    },
    [updateApplicant]
  );

  const deleteApplicant = useCallback(
    async (applicantId: string) => {
      if (!user) return;
      const path = `users/${user.uid}/applicants/${applicantId}`;
      const relatedTests = applicantTests.filter(
        (t) => t.applicantId === applicantId
      );
      try {
        const batch = writeBatch(db);
        for (const t of relatedTests) {
          batch.delete(doc(db, 'users', user.uid, 'applicantTests', t.id));
        }
        batch.delete(doc(db, 'users', user.uid, 'applicants', applicantId));
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    [user, applicantTests]
  );

  const saveExamForm = useCallback(
    async (input: SaveExamFormInput): Promise<ExamFormRecord | null> => {
      if (!user) return null;
      const existingByGoogleId = examForms.find(
        (f) => f.googleFormId === input.googleFormId
      );
      const replacedFormsOfSameType = examForms.filter(
        (f) =>
          f.testType === input.testType && f.googleFormId !== input.googleFormId
      );
      const docId =
        existingByGoogleId?.id ??
        `form-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const path = `users/${user.uid}/examForms/${docId}`;
      const payload = {
        googleFormId: clampText(input.googleFormId, 160),
        testType: input.testType,
        title: clampText(input.title, 160),
        responderUri: clampText(input.responderUri, 500),
        editUrl: clampText(input.editUrl, 500),
        qFullName: clampText(input.qFullName, 120),
        qEmail: clampText(input.qEmail, 120),
        qTargetRole: clampText(input.qTargetRole, 120),
        qDuolingoScore: clampText(input.qDuolingoScore, 120),
        qDuolingoProof: clampText(input.qDuolingoProof, 120),
        qScenario: clampText(input.qScenario, 120),
        qTrickConstraint: clampText(input.qTrickConstraint, 120),
        qTrickLogic: clampText(input.qTrickLogic, 120),
        qTrickCanary: clampText(input.qTrickCanary, 120),
      };

      const testsToBackfill = applicantTests.filter(
        (t) => t.testType === input.testType
      );

      try {
        const batch = writeBatch(db);
        for (const oldForm of replacedFormsOfSameType) {
          batch.delete(doc(db, 'users', user.uid, 'examForms', oldForm.id));
        }

        if (existingByGoogleId) {
          batch.update(doc(db, 'users', user.uid, 'examForms', docId), {
            testType: payload.testType,
            title: payload.title,
            responderUri: payload.responderUri,
            editUrl: payload.editUrl,
            qFullName: payload.qFullName,
            qEmail: payload.qEmail,
            qTargetRole: payload.qTargetRole,
            qDuolingoScore: payload.qDuolingoScore,
            qDuolingoProof: payload.qDuolingoProof,
            qScenario: payload.qScenario,
            qTrickConstraint: payload.qTrickConstraint,
            qTrickLogic: payload.qTrickLogic,
            qTrickCanary: payload.qTrickCanary,
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.set(doc(db, 'users', user.uid, 'examForms', docId), {
            ownerId: user.uid,
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        // Automatically attach the live Google Form URL to all existing applicant test assignments for this testType
        for (const test of testsToBackfill) {
          batch.update(doc(db, 'users', user.uid, 'applicantTests', test.id), {
            googleFormId: payload.googleFormId,
            formTitle: payload.title,
            responderUri: payload.responderUri,
            updatedAt: serverTimestamp(),
          });
        }

        await batch.commit();
        return { id: docId, ...payload };
      } catch (error) {
        handleFirestoreError(
          error,
          existingByGoogleId ? OperationType.UPDATE : OperationType.CREATE,
          path
        );
      }
    },
    [user, examForms, applicantTests]
  );

  const deleteExamForm = useCallback(
    async (formDocId: string) => {
      if (!user) return;
      const path = `users/${user.uid}/examForms/${formDocId}`;
      const targetForm = examForms.find((f) => f.id === formDocId);
      const linkedTests = targetForm
        ? applicantTests.filter(
            (t) => t.googleFormId === targetForm.googleFormId
          )
        : [];
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'users', user.uid, 'examForms', formDocId));
        if (targetForm) {
          const fallbackTitle = getExamTestSpec(targetForm.testType).label;
          for (const t of linkedTests) {
            batch.update(doc(db, 'users', user.uid, 'applicantTests', t.id), {
              googleFormId: '',
              formTitle: fallbackTitle,
              responderUri: '',
              updatedAt: serverTimestamp(),
            });
          }
        }
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    [user, examForms, applicantTests]
  );

  const saveExamSubmission = useCallback(
    async (
      input: SaveExamSubmissionInput
    ): Promise<ExamSubmissionRecord | null> => {
      if (!user) return null;
      const newId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const path = `users/${user.uid}/examSubmissions/${newId}`;

      const payload: Omit<ExamSubmissionRecord, 'id'> = {
        googleFormId: clampText(input.googleFormId, 160),
        testType: input.testType,
        responseId: clampText(input.responseId, 160),
        applicantName: clampText(input.applicantName, 120) || 'Unnamed Applicant',
        applicantEmail: clampText(input.applicantEmail.toLowerCase(), 160),
        targetRole: clampText(input.targetRole, 120),
        duolingoScore: Math.max(0, Math.min(160, Math.round(input.duolingoScore))),
        duolingoProof: clampText(input.duolingoProof, 300),
        duolingoPassed: Boolean(input.duolingoPassed),
        canaryTriggered: Boolean(input.canaryTriggered),
        trickQuestionsPassed: Boolean(input.trickQuestionsPassed),
        aiLikelihoodPct: Math.max(
          0,
          Math.min(100, Math.round(input.aiLikelihoodPct))
        ),
        aiSuspected: Boolean(input.aiSuspected),
        qualityScore: Math.max(0, Math.min(100, Math.round(input.qualityScore))),
        passed: Boolean(input.passed),
        flags: input.flags.slice(0, 10).map((f) => clampText(f, 300)),
        summary: clampText(input.summary, 500),
        inviteCode: null,
        submittedAt: clampText(input.submittedAt, 64),
      };

      const matchingAssignments = applicantTests.filter(
        (t) =>
          t.testType === payload.testType &&
          t.applicantEmail.trim().toLowerCase() === payload.applicantEmail
      );

      try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'users', user.uid, 'examSubmissions', newId), {
          ownerId: user.uid,
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        for (const assignment of matchingAssignments) {
          batch.update(
            doc(db, 'users', user.uid, 'applicantTests', assignment.id),
            {
              status: payload.passed ? 'Passed' : 'Failed',
              submissionId: newId,
              duolingoScore: payload.duolingoScore,
              aiLikelihoodPct: payload.aiLikelihoodPct,
              qualityScore: payload.qualityScore,
              completedAt: payload.submittedAt,
              updatedAt: serverTimestamp(),
            }
          );
        }

        await batch.commit();
        return { id: newId, ...payload };
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    },
    [user, applicantTests]
  );

  const deleteExamSubmission = useCallback(
    async (submissionId: string) => {
      if (!user) return;
      const path = `users/${user.uid}/examSubmissions/${submissionId}`;
      try {
        await deleteDoc(
          doc(db, 'users', user.uid, 'examSubmissions', submissionId)
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    [user]
  );

  const issueApplicantInvite = useCallback(
    async (submission: ExamSubmissionRecord): Promise<string | null> => {
      if (!user) return null;
      if (!submission.passed || submission.duolingoScore < MIN_DUOLINGO_SCORE) {
        throw new Error(
          `Only applicants who pass the exam with a Duolingo score of ${MIN_DUOLINGO_SCORE}+ can receive a registration code.`
        );
      }
      if (submission.inviteCode) {
        return submission.inviteCode;
      }

      const code = generateInviteCode();
      const inviteRef = doc(db, 'applicantInvites', code);
      const submissionRef = doc(
        db,
        'users',
        user.uid,
        'examSubmissions',
        submission.id
      );

      try {
        const batch = writeBatch(db);
        batch.set(inviteRef, {
          code,
          recruiterUid: user.uid,
          applicantName: clampText(submission.applicantName, 120),
          applicantEmail: clampText(submission.applicantEmail.toLowerCase(), 160),
          targetRole: clampText(submission.targetRole, 120),
          duolingoScore: Math.max(
            MIN_DUOLINGO_SCORE,
            Math.min(160, Math.round(submission.duolingoScore))
          ),
          examScore: Math.max(
            0,
            Math.min(100, Math.round(submission.qualityScore))
          ),
          aiLikelihoodPct: Math.max(
            0,
            Math.min(100, Math.round(submission.aiLikelihoodPct))
          ),
          status: 'Active',
          usedByUid: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        batch.update(submissionRef, {
          inviteCode: code,
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
        return code;
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.CREATE,
          `applicantInvites/${code}`
        );
      }
    },
    [user]
  );

  const revokeApplicantInvite = useCallback(
    async (code: string) => {
      if (!user) return;
      const path = `applicantInvites/${code}`;
      try {
        await updateDoc(doc(db, 'applicantInvites', code), {
          status: 'Revoked',
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    [user]
  );

  return {
    recruits,
    applicants,
    payouts,
    rules,
    performanceTargets,
    examForms,
    examSubmissions,
    applicantTests,
    applicantInvites,
    loading,
    syncError,
    recruitsMap,
    metrics,
    recordPayout,
    updatePayoutStatus,
    updatePayoutNotes,
    deletePayout,
    addRecruit,
    updateRecruit,
    deleteRecruit,
    addApplicant,
    assignMissingTestsForApplicant,
    updateApplicant,
    updateApplicantStage,
    deleteApplicant,
    saveExamForm,
    deleteExamForm,
    saveExamSubmission,
    deleteExamSubmission,
    issueApplicantInvite,
    revokeApplicantInvite,
    updateRules,
    savePerformanceTarget,
  };
}
