/**
 * One-time download of the 78 card scans into `assets/card-scans/`.
 *
 * Deliberately OUTSIDE `public/`: Astro copies all of `public/` into `dist/`,
 * so scans kept there would ship ~306MB of unrequested source art with every
 * deploy. Only the derivatives under `public/cards/` are web-facing.
 *
 * Resumable: files already present are skipped, so an interrupted run can be
 * restarted safely. The originals are gitignored — they are ~235MB of source
 * material that the optimize step turns into the web-sized ladder.
 */

import { existsSync } from 'node:fs'
import { mkdir, rename, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { CARD_SOURCES } from './card-sources.ts'

const OUT_DIR = join(import.meta.dirname, '..', 'assets', 'card-scans')
const CONCURRENCY = 6
const USER_AGENT =
    'daily-tarot/0.1 (educational tarot project; one-time asset fetch)'

interface Result {
    id: string
    status: 'downloaded' | 'skipped' | 'failed'
    bytes?: number
    error?: string
}

async function fetchCard(
    source: (typeof CARD_SOURCES)[number]
): Promise<Result> {
    const target = join(OUT_DIR, `${source.card.id}.png`)

    if (existsSync(target)) {
        const { size } = await stat(target)
        if (size > 0)
            return { id: source.card.id, status: 'skipped', bytes: size }
    }

    try {
        const response = await fetch(source.url, {
            headers: { 'User-Agent': USER_AGENT },
        })
        if (!response.ok) {
            return {
                id: source.card.id,
                status: 'failed',
                error: `HTTP ${response.status}`,
            }
        }
        const buffer = Buffer.from(await response.arrayBuffer())
        // Write to a temp name first so an interrupted run never leaves a
        // truncated file that the resume logic would mistake for complete.
        const temp = `${target}.partial`
        await writeFile(temp, buffer)
        await rename(temp, target)
        return {
            id: source.card.id,
            status: 'downloaded',
            bytes: buffer.length,
        }
    } catch (error) {
        return {
            id: source.card.id,
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
        }
    }
}

async function main() {
    await mkdir(OUT_DIR, { recursive: true })
    console.log(`Fetching ${CARD_SOURCES.length} card scans into ${OUT_DIR}`)

    const queue = [...CARD_SOURCES]
    const results: Result[] = []

    async function worker() {
        while (queue.length > 0) {
            const source = queue.shift()
            if (!source) break
            const result = await fetchCard(source)
            results.push(result)
            const marker =
                result.status === 'downloaded'
                    ? '+'
                    : result.status === 'skipped'
                      ? '='
                      : '!'
            console.log(
                `${marker} [${String(results.length).padStart(2)}/78] ${result.id}` +
                    (result.error ? ` — ${result.error}` : '')
            )
        }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

    const downloaded = results.filter((r) => r.status === 'downloaded')
    const skipped = results.filter((r) => r.status === 'skipped')
    const failed = results.filter((r) => r.status === 'failed')
    const totalBytes = results.reduce((sum, r) => sum + (r.bytes ?? 0), 0)

    console.log(
        `\ndownloaded ${downloaded.length}, skipped ${skipped.length}, failed ${failed.length}` +
            ` — ${(totalBytes / 1024 / 1024).toFixed(1)}MB on disk`
    )

    if (failed.length > 0) {
        console.error('\nFailures:')
        for (const f of failed) console.error(`  ${f.id}: ${f.error}`)
        process.exit(1)
    }
}

await main()
