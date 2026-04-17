require('dotenv').config();
const { Pool } = require('pg');

const useDatabaseUrl = typeof process.env.DATABASE_URL === 'string' && process.env.DATABASE_URL.trim() !== '';

const poolConfig = useDatabaseUrl ? {
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
} : {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'school_management',
  ssl: false
};

const pool = new Pool(poolConfig);

pool.connect()
  .then(client => {
    console.log(useDatabaseUrl ? '✅ Supabase PostgreSQL Connected' : '✅ Local PostgreSQL Connected');
    client.release();
  })
  .catch(err => {
    console.error(useDatabaseUrl ? '❌ Supabase connection failed:' : '❌ PostgreSQL connection failed:', err.message);
  });

module.exports = pool;

