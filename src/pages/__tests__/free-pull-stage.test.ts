// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import FreePull, { type FreePullProps } from '../../components/islands/FreePull'
import type {
    CardPieceData,
    ComposedCard,
    MajorArcPieceData,
    NumberPieceData,
    RankPieceData,
    SuitPieceData,
} from '../../lib/content/compose'
import { getCard, type Card } from '../../lib/deck'
import type { Draw } from '../../lib/draw'
import {
    EXPECTED_SECTION_ORDER,
    sectionOrderFromDom,
} from './section-order-contract'

/**
 * Phase 7 (L4 boundary) — /draw fans pulled cards through the same
 * `CardPlate` frame-and-stage markup the daily draw uses (Phase 6), but
 * cooler: no date anywhere, and multiple pulls line up as a row rather than
 * a single reveal.
 *
 * This file is additive to `free-pull.test.ts`, never a replacement for it:
 * that file already locks the pull affordance, the per-card section order,
 * the RNG-injection contract and the "no date, ever" invariant for a single
 * pull. This file only adds the two things Phase 7 changes structurally —
 * `CardPlate` framing (frame + reversed art, replacing the bare `<img>` and
 * `reversal-badge` paragraph `FreePull` renders today) and multi-card
 * row layout — plus one variant of the "no date" check across *multiple*
 * pulls, which the existing single-pull version cannot exercise.
 *
 * New selector this file hands to the Phase 7 GREEN implementation, chosen
 * not to collide with any existing testid in `CARD_PAGE_TESTIDS`
 * (section-order-contract), `CardPlate` (`card-frame`, `card-image`,
 * `card-back`, `reversal-plaque`, `ornament`), or `free-pull.test.ts`
 * (`free-pull`, `drawn-card`, `reversal-badge`, `draft-badge`):
 * - `pull-row` — the container that holds one pull's plates, in pull order.
 *
 * Every test queries for existence with `query*` + an explicit
 * `expect(...).not.toBeNull()` before doing anything else with the result,
 * matching `free-pull.test.ts`'s own convention: against today's bare-`<img>`
 * implementation this always fails as a plain Vitest `AssertionError` on the
 * `card-frame` lookup, never a `TestingLibraryElementError` thrown by a
 * throwing `getBy*` query.
 */

/** Mirrors `free-pull.test.ts`'s `genericCompose` — a minimal, self-contained composer. */
function genericCompose(card: Card): ComposedCard {
    const own: CardPieceData = {
        name: card.name,
        symbols: [{ element: 'Fixture element', note: 'Fixture note' }],
        commonReading: `Fixture common reading for ${card.name}`,
        invitationPrompt: `Fixture invitation prompt for ${card.name}`,
        status: 'edited',
    }

    if (card.kind === 'major') {
        const majorArc: MajorArcPieceData = {
            cardId: card.id,
            number: card.number,
            septenary: 0,
            status: 'edited',
        }
        return { card, own, majorArc, status: 'edited' }
    }

    const suit: SuitPieceData = {
        suit: card.suit,
        name: card.suit,
        domain: `Fixture domain for ${card.suit}`,
        conventionalElement: 'Fixture element',
        status: 'edited',
    }

    if (card.kind === 'pip') {
        const number: NumberPieceData = {
            rank: card.rank,
            numeral: card.number,
            stage: `Fixture stage for ${card.rank}`,
            status: 'edited',
        }
        return { card, own, suit, number, status: 'edited' }
    }

    const rank: RankPieceData = {
        rank: card.rank,
        name: card.rank,
        ladderPosition: `Fixture ladder position for ${card.rank}`,
        status: 'edited',
    }
    return { card, own, suit, rank, status: 'edited' }
}

/** The `card-frame`'s expected `data-suit` for a given card, per `CardPlate`'s contract. */
function expectedSuitAttr(card: Card): string {
    return card.kind === 'major' ? 'major' : card.suit
}

/** Always draws the same card, `count` times over — only valid for count 1. */
function fixedSingleDraw(
    cardId: string,
    reversed = false
): (count: number) => Draw[] {
    const card = getCard(cardId)!
    return (count: number) =>
        Array.from({ length: count }, () => ({ card, reversed }))
}

/**
 * Draws a fixed, ordered sequence of distinct cards regardless of the
 * requested count (sliced to it) — lets a test pin an exact pull order
 * without depending on shuffling or a seeded RNG.
 */
function fixedOrderedDraw(
    entries: { cardId: string; reversed?: boolean }[]
): (count: number) => Draw[] {
    const draws = entries.map(({ cardId, reversed = false }) => ({
        card: getCard(cardId)!,
        reversed,
    }))
    return (count: number) => draws.slice(0, count)
}

function mount(props: FreePullProps) {
    // See `free-pull.test.ts`'s `mount`: RTL binds queries to the shared
    // document body, so a second mount inside one `it()` needs the previous
    // tree cleared first.
    cleanup()
    return render(createElement(FreePull, props))
}

function pullButton(container: ReturnType<typeof mount>) {
    return container.queryByRole('button', { name: /pull/i })
}

