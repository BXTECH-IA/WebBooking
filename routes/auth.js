const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../database');

// Registrar um novo comerciante (auxiliar para configuração inicial)
router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Nome de usuário e senha são obrigatórios' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO merchants (username, password_hash) VALUES ($1, $2) RETURNING id, username',
            [username, hashedPassword]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        if (err.code === '23505') { // Violação de exclusividade
            return res.status(409).json({ error: 'Nome de usuário já existe' });
        }
        res.status(500).json({ error: 'Erro no servidor: ' + err.message });
    }
});

// Efetuar login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM merchants WHERE username = $1', [username]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const merchant = result.rows[0];
        const match = await bcrypt.compare(password, merchant.password_hash);

        if (!match) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        // Em uma app real, gerar JWT aqui. Por simplicidade/MVP, retornamos o ID do comerciante.
        res.json({ message: 'Login realizado com sucesso', merchantId: merchant.id, username: merchant.username });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro no servidor: ' + err.message });
    }
});

module.exports = router;
