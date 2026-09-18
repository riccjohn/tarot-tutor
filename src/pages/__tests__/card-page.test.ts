import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { parseHTML } from 'linkedom'
import { beforeAll, describe, expect, it } from 'vitest'
import cardImages from '../../data/card-images.json'
import {
    composeCard,
    type CardPieceData,
    type ComposedCard,
    type ContentCollections,
    type ContentEntry,
    type MajorArcPieceData,
    type NumberPieceData,
    type PieceStatus,
    type RankPieceData,
    type SuitPieceData,
} from '../../lib/content/compose'
import {
    COURT_RANKS,
    DECK,
    getCard,
    isMajor,
    PIP_RANKS,
    SUITS,
    type Card,
    type CourtRank,
    type MajorCard,
    type PipRank,
    type Suit,
} from '../../lib/deck'
import CardPage from '../cards/[id].astro'
import CardIndexPage from '../cards/index.astro'
import {
    EXPECTED_SECTION_ORDER,
    sectionOrderFromHtml,
} from './section-order-contract'

/**
 * Rendered-output contract for the card index and the 78 card pages
 * (Phase 6, L4 boundary).
 *
 * Rendered with `experimental_AstroContainer` + `renderToString`, then
 * parsed with linkedom so section order and element attributes are asserted
 * structurally rather than by substring search in the raw HTML string.
 *
 * Fixtures mirror `src/lib/__tests__/compose.test.ts`: plain `ContentEntry`
 * objects passed straight to `composeCard`, never `astro:content` itself.
 * Every piece defaults to `status: 'draft'` except the three-of-swords card,
 * the swords suit essay and the three number essay, which are `edited` —
 * matching the actual state of `src/content/` after Phase 5, so the
 * draft/edited assertions below exercise a real edited card and a real
 * draft card rather than an invented one.
 *
 * Selectors used throughout (`data-testid="..."`) are the contract this
 * test hands to the Phase 6 GREEN implementation: `card-image`, `suit-info`,
 * `number-info`, `rank-info`, `symbol-walkthrough`, `arc-context`,
 * `common-reading`, `invitation-prompt`, `draft-badge`.
 */

function titleCase(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1)
}

function septenaryFor(majorNumber: number): 0 | 1 | 2 | 3 {
    if (majorNumber === 0) return 0
    return Math.ceil(majorNumber / 7) as 1 | 2 | 3
}

function makeCardEntry(
    card: Card,
    status: PieceStatus
): ContentEntry<CardPieceData> {
    return {
        id: card.id,
        data: {
            name: card.name,
            symbols: [
                {
                    element: 'Fixture element one',
                    note: 'Fixture note one',
                },
                {
                    element: 'Fixture element two',
                    note: 'Fixture note two',
                },
                {
                    element: 'Fixture element three',
                    note: 'Fixture note three',
                },
            ],
            commonReading: `Fixture common reading for ${card.name}`,
            invitationPrompt: `Fixture invitation prompt for ${card.name}`,
            status,
        },
    }
}

function makeSuitEntry(
    suit: Suit,
    status: PieceStatus
): ContentEntry<SuitPieceData> {
    return {
        id: suit,
        data: {
            suit,
            name: titleCase(suit),
            domain: `Fixture domain for ${suit}`,
            conventionalElement: 'Fixture element',
            status,
        },
    }
}

function makeNumberEntry(
    rank: PipRank,
    status: PieceStatus
): ContentEntry<NumberPieceData> {
    return {
        id: rank,
        data: {
            rank,
            numeral: PIP_RANKS.indexOf(rank) + 1,
            stage: `Fixture stage for ${rank}`,
            status,
        },
    }
}

function makeRankEntry(
    rank: CourtRank,
    status: PieceStatus
): ContentEntry<RankPieceData> {
    return {
        id: rank,
        data: {
            rank,
            name: titleCase(rank),
            ladderPosition: `Fixture ladder position for ${rank}`,
            status,
        },
    }
}

function makeMajorArcEntry(
    card: MajorCard,
    status: PieceStatus
): ContentEntry<MajorArcPieceData> {
    return {
        id: card.id,
        data: {
            cardId: card.id,
            number: card.number,
            septenary: septenaryFor(card.number),
            status,
        },
    }
}

/**
 * Collections mirroring the real repo's Phase 5 seed content: only the
 * Three of Swords card, the Swords suit essay and the Three number essay
 * are `edited`; every other piece is `draft`.
 */
function buildCollections(): ContentCollections {
    return {
        cards: DECK.map((card) =>
            makeCardEntry(
                card,
                card.id === 'three-of-swords' ? 'edited' : 'draft'
            )
        ),
        suits: SUITS.map((suit) =>
            makeSuitEntry(suit, suit === 'swords' ? 'edited' : 'draft')
        ),
        numbers: PIP_RANKS.map((rank) =>
            makeNumberEntry(rank, rank === 'three' ? 'edited' : 'draft')
        ),
        ranks: COURT_RANKS.map((rank) => makeRankEntry(rank, 'draft')),
        majorsArc: DECK.filter(isMajor).map((card) =>
            makeMajorArcEntry(card, 'draft')
        ),
    }
}

