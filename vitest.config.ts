/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config'
import { configDefaults } from 'vitest/config'

/**
 * Routed through Astro's own Vite config rather than a bare Vitest config.
 *
 * `getViteConfig` pulls in the Astro Vite plugin, which is what lets
 * `astro/container` and `.astro` component imports resolve inside test files
 * from Phase 2 onward. A bare `defineConfig` from `vitest/config` would leave
 * those imports unresolved.
 */
export default getViteConfig({
    test: {
        environment: 'node',
        setupFiles: ['./src/test-setup.ts'],
        // Agent worktrees under .claude/ carry their own node_modules (a
        // second React), so their copies of these tests must not run here.
        exclude: [...configDefaults.exclude, '.claude/**'],
    },
})
