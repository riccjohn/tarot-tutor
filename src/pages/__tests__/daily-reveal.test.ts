// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import DailyDraw, { DAILY_SPREAD_ID } from '../../components/islands/DailyDraw'
import {
    type CardPieceData,
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
    isMajor,
    PIP_RANKS,
    SUITS,
    type Card,
    type CourtRank,
    type MajorCard,
    type PipRank,
    type Suit,
} from '../../lib/deck'
import { drawForDate, localDateKey, type Draw } from '../../lib/draw'
import { romanDate } from '../../lib/ornament'
import {
    EXPECTED_SECTION_ORDER,
    sectionOrderFromDom,
} from './section-order-contract'

/**
 * Ritual-gate contract for the daily draw (Phase 6, L4 boundary).
 *
 * Design decision this file locks in: the full markup contract stays in the
 * DOM on first render. The reveal only toggles state — a stage wrapper
 * carries `data-revealed="false"` (face-down) or `"true"` (revealed), CSS
 * (not markup presence) hides the face until reveal, and a
 * `<noscript><style>` forces the revealed presentation for visitors without
 * JavaScript. This file therefore asserts on markup/attribute presence, not
 * on computed styles or visibility — jsdom does not apply the project's real
 * stylesheet.
 *
 * File is `.ts`, not `.tsx` — deliberately, matching `daily-draw.test.ts`:
 * Vite's default esbuild loader for `.ts` files does not enable JSX, so this
 * file uses `createElement` rather than JSX syntax throughout, keeping a JSX
 * parse error from ever being mistaken for the intended RED failure.
 *
 * The date key is never the real clock: every test computes it via
 * `localDateKey` from a fixed synthetic base date (mirroring
 * `daily-draw.test.ts`'s own fixture and `findDateKey` approach), so the
 * suite is reproducible regardless of when it runs.
 *
 * New selectors this file hands to the Phase 6 GREEN implementation, chosen
 * to avoid every name already in `CARD_PAGE_TESTIDS` (section-order-contract)
 * or already claimed by `daily-draw.test.ts` (`second-card-button`,
 * `second-card`, `reversal-note`, `daily-mechanism-note`):
 * - `daily-stage` — the stage wrapper carrying `data-revealed="false"|"true"`
 * - `card-back` — the face-down card back shown before reveal
 * - `reveal-button` — the "Turn the card" reveal control (a data-testid, not
 *   a text match — its accessible name must never look like a reroll)
 * - `reversal-plaque` — a plaque on the card art itself marking a reversed
 *   draw (`data-testid`), distinct from `reversal-note` (the interpretive,
 *   in-reading framing `DailyDraw` already renders). Text identical across
 *   every reversed card, same as `reversal-note` already is.
 * - `roman-date` — the roman-numeral rendering of `dateKey` via `romanDate`
 * - `readable-date` — the plain-language date already rendered by
 *   `readableDate` inside `DailyDraw`, just addressable by testid now
 *
 * `card-image` gains a `data-reversed="true"|"false"` attribute in this
 * phase; reversal must rotate that art element, never the flip/stage
 * container — this file cannot assert the rotation itself (no computed
 * style in jsdom) but pins the attribute's presence and value, which is
 * where a GREEN implementation would apply the rotation from.
 *
 * `card-image` also gains a `data-card-id` attribute, asserted stable across
 * repeated reveal activation, so "revealing again cannot change the card"
 * is checked structurally rather than by re-reading `alt` text.
 */

// ---------------------------------------------------------------------------
// Fixtures — mirrors `daily-draw.test.ts`: plain `ContentEntry` objects fed
// straight to `composeCard`, covering the whole 78-card deck so composition
// succeeds no matter which card a given date key happens to draw.
// ---------------------------------------------------------------------------

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
                { element: 'Fixture element one', note: 'Fixture note one' },
                { element: 'Fixture element two', note: 'Fixture note two' },
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

function buildCollections(): ContentCollections {
    return {
        cards: DECK.map((card) => makeCardEntry(card, 'edited')),
        suits: SUITS.map((suit) => makeSuitEntry(suit, 'edited')),
        numbers: PIP_RANKS.map((rank) => makeNumberEntry(rank, 'edited')),
        ranks: COURT_RANKS.map((rank) => makeRankEntry(rank, 'edited')),
        majorsArc: DECK.filter(isMajor).map((card) =>
            makeMajorArcEntry(card, 'edited')
        ),
    }
}

const collections = buildCollections()

// ---------------------------------------------------------------------------
// Date-key helpers — synthetic, sequential, never the real clock. Same base
// date as `daily-draw.test.ts`, but not shared code with it, per the
// architectural constraint that file stays untouched.
// ---------------------------------------------------------------------------

