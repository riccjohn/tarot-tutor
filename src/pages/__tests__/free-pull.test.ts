// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import FreePull, { type FreePullProps } from '../../components/islands/FreePull'
import type {
    CardPieceData,
    ComposedCard,
    MajorArcPieceData,
    NumberPieceData,
    PieceStatus,
    RankPieceData,
    SuitPieceData,
} from '../../lib/content/compose'
import { DECK, getCard, type Card } from '../../lib/deck'
import { mulberry32, shuffle, type Draw } from '../../lib/draw'

/**
 * Rendered-output contract for the self-directed free-pull island
 * (Phase 7, L4 boundary).
 *
 * Unlike the daily draw, unlimited pulls ARE the correct behaviour here, so
 * this file asserts the opposite invariants from the daily draw's: pulling
 * varies, pulling again is always available, and nothing is date-locked.
 *
 * `draw` — the card-selection function — is an injectable prop (defaulting
 * at the real call site to `drawFreely` from `src/lib/draw.ts`) precisely so
 * tests can control, or deterministically seed, which cards come back
 * without stubbing `Math.random`. `compose` is likewise injectable so this
 * file never has to assemble the full 78-card content-collection fixture
 * that `src/pages/__tests__/card-page.test.ts` builds — a plain per-card
 * composer is enough to exercise the locked section order.
 *
 * Rendered with `@testing-library/react` + jsdom (per-file environment
 * override above) rather than `renderToStaticMarkup`, because the contract
 * under test is inherently interactive: "on pull" behaviour, and variation
 * across repeated pulls, cannot be observed from a single static render.
 *
 * Every test below queries for existence with `query*` + an explicit
 * `expect(...).not.toBeNull()` *before* doing anything else with the result.
 * Against the empty-fragment RED stub this is always the first assertion to
 * run and fails as a plain Vitest `AssertionError` — never a
 * TestingLibraryElementError thrown by a throwing `getBy*` query, and never
 * a loop that could vacuously pass over zero elements.
 */

function testIdsInOrder(root: Element): (string | null)[] {
    return Array.from(root.querySelectorAll('[data-testid]')).map((el) =>
        el.getAttribute('data-testid')
    )
}

/**
 * Asserts one drawn card's internal markup follows the locked order this
 * site enforces everywhere a card is taught: image, then whichever
 * structural section(s) its kind carries (suit+number for pips, suit+rank
 * for courts, arc context for majors), then the symbol walkthrough, then the
 * common reading, then the invitation prompt.
 *
 * Mirrors `src/components/CardSections.astro`'s contract exactly — same
 * `data-testid`s, same relative order — since the plan requires this page to
 * reuse that contract rather than reimplementing a parallel one.
 */
function assertLockedSectionOrder(cardEl: Element) {
    const ids = testIdsInOrder(cardEl)
    const indexOf = (id: string) => ids.indexOf(id)

    const imageIndex = indexOf('card-image')
    const symbolsIndex = indexOf('symbol-walkthrough')
    const commonReadingIndex = indexOf('common-reading')
    const invitationIndex = indexOf('invitation-prompt')

    expect(imageIndex).toBeGreaterThanOrEqual(0)
    expect(symbolsIndex).toBeGreaterThan(imageIndex)
    expect(commonReadingIndex).toBeGreaterThan(symbolsIndex)
    expect(invitationIndex).toBeGreaterThan(commonReadingIndex)

    const suitIndex = indexOf('suit-info')
    const numberIndex = indexOf('number-info')
    const rankIndex = indexOf('rank-info')
    const arcIndex = indexOf('arc-context')

    // Exactly one of (suit+number), (suit+rank), (arc) is present, per the
    // card's kind — never more than one structural family at once.
    const families = [
        suitIndex >= 0 && numberIndex >= 0,
        suitIndex >= 0 && rankIndex >= 0,
        arcIndex >= 0,
    ].filter(Boolean)
    expect(families).toHaveLength(1)

    if (suitIndex >= 0) {
        expect(suitIndex).toBeGreaterThan(imageIndex)
        expect(symbolsIndex).toBeGreaterThan(suitIndex)
    }
    if (numberIndex >= 0) {
        expect(numberIndex).toBeGreaterThan(suitIndex)
        expect(symbolsIndex).toBeGreaterThan(numberIndex)
    }
    if (rankIndex >= 0) {
        expect(rankIndex).toBeGreaterThan(suitIndex)
        expect(symbolsIndex).toBeGreaterThan(rankIndex)
    }
    if (arcIndex >= 0) {
        expect(arcIndex).toBeGreaterThan(imageIndex)
        expect(symbolsIndex).toBeGreaterThan(arcIndex)
    }
}

/**
 * A minimal, self-contained per-card composer — no `astro:content`
 * dependency, no 78-entry collection fixtures. Shaped exactly like a real
 * `composeCard` result so `assertLockedSectionOrder` exercises the same
 * contract, but built directly from the card's own kind.
 */
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

