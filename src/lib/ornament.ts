/**
 * Pure formatting helpers for the ornamental details that dress up every
 * card and page: roman numerals, inscriptional dates, eyebrows and the
 * per-suit glyph/accent lookup. No DOM, no Astro — just strings in, strings
 * out, so every page renders these identically.
 */

import { isMajor, type Card, type Suit } from './deck'

const ROMAN_NUMERALS: readonly [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
]

function romanize(value: number): string {
    let remaining = value
    let result = ''
    for (const [amount, numeral] of ROMAN_NUMERALS) {
        while (remaining >= amount) {
            result += numeral
            remaining -= amount
        }
    }
    return result
}

/**
 * Converts an integer 0-3999 to a canonical roman numeral. Zero is a special
 * case for The Fool, whose folio is "0" rather than a roman numeral.
 */
export function toRoman(value: number): string {
    if (!Number.isInteger(value)) {
        throw new Error(`toRoman: not an integer: ${value}`)
    }
    if (value === 0) {
        return '0'
    }
    if (value < 0 || value > 3999) {
        throw new Error(`toRoman: out of range (0-3999): ${value}`)
    }
    return romanize(value)
}

/** Formats a "YYYY-MM-DD" date key as "<day> · <month> · <year>" in roman numerals. */
export function romanDate(dateKey: string): string {
    const [year, month, day] = dateKey.split('-').map(Number)
    return `${romanize(day!)} · ${romanize(month!)} · ${romanize(year!)}`
}

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1)
}

/** The eyebrow label above a card's name: its arcana/number, or its suit/rank. */
export function cardEyebrow(card: Card): string {
    if (isMajor(card)) {
        return `Major Arcana · ${toRoman(card.number)}`
    }
    return `${capitalize(card.suit)} · ${capitalize(card.rank)}`
}

const SUIT_GLYPHS: Record<Suit | 'major', string> = {
    wands: '🜂',
    cups: '🜄',
    swords: '🜁',
    pentacles: '🜃',
    major: '☉',
}

/** Plain-string glyph for a suit (or the major arcana). SVG sigils live elsewhere. */
export function suitGlyph(key: Suit | 'major'): string {
    return SUIT_GLYPHS[key]
}

/** The CSS custom-property name holding a suit's (or major's) accent colour. */
export function suitAccent(key: Suit | 'major'): string {
    return `--color-suit-${key}`
}
