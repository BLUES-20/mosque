// config/supabase.js - Database Configuration
// For development, using SQLite. For production, use PostgreSQL/Supabase

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Use SQLite for development
const dbPath = path.join(__dirname, '..', 'database.sqlite');
const sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ SQLite connection failed:', err.message);
    } else {
        console.log('✅ SQLite Connected Successfully');
        console.log(`   Database: ${dbPath}`);
    }
});

// Enable foreign keys
sqliteDb.run('PRAGMA foreign_keys = ON');

// Create a PostgreSQL-compatible interface
const db = {
    query: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            // Replace PostgreSQL placeholders ($1, $2) with SQLite placeholders (?)
            let sqliteSql = sql;
            const sqliteParams = [];

            // Simple replacement for $1, $2, etc.
            let paramIndex = 1;
            while (sqliteSql.includes(`$${paramIndex}`)) {
                sqliteSql = sqliteSql.replace(`$${paramIndex}`, '?');
                if (params[paramIndex - 1] !== undefined) {
                    sqliteParams.push(params[paramIndex - 1]);
                }
                paramIndex++;
            }

            // For SELECT queries, use all()
            if (sqliteSql.trim().toUpperCase().startsWith('SELECT')) {
                sqliteDb.all(sqliteSql, sqliteParams, (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ rows });
                    }
                });
            } else {
                // For all other queries (INSERT, UPDATE, DELETE, CREATE, etc.), use run()
                sqliteDb.run(sqliteSql, sqliteParams, function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        // Return PostgreSQL-like result
                        resolve({ rows: [], lastID: this.lastID, changes: this.changes });
                    }
                });
            }
        });
    }
};

// Export the database instance
module.exports = db;
