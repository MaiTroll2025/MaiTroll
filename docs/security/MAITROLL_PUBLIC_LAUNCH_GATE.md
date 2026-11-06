# MaiTroll Public Launch Gate

**Decision: BLOCKED — do not recommend unrestricted public launch.**

## Open blockers

- Staging branch metadata is healthy, but staging schema/migration health, test identities, and external-service isolation remain unverified.
- Production and local migration histories are not reconciled (47 production rows versus 340 local migration files).
- The financial RPC migration is local only; it has not been parsed against the target database, applied, or tested.
- Client balance paths were temporarily restricted to prevent untrusted credits and partial payments. Secure server-side replacements and regression verification are required before re-enabling those features.
- The deployed Edge Function list contains 102 active functions; 68 report `verify_jwt=false`. This metadata alone neither proves a vulnerability nor proves handler-level protection. The 102 handlers have not all been reviewed.
- Production backup, monitoring/alerts, and recovery procedures have not been verified.

## Required approval checkpoints

1. Confirm production and staging identities, staging isolation, and the complete migration-history diff.
2. Review the migration and endpoint changes against staging function definitions and grants.
3. Pass role-specific financial, authorization, replay, concurrency, and functional regression tests in staging.
4. Review compatibility impacts and replace temporary feature restrictions with tested server workflows.
5. Review monitoring and recovery steps that do not restore unsafe grants.
6. Obtain explicit owner approval before any production deployment.

No production migration, Edge Function deployment, payout, balance change, push notification, or other production mutation was performed in this task.
