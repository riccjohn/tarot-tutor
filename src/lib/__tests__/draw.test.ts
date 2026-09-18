import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { DECK } from '../deck'
import {
    drawForDate,
    drawFreely,
    hashSeed,
    localDateKey,
    mulberry32,
    shuffle,
} from '../draw'

describe('drawForDate', () => {
    it('returns the same cards and orientations for the same date', () => {
        const first = drawForDate('daily', 1, '2026-09-17')
        const second = drawForDate('daily', 1, '2026-09-17')
        expect(second).toEqual(first)
    })

    it('stays stable across many repeat calls', () => {
        const expected = drawForDate('celtic-cross', 10, '2026-09-17')
        for (let i = 0; i < 50; i++) {
            expect(drawForDate('celtic-cross', 10, '2026-09-17')).toEqual(
                expected
            )
        }
    })

    it('differs across dates', () => {
        const today = drawForDate('daily', 1, '2026-09-17')
        const tomorrow = drawForDate('daily', 1, '2026-09-18')
        expect(tomorrow[0]!.card.id).not.toBe(today[0]!.card.id)
    })

    it('differs across spreads on the same date', () => {
        const daily = drawForDate('daily', 1, '2026-09-17')
        const advice = drawForDate('energy-advice', 1, '2026-09-17')
        expect(advice[0]!.card.id).not.toBe(daily[0]!.card.id)
    })

    it('draws without replacement', () => {
        const drawn = drawForDate('celtic-cross', 10, '2026-09-17')
        const ids = new Set(drawn.map((d) => d.card.id))
        expect(ids.size).toBe(10)
    })

    it('rejects impossible draw sizes', () => {
        expect(() => drawForDate('daily', 0)).toThrow(RangeError)
        expect(() => drawForDate('daily', 79)).toThrow(RangeError)
    })

    it('can draw the entire deck', () => {
        const drawn = drawForDate('study', 78, '2026-09-17')
        expect(new Set(drawn.map((d) => d.card.id)).size).toBe(78)
    })

    it('produces both orientations across a large draw', () => {
        const drawn = drawForDate('study', 78, '2026-09-17')
        const reversed = drawn.filter((d) => d.reversed).length
        expect(reversed).toBeGreaterThan(0)
        expect(reversed).toBeLessThan(78)
    })
})

describe('drawFreely', () => {
    it('draws the requested number without replacement', () => {
        const drawn = drawFreely(10)
        expect(new Set(drawn.map((d) => d.card.id)).size).toBe(10)
    })
})

