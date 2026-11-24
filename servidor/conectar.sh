#!/usr/bin/env bash
# ============================================================
#  Conecta o WhatsApp do bot (primeira vez ou depois de uma desconexão)
#  e deixa o bot rodando sozinho no pm2.
#  Se a sessão já estiver salva, ele não pede QR: só confere e liga.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

# o bot não pode estar usando a pasta da sessão ao mesmo tempo
pm2 delete casa > /dev/null 2>&1 || true
sleep 3
pkill -f chrome > /dev/null 2>&1 || true

CHROME_PATH="$(cat servidor/chrome-path.txt 2>/dev/null || true)"
export CHROME_PATH

if ! node servidor/login.js; then
  echo "O bot não foi ligado. Rode de novo: bash servidor/conectar.sh"
  exit 1
fi

echo
echo "==> Ligando o bot em segundo plano..."
pm2 start servidor/ecosystem.config.js && pm2 save
echo "✅ Pronto. Ele demora 1 ou 2 minutos para aparecer 'Bot conectado!' em: pm2 logs casa"
