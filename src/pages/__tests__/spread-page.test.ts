import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { parseHTML } from 'linkedom'
import { beforeAll, describe, expect, it } from 'vitest'
import type { PieceStatus } from '../../lib/content/compose'
import { drawForDate } from '../../lib/draw'
import { getSpread, type SpreadId } from '../../lib/spreads'
import SpreadPage, {
    type Props as SpreadPageProps,
    type SpreadPositionContent,
} from '../spreads/[id].astro'
import SpreadIndexPage, { type SpreadIndexEntry } from '../spreads/index.astro'

/**
 * Rendered-output contract for the spreads index and the three spread
 * pages (Phase 9, L4 boundary).
 *
 * Rendered with `experimental_AstroContainer` + `renderToString`, then
 * parsed with `linkedom` so position slots, ordering and the draw are
 * asserted structurally rather than by substring search in the raw HTML
 * string.
 *
 * Geometry (`x`/`y`, `label`) is always pulled from `getSpread` in
 * `src/lib/spreads.ts` (Phase 8) rather than hardcoded here, so this file
 * cannot drift from the geometry source of truth. Prose (`meaning`,
 * `variantNote`) is fixture text passed straight in as props, matching the
 * pattern in `card-page.test.ts` and `learn.test.ts`: neither page reads
 * `astro:content` itself.
 *
 * There is no Celtic Cross in this build (P05 wrote content for exactly
 * three spreads: `single-card`, `past-present-direction`,
 * `five-card-cross`) and no assertion about a "small cross" not being a
 * standardised term -- an earlier version of this plan specced both and
 * both are void.
 *
 * This file must run under the default `node` Vitest environment (it uses
 * `astro/container`, and a `.astro` import resolves to the client build
 * whenever a DOM global exists, where `AstroContainer` throws
 * `NoMatchingRenderer`) -- no environment override is declared anywhere in
 * this file.
 */

const SPREAD_IDS: readonly SpreadId[] = [
    'single-card',
    'past-present-direction',
    'five-card-cross',
]

/** Real Phase 5 seed metadata from `src/content/spreads/*.md`. */
const SPREAD_SEED = [
    {
        id: 'single-card' as SpreadId,
        name: 'Single Card Draw',
        order: 1,
        variantNote: undefined as string | undefined,
    },
    {
        id: 'past-present-direction' as SpreadId,
        name: 'Past, Present, Direction',
        order: 2,
        variantNote:
            'Fixture variant note: the same three-position layout is widely taught under other labels.',
    },
    {
        id: 'five-card-cross' as SpreadId,
        name: 'The Cross',
        order: 3,
        variantNote:
            'Fixture variant note: cross-shaped layouts are taught with varying position sets across traditions.',
    },
] as const

/**
 * Builds position content fixtures for one spread, pulling `label`/`x`/`y`
 * straight from `getSpread` (Phase 8's geometry source of truth) and
 * attaching synthetic fixture prose for `meaning`. Never hand-writes
 * coordinates: a drift between this file and `src/lib/spreads.ts` would be
 * a fixture bug, not a real regression, and pulling from `getSpread`
 * makes that impossible.
 */
function buildPositions(id: SpreadId): SpreadPositionContent[] {
    return getSpread(id).positions.map((geometry, index) => ({
        label: geometry.label,
        meaning: `Fixture meaning ${index} for ${geometry.label}.`,
        x: geometry.x,
        y: geometry.y,
    }))
}

function buildSpreadPageProps(
    seed: (typeof SPREAD_SEED)[number],
    overrides: Partial<SpreadPageProps> = {}
): SpreadPageProps {
    return {
        id: seed.id,
        name: seed.name,
        summary: `Fixture summary for ${seed.name}.`,
        variantNote: seed.variantNote,
        status: 'draft' as PieceStatus,
        positions: buildPositions(seed.id),
        dateKey: '2026-01-01',
        ...overrides,
    }
}

function makeIndexEntry(
    seed: (typeof SPREAD_SEED)[number],
    status: PieceStatus = 'draft'
): SpreadIndexEntry {
    return {
        id: seed.id,
        name: seed.name,
        summary: `Fixture summary for ${seed.name}.`,
        order: seed.order,
        status,
    }
}

