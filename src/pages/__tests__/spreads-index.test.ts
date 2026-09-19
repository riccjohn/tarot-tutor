import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { parseHTML } from 'linkedom'
import { beforeAll, describe, expect, it } from 'vitest'
import type { PieceStatus } from '../../lib/content/compose'
import { SPREADS, type SpreadGeometry, type SpreadId } from '../../lib/spreads'
import SpreadIndexPage, { type SpreadIndexEntry } from '../spreads/index.astro'

/**
 * Phase 8: every row on `/spreads` gets a miniature geometry diagram — one
 * decorative marker per position, positioned by that spread's own `x`/`y`
 * from `src/lib/spreads.ts` (the geometry source of truth). The diagram
 * carries no independent meaning (the row's title and summary already say
 * what the spread is), so it is `aria-hidden="true"`.
 *
 * This file does NOT re-assert ladder ordering or the `data-extends-id`
 * relationship's *shape* — `spread-page.test.ts`'s "spreads index: ladder
 * order" describe block already owns that contract for this same page. It
 * only adds the diagram contract, plus one pinning check that adding the
 * diagram doesn't clobber the existing extends marker.
 *
 * Selectors (new, chosen to avoid colliding with any existing
 * `data-testid` in the codebase — see `section-order-contract.ts`'s
 * `CARD_PAGE_TESTIDS` and `SpreadLayout.astro`'s `spread-position`/
 * `spread-card-link`/`spread-reversal-note`, none of which this file
 * reuses):
 *   - row: found structurally, not by a new testid — the `<li>` that
 *     contains the existing `[data-testid="spread-index-entry"]
 *     [data-spread-id="<id>"]` anchor (`spreads/index.astro` renders one
 *     `<li>` per spread today; read it before this file was written).
 *   - diagram: `[data-testid="spread-diagram"]`, one per row, `aria-hidden="true"`.
 *   - marker: `[data-testid="spread-marker"]`, one per position, in
 *     position order, carrying that position's `data-x`/`data-y`.
 *
 * Rendered with `experimental_AstroContainer` + `renderToString`, parsed
 * with linkedom, run under the default `node` Vitest environment — the
 * literal vitest-environment docblock pragma is deliberately never written
 * in this file (its scanner matches the text alone, which would flip the
 * environment and break `AstroContainer` per `section-order-contract.ts`'s
 * note).
 */

const SPREAD_IDS: readonly SpreadId[] = SPREADS.map((geometry) => geometry.id)

/** Builds one index-entry fixture straight from a spread's own geometry. */
function makeIndexEntry(
    geometry: SpreadGeometry,
    order: number
): SpreadIndexEntry {
    return {
        id: geometry.id,
        name: `Fixture name for ${geometry.id}`,
        summary: `Fixture summary for ${geometry.id}`,
        order,
        status: 'draft' as PieceStatus,
    }
}

/** One entry per spread, already in ascending `order` — ordering itself is `spread-page.test.ts`'s contract, not this file's. */
const INDEX_ENTRIES: SpreadIndexEntry[] = SPREADS.map((geometry, index) =>
    makeIndexEntry(geometry, index + 1)
)

let container: Awaited<ReturnType<typeof AstroContainer.create>>

beforeAll(async () => {
    container = await AstroContainer.create()
})

async function renderIndexPage(spreads: SpreadIndexEntry[]) {
    const html = await container.renderToString(SpreadIndexPage, {
        props: { spreads },
    })
    return parseHTML(html).document
}

/**
 * Finds the row for `id`: the `<li>` containing the existing
 * `[data-testid="spread-index-entry"][data-spread-id="<id>"]` anchor.
 * Structural, not a new testid, since the row itself isn't part of this
 * phase's contract.
 */
function findRow(
    doc: ReturnType<typeof parseHTML>['document'],
    id: SpreadId
): Element {
    const rows = Array.from(doc.querySelectorAll('li'))
    const row = rows.find(
        (li) => li.querySelector(`[data-spread-id="${id}"]`) !== null
    )
    if (!row) {
        throw new Error(`no <li> row found containing spread id ${id}`)
    }
    return row
}