function composeWithStatus(card: Card, status: PieceStatus): ComposedCard {
    const composed = genericCompose(card)
    return { ...composed, own: { ...composed.own, status }, status }
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
 * Builds a draw function from an injected, seeded RNG — the concrete
 * mechanism the plan asks for ("inject the RNG so variation is testable
 * deterministically"). Two draw functions built from the same seed must
 * produce byte-identical output; this is verified directly below, and then
 * used to assert the rendered island reproduces exactly that output.
 */
function seededDraw(seed: number): (count: number) => Draw[] {
    return (count: number) => {
        const rng = mulberry32(seed)
        const shuffled = shuffle(DECK, rng)
        return shuffled.slice(0, count).map((card) => ({
            card,
            reversed: rng() < 0.5,
        }))
    }
}

function mount(props: FreePullProps) {
    // RTL binds its queries to the shared `document.body`, not to the
    // container it just created, so a second mount inside one `it()` would
    // leave both trees attached and make queries throw "found multiple
    // elements". Two tests here mount more than once, so the helper clears
    // the previous tree first. Explicit and local, rather than aliasing
    // `@testing-library/react` repo-wide to a self-cleaning shim.
    cleanup()
    return render(createElement(FreePull, props))
}

function pullButton(container: ReturnType<typeof mount>) {
    return container.queryByRole('button', { name: /pull/i })
}

describe('free pull: pull affordance', () => {
    it('renders a pull button and no drawn card before any pull', () => {
        const view = mount({ compose: genericCompose })

        const button = pullButton(view)
        expect(button).not.toBeNull()
        expect(view.queryAllByTestId('drawn-card')).toHaveLength(0)
    })

    it('renders exactly one card, with the locked section order, once pulled', () => {
        const view = mount({
            draw: fixedSingleDraw('three-of-swords'),
            compose: genericCompose,
        })

        const button = pullButton(view)
        expect(button).not.toBeNull()
        fireEvent.click(button!)

        const cards = view.queryAllByTestId('drawn-card')
        expect(cards).toHaveLength(1)
        assertLockedSectionOrder(cards[0]!)
        expect(cards[0]!.getAttribute('data-card-id')).toBe('three-of-swords')
    })
})

describe('free pull: RNG injection is deterministic', () => {
    it('reproduces the exact card a seeded RNG produces, byte for byte, across independent renders', () => {
        const expected = seededDraw(1234)(1)[0]!

        const first = mount({ draw: seededDraw(1234), compose: genericCompose })
        const firstButton = pullButton(first)
        expect(firstButton).not.toBeNull()
        fireEvent.click(firstButton!)
        const firstCards = first.queryAllByTestId('drawn-card')
        expect(firstCards).toHaveLength(1)
        expect(firstCards[0]!.getAttribute('data-card-id')).toBe(
            expected.card.id
        )
        expect(firstCards[0]!.getAttribute('data-reversed')).toBe(
            String(expected.reversed)
        )

        // A fresh render, same seed: identical result. This is what makes
        // the RNG injection meaningful for testing rather than a one-off
        // canned value.
        const second = mount({
            draw: seededDraw(1234),
            compose: genericCompose,
        })
        const secondButton = pullButton(second)
        expect(secondButton).not.toBeNull()
        fireEvent.click(secondButton!)
        const secondCards = second.queryAllByTestId('drawn-card')
        expect(secondCards).toHaveLength(1)
        expect(secondCards[0]!.getAttribute('data-card-id')).toBe(
            expected.card.id
        )
    })
})

describe('free pull: reversal is marked and framed as technique', () => {
    it('shows no reversal badge for an upright pull', () => {
        const view = mount({
            draw: fixedSingleDraw('the-star', false),
            compose: genericCompose,
        })
        const button = pullButton(view)
        expect(button).not.toBeNull()
        fireEvent.click(button!)

        expect(view.queryAllByTestId('drawn-card')).toHaveLength(1)
        expect(view.queryByTestId('reversal-badge')).toBeNull()
    })

    it('marks a reversed pull with non-empty framing, without altering the per-card reading text', () => {
        const upright = mount({
            draw: fixedSingleDraw('the-star', false),
            compose: genericCompose,
        })
        const uprightButton = pullButton(upright)
        expect(uprightButton).not.toBeNull()
        fireEvent.click(uprightButton!)
        const uprightReading = upright.queryByTestId('common-reading')
        expect(uprightReading).not.toBeNull()
        const uprightText = uprightReading!.textContent

        const reversed = mount({
            draw: fixedSingleDraw('the-star', true),
            compose: genericCompose,
        })
        const reversedButton = pullButton(reversed)
        expect(reversedButton).not.toBeNull()
        fireEvent.click(reversedButton!)

        const badge = reversed.queryByTestId('reversal-badge')
        expect(badge).not.toBeNull()
        expect((badge!.textContent ?? '').trim().length).toBeGreaterThan(0)

        const reversedReading = reversed.queryByTestId('common-reading')
        expect(reversedReading).not.toBeNull()
        // No per-card reversed text: the same card's common reading is
        // identical regardless of orientation. `ComposedCard` has no field
        // for a reversed reading (see `src/lib/content/compose.ts`), so any
        // difference here would mean the island invented one out of band.
        expect(reversedReading!.textContent).toBe(uprightText)
    })
})

describe('free pull: no repeat within one pull, for every count 1..10', () => {
    for (let count = 1; count <= 10; count++) {
        it(`draws ${count} unique card(s) with the default (real) drawFreely`, () => {
            const view = mount({ count, compose: genericCompose })
            const button = pullButton(view)
            expect(button).not.toBeNull()
            fireEvent.click(button!)

            const cards = view.queryAllByTestId('drawn-card')
            expect(cards).toHaveLength(count)
            const ids = cards.map((el) => el.getAttribute('data-card-id'))
            expect(new Set(ids).size).toBe(count)
        })
    }
})

describe('free pull: locked section order holds across a multi-card pull', () => {
    it('renders the locked section order for every card in a 5-card pull', () => {
        const view = mount({ count: 5, compose: genericCompose })
        const button = pullButton(view)
        expect(button).not.toBeNull()
        fireEvent.click(button!)

        const cards = view.queryAllByTestId('drawn-card')
        expect(cards).toHaveLength(5)
        for (const card of cards) {
            assertLockedSectionOrder(card)
        }
    })
})

describe('free pull: repeated pulls vary (statistical)', () => {
    it('lands on more than a handful of distinct cards across many independent pulls', () => {
        const view = mount({ compose: genericCompose })
        const button = pullButton(view)
        expect(button).not.toBeNull()

        const seen = new Set<string | null>()
        const SAMPLE_SIZE = 40
        for (let i = 0; i < SAMPLE_SIZE; i++) {
            fireEvent.click(button!)
            const cards = view.queryAllByTestId('drawn-card')
            expect(cards).toHaveLength(1)
            seen.add(cards[0]!.getAttribute('data-card-id'))
        }

        // 78 cards in the deck; landing on 5 or fewer distinct cards across
        // 40 independent draws would mean the draw is effectively not
        // varying. This threshold is generous enough not to flake against
        // genuine randomness while still failing hard against a stub or a
        // draw that silently repeats.
        expect(seen.size).toBeGreaterThan(5)
    })
})

describe('free pull: distinct from the daily draw', () => {
    it('identifies itself as the free-pull view and draws fresh on every pull rather than caching a locked result', () => {
        const draw = vi.fn(fixedSingleDraw('the-magician'))
        const view = mount({ draw, compose: genericCompose })

        expect(
            view.container.querySelector('[data-testid="free-pull"]')
        ).not.toBeNull()

        const button = pullButton(view)
        expect(button).not.toBeNull()

        fireEvent.click(button!)
        fireEvent.click(button!)
        fireEvent.click(button!)

        // Unlimited pulls: the draw function is invoked fresh on every
        // click (never cached, never date-locked), and the affordance
        // never disables itself the way a single-reveal daily card would.
        expect(draw).toHaveBeenCalledTimes(3)
        expect(button!.hasAttribute('disabled')).toBe(false)
    })

    it('never renders a calendar date anywhere in its output', () => {
        const view = mount({ compose: genericCompose })
        const button = pullButton(view)
        expect(button).not.toBeNull()
        fireEvent.click(button!)

        expect(view.queryAllByTestId('drawn-card')).toHaveLength(1)
        // A locked daily card is inseparable from "today"; a free pull is
        // not tied to any date at all, so no YYYY-MM-DD-shaped text (the
        // format `localDateKey` produces) should appear anywhere on the
        // page — not as a label, not as a caption.
        expect(view.container.textContent ?? '').not.toMatch(
            /\d{4}-\d{2}-\d{2}/
        )
    })
})

describe('free pull: draft marker', () => {
    it('shows a draft badge for a draft-status pull', () => {
        const card = getCard('the-fool')!
        const view = mount({
            draw: fixedSingleDraw('the-fool'),
            compose: (c) => composeWithStatus(c, 'draft'),
        })
        const button = pullButton(view)
        expect(button).not.toBeNull()
        fireEvent.click(button!)

        expect(view.queryAllByTestId('drawn-card')).toHaveLength(1)
        const badge = view.queryByTestId('draft-badge')
        expect(badge).not.toBeNull()
        expect((badge!.textContent ?? '').trim().length).toBeGreaterThan(0)
        // Sanity: this fixture really is the card we asked for.
        expect(
            view.queryAllByTestId('drawn-card')[0]!.getAttribute('data-card-id')
        ).toBe(card.id)
    })

    it('hides the draft badge for an edited-status pull', () => {
        const view = mount({
            draw: fixedSingleDraw('the-fool'),
            compose: (c) => composeWithStatus(c, 'edited'),
        })
        const button = pullButton(view)
        expect(button).not.toBeNull()
        fireEvent.click(button!)

        expect(view.queryAllByTestId('drawn-card')).toHaveLength(1)
        expect(view.queryByTestId('draft-badge')).toBeNull()
    })
})
