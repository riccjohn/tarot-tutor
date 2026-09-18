import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
    composeCard,
    MissingContentPieceError,
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
    type CourtRank,
    type MajorCard,
    type PipRank,
    type Suit,
} from '../deck'

/**
 * Fixture builders.
 *
 * These stand in for the real `src/content/` markdown, which does not exist
 * yet at this phase. `composeCard` is a pure function of plain collection
 * entries, so it can — and, architecturally, must — be exercised entirely
 * against data built here, with no dependency on `astro:content` or the
 * filesystem.
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
    status: PieceStatus = 'edited'
): ContentEntry<CardPieceData> {
    return {
        id: card.id,
        data: {
            name: card.name,
            symbols: [
                { element: 'fixture element A', note: 'fixture note A' },
                { element: 'fixture element B', note: 'fixture note B' },
                { element: 'fixture element C', note: 'fixture note C' },
            ],
            commonReading: `Fixture common reading for ${card.name}`,
            invitationPrompt: `Fixture invitation prompt for ${card.name}`,
            status,
        },
    }
}

function makeSuitEntry(
    suit: Suit,
    status: PieceStatus = 'edited'
): ContentEntry<SuitPieceData> {
    return {
        id: suit,
        data: {
            suit,
            name: titleCase(suit),
            domain: `Fixture domain for ${suit}`,
            conventionalElement: 'fixture element',
            status,
        },
    }
}

function makeNumberEntry(
    rank: PipRank,
    status: PieceStatus = 'edited'
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
    status: PieceStatus = 'edited'
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
    status: PieceStatus = 'edited'
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

/** A complete set of collections covering every one of the 78 cards and all 40 shared pieces. */
function buildFullCollections(): ContentCollections {
    return {
        cards: DECK.map((card) => makeCardEntry(card)),
        suits: SUITS.map((suit) => makeSuitEntry(suit)),
        numbers: PIP_RANKS.map((rank) => makeNumberEntry(rank)),
        ranks: COURT_RANKS.map((rank) => makeRankEntry(rank)),
        majorsArc: DECK.filter(isMajor).map((card) => makeMajorArcEntry(card)),
    }
}

const pipCards = DECK.filter(
    (card): card is Extract<Card, { kind: 'pip' }> => card.kind === 'pip'
)
const courtCards = DECK.filter(
    (card): card is Extract<Card, { kind: 'court' }> => card.kind === 'court'
)
const majorCards = DECK.filter(isMajor)

/** Recursively checks whether any key or string value anywhere in `value` mentions "reversed". */
function mentionsReversed(value: unknown): boolean {
    if (value === null || value === undefined) return false
    if (typeof value === 'string') {
        return value.toLowerCase().includes('revers')
    }
    if (Array.isArray(value)) {
        return value.some(mentionsReversed)
    }
    if (typeof value === 'object') {
        return Object.entries(value as Record<string, unknown>).some(
            ([key, val]) =>
                key.toLowerCase().includes('revers') || mentionsReversed(val)
        )
    }
    return false
}

describe('composeCard: pips', () => {
    it('composes a known pip from its own piece plus exactly its suit and number pieces', () => {
        const collections = buildFullCollections()
        const payload = composeCard(getCard('five-of-cups')!, collections)

        expect(payload.own.name).toBe('Five of Cups')
        expect(payload.own.commonReading).toContain('Five of Cups')
        expect(payload.suit?.suit).toBe('cups')
        expect(payload.number?.rank).toBe('five')
        expect(payload.rank).toBeUndefined()
        expect(payload.majorArc).toBeUndefined()
    })

    it('composes every pip in the deck from its own piece plus exactly one suit piece and one number piece', () => {
        fc.assert(
            fc.property(fc.constantFrom(...pipCards), (card) => {
                const collections = buildFullCollections()
                const payload = composeCard(card, collections)

                expect(payload.own.name).toBe(card.name)
                expect(payload.suit?.suit).toBe(card.suit)
                expect(payload.number?.rank).toBe(card.rank)
                expect(payload.rank).toBeUndefined()
                expect(payload.majorArc).toBeUndefined()
            })
        )
    })
})

