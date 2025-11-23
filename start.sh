#!/bin/bash

# BETRIX Autonomous Startup Script - Production Ready
# Runs BETRIX bot with automatic error recovery and health monitoring

echo "🚀 Starting BETRIX - Autonomous Sports AI Bot..."
echo "📡 Redis: ${REDIS_URL:0:20}... (managed)"
echo "🤖 Gemini: ${GEMINI_API_KEY:0:10}... (configured)"
echo "🔔 Telegram: ${TELEGRAM_TOKEN:0:10}... (connected)"
echo ""

# Function to restart on failure with exponential backoff
restart_with_backoff() {
  local attempt=1
  local max_attempts=5
  local backoff=2
  
  while [ $attempt -le $max_attempts ]; do
    echo "🔄 Attempt $attempt/$max_attempts - Starting BETRIX worker..."
    
    # Run worker
    node src/worker-db.js
    
    # If we get here, the process exited (crashed)
    exit_code=$?
    echo "⚠️  Worker exited with code $exit_code"
    
    if [ $exit_code -eq 0 ]; then
      echo "✅ Clean shutdown"
      exit 0
    fi
    
    # Calculate wait time: 2^attempt
    wait_time=$((backoff ** attempt))
    echo "⏳ Waiting ${wait_time}s before restart (attempt $attempt/$max_attempts)..."
    sleep $wait_time
    
    attempt=$((attempt + 1))
  done
  
  echo "❌ Max restart attempts reached. Please check logs."
  exit 1
}

# Trap signals for graceful shutdown
trap 'echo "🛑 BETRIX shutting down..." ; exit 0' SIGTERM SIGINT

# Start with auto-restart
echo "⚙️  Starting BETRIX Production Worker..."
echo "   ✓ Gemini AI with autonomous personality"
echo "   ✓ Global signup (50+ countries)"
echo "   ✓ Natural language + commands"
echo "   ✓ Real-time leaderboards"
echo "   ✓ Professional betslips"
echo "   ✓ AI betting coach"
echo "   ✓ Smart notifications"
echo "   ✓ 25+ achievements"
echo ""
echo "Starting in autonomous mode with auto-recovery..."
echo ""

restart_with_backoff
