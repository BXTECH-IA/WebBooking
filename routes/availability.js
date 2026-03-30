const express = require('express');
const router = express.Router();
const pool = require('../database');

// Obter disponibilidade de um comerciante
router.get('/:merchantId', async (req, res) => {
    const { merchantId } = req.params;
    try {
        const weekly = await pool.query('SELECT * FROM weekly_availability WHERE merchant_id = $1', [merchantId]);
        const blocked = await pool.query('SELECT * FROM blocked_slots WHERE merchant_id = $1', [merchantId]);
        res.json({ weekly: weekly.rows, blocked: blocked.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// Atualizar disponibilidade semanal
router.post('/:merchantId/weekly', async (req, res) => {
    const { merchantId } = req.params;
    const { day_of_week, start_time, end_time, is_active } = req.body;

    try {
        const result = await pool.query(
            `INSERT INTO weekly_availability (merchant_id, day_of_week, start_time, end_time, is_active)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (merchant_id, day_of_week)
       DO UPDATE SET start_time = $3, end_time = $4, is_active = $5
       RETURNING *`,
            [merchantId, day_of_week, start_time, end_time, is_active]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// Bloquear um horário ou dia
router.post('/:merchantId/block', async (req, res) => {
    const { merchantId } = req.params;
    const { start_time, end_time, type } = req.body; // tipo: 'slot' ou 'day'

    try {
        // Verificar se há agendamentos conflitantes no período selecionado
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
            return res.status(409).json({ error: 'Erro: Este horário já possui um agendamento.' });
        }

        const result = await pool.query(
            'INSERT INTO blocked_slots (merchant_id, start_time, end_time, type) VALUES ($1, $2, $3, $4) RETURNING *',
            [merchantId, start_time, end_time, type]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// Desbloquear
router.delete('/block/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM blocked_slots WHERE id = $1', [id]);
        res.json({ message: 'Bloqueio removido' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

module.exports = router;
