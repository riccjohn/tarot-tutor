/**
 * Assembles a card's complete teaching payload from its own three pieces plus
 * the shared suit/number/rank/arc pieces the pedagogy reuses across the deck.
 *
 * 78 cards, but only 40 shared pieces to write and edit: 4 suit essays, 10
 * number essays, 4 court-rank essays, and 22 major-arc notes. This function
 * is the one place that stitches a card's own content back together with
 * whichever of those it depends on.
 *
 * Pure and filesystem-free on purpose: it takes plain collection entries as
 * arguments rather than reading `astro:content` itself, so it can compose
 * against in-memory fixtures before any real content file exists, and be
 * exercised in a plain Vitest/Node environment.
 *
 * TYPED STUB for the RED phase of TDD: every signature below is the real,
 * final shape. Every body throws until the implementation phase fills it in.
 */

import {
    sharedContentKeys,
    type Card,
    type CourtRank,
    type PipRank,
    type Suit,
} from '../deck'

/** Content is drafted first and edited afterwards; every piece tracks which. */
export type PieceStatus = 'draft' | 'review' | 'edited'

/**
 * A minimal stand-in for an Astro content collection entry: an id plus its
 * parsed frontmatter. Deliberately generic rather than importing
 * `CollectionEntry` from `astro:content`, since this module must not depend
 * on Astro's content layer at all.
 */
export interface ContentEntry<T> {
    id: string
    data: T
}

/** The 78 per-card pieces, mirroring the `cards` collection schema. */
export interface CardPieceData {
    name: string
    symbols: { element: string; note: string }[]
    commonReading: string
    invitationPrompt: string
    status: PieceStatus
}

/** One of the four suit essays, mirroring the `suits` collection schema. */
export interface SuitPieceData {
    suit: Suit
    name: string
    domain: string
    conventionalElement: string
    contested?: string
    status: PieceStatus
}

/** One of the ten number essays, mirroring the `numbers` collection schema. */
export interface NumberPieceData {
    rank: PipRank
    numeral: number
    stage: string
    status: PieceStatus
}

/** One of the four court-rank essays, mirroring the `ranks` collection schema. */
export interface RankPieceData {
    rank: CourtRank
    name: string
    ladderPosition: string
    status: PieceStatus
}

/** One of the 22 major-arc notes, mirroring the `majorsArc` collection schema. */
export interface MajorArcPieceData {
    cardId: string
    number: number
    septenary: 0 | 1 | 2 | 3
    status: PieceStatus
}

/**
 * The full set of source collections `composeCard` draws from. Plain arrays
 * of entries rather than an `astro:content` handle, so callers can pass
 * fixtures, a real content-collection read, or anything else shaped like
 * this.
 */
export interface ContentCollections {
    cards: ContentEntry<CardPieceData>[]
    suits: ContentEntry<SuitPieceData>[]
    numbers: ContentEntry<NumberPieceData>[]
    ranks: ContentEntry<RankPieceData>[]
    majorsArc: ContentEntry<MajorArcPieceData>[]
}

/** Which kind of piece was missing when composition failed. */
export type MissingPieceKind = 'card' | 'suit' | 'number' | 'rank' | 'majorArc'

/**
 * A named, structured failure raised when a card's composition can't find
 * one of the pieces it requires. Callers can branch on `pieceKind` and
 * `pieceKey` rather than parsing a message string, and no partial payload is
 * ever returned in its place.
 */
export class MissingContentPieceError extends Error {
    readonly cardId: string
    readonly pieceKind: MissingPieceKind
    readonly pieceKey: string

    constructor(cardId: string, pieceKind: MissingPieceKind, pieceKey: string) {
        super(
            `Missing ${pieceKind} content piece "${pieceKey}" required to compose card "${cardId}"`
        )
        this.name = 'MissingContentPieceError'
        this.cardId = cardId
        this.pieceKind = pieceKind
        this.pieceKey = pieceKey
    }
}

/**
 * A card's assembled teaching payload: its own piece plus whichever shared
 * pieces its kind depends on. Pips get `suit` + `number`, courts get `suit` +
 * `rank`, majors get `majorArc` alone. There is deliberately no field here
 * for a reversed reading — reversal is carried elsewhere as a boolean flag,
 * never as per-card text baked into this payload.
 */
export interface ComposedCard {
    card: Card
    own: CardPieceData
    suit?: SuitPieceData
    number?: NumberPieceData
    rank?: RankPieceData
    majorArc?: MajorArcPieceData
    /** The weakest status among this payload's constituent pieces. */
    status: PieceStatus
}

/**
 * Composes one card's full teaching payload out of the supplied collections.
 *
 * Throws `MissingContentPieceError` — never returns a partial payload — when
 * the card's own piece, or the shared piece its kind depends on, isn't
 * present in `collections`.
 */
function weakest(statuses: PieceStatus[]): PieceStatus {
    if (statuses.includes('draft')) return 'draft'
    return statuses.includes('review') ? 'review' : 'edited'
}

export function composeCard(
    card: Card,
    collections: ContentCollections
): ComposedCard {
    const own = collections.cards.find((entry) => entry.id === card.id)?.data
    if (!own) {
        throw new MissingContentPieceError(card.id, 'card', card.id)
    }

    const keys = sharedContentKeys(card)
    const statuses: PieceStatus[] = [own.status]

    let suit: SuitPieceData | undefined
    if (keys.suit) {
        suit = collections.suits.find(
            (entry) => entry.data.suit === keys.suit
        )?.data
        if (!suit) {
            throw new MissingContentPieceError(card.id, 'suit', keys.suit)
        }
        statuses.push(suit.status)
    }

    let number: NumberPieceData | undefined
    if (keys.number) {
        number = collections.numbers.find(
            (entry) => entry.data.rank === keys.number
        )?.data
        if (!number) {
            throw new MissingContentPieceError(card.id, 'number', keys.number)
        }
        statuses.push(number.status)
    }

    let rank: RankPieceData | undefined
    if (keys.rank) {
        rank = collections.ranks.find(
            (entry) => entry.data.rank === keys.rank
        )?.data
        if (!rank) {
            throw new MissingContentPieceError(card.id, 'rank', keys.rank)
        }
        statuses.push(rank.status)
    }

    let majorArc: MajorArcPieceData | undefined
    if (keys.majorArc) {
        majorArc = collections.majorsArc.find(
            (entry) => entry.data.cardId === keys.majorArc
        )?.data
        if (!majorArc) {
            throw new MissingContentPieceError(
                card.id,
                'majorArc',
                keys.majorArc
            )
        }
        statuses.push(majorArc.status)
    }

    return {
        card,
        own,
        suit,
        number,
        rank,
        majorArc,
        status: weakest(statuses),
    }
}
