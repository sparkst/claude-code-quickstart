#!/bin/bash

# Quick resource status check for parallel agent management
# Usage: ./quick-status.sh

echo "=== Quick Resource Status ==="

# Get CPU usage
cpu_info=$(top -l 1 | grep "CPU usage")
cpu_user=$(echo "$cpu_info" | awk '{print $3}' | tr -d '%')
cpu_sys=$(echo "$cpu_info" | awk '{print $5}' | tr -d '%')
cpu_total=$(echo "$cpu_user + $cpu_sys" | bc)

# Get memory info
vm_output=$(vm_stat)
page_size=16384
pages_free=$(echo "$vm_output" | grep "Pages free:" | awk '{print $3}' | tr -d '.')
pages_active=$(echo "$vm_output" | grep "Pages active:" | awk '{print $3}' | tr -d '.')
pages_inactive=$(echo "$vm_output" | grep "Pages inactive:" | awk '{print $3}' | tr -d '.')
pages_wired=$(echo "$vm_output" | grep "Pages wired down:" | awk '{print $4}' | tr -d '.')

used_pages=$((pages_active + pages_inactive + pages_wired))
total_pages=$((used_pages + pages_free))
used_gb=$(echo "scale=1; $used_pages * $page_size / 1024 / 1024 / 1024" | bc)
free_gb=$(echo "scale=1; $pages_free * $page_size / 1024 / 1024 / 1024" | bc)
total_gb=24

# Load average
load_avg=$(uptime | awk -F'load averages:' '{print $2}' | awk '{print $1}' | tr -d ',')

# Quick recommendation
if (( $(echo "$cpu_total > 70" | bc -l) )) || (( $(echo "$used_gb > 20" | bc -l) )); then
    agents="2-3"
    status="🔴 HIGH"
elif (( $(echo "$cpu_total > 50" | bc -l) )) || (( $(echo "$used_gb > 16" | bc -l) )); then
    agents="3-4"
    status="🟡 MODERATE"
else
    agents="4-5"
    status="🟢 OPTIMAL"
fi

echo "CPU: ${cpu_total}% | Memory: ${used_gb}/${total_gb}GB | Load: ${load_avg}"
echo "Status: ${status} | Recommended Agents: ${agents}"