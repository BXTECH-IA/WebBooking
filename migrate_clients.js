const pool = require('./database');

async function migrate() {
    try {
        console.log('--- Iniciando Migração de Clientes ---');
        
        // 1. Adicionar coluna 'name' se não existir
        console.log('Passo 1: Adicionando coluna "name" à tabela client_profiles...');
        await pool.query('ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS name VARCHAR(255)');
        
        // 2. Popular client_profiles a partir de appointments existentes
        console.log('Passo 2: Populando client_profiles a partir dos agendamentos existentes...');
        const query = `
            INSERT INTO client_profiles (merchant_id, phone, name)
            SELECT DISTINCT merchant_id, client_phone, client_name 
            FROM appointments
            ON CONFLICT (merchant_id, phone) 
            DO UPDATE SET name = EXCLUDED.name WHERE client_profiles.name IS NULL OR client_profiles.name = ''
        `;
        const result = await pool.query(query);
        console.log(`Sucesso! ${result.rowCount} perfis de clientes processados.`);
        
        console.log('--- Migração Concluída com Sucesso ---');
    } catch (err) {
        console.error('ERRO NA MIGRAÇÃO:', err);
    } finally {
        await pool.end();
    }
}

migrate();
