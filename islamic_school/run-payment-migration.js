const db = require('./config/db'); // Use PostgreSQL/Supabase

async function runMigration() {
  try {
    // Add column if not exists
    await db.query(`
      ALTER TABLE students ADD COLUMN payment_status TEXT DEFAULT 'pending'
    `);

    // Update existing to pending
    await db.query(`
      UPDATE students SET payment_status = 'pending' WHERE payment_status IS NULL
    `);

    // Verify
    const res = await db.query('SELECT payment_status, COUNT(*) FROM students GROUP BY payment_status');
    console.log('✅ Migration complete:', res.rows);
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  }
}

runMigration();

