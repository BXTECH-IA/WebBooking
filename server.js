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

