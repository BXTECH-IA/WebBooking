const express = require('express');
const router = express.Router();
const pool = require('../database');

// Obter todos os serviços de um comerciante
router.get('/:merchantId', async (req, res) => {
    const { merchantId } = req.params;
    try {
        const result = await pool.query(
            'SELECT * FROM services WHERE merchant_id = $1 ORDER BY name',
            [merchantId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// Criar um novo serviço
router.post('/', async (req, res) => {
    const { merchant_id, name, duration, price } = req.body;

    // Validação básica
    if (!merchant_id) return res.status(400).json({ error: 'merchant_id é obrigatório' });
    if (!name || typeof name !== 'string' || name.trim().length === 0) return res.status(400).json({ error: 'Nome do serviço é obrigatório' });
    const dur = parseInt(duration, 10);
    const pr = parseFloat(price);
    if (isNaN(dur) || dur < 5) return res.status(400).json({ error: 'Duração inválida (min 5 minutos)' });
    if (isNaN(pr) || pr <= 0) return res.status(400).json({ error: 'Preço inválido' });

    try {
        const result = await pool.query(
            'INSERT INTO services (merchant_id, name, duration, price) VALUES ($1, $2, $3, $4) RETURNING *',
            [merchant_id, name.trim(), dur, pr]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// Atualizar um serviço
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { name, duration, price } = req.body;

    // Validação básica
    if (!name || typeof name !== 'string' || name.trim().length === 0) return res.status(400).json({ error: 'Nome do serviço é obrigatório' });
    const dur = parseInt(duration, 10);
    const pr = parseFloat(price);
    if (isNaN(dur) || dur < 5) return res.status(400).json({ error: 'Duração inválida (min 5 minutos)' });
    if (isNaN(pr) || pr <= 0) return res.status(400).json({ error: 'Preço inválido' });

    try {
        const result = await pool.query(
            'UPDATE services SET name = $1, duration = $2, price = $3 WHERE id = $4 RETURNING *',
            [name.trim(), dur, pr, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// Deletar um serviço
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Desvincula o serviço de agendamentos existentes antes de deletar
        await pool.query('UPDATE appointments SET service_id = NULL WHERE service_id = $1', [id]);
        await pool.query('DELETE FROM services WHERE id = $1', [id]);
        res.json({ message: 'Serviço deletado' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao deletar serviço: ' + err.message });
    }
});

module.exports = router;
