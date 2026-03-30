const express = require('express');
const router = express.Router();
const pool = require('../database');

// GET /api/finance?merchantId=...&start=...&end=...
router.get('/', async (req, res) => {
    const { merchantId, start, end } = req.query;

    if (!merchantId || !start || !end) {
        return res.status(400).json({ error: 'Parâmetros merchantId, start e end são obrigatórios' });
    }

    try {
        const query = `
            SELECT 
                DATE(a.start_time) as date,
                SUM(s.price) as total_revenue,
                COUNT(a.id) as total_appointments
            FROM appointments a
            LEFT JOIN services s ON a.service_id = s.id
            WHERE a.merchant_id = $1 
              AND a.status ILIKE 'conclu%do'
              AND a.start_time >= $2
            GROUP BY DATE(a.start_time)
            ORDER BY DATE(a.start_time) ASC
        `;

        const result = await pool.query(query, [merchantId, start]);
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar dados financeiros:', err);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

module.exports = router;
