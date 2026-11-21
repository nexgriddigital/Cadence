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
  CommissionModel,
  CommissionRuleSet,
  PaymentMethodType,
  PayoutRecord,
  PayoutStatus,
  PerformanceTarget,
  Recruit,
} from '../types/payroll';
import {
  calculatePayoutBreakdown,
  computeDashboardMetrics,
  getPriorCumulativePay,
  resolvePayoutCommissionMultiplier,
} from '../utils/commissionEngine';

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

function clampText(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

export function usePayrollStore() {
  const { user, authReady } = useFirebaseAuth();

  const [recruits, setRecruits] = useState<Recruit[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [rules, setRules] = useState<CommissionRuleSet>(DEFAULT_RULES);
  const [performanceTargets, setPerformanceTargets] = useState<
    PerformanceTarget[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Ensure workspace root and default rules exist on login, remove any legacy demo docs, then subscribe
  useEffect(() => {
    if (!authReady) return;
    if (!user || !isWorkspaceAccessAllowed(user)) {
      setRecruits([]);
      setPayouts([]);
      setRules(DEFAULT_RULES);
      setPerformanceTargets([]);
      setLoading(false);
      setSyncError(null);
      return;
    }

    let cancelled = false;
    let unsubRules: (() => void) | undefined;
    let unsubRecruits: (() => void) | undefined;
    let unsubPayouts: (() => void) | undefined;
    let unsubTargets: (() => void) | undefined;

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
    const payoutsColRef = collection(db, 'users', uid, 'payouts');
    const targetsColRef = collection(db, 'users', uid, 'performanceTargets');

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
      let payoutsLoaded = false;
      let targetsLoaded = false;
      const markReadyIfAllLoaded = () => {
        if (
          rulesLoaded &&
          recruitsLoaded &&
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
    }

    void bootstrapAndSubscribe();

    return () => {
      cancelled = true;
      unsubRules?.();
      unsubRecruits?.();
      unsubPayouts?.();
      unsubTargets?.();
    };
  }, [authReady, user]);

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

  return {
    recruits,
    payouts,
    rules,
    performanceTargets,
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
    updateRules,
    savePerformanceTarget,
  };
}
