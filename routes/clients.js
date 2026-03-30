const express = require('express');
const router = express.Router();
const pool = require('../database');

// GET /api/clients?merchantId=...
router.get('/', async (req, res) => {
    const { merchantId } = req.query;

    if (!merchantId) {
        return res.status(400).json({ error: 'ID do comerciante é obrigatório' });
    }

    try {
        const query = `
            SELECT 
                a.client_name, 
                a.client_phone, 
                COUNT(*) as total_appointments, 
                MAX(a.start_time) as last_appointment,
                MAX(cp.email) as client_email,
                MAX(cp.birthday) as client_birthday
            FROM appointments a
            LEFT JOIN client_profiles cp ON cp.merchant_id = a.merchant_id AND cp.phone = a.client_phone
            WHERE a.merchant_id = $1
            GROUP BY a.client_name, a.client_phone
            ORDER BY last_appointment DESC
        `;

        const result = await pool.query(query, [merchantId]);
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar clientes:', err);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// PUT /api/clients/:phone (Salvar Perfil: Telefone, Email e Aniversário)
router.put('/:phone', async (req, res) => {
    const { phone } = req.params;
    const { merchantId, email, birthday, newPhone } = req.body;

    if (!merchantId) {
        return res.status(400).json({ error: 'ID do comerciante é obrigatório' });
    }

    const targetPhone = newPhone || phone;

    try {
        await pool.query('BEGIN'); // Transação para manter sincronia

        // Atualizar perfil ou inserir
        const profileQuery = `
            INSERT INTO client_profiles (merchant_id, phone, email, birthday)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (merchant_id, phone) 
            DO UPDATE SET email = EXCLUDED.email, birthday = EXCLUDED.birthday
        `;
        await pool.query(profileQuery, [merchantId, phone, email || null, birthday ? birthday : null]);

        // Se trocou de telefone, precisamos cascatear a atualização em tudo
        if (newPhone && newPhone !== phone) {
            // Atualiza a primary key em client_profiles transferindo
            await pool.query('UPDATE client_profiles SET phone = $1 WHERE merchant_id = $2 AND phone = $3', [newPhone, merchantId, phone]);
            // Atualiza os agendamentos antigos para manter o vínculo
            await pool.query('UPDATE appointments SET client_phone = $1 WHERE merchant_id = $2 AND client_phone = $3', [newPhone, merchantId, phone]);
        }

        await pool.query('COMMIT');
        res.json({ success: true, newPhone: targetPhone });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('Erro ao salvar perfil do cliente:', err);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

module.exports = router;
