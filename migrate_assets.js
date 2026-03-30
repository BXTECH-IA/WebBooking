const pool = require('./database');

async function migrate() {
    console.log('--- Iniciando Migração: merchant_assets ---');
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS merchant_assets (
                id SERIAL PRIMARY KEY,
                merchant_id INTEGER REFERENCES merchants(id) ON DELETE CASCADE,
                asset_key VARCHAR(50) NOT NULL,
                file_type VARCHAR(100),
                file_data TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(merchant_id, asset_key)
            );
        `);
        console.log('✅ Tabela merchant_assets pronta.');
    } catch (err) {
        console.error('❌ Erro na migração:', err);
    } finally {
        process.exit();
    }
}

migrate();