describe('localDateKey', () => {
    it('formats as YYYY-MM-DD in local time', () => {
        // Constructed with local-time components, so this is timezone-stable.
        expect(localDateKey(new Date(2026, 8, 17))).toBe('2026-09-17')
        expect(localDateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
    })
})

describe('shuffle', () => {
    it('preserves every element', () => {
        const shuffled = shuffle(DECK, mulberry32(hashSeed('seed')))
        expect(shuffled).toHaveLength(78)
        expect(new Set(shuffled.map((c) => c.id)).size).toBe(78)
    })

    it('does not mutate the input', () => {
        const before = DECK.map((c) => c.id)
        shuffle(DECK, mulberry32(1))
        expect(DECK.map((c) => c.id)).toEqual(before)
    })
})

describe('mulberry32', () => {
    it('is deterministic for a given seed', () => {
        const a = mulberry32(42)
        const b = mulberry32(42)
        expect([a(), a(), a()]).toEqual([b(), b(), b()])
    })

    it('stays within [0, 1)', () => {
        const rng = mulberry32(hashSeed('range check'))
        for (let i = 0; i < 1000; i++) {
            const value = rng()
            expect(value).toBeGreaterThanOrEqual(0)
            expect(value).toBeLessThan(1)
        }
    })
})

/**
 * Property-based hardening.
 *
 * The example tests above lock in behaviour for one hand-picked date
 * ('2026-09-17') and a handful of hand-picked spread ids. Determinism is the
 * actual product requirement here (sitting with a card is the point; a
 * reroll would defeat it), so these properties sweep arbitrary date keys,
 * spread ids, seeds and draw counts rather than trusting that the one
 * fixture generalises.
 */
describe('drawForDate (property-based)', () => {
    it('reproduces identical cards and orientations for the same date, spread and count', () => {
        fc.assert(
            fc.property(
                fc.string(),
                fc.string(),
                fc.integer({ min: 1, max: DECK.length }),
                (dateKey, spreadId, count) => {
                    const first = drawForDate(spreadId, count, dateKey)
                    const second = drawForDate(spreadId, count, dateKey)
                    expect(second).toEqual(first)
                }
            )
        )
    })

    it('draws a different sequence of cards for two different spread ids on the same date', () => {
        fc.assert(
            fc.property(
                fc.string(),
                fc.tuple(fc.string(), fc.string()).filter(([a, b]) => a !== b),
                fc.integer({ min: 2, max: DECK.length }),
                (dateKey, [spreadA, spreadB], count) => {
                    const drawA = drawForDate(spreadA, count, dateKey)
                    const drawB = drawForDate(spreadB, count, dateKey)
                    expect(drawA.map((d) => d.card.id)).not.toEqual(
                        drawB.map((d) => d.card.id)
                    )
                }
            )
        )
    })

    it('draws a different sequence of cards for two different dates on the same spread', () => {
        fc.assert(
            fc.property(
                fc.string(),
                fc.tuple(fc.string(), fc.string()).filter(([a, b]) => a !== b),
                fc.integer({ min: 2, max: DECK.length }),
                (spreadId, [dateA, dateB], count) => {
                    const drawA = drawForDate(spreadId, count, dateA)
                    const drawB = drawForDate(spreadId, count, dateB)
                    expect(drawA.map((d) => d.card.id)).not.toEqual(
                        drawB.map((d) => d.card.id)
                    )
                }
            )
        )
    })

    it('never repeats a card within a draw, for every draw size from 1 to 78', () => {
        fc.assert(
            fc.property(
                fc.string(),
                fc.string(),
                fc.integer({ min: 1, max: DECK.length }),
                (dateKey, spreadId, count) => {
                    const drawn = drawForDate(spreadId, count, dateKey)
                    expect(drawn).toHaveLength(count)
                    expect(new Set(drawn.map((d) => d.card.id)).size).toBe(
                        count
                    )
                }
            )
        )
    })

    it('raises a RangeError for any count outside 1..78', () => {
        fc.assert(
            fc.property(
                fc.string(),
                fc.string(),
                fc.oneof(
                    fc.integer({ min: -1000, max: 0 }),
                    fc.integer({
                        min: DECK.length + 1,
                        max: DECK.length + 1000,
                    })
                ),
                (dateKey, spreadId, count) => {
                    expect(() => drawForDate(spreadId, count, dateKey)).toThrow(
                        RangeError
                    )
                }
            )
        )
    })
})

describe('shuffle (property-based)', () => {
    it('is a permutation of its input for any seed: same multiset in, same multiset out', () => {
        fc.assert(
            fc.property(
                fc.array(fc.integer(), { maxLength: 100 }),
                fc.integer(),
                (items, seed) => {
                    const shuffled = shuffle(items, mulberry32(seed))
                    expect(shuffled).toHaveLength(items.length)
                    expect([...shuffled].sort((a, b) => a - b)).toEqual(
                        [...items].sort((a, b) => a - b)
                    )
                }
            )
        )
    })
})

describe('drawFreely (property-based)', () => {
    it('never repeats a card within one draw, for every draw size from 1 to 78', () => {
        fc.assert(
            fc.property(fc.integer({ min: 1, max: DECK.length }), (count) => {
                const drawn = drawFreely(count)
                expect(drawn).toHaveLength(count)
                expect(new Set(drawn.map((d) => d.card.id)).size).toBe(count)
            })
        )
    })

    it('varies across independent calls rather than always landing on the same card', () => {
        const draws = Array.from(
            { length: 50 },
            () => drawFreely(1)[0]!.card.id
        )
        expect(new Set(draws).size).toBeGreaterThan(1)
    })
})

describe('localDateKey (property-based)', () => {
    it('always formats as zero-padded YYYY-MM-DD, for any CE year including years below 1000', () => {
        fc.assert(
            fc.property(
                // CE years only: a local date key is never asked for a BCE
                // date, and signing the year would widen the key format.
                fc.integer({ min: 1, max: 9999 }),
                fc.integer({ min: 0, max: 11 }),
                fc.integer({ min: 1, max: 28 }),
                (year, month, day) => {
                    // setFullYear, unlike the multi-arg Date constructor, has
                    // no legacy two-digit-year special case, so this actually
                    // produces the requested year (including small ones).
                    const date = new Date(0)
                    date.setFullYear(year, month, day)
                    const key = localDateKey(date)
                    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/)
                }
            )
        )
    })
})
