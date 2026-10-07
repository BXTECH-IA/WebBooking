const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../database');
const { generateToken, authenticateUser } = require('../services/authService');

// Função auxiliar para obter o comerciante master (ou admin se master não existir)
async function getMasterMerchant() {
    try {
        const masterRes = await pool.query(
            "SELECT id, username, settings FROM merchants WHERE LOWER(username) = 'master' LIMIT 1"
        );
        if (masterRes.rows.length > 0) return masterRes.rows[0];
        const adminRes = await pool.query(
            "SELECT id, username, settings FROM merchants WHERE LOWER(username) = 'admin' LIMIT 1"
        );
        return adminRes.rows[0] || null;
    } catch (err) {
        console.error('Erro ao buscar master merchant:', err);
        return null;
    }
}

// Registrar um novo comerciante (auxiliar para configuração inicial)
router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Nome de usuário e senha são obrigatórios' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO merchants (username, password_hash, theme) VALUES ($1, $2, $3) RETURNING id, username, theme',
            [username, hashedPassword, 'clean']
        );
        const merchant = result.rows[0];

        // Se o novo comerciante não for o master, definir o logo do master como padrão
        try {
            const master = await getMasterMerchant();
            if (master && master.id !== merchant.id) {
                // 1. Copiar asset de logo da tabela merchant_assets
                const masterAssetRes = await pool.query(
                    "SELECT file_data, file_type FROM merchant_assets WHERE merchant_id = $1 AND asset_key = 'logo'",
                    [master.id]
                );
                if (masterAssetRes.rows.length > 0) {
                    const { file_data, file_type } = masterAssetRes.rows[0];
                    await pool.query(
                        `INSERT INTO merchant_assets (merchant_id, asset_key, file_data, file_type, updated_at)
                         VALUES ($1, 'logo', $2, $3, CURRENT_TIMESTAMP)
                         ON CONFLICT (merchant_id, asset_key) DO UPDATE
                         SET file_data = EXCLUDED.file_data, file_type = EXCLUDED.file_type, updated_at = CURRENT_TIMESTAMP`,
                        [merchant.id, file_data, file_type]
                    );
                }

                // 2. Copiar avatar de settings se existir
                const masterAvatar = master.settings && master.settings.avatar;
                if (masterAvatar) {
                    await pool.query(
                        `UPDATE merchants 
                         SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{avatar}', to_jsonb($1::text)) 
                         WHERE id = $2`,
                        [masterAvatar, merchant.id]
                    );
                }
            }
        } catch (copyErr) {
            console.error('Erro ao replicar logo do master para novo comerciante:', copyErr);
        }

        const token = generateToken({ userId: merchant.id, username: merchant.username });
        res.status(201).json({
            id: merchant.id,
            username: merchant.username,
            theme: merchant.theme || 'clean',
            token
        });
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

        const token = generateToken({ userId: merchant.id, username: merchant.username });
        const theme = merchant.theme || 'clean';

        res.json({
            message: 'Login realizado com sucesso',
            merchantId: merchant.id,
            username: merchant.username,
            theme,
            token
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro no servidor: ' + err.message });
    }
});

// Obter dados do usuário autenticado
router.get('/me', authenticateUser, async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    try {
        const result = await pool.query('SELECT id, username, theme, settings FROM merchants WHERE id = $1', [req.user.userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        const user = result.rows[0];
        const userSettings = user.settings || {};

        if (!userSettings.avatar && user.username && user.username.toLowerCase() !== 'master') {
            const master = await getMasterMerchant();
            if (master && master.settings && master.settings.avatar) {
                userSettings.avatar = master.settings.avatar;
            }
        }

        res.json({
            merchantId: user.id,
            username: user.username,
            theme: user.theme || 'clean',
            settings: userSettings
        });
    } catch (err) {
        console.error('Erro ao buscar perfil:', err);
        res.status(500).json({ error: 'Erro no servidor: ' + err.message });
    }
});

// Obter tema do usuário autenticado
router.get('/theme', authenticateUser, async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    try {
        const result = await pool.query('SELECT theme FROM merchants WHERE id = $1', [req.user.userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        const theme = result.rows[0].theme || 'clean';
        res.json({ theme });
    } catch (err) {
        console.error('Erro ao buscar tema:', err);
        res.status(500).json({ error: 'Erro no servidor: ' + err.message });
    }
});

// Atualizar tema do usuário autenticado (SEMPRE usa req.user.userId do token)
const saveThemeHandler = async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    const { theme } = req.body;

    // Validação estrita: aceita apenas "clean" ou "dark"
    if (!theme || (theme !== 'clean' && theme !== 'dark')) {
        return res.status(400).json({ error: 'Tema inválido. Valores permitidos: "clean" ou "dark".' });
    }

    try {
        const result = await pool.query(
            'UPDATE merchants SET theme = $1 WHERE id = $2 RETURNING id, username, theme',
            [theme, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        res.json({
            message: 'Tema atualizado com sucesso',
            theme: result.rows[0].theme
        });
    } catch (err) {
        console.error('Erro ao salvar tema:', err);
        res.status(500).json({ error: 'Erro no servidor: ' + err.message });
    }
};

router.put('/theme', authenticateUser, saveThemeHandler);
router.patch('/theme', authenticateUser, saveThemeHandler);

module.exports = router;
