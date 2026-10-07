const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '6mb' })); // Increased slightly for base64 overhead
app.use(bodyParser.urlencoded({ limit: '6mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const authRoutes = require('./routes/auth');
const availabilityRoutes = require('./routes/availability');
const appointmentRoutes = require('./routes/appointments');

app.use('/api/auth', authRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/services', require('./routes/services'));
app.use('/api/merchants', require('./routes/merchants'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/finance', require('./routes/finance'));

// --- MIGRACAO AUTOMATICA NO STARTUP ---
// Garante que a coluna 'name' exista na tabela client_profiles e popula retroativamente
const pool = require('./database');
pool.query('ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS name VARCHAR(255)')
    .then(() => {
        console.log('Migração: Coluna name verificada em client_profiles');
        return pool.query(`
            INSERT INTO client_profiles (merchant_id, phone, name)
            SELECT DISTINCT merchant_id, client_phone, client_name 
            FROM appointments
            ON CONFLICT (merchant_id, phone) 
            DO UPDATE SET name = EXCLUDED.name WHERE client_profiles.name IS NULL OR client_profiles.name = ''
        `);
    })
    .then(() => console.log('Migração: Nomes populados do appointments para os profiles!'))
    .catch(err => console.error('Migração falhou (ignorando, provavel falta de conexao temporaria):', err));

// Garante que a coluna 'theme' exista na tabela merchants com valor default 'clean'
pool.query("ALTER TABLE merchants ADD COLUMN IF NOT EXISTS theme VARCHAR(20) DEFAULT 'clean'")
    .then(() => {
        console.log('Migração: Coluna theme verificada em merchants');
        return pool.query("UPDATE merchants SET theme = 'clean' WHERE theme IS NULL");
    })
    .then(() => console.log('Migração: Tema padrão clean garantido para todos os merchants!'))
    .catch(err => console.error('Migração de tema em merchants falhou:', err));

// Garante que a tabela 'merchant_assets' exista e que o logo padrão do master seja sincronizado para merchants sem logo
pool.query(`
    CREATE TABLE IF NOT EXISTS merchant_assets (
        id SERIAL PRIMARY KEY,
        merchant_id INTEGER REFERENCES merchants(id) ON DELETE CASCADE,
        asset_key VARCHAR(50) NOT NULL,
        file_type VARCHAR(100),
        file_data TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(merchant_id, asset_key)
    )
`)
    .then(() => {
        console.log('Migração: Tabela merchant_assets verificada');
        return pool.query(`
            INSERT INTO merchant_assets (merchant_id, asset_key, file_data, file_type, updated_at)
            SELECT m.id, 'logo', master_asset.file_data, master_asset.file_type, CURRENT_TIMESTAMP
            FROM merchants m
            CROSS JOIN (
                SELECT file_data, file_type 
                FROM merchant_assets ma 
                JOIN merchants m_master ON ma.merchant_id = m_master.id 
                WHERE LOWER(m_master.username) = 'master' AND ma.asset_key = 'logo'
                LIMIT 1
            ) master_asset
            WHERE LOWER(m.username) != 'master'
              AND NOT EXISTS (
                  SELECT 1 FROM merchant_assets existing 
                  WHERE existing.merchant_id = m.id AND existing.asset_key = 'logo'
              )
        `);
    })
    .then((res) => {
        if (res && res.rowCount > 0) {
            console.log(`Migração: Logo padrão do master sincronizado para ${res.rowCount} comerciante(s).`);
        }
    })
    .catch(err => console.error('Migração de merchant_assets falhou:', err.message));


// Configuração de Upload de Arquivos
const uploadDir = process.env.VERCEL ? path.join('/tmp', 'uploads') : path.join(__dirname, 'public', 'uploads');

try {
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
} catch (err) {
    console.warn('Cannot create upload directory (expected on Vercel).');
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname) || '';
        cb(null, 'avatar-' + uniqueSuffix + ext);
    }
});
const upload = multer({ storage: storage });

app.post('/api/upload', upload.single('avatar'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }
    const publicPath = '/uploads/' + req.file.filename;
    res.json({ url: publicPath });
});

// Basic route to serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// REMOVER ANTES DE PRODUCAO FINAL - Endpoint para debugar Vercel ENV
app.get('/api/debug-env', (req, res) => {
    let parsedUser = 'none';
    let hasNewPassword = false;
    let urlString = process.env.DATABASE_URL || '';
    
    if (process.env.DATABASE_URL) {
        try {
            const u = new URL(process.env.DATABASE_URL);
            parsedUser = decodeURIComponent(u.username);
        } catch(e) { parsedUser = 'erro_no_parse'; }
    }
    
    res.json({
        dbUrlExists: !!process.env.DATABASE_URL,
        dbUserValue: process.env.DB_USER || 'undefined',
        parsedUrlUser: parsedUser,
        dbPassExists: !!process.env.DB_PASS,
        nodeEnv: process.env.NODE_ENV,
        vercel: process.env.VERCEL
    });
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Server running on http://localhost:${port}`);
    });
}

module.exports = app;

