#!/usr/bin/env bash
#
# deploy.sh — commit + push seguro para o GitHub
# Usa a credencial do `gh auth login` (NUNCA pede/guarda token no chat ou na URL).
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

MSG="${1:-}"

echo "==> Verificando autenticação (gh)…"
if ! gh auth status >/dev/null 2>&1; then
  echo "✖ gh não autenticado. Rode:  gh auth login"
  exit 1
fi
echo "    ok: $(gh auth status 2>&1 | grep -o 'account [A-Za-z0-9_-]*' | head -1)"

echo "==> Garantindo que o remoto não tem token embutido…"
if git remote get-url origin | grep -qE 'oauth2:|ghp_|github_pat_|gho_'; then
  echo "⚠️  Remoto contém credencial! Limpando…"
  git remote set-url origin "https://github.com/Thiagoek85/Ponto.git"
fi
echo "    origin = $(git remote get-url origin)"

echo "==> Recusando commitar segredos…"
if git status --porcelain | awk '{print $2}' | grep -E '(^|/)\.env($|\.)|\.pem$|\.key$|secret' ; then
  echo "✖ Há arquivos sensíveis na área de stage. Abortando."
  exit 1
fi

echo "==> Mostrando mudanças:"
git status --short

if [ -z "$(git status --porcelain)" ]; then
  echo "==> Nada para commitar. Fazendo push (se houver commits pendentes)…"
else
  if [ -z "$MSG" ]; then
    echo
    read -r -p "Mensagem do commit: " MSG
  fi
  [ -z "$MSG" ] && { echo "✖ Mensagem vazia. Abortando."; exit 1; }
  git add -A
  git commit -m "$MSG"
fi

echo "==> Push para origin/main…"
git push origin main
echo "==> ✔ Concluído. Último commit:"
git log --oneline -1
