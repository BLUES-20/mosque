// init-db.js - Initialize PostgreSQL/Supabase tables
const db = require('./config/db'); // PostgreSQL
const bcrypt = require('bcrypt');

const initDatabase = async () => {
console.log('🔧 Initializing Supabase database...');

    try {
        // Create Users table
        await db.query(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'student' CHECK (role IN ('student', 'staff', 'admin')),
            reset_password_token TEXT,
            reset_password_expires DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Create Students table
        await db.query(`CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            admission_number TEXT UNIQUE NOT NULL,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            date_of_birth DATE,
            gender TEXT CHECK (gender IN ('male', 'female', 'other')),
            class TEXT,
            parent_name TEXT,
            parent_phone TEXT,
            parent_email TEXT,
            address TEXT,
            picture TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Create Staff table
        await db.query(`CREATE TABLE IF NOT EXISTS staff (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            position TEXT NOT NULL,
            department TEXT,
            phone TEXT,
            hire_date DATE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Create Sessions table
        await db.query(`CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            session_token TEXT UNIQUE NOT NULL,
            expires_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Create Results table
        await db.query(`CREATE TABLE IF NOT EXISTS results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
            subject TEXT NOT NULL,
            score DECIMAL(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
            grade TEXT NOT NULL,
            term TEXT NOT NULL,
            academic_year TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(student_id, subject, term, academic_year)
        )`);

        // Create Contact Messages table
        await db.query(`CREATE TABLE IF NOT EXISTS contact_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            subject TEXT NOT NULL,
            message TEXT NOT NULL,
            status TEXT DEFAULT 'unread',
            replied_at DATETIME,
            reply_message TEXT,
            staff_reply_id INTEGER REFERENCES staff(id),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Create Announcements table
        await db.query(`CREATE TABLE IF NOT EXISTS announcements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            author_id INTEGER REFERENCES users(id),
            priority TEXT DEFAULT 'normal',
            status TEXT DEFAULT 'published',
            target_audience TEXT DEFAULT 'all',
            expiry_date DATE,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Create Documents table
        await db.query(`CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            document_type TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_size INTEGER,
            target_audience TEXT DEFAULT 'all',
            author_id INTEGER REFERENCES users(id),
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Create Payments table
        await db.query(`CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
            tx_ref TEXT UNIQUE NOT NULL,
            flw_transaction_id TEXT,
            amount DECIMAL(10,2) NOT NULL,
            currency TEXT DEFAULT 'NGN',
            payment_type TEXT DEFAULT 'registration',
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Insert default admin user if not exists
        const adminExists = await db.query("SELECT id FROM users WHERE username = 'admin'");
        if (adminExists.rows.length === 0) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await db.query(`INSERT INTO users (username, email, password, role) VALUES ('admin', 'admin@school.com', ?, 'admin')`, [hashedPassword]);
            console.log('✅ Default admin user created (username: admin, password: admin123)');
        } else {
            console.log('✅ Admin user already exists');
        }

        console.log('✅ Database tables initialized successfully!');
    } catch (err) {
        console.error('❌ Database initialization error:', err.message);
        throw err;
    }
};

module.exports = initDatabase;
