#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# BotFlows — Setup local PostgreSQL on VPS
# Run ONCE as root: bash /var/www/botsales/scripts/setup-postgres.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

APP_DIR="/var/www/botsales"
DB_NAME="botsales"
DB_USER="botsales"
DB_PASS=$(openssl rand -hex 20)

echo ""
echo "=== [1/5] Instalando PostgreSQL ==="
apt-get update -q
apt-get install -y postgresql postgresql-contrib

systemctl enable postgresql
systemctl start postgresql
echo "✓ PostgreSQL instalado e rodando"

echo ""
echo "=== [2/5] Criando banco de dados e usuário ==="
sudo -u postgres psql <<PSQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS';
  ELSE
    ALTER ROLE $DB_USER WITH PASSWORD '$DB_PASS';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE $DB_NAME OWNER $DB_USER'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME') \gexec

GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
PSQL
echo "✓ Banco '$DB_NAME' e usuário '$DB_USER' prontos"

DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"

echo ""
echo "=== [3/5] Atualizando .env ==="
cd "$APP_DIR"

if [ -f .env ]; then
  # Replace DATABASE_URL line if exists, otherwise append
  if grep -q "^DATABASE_URL=" .env; then
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${DATABASE_URL}|" .env
  else
    echo "DATABASE_URL=${DATABASE_URL}" >> .env
  fi
else
  echo "DATABASE_URL=${DATABASE_URL}" > .env
fi
echo "✓ .env atualizado"

echo ""
echo "=== [4/5] Aplicando schema no banco (criando tabelas) ==="
npx prisma db push --skip-generate
echo "✓ Schema aplicado"

echo ""
echo "=== [5/5] Verificando conexão ==="
npx prisma db execute --stdin <<'SQL'
SELECT 'Conexão OK — tabelas criadas:' AS status, count(*) AS total
FROM information_schema.tables
WHERE table_schema = 'public';
SQL

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  ✅  PostgreSQL configurado com sucesso!"
echo ""
echo "  DATABASE_URL:"
echo "  $DATABASE_URL"
echo ""
echo "  ⚠️  Faça isso agora:"
echo "  1. Copie a DATABASE_URL acima"
echo "  2. Acesse github.com → seu repositório → Settings → Secrets"
echo "  3. Adicione/atualize o secret: APP_DATABASE_URL"
echo "  4. Faça um push qualquer para o deploy reescrever o .env"
echo "══════════════════════════════════════════════════════════════"
echo ""
