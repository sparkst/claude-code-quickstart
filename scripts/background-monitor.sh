#!/bin/bash

# Background resource monitor that logs to file
# Usage: ./background-monitor.sh [interval] [duration_minutes]
# Example: ./background-monitor.sh 10 60  (monitor every 10 seconds for 60 minutes)

INTERVAL=${1:-30}  # Default 30 seconds
DURATION_MIN=${2:-60}  # Default 60 minutes
LOG_FILE="/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/resource-monitor.log"
PID_FILE="/tmp/resource-monitor.pid"

# Function to cleanup on exit
cleanup() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Stopping background monitor" >> "$LOG_FILE"
    rm -f "$PID_FILE"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Check if already running
if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
    echo "Background monitor already running (PID: $(cat $PID_FILE))"
    exit 1
fi

# Save PID
echo $$ > "$PID_FILE"

echo "Starting background resource monitor..."
echo "Interval: ${INTERVAL}s, Duration: ${DURATION_MIN}min"
echo "Log file: $LOG_FILE"
echo "PID file: $PID_FILE"
echo "To stop: kill $(cat $PID_FILE)"

# Initialize log
echo "$(date '+%Y-%m-%d %H:%M:%S') - Starting background monitor (PID: $$, Interval: ${INTERVAL}s)" >> "$LOG_FILE"

END_TIME=$(($(date +%s) + (DURATION_MIN * 60)))

while [ $(date +%s) -lt $END_TIME ]; do
    # Get current stats
    cpu_info=$(top -l 1 | grep "CPU usage")
    cpu_user=$(echo "$cpu_info" | awk '{print $3}' | tr -d '%')
    cpu_sys=$(echo "$cpu_info" | awk '{print $5}' | tr -d '%')
    cpu_total=$(echo "$cpu_user + $cpu_sys" | bc)

    # Memory calculation
    vm_output=$(vm_stat)
    page_size=16384
    pages_free=$(echo "$vm_output" | grep "Pages free:" | awk '{print $3}' | tr -d '.')
    pages_active=$(echo "$vm_output" | grep "Pages active:" | awk '{print $3}' | tr -d '.')
    pages_inactive=$(echo "$vm_output" | grep "Pages inactive:" | awk '{print $3}' | tr -d '.')
    pages_wired=$(echo "$vm_output" | grep "Pages wired down:" | awk '{print $4}' | tr -d '.')

    used_pages=$((pages_active + pages_inactive + pages_wired))
    used_gb=$(echo "scale=1; $used_pages * $page_size / 1024 / 1024 / 1024" | bc)

    load_avg=$(uptime | awk -F'load averages:' '{print $2}' | awk '{print $1}' | tr -d ',')

    # Agent recommendation
    if (( $(echo "$cpu_total > 70" | bc -l) )) || (( $(echo "$used_gb > 20" | bc -l) )); then
        agents="2"
        status="HIGH"
    elif (( $(echo "$cpu_total > 50" | bc -l) )) || (( $(echo "$used_gb > 16" | bc -l) )); then
        agents="3"
        status="MOD"
    else
        agents="4-5"
        status="OPT"
    fi

    # Log entry
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "$timestamp,CPU:${cpu_total}%,MEM:${used_gb}GB,LOAD:${load_avg},AGENTS:${agents},STATUS:${status}" >> "$LOG_FILE"

    sleep $INTERVAL
done

cleanup