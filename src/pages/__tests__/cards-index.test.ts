import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { parseHTML } from 'linkedom'
import { beforeAll, describe, expect, it } from 'vitest'
import {
    composeCard,
    type ComposedCard,
    type ContentCollections,
} from '../../lib/content/compose'
import {
    DECK,
    getCard,
    isMajor,
    isMinor,
    SUITS,
    type Card,
} from '../../lib/deck'
import { cardEyebrow } from '../../lib/ornament'
import CardPage from '../cards/[id].astro'
import CardIndexPage from '../cards/index.astro'
import { CARD_PAGE_TESTIDS } from './section-order-contract'

/**
 * Rendered-output contract for Phase 5's sectioned deck index and the
 * asymmetric card-detail plate layout (L4 boundary).
 *
 * Rendered with `experimental_AstroContainer` + `renderToString`, then
 * parsed with linkedom, exactly as `card-page.test.ts` does. Run under the
 * default node environment — no jsdom, and the literal vitest-environment
 * docblock pragma is deliberately never written in this file (its scanner
 * matches on the text alone and would flip the environment, which breaks
 * `AstroContainer` the way `section-order-contract.ts` explains).
 *
 * This file does NOT duplicate `card-page.test.ts`'s section-order
 * assertions (`card-page.test.ts` + `section-order-contract.ts` already own
 * that contract). It adds:
 *   - the deck index's five-section grouping (major, then each suit)
 *   - the index's per-link thumbnail contract (`CardImage` `thumb` variant)
 *   - a card-detail eyebrow, selector `[data-testid="card-eyebrow"]`
 *     (deliberately NOT one of `CARD_PAGE_TESTIDS`, so it can't collide
 *     with the locked section-order contract)
 *   - card-detail's `card-image` nesting inside `[data-testid="card-frame"]`
 *     (`CardFrame`'s root, see `src/components/CardFrame.astro`)
 *   - no "Rider-Waite" mention on the index (the detail page's 78-card
 *     sweep already lives in `card-page.test.ts`)
 *
 * Contract this file hands to the Phase 5 GREEN implementation:
 *   - `/cards`: `[data-testid="card-index"]` contains exactly five
 *     `[data-suit]` sections, in order `major`, then `SUITS` order
 *     (wands, cups, swords, pentacles). Each section has a heading and,
 *     within it, `a[href]` links pointing at `/cards/<id>` — 22 in the
 *     major section (in number order), 14 in each suit section (its ten
 *     pips plus four courts). Each link wraps exactly one `<img>`
 *     (`data-variant="thumb"`, `loading="lazy"`) with non-empty alt text
 *     naming the card, plus the card name as the link's visible text.
 *   - `/cards/<id>`: an element at `[data-testid="card-eyebrow"]` whose
 *     text equals `cardEyebrow(card)`; `[data-testid="card-image"]` nested
 *     inside `[data-testid="card-frame"]`.
 */

/** Deck id used for each fixture card kind in the eyebrow/frame tests below. */
const EYEBROW_FIXTURE_IDS = {
    major: 'the-fool',
    pip: 'three-of-swords',
    court: 'king-of-wands',
} as const

function makeCardEntry(card: Card): ContentCollections['cards'][number] {
    return {
        id: card.id,
        data: {
            name: card.name,
            symbols: [{ element: 'Fixture element', note: 'Fixture note' }],
            commonReading: `Fixture common reading for ${card.name}`,
            invitationPrompt: `Fixture invitation prompt for ${card.name}`,
            status: 'draft',
        },
    }
}

/**
 * Minimal fixture collections covering only the three cards these tests
 * render: one major, one pip and one court. `composeCard` only looks up
 * the shared pieces a card's own kind depends on (see
 * `sharedContentKeys` in `src/lib/deck.ts`), so nothing else is needed.
 */
