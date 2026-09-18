/**
 * Spread geometry: pure data plus pure functions describing where each
 * spread's positions sit on an abstract grid.
 *
 * Content prose for each position (its label's meaning, the spread's
 * summary, its variant note) lives in the `spreads` content collection and
 * is deliberately NOT reproduced here. This module carries only the
 * geometry -- id, card count, and each position's label plus x/y -- the
 * minimum needed to lay a spread out and to keep that layout from drifting
 * away from the coordinates the content collection itself declares.
 *
 * Pure and filesystem-free on purpose, mirroring `src/lib/content/compose.ts`:
 * no `astro:content` import, no rendering concerns, coordinates are abstract
 * grid units rather than pixels.
 *
 * TYPED STUB for the RED phase of TDD: every signature below is the real,
 * final shape. The exported list is empty and every function throws until
 * the implementation phase fills it in.
 */

/** The three spreads the learning ladder currently covers. */
export type SpreadId =
    'single-card' | 'past-present-direction' | 'five-card-cross'

/** One position's label plus its coordinates on the abstract grid. */
export interface SpreadPositionGeometry {
    label: string
    x: number
    y: number
}

/** A spread's full geometry: its positions plus the card count they draw. */
export interface SpreadGeometry {
    id: SpreadId
    cardCount: number
    positions: SpreadPositionGeometry[]
}

/** All spreads' geometry. */
export const SPREADS: readonly SpreadGeometry[] = Object.freeze([
    {
        id: 'single-card',
        cardCount: 1,
        positions: [{ label: 'The Draw', x: 0, y: 0 }],
    },
    {
        id: 'past-present-direction',
        cardCount: 3,
        positions: [
            { label: 'Past', x: 0, y: 0 },
            { label: 'Present', x: 1, y: 0 },
            { label: 'Direction', x: 2, y: 0 },
        ],
    },
    {
        id: 'five-card-cross',
        cardCount: 5,
        positions: [
            { label: 'Present', x: 1, y: 1 },
            { label: 'Crowning Influence', x: 1, y: 0 },
            { label: 'Foundation', x: 1, y: 2 },
            { label: 'Past', x: 0, y: 1 },
            { label: 'Emerging', x: 2, y: 1 },
        ],
    },
])

/** Looks up one spread's geometry by id. Throws if the id is unknown. */
export function getSpread(id: SpreadId): SpreadGeometry {
    const spread = SPREADS.find((candidate) => candidate.id === id)
    if (!spread) {
        throw new Error(`unknown spread id: ${id}`)
    }
    return spread
}
