#!/bin/bash

# MacBook Air M3 Resource Monitor for Parallel Agent Execution
# Usage: ./monitor-resources.sh [interval_seconds]

INTERVAL=${1:-5}
LOG_FILE="resource-monitor.log"

echo "=== MacBook Air M3 Resource Monitor ==="
echo "Hardware: 8-core M3, 24GB RAM"
echo "Monitoring every ${INTERVAL} seconds..."
echo "Press Ctrl+C to stop"
echo

# Function to get memory usage in GB
get_memory_usage() {
    local vm_stat_output=$(vm_stat)
    local page_size=16384

    local pages_free=$(echo "$vm_stat_output" | grep "Pages free:" | awk '{print $3}' | tr -d '.')
    local pages_active=$(echo "$vm_stat_output" | grep "Pages active:" | awk '{print $3}' | tr -d '.')
    local pages_inactive=$(echo "$vm_stat_output" | grep "Pages inactive:" | awk '{print $3}' | tr -d '.')
    local pages_wired=$(echo "$vm_stat_output" | grep "Pages wired down:" | awk '{print $4}' | tr -d '.')
    local pages_compressed=$(echo "$vm_stat_output" | grep "Pages occupied by compressor:" | awk '{print $5}' | tr -d '.' || echo "0")

    local used_pages=$((pages_active + pages_inactive + pages_wired + pages_compressed))
    local total_pages=$((used_pages + pages_free))

    local used_gb=$(echo "scale=2; $used_pages * $page_size / 1024 / 1024 / 1024" | bc)
    local total_gb=$(echo "scale=2; $total_pages * $page_size / 1024 / 1024 / 1024" | bc)
    local free_gb=$(echo "scale=2; $pages_free * $page_size / 1024 / 1024 / 1024" | bc)

    echo "$used_gb $total_gb $free_gb"
}

# Function to get CPU usage
get_cpu_usage() {
    top -l 2 | tail -n 1 | grep "CPU usage" | awk '{print $3}' | tr -d '%'
}

# Function to recommend agent count
recommend_agents() {
    local cpu_usage=$1
    local free_memory=$2

    # Base recommendation on available resources
    local cpu_based=8  # Start with core count
    local memory_based=8  # Assume ~2-3GB per agent for safety

    # Adjust based on current CPU usage
    if (( $(echo "$cpu_usage > 70" | bc -l) )); then
        cpu_based=2
    elif (( $(echo "$cpu_usage > 50" | bc -l) )); then
        cpu_based=3
    elif (( $(echo "$cpu_usage > 30" | bc -l) )); then
        cpu_based=5
    fi

    # Adjust based on available memory (conservative 3GB per agent)
    memory_based=$(echo "scale=0; $free_memory / 3" | bc)

    # Take the minimum of CPU and memory constraints
    local recommended=$(echo "$cpu_based $memory_based" | awk '{print ($1 < $2) ? $1 : $2}')

    # Ensure at least 1, max 6 for stability
    if (( $(echo "$recommended < 1" | bc -l) )); then
        recommended=1
    elif (( $(echo "$recommended > 6" | bc -l) )); then
        recommended=6
    fi

    echo "$recommended"
}

# Monitor loop
while true; do
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    # Get CPU usage
    cpu_user=$(top -l 1 | grep "CPU usage" | awk '{print $3}' | tr -d '%')
    cpu_sys=$(top -l 1 | grep "CPU usage" | awk '{print $5}' | tr -d '%')
    cpu_total=$(echo "$cpu_user + $cpu_sys" | bc)

    # Get memory usage
    memory_info=$(get_memory_usage)
    used_gb=$(echo $memory_info | awk '{print $1}')
    total_gb=$(echo $memory_info | awk '{print $2}')
    free_gb=$(echo $memory_info | awk '{print $3}')

    # Get load average
    load_avg=$(uptime | awk -F'load averages:' '{print $2}' | awk '{print $1}' | tr -d ',')

    # Calculate recommendations
    recommended_agents=$(recommend_agents $cpu_total $free_gb)

    # Calculate memory percentage
    memory_pct=$(echo "scale=1; $used_gb * 100 / $total_gb" | bc)

    # Display current status
    echo "[$timestamp]"
    echo "CPU Usage: ${cpu_total}% (User: ${cpu_user}%, System: ${cpu_sys}%)"
    echo "Memory: ${used_gb}GB / ${total_gb}GB (${memory_pct}% used, ${free_gb}GB free)"
    echo "Load Average: ${load_avg}"
    echo "🤖 Recommended Parallel Agents: ${recommended_agents}"

    # Performance status indicator
    if (( $(echo "$cpu_total > 80" | bc -l) )) || (( $(echo "$memory_pct > 85" | bc -l) )); then
        echo "🔴 HIGH RESOURCE USAGE - Consider reducing agents"
    elif (( $(echo "$cpu_total > 60" | bc -l) )) || (( $(echo "$memory_pct > 70" | bc -l) )); then
        echo "🟡 MODERATE RESOURCE USAGE - Monitor closely"
    else
        echo "🟢 OPTIMAL RESOURCE USAGE - Safe for parallel processing"
    fi

    echo "----------------------------------------"

    # Log to file
    echo "[$timestamp] CPU:${cpu_total}% Memory:${used_gb}/${total_gb}GB Load:${load_avg} Agents:${recommended_agents}" >> "$LOG_FILE"

    sleep $INTERVAL
done