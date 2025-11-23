#!/bin/bash

# BETRIX Worker Process
echo "Starting BETRIX Worker Process..."
echo "Using managed Redis at: ${REDIS_URL:0:20}..."

# Start the worker
exec node src/worker-complete.js
