#!/usr/bin/env bash
# =============================================================================
#  ArenaHub — Instalador Interativo
#  Uso: bash install.sh
# =============================================================================
set -euo pipefail

APP_NAME="arenahub"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ─── Cores ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

msg()  { echo -e "${CYAN}${BOLD}▶  $*${RESET}"; }
ok()   { echo -e "${GREEN}${BOLD}✔  $*${RESET}"; }
warn() { echo -e "${YELLOW}⚠  $*${RESET}"; }
err()  { echo -e "${RED}${BOLD}✖  $*${RESET}"; }
sep()  { echo -e "${DIM}────────────────────────────────────────────────────────────────${RESET}"; }

# ─── Detectar ferramenta de diálogo ──────────────────────────────────────────
if command -v whiptail &>/dev/null; then
  DIALOG="whiptail"
elif command -v dialog &>/dev/null; then
  DIALOG="dialog"
else
  DIALOG="plain"
fi

# Retorna o valor selecionado via stdout; usa fd 3 para capturar saída do dialog
ui_menu() {
  local title="$1" text="$2"; shift 2
  local -a items
  while [[ $# -gt 0 ]]; do
    items+=("$1" "$2"); shift 2
  done
  if [[ "$DIALOG" != "plain" ]]; then
    $DIALOG --clear --title "$title" \
      --menu "$text" 18 64 8 "${items[@]}" \
      3>&1 1>&2 2>&3 3>&-
  else
    echo -e "\n${BOLD}━━  $title  ━━${RESET}"
    sep
    echo -e "$text\n"
    local idx=1
    for ((i = 0; i < ${#items[@]}; i += 2)); do
      printf "  %s) %s\n" "$idx" "${items[$((i + 1))]}"
      ((idx++))
    done
    sep
    local choice
    read -rp "Escolha [1-$((${#items[@]} / 2))]: " choice
    local n=$(( (choice - 1) * 2 ))
    echo "${items[$n]}"
  fi
}

ui_yesno() {
  local title="$1" text="$2"
  if [[ "$DIALOG" != "plain" ]]; then
    $DIALOG --clear --title "$title" --yesno "$text" 10 64 \
      3>&1 1>&2 2>&3 3>&-
  else
    echo -e "\n${BOLD}$title${RESET}"
    sep
    echo -e "$text"
    local ans
    read -rp "[s/N]: " ans
    [[ "$ans" =~ ^[sS]$ ]]
  fi
}

ui_input() {
  local title="$1" text="$2" default="$3"
  if [[ "$DIALOG" != "plain" ]]; then
    $DIALOG --clear --title "$title" \
      --inputbox "$text" 10 64 "$default" \
      3>&1 1>&2 2>&3 3>&-
  else
    echo -e "\n${BOLD}$title${RESET}"
    sep
    local val
    read -rp "$text [$default]: " val
    echo "${val:-$default}"
  fi
}

ui_msg() {
  local title="$1" text="$2"
  if [[ "$DIALOG" != "plain" ]]; then
    $DIALOG --clear --title "$title" --msgbox "$text" 12 64 \
      3>&1 1>&2 2>&3 3>&-
  else
    echo -e "\n${BOLD}$title${RESET}"
    sep
    echo -e "$text"
    sep
    read -rp "Pressione Enter para continuar..."
  fi
}

# ─── Detecção de instalação existente ────────────────────────────────────────
is_pm2_running() {
  command -v pm2 &>/dev/null && \
    pm2 list 2>/dev/null | grep -qw "$APP_NAME"
}

is_docker_running() {
  command -v docker &>/dev/null && \
    docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx "$APP_NAME"
}

detect_install() {
  if is_pm2_running;    then echo "pm2"
  elif is_docker_running; then echo "docker"
  else echo "none"
  fi
}

# ─── Desinstalação ───────────────────────────────────────────────────────────
uninstall_pm2() {
  msg "Parando processo PM2 '${APP_NAME}'..."
  pm2 stop    "$APP_NAME" 2>/dev/null || true
  pm2 delete  "$APP_NAME" 2>/dev/null || true
  pm2 save --force 2>/dev/null || true
  ok "Processo PM2 removido."
}

uninstall_docker() {
  msg "Parando container Docker '${APP_NAME}'..."
  docker stop "$APP_NAME" 2>/dev/null || true
  docker rm   "$APP_NAME" 2>/dev/null || true

  if ui_yesno "Remover dados" \
      "Deseja apagar o volume '${APP_NAME}_db'?\n\n⚠ Isso remove permanentemente o banco de dados."; then
    docker volume rm "${APP_NAME}_db" 2>/dev/null || true
    ok "Volume '${APP_NAME}_db' removido."
  else
    warn "Volume de dados mantido: ${APP_NAME}_db"
  fi

  if ui_yesno "Remover imagem" \
      "Deseja também remover a imagem Docker '${APP_NAME}:latest'?"; then
    docker rmi "${APP_NAME}:latest" 2>/dev/null || true
    ok "Imagem Docker removida."
  fi

  ok "Container Docker removido."
}

# ─── Atualização via PM2 ────────────────────────────────────────────────────
update_pm2() {
  local port="$1"

  cd "$APP_DIR"

  msg "Atualizando dependências (npm install)..."
  npm install

  msg "Recompilando frontend (Vite build)..."
  VITE_API_URL="" npm run build

  # Preservar porta atual se não informada
  if [[ -f backend/.env ]]; then
    local cur_port; cur_port=$(grep -oP '(?<=BACKEND_PORT=)[0-9]+' backend/.env 2>/dev/null || echo "3000")
    port="${port:-$cur_port}"
  fi
  printf 'BACKEND_PORT=%s\n' "$port" > backend/.env

  msg "Reiniciando processo PM2 '${APP_NAME}'..."
  pm2 restart "$APP_NAME" 2>/dev/null || \
    pm2 start backend/server.ts \
      --name "$APP_NAME" \
      --interpreter tsx \
      --cwd "$APP_DIR"

  pm2 save --force

  ok "ArenaHub atualizado e rodando via PM2 na porta ${port}!"
  ui_msg "Atualização concluída" \
    "✔ ArenaHub atualizado!\n\nAcesse: http://localhost:${port}\n\nComandos úteis:\n  pm2 status\n  pm2 logs ${APP_NAME}\n  pm2 restart ${APP_NAME}"
}

# ─── Atualização via Docker ──────────────────────────────────────────────────
update_docker() {
  local port="$1"

  if ! command -v docker &>/dev/null; then
    err "Docker não encontrado."
    exit 1
  fi

  cd "$APP_DIR"

  msg "Parando container atual..."
  docker stop "$APP_NAME" 2>/dev/null || true
  docker rm   "$APP_NAME" 2>/dev/null || true

  msg "Reconstruindo imagem Docker '${APP_NAME}:latest'..."
  docker build \
    --build-arg VITE_API_URL="" \
    -t "${APP_NAME}:latest" \
    .

  msg "Garantindo volume de dados '${APP_NAME}_db'..."
  docker volume create "${APP_NAME}_db" >/dev/null 2>&1 || true

  msg "Reiniciando container '${APP_NAME}' na porta ${port}..."
  docker run -d \
    --name "$APP_NAME" \
    --restart unless-stopped \
    -p "${port}:3000" \
    -v "${APP_NAME}_db:/app/data" \
    -e "BACKEND_PORT=3000" \
    -e "DB_PATH=/app/data/db.json" \
    "${APP_NAME}:latest"

  ok "ArenaHub atualizado e rodando via Docker na porta ${port}!"
  ui_msg "Atualização concluída" \
    "✔ ArenaHub atualizado!\n\nAcesse: http://localhost:${port}\n\nDados preservados no volume: ${APP_NAME}_db"
}

# ─── Instalação via PM2 ───────────────────────────────────────────────────────
install_pm2() {
  local port="$1"

  # Verificar Node.js
  if ! command -v node &>/dev/null; then
    err "Node.js não encontrado. Instale em: https://nodejs.org"
    exit 1
  fi

  cd "$APP_DIR"

  msg "Instalando dependências (npm install)..."
  npm install

  msg "Compilando frontend (Vite build)..."
  VITE_API_URL="" npm run build

  msg "Verificando PM2..."
  if ! command -v pm2 &>/dev/null; then
    npm install -g pm2
    ok "PM2 instalado globalmente."
  fi

  msg "Verificando tsx..."
  if ! command -v tsx &>/dev/null; then
    npm install -g tsx
    ok "tsx instalado globalmente."
  fi

  # Gravar .env do backend
  printf 'BACKEND_PORT=%s\n' "$port" > backend/.env

  msg "Iniciando ArenaHub com PM2..."
  pm2 start backend/server.ts \
    --name "$APP_NAME" \
    --interpreter tsx \
    --cwd "$APP_DIR"

  pm2 save --force

  # Tentar configurar startup automático
  sep
  warn "Para iniciar automaticamente no boot, execute o comando abaixo como root/sudo:"
  echo ""
  pm2 startup 2>/dev/null | grep "^sudo" || \
    echo "  pm2 startup   (e siga as instruções exibidas)"
  echo ""
  sep

  ok "ArenaHub rodando via PM2 na porta ${port}!"
  ui_msg "Instalação concluída" \
    "✔ ArenaHub está rodando!\n\nAcesse: http://localhost:${port}\n\nComandos úteis:\n  pm2 status\n  pm2 logs ${APP_NAME}\n  pm2 restart ${APP_NAME}"
}

# ─── Instalação via Docker ────────────────────────────────────────────────────
install_docker() {
  local port="$1"

  if ! command -v docker &>/dev/null; then
    err "Docker não encontrado. Instale em: https://docs.docker.com/get-docker/"
    exit 1
  fi

  cd "$APP_DIR"

  msg "Construindo imagem Docker '${APP_NAME}:latest'..."
  msg "(isso pode levar alguns minutos na primeira vez)"
  docker build \
    --build-arg VITE_API_URL="" \
    -t "${APP_NAME}:latest" \
    .

  msg "Criando volume de dados '${APP_NAME}_db'..."
  docker volume create "${APP_NAME}_db" >/dev/null

  msg "Iniciando container '${APP_NAME}' na porta ${port}..."
  docker run -d \
    --name "$APP_NAME" \
    --restart unless-stopped \
    -p "${port}:3000" \
    -v "${APP_NAME}_db:/app/data" \
    -e "BACKEND_PORT=3000" \
    -e "DB_PATH=/app/data/db.json" \
    "${APP_NAME}:latest"

  ok "ArenaHub rodando via Docker na porta ${port}!"
  ui_msg "Instalação concluída" \
    "✔ ArenaHub está rodando em Docker!\n\nAcesse: http://localhost:${port}\n\nComandos úteis:\n  docker ps\n  docker logs ${APP_NAME}\n  docker restart ${APP_NAME}\n\nDados persistidos em volume: ${APP_NAME}_db"
}

# ─── Validar porta ────────────────────────────────────────────────────────────
validate_port() {
  local p="$1"
  if ! [[ "$p" =~ ^[0-9]+$ ]] || (( p < 1 || p > 65535 )); then
    err "Porta inválida: '$p'. Use um número entre 1 e 65535."
    exit 1
  fi
}

# ─── Banner ───────────────────────────────────────────────────────────────────
clear
echo -e "${CYAN}${BOLD}"
cat << 'BANNER'
  ___  ____  ____  _  _    _    _   _  _   _  ____
 / _ \|  _ \| ___|| \| |  / \  | | | || | | || __ )
| |_| | |_) |  _|  | \`| | / _ \ | |_| || |_| ||  _ \
|_| |_|_|  /___|  |_| \_|/_/ \_\ \___/  \___/ |____/
BANNER
echo -e "${RESET}"
echo -e "  ${BOLD}Instalador do ArenaHub${RESET}  ${DIM}— Gestão de Arenas Esportivas${RESET}"
echo ""
sep
echo ""

# ─── Detectar instalação existente ───────────────────────────────────────────
CURRENT=$(detect_install)

# ─── Escolher método de instalação ──────────────────────────────────────────
METHOD=$(ui_menu "Método de Instalação" \
  "Como deseja instalar o ArenaHub?" \
  "pm2"    "PM2     — Node.js process manager  (recomendado)" \
  "docker" "Docker  — Container isolado + volume de dados")

[[ -z "$METHOD" ]] && { msg "Operação cancelada."; exit 0; }

# ─── Se instalado, perguntar ação (instalar / atualizar / desinstalar) ────────
if [[ "$CURRENT" != "none" ]]; then
  warn "Instalação detectada: ${CURRENT^^}"
  echo ""

  ACAO=$(ui_menu "O que deseja fazer?" \
    "O ArenaHub já está instalado via ${CURRENT^^}.\nEscolha a ação:" \
    "update"    "Atualizar   — Rebuild + reiniciar (dados preservados)" \
    "uninstall" "Desinstalar — Remover o app completamente")

  [[ -z "$ACAO" ]] && { msg "Operação cancelada."; exit 0; }

  if [[ "$ACAO" == "uninstall" ]]; then
    sep
    case "$CURRENT" in
      pm2)    uninstall_pm2 ;;
      docker) uninstall_docker ;;
    esac
    echo ""
    ok "ArenaHub desinstalado com sucesso."
    exit 0
  fi

  # ── Atualizar ──
  PORT=$(ui_input "Porta" \
    "Confirme ou altere a porta do app:" \
    "3000")
  [[ -z "$PORT" ]] && PORT=3000
  validate_port "$PORT"

  sep
  echo -e "  ${BOLD}Ação   :${RESET} ATUALIZAR"
  echo -e "  ${BOLD}Método :${RESET} ${CURRENT^^}"
  echo -e "  ${BOLD}Porta  :${RESET} ${PORT}"
  sep
  echo ""

  if ! ui_yesno "Confirmar atualização" \
      "Atualizar ArenaHub via ${CURRENT^^} na porta ${PORT}?\n\nContinuar?"; then
    msg "Operação cancelada."
    exit 0
  fi

  echo ""
  sep
  case "$CURRENT" in
    pm2)    update_pm2    "$PORT" ;;
    docker) update_docker "$PORT" ;;
  esac
  exit 0
fi

# ─── Escolher porta ──────────────────────────────────────────────────────────
PORT=$(ui_input "Porta" \
  "Informe a porta que o app irá utilizar:" \
  "3000")

[[ -z "$PORT" ]] && PORT=3000
validate_port "$PORT"

# ─── Confirmar ───────────────────────────────────────────────────────────────
sep
echo -e "  ${BOLD}Ação   :${RESET} INSTALAR"
echo -e "  ${BOLD}Método :${RESET} ${METHOD^^}"
echo -e "  ${BOLD}Porta  :${RESET} ${PORT}"
sep
echo ""

if ! ui_yesno "Confirmar instalação" \
    "Instalar ArenaHub via ${METHOD^^} na porta ${PORT}?\n\nContinuar?"; then
  msg "Instalação cancelada."
  exit 0
fi

echo ""
sep

# ─── Instalar ────────────────────────────────────────────────────────────────
case "$METHOD" in
  pm2)    install_pm2    "$PORT" ;;
  docker) install_docker "$PORT" ;;
esac
