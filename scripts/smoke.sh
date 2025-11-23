#!/bin/bash
SECONDS_WAITED=0
timeout=30
while [ $SECONDS_WAITED -lt $timeout ]; do
  sleep 1
  SECONDS_WAITED=$((SECONDS_WAITED+1))
  if curl -fsS http://localhost:3000/health > /dev/null; then
    echo "smoke passed; /health response ok"
    exit 0
  fi
done
echo "smoke failed; dumping server."
