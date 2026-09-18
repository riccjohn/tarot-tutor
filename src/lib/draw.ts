/**
 * Card selection.
 *
 * The daily draw is locked to the date: the same day yields the same cards in
 * the same orientations, no matter how many times the page is reloaded or the
 * browser restarted. That is the point — sitting with an uncomfortable card is
 * the practice, and a reroll button would quietly destroy it.
 *
 * The free-shuffle path exists for the self-directed reading page, where
 * unlimited pulls are the correct behaviour.
 */

import { DECK, type Card } from './deck'

export interface Draw {
    card: Card
    reversed: boolean
}

/** A deterministic PRNG. Small, fast, and good enough for shuffling a deck. */
export function mulberry32(seed: number): () => number {
    let a = seed >>> 0
    return function next() {
        a = (a + 0x6d2b79f5) >>> 0
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

/** FNV-1a. Turns a seed string into a 32-bit integer. */
export function hashSeed(value: string): number {
    let hash = 0x811c9dc5
    for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i)
        hash = Math.imul(hash, 0x01000193)
    }
    return hash >>> 0
}

/**
 * The calendar day in the viewer's own timezone, as `YYYY-MM-DD`.
 *
 * Deliberately local rather than UTC: a UTC key would roll the daily card over
 * at some arbitrary hour of the user's evening or morning.
 */
export function localDateKey(date: Date = new Date()): string {
    const year = String(date.getFullYear()).padStart(4, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

/** Fisher-Yates, driven by a supplied RNG so the caller controls determinism. */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
    const result = [...items]
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
        ;[result[i], result[j]] = [result[j]!, result[i]!]
    }
    return result
}

function take(count: number, rng: () => number): Draw[] {
    if (count < 1 || count > DECK.length) {
        throw new RangeError(
            `Cannot draw ${count} cards from a ${DECK.length}-card deck`
        )
    }
    const shuffled = shuffle(DECK, rng)
    return shuffled.slice(0, count).map((card: Card) => ({
        card,
        reversed: rng() < 0.5,
    }))
}

/**
 * The locked draw for a given day and spread.
 *
 * `spreadId` is folded into the seed so that two different spreads on the same
 * date produce different cards, while each stays stable on its own.
 */
export function drawForDate(
    spreadId: string,
    count: number,
    dateKey: string = localDateKey()
): Draw[] {
    return take(count, mulberry32(hashSeed(`${dateKey}:${spreadId}`)))
}

/** An unseeded draw, for the self-directed reading page. */
export function drawFreely(count: number): Draw[] {
    return take(count, Math.random)
}
