const express = require('express');
const router = express.Router();
const pool = require('../database');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

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


// Obter todos os comerciantes (Apenas para Painel Admin)
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username FROM merchants ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao listar comerciantes', err);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// Excluir comerciante (Apenas para Painel Admin)
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM merchants WHERE id = $1', [id]);
        res.json({ message: 'Comerciante excluído com sucesso' });
    } catch (err) {
        console.error('Erro ao excluir comerciante', err);
        res.status(500).json({ error: 'Erro no servidor (verifique dependências)' });
    }
});

const { authenticateUser } = require('../services/authService');

// Obter tema do usuário autenticado (rota alternativa /api/merchants/theme)
router.get('/theme', authenticateUser, async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    try {
        const result = await pool.query('SELECT theme FROM merchants WHERE id = $1', [req.user.userId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Comerciante não encontrado' });
        res.json({ theme: result.rows[0].theme || 'clean' });
    } catch (err) {
        console.error('Erro ao buscar tema', err);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// Atualizar tema do usuário autenticado (rota alternativa /api/merchants/theme)
router.put('/theme', authenticateUser, async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    const { theme } = req.body;
    if (!theme || (theme !== 'clean' && theme !== 'dark')) {
        return res.status(400).json({ error: 'Tema inválido. Valores permitidos: "clean" ou "dark".' });
    }
    try {
        const result = await pool.query(
            'UPDATE merchants SET theme = $1 WHERE id = $2 RETURNING id, username, theme',
            [theme, req.user.userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Comerciante não encontrado' });
        res.json({ message: 'Tema atualizado com sucesso', theme: result.rows[0].theme });
    } catch (err) {
        console.error('Erro ao atualizar tema', err);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// Obter comerciante por ID (perfil básico)
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT id, username, settings, COALESCE(theme, \'clean\') as theme FROM merchants WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Comerciante não encontrado' });
        const merchant = result.rows[0];
        // Garantir que settings seja JSON parseado
        merchant.settings = merchant.settings || {};

        // Se o comerciante não possuir avatar em settings, usar avatar do master como fallback
        if (!merchant.settings.avatar && merchant.username && merchant.username.toLowerCase() !== 'master') {
            const master = await getMasterMerchant();
            if (master && master.settings && master.settings.avatar) {
                merchant.settings.avatar = master.settings.avatar;
            }
        }

        res.json(merchant);
    } catch (err) {
        console.error('Erro ao buscar comerciante', err);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// Atualizar configurações do comerciante (avatar, frase, endereço, etc)
router.put('/:id/settings', async (req, res) => {
    const { id } = req.params;
    const newSettings = { ...req.body };
    delete newSettings.theme; // Remove qualquer tentativa de salvar tema globalmente em settings

    try {
        // Obter configurações atuais para não sobrescrever tudo
        const currentRes = await pool.query('SELECT settings FROM merchants WHERE id = $1', [id]);
        if (currentRes.rows.length === 0) return res.status(404).json({ error: 'Comerciante não encontrado' });

        const currentSettings = currentRes.rows[0].settings || {};
        const mergedSettings = { ...currentSettings, ...newSettings };
        delete mergedSettings.theme;

        await pool.query('UPDATE merchants SET settings = $1 WHERE id = $2', [mergedSettings, id]);
        res.json({ message: 'Configurações atualizadas com sucesso', settings: mergedSettings });
    } catch (err) {
        console.error('Erro ao atualizar configurações do comerciante', err);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// --- Asset Specific Routes ---

// Obter um asset específico (ex: logo)
router.get('/:id/assets/:key', async (req, res) => {
    const { id, key } = req.params;
    try {
        let result = await pool.query(
            'SELECT file_data, file_type FROM merchant_assets WHERE merchant_id = $1 AND asset_key = $2',
            [id, key]
        );

        // Se não encontrar o asset e for o logo, busca o logo padrão do master
        if (result.rows.length === 0 && key === 'logo') {
            const master = await getMasterMerchant();
            if (master) {
                result = await pool.query(
                    'SELECT file_data, file_type FROM merchant_assets WHERE merchant_id = $1 AND asset_key = $2',
                    [master.id, key]
                );
            }
        }

        if (result.rows.length === 0) return res.status(404).json({ error: 'Asset não encontrado' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Erro ao buscar asset', err);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// NOVO: Retorna o binário direto (Útil para carregar logos grandes sem Base64 no JS)
router.get('/:id/assets/:key/raw', async (req, res) => {
    const { id, key } = req.params;
    try {
        const mid = parseInt(id);
        if (isNaN(mid)) return res.status(400).json({ error: 'ID de comerciante inválido' });

        let result = await pool.query(
            'SELECT file_data, file_type FROM merchant_assets WHERE merchant_id = $1 AND asset_key = $2',
            [mid, key]
        );

        // Se não encontrar o asset e for o logo, busca o logo padrão do master
        if (result.rows.length === 0 && key === 'logo') {
            const master = await getMasterMerchant();
            if (master) {
                result = await pool.query(
                    'SELECT file_data, file_type FROM merchant_assets WHERE merchant_id = $1 AND asset_key = $2',
                    [master.id, key]
                );
            }
        }

        if (result.rows.length === 0) return res.status(404).json({ error: 'Asset não encontrado' });

        const asset = result.rows[0];
        
        // Se já for uma URL externa (fallback improvável aqui mas seguro)
        if (!asset.file_data.startsWith('data:')) {
            return res.redirect(asset.file_data);
        }

        // Extrair a parte base64 da string "data:image/png;base64,..."
        const parts = asset.file_data.split(',');
        const base64Data = parts[1];
        if (!base64Data) {
            console.error('Dados do asset corrompidos para id:', mid);
            return res.status(500).json({ error: 'Formato de dado inválido' });
        }

        const buffer = Buffer.from(base64Data, 'base64');
        const contentType = asset.file_type || parts[0].split(':')[1]?.split(';')[0] || 'application/octet-stream';
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600'); 
        res.send(buffer);
    } catch (err) {
        console.error('Erro ao buscar asset binário:', err);
        res.status(500).json({ error: 'Erro no servidor ao carregar arquivo' });
    }
});

// Salvar ou atualizar um asset específico (Suporta JSON ou Multipart para arquivos grandes)
router.post('/:id/assets/:key', upload.single('file'), async (req, res) => {
    const { id, key } = req.params;
    let fileData = req.body.fileData;
    let fileType = req.body.fileType;

    const mid = parseInt(id);
    if (isNaN(mid)) return res.status(400).json({ error: 'ID de comerciante inválido' });

    console.log(`Recebendo upload de asset para merchant ${mid}, chave ${key}`);

    // Se vier via Multipart (FormData), o arquivo estará em req.file
    if (req.file) {
        console.log(`Arquivo binário recebido: ${req.file.originalname} (${req.file.size} bytes)`);
        fileData = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        fileType = req.file.mimetype;
    }

    if (!fileData) {
        console.error('Erro no upload: Dados do arquivo ausentes');
        return res.status(400).json({ error: 'Dados do arquivo ausentes' });
    }

    try {
        await pool.query(`
            INSERT INTO merchant_assets (merchant_id, asset_key, file_data, file_type, updated_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            ON CONFLICT (merchant_id, asset_key) 
            DO UPDATE SET file_data = EXCLUDED.file_data, file_type = EXCLUDED.file_type, updated_at = CURRENT_TIMESTAMP
        `, [mid, key, fileData, fileType]);

        console.log(`Asset ${key} salvo com sucesso para merchant ${mid}`);
        res.json({ message: 'Asset salvo com sucesso' });
    } catch (err) {
        console.error('Erro ao salvar asset no DB:', err);
        res.status(500).json({ error: 'Erro no servidor ao salvar arquivo' });
    }
});

module.exports = router;
