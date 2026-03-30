const pool = require('./database');
const bcrypt = require('bcryptjs');

async function insertUser() {
    try {
        const hashedPassword = await bcrypt.hash('admin', 10);
        await pool.query(
            'INSERT INTO merchants (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING',
            ['admin', hashedPassword]
        );
        console.log('User admin/admin created successfully.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
insertUser();
