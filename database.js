const { Pool } = require('pg');
require('dotenv').config();

const sslConfig = process.env.DB_SSL === '1' || process.env.DB_SSL === 'true' 
    ? { rejectUnauthorized: false } 
    : false;

let poolConfig = {};

console.log('Iniciando configuracao do DB...');

// Recupera variaveis. Se Vercel dropar DB_PASS, usa a URL
let dbUser = process.env.DB_USER;
let dbPass = process.env.DB_PASS;
let dbHost = process.env.DB_HOST;
let dbName = process.env.DB_NAME || 'postgres';
let dbPort = process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432;

if (!dbPass && process.env.DATABASE_URL) {
    try {
        console.log('DB_PASS esta vazio no Vercel. Extraindo diretamente da DATABASE_URL...');
        const u = new URL(process.env.DATABASE_URL);
        dbUser = decodeURIComponent(u.username);
        dbPass = decodeURIComponent(u.password);
        dbHost = u.hostname;
        dbPort = u.port ? Number(u.port) : 5432;
        dbName = u.pathname.replace('/', '');
    } catch (e) {
        console.error('Falha ao processar DATABASE_URL', e.message);
    }
}

if (!dbUser || !dbPass || !dbHost) {
    console.error('ERRO CRITICO: Faltam variaveis de ambiente de conexao com o DB!');
}

poolConfig = {
    user: dbUser,
    host: dbHost,
    database: dbName,
    password: dbPass || 'sem-senha-informada', // Impede erro de string SASL
    port: dbPort,
    ssl: sslConfig,
};

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
    console.error('Erro inesperado no cliente ocioso', err);
});

module.exports = pool;
