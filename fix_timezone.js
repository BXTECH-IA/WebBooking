const pool = require('./database');

async function fixTimezone() {
    try {
        await pool.query(`ALTER TABLE appointments ALTER COLUMN start_time TYPE TIMESTAMPTZ USING start_time AT TIME ZONE 'UTC', ALTER COLUMN end_time TYPE TIMESTAMPTZ USING end_time AT TIME ZONE 'UTC';`);
        await pool.query(`ALTER TABLE blocked_slots ALTER COLUMN start_time TYPE TIMESTAMPTZ USING start_time AT TIME ZONE 'UTC', ALTER COLUMN end_time TYPE TIMESTAMPTZ USING end_time AT TIME ZONE 'UTC';`);
        console.log('Database altered successfully to TIMESTAMPTZ');
        process.exit(0);
    } catch (err) {
        console.error('Error altering database:', err);
        process.exit(1);
    }
}

fixTimezone();
