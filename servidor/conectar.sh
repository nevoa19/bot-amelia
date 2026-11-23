#!/usr/bin/env bash
# ============================================================
#  Primeira conexão com o WhatsApp do bot.
#  Mostra o QR Code aqui no terminal. Depois que aparecer
#  "Bot conectado!", aperte Ctrl+C: o bot passa a rodar sozinho no pm2.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

pm2 delete casa > /dev/null 2>&1 || true   # garante que não tem outro bot rodando junto
CHROME_PATH="$(cat servidor/chrome-path.txt 2>/dev/null || true)"
export CHROME_PATH

echo "No celular: WhatsApp Business do bot > Configurações > Dispositivos conectados > Conectar dispositivo"
echo "Quando aparecer 'Bot conectado!', aperte Ctrl+C."
echo
trap 'echo; echo "==> Ligando o bot em segundo plano..."; pm2 start servidor/ecosystem.config.js && pm2 save; echo "✅ Pronto. Para ver o que ele está fazendo: pm2 logs casa"; exit 0' INT
node src/index.js
