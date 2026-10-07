const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'bxtech-webbooking-theme-secret-key-2026';

/**
 * Gera um token assinado HMAC-SHA256 (JWT compatível)
 * @param {object} payload - Dados do usuário (ex: { userId, username })
 * @param {number} expiresInSeconds - Tempo de expiração (padrão: 7 dias)
 */
function generateToken(payload, expiresInSeconds = 7 * 24 * 60 * 60) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const body = Buffer.from(JSON.stringify({
        ...payload,
        iat: now,
        exp: now + expiresInSeconds
    })).toString('base64url');
    const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
}

/**
 * Valida o token e retorna o payload decodificado
 * @param {string} token 
 */
function verifyToken(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    
    try {
        const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
        if (signature.length !== expectedSig.length) return null;
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
            return null;
        }

        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
            return null;
        }
        return payload;
    } catch (e) {
        return null;
    }
}

/**
 * Middleware Express para autenticação via Header Authorization ou x-auth-token
 */
function authenticateUser(req, res, next) {
    const authHeader = req.headers['authorization'] || req.headers['x-auth-token'];
    let token = null;

    if (authHeader) {
        if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7).trim();
        } else if (typeof authHeader === 'string') {
            token = authHeader.trim();
        }
    }

    if (!token) {
        return res.status(401).json({ error: 'Acesso não autorizado. Token não informado.' });
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
        return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    }

    req.user = decoded;
    next();
}

module.exports = {
    generateToken,
    verifyToken,
    authenticateUser
};
