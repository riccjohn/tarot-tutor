/**
 * Turns the downloaded scans into the responsive ladder the site actually ships.
 *
 * Two decisions worth knowing about:
 *
 * 1. Every output is resized to an identical size with `fit: 'cover'`. The
 *    source scans vary in width (1090-1144px) while sharing a 1920px height,
 *    so without normalising, cards in a spread would not line up. The crop is
 *    under 2% and lands on the card's white border.
 *
 * 2. The ladder stops at 960px because the narrowest source is 1090px wide.
 *    Going higher would upscale. 960px covers a 320px-wide card at 3x DPR,
 *    which is the mobile-first case that matters.
 *
 * 3. WebP was dropped (Phase 3b). AVIF has 95%+ browser support and beats
 *    WebP at every quality point on this content, so shipping both bought
 *    nothing but 50MB of committed git weight. AVIF covers modern browsers;
 *    the single JPEG rung below is the fallback for the rest. Quality was
 *    also turned down a step from the Phase 3 pass (avif 55->45, jpeg
 *    82->68) after spot-checking that linework stays legible at 640/960.
 */

import { existsSync } from 'node:fs'
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'

const SRC_DIR = join(import.meta.dirname, '..', 'assets', 'card-scans')
const OUT_DIR = join(import.meta.dirname, '..', 'public', 'cards')

/** Source aspect ratio, from the scans: 1110 x 1920. */
export const CARD_ASPECT = 1110 / 1920
export const WIDTHS = [160, 320, 480, 640, 960] as const
/** Single raster fallback for the `<img src>` attribute. */
const FALLBACK_WIDTH = 640

const CONCURRENCY = 4

function heightFor(width: number): number {
    return Math.round(width / CARD_ASPECT)
}

async function processCard(file: string): Promise<number> {
    const id = file.replace(/\.png$/, '')
    const source = join(SRC_DIR, file)
    let written = 0

    for (const width of WIDTHS) {
        const height = heightFor(width)
        const target = join(OUT_DIR, 'avif', `${id}-${width}.avif`)
        if (!existsSync(target)) {
            const buffer = await sharp(source)
                .resize(width, height, { fit: 'cover', position: 'center' })
                .avif({ quality: 45 })
                .toBuffer()
            await writeFile(target, buffer)
            written++
        }
    }

    const fallback = join(OUT_DIR, 'jpeg', `${id}-${FALLBACK_WIDTH}.jpg`)
    if (!existsSync(fallback)) {
        const buffer = await sharp(source)
            .resize(FALLBACK_WIDTH, heightFor(FALLBACK_WIDTH), {
                fit: 'cover',
                position: 'center',
            })
            .jpeg({ quality: 68, mozjpeg: true })
            .toBuffer()
        await writeFile(fallback, buffer)
        written++
    }

    return written
}

async function main() {
    for (const dir of ['avif', 'jpeg']) {
        await mkdir(join(OUT_DIR, dir), { recursive: true })
    }

    const files = (await readdir(SRC_DIR)).filter((f) => f.endsWith('.png'))
    if (files.length !== 78) {
        console.error(
            `Expected 78 source scans, found ${files.length}. Run \`pnpm cards:fetch\` first.`
        )
        process.exit(1)
    }

    console.log(
        `Optimising ${files.length} cards into ${WIDTHS.length} widths...`
    )

    const queue = [...files]
    let done = 0
    let written = 0

    async function worker() {
        while (queue.length > 0) {
            const file = queue.shift()
            if (!file) break
            written += await processCard(file)
            done++
            if (done % 10 === 0 || done === files.length) {
                console.log(`  ${done}/${files.length} cards`)
            }
        }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))
    console.log(`Done. ${written} files written.`)
}

await main()
