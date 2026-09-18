/**
 * Global Vitest setup.
 *
 * `@testing-library/react` only self-registers its `afterEach(cleanup)`
 * when it detects a global `afterEach` at import time. This project runs
 * Vitest with `globals: false` (test files import `describe`/`it`/`expect`
 * explicitly), so that self-registration never fires and DOM trees from one
 * `render()` call could otherwise leak into the next test's
 * `document.body`. Registering `cleanup` here — via an explicitly imported
 * `afterEach`, not a global — restores per-test isolation without turning
 * on Vitest's global test API everywhere. (`src/test-rtl.ts`, wired in via
 * `test.alias`, additionally cleans up before every `render()` call, for
 * tests that render more than once within a single `it()`.)
 */

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
    cleanup()
})
