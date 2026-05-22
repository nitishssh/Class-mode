# Database Migration Checklist

For the auth and role-system upgrade target, review
[AUTH_DB_UPGRADE_PLAN.md](AUTH_DB_UPGRADE_PLAN.md) before changing production data.

## Pre-Migration

- [ ] **Backup your database**

  ```bash
  # MongoDB backup
  mongodump --uri="$MONGODB_URL" --out=backup-$(date +%Y%m%d)

  # Verify backup
  ls -lh backup-$(date +%Y%m%d)
  ```

- [ ] **Review current database size**

  ```javascript
  // In MongoDB shell
  db.stats();
  db.getSiblingDB("eduai").stats();
  ```

- [ ] **Check current index usage**

  ```javascript
  // For each collection
  db.users.getIndexes();
  db.tests.getIndexes();
  // etc.
  ```

- [ ] **Document current performance baseline**
  - Average query response time
  - Connection pool utilization
  - Database size
  - Active connections

## Migration Steps

### 1. Code Update

- [ ] Pull latest code

  ```bash
  git pull origin main
  ```

- [ ] Install dependencies

  ```bash
  npm install
  ```

- [ ] Review changes
  ```bash
  git log --oneline --since="2026-04-01"
  ```

### 2. Environment Configuration

- [ ] Review `.env.example` for new variables
- [ ] Update your `.env` file if needed
- [ ] Verify MongoDB connection string
- [ ] Verify Cassandra credentials (if using)

### 3. Database Indexes

- [ ] Start the application (indexes will be created automatically)

  ```bash
  npm run dev
  ```

- [ ] Monitor logs for index creation

  ```bash
  tail -f logs/app.log | grep -i "index"
  ```

- [ ] Verify indexes were created
  ```javascript
  // In MongoDB shell
  db.users.getIndexes();
  db.tests.getIndexes();
  db.sessions.getIndexes();
  db.otps.getIndexes();
  // ... check all collections
  ```

### 4. Health Check Verification

- [ ] Test basic health endpoint

  ```bash
  curl http://localhost:5001/api/health
  ```

- [ ] Test detailed health endpoint

  ```bash
  curl http://localhost:5001/api/health/detailed
  ```

- [ ] Verify MongoDB connection status
- [ ] Verify Cassandra connection status (if configured)

### 5. Performance Verification

- [ ] Run a few test queries

  ```bash
  # Example: Get tests for a teacher
  curl -H "Authorization: Bearer $TOKEN" \
    http://localhost:5001/api/tests?teacherId=1
  ```

- [ ] Check query performance in logs

  ```bash
  tail -f logs/app.log | grep -i "query"
  ```

- [ ] Verify no slow query warnings
- [ ] Check connection pool metrics

### 6. TTL Index Verification

- [ ] Create a test session with past expiry

  ```javascript
  // In MongoDB shell
  db.sessions.insertOne({
    id: 999999,
    userId: 1,
    refreshTokenHash: "test",
    expiresAt: new Date(Date.now() - 1000),
  });
  ```

- [ ] Wait 60 seconds
- [ ] Verify session was auto-deleted

  ```javascript
  db.sessions.findOne({ id: 999999 }); // Should return null
  ```

- [ ] Repeat for OTPs collection

## Post-Migration

### Monitoring (First 24 Hours)

- [ ] Monitor application logs for errors

  ```bash
  tail -f logs/app.log | grep -i "error"
  ```

- [ ] Monitor slow queries

  ```bash
  tail -f logs/app.log | grep -i "slow query"
  ```

- [ ] Check database connection stability

  ```bash
  # Check health endpoint every 5 minutes
  watch -n 300 'curl -s http://localhost:5001/api/health | jq'
  ```

- [ ] Monitor database size (should decrease over time due to TTL)
  ```javascript
  // Run daily
  db.stats();
  ```

### Performance Comparison

- [ ] Compare query response times (should be 50-70% faster)
- [ ] Check connection stability (should have fewer disconnects)
- [ ] Verify database size (should be smaller due to TTL cleanup)
- [ ] Monitor memory usage (should be similar or lower)

### Documentation

- [ ] Update internal documentation with new health endpoints
- [ ] Share database documentation with team
- [ ] Update monitoring dashboards (if any)
- [ ] Document any issues encountered

## Rollback Plan (If Needed)

### If Issues Occur

1. **Stop the application**

   ```bash
   # Stop the process
   pkill -f "node.*server"
   ```

2. **Restore from backup**

   ```bash
   # Restore MongoDB
   mongorestore --uri="$MONGODB_URL" --drop backup-YYYYMMDD/
   ```

3. **Revert code changes**

   ```bash
   git checkout <previous-commit-hash>
   npm install
   ```

4. **Restart application**

   ```bash
   npm run dev
   ```

5. **Verify functionality**
   - Test critical user flows
   - Check database connectivity
   - Verify no data loss

### Common Issues & Solutions

#### Issue: Indexes not created

**Solution**:

```javascript
// Manually create indexes in MongoDB shell
db.tests.createIndex({ teacherId: 1, status: 1 });
db.tests.createIndex({ class: 1, status: 1 });
// ... etc
```

#### Issue: TTL indexes not working

**Solution**:

