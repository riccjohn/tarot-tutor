#!/usr/bin/env bash
#
# PreToolUse guard — tracked test files are immutable.
#
# This repo's design language is free to change completely, because its tests
# assert on `data-testid`, `data-*` and section DOM order rather than on CSS
# classes. That freedom is only real while the tests hold still.
#
# An agent that "fixes" a failing test instead of the implementation silently
# destroys the contract, and the damage is near-invisible in review because the
# diff looks like an ordinary test update. So the rule is mechanical, not
# advisory.
#
# Creating a NEW test file is allowed. Editing one already tracked in git is not.
#
#   exit 0 -> allow
#   exit 2 -> deny; stderr is shown to the agent

set -uo pipefail

input="$(cat)"

path="$(jq -r '.tool_input.file_path // empty' <<<"$input" 2>/dev/null)"
[[ -z "$path" ]] && exit 0

# Covers *.test.ts / *.test.tsx and everything under a __tests__ directory —
# the latter deliberately includes shared contract modules such as
# section-order-contract.ts, which is the contract itself.
case "$path" in
*__tests__*) ;;
*.test.ts | *.test.tsx) ;;
*) exit 0 ;;
esac

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 0

rel="${path#"$ROOT"/}"

# Untracked file -> a new test -> allowed.
git ls-files --error-unmatch -- "$rel" >/dev/null 2>&1 || exit 0

cat >&2 <<EOF
Blocked: '$rel' is a tracked test file, and tracked tests are immutable here.

These tests pin the frozen markup contract — data-testid names, data-* attributes
and section DOM order. A failing tracked test means the implementation drifted
from the contract, so change the implementation, not the assertion.

Allowed: creating a new test file.
Not allowed: editing, rewriting or deleting this one.

If you are genuinely convinced the test itself encodes the wrong contract, stop
and explain why to the user. Do not route around this guard.
EOF
exit 2