function buildEyebrowFixtureCollections(): ContentCollections {
    const majorCard = getCard(EYEBROW_FIXTURE_IDS.major)!
    const pipCard = getCard(EYEBROW_FIXTURE_IDS.pip)!
    const courtCard = getCard(EYEBROW_FIXTURE_IDS.court)!

    const collections: ContentCollections = {
        cards: [majorCard, pipCard, courtCard].map(makeCardEntry),
        suits: [
            {
                id: 'swords',
                data: {
                    suit: 'swords',
                    name: 'Swords',
                    domain: 'Fixture domain for swords',
                    conventionalElement: 'Fixture element',
                    status: 'draft',
                },
            },
            {
                id: 'wands',
                data: {
                    suit: 'wands',
                    name: 'Wands',
                    domain: 'Fixture domain for wands',
                    conventionalElement: 'Fixture element',
                    status: 'draft',
                },
            },
        ],
        numbers: [
            {
                id: 'three',
                data: {
                    rank: 'three',
                    numeral: 3,
                    stage: 'Fixture stage for three',
                    status: 'draft',
                },
            },
        ],
        ranks: [
            {
                id: 'king',
                data: {
                    rank: 'king',
                    name: 'King',
                    ladderPosition: 'Fixture ladder position for king',
                    status: 'draft',
                },
            },
        ],
        majorsArc: [
            {
                id: 'the-fool',
                data: {
                    cardId: 'the-fool',
                    number: 0,
                    septenary: 0,
                    status: 'draft',
                },
            },
        ],
    }

    return collections
}

const eyebrowFixtureCollections = buildEyebrowFixtureCollections()

function composeEyebrowFixture(id: string): ComposedCard {
    return composeCard(getCard(id)!, eyebrowFixtureCollections)
}

let container: Awaited<ReturnType<typeof AstroContainer.create>>

beforeAll(async () => {
    container = await AstroContainer.create()
})

async function renderIndexHtml(cards: readonly Card[] = DECK) {
    return container.renderToString(CardIndexPage, { props: { cards } })
}

async function renderIndexPage(cards: readonly Card[] = DECK) {
    return parseHTML(await renderIndexHtml(cards)).document
}

async function renderCardHtml(id: string) {
    const composed = composeEyebrowFixture(id)
    return container.renderToString(CardPage, { props: { composed } })
}

async function renderCardPage(id: string) {
    return parseHTML(await renderCardHtml(id)).document
}

/** Extracts the deck id from an `/cards/<id>` (optionally trailing-slash) href. */
function idFromHref(href: string): string {
    const match = href.match(/\/cards\/([^/]+)\/?$/)
    return match?.[1] ?? ''
}

describe('card index: sectioned by arcana and suit', () => {
    it('groups the index into five headed [data-suit] sections, in order: major, then wands, cups, swords, pentacles', async () => {
        const doc = await renderIndexPage()
        const index = doc.querySelector('[data-testid="card-index"]')
        expect(index).not.toBeNull()

        const sections = Array.from(index!.querySelectorAll('[data-suit]'))
        expect(
            sections.map((section) => section.getAttribute('data-suit'))
        ).toEqual(['major', ...SUITS])

        for (const section of sections) {
            const heading = section.querySelector('h1, h2, h3, h4, h5, h6')
            expect(heading).not.toBeNull()
            expect((heading!.textContent ?? '').trim().length).toBeGreaterThan(
                0
            )
        }
    })

    it('lists all 22 majors, in number order, inside the major section', async () => {
        const doc = await renderIndexPage()
        const majorSection = doc.querySelector('[data-suit="major"]')
        expect(majorSection).not.toBeNull()

        const links = Array.from(majorSection!.querySelectorAll('a[href]'))
        const majors = DECK.filter(isMajor)
        expect(links).toHaveLength(22)

        links.forEach((link, index) => {
            expect(idFromHref(link.getAttribute('href') ?? '')).toBe(
                majors[index]!.id
            )
        })
    })

    it.each(SUITS)(
        'lists all 14 %s cards (ten pips, four courts) inside the %s section',
        async (suit) => {
            const doc = await renderIndexPage()
            const section = doc.querySelector(`[data-suit="${suit}"]`)
            expect(section).not.toBeNull()

            const links = Array.from(section!.querySelectorAll('a[href]'))
            expect(links).toHaveLength(14)

            const linkIds = new Set(
                links.map((link) => idFromHref(link.getAttribute('href') ?? ''))
            )
            const expectedIds = new Set(
                DECK.filter((card) => isMinor(card) && card.suit === suit).map(
                    (card) => card.id
                )
            )
            expect(linkIds).toEqual(expectedIds)
        }
    )
})

