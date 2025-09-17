#!/bin/bash

# Agent Management Dashboard
# Usage: ./agent-dashboard.sh

clear
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    PARALLEL AGENT DASHBOARD                  ║"
echo "║                    MacBook Air M3 - 8 Core, 24GB            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo

# Get current status
status_output=$(/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/scripts/quick-status.sh)
echo "$status_output"
echo

# Performance thresholds
echo "📊 PERFORMANCE THRESHOLDS:"
echo "   🟢 OPTIMAL:   CPU <50%, Memory <16GB → 4-5 agents"
echo "   🟡 MODERATE:  CPU 50-70%, Memory 16-20GB → 3-4 agents"
echo "   🔴 HIGH:      CPU >70%, Memory >20GB → 2-3 agents"
echo

# Usage guide
echo "🚀 MONITORING COMMANDS:"
echo "   Quick Check:     ./scripts/quick-status.sh"
echo "   Live Monitor:    ./scripts/monitor-resources.sh [interval]"
echo "   Background Log:  ./scripts/background-monitor.sh [interval] [minutes]"
echo "   View Log:        tail -f resource-monitor.log"
echo

# Agent management tips
echo "🤖 AGENT MANAGEMENT TIPS:"
echo "   • Start with 3 agents and monitor performance"
echo "   • Check status every 10-15 minutes during parallel execution"
echo "   • Reduce agents if CPU >70% or memory >20GB"
echo "   • Each agent typically uses 2-3GB RAM and 10-15% CPU"
echo "   • Monitor load average - keep under 6.0 for stability"
echo

# Check if background monitor is running
if [ -f "/tmp/resource-monitor.pid" ] && kill -0 $(cat /tmp/resource-monitor.pid) 2>/dev/null; then
    echo "✅ Background monitor is running (PID: $(cat /tmp/resource-monitor.pid))"
else
    echo "⚪ Background monitor not running"
    echo "   Start with: ./scripts/background-monitor.sh &"
fi

echo
echo "Press any key to refresh, Ctrl+C to exit"
read -n 1 -s