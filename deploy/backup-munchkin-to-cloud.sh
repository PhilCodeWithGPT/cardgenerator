#!/bin/bash
# Mattis Munchkin Editor: tägliche Sicherung der Karten + Bilder nach Google Drive (wie Anki-Backup)
set -uo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/admin/bin"
source /home/admin/bin/gdrive-backup-lib.sh

DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_DIR="/tmp/munchkin-backup-$DATE"
APP_DIR="/home/admin/munchkin"
REMOTE="gdrive:munchkin-backups"

trap 'rm -rf "$BACKUP_DIR"' EXIT
fail() { log "FEHLER: $1"; notify "Munchkin-Backup fehlgeschlagen" "$1 (Log: ~/paperless/logs/munchkin-backup.log)"; exit 1; }

log "=== Munchkin Cloud Backup $DATE ==="
mkdir -p "$BACKUP_DIR" || fail "Temp-Verzeichnis nicht anlegbar"
cd "$APP_DIR" || fail "Verzeichnis $APP_DIR fehlt"

log "Karten und Bilder packen"
tar -czf "$BACKUP_DIR/munchkin-data.tar.gz" data/ || fail "tar munchkin-data fehlgeschlagen"

upload_verified "$BACKUP_DIR" "$REMOTE/$DATE" || fail "Upload nach Google Drive fehlgeschlagen"

rotate "$REMOTE" 10 munchkin-data.tar.gz || notify "Munchkin-Backup: Rotation" "Aufräumen alter Backups fehlgeschlagen (Backup selbst ok)"

log "=== Backup abgeschlossen: $DATE ==="