describe('card index: links and thumbnails', () => {
    it('emits exactly 78 links inside the card index, one per distinct deck id, each pointing at /cards/<id>', async () => {
        const doc = await renderIndexPage()
        const index = doc.querySelector('[data-testid="card-index"]')
        expect(index).not.toBeNull()

        const links = Array.from(index!.querySelectorAll('a[href]'))
        expect(links).toHaveLength(78)

        const ids = links.map((link) =>
            idFromHref(link.getAttribute('href') ?? '')
        )
        expect(new Set(ids).size).toBe(78)

        const deckIds = new Set(DECK.map((card) => card.id))
        for (const id of ids) {
            expect(deckIds.has(id)).toBe(true)
        }
    })

    it('gives each link exactly one thumbnail image, with descriptive alt text, plus the card name as visible text', async () => {
        const doc = await renderIndexPage()
        const index = doc.querySelector('[data-testid="card-index"]')!
        const links = Array.from(index.querySelectorAll('a[href]'))
        expect(links.length).toBeGreaterThan(0)

        for (const link of links) {
            const id = idFromHref(link.getAttribute('href') ?? '')
            const card = DECK.find((deckCard) => deckCard.id === id)
            expect(card).toBeDefined()

            const images = link.querySelectorAll('img')
            expect(images).toHaveLength(1)

            const alt = images[0]!.getAttribute('alt') ?? ''
            expect(alt.trim().length).toBeGreaterThan(0)
            expect(alt).toContain(card!.name)

            expect(link.textContent ?? '').toContain(card!.name)
        }
    })

    it('renders every thumbnail with the thumb variant, lazy-loaded', async () => {
        const doc = await renderIndexPage()
        const index = doc.querySelector('[data-testid="card-index"]')!
        const images = Array.from(index.querySelectorAll('img'))
        expect(images.length).toBeGreaterThan(0)

        for (const image of images) {
            expect(image.getAttribute('data-variant')).toBe('thumb')
            expect(image.getAttribute('loading')).toBe('lazy')
        }
    })
})

describe('card index: no Rider-Waite mention', () => {
    it('never emits "Rider-Waite" in the index HTML', async () => {
        const html = await renderIndexHtml()
        expect(html).not.toMatch(/rider-waite/i)
    })
})

describe('card detail: eyebrow', () => {
    it('does not reuse a CARD_PAGE_TESTIDS value for the eyebrow selector', () => {
        // Guards the selector choice itself: the eyebrow is new UI, not a
        // reinterpretation of a locked section-order slot.
        expect(CARD_PAGE_TESTIDS).not.toContain('card-eyebrow')
    })

    it.each([
        ['major', EYEBROW_FIXTURE_IDS.major],
        ['pip', EYEBROW_FIXTURE_IDS.pip],
        ['court', EYEBROW_FIXTURE_IDS.court],
    ] as const)(
        'shows cardEyebrow(card) as the eyebrow for a %s card',
        async (_kind, id) => {
            const doc = await renderCardPage(id)
            const eyebrow = doc.querySelector('[data-testid="card-eyebrow"]')
            expect(eyebrow).not.toBeNull()

            const card = getCard(id)!
            expect((eyebrow!.textContent ?? '').trim()).toBe(cardEyebrow(card))
        }
    )
})

describe('card detail: image sits inside the card frame', () => {
    it.each([
        ['major', EYEBROW_FIXTURE_IDS.major],
        ['pip', EYEBROW_FIXTURE_IDS.pip],
        ['court', EYEBROW_FIXTURE_IDS.court],
    ] as const)(
        'nests card-image inside card-frame for a %s card',
        async (_kind, id) => {
            const doc = await renderCardPage(id)
            const frame = doc.querySelector('[data-testid="card-frame"]')
            expect(frame).not.toBeNull()

            const image = frame!.querySelector('[data-testid="card-image"]')
            expect(image).not.toBeNull()
        }
    )
})
