#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# lint-service-role.sh
#
# CI lint script that detects if service_role_key, SUPABASE_SERVICE_ROLE_KEY,
# or supabaseAdmin are referenced in client-side code.
#
# Client-side code is defined as:
#   - src/components/**
#   - src/app/(pages)/**
#   - Any .tsx file NOT inside src/app/api/ or src/lib/
#
# Exit codes:
#   0 — No violations found (clean)
#   1 — Violations detected
# ---------------------------------------------------------------------------

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Patterns to search for (case-insensitive)
PATTERNS="service_role|SUPABASE_SERVICE_ROLE_KEY|supabaseAdmin"

VIOLATIONS=0

echo "=== RLS Lint: Checking for service_role usage in client-side code ==="
echo ""

# 1. Check src/components/
if [ -d "$PROJECT_ROOT/src/components" ]; then
    HITS=$(grep -rniE "$PATTERNS" "$PROJECT_ROOT/src/components" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null || true)
    if [ -n "$HITS" ]; then
        echo "VIOLATION in src/components/:"
        echo "$HITS"
        echo ""
        VIOLATIONS=1
    fi
fi

# 2. Check src/app/(pages)/
if [ -d "$PROJECT_ROOT/src/app/(pages)" ]; then
    HITS=$(grep -rniE "$PATTERNS" "$PROJECT_ROOT/src/app/(pages)" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null || true)
    if [ -n "$HITS" ]; then
        echo "VIOLATION in src/app/(pages)/:"
        echo "$HITS"
        echo ""
        VIOLATIONS=1
    fi
fi

# 3. Check .tsx files outside src/app/api/ and src/lib/
#    This catches any other client-facing .tsx files (e.g. layout.tsx, page.tsx, contexts)
if [ -d "$PROJECT_ROOT/src" ]; then
    HITS=$(find "$PROJECT_ROOT/src" -name "*.tsx" \
        ! -path "*/src/app/api/*" \
        ! -path "*/src/lib/*" \
        -exec grep -lniE "$PATTERNS" {} + 2>/dev/null || true)
    if [ -n "$HITS" ]; then
        echo "VIOLATION in .tsx files outside api/ and lib/:"
        for f in $HITS; do
            # Show the file relative to project root
            REL="${f#$PROJECT_ROOT/}"
            echo "  $REL:"
            grep -niE "$PATTERNS" "$f" 2>/dev/null | sed 's/^/    /'
        done
        echo ""
        VIOLATIONS=1
    fi
fi

# Final verdict
if [ "$VIOLATIONS" -eq 1 ]; then
    echo "FAIL: service_role / supabaseAdmin references found in client-side code."
    echo "      These must only be used in src/app/api/ or src/lib/ (server-side)."
    exit 1
else
    echo "PASS: No service_role references in client-side code."
    exit 0
fi
