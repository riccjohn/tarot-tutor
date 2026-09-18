/**
 * Builds the manifest that components read to render the responsive image
 * ladder, so nothing at render time needs to glob `public/cards/`.
 *
 * The width/aspect-ratio constants below mirror `scripts/optimize-images.ts`.
 * They are duplicated rather than imported because that script runs its
 * `main()` unconditionally at module load (it is meant to be executed
 * directly, not imported), so importing it here would kick off a full
 * re-optimise pass as a side effect. If the ladder in `optimize-images.ts`
 * changes, update these to match.
 *
 * WebP was dropped from the ladder (Phase 3b) to cut committed git weight:
 * AVIF alone covers modern browsers, with the JPEG rung as the fallback.
 *
 * Run after `pnpm cards:optimize` has produced the derivatives:
 *   pnpm images:manifest
 */

import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DECK } from '../src/lib/deck.ts'

const ROOT_DIR = join(import.meta.dirname, '..')
const PUBLIC_DIR = join(ROOT_DIR, 'public')
const MANIFEST_PATH = join(ROOT_DIR, 'src', 'data', 'card-images.json')

/** Source aspect ratio, from the scans: 1110 x 1920. Mirrors CARD_ASPECT. */
const CARD_ASPECT = 1110 / 1920
const WIDTHS = [160, 320, 480, 640, 960] as const
const FALLBACK_WIDTH = 640

function heightFor(width: number): number {
    return Math.round(width / CARD_ASPECT)
}

interface Rung {
    width: number
    height: number
    src: string
}

interface CardImageEntry {
    /** Card display name, handy as a default `alt`. */
    name: string
    aspectRatio: number
    avif: Rung[]
    /** Single `<img src>` fallback for browsers without srcset support. */
    fallback: Rung
}

function rungsFor(id: string, format: 'avif'): Rung[] {
    return WIDTHS.map((width) => ({
        width,
        height: heightFor(width),
        src: `/cards/${format}/${id}-${width}.${format}`,
    }))
}

function fallbackFor(id: string): Rung {
    return {
        width: FALLBACK_WIDTH,
        height: heightFor(FALLBACK_WIDTH),
        src: `/cards/jpeg/${id}-${FALLBACK_WIDTH}.jpg`,
    }
}

function assertFileExists(publicPath: string): void {
    const diskPath = join(PUBLIC_DIR, publicPath)
    if (!existsSync(diskPath)) {
        throw new Error(
            `Missing derivative "${publicPath}". Run \`pnpm cards:optimize\` first.`
        )
    }
}

async function main() {
    const manifest: Record<string, CardImageEntry> = {}

    for (const card of DECK) {
        const avif = rungsFor(card.id, 'avif')
        const fallback = fallbackFor(card.id)

        for (const rung of [...avif, fallback]) {
            assertFileExists(rung.src)
        }

        manifest[card.id] = {
            name: card.name,
            aspectRatio: CARD_ASPECT,
            avif,
            fallback,
        }
    }

    const ids = Object.keys(manifest)
    if (ids.length !== DECK.length) {
        throw new Error(
            `Expected ${DECK.length} manifest entries, built ${ids.length}.`
        )
    }

    await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 4) + '\n')
    console.log(`Wrote ${ids.length} card entries to src/data/card-images.json`)
}

await main()