const collections = buildCollections()

function compose(id: string): ComposedCard {
    return composeCard(getCard(id)!, collections)
}

let container: Awaited<ReturnType<typeof AstroContainer.create>>

beforeAll(async () => {
    container = await AstroContainer.create()
})

async function renderCardHtml(id: string) {
    const composed = compose(id)
    return container.renderToString(CardPage, { props: { composed } })
}

async function renderCardPage(id: string) {
    return parseHTML(await renderCardHtml(id)).document
}

async function renderIndexPage() {
    const html = await container.renderToString(CardIndexPage, {
        props: { cards: DECK },
    })
    return parseHTML(html).document
}

/** Index (in document order) of the first element carrying this `data-testid`. */
function orderOf(
    doc: ReturnType<typeof parseHTML>['document'],
    testId: string
) {
    const all = Array.from(doc.querySelectorAll('[data-testid]'))
    return all.findIndex((el) => el.getAttribute('data-testid') === testId)
}

describe('card page: section order (pip)', () => {
    it('emits image, then suit, then number, then symbol walkthrough, then common reading, then invitation prompt', async () => {
        const doc = await renderCardPage('three-of-swords')

        const imageIndex = orderOf(doc, 'card-image')
        const suitIndex = orderOf(doc, 'suit-info')
        const numberIndex = orderOf(doc, 'number-info')
        const symbolsIndex = orderOf(doc, 'symbol-walkthrough')
        const commonReadingIndex = orderOf(doc, 'common-reading')
        const invitationIndex = orderOf(doc, 'invitation-prompt')

        expect(imageIndex).toBeGreaterThanOrEqual(0)
        expect(suitIndex).toBeGreaterThan(imageIndex)
        expect(numberIndex).toBeGreaterThan(suitIndex)
        expect(symbolsIndex).toBeGreaterThan(numberIndex)
        expect(commonReadingIndex).toBeGreaterThan(symbolsIndex)
        expect(invitationIndex).toBeGreaterThan(commonReadingIndex)
    })
})

describe('card page: section order (court)', () => {
    it('emits image, then suit, then rank, then symbol walkthrough, then common reading, then invitation prompt', async () => {
        const doc = await renderCardPage('king-of-wands')

        const imageIndex = orderOf(doc, 'card-image')
        const suitIndex = orderOf(doc, 'suit-info')
        const rankIndex = orderOf(doc, 'rank-info')
        const symbolsIndex = orderOf(doc, 'symbol-walkthrough')
        const commonReadingIndex = orderOf(doc, 'common-reading')
        const invitationIndex = orderOf(doc, 'invitation-prompt')

        expect(imageIndex).toBeGreaterThanOrEqual(0)
        expect(suitIndex).toBeGreaterThan(imageIndex)
        expect(rankIndex).toBeGreaterThan(suitIndex)
        expect(symbolsIndex).toBeGreaterThan(rankIndex)
        expect(commonReadingIndex).toBeGreaterThan(symbolsIndex)
        expect(invitationIndex).toBeGreaterThan(commonReadingIndex)
    })
})

describe('card page: major arcana', () => {
    it('renders arc context and no suit, number or rank section, in image -> arc -> reading -> invitation order', async () => {
        const doc = await renderCardPage('the-tower')

        expect(doc.querySelector('[data-testid="suit-info"]')).toBeNull()
        expect(doc.querySelector('[data-testid="number-info"]')).toBeNull()
        expect(doc.querySelector('[data-testid="rank-info"]')).toBeNull()

        const imageIndex = orderOf(doc, 'card-image')
        const arcIndex = orderOf(doc, 'arc-context')
        const commonReadingIndex = orderOf(doc, 'common-reading')
        const invitationIndex = orderOf(doc, 'invitation-prompt')

        expect(imageIndex).toBeGreaterThanOrEqual(0)
        expect(arcIndex).toBeGreaterThan(imageIndex)
        expect(commonReadingIndex).toBeGreaterThan(arcIndex)
        expect(invitationIndex).toBeGreaterThan(commonReadingIndex)
    })

    it('renders no suit or number section for every major in the deck', async () => {
        for (const card of DECK.filter(isMajor)) {
            const doc = await renderCardPage(card.id)
            expect(doc.querySelector('[data-testid="suit-info"]')).toBeNull()
            expect(doc.querySelector('[data-testid="number-info"]')).toBeNull()
            expect(doc.querySelector('[data-testid="rank-info"]')).toBeNull()
            expect(
                doc.querySelector('[data-testid="arc-context"]')
            ).not.toBeNull()
        }
    })
})

