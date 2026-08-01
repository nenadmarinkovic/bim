#!/bin/sh
set -eu

TO="${BIM_ALERT_TO:?set BIM_ALERT_TO in the unit}"
FROM="${BIM_ALERT_FROM:-bim@localhost}"

unit="$1"
host="$(hostname)"

{
  printf 'From: %s\n' "$FROM"
  printf 'To: %s\n' "$TO"
  printf 'Subject: [bim] %s failed on %s\n' "$unit" "$host"
  printf 'Content-Type: text/plain; charset=utf-8\n\n'
  systemctl status --full --no-pager "$unit" 2>&1 | head -n 20
  printf '\n--- journal ---\n\n'
  journalctl -u "$unit" -n 60 --no-pager 2>&1
} | /usr/bin/msmtp -t
