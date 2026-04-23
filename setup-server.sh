#!/bin/bash
set -e

echo "=== [1/8] Atualizando sistema ==="
apt-get update -y && apt-get upgrade -y
apt-get install -y curl git build-essential ufw

echo "=== [2/8] Instalando Node.js 20 LTS ==="
curl -fsSL https://fnm.vercel.app/install | bash
export PATH="$HOME/.local/share/fnm:$PATH"
eval "$(fnm env)"
fnm install 20
fnm use 20
fnm default 20
# Tornar disponível para todos os shells
echo 'export PATH="$HOME/.local/share/fnm:$PATH"' >> /root/.bashrc
echo 'eval "$(fnm env)"' >> /root/.bashrc
source /root/.bashrc

echo "=== [3/8] Instalando ferramentas globais ==="
npm install -g pm2 ts-node tsconfig-paths typescript

echo "=== [4/8] Instalando PostgreSQL 16 ==="
apt-get install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

# Criar banco e usuário
DB_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
sudo -u postgres psql -c "CREATE USER botsales_user WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -c "CREATE DATABASE botsales OWNER botsales_user;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE botsales TO botsales_user;"
echo ""
echo ">>> DATABASE_URL=postgresql://botsales_user:$DB_PASS@localhost:5432/botsales"
echo ">>> ANOTE ISSO AGORA!"
echo ""

echo "=== [5/8] Instalando Redis ==="
apt-get install -y redis-server
sed -i 's/^# bind 127.0.0.1/bind 127.0.0.1/' /etc/redis/redis.conf
sed -i 's/^bind 127.0.0.1 -::1/bind 127.0.0.1/' /etc/redis/redis.conf
sed -i 's/^appendonly no/appendonly yes/' /etc/redis/redis.conf
systemctl enable redis-server
systemctl restart redis-server

echo "=== [6/8] Instalando Nginx ==="
apt-get install -y nginx
systemctl enable nginx

echo "=== [7/8] Configurando firewall ==="
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "=== [8/8] Criando estrutura de diretórios ==="
mkdir -p /var/www/botsales
mkdir -p /var/backups/botsales

echo ""
echo "======================================"
echo " SERVIDOR CONFIGURADO COM SUCESSO"
echo "======================================"
echo " Node.js: $(node -v)"
echo " npm: $(npm -v)"
echo " PostgreSQL: ativo"
echo " Redis: ativo"
echo " Nginx: ativo"
echo " Firewall: ativo"
echo "======================================"