describe('card page: image element', () => {
    it('carries a full srcset across the ladder widths, a jpeg fallback src, explicit width/height, and descriptive alt text', async () => {
        const doc = await renderCardPage('three-of-swords')
        const img = doc.querySelector('[data-testid="card-image"]')
        expect(img).not.toBeNull()

        const manifestEntry = cardImages['three-of-swords']
        const srcset = img!.getAttribute('srcset') ?? ''
        expect(srcset.length).toBeGreaterThan(0)
        for (const rung of manifestEntry.avif) {
            expect(srcset).toContain(rung.src)
            expect(srcset).toContain(`${rung.width}w`)
        }

        expect(img!.getAttribute('src')).toBe(manifestEntry.fallback.src)
        expect(img!.getAttribute('src')).toMatch(/\.jpe?g$/)
        expect(Number(img!.getAttribute('width'))).toBe(
            manifestEntry.fallback.width
        )
        expect(Number(img!.getAttribute('height'))).toBe(
            manifestEntry.fallback.height
        )

        const alt = img!.getAttribute('alt') ?? ''
        expect(alt.trim().length).toBeGreaterThan(0)
        expect(alt).toContain('Three of Swords')
    })
})

describe('card page: draft marker', () => {
    it('renders a visible draft marker for a draft-status card', async () => {
        // the-fool has no `edited` override in the fixture collections above.
        const doc = await renderCardPage('the-fool')
        const badge = doc.querySelector('[data-testid="draft-badge"]')
        expect(badge).not.toBeNull()
        expect(badge!.hasAttribute('hidden')).toBe(false)
        expect((badge!.textContent ?? '').trim().length).toBeGreaterThan(0)
    })

    it('renders no draft marker for an edited card', async () => {
        // three-of-swords, plus its suit and number pieces, are all `edited`.
        const doc = await renderCardPage('three-of-swords')
        expect(doc.querySelector('[data-testid="draft-badge"]')).toBeNull()
    })
})

describe('card page: common reading framing', () => {
    it('frames the common reading as one reading among many, not the definitive meaning', async () => {
        const doc = await renderCardPage('three-of-swords')
        const section = doc.querySelector('[data-testid="common-reading"]')
        expect(section).not.toBeNull()

        // Assert the structural framing element, not a phrase that the
        // component could hardcode. Searching the section's text for
        // "one reading among many" passed vacuously while the component
        // appended that exact sentence itself, so the assertion could
        // never fail regardless of what the content said.
        const framing = section!.querySelector(
            '[data-testid="reading-framing"]'
        )
        expect(framing).not.toBeNull()
        expect((framing!.textContent ?? '').toLowerCase()).toContain(
            'one reading among many'
        )
    })

    it('omits the framing on a draft card, where there is no reading to frame', async () => {
        // the-fool is draft in the fixture collections, so its reading is a
        // placeholder. Framing a placeholder reads as incoherent ("has not
        // been written yet. This is one reading among many"), so the label
        // is suppressed rather than rendered over nothing.
        const doc = await renderCardPage('the-fool')
        const section = doc.querySelector('[data-testid="common-reading"]')
        expect(section).not.toBeNull()
        expect(
            section!.querySelector('[data-testid="reading-framing"]')
        ).toBeNull()
    })
})

describe('card page: no Rider-Waite mention, no reversed interpretation', () => {
    it('never emits "Rider-Waite" or a reversed-card interpretation, on any of the 78 card pages', async () => {
        for (const card of DECK) {
            const html = await renderCardHtml(card.id)
            expect(html).not.toMatch(/rider-waite/i)
            expect(html).not.toMatch(/revers/i)
        }
    })
})

describe('card index page', () => {
    it('emits exactly 78 links, one per deck id', async () => {
        const doc = await renderIndexPage()
        // Scoped to the card list, not every anchor on the page. Counting
        // all anchors also counted the site header and footer, so the
        // assertion broke the moment the site got navigation -- which is a
        // fact about the test, not about the index.
        const index = doc.querySelector('[data-testid="card-index"]')
        expect(index).not.toBeNull()
        const links = Array.from(index!.querySelectorAll('a[href]'))
        expect(links).toHaveLength(78)

        const hrefs = links.map((a) => a.getAttribute('href') ?? '')
        for (const card of DECK) {
            expect(hrefs.some((href) => href.includes(card.id))).toBe(true)
        }
    })
})

describe('card page: section order matches the shared renderer contract', () => {
    /*
        The React islands (`DailyDraw.tsx`, `FreePull.tsx`) re-emit this same
        order, because an Astro component cannot render inside a React
        island. They cannot be compared against each other in one file: a
        `.astro` import resolves to the client build whenever a DOM global
        exists, so `AstroContainer` throws `NoMatchingRenderer` under jsdom.
        Instead both renderers are pinned to the sequences in
        `./section-order-contract` from the environment each needs — the
        Astro side here under node, the React side in `daily-draw.test.ts`
        under jsdom. Either drifting fails its own file.
    */
    it.each([
        ['pip', 'three-of-swords'],
        ['court', 'king-of-swords'],
        ['major', 'the-fool'],
    ] as const)('emits the %s order from CardSections', async (kind, id) => {
        const html = await renderCardHtml(id)

        expect(sectionOrderFromHtml(html)).toEqual(EXPECTED_SECTION_ORDER[kind])
    })
})
