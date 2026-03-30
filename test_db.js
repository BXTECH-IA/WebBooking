const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Connection error', err.message);
        process.exit(1);
    } else {
        console.log('Connection successful:', res.rows[0]);
        process.exit(0);
    }
});