describe('composeCard: courts', () => {
    it('composes a known court card from its own piece plus exactly its suit and rank pieces', () => {
        const collections = buildFullCollections()
        const payload = composeCard(getCard('king-of-wands')!, collections)

        expect(payload.own.name).toBe('King of Wands')
        expect(payload.suit?.suit).toBe('wands')
        expect(payload.rank?.rank).toBe('king')
        expect(payload.number).toBeUndefined()
        expect(payload.majorArc).toBeUndefined()
    })

    it('composes every court card in the deck from its own piece plus exactly one suit piece and one rank piece', () => {
        fc.assert(
            fc.property(fc.constantFrom(...courtCards), (card) => {
                const collections = buildFullCollections()
                const payload = composeCard(card, collections)

                expect(payload.own.name).toBe(card.name)
                expect(payload.suit?.suit).toBe(card.suit)
                expect(payload.rank?.rank).toBe(card.rank)
                expect(payload.number).toBeUndefined()
                expect(payload.majorArc).toBeUndefined()
            })
        )
    })
})

describe('composeCard: majors', () => {
    it('composes a known major from its own piece plus its arc piece, and no suit or number piece', () => {
        const collections = buildFullCollections()
        const payload = composeCard(getCard('the-tower')!, collections)

        expect(payload.own.name).toBe('The Tower')
        expect(payload.majorArc?.cardId).toBe('the-tower')
        expect(payload.suit).toBeUndefined()
        expect(payload.number).toBeUndefined()
        expect(payload.rank).toBeUndefined()
    })

    it('composes every major in the deck from its own piece plus its arc piece, and never a suit or number piece', () => {
        fc.assert(
            fc.property(fc.constantFrom(...majorCards), (card) => {
                const collections = buildFullCollections()
                const payload = composeCard(card, collections)

                expect(payload.own.name).toBe(card.name)
                expect(payload.majorArc?.cardId).toBe(card.id)
                expect(payload.majorArc?.number).toBe(card.number)
                expect(payload.suit).toBeUndefined()
                expect(payload.number).toBeUndefined()
                expect(payload.rank).toBeUndefined()
            })
        )
    })
})

describe('composeCard: shared-piece budget across the whole deck', () => {
    it('references only the 40 shared pieces across all 78 cards, never more', () => {
        const collections = buildFullCollections()
        const referenced = new Set<string>()

        for (const card of DECK) {
            const payload = composeCard(card, collections)
            if (payload.suit) referenced.add(`suit:${payload.suit.suit}`)
            if (payload.number) referenced.add(`number:${payload.number.rank}`)
            if (payload.rank) referenced.add(`rank:${payload.rank.rank}`)
            if (payload.majorArc) {
                referenced.add(`majorArc:${payload.majorArc.cardId}`)
            }
        }

        // 4 suits + 10 numbers + 4 ranks + 22 major arcs = 40.
        expect(referenced.size).toBe(40)
    })
})

