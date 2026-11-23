#!/usr/bin/env bash
# ============================================================
#  Instala o bot da casa num servidor Ubuntu (22.04 ou 24.04).
#  Rode de dentro da pasta bot-casa:   bash servidor/instalar.sh
#  Pode rodar de novo sem problema (por exemplo, depois de atualizar o código).
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."
PASTA="$(pwd)"

echo "==> 1/7 Fuso horário de Brasília"
sudo timedatectl set-timezone America/Sao_Paulo || true

echo "==> 2/7 Pacotes do sistema (o WhatsApp Web roda num Chromium escondido)"
sudo apt-get update -y
sudo apt-get install -y curl ca-certificates tar cron fonts-noto-color-emoji \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
  libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2
# o nome desse pacote mudou no Ubuntu 24.04
sudo apt-get install -y libasound2 || sudo apt-get install -y libasound2t64

echo "==> 3/7 Memória extra (swap), se a máquina tiver pouca RAM"
MEM_MB=$(free -m | awk '/^Mem:/ {print $2}')
if [ "$MEM_MB" -lt 2000 ] && ! swapon --show | grep -q swapfile; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab > /dev/null
  echo "    swap de 2 GB criado (a máquina tem ${MEM_MB} MB de RAM)"
else
  echo "    não precisa (${MEM_MB} MB de RAM)"
fi

echo "==> 4/7 Node.js 22"
NODE_MAJOR=0
if command -v node > /dev/null; then NODE_MAJOR=$(node -v | sed 's/v\([0-9]*\).*/\1/'); fi
if [ "$NODE_MAJOR" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v

echo "==> 5/7 Chromium"
CHROME_PATH=""
if [ "$(uname -m)" = "aarch64" ]; then
  # máquinas ARM (ex.: Oracle Ampere): o puppeteer não tem Chrome próprio para ARM, então usa o do sistema
  sudo snap install chromium
  CHROME_PATH="/snap/bin/chromium"
  export PUPPETEER_SKIP_DOWNLOAD=1
fi
echo "$CHROME_PATH" > servidor/chrome-path.txt
echo "    ${CHROME_PATH:-Chrome do próprio puppeteer (baixado no npm install)}"

echo "==> 6/7 Dependências do bot"
if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

echo "==> 7/7 pm2 (mantém o bot ligado e religa sozinho se cair ou se o servidor reiniciar)"
sudo npm install -g pm2
sudo env PATH="$PATH" pm2 startup systemd -u "${USER:-$(whoami)}" --hp "$HOME" > /dev/null || echo "    ⚠️  não consegui configurar o pm2 para ligar junto com o servidor; rode: pm2 startup"
# backup diário às 3h da manhã
chmod +x servidor/*.sh
( crontab -l 2>/dev/null | grep -v 'servidor/backup.sh' ; echo "0 3 * * * bash $PASTA/servidor/backup.sh" ) | crontab -

echo
echo "✅ Instalação concluída."
if [ -d dados/sessao ]; then
  echo "   Já existe uma sessão do WhatsApp salva. Para (re)ligar o bot:"
  echo "   pm2 start servidor/ecosystem.config.js && pm2 save"
else
  echo "   Próximo passo (quando o número do bot estiver pronto):"
  echo "   bash servidor/conectar.sh"
fi
