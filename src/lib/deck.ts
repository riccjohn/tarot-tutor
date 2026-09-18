/**
 * The 78-card deck, generated from structure rather than enumerated by hand.
 *
 * Suit, rank and number are derived properties. This is deliberate: the site
 * teaches that a card's meaning composes from its suit and its number, so the
 * data model mirrors the pedagogy. Five of Cups is not a bespoke entry — it is
 * the intersection of `cups` and `five`.
 *
 * Note what is NOT here: elemental correspondences. The Wands/Swords fire-air
 * assignment is genuinely contested between traditions, so it lives in editable
 * content rather than being hardcoded as though it were settled fact.
 */

export const SUITS = ['wands', 'cups', 'swords', 'pentacles'] as const
export type Suit = (typeof SUITS)[number]

export const PIP_RANKS = [
    'ace',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
] as const
export type PipRank = (typeof PIP_RANKS)[number]

export const COURT_RANKS = ['page', 'knight', 'queen', 'king'] as const
export type CourtRank = (typeof COURT_RANKS)[number]

/**
 * Waite's ordering, in which Strength is VIII and Justice is XI — swapped from
 * the older Marseille sequence. The swap is itself teachable material.
 */
export const MAJOR_NAMES = [
    'The Fool',
    'The Magician',
    'The High Priestess',
    'The Empress',
    'The Emperor',
    'The Hierophant',
    'The Lovers',
    'The Chariot',
    'Strength',
    'The Hermit',
    'Wheel of Fortune',
    'Justice',
    'The Hanged Man',
    'Death',
    'Temperance',
    'The Devil',
    'The Tower',
    'The Star',
    'The Moon',
    'The Sun',
    'Judgement',
    'The World',
] as const

interface CardBase {
    /** URL-safe, stable identifier. Doubles as the content filename and image basename. */
    id: string
    name: string
}

export interface MajorCard extends CardBase {
    kind: 'major'
    /** 0 (The Fool) through 21 (The World). */
    number: number
}

export interface PipCard extends CardBase {
    kind: 'pip'
    suit: Suit
    rank: PipRank
    /** 1 (ace) through 10. */
    number: number
}

export interface CourtCard extends CardBase {
    kind: 'court'
    suit: Suit
    rank: CourtRank
}

export type Card = MajorCard | PipCard | CourtCard

export function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
}

function titleCase(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1)
}

function buildMajors(): MajorCard[] {
    return MAJOR_NAMES.map((name, number) => ({
        kind: 'major',
        id: slugify(name),
        name,
        number,
    }))
}

function buildPips(): PipCard[] {
    return SUITS.flatMap((suit) =>
        PIP_RANKS.map((rank, index) => {
            const name = `${titleCase(rank)} of ${titleCase(suit)}`
            return {
                kind: 'pip' as const,
                id: slugify(name),
                name,
                suit,
                rank,
                number: index + 1,
            }
        })
    )
}

function buildCourts(): CourtCard[] {
    return SUITS.flatMap((suit) =>
        COURT_RANKS.map((rank) => {
            const name = `${titleCase(rank)} of ${titleCase(suit)}`
            return {
                kind: 'court' as const,
                id: slugify(name),
                name,
                suit,
                rank,
            }
        })
    )
}

/** All 78 cards: 22 majors, then 40 pips, then 16 courts. */
export const DECK: readonly Card[] = Object.freeze([
    ...buildMajors(),
    ...buildPips(),
    ...buildCourts(),
])

const DECK_BY_ID = new Map(DECK.map((card) => [card.id, card]))

export function getCard(id: string): Card | undefined {
    return DECK_BY_ID.get(id)
}

export function isMajor(card: Card): card is MajorCard {
    return card.kind === 'major'
}

export function isMinor(card: Card): card is PipCard | CourtCard {
    return card.kind !== 'major'
}

/** The suit a card belongs to, or undefined for majors. */
export function suitOf(card: Card): Suit | undefined {
    return isMinor(card) ? card.suit : undefined
}

/**
 * The shared content pieces a card composes from. A card page renders these
 * alongside its own three per-card pieces.
 */
export function sharedContentKeys(card: Card): {
    suit?: Suit
    number?: PipRank
    rank?: CourtRank
    majorArc?: string
} {
    switch (card.kind) {
        case 'major':
            return { majorArc: card.id }
        case 'pip':
            return { suit: card.suit, number: card.rank }
        case 'court':
            return { suit: card.suit, rank: card.rank }
    }
}