/**
 * Deliberately NOT in ascending `order` -- reversed, then perturbed so it
 * also doesn't coincide with alphabetical-by-id order. This is what proves
 * the index sorts by the declared `order` field rather than happening to
 * echo back whatever order it was handed (mirrors `learn.test.ts`).
 */
const SHUFFLED_INDEX_ENTRIES: SpreadIndexEntry[] = [
    makeIndexEntry(SPREAD_SEED[2]!), // order 3
    makeIndexEntry(SPREAD_SEED[0]!), // order 1
    makeIndexEntry(SPREAD_SEED[1]!), // order 2
]

const ASCENDING_IDS = [...SPREAD_SEED]
    .sort((a, b) => a.order - b.order)
    .map((s) => s.id)
const ALPHABETICAL_IDS = [...SPREAD_SEED].map((s) => s.id).sort()
const INPUT_IDS = SHUFFLED_INDEX_ENTRIES.map((e) => e.id)

// Sanity on the fixture itself: if either of these ever collided with the
// expected ascending order, the corresponding assertion below would pass
// vacuously regardless of whether the page actually sorts by `order`.
if (JSON.stringify(ALPHABETICAL_IDS) === JSON.stringify(ASCENDING_IDS)) {
    throw new Error(
        'fixture bug: alphabetical order coincides with declared order'
    )
}
if (JSON.stringify(INPUT_IDS) === JSON.stringify(ASCENDING_IDS)) {
    throw new Error('fixture bug: input order coincides with declared order')
}

/**
 * Finds a date key whose draw for `spreadId` contains at least one reversed
 * and one upright card, so the reversal assertions exercise both branches
 * rather than whichever orientation one arbitrary date happens to give.
 */
function findDateKeyWithMixedOrientations(
    spreadId: string,
    count: number,
    maxDays = 400
): string {
    for (let day = 1; day <= maxDays; day++) {
        const dateKey = `2026-01-${String(day).padStart(2, '0')}`
        const key =
            day <= 31
                ? dateKey
                : new Date(Date.UTC(2026, 0, day)).toISOString().slice(0, 10)
        const draws = drawForDate(spreadId, count, key)
        if (draws.some((d) => d.reversed) && draws.some((d) => !d.reversed)) {
            return key
        }
    }
    throw new Error(
        `No date key within ${maxDays} days yields both orientations for ${spreadId}`
    )
}

let container: Awaited<ReturnType<typeof AstroContainer.create>>

beforeAll(async () => {
    container = await AstroContainer.create()
})

async function renderSpreadPage(props: SpreadPageProps) {
    // Spread as a fresh object literal here (rather than passing `props`
    // straight through) so TS's structural check against Astro's
    // `Record<string, unknown>` options type doesn't demand an explicit
    // index signature on `SpreadPageProps` -- the same fresh-literal shape
    // `card-page.test.ts` and `learn.test.ts` use.
    const html = await container.renderToString(SpreadPage, {
        props: { ...props },
    })
    return parseHTML(html).document
}

async function renderIndexPage(spreads: SpreadIndexEntry[]) {
    const html = await container.renderToString(SpreadIndexPage, {
        props: { spreads },
    })
    return parseHTML(html).document
}

describe('spread page: one card slot per position, positioned by geometry', () => {
    it.each(SPREAD_IDS.map((id) => [id] as const))(
        'renders %s with one labeled, positioned slot per position',
        async (id) => {
            const seed = SPREAD_SEED.find((s) => s.id === id)!
            const geometry = getSpread(id)
            const props = buildSpreadPageProps(seed)
            const doc = await renderSpreadPage(props)

            const slots = Array.from(
                doc.querySelectorAll('[data-testid="spread-position"]')
            )
            expect(slots).toHaveLength(geometry.positions.length)

            geometry.positions.forEach((positionGeometry, index) => {
                const slot = slots[index]!
                expect(Number(slot.getAttribute('data-x'))).toBe(
                    positionGeometry.x
                )
                expect(Number(slot.getAttribute('data-y'))).toBe(
                    positionGeometry.y
                )

                const text = (slot.textContent ?? '').trim()
                expect(text).toContain(positionGeometry.label)
                expect(text).toContain(props.positions[index]!.meaning)
            })
        }
    )
})

