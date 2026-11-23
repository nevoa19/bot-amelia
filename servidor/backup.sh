#!/usr/bin/env bash
# ============================================================
#  Backup diário dos dados do bot (multas, pagamentos, comprovantes,
#  contestações). Roda sozinho às 3h. Guarda os últimos 30 dias em ~/backups-bot.
#  A sessão do WhatsApp fica de fora: se precisar, é só escanear o QR de novo.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."
DESTINO="$HOME/backups-bot"
mkdir -p "$DESTINO"
[ -d dados ] || exit 0
tar -czf "$DESTINO/dados-$(date +%Y-%m-%d).tgz" --exclude='dados/sessao' dados
find "$DESTINO" -name 'dados-*.tgz' -mtime +30 -delete