describe('spreads index: no testid collision', () => {
    it('does not reuse an existing data-testid for the diagram or its markers', () => {
        // Guards the selector choice itself against every data-testid this
        // codebase already emits (grepped across src/components and
        // src/pages when this file was written).
        const existing = [
            'card-image',
            'suit-info',
            'number-info',
            'rank-info',
            'arc-context',
            'common-reading',
            'invitation-prompt',
            'card-eyebrow',
            'card-name',
            'symbol-walkthrough',
            'reading-framing',
            'card-back',
            'card-frame',
            'divider',
            'ornament',
            'spread-position',
            'spread-card-link',
            'spread-reversal-note',
            'spread-variant-note',
            'spread-index-entry',
            'spread-extends',
            'card-index',
            'learn-index-entry',
            'learn-title',
            'learn-description',
            'learn-body',
            'learn-prev-link',
            'learn-next-link',
            'draft-badge',
            'drawn-card',
            'reversal-badge',
            'reversal-plaque',
            'free-pull',
            'pull-row',
            'daily-draw',
            'roman-date',
            'readable-date',
            'daily-mechanism-note',
            'daily-stage',
            'reveal-button',
            'daily-reveal-content',
            'second-card',
            'second-card-button',
        ]
        expect(existing).not.toContain('spread-diagram')
        expect(existing).not.toContain('spread-marker')
    })
})

describe('spreads index: per-row geometry diagram', () => {
    it.each(SPREAD_IDS.map((id) => [id] as const))(
        'renders exactly one diagram for %s, with one marker per position',
        async (id) => {
            const geometry = SPREADS.find((s) => s.id === id)!
            const doc = await renderIndexPage(INDEX_ENTRIES)
            const row = findRow(doc, id)

            const diagrams = Array.from(
                row.querySelectorAll('[data-testid="spread-diagram"]')
            )
            expect(diagrams).toHaveLength(1)

            const markers = Array.from(
                diagrams[0]!.querySelectorAll('[data-testid="spread-marker"]')
            )
            expect(markers).toHaveLength(geometry.positions.length)
        }
    )

    it.each(SPREAD_IDS.map((id) => [id] as const))(
        "each marker for %s carries its position's own data-x/data-y from src/lib/spreads.ts",
        async (id) => {
            const geometry = SPREADS.find((s) => s.id === id)!
            const doc = await renderIndexPage(INDEX_ENTRIES)
            const row = findRow(doc, id)

            const diagram = row.querySelector('[data-testid="spread-diagram"]')
            expect(diagram).not.toBeNull()

            const markers = Array.from(
                diagram!.querySelectorAll('[data-testid="spread-marker"]')
            )
            expect(markers).toHaveLength(geometry.positions.length)

            geometry.positions.forEach((position, index) => {
                const marker = markers[index]!
                expect(Number(marker.getAttribute('data-x'))).toBe(position.x)
                expect(Number(marker.getAttribute('data-y'))).toBe(position.y)
            })
        }
    )

    it.each(SPREAD_IDS.map((id) => [id] as const))(
        'marks the diagram for %s aria-hidden, since the title and summary already carry the meaning',
        async (id) => {
            const doc = await renderIndexPage(INDEX_ENTRIES)
            const row = findRow(doc, id)

            const diagram = row.querySelector('[data-testid="spread-diagram"]')
            expect(diagram).not.toBeNull()
            expect(diagram!.getAttribute('aria-hidden')).toBe('true')
        }
    )
})

describe('spreads index: existing extends marker survives the diagram addition', () => {
    it('still renders data-extends-id on every row but the first, unaffected by the new diagram', async () => {
        const doc = await renderIndexPage(INDEX_ENTRIES)

        const ascendingIds = [...SPREADS]
            .map((geometry) => geometry.id)
            .sort((a, b) => {
                const orderA = INDEX_ENTRIES.find((e) => e.id === a)!.order
                const orderB = INDEX_ENTRIES.find((e) => e.id === b)!.order
                return orderA - orderB
            })

        // First row in ladder order carries no extends marker.
        const firstRow = findRow(doc, ascendingIds[0]!)
        expect(
            firstRow.querySelector('[data-testid="spread-extends"]')
        ).toBeNull()

        // Every later row still declares what it extends.
        for (let i = 1; i < ascendingIds.length; i++) {
            const row = findRow(doc, ascendingIds[i]!)
            const extends_ = row.querySelector('[data-testid="spread-extends"]')
            expect(extends_).not.toBeNull()
            expect(extends_!.getAttribute('data-extends-id')).toBe(
                ascendingIds[i - 1]
            )
        }
    })
})
