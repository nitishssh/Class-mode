import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/eduai',
  connectionTimeoutMillis: 5000
});

try {
  await pool.query(`
    ALTER TABLE otps 
    ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0
  `);
  console.log('✅ Added "attempts" column to otps table successfully!');
  
  // Verify
  const res = await pool.query(
    "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='otps' ORDER BY ordinal_position"
  );
  console.log('Updated OTPs table columns:');
  res.rows.forEach(row => console.log(' -', row.column_name, ':', row.data_type, row.column_default ? `(default: ${row.column_default})` : ''));
} catch (e) {
  console.error('❌ Error:', e.message);
} finally {
  await pool.end();
}