describe('spread page: card slots link to the full card page', () => {
    it('links each drawn card to its own card page', async () => {
        const seed = SPREAD_SEED[0]! // single-card: exactly one slot
        const props = buildSpreadPageProps(seed, { dateKey: '2026-02-02' })
        const [expectedDraw] = drawForDate(seed.id, 1, '2026-02-02')

        const doc = await renderSpreadPage(props)
        const slot = doc.querySelector('[data-testid="spread-position"]')
        expect(slot).not.toBeNull()

        const link = slot!.querySelector('[data-testid="spread-card-link"]')
        expect(link).not.toBeNull()
        expect(link!.getAttribute('href')).toContain(
            `/cards/${expectedDraw!.card.id}/`
        )
    })
})

describe('spread page: variant note surfaced conditionally', () => {
    it('renders no variant note for single-card, which declares none', async () => {
        const seed = SPREAD_SEED[0]!
        expect(seed.variantNote).toBeUndefined()

        const doc = await renderSpreadPage(buildSpreadPageProps(seed))
        expect(
            doc.querySelector('[data-testid="spread-variant-note"]')
        ).toBeNull()
    })

    it.each([SPREAD_SEED[1]!, SPREAD_SEED[2]!])(
        'renders the declared variant note for $id',
        async (seed) => {
            expect(seed.variantNote).toBeDefined()

            const doc = await renderSpreadPage(buildSpreadPageProps(seed))
            const note = doc.querySelector(
                '[data-testid="spread-variant-note"]'
            )
            expect(note).not.toBeNull()
            expect((note!.textContent ?? '').trim()).toBe(seed.variantNote)
        }
    )
})

describe('spread page: date-locked draw', () => {
    function cardIdsFrom(doc: ReturnType<typeof parseHTML>['document']) {
        return Array.from(
            doc.querySelectorAll('[data-testid="spread-position"]')
        ).map((slot) => slot.getAttribute('data-card-id'))
    }

    it('renders identical cards across two renders for the same spread and date key', async () => {
        const seed = SPREAD_SEED[2]! // five-card-cross: most positions
        const dateKey = '2026-03-03'
        const expected = drawForDate(seed.id, 5, dateKey).map(
            (draw) => draw.card.id
        )

        const first = await renderSpreadPage(
            buildSpreadPageProps(seed, { dateKey })
        )
        const second = await renderSpreadPage(
            buildSpreadPageProps(seed, { dateKey })
        )

        const firstIds = cardIdsFrom(first)
        const secondIds = cardIdsFrom(second)

        expect(firstIds).toEqual(expected)
        expect(secondIds).toEqual(expected)
        expect(firstIds).toEqual(secondIds)
    })

    it('draws different cards for a different date key on the same spread', async () => {
        const seed = SPREAD_SEED[2]!
        const dateKeyA = '2026-03-03'
        const dateKeyB = '2026-09-09'

        const expectedA = drawForDate(seed.id, 5, dateKeyA).map(
            (draw) => draw.card.id
        )
        const expectedB = drawForDate(seed.id, 5, dateKeyB).map(
            (draw) => draw.card.id
        )
        // Fixture sanity: if the two dates happened to draw the same cards,
        // the assertion below would pass vacuously regardless of whether
        // the page actually threads dateKey through to the draw.
        if (JSON.stringify(expectedA) === JSON.stringify(expectedB)) {
            throw new Error(
                'fixture bug: chosen date keys draw identical cards'
            )
        }

        const docA = await renderSpreadPage(
            buildSpreadPageProps(seed, { dateKey: dateKeyA })
        )
        const docB = await renderSpreadPage(
            buildSpreadPageProps(seed, { dateKey: dateKeyB })
        )

        expect(cardIdsFrom(docA)).toEqual(expectedA)
        expect(cardIdsFrom(docB)).toEqual(expectedB)
        expect(cardIdsFrom(docA)).not.toEqual(cardIdsFrom(docB))
    })
})

