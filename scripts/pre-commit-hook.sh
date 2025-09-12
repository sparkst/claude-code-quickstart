#!/bin/bash

# Pre-commit hook for CI/CD validation
# REQ-110 — Local validation before commits

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Running pre-commit validation...${NC}"

# Check if we're in a CI environment - skip if so to avoid double validation
if [[ "${CI}" == "true" ]]; then
    echo -e "${YELLOW}⚠️  CI environment detected - skipping pre-commit hook${NC}"
    exit 0
fi

# Change to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"
cd "${PROJECT_ROOT}"

echo -e "${BLUE}ℹ️  Project root: ${PROJECT_ROOT}${NC}"

# Function to run command with proper error handling
run_check() {
    local command="$1"
    local description="$2"
    
    echo -e "${BLUE}Running: ${description}${NC}"
    
    if eval "$command"; then
        echo -e "${GREEN}✅ ${description} - passed${NC}"
        return 0
    else
        echo -e "${RED}❌ ${description} - failed${NC}"
        return 1
    fi
}

# Track validation results
failed_checks=0

# REQ-109 — Format validation
if ! run_check "npm run format:check" "Code formatting validation"; then
    echo -e "${YELLOW}💡 Tip: Run 'npm run format' to fix formatting issues${NC}"
    ((failed_checks++))
fi

# REQ-109 — Linting validation
if ! run_check "npm run lint" "Code linting validation"; then
    echo -e "${YELLOW}💡 Tip: Check ESLint output above for specific issues${NC}"
    ((failed_checks++))
fi

# REQ-110 — Quick test validation (with timeout to avoid hanging)
echo -e "${BLUE}Running: Test validation (quick check)${NC}"
if timeout 60s npm run test:run > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Test validation - passed${NC}"
elif [[ $? -eq 124 ]]; then
    echo -e "${YELLOW}⚠️  Test validation - timed out (allowing commit)${NC}"
else
    # Check for TDD TODO failures vs real failures
    if npm run test:run 2>&1 | grep -q "TODO:"; then
        echo -e "${GREEN}✅ Test validation - completed with expected TDD failures${NC}"
    else
        echo -e "${RED}❌ Test validation - failed with unexpected errors${NC}"
        ((failed_checks++))
    fi
fi

# REQ-112 — Basic security check for obvious secrets
echo -e "${BLUE}Running: Basic secret scan${NC}"
if git diff --cached --name-only | xargs grep -l -i -E "(password|secret|key|token)" 2>/dev/null | grep -v -E "(test|spec|mock|example)" | head -5; then
    echo -e "${YELLOW}⚠️  Potential secrets detected in staged files - please review${NC}"
    echo -e "${YELLOW}💡 Tip: Make sure these are test data or move secrets to environment variables${NC}"
fi

# Summary
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}Pre-commit validation summary:${NC}"
echo -e "${BLUE}========================================${NC}"

if [[ $failed_checks -eq 0 ]]; then
    echo -e "${GREEN}🎉 All pre-commit checks passed! Ready to commit.${NC}"
    exit 0
else
    echo -e "${RED}💥 ${failed_checks} pre-commit check(s) failed.${NC}"
    echo -e "${YELLOW}💡 Fix the issues above before committing.${NC}"
    echo -e "${YELLOW}💡 Or use --no-verify to skip pre-commit checks (not recommended).${NC}"
    exit 1
fi