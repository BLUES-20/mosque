// init-db-pg.js - PostgreSQL/Supabase Schema
const db = require('./config/db');
const bcrypt = require('bcrypt');

const initDatabase = async () => {
  console.log('🔧 Initializing Supabase PostgreSQL...');

  const schemaSQL = `
    -- Users
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username VARCHAR UNIQUE NOT NULL,
      email VARCHAR UNIQUE NOT NULL,
      password VARCHAR NOT NULL,
      role VARCHAR DEFAULT 'student' CHECK (role IN ('student', 'staff', 'admin')),
      reset_password_token VARCHAR,
      reset_password_expires TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Students
    CREATE TABLE IF NOT EXISTS students (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      admission_number VARCHAR UNIQUE NOT NULL,
      first_name VARCHAR NOT NULL,
      last_name VARCHAR NOT NULL,
      email VARCHAR UNIQUE NOT NULL,
      date_of_birth DATE,
      gender VARCHAR CHECK (gender IN ('male', 'female', 'other')),
      class VARCHAR,
      parent_name VARCHAR,
      parent_phone VARCHAR,
      parent_email VARCHAR,
      address TEXT,
      picture VARCHAR,
      payment_status VARCHAR DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Staff
    CREATE TABLE IF NOT EXISTS staff (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      first_name VARCHAR NOT NULL,
      last_name VARCHAR NOT NULL,
      email VARCHAR UNIQUE NOT NULL,
      position VARCHAR NOT NULL,
      department VARCHAR,
      phone VARCHAR,
      hire_date DATE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Results
    CREATE TABLE IF NOT EXISTS results (
      id BIGSERIAL PRIMARY KEY,
      student_id BIGINT REFERENCES students(id) ON DELETE CASCADE,
      subject VARCHAR NOT NULL,
      score NUMERIC(5,2) CHECK (score >= 0 AND score <= 100),
      grade VARCHAR NOT NULL,
      term VARCHAR NOT NULL,
      academic_year VARCHAR NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(student_id, subject, term, academic_year)
    );

    -- Payments
    CREATE TABLE IF NOT EXISTS payments (
      id BIGSERIAL PRIMARY KEY,
      student_id BIGINT REFERENCES students(id) ON DELETE CASCADE,
      tx_ref VARCHAR UNIQUE NOT NULL,
      flw_transaction_id VARCHAR,
      amount NUMERIC(10,2) NOT NULL,
      currency VARCHAR DEFAULT 'NGN',
      payment_type VARCHAR DEFAULT 'registration',
      status VARCHAR DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Contact Messages
    CREATE TABLE IF NOT EXISTS contact_messages (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR NOT NULL,
      email VARCHAR NOT NULL,
      subject VARCHAR NOT NULL,
      message TEXT NOT NULL,
      status VARCHAR DEFAULT 'unread',
      reply_message TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Announcements
    CREATE TABLE IF NOT EXISTS announcements (
      id BIGSERIAL PRIMARY KEY,
      title VARCHAR NOT NULL,
      content TEXT NOT NULL,
      author_id BIGINT REFERENCES users(id),
      priority VARCHAR DEFAULT 'normal',
      status VARCHAR DEFAULT 'published',
      target_audience VARCHAR DEFAULT 'all',
      expiry_date DATE,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Documents
    CREATE TABLE IF NOT EXISTS documents (
      id BIGSERIAL PRIMARY KEY,
      title VARCHAR NOT NULL,
      description TEXT,
      document_type VARCHAR NOT NULL,
      file_path VARCHAR NOT NULL,
      file_name VARCHAR NOT NULL,
      file_size BIGINT,
      target_audience VARCHAR DEFAULT 'all',
      author_id BIGINT REFERENCES users(id),
      uploaded_at TIMESTAMP DEFAULT NOW()
    );
  `;

  try {
    await db.query(schemaSQL);

    await db.query(`
      ALTER TABLE students
      ADD COLUMN IF NOT EXISTS payment_status VARCHAR DEFAULT 'pending'
      CHECK (payment_status IN ('pending', 'paid', 'failed'))
    `);

    await db.query(`
      UPDATE students
      SET payment_status = 'pending'
      WHERE payment_status IS NULL
    `);
    
    // Default admin
    const adminExists = await db.query("SELECT id FROM users WHERE username = 'admin'");
    if (!adminExists.rows.length) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await db.query("INSERT INTO users (username, email, password, role) VALUES ('admin', 'admin@school.com', $1, 'admin')", [hashedPassword]);
      console.log('✅ Admin created (admin/admin123)');
    }
    
    console.log('✅ Supabase tables ready!');
  } catch (err) {
    console.error('❌ Init error:', err.message);
  }
};

module.exports = initDatabase;

