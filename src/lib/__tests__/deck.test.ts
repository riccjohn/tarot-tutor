import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
    COURT_RANKS,
    DECK,
    getCard,
    isMajor,
    PIP_RANKS,
    sharedContentKeys,
    slugify,
    SUITS,
    type Card,
} from '../deck'

describe('DECK', () => {
    it('contains exactly 78 cards', () => {
        expect(DECK).toHaveLength(78)
    })

    it('splits into 22 majors, 40 pips and 16 courts', () => {
        const counts = DECK.reduce<Record<string, number>>((acc, card) => {
            acc[card.kind] = (acc[card.kind] ?? 0) + 1
            return acc
        }, {})
        expect(counts).toEqual({ major: 22, pip: 40, court: 16 })
    })

    it('gives every card a unique id', () => {
        const ids = new Set(DECK.map((card) => card.id))
        expect(ids.size).toBe(78)
    })

    it('numbers the majors 0 through 21 with Waite ordering', () => {
        const majors = DECK.filter(isMajor)
        expect(majors.map((card) => card.number)).toEqual(
            Array.from({ length: 22 }, (_, i) => i)
        )
        // Waite swapped these two relative to the older Marseille sequence.
        expect(majors[8]!.name).toBe('Strength')
        expect(majors[11]!.name).toBe('Justice')
    })

    it('covers every suit and rank combination exactly once', () => {
        for (const suit of SUITS) {
            for (const rank of [...PIP_RANKS, ...COURT_RANKS]) {
                const matches = DECK.filter(
                    (card) =>
                        'suit' in card &&
                        card.suit === suit &&
                        card.rank === rank
                )
                expect(matches).toHaveLength(1)
            }
        }
    })

    it('numbers pips 1 through 10 within each suit', () => {
        for (const suit of SUITS) {
            const pips = DECK.filter(
                (card) => card.kind === 'pip' && card.suit === suit
            )
            expect(
                pips.map((card) => (card as { number: number }).number)
            ).toEqual(Array.from({ length: 10 }, (_, i) => i + 1))
        }
    })
})

describe('getCard', () => {
    it('finds a card by id', () => {
        expect(getCard('five-of-cups')?.name).toBe('Five of Cups')
        expect(getCard('the-fool')?.name).toBe('The Fool')
        expect(getCard('wheel-of-fortune')?.name).toBe('Wheel of Fortune')
    })

    it('returns undefined for an unknown id', () => {
        expect(getCard('the-nonexistent')).toBeUndefined()
    })
})

describe('slugify', () => {
    it('produces url-safe ids', () => {
        expect(slugify('The High Priestess')).toBe('the-high-priestess')
        expect(slugify('Ace of Pentacles')).toBe('ace-of-pentacles')
    })
})

describe('sharedContentKeys', () => {
    it('composes a pip from its suit and number', () => {
        expect(sharedContentKeys(getCard('five-of-cups')!)).toEqual({
            suit: 'cups',
            number: 'five',
        })
    })

    it('composes a court card from its suit and rank', () => {
        expect(sharedContentKeys(getCard('king-of-wands')!)).toEqual({
            suit: 'wands',
            rank: 'king',
        })
    })

    it('points a major at its arc note', () => {
        expect(sharedContentKeys(getCard('the-tower')!)).toEqual({
            majorArc: 'the-tower',
        })
    })
})

/**
 * Property-based hardening.
 *
 * The example tests above pin specific cards; these properties sweep every
 * card the deck actually contains, generated rather than hand-picked, so a
 * regression confined to a single suit or rank cannot slip past a lucky
 * choice of fixture.
 */
describe('DECK (property-based)', () => {
    it('gives no two distinct positions the same id, for any pair of positions', () => {
        fc.assert(
            fc.property(
                fc.nat({ max: DECK.length - 1 }),
                fc.nat({ max: DECK.length - 1 }),
                (i, j) => {
                    if (i !== j) {
                        expect(DECK[i]!.id).not.toBe(DECK[j]!.id)
                    }
                }
            )
        )
    })

    it('partitions into exactly 22 majors, 40 pips and 16 courts', () => {
        fc.assert(
            fc.property(fc.constant(null), () => {
                const counts = DECK.reduce<Record<Card['kind'], number>>(
                    (acc, card) => {
                        acc[card.kind] = (acc[card.kind] ?? 0) + 1
                        return acc
                    },
                    { major: 0, pip: 0, court: 0 }
                )
                expect(counts).toEqual({ major: 22, pip: 40, court: 16 })
            })
        )
    })
})

describe('sharedContentKeys (property-based)', () => {
    const pipCards = DECK.filter(
        (card): card is Extract<Card, { kind: 'pip' }> => card.kind === 'pip'
    )
    const courtCards = DECK.filter(
        (card): card is Extract<Card, { kind: 'court' }> =>
            card.kind === 'court'
    )
    const majorCards = DECK.filter(isMajor)

    it('resolves suit + number for every pip, and only suit + number', () => {
        fc.assert(
            fc.property(fc.constantFrom(...pipCards), (card) => {
                const keys = sharedContentKeys(card)
                expect(keys.suit).toBe(card.suit)
                expect(keys.number).toBe(card.rank)
                expect(keys.rank).toBeUndefined()
                expect(keys.majorArc).toBeUndefined()
            })
        )
    })

    it('resolves suit + rank for every court card, and only suit + rank', () => {
        fc.assert(
            fc.property(fc.constantFrom(...courtCards), (card) => {
                const keys = sharedContentKeys(card)
                expect(keys.suit).toBe(card.suit)
                expect(keys.rank).toBe(card.rank)
                expect(keys.number).toBeUndefined()
                expect(keys.majorArc).toBeUndefined()
            })
        )
    })

    it('resolves an arc key for every major, and neither suit nor number', () => {
        fc.assert(
            fc.property(fc.constantFrom(...majorCards), (card) => {
                const keys = sharedContentKeys(card)
                expect(keys.majorArc).toBe(card.id)
                expect(keys.suit).toBeUndefined()
                expect(keys.number).toBeUndefined()
                expect(keys.rank).toBeUndefined()
            })
        )
    })
})