const BASE_DATE = new Date(2026, 0, 1)

function dateKeyAt(offsetDays: number): string {
    const date = new Date(BASE_DATE)
    date.setDate(date.getDate() + offsetDays)
    return localDateKey(date)
}

/** The first date key (within `maxDays`) whose primary daily draw satisfies `predicate`. */
function findDateKey(
    predicate: (draw: Draw) => boolean,
    maxDays = 400
): string {
    for (let i = 0; i < maxDays; i++) {
        const dateKey = dateKeyAt(i)
        const draw = drawForDate(DAILY_SPREAD_ID, 1, dateKey)[0]!
        if (predicate(draw)) return dateKey
    }
    throw new Error(
        `No date key within ${maxDays} synthetic days satisfies the predicate`
    )
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

function renderDailyDraw(dateKey: string) {
    return render(createElement(DailyDraw, { dateKey, collections }))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('daily reveal: face-down on first render, full contract already in the DOM', () => {
    it('renders a face-down stage with a card back and the complete markup contract', () => {
        const dateKey = dateKeyAt(0)
        const { container } = renderDailyDraw(dateKey)

        const stage = container.querySelector('[data-testid="daily-stage"]')
        expect(stage).not.toBeNull()
        expect(stage!.getAttribute('data-revealed')).toBe('false')

        expect(
            container.querySelectorAll('[data-testid="card-back"]')
        ).toHaveLength(1)

        expect(
            container.querySelectorAll('[data-testid="card-image"]')
        ).toHaveLength(1)
        expect(
            container.querySelectorAll('[data-testid="daily-mechanism-note"]')
        ).toHaveLength(1)
        expect(
            container.querySelectorAll('[data-testid="second-card-button"]')
        ).toHaveLength(1)
    })

    it.each([
        ['pip', (card: Card) => card.kind === 'pip'],
        ['court', (card: Card) => card.kind === 'court'],
        ['major', (card: Card) => card.kind === 'major'],
    ] as const)(
        'keeps the %s section order in the DOM before reveal, matching the card-page contract',
        (kind, matches) => {
            const dateKey = findDateKey((draw) => matches(draw.card))
            const { container } = renderDailyDraw(dateKey)

            expect(sectionOrderFromDom(container)).toEqual(
                EXPECTED_SECTION_ORDER[kind]
            )
        }
    )
})

describe('daily reveal: the reveal control is not a reroll', () => {
    it('exposes a reveal-button whose accessible name never reads as a reroll affordance', () => {
        const dateKey = dateKeyAt(1)
        const { getByTestId } = renderDailyDraw(dateKey)

        const rerollLike =
            /reroll|redraw|reshuffle|draw again|new card|try again/i

        const revealButton = getByTestId('reveal-button')
        const accessibleName = (
            revealButton.getAttribute('aria-label') ??
            revealButton.textContent ??
            ''
        ).trim()

        expect(accessibleName.length).toBeGreaterThan(0)
        expect(accessibleName).not.toMatch(rerollLike)
    })
})

describe('daily reveal: activating reveal toggles state without changing the card', () => {
    it('sets data-revealed to true and removes or disables the reveal control', () => {
        const dateKey = dateKeyAt(2)
        const { container, getByTestId } = renderDailyDraw(dateKey)

        fireEvent.click(getByTestId('reveal-button'))

        const stage = container.querySelector('[data-testid="daily-stage"]')
        expect(stage).not.toBeNull()
        expect(stage!.getAttribute('data-revealed')).toBe('true')

        const revealButtonAfter = container.querySelector(
            '[data-testid="reveal-button"]'
        )
        const stillPresentAndEnabled =
            revealButtonAfter !== null &&
            !(revealButtonAfter as HTMLButtonElement).disabled
        expect(stillPresentAndEnabled).toBe(false)
    })

    it('cannot change which card is shown when the reveal is activated again', () => {
        const dateKey = dateKeyAt(3)
        const { container, getByTestId } = renderDailyDraw(dateKey)

        fireEvent.click(getByTestId('reveal-button'))

        const cardImageBefore = container.querySelector(
            '[data-testid="card-image"]'
        )
        const cardIdBefore = cardImageBefore?.getAttribute('data-card-id')
        expect(cardIdBefore).toBeTruthy()

        const revealButtonAgain = container.querySelector(
            '[data-testid="reveal-button"]'
        )
        if (
            revealButtonAgain !== null &&
            !(revealButtonAgain as HTMLButtonElement).disabled
        ) {
            fireEvent.click(revealButtonAgain)
        }

        const cardImageAfter = container.querySelector(
            '[data-testid="card-image"]'
        )
        const cardIdAfter = cardImageAfter?.getAttribute('data-card-id')

        expect(cardIdAfter).toBe(cardIdBefore)
    })
})

describe('daily reveal: reversal is marked on the art, generically', () => {
    it('marks a reversed draw’s art with data-reversed="true", absent on an upright draw', () => {
        const reversedDateKey = findDateKey((draw) => draw.reversed)
        const uprightDateKey = findDateKey((draw) => !draw.reversed)

        const reversed = renderDailyDraw(reversedDateKey)
        const reversedImage = reversed.container.querySelector(
            '[data-testid="card-image"]'
        )
        expect(reversedImage?.getAttribute('data-reversed')).toBe('true')
        reversed.unmount()

        const upright = renderDailyDraw(uprightDateKey)
        const uprightImage = upright.container.querySelector(
            '[data-testid="card-image"]'
        )
        expect(uprightImage?.getAttribute('data-reversed')).not.toBe('true')
        upright.unmount()
    })

    it('shows a reversed plaque with text identical across two different reversed cards', () => {
        const firstReversedKey = findDateKey((draw) => draw.reversed)
        const firstCardId = drawForDate(
            DAILY_SPREAD_ID,
            1,
            firstReversedKey
        )[0]!.card.id

        function findDistinctReversedDateKey(maxDays = 400): string {
            for (let i = 0; i < maxDays; i++) {
                const dateKey = dateKeyAt(i)
                const draw = drawForDate(DAILY_SPREAD_ID, 1, dateKey)[0]!
                if (draw.reversed && draw.card.id !== firstCardId) {
                    return dateKey
                }
            }
            throw new Error(
                'No distinct reversed card found within synthetic date range'
            )
        }

        const secondKey = findDistinctReversedDateKey()

        const first = renderDailyDraw(firstReversedKey)
        const firstPlaque = first.getByTestId('reversal-plaque').textContent
        first.unmount()

        const second = renderDailyDraw(secondKey)
        const secondPlaque = second.getByTestId('reversal-plaque').textContent
        second.unmount()

        expect(firstPlaque).toBeTruthy()
        expect(firstPlaque).toBe(secondPlaque)
    })
})

describe('daily reveal: inscriptional roman date beside a readable date', () => {
    it('renders the roman-numeral date via romanDate(dateKey) next to a readable date', () => {
        const dateKey = dateKeyAt(4)
        const { getByTestId } = renderDailyDraw(dateKey)

        const romanDateNode = getByTestId('roman-date')
        expect((romanDateNode.textContent ?? '').trim()).toBe(
            romanDate(dateKey)
        )

        const readableDateNode = getByTestId('readable-date')
        expect(
            (readableDateNode.textContent ?? '').trim().length
        ).toBeGreaterThan(0)
    })
})

describe('daily reveal: no-JS visitors see the revealed presentation', () => {
    it('includes a noscript fallback that forces the revealed state', async () => {
        // React 19's client renderer treats `<noscript>` children as opaque
        // text and drops them at commit — `render()` (client, via
        // `renderDailyDraw`) can never show a `<style>` child inside it, no
        // matter what the implementation does. The no-JS fallback is only
        // ever meaningful in the server-rendered HTML a visitor without
        // JavaScript actually receives, which is what Astro serves for this
        // island. So this one test renders to a static markup string with
        // `react-dom/server` instead of mounting into jsdom.
        const dateKey = dateKeyAt(5)
        const { renderToStaticMarkup } = await import('react-dom/server')
        const html = renderToStaticMarkup(
            createElement(DailyDraw, { dateKey, collections })
        )

        const template = document.createElement('template')
        template.innerHTML = html
        const noscript = template.content.querySelector('noscript')
        expect(noscript).not.toBeNull()

        // The HTML parser treats `<noscript>` as rawtext when scripting is
        // enabled (true both in a real browser and in this jsdom template),
        // so its `<style>` child is never parsed into a real element —
        // `innerHTML`/`textContent` instead hand back the literal markup
        // string. Match against that string rather than querying for a
        // `style` element.
        const noscriptMarkup = noscript!.innerHTML
        expect(noscriptMarkup).toMatch(/<style[^>]*>[\s\S]*<\/style>/i)
        expect(noscriptMarkup).toMatch(/revealed/i)
    })
})

describe('daily reveal: focus moves to the card name on reveal', () => {
    it('moves focus to the card-name heading after the reveal is activated', () => {
        const dateKey = dateKeyAt(6)
        const { container, getByTestId } = renderDailyDraw(dateKey)

        fireEvent.click(getByTestId('reveal-button'))

        const cardName = container.querySelector('[data-testid="card-name"]')
        expect(cardName).not.toBeNull()
        expect(container.ownerDocument.activeElement).toBe(cardName)
    })
})
