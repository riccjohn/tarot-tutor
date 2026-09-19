import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { DECK, isMajor, SUITS, type Card, type Suit } from '../deck'
import {
    cardEyebrow,
    romanDate,
    suitAccent,
    suitGlyph,
    toRoman,
} from '../ornament'

/**
 * Parses a (well-formed) roman numeral back into an integer. Written here
 * rather than imported so the round-trip property genuinely checks `toRoman`
 * against an independent implementation instead of against itself.
 */
function parseRoman(value: string): number {
    const digits: Record<string, number> = {
        I: 1,
        V: 5,
        X: 10,
        L: 50,
        C: 100,
        D: 500,
        M: 1000,
    }
    let total = 0
    for (let i = 0; i < value.length; i++) {
        const current = digits[value[i]!]
        const next = digits[value[i + 1]!]
        if (current === undefined) {
            throw new Error(`not a roman digit: ${value[i]}`)
        }
        if (next !== undefined && current < next) {
            total -= current
        } else {
            total += current
        }
    }
    return total
}

/** Canonical roman numerals 1-3999: exactly the subtractive-notation form. */
const CANONICAL_ROMAN =
    /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1)
}

describe('toRoman', () => {
    it('uses only IVXLCDM and round-trips for every integer 1..3999', () => {
        fc.assert(
            fc.property(fc.integer({ min: 1, max: 3999 }), (n) => {
                const roman = toRoman(n)
                expect(roman).toMatch(/^[IVXLCDM]+$/)
                expect(parseRoman(roman)).toBe(n)
            })
        )
    })

    it('is strictly canonical: no run of four repeats, only the six valid subtractive pairs', () => {
        fc.assert(
            fc.property(fc.integer({ min: 1, max: 3999 }), (n) => {
                const roman = toRoman(n)
                expect(roman).not.toMatch(/(.)\1{3}/)
                expect(roman).toMatch(CANONICAL_ROMAN)
            })
        )
    })

    it('matches known anchors', () => {
        expect(toRoman(1)).toBe('I')
        expect(toRoman(4)).toBe('IV')
        expect(toRoman(13)).toBe('XIII')
        expect(toRoman(21)).toBe('XXI')
        expect(toRoman(2026)).toBe('MMXXVI')
    })

    it("returns the Fool's folio for zero", () => {
        expect(toRoman(0)).toBe('0')
    })

    it('throws for negative integers', () => {
        fc.assert(
            fc.property(fc.integer({ min: -9999, max: -1 }), (n) => {
                expect(() => toRoman(n)).toThrow()
            })
        )
    })

    it('throws for non-integers', () => {
        fc.assert(
            fc.property(
                fc
                    .double({ min: -1000, max: 1000, noNaN: true })
                    .filter((n) => !Number.isInteger(n)),
                (n) => {
                    expect(() => toRoman(n)).toThrow()
                }
            )
        )
    })

    it('throws above 3999', () => {
        fc.assert(
            fc.property(fc.integer({ min: 4000, max: 100000 }), (n) => {
                expect(() => toRoman(n)).toThrow()
            })
        )
    })
})

describe('romanDate', () => {
    it('formats any YYYY-MM-DD as "<day> · <month> · <year>" with no ascii digits', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 9999 }),
                fc.integer({ min: 0, max: 11 }),
                fc.integer({ min: 1, max: 28 }),
                (year, monthIndex, day) => {
                    const yyyy = String(year).padStart(4, '0')
                    const mm = String(monthIndex + 1).padStart(2, '0')
                    const dd = String(day).padStart(2, '0')
                    const dateKey = `${yyyy}-${mm}-${dd}`

                    const result = romanDate(dateKey)

                    expect(result).toMatch(
                        /^[IVXLCDM]+ · [IVXLCDM]+ · [IVXLCDM]+$/
                    )
                    expect(result).not.toMatch(/[0-9]/)
                    expect(result).not.toMatch(/\d{4}-\d{2}-\d{2}/)
                }
            )
        )
    })
})

describe('cardEyebrow', () => {
    it('reads "Major Arcana · <roman number>" for every major, with The Fool as 0', () => {
        const majors = DECK.filter(isMajor)
        for (const card of majors) {
            expect(cardEyebrow(card)).toBe(
                `Major Arcana · ${toRoman(card.number)}`
            )
        }
        const fool = majors.find((card) => card.name === 'The Fool')!
        expect(cardEyebrow(fool)).toBe('Major Arcana · 0')
    })

    it('reads "<Suit name> · <Rank name>" for every pip and court card', () => {
        const minors = DECK.filter(
            (card): card is Extract<Card, { kind: 'pip' | 'court' }> =>
                card.kind === 'pip' || card.kind === 'court'
        )
        for (const card of minors) {
            expect(cardEyebrow(card)).toBe(
                `${capitalize(card.suit)} · ${capitalize(card.rank)}`
            )
        }
    })

    it('is total and never empty over every one of the 78 deck cards', () => {
        fc.assert(
            fc.property(fc.constantFrom(...DECK), (card) => {
                const eyebrow = cardEyebrow(card)
                expect(typeof eyebrow).toBe('string')
                expect(eyebrow.length).toBeGreaterThan(0)
            })
        )
    })
})

describe('suitGlyph and suitAccent', () => {
    const suitKeys: readonly (Suit | 'major')[] = [...SUITS, 'major']

    it('define a non-empty glyph string for every suit plus major', () => {
        for (const key of suitKeys) {
            const glyph = suitGlyph(key)
            expect(typeof glyph).toBe('string')
            expect(glyph.length).toBeGreaterThan(0)
        }
    })

    it('define a CSS custom-property name (not a raw colour) for every suit plus major', () => {
        for (const key of suitKeys) {
            const accent = suitAccent(key)
            expect(accent).toMatch(/^--[a-z-]+$/)
            expect(accent).toBe(`--color-suit-${key}`)
            // Not a raw colour value in any common form.
            expect(accent).not.toMatch(/^#/)
            expect(accent).not.toMatch(/^oklch\(/)
            expect(accent).not.toMatch(/^rgb/)
        }
    })

    it('gives distinct custom-property names across all suits plus major', () => {
        const accents = suitKeys.map((key) => suitAccent(key))
        expect(new Set(accents).size).toBe(suitKeys.length)
    })
})
