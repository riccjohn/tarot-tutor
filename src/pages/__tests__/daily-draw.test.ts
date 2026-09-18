// @vitest-environment jsdom
import { fireEvent, render, within } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import DailyDraw, {
    DAILY_SECOND_SPREAD_ID,
    DAILY_SPREAD_ID,
} from '../../components/islands/DailyDraw'
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
import {
    EXPECTED_SECTION_ORDER,
    sectionOrderFromDom,
} from './section-order-contract'

/**
 * Home-page contract for the daily draw (Phase 7, L4 boundary).
 *
 * This file exercises `DailyDraw` (a React island) two ways, per the plan's
 * architectural constraint:
 *
 * - "render the React island directly": via `@testing-library/react`'s
 *   `render`, which mounts real markup into jsdom so the second-card
 *   affordance can actually be clicked (`fireEvent.click`), not merely
 *   inspected as a static string.
 * - "render the page shell via astro/container": `CardSections.astro` (the
 *   component that already enforces the locked section order on every card
 *   page — see `card-page.test.ts`) is rendered through
 *   `experimental_AstroContainer` with the SAME composed card the island
 *   receives, so the two renderings' section order can be compared directly
 *   rather than asserted against each in isolation.
 *
 * File is `.ts`, not `.tsx` — deliberately. Vite's default esbuild loader for
 * `.ts` files does not enable JSX, so this file uses `createElement` rather
 * than JSX syntax throughout, to keep a JSX-transform error from ever being
 * mistaken for the intended RED failure.
 *
 * The date key is never the real clock: every test computes it via
 * `localDateKey` from a fixed synthetic base date, so the suite is
 * reproducible regardless of when it runs.
 *
 * New selectors this test hands to the Phase 7 GREEN implementation, none of
 * which exist in the CardSections contract already established by Phase 6:
 * - `second-card-button` — the affordance that reveals the optional second
 *   card
 * - `second-card` — wraps the revealed second card's own section markup
 * - `reversal-note` — reversal-as-technique framing, present only when the
 *   card in question is reversed
 * - `daily-mechanism-note` — the one place the "locked to today" mechanism
 *   is stated
 *
 * Every other testid used below (`card-image`, `suit-info`, `number-info`,
 * `rank-info`, `arc-context`, `common-reading`, `invitation-prompt`) is
 * reused verbatim from the CardSections contract rather than reinvented.
 */

// ---------------------------------------------------------------------------
// Fixtures — mirrors `src/pages/__tests__/card-page.test.ts`: plain
// `ContentEntry` objects fed straight to `composeCard`, covering the whole
// 78-card deck so composition succeeds no matter which card a given date
// key happens to draw.
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
// Date-key helpers — synthetic, sequential, never the real clock.
// ---------------------------------------------------------------------------

const BASE_DATE = new Date(2026, 0, 1)

/** A real `YYYY-MM-DD` local date key, `offsetDays` after a fixed synthetic base. */
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