describe('spread page: reversal marked as technique', () => {
    /*
        The daily draw renders `reversal-note` and the free pull renders
        `reversal-badge`, both with generic framing. A spread slot carries
        the same `reversed` flag, so it must mark it too — otherwise the
        same reversed card reads as upright here and as reversed on the
        other two surfaces. Asserted against `drawForDate`'s own output for
        a date key chosen because it actually produces a reversal, so the
        test cannot pass by rendering nothing.
    */
    it('marks every reversed slot, and no upright slot, for a date key that yields both', async () => {
        const seed = SPREAD_SEED[2]! // five-card-cross
        const dateKey = findDateKeyWithMixedOrientations(seed.id, 5)
        const draws = drawForDate(seed.id, 5, dateKey)

        const doc = await renderSpreadPage(
            buildSpreadPageProps(seed, { dateKey })
        )
        const slots = Array.from(
            doc.querySelectorAll('[data-testid="spread-position"]')
        )

        expect(slots).toHaveLength(draws.length)
        slots.forEach((slot, index) => {
            const reversed = draws[index]!.reversed
            expect(slot.getAttribute('data-reversed')).toBe(String(reversed))
            expect(
                slot.querySelector('[data-testid="spread-reversal-note"]')
            ).toStrictEqual(reversed ? expect.anything() : null)
        })
    })

    it('frames reversal identically for every reversed card, never per-card', async () => {
        const seed = SPREAD_SEED[2]!
        const dateKey = findDateKeyWithMixedOrientations(seed.id, 5)

        const doc = await renderSpreadPage(
            buildSpreadPageProps(seed, { dateKey })
        )
        const notes = Array.from(
            doc.querySelectorAll('[data-testid="spread-reversal-note"]')
        ).map((n) => (n.textContent ?? '').replace(/\s+/g, ' ').trim())

        expect(notes.length).toBeGreaterThan(0)
        expect(new Set(notes).size).toBe(1)
    })
})

describe('spreads index: ladder order', () => {
    it('lists the three spreads in ascending `order`, not fixture array order or alphabetical order', async () => {
        const doc = await renderIndexPage(SHUFFLED_INDEX_ENTRIES)

        const entries = Array.from(
            doc.querySelectorAll('[data-testid="spread-index-entry"]')
        )
        expect(entries).toHaveLength(SPREAD_SEED.length)

        const renderedIds = entries.map((el) =>
            el.getAttribute('data-spread-id')
        )
        expect(renderedIds).toEqual(ASCENDING_IDS)
        expect(renderedIds).not.toEqual(INPUT_IDS)
        expect(renderedIds).not.toEqual(ALPHABETICAL_IDS)
    })

    it('links each entry to its own spread page', async () => {
        const doc = await renderIndexPage(SHUFFLED_INDEX_ENTRIES)

        for (const seed of SPREAD_SEED) {
            const link = doc.querySelector(
                `[data-testid="spread-index-entry"][data-spread-id="${seed.id}"]`
            )
            expect(link).not.toBeNull()
            expect(link!.getAttribute('href')).toContain(seed.id)
        }
    })

    it('states structurally that each spread extends the previous one, except the first', async () => {
        const doc = await renderIndexPage(SHUFFLED_INDEX_ENTRIES)

        const relationships = Array.from(
            doc.querySelectorAll('[data-testid="spread-extends"]')
        )
        // Exactly two relationships: order 2 extends order 1, order 3
        // extends order 2. Order 1 extends nothing.
        expect(relationships).toHaveLength(SPREAD_SEED.length - 1)

        const bySpreadId = new Map(
            relationships.map((el) => [
                el.getAttribute('data-spread-id'),
                el.getAttribute('data-extends-id'),
            ])
        )

        expect(bySpreadId.get('single-card')).toBeUndefined()
        expect(bySpreadId.get('past-present-direction')).toBe('single-card')
        expect(bySpreadId.get('five-card-cross')).toBe('past-present-direction')
    })
})
