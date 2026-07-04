#!/usr/bin/env bash
# Run browser E2E tests headlessly with Google Chrome.
# The project HTTP server must be available on port 8000.
# Usage: ./tests/run-e2e.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PORT=8000
BASE_URL="http://localhost:${PORT}"

CHROME_BIN="${CHROME_BIN:-google-chrome}"
if ! command -v "${CHROME_BIN}" >/dev/null 2>&1; then
    echo "Error: ${CHROME_BIN} not found. Set CHROME_BIN to a Chrome executable." >&2
    exit 1
fi

# Start a local HTTP server if one is not already running on port 8000.
STARTED_SERVER=0
if ! curl -s "${BASE_URL}/" >/dev/null 2>&1; then
    echo "Starting HTTP server on port ${PORT}..."
    cd "${PROJECT_ROOT}"
    python3 -m http.server "${PORT}" >/tmp/ipms-e2e-server.log 2>&1 &
    SERVER_PID=$!
    STARTED_SERVER=1
    # Wait for the server to come up.
    for _ in $(seq 1 30); do
        if curl -s "${BASE_URL}/" >/dev/null 2>&1; then
            break
        fi
        sleep 0.1
    done
    if ! curl -s "${BASE_URL}/" >/dev/null 2>&1; then
        echo "Error: HTTP server failed to start." >&2
        exit 1
    fi
fi

TESTS=(
    "tests/package-ip-wizard-e2e.html"
    "tests/address-region-editor-e2e.html"
    "tests/signal-connection-e2e.html"
    "tests/validation-report-panel-e2e.html"
)

TOTAL_PASSED=0
TOTAL_FAILED=0
FAILED_TESTS=()

run_test() {
    local test_path="$1"
    local url="${BASE_URL}/${test_path}?autorun=1"
    local name
    name="$(basename "${test_path}" .html)"

    echo "Running ${name}..."
    local output
    output="$(${CHROME_BIN} \
        --headless \
        --disable-gpu \
        --no-sandbox \
        --virtual-time-budget=5000 \
        --dump-dom "${url}" 2>/dev/null)"

    local result_line
    result_line="$(echo "${output}" | grep -oE '[0-9]+ passed, [0-9]+ failed' | head -n 1)"

    if [[ -z "${result_line}" ]]; then
        echo "  ✗ ${name}: could not parse results" >&2
        FAILED_TESTS+=("${name}")
        return
    fi

    local passed failed
    passed="$(echo "${result_line}" | grep -oE '^[0-9]+' | head -n 1)"
    failed="$(echo "${result_line}" | grep -oE '[0-9]+ failed' | grep -oE '^[0-9]+')"

    TOTAL_PASSED=$((TOTAL_PASSED + passed))
    TOTAL_FAILED=$((TOTAL_FAILED + failed))

    if [[ "${failed}" -eq 0 ]]; then
        echo "  ✓ ${name}: ${passed} passed"
    else
        echo "  ✗ ${name}: ${passed} passed, ${failed} failed" >&2
        FAILED_TESTS+=("${name}")
    fi
}

for test_path in "${TESTS[@]}"; do
    run_test "${test_path}"
done

if [[ "${STARTED_SERVER}" -eq 1 ]]; then
    echo "Stopping HTTP server..."
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
fi

echo ""
echo "Total: ${TOTAL_PASSED} passed, ${TOTAL_FAILED} failed"

if [[ "${TOTAL_FAILED}" -gt 0 || "${#FAILED_TESTS[@]}" -gt 0 ]]; then
    exit 1
fi
exit 0