describe('free pull stage: cards render through CardPlate framing', () => {
    it("wraps a pulled card's art in a card-frame carrying the card's suit accent", () => {
        const card = getCard('three-of-swords')!
        const view = mount({
            draw: fixedSingleDraw('three-of-swords'),
            compose: genericCompose,
        })

        const button = pullButton(view)
        expect(button).not.toBeNull()
        fireEvent.click(button!)

        const drawnCard = view.queryByTestId('drawn-card')
        expect(drawnCard).not.toBeNull()

        const frame = drawnCard!.querySelector('[data-testid="card-frame"]')
        expect(frame).not.toBeNull()
        expect(frame!.getAttribute('data-suit')).toBe(expectedSuitAttr(card))

        const image = frame!.querySelector('[data-testid="card-image"]')
        expect(image).not.toBeNull()
        expect(image!.getAttribute('data-card-id')).toBe(card.id)
    })

    it('marks the card-image data-reversed="false" for an upright pull', () => {
        const view = mount({
            draw: fixedSingleDraw('the-star', false),
            compose: genericCompose,
        })
        const button = pullButton(view)
        expect(button).not.toBeNull()
        fireEvent.click(button!)

        const drawnCard = view.queryByTestId('drawn-card')
        expect(drawnCard).not.toBeNull()
        const frame = drawnCard!.querySelector('[data-testid="card-frame"]')
        expect(frame).not.toBeNull()
        const image = frame!.querySelector('[data-testid="card-image"]')
        expect(image).not.toBeNull()
        expect(image!.getAttribute('data-reversed')).toBe('false')
    })

    it('marks the card-image data-reversed="true" for a reversed pull, framed inside card-frame', () => {
        const view = mount({
            draw: fixedSingleDraw('the-star', true),
            compose: genericCompose,
        })
        const button = pullButton(view)
        expect(button).not.toBeNull()
        fireEvent.click(button!)

        const drawnCard = view.queryByTestId('drawn-card')
        expect(drawnCard).not.toBeNull()
        const frame = drawnCard!.querySelector('[data-testid="card-frame"]')
        expect(frame).not.toBeNull()
        const image = frame!.querySelector('[data-testid="card-image"]')
        expect(image).not.toBeNull()
        expect(image!.getAttribute('data-reversed')).toBe('true')
    })
})

describe('free pull stage: multiple pulls fan into a row of plates in pull order', () => {
    it('lines up a 3-card pull as a pull-row, cards in the exact order the draw function returned', () => {
        const order = [
            { cardId: 'the-fool' },
            { cardId: 'ten-of-cups', reversed: true },
            { cardId: 'queen-of-wands' },
        ]
        const view = mount({
            count: 3,
            draw: fixedOrderedDraw(order),
            compose: genericCompose,
        })
        const button = pullButton(view)
        expect(button).not.toBeNull()
        fireEvent.click(button!)

        const row = view.container.querySelector('[data-testid="pull-row"]')
        expect(row).not.toBeNull()

        const cardsInRow = Array.from(
            row!.querySelectorAll('[data-testid="drawn-card"]')
        )
        expect(cardsInRow).toHaveLength(3)

        const idsInRow = cardsInRow.map((el) => el.getAttribute('data-card-id'))
        expect(idsInRow).toEqual(order.map((entry) => entry.cardId))

        // The reversed entry's frame carries the reversed art marker, in place.
        const reversedFrame = cardsInRow[1]!.querySelector(
            '[data-testid="card-frame"] [data-testid="card-image"]'
        )
        expect(reversedFrame).not.toBeNull()
        expect(reversedFrame!.getAttribute('data-reversed')).toBe('true')
    })

    it('keeps every plate in a multi-card pull-row on the locked section order contract', () => {
        const order = [
            { cardId: 'five-of-pentacles' },
            { cardId: 'king-of-cups' },
            { cardId: 'the-tower' },
        ]
        const view = mount({
            count: 3,
            draw: fixedOrderedDraw(order),
            compose: genericCompose,
        })
        const button = pullButton(view)
        expect(button).not.toBeNull()
        fireEvent.click(button!)

        const row = view.container.querySelector('[data-testid="pull-row"]')
        expect(row).not.toBeNull()

        const cardsInRow = Array.from(
            row!.querySelectorAll('[data-testid="drawn-card"]')
        )
        expect(cardsInRow).toHaveLength(3)

        const kinds = [
            getCard('five-of-pentacles')!.kind,
            getCard('king-of-cups')!.kind,
            getCard('the-tower')!.kind,
        ] as const

        cardsInRow.forEach((cardEl, i) => {
            expect(sectionOrderFromDom(cardEl)).toEqual(
                EXPECTED_SECTION_ORDER[kinds[i]!]
            )
        })
    })
})

describe('free pull stage: no calendar date across multiple pulls', () => {
    it('never renders a YYYY-MM-DD-shaped date after several successive pulls', () => {
        const view = mount({ count: 2, compose: genericCompose })
        const button = pullButton(view)
        expect(button).not.toBeNull()

        // Pull three times in a row (unlike free-pull.test.ts's single-pull
        // check) — a per-pull row that concatenated a date per row, or a
        // stray "pulled on <date>" caption added only after a second pull,
        // would still be caught here.
        fireEvent.click(button!)
        fireEvent.click(button!)
        fireEvent.click(button!)

        expect(view.queryAllByTestId('drawn-card')).toHaveLength(2)
        expect(view.container.textContent ?? '').not.toMatch(
            /\d{4}-\d{2}-\d{2}/
        )
    })
})

describe('free pull stage: the pull control keeps its accessible name', () => {
    it('exposes a button whose accessible name is exactly "Pull"', () => {
        const view = mount({ compose: genericCompose })

        // Pinned to the exact text FreePull.tsx renders inside its <button>
        // today ("Pull"), not merely matched loosely — a rename (even one
        // that still matches /pull/i, like "Pull cards") should fail this.
        const exact = view.queryByRole('button', { name: 'Pull' })
        expect(exact).not.toBeNull()
        expect((exact!.textContent ?? '').trim()).toBe('Pull')
    })
})
