const express = require('express');
const router = express.Router();
const pool = require('../database');
const { triggerWebhook } = require('../services/webhookService');

// Obter agendamentos (filtrar por comerciante, data_início, data_fim)
router.get('/', async (req, res) => {
    const { merchantId, start, end } = req.query;

    if (!merchantId) {
        return res.status(400).json({ error: 'ID do comerciante é obrigatório' });
    }

    try {
        let query = "SELECT a.*, s.name as service_name FROM appointments a LEFT JOIN services s ON a.service_id = s.id WHERE a.merchant_id = $1 AND a.status != 'cancelled'";
        const params = [merchantId];
        let paramCount = 1;

        if (start) {
            paramCount++;
            query += ` AND a.start_time >= $${paramCount}`;
            params.push(start);
        }
        if (end) {
            paramCount++;
            query += ` AND a.end_time <= $${paramCount}`;
            params.push(end);
        }

        query += ' ORDER BY a.start_time ASC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// Criar agendamento
router.post('/', async (req, res) => {
    const { merchantId, client_name, client_phone, service_id, start_time, end_time } = req.body;

    if (!merchantId || !client_name || !client_phone || !start_time || !end_time) {
        return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
    }

    try {
        // Verificar conflitos (verificação simples)
        const conflict = await pool.query(
            `SELECT * FROM appointments 
       WHERE merchant_id = $1 
       AND status != 'cancelled'
       AND (
         (start_time < $3 AND end_time > $2)
       )`,
            [merchantId, start_time, end_time]
        );

        if (conflict.rows.length > 0) {
            return res.status(409).json({ error: 'Horário não disponível' });
        }

        // Upsert no perfil do cliente para garantir que os dados permaneçam mesmo após exclusão do agendamento
        await pool.query(
          `INSERT INTO client_profiles (merchant_id, name, phone)
           VALUES ($1, $2, $3)
           ON CONFLICT (merchant_id, phone) 
           DO UPDATE SET name = EXCLUDED.name`,
          [merchantId, client_name, client_phone]
        );

        const result = await pool.query(
            `INSERT INTO appointments (merchant_id, client_name, client_phone, service_id, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
            [merchantId, client_name, client_phone, service_id || null, start_time, end_time]
        );

        const appointment = result.rows[0];

        // Buscar configurações do comerciante para webhook
        const merchantRes = await pool.query('SELECT settings FROM merchants WHERE id = $1', [merchantId]);
        const merchantSettings = merchantRes.rows[0]?.settings;

        // Disparar Webhook
        triggerWebhook('appointment_created', appointment, merchantSettings);

        res.status(201).json(appointment);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// Atualizar agendamento
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { start_time, end_time, status, service_id } = req.body;

    try {
        // Obter existente para verificar comerciante
        const existing = await pool.query('SELECT * FROM appointments WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Agendamento não encontrado' });
        }
        const oldAppt = existing.rows[0];

        // Construir consulta de atualização dinamicamente
        let updates = [];
        let params = [id];
        let paramCount = 1;

        if (start_time) { paramCount++; updates.push(`start_time = $${paramCount}`); params.push(start_time); }
        if (end_time) { paramCount++; updates.push(`end_time = $${paramCount}`); params.push(end_time); }
        if (status) { paramCount++; updates.push(`status = $${paramCount}`); params.push(status); }
        if (service_id !== undefined) { paramCount++; updates.push(`service_id = $${paramCount}`); params.push(service_id || null); }

        if (updates.length === 0) return res.json(oldAppt);

        const result = await pool.query(
            `UPDATE appointments SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
            params
        );

        const updatedAppt = result.rows[0];

        // Buscar configurações do comerciante
        const merchantRes = await pool.query('SELECT settings FROM merchants WHERE id = $1', [updatedAppt.merchant_id]);
        const merchantSettings = merchantRes.rows[0]?.settings;

        triggerWebhook('appointment_updated', updatedAppt, merchantSettings);

        res.json(updatedAppt);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// Deletar agendamento (Exclusão Física)
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Primeiro buscamos para ter os dados para o webhook antes de deletar
        const check = await pool.query('SELECT * FROM appointments WHERE id = $1', [id]);
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Agendamento não encontrado' });
        }
        const apptToDelete = check.rows[0];

        // Exclusão física do banco de dados
        await pool.query('DELETE FROM appointments WHERE id = $1', [id]);

        // Buscar configurações do comerciante para o webhook
        const merchantRes = await pool.query('SELECT settings FROM merchants WHERE id = $1', [apptToDelete.merchant_id]);
        const merchantSettings = merchantRes.rows[0]?.settings;

        // Disparar Webhook de cancelamento/exclusão
        triggerWebhook('appointment_cancelled', apptToDelete, merchantSettings);

        res.json({ message: 'Agendamento excluído permanentemente do banco de dados' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// Criar Plano Fixo de 4 semanas
router.post('/fixed-plan', async (req, res) => {
    const { merchantId, client_name, client_phone, service_id, start_time, end_time } = req.body;

    if (!merchantId || !client_name || !client_phone || !start_time || !end_time) {
        return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
    }

    try {
        const durationMs = new Date(end_time).getTime() - new Date(start_time).getTime();
        const appointments = [];

        for (let i = 0; i < 4; i++) {
            const currentStart = new Date(start_time);
            currentStart.setDate(currentStart.getDate() + (i * 7));

            const currentEnd = new Date(currentStart.getTime() + durationMs);
            const isRenewal = (i === 3); // A 4ª semana é a renovação

            const conflict = await pool.query(
                `SELECT * FROM appointments 
           WHERE merchant_id = $1 
           AND status != 'cancelled'
           AND (
             (start_time < $3 AND end_time > $2)
           )`,
                [merchantId, currentStart.toISOString(), currentEnd.toISOString()]
            );

            if (conflict.rows.length > 0) {
                return res.status(409).json({ error: `Conflito detectado na semana ${i + 1} (${currentStart.toLocaleDateString('pt-BR')})` });
            }

            const result = await pool.query(
                `INSERT INTO appointments (merchant_id, client_name, client_phone, service_id, start_time, end_time, is_plan_renewal)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
                [merchantId, client_name, client_phone, service_id || null, currentStart.toISOString(), currentEnd.toISOString(), isRenewal]
            );

            appointments.push(result.rows[0]);
        }

        res.status(201).json({ message: 'Plano Fixo de 4 semanas criado com sucesso!', appointments });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro no servidor ao criar plano fixo' });
    }
});

// Buscar agendamento ativo por cliente (para reagendamento/cancelamento)
router.post('/find-active', async (req, res) => {
    const { merchantId, client_name, client_phone } = req.body;

    if (!merchantId || !client_name || !client_phone) {
        return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
    }

    try {
        // Busca o agendamento futuro mais próximo que não esteja cancelado
        const result = await pool.query(
            `SELECT a.*, s.name as service_name 
             FROM appointments a 
             LEFT JOIN services s ON a.service_id = s.id 
             WHERE a.merchant_id = $1 
             AND LOWER(a.client_name) = LOWER($2) 
             AND a.client_phone = $3 
             AND a.status = 'scheduled' 
             AND a.start_time > NOW() 
             ORDER BY a.start_time ASC 
             LIMIT 1`,
            [merchantId, client_name, client_phone]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Nenhum agendamento futuro encontrado para este nome e telefone' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar agendamento' });
    }
});

// Cancelar agendamento (pelo cliente)
router.post('/cancel-client', async (req, res) => {
    const { appointmentId } = req.body;

    if (!appointmentId) {
        return res.status(400).json({ error: 'ID do agendamento é obrigatório' });
    }

    try {
        const result = await pool.query(
            "UPDATE appointments SET status = 'cancelled', cancellation_reason = 'Cancelado Pelo Cliente' WHERE id = $1 RETURNING *",
            [appointmentId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Agendamento não encontrado' });
        }

        const cancelledAppt = result.rows[0];

        // Buscar configurações do comerciante
        const merchantRes = await pool.query('SELECT settings FROM merchants WHERE id = $1', [cancelledAppt.merchant_id]);
        const merchantSettings = merchantRes.rows[0]?.settings;

        triggerWebhook('appointment_cancelled', cancelledAppt, merchantSettings);

        res.json({ message: 'Agendamento cancelado com sucesso', appointment: cancelledAppt });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao cancelar agendamento' });
    }
});

module.exports = router;