```javascript
// Verify TTL index exists
db.sessions.getIndexes();

// If missing, create manually
db.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

#### Issue: Connection pool exhausted

**Solution**:

- Increase `maxPoolSize` in `server/db.ts`
- Check for connection leaks in application code
- Monitor active connections

#### Issue: Slow queries persist

**Solution**:

- Verify indexes are being used: `db.collection.explain().find(...)`
- Check query patterns in application code
- Consider adding additional indexes

## Success Criteria

Migration is successful when:

- [ ] All indexes are created and active
- [ ] Health endpoints return healthy status
- [ ] Query performance improved by 50%+ on filtered queries
- [ ] No connection stability issues
- [ ] TTL indexes automatically cleaning up expired data
- [ ] No errors in application logs
- [ ] All user-facing features working correctly

## Support

If you encounter issues:

1. Check the logs: `tail -f logs/app.log`
2. Review [docs/DATABASE.md](DATABASE.md) for troubleshooting
3. Check health endpoints for database status
4. Open an issue on GitHub with:
   - Error messages from logs
   - Health endpoint output
   - Steps to reproduce
   - Environment details

---

**Migration Date**: **\*\***\_**\*\***
**Performed By**: **\*\***\_**\*\***
**Status**: ⬜ Pending | ⬜ In Progress | ⬜ Complete | ⬜ Rolled Back
**Notes**:

---

## Auth Upgrade Phases (2026)

See full plan in [AUTH_DB_UPGRADE_PLAN.md](AUTH_DB_UPGRADE_PLAN.md).

### Phase 3 — Persistent Audit Logging ✅

- [x] `MongoAuditEvent` model added to `shared/mongo-schema.ts` (TTL 90 days)
- [x] `server/lib/audit.ts` created with `recordAuditEvent()` and `AUDIT_EVENTS` constants
- [x] Audit calls wired into `/api/auth/firebase`, `/api/auth/register`, `/api/auth/login`, `/api/auth/sync-profile`
- [x] Teacher approval route emits `TEACHER_APPROVED` + missing `setCustomUserClaims` call added
- [x] Invite send/accept/resend routes emit audit events
- [ ] `server/tests/audit_logging.test.ts` — write and run

### Phase 4 — Invite Enforcement ✅

- [x] `IInvite.role` expanded to include `principal`, `school_admin`, `admin`
- [x] `POST /api/auth/register` blocks tenant-admin roles with 400 + audit event
- [x] `POST /api/invite/accept` enforces email match (403 on mismatch)
- [x] `POST /api/invite/accept` now calls `getNextSequenceValue("userId")` — critical bug fixed
- [x] `sendPrincipalInvite`, `sendSchoolAdminInvite` added to `server/lib/mailer.ts`
- [x] `POST /api/invite/staff` route added (school_admin/admin guarded)
- [x] `POST /api/invite/platform-admin` route added (admin only)
- [ ] `server/tests/invite_flow.test.ts` — write and run
- [ ] Update `server/tests/role_logic.test.ts` — add tenant-admin registration tests

### Phase 5 — PostgreSQL Introduction ✅

- [x] `server/db-pg.ts` created (`connectPostgres`, `getPgPool`, `isPgReady`, `withPgClient`)
- [x] `scripts/pg-schema.sql` created (all tables, indexes, role seeds, `IF NOT EXISTS`)
- [x] `scripts/pg-migrate.ts` created — run with `npx tsx scripts/pg-migrate.ts`
- [x] `server/index.ts` calls `connectPostgres()` at startup
- [x] Health endpoints include `postgresql: { connected, available }` field
- [x] `requirePg` middleware added to `server/middleware.ts`
- [ ] Set `POSTGRESQL_URL` in `.env`
- [ ] Run `npx tsx scripts/pg-migrate.ts` against target database
- [ ] `server/tests/pg_connection.test.ts` — write and run

### Phase 6 — Dual-Write ✅

- [x] `server/lib/pg-sync.ts` created (`upsertPgUser`, `upsertPgMembership`, `setPgUserLastLogin`, `setPgMembershipStatus`)
- [x] Firebase registration path calls `upsertPgUser` + `upsertPgMembership` (fire-and-forget)
- [x] Firebase returning-user login calls `setPgUserLastLogin` (fire-and-forget)
- [x] Password registration calls `upsertPgUser` + `upsertPgMembership` (fire-and-forget)
- [x] Invite acceptance calls `upsertPgUser` + `upsertPgMembership` (fire-and-forget)
- [x] Teacher approval calls `setPgMembershipStatus` (fire-and-forget)
- [ ] `server/tests/dual_write.test.ts` — write and run
- [ ] Verify new registrations appear in both MongoDB and PostgreSQL after deploying

### Phase 7 — Backfill ⬜

- [x] `scripts/pg-backfill-users.ts` created (batched cursor, idempotent, reconciliation report)
- [ ] Run `npx tsx scripts/pg-backfill-users.ts`
- [ ] Confirm delta = 0 in backfill output
- [ ] Record: Backfill date **\_\_\_\_** / Performed by **\_\_\_\_** / Delta **\_\_\_\_**

### Phase 8 — Migrate Auth Lookups to PostgreSQL ✅

- [x] `pgFindUserByAuthSubject` and `pgFindUserByEmail` implemented in `server/lib/pg-sync.ts`
- [x] `POST /api/auth/firebase` now uses PG-first lookup with MongoDB fallback
- [ ] Monitor `[auth/firebase] PG miss` log hits after Phase 7 backfill
- [ ] Confirm fallback rate = 0% in logs
- [ ] Remove MongoDB fallback block from `/api/auth/firebase` after confirmed 0%

---

---

---
