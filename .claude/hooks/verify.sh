#!/usr/bin/env bash
#
# Stop hook — the inner-loop gate.
#
# Design rule: swallow success, surface only failure. Output from a passing
# check floods the agent's context and measurably degrades it; a silent exit 0
# costs nothing. So this script prints nothing at all when the gate passes.
#
#   exit 0  -> silent; the agent is allowed to stop.
#   exit 2  -> stderr is fed back to the agent, which re-engages to fix it.
#
# The whole gate runs in ~10s (check ~4s, test ~1.5s, build ~4s), which is why
# it can afford to run on every stop rather than being deferred to CI.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 0

input="$(cat)"

# Claude Code sets stop_hook_active when the agent was itself re-engaged by
# this hook. Blocking again there would loop forever, so let it stop and let
# the human see the failure instead.
if [[ "$(jq -r '.stop_hook_active // false' <<<"$input" 2>/dev/null)" == "true" ]]; then
    exit 0
fi

# Only gate when something the gate actually covers has changed. A docs-only
# turn should not pay 10s, and should not risk a spurious block. Both the
# working tree and any commits made on this branch count, so committing
# without running the gate does not slip past it.
GATED_PATHS=(src scripts public astro.config.mjs tsconfig.json vitest.config.ts package.json)

if git rev-parse --git-dir >/dev/null 2>&1; then
    dirty="$(git status --porcelain -- "${GATED_PATHS[@]}" 2>/dev/null)"

    base="$(git merge-base HEAD main 2>/dev/null ||
        git merge-base HEAD origin/main 2>/dev/null ||
        true)"
    committed=''
    if [[ -n "$base" ]]; then
        committed="$(git diff --name-only "$base"...HEAD -- "${GATED_PATHS[@]}" 2>/dev/null)"
    fi

    if [[ -z "$dirty" && -z "$committed" ]]; then
        exit 0
    fi
fi

# Run one gate step. On failure, emit the tail of its output and stop the world.
run() {
    local label="$1"
    shift
    local out
    if ! out="$("$@" 2>&1)"; then
        {
            printf 'Gate failed: %s\n\n' "$label"
            printf '%s\n' "$out" | tail -60
            printf '\n---\n'
            printf 'Fix the implementation. Do not edit a tracked test file to make this pass\n'
            printf '(see CLAUDE.md, "The frozen markup contract").\n'
        } >&2
        exit 2
    fi
}

run 'pnpm check' pnpm check
run 'pnpm test' pnpm test
run 'pnpm build' pnpm build

exit 0
