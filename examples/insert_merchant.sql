-- Script de exemplo para inserir um comerciante e configurar os perfis.
-- NOTA: Você precisa de um hash de senha bcrypt para a coluna password_hash.
-- Passos (recomendado):
-- 1) No servidor que hospeda a aplicação Node.js (ou qualquer máquina com Node.js instalado), execute:
--    node -e "const b=require('bcrypt'); b.hash('SENHA_AQUI',10).then(h=>console.log(h));"
--    Substitua SENHA_AQUI pela senha desejada. O comando imprime um hash bcrypt.
-- 2) Copie o hash impresso e substitua o placeholder <BCRYPT_HASH_HERE> abaixo.
-- 3) Edite os valores: username, displayName, phrase, avatar_path, timezone conforme preferir.
-- 4) Execute este arquivo contra o banco de dados PostgreSQL, por exemplo usando psql:
--    psql -h DB_HOST -U DB_USER -d DB_NAME -f examples/insert_merchant.sql

-- Alternativa (recomendado): se seu PostgreSQL permite a extensão `pgcrypto`,
-- este script criará a extensão (se não presente) e gerará um hash bcrypt
-- dentro do banco de dados com `crypt(..., gen_salt('bf'))` então você não precisa
-- gerar o hash bcrypt externamente.

-- 2) Edite os valores: username, displayName, phrase, avatar_path, timezone conforme preferir.

-- 3) Execute este arquivo contra o banco de dados PostgreSQL, por exemplo usando psql:
--    psql -h DB_HOST -U DB_USER -d DB_NAME -f examples/insert_merchant.sql

-- === INÍCIO DO SCRIPT ===
BEGIN;

-- Substitua estas variáveis antes de executar
\set username 'carvalho'
\set password_hash '<BCRYPT_HASH_HERE>'
\set display_name 'Carvalho - Barber Shop'
\set phrase 'Cabelo na régua — atendimento com carinho!'
\set avatar_path '/images/avatars/carvalho.png'
\set timezone 'America/Sao_Paulo'

-- Inserir comerciante
INSERT INTO merchants (username, password_hash, settings)
VALUES (
  :'username',
  :'password_hash',
  jsonb_build_object(
    'displayName', :'display_name',
    'phrase', :'phrase',
    'avatar', :'avatar_path',
    'timezone', :'timezone'
  )
)
RETURNING id, username;

COMMIT;
-- === FIM DO SCRIPT ===

-- Se preferir atualizar um comerciante existente por username, use este padrão:
-- UPDATE merchants SET settings = jsonb_build_object(
--   'displayName','Carvalho - Barber Shop', 'phrase','...', 'avatar','/images/avatars/carvalho.png', 'timezone','America/Sao_Paulo'
-- ) WHERE username = 'carvalho';
