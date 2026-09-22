import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
    composeCard,
    type CardPieceData,
    type ContentCollections,
    type ContentEntry,
    type MajorArcPieceData,
    type NumberPieceData,
    type PieceStatus,
    type RankPieceData,
    type SuitPieceData,
} from '../content/compose'
import {
    COURT_RANKS,
    DECK,
    getCard,
    isMajor,
    PIP_RANKS,
    SUITS,
    type Card,
    type MajorCard,
} from '../deck'

/**
 * Phase 1 contract: the composed status of a card is the LEAST finished of
 * its constituent pieces, on the ordering draft < review < edited.
 *
 * `PieceStatus` does not include 'review' until the implementation lands, so
 * the literal is cast. The tests assert at the `composeCard` boundary only.
 */

const DRAFT = 'draft' as PieceStatus
const REVIEW = 'review' as PieceStatus
const EDITED = 'edited' as PieceStatus

const STATUS_ARB: fc.Arbitrary<PieceStatus> = fc.constantFrom(
    DRAFT,
    REVIEW,
    EDITED
)

/** Independent oracle for the expected composed status. */
function leastFinished(statuses: readonly PieceStatus[]): PieceStatus {
    if (statuses.every((s) => s === EDITED)) return EDITED
    if (statuses.includes(DRAFT)) return DRAFT
    return REVIEW
}

function septenaryFor(majorNumber: number): 0 | 1 | 2 | 3 {
    if (majorNumber === 0) return 0
    return Math.ceil(majorNumber / 7) as 1 | 2 | 3
}

function titleCase(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1)
}

/**
 * How many pieces compose this card: its own piece plus the shared piece(s)
 * its kind depends on (pips: suit + number, courts: suit + rank, majors: arc).
 */
function pieceCount(card: Card): number {
    return isMajor(card) ? 2 : 3
}

/**
 * Builds a full set of collections in which every piece is `edited`, except
 * the pieces this card actually composes from, which take `statuses` in order:
 * [own, suit | arc, number | rank].
 */
function collectionsWithStatuses(
    card: Card,
    statuses: readonly PieceStatus[]
): ContentCollections {
    const statusFor = (index: number): PieceStatus => statuses[index] ?? EDITED

    const cards: ContentEntry<CardPieceData>[] = DECK.map((c) => ({
        id: c.id,
        data: {
            name: c.name,
            symbols: [
                { element: 'fixture element A', note: 'fixture note A' },
                { element: 'fixture element B', note: 'fixture note B' },
                { element: 'fixture element C', note: 'fixture note C' },
            ],
            commonReading: `Fixture common reading for ${c.name}`,
            invitationPrompt: `Fixture invitation prompt for ${c.name}`,
            status: c.id === card.id ? statusFor(0) : EDITED,
        },
    }))

    const suits: ContentEntry<SuitPieceData>[] = SUITS.map((suit) => ({
        id: suit,
        data: {
            suit,
            name: titleCase(suit),
            domain: `Fixture domain for ${suit}`,
            conventionalElement: 'fixture element',
            status:
                !isMajor(card) && card.suit === suit ? statusFor(1) : EDITED,
        },
    }))

    const numbers: ContentEntry<NumberPieceData>[] = PIP_RANKS.map((rank) => ({
        id: rank,
        data: {
            rank,
            numeral: PIP_RANKS.indexOf(rank) + 1,
            stage: `Fixture stage for ${rank}`,
            status:
                card.kind === 'pip' && card.rank === rank
                    ? statusFor(2)
                    : EDITED,
        },
    }))

    const ranks: ContentEntry<RankPieceData>[] = COURT_RANKS.map((rank) => ({
        id: rank,
        data: {
            rank,
            name: titleCase(rank),
            ladderPosition: `Fixture ladder position for ${rank}`,
            status:
                card.kind === 'court' && card.rank === rank
                    ? statusFor(2)
                    : EDITED,
        },
    }))

    const majorsArc: ContentEntry<MajorArcPieceData>[] = DECK.filter(
        isMajor
    ).map((major: MajorCard) => ({
        id: major.id,
        data: {
            cardId: major.id,
            number: major.number,
            septenary: septenaryFor(major.number),
            status: major.id === card.id ? statusFor(1) : EDITED,
        },
    }))

    return { cards, suits, numbers, ranks, majorsArc }
}

/** A card paired with one status per piece it composes from. */
const cardWithStatuses = fc.constantFrom(...DECK).chain((card) =>
    fc
        .array(STATUS_ARB, {
            minLength: pieceCount(card),
            maxLength: pieceCount(card),
        })
        .map((statuses) => ({ card, statuses }))
)

describe('composed status is the least finished piece', () => {
    it('is edited when every piece is edited', () => {
        fc.assert(
            fc.property(fc.constantFrom(...DECK), (card) => {
                const statuses = Array<PieceStatus>(pieceCount(card)).fill(
                    EDITED
                )
                const composed = composeCard(
                    card,
                    collectionsWithStatuses(card, statuses)
                )
                expect(composed.status).toBe(EDITED)
            })
        )
    })

    it('is draft when any piece is draft, whatever the others are', () => {
        fc.assert(
            fc.property(
                cardWithStatuses.filter(({ statuses }) =>
                    statuses.includes(DRAFT)
                ),
                ({ card, statuses }) => {
                    const composed = composeCard(
                        card,
                        collectionsWithStatuses(card, statuses)
                    )
                    expect(composed.status).toBe(DRAFT)
                }
            )
        )
    })

    it('is review when any piece is review and none is draft', () => {
        fc.assert(
            fc.property(
                cardWithStatuses.filter(
                    ({ statuses }) =>
                        statuses.includes(REVIEW) && !statuses.includes(DRAFT)
                ),
                ({ card, statuses }) => {
                    const composed = composeCard(
                        card,
                        collectionsWithStatuses(card, statuses)
                    )
                    expect(composed.status).toBe(REVIEW)
                }
            )
        )
    })

    it('matches the least-finished oracle for any mix of statuses', () => {
        fc.assert(
            fc.property(cardWithStatuses, ({ card, statuses }) => {
                const composed = composeCard(
                    card,
                    collectionsWithStatuses(card, statuses)
                )
                expect(composed.status).toBe(leastFinished(statuses))
            })
        )
    })
})

describe('a card composed from review pieces', () => {
    it('has status review (pip)', () => {
        const card = getCard('five-of-cups')!
        const composed = composeCard(
            card,
            collectionsWithStatuses(card, [REVIEW, REVIEW, REVIEW])
        )
        expect(composed.status).toBe(REVIEW)
    })

    it('has status review (court)', () => {
        const card = getCard('king-of-wands')!
        const composed = composeCard(
            card,
            collectionsWithStatuses(card, [REVIEW, REVIEW, REVIEW])
        )
        expect(composed.status).toBe(REVIEW)
    })

    it('has status review (major)', () => {
        const card = getCard('the-tower')!
        const composed = composeCard(
            card,
            collectionsWithStatuses(card, [REVIEW, REVIEW])
        )
        expect(composed.status).toBe(REVIEW)
    })

    it('has status review when only one shared piece is review and the rest are edited', () => {
        const card = getCard('five-of-cups')!
        const composed = composeCard(
            card,
            collectionsWithStatuses(card, [EDITED, EDITED, REVIEW])
        )
        expect(composed.status).toBe(REVIEW)
    })
})
