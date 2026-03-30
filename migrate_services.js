const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    try {
        await pool.query('ALTER TABLE appointments ADD COLUMN service_id INTEGER REFERENCES services(id);');
        console.log("Added service_id column.");
    } catch (e) { console.log("service_id error:", e.message); }

    try {
        await pool.query('ALTER TABLE appointments ADD COLUMN is_plan_renewal BOOLEAN DEFAULT false;');
        console.log("Added is_plan_renewal column.");
    } catch (e) { console.log("is_plan_renewal error:", e.message); }

    process.exit(0);
}

migrate();
