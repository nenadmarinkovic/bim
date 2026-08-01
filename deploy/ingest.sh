#!/bin/sh
# An interrupted download stays "fresh" for 12h by mtime, so the cache is cleared between attempts.
set -eu

cd "$(dirname "$0")/.."

attempt=1
while [ "$attempt" -le 3 ]; do
  if npm run ingest; then
    exit 0
  fi
  echo "ingest attempt $attempt failed"
  rm -rf .cache/ingest
  attempt=$((attempt + 1))
  [ "$attempt" -le 3 ] && sleep 120
done

echo "ingest failed after 3 attempts; artifacts left untouched"
exit 1
