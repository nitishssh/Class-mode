# Database Migration Checklist

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

**Migration Date**: ******\_******
**Performed By**: ******\_******
**Status**: ⬜ Pending | ⬜ In Progress | ⬜ Complete | ⬜ Rolled Back
**Notes**:

---

---

---
