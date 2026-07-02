#!/usr/bin/env bash
# One-time VPS provisioning for Oh my Gogh! (Ubuntu 22.04/24.04).
# Run as root on a fresh box:  bash provision.sh
set -euo pipefail

echo "== 1/6 base packages =="
apt-get update -y
apt-get install -y ca-certificates curl gnupg ufw nginx certbot python3-certbot-nginx fail2ban git

echo "== 2/6 docker engine =="
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
    https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

echo "== 3/6 firewall: only 22/80/443 =="
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "== 4/6 ssh hardening: keys only =="
mkdir -p /etc/ssh/sshd_config.d
cat > /etc/ssh/sshd_config.d/99-ohmygogh.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
MaxAuthTries 4
EOF
systemctl reload ssh || systemctl reload sshd

echo "== 5/6 fail2ban (ssh jail, defaults) =="
systemctl enable --now fail2ban

echo "== 6/6 app directories =="
mkdir -p /opt/ohmygogh /var/www/ohmygogh
chown -R "${SUDO_USER:-root}" /opt/ohmygogh /var/www/ohmygogh

cat <<'EOF'

Provisioned. Next steps:
  1. git clone the repo into /opt/ohmygogh
  2. cp deploy/.env.production.example deploy/.env.production  # fill it in
  3. bash deploy/scripts/deploy.sh                             # build + start + migrate
  4. cp deploy/nginx/ohmygogh.conf /etc/nginx/sites-available/ohmygogh
     ln -s /etc/nginx/sites-available/ohmygogh /etc/nginx/sites-enabled/
     (edit server_name if using a staging domain)
     nginx -t && systemctl reload nginx
  5. certbot --nginx -d <domain> -d api.<domain>               # Let's Encrypt TLS
EOF
