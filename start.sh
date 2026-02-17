#!/bin/bash
# Production startup script for META-AI 2.0

PROJECT_DIR="/Users/kenya/Downloads/META-AI 2.0"
LOG_FILE="$PROJECT_DIR/app.log"

echo "🚀 Starting META-AI 2.0..."
echo "📍 Project: $PROJECT_DIR"
echo "📝 Logs: $LOG_FILE"

# Kill any existing process
pkill -9 -f "python3 run.py" 2>/dev/null

# Wait for port to be free
sleep 2
lsof -i :5010 | grep LISTEN | awk '{print $2}' | xargs kill -9 2>/dev/null

sleep 1

# Start the app
cd "$PROJECT_DIR"
/usr/bin/python3 run.py > "$LOG_FILE" 2>&1 &

sleep 2

# Check if it started
if lsof -i :5010 > /dev/null; then
    echo "✅ Server started successfully!"
    echo "🌐 Visit: http://localhost:5010"
    echo "📊 Logs: tail -f $LOG_FILE"
else
    echo "❌ Server failed to start"
    tail -20 "$LOG_FILE"
fi
