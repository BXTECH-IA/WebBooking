const pool = require('./database');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
    try {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('Running schema setup...');
        await pool.query(schemaSql);
        console.log('Database schema initialized successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error setting up database:', err);
        process.exit(1);
    }
}

setupDatabase();
