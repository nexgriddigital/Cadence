# Firestore Security Specification (`proj-1001`)

## 1. Data Invariants
1. **Strict Workspace Ownership**: Every document under `/users/{userId}` and its subcollections (`settings`, `recruits`, `payouts`, `performanceTargets`) belongs strictly to the verified authenticated user whose `request.auth.uid == userId` and `request.auth.token.email_verified == true`.
2. **Referential Integrity**: Both `PayoutRecord` (`/users/{userId}/payouts/{payoutId}`) and `PerformanceTarget` (`/users/{userId}/performanceTargets/{targetId}`) require that the parent workspace `/users/{userId}` and the referenced `/users/{userId}/recruits/{recruitId}` exist.
3. **Immutable Ownership & Creation Timestamps**: `uid` / `ownerId` / `recruitId` and `createdAt` can never be altered on update, and all `createdAt` / `updatedAt` timestamps must match `request.time`.
4. **Strict Field Allowlists & Type/Length Guards**: Every `create` verifies both `hasAll` and `hasOnly`; every `update` runs `isValid[Entity](incoming())` and `affectedKeys().hasOnly(...)` per action, constraining `monthlyPayGoal` (`0..10000000`) and `multiplierFactor` (`1..5`).

## 2. Adversarial Test Payloads ("Dirty Dozen")
1. **Unauthenticated read** on `/users/{uid}/payouts/{id}` -> `PERMISSION_DENIED`
2. **Unverified email write** (`email_verified: false`) on `/users/{uid}/recruits/{id}` -> `PERMISSION_DENIED`
3. **Cross-tenant read** (`auth.uid != userId`) on `/users/{otherUid}/recruits/{id}` -> `PERMISSION_DENIED`
4. **Cross-tenant list** (`auth.uid != userId`) on `/users/{otherUid}/payouts` -> `PERMISSION_DENIED`
5. **Identity spoofing on create** (`ownerId: "other-uid"`) -> `PERMISSION_DENIED`
6. **Orphaned payout creation** (`recruitId: "non-existent-id"`) -> `PERMISSION_DENIED`
7. **Shadow / ghost field injection** (`{ ...validRecruit, isAdmin: true }`) -> `PERMISSION_DENIED`
8. **ID poisoning** (document ID > 128 chars or containing invalid characters `$`) -> `PERMISSION_DENIED`
9. **Client-forged timestamp** (`createdAt: "2020-01-01T00:00:00Z"` instead of `request.time`) -> `PERMISSION_DENIED`
10. **Immutable field mutation** (updating `ownerId` or `createdAt` on an existing payout) -> `PERMISSION_DENIED`
11. **Oversized string / Denial of Wallet** (`notes` > 500 chars or `name` > 120 chars) -> `PERMISSION_DENIED`
12. **Invalid enum / negative financial value** (`grossEmployeePay: -500` or `status: "Hack"`) -> `PERMISSION_DENIED`
