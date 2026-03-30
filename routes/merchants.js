const express = require('express');
const router = express.Router();
const pool = require('../database');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

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

// Obter comerciante por ID (perfil básico)
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT id, username, settings FROM merchants WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Comerciante não encontrado' });
        const merchant = result.rows[0];
        // Garantir que settings seja JSON parseado
        merchant.settings = merchant.settings || {};
        res.json(merchant);
    } catch (err) {
        console.error('Erro ao buscar comerciante', err);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// Atualizar configurações do comerciante (avatar, frase, endereço, etc)
router.put('/:id/settings', async (req, res) => {
    const { id } = req.params;
    const newSettings = req.body;

    try {
        // Obter configurações atuais para não sobrescrever tudo
        const currentRes = await pool.query('SELECT settings FROM merchants WHERE id = $1', [id]);
        if (currentRes.rows.length === 0) return res.status(404).json({ error: 'Comerciante não encontrado' });

        const currentSettings = currentRes.rows[0].settings || {};
        const mergedSettings = { ...currentSettings, ...newSettings };

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
        const result = await pool.query(
            'SELECT file_data, file_type FROM merchant_assets WHERE merchant_id = $1 AND asset_key = $2',
            [id, key]
        );
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

        const result = await pool.query(
            'SELECT file_data, file_type FROM merchant_assets WHERE merchant_id = $1 AND asset_key = $2',
            [mid, key]
        );
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