describe('composeCard: missing shared piece', () => {
    it('throws a structured, named error rather than a partial payload when the suit piece is missing', () => {
        const collections = buildFullCollections()
        collections.suits = collections.suits.filter(
            (entry) => entry.data.suit !== 'cups'
        )
        const card = getCard('five-of-cups')!

        expect(() => composeCard(card, collections)).toThrow(
            MissingContentPieceError
        )
        try {
            composeCard(card, collections)
            expect.fail('composeCard should have thrown')
        } catch (error) {
            expect(error).toBeInstanceOf(MissingContentPieceError)
            const missing = error as MissingContentPieceError
            expect(missing.name).toBe('MissingContentPieceError')
            expect(missing.cardId).toBe('five-of-cups')
            expect(missing.pieceKind).toBe('suit')
        }
    })

    it('throws a structured, named error when the number piece is missing', () => {
        const collections = buildFullCollections()
        collections.numbers = collections.numbers.filter(
            (entry) => entry.data.rank !== 'five'
        )
        const card = getCard('five-of-cups')!

        try {
            composeCard(card, collections)
            expect.fail('composeCard should have thrown')
        } catch (error) {
            expect(error).toBeInstanceOf(MissingContentPieceError)
            expect((error as MissingContentPieceError).pieceKind).toBe('number')
        }
    })

    it('throws a structured, named error when the rank piece is missing', () => {
        const collections = buildFullCollections()
        collections.ranks = collections.ranks.filter(
            (entry) => entry.data.rank !== 'king'
        )
        const card = getCard('king-of-wands')!

        try {
            composeCard(card, collections)
            expect.fail('composeCard should have thrown')
        } catch (error) {
            expect(error).toBeInstanceOf(MissingContentPieceError)
            expect((error as MissingContentPieceError).pieceKind).toBe('rank')
        }
    })

    it('throws a structured, named error when the major-arc piece is missing', () => {
        const collections = buildFullCollections()
        collections.majorsArc = collections.majorsArc.filter(
            (entry) => entry.data.cardId !== 'the-tower'
        )
        const card = getCard('the-tower')!

        try {
            composeCard(card, collections)
            expect.fail('composeCard should have thrown')
        } catch (error) {
            expect(error).toBeInstanceOf(MissingContentPieceError)
            expect((error as MissingContentPieceError).pieceKind).toBe(
                'majorArc'
            )
        }
    })

    it("throws a structured, named error when the card's own piece is missing", () => {
        const collections = buildFullCollections()
        collections.cards = collections.cards.filter(
            (entry) => entry.id !== 'the-fool'
        )
        const card = getCard('the-fool')!

        try {
            composeCard(card, collections)
            expect.fail('composeCard should have thrown')
        } catch (error) {
            expect(error).toBeInstanceOf(MissingContentPieceError)
            expect((error as MissingContentPieceError).pieceKind).toBe('card')
        }
    })
})

describe('composeCard: status is the weakest constituent status', () => {
    it('reports draft when the own piece is edited but the shared suit piece is still draft', () => {
        const collections = buildFullCollections()
        collections.suits = collections.suits.map((entry) =>
            entry.data.suit === 'wands'
                ? { ...entry, data: { ...entry.data, status: 'draft' } }
                : entry
        )

        const payload = composeCard(getCard('five-of-wands')!, collections)
        expect(payload.status).toBe('draft')
    })

    it('reports draft when the shared number piece is draft even though everything else is edited', () => {
        const collections = buildFullCollections()
        collections.numbers = collections.numbers.map((entry) =>
            entry.data.rank === 'five'
                ? { ...entry, data: { ...entry.data, status: 'draft' } }
                : entry
        )

        const payload = composeCard(getCard('five-of-wands')!, collections)
        expect(payload.status).toBe('draft')
    })

    it('reports draft when only the own piece is draft', () => {
        const collections = buildFullCollections()
        collections.cards = collections.cards.map((entry) =>
            entry.id === 'five-of-wands'
                ? { ...entry, data: { ...entry.data, status: 'draft' } }
                : entry
        )

        const payload = composeCard(getCard('five-of-wands')!, collections)
        expect(payload.status).toBe('draft')
    })

    it('reports edited only when every constituent piece is edited', () => {
        const collections = buildFullCollections()
        const payload = composeCard(getCard('five-of-wands')!, collections)
        expect(payload.status).toBe('edited')
    })
})

describe('composeCard: no reversed-card meaning', () => {
    it('never includes a reversed field, or any text mentioning reversal, anywhere in the payload for any card', () => {
        const collections = buildFullCollections()

        fc.assert(
            fc.property(fc.constantFrom(...DECK), (card) => {
                const payload = composeCard(card, collections)
                expect(mentionsReversed(payload)).toBe(false)
            })
        )
    })

    it('is a pure function of the card and collections: composing the same card twice yields the same payload', () => {
        const collections = buildFullCollections()
        const card = getCard('five-of-wands')!

        const first = composeCard(card, collections)
        const second = composeCard(card, collections)
        expect(second).toEqual(first)
    })
})