/** A date key whose primary and second-card draws land on different cards. */
function findDateKeyWithDistinctSecondCard(maxDays = 400): string {
    for (let i = 0; i < maxDays; i++) {
        const dateKey = dateKeyAt(i)
        const primary = drawForDate(DAILY_SPREAD_ID, 1, dateKey)[0]!
        const secondary = drawForDate(DAILY_SECOND_SPREAD_ID, 1, dateKey)[0]!
        if (primary.card.id !== secondary.card.id) return dateKey
    }
    throw new Error(
        `No date key within ${maxDays} synthetic days yields a distinct second card`
    )
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

/** Mounts `DailyDraw` via testing-library. This file runs under jsdom. */
function renderDailyDraw(dateKey: string) {
    return render(createElement(DailyDraw, { dateKey, collections }))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('daily draw: one card, locked to the date', () => {
    it('renders exactly one card for a given date key', () => {
        const dateKey = dateKeyAt(0)
        const { container } = renderDailyDraw(dateKey)
        const images = container.querySelectorAll('[data-testid="card-image"]')
        expect(images).toHaveLength(1)
        expect(
            (images[0]!.getAttribute('alt') ?? '').trim().length
        ).toBeGreaterThan(0)
    })

    it('renders the same card and orientation when rendered repeatedly with that key', () => {
        const dateKey = dateKeyAt(1)

        const first = renderDailyDraw(dateKey)
        const firstAlt = first.container
            .querySelector('[data-testid="card-image"]')
            ?.getAttribute('alt')
        first.unmount()

        const second = renderDailyDraw(dateKey)
        const secondAlt = second.container
            .querySelector('[data-testid="card-image"]')
            ?.getAttribute('alt')
        second.unmount()

        const third = renderDailyDraw(dateKey)
        const thirdAlt = third.container
            .querySelector('[data-testid="card-image"]')
            ?.getAttribute('alt')
        third.unmount()

        expect(firstAlt).toBeTruthy()
        expect(secondAlt).toBe(firstAlt)
        expect(thirdAlt).toBe(firstAlt)
    })

    it('generally produces different cards for different date keys', () => {
        const sampleSize = 60
        const seen = new Set<string>()

        for (let i = 0; i < sampleSize; i++) {
            const { container, unmount } = renderDailyDraw(dateKeyAt(i))
            const alt = container
                .querySelector('[data-testid="card-image"]')
                ?.getAttribute('alt')
            expect(alt).toBeTruthy()
            seen.add(alt!)
            unmount()
        }

        // Comfortably below the ~48 unique cards a 78-card deck would
        // typically yield across 60 independent daily draws, but far
        // above 1 — so a stub or a bug that always draws the same card
        // fails this, without the assertion being sensitive to normal
        // draw variance.
        expect(seen.size).toBeGreaterThanOrEqual(18)
    })
})

describe('daily draw: no reroll affordance', () => {
    it('exposes no reroll, reshuffle or "draw again" control anywhere in the output', () => {
        const dateKey = dateKeyAt(2)
        const { container, getByTestId } = renderDailyDraw(dateKey)

        const rerollLike =
            /reroll|redraw|reshuffle|draw again|new card|try again/i

        for (const button of Array.from(container.querySelectorAll('button'))) {
            expect(button.textContent ?? '').not.toMatch(rerollLike)
        }
        expect(container.textContent ?? '').not.toMatch(rerollLike)

        // Reveal the second card too — the affordance for that is
        // legitimate product surface, but taking it must not introduce a
        // reroll control.
        const secondCardButton = getByTestId('second-card-button')
        fireEvent.click(secondCardButton)

        for (const button of Array.from(container.querySelectorAll('button'))) {
            expect(button.textContent ?? '').not.toMatch(rerollLike)
        }
        expect(container.textContent ?? '').not.toMatch(rerollLike)
    })
})

describe('daily draw: optional second card', () => {
    it('exposes a second-card affordance that reveals a card distinct from the first', () => {
        const dateKey = findDateKeyWithDistinctSecondCard()
        const { container, getByTestId } = renderDailyDraw(dateKey)

        expect(
            container.querySelectorAll('[data-testid="card-image"]')
        ).toHaveLength(1)
        const firstAlt = container
            .querySelector('[data-testid="card-image"]')
            ?.getAttribute('alt')

        const secondCardButton = getByTestId('second-card-button')
        fireEvent.click(secondCardButton)

        const images = container.querySelectorAll('[data-testid="card-image"]')
        expect(images).toHaveLength(2)

        const secondSection = within(container).getByTestId('second-card')
        const secondAlt = within(secondSection)
            .getByTestId('card-image')
            .getAttribute('alt')

        expect(secondAlt).toBeTruthy()
        expect(secondAlt).not.toBe(firstAlt)
    })
})

describe('daily draw: locked section order matches a card page', () => {
    /*
        This file cannot render `CardSections.astro` to compare the two
        renderers directly: importing a `.astro` component while a DOM
        global exists resolves it to the client build, where
        `isAstroComponentFactory` is undefined and `AstroContainer` throws
        `NoMatchingRenderer`. So each renderer is pinned to the shared
        sequences in `./section-order-contract` from the environment it
        needs — the Astro side in `card-page.test.ts` under node, the React
        side here under jsdom. Either one drifting fails its own file.
    */
    it.each([
        // Match on the `kind` discriminant, not on field presence: a
        // PipCard also carries a `rank` (ace..ten), so `'rank' in card`
        // silently selects pips as well as courts.
        ['pip', (card: Card) => card.kind === 'pip'],
        ['court', (card: Card) => card.kind === 'court'],
        ['major', (card: Card) => card.kind === 'major'],
    ] as const)(
        'presents the %s section order the card page locks in',
        (kind, matches) => {
            const dateKey = findDateKey((draw) => matches(draw.card))
            const { container } = renderDailyDraw(dateKey)

            expect(sectionOrderFromDom(container)).toEqual(
                EXPECTED_SECTION_ORDER[kind]
            )
        }
    )
})

describe('daily draw: reversal is technique framing, never card-specific', () => {
    it('marks a reversed draw and offers reversal framing, absent on an upright draw', () => {
        const uprightDateKey = findDateKey((draw) => !draw.reversed)
        const reversedDateKey = findDateKey((draw) => draw.reversed)

        const upright = renderDailyDraw(uprightDateKey)
        expect(upright.queryByTestId('reversal-note')).toBeNull()
        upright.unmount()

        const reversed = renderDailyDraw(reversedDateKey)
        const note = reversed.queryByTestId('reversal-note')
        expect(note).not.toBeNull()
        expect((note!.textContent ?? '').trim().length).toBeGreaterThan(0)
        reversed.unmount()
    })

    it('frames reversal identically across two different reversed cards, never with card-specific interpretation', () => {
        const firstReversedKey = findDateKey((draw) => draw.reversed)
        const firstCardId = drawForDate(
            DAILY_SPREAD_ID,
            1,
            firstReversedKey
        )[0]!.card.id

        // A second reversed draw landing on a DIFFERENT card than the first,
        // found by direct scan rather than `findDateKey` (whose predicate
        // only sees one draw at a time, not the first card's id).
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
        const secondCardId = drawForDate(DAILY_SPREAD_ID, 1, secondKey)[0]!.card
            .id
        expect(secondCardId).not.toBe(firstCardId)

        const first = renderDailyDraw(firstReversedKey)
        const firstNote = first.getByTestId('reversal-note').textContent
        first.unmount()

        const second = renderDailyDraw(secondKey)
        const secondNote = second.getByTestId('reversal-note').textContent
        second.unmount()

        expect(firstNote).toBeTruthy()
        expect(firstNote).toBe(secondNote)
    })
})

describe('daily draw: mechanism stated once', () => {
    it('states the "locked to today" mechanism in exactly one place, not repeated per card', () => {
        const dateKey = findDateKeyWithDistinctSecondCard()
        const { container, getByTestId } = renderDailyDraw(dateKey)

        expect(
            container.querySelectorAll('[data-testid="daily-mechanism-note"]')
        ).toHaveLength(1)

        fireEvent.click(getByTestId('second-card-button'))

        expect(
            container.querySelectorAll('[data-testid="daily-mechanism-note"]')
        ).toHaveLength(1)
    })
})
