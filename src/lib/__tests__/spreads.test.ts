import fc from 'fast-check'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
    getSpread,
    SPREADS,
    type SpreadGeometry,
    type SpreadId,
} from '../spreads'

/**
 * The three spreads P05 actually wrote content for. Celtic Cross is
 * post-MVP and deliberately not covered here -- see the plan's revised
 * scope note.
 */
const SPREAD_IDS: readonly SpreadId[] = [
    'single-card',
    'past-present-direction',
    'five-card-cross',
]

/**
 * Looks a spread up in `SPREADS` and fails the calling test immediately,
 * with a Vitest AssertionError, if it isn't there yet. Every test below goes
 * through this rather than indexing `SPREADS` directly, so an empty (stub)
 * `SPREADS` array fails loudly instead of letting a loop over "the found
 * spreads" vacuously pass on zero iterations.
 */
function requireSpread(id: SpreadId): SpreadGeometry {
    const spread = SPREADS.find((candidate) => candidate.id === id)
    expect(spread, `expected SPREADS to contain a "${id}" entry`).toBeDefined()
    return spread!
}

function boundingBoxCenter(positions: { x: number; y: number }[]) {
    const xs = positions.map((p) => p.x)
    const ys = positions.map((p) => p.y)
    return {
        x: (Math.min(...xs) + Math.max(...xs)) / 2,
        y: (Math.min(...ys) + Math.max(...ys)) / 2,
    }
}

/**
 * Independent source of truth for the geometry: the actual `.md` content
 * files under `src/content/spreads/`, parsed here with a small
 * hand-written frontmatter reader rather than `astro:content` (this suite
 * runs in a plain Vitest/Node environment, and `src/lib/spreads.ts` must
 * stay free of any Astro content-layer dependency).
 *
 * This is deliberately independent of anything `spreads.ts` exports: it
 * exists so the "geometry matches content" tests below compare two things
 * that were extracted separately, rather than a value against itself.
 */
interface ParsedContentSpread {
    cardCount: number
    positions: { label: string; x: number; y: number }[]
}

function parseSpreadFrontmatter(raw: string): ParsedContentSpread {
    const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---/)
    if (!frontmatterMatch) {
        throw new Error('content fixture has no frontmatter block')
    }
    const frontmatter = frontmatterMatch[1]!

    const cardCountMatch = frontmatter.match(/^cardCount:\s*(\d+)\s*$/m)
    if (!cardCountMatch) {
        throw new Error('content fixture is missing cardCount')
    }

    // Extracted line-by-line rather than with a single regex: a lookahead
    // of the form `(?=\n[a-zA-Z]\S*:|$)` looks tempting, but under the /m
    // flag `$` matches the end of *every* line, so a lazy quantifier stops
    // after the block's very first line instead of at the next top-level
    // key. Scanning explicitly for "the next line that starts a new
    // top-level key" sidesteps that.
    const lines = frontmatter.split('\n')
    const positionsStart = lines.findIndex((line) => line === 'positions:')
    if (positionsStart === -1) {
        throw new Error('content fixture is missing a positions block')
    }
    let positionsEnd = lines.length
    for (let i = positionsStart + 1; i < lines.length; i++) {
        if (/^[a-zA-Z]/.test(lines[i]!)) {
            positionsEnd = i
            break
        }
    }
    const positionsBlock = lines
        .slice(positionsStart + 1, positionsEnd)
        .join('\n')

    const entries = positionsBlock
        .split(/\n(?=    - label:)/)
        .filter((chunk) => chunk.trim().length > 0)

    const positions = entries.map((entry) => {
        const label = entry.match(/^ {4}- label: (.+)$/m)?.[1]
        const x = entry.match(/^ {6}x: (-?\d+)\s*$/m)?.[1]
        const y = entry.match(/^ {6}y: (-?\d+)\s*$/m)?.[1]
        if (label === undefined || x === undefined || y === undefined) {
            throw new Error(
                `could not parse label/x/y out of a position entry: ${entry}`
            )
        }
        return { label, x: Number(x), y: Number(y) }
    })

    return { cardCount: Number(cardCountMatch[1]), positions }
}

const CONTENT_DIR = new URL('../../content/spreads/', import.meta.url)

function readContentSpread(filename: string): ParsedContentSpread {
    const raw = readFileSync(new URL(filename, CONTENT_DIR), 'utf-8')
    return parseSpreadFrontmatter(raw)
}

const CONTENT: Record<SpreadId, ParsedContentSpread> = {
    'single-card': readContentSpread('single-card.md'),
    'past-present-direction': readContentSpread('past-present-direction.md'),
    'five-card-cross': readContentSpread('five-card-cross.md'),
}

describe('SPREADS', () => {
    it('declares exactly the three spreads the learning ladder currently covers', () => {
        const ids = [...SPREADS.map((s) => s.id)].sort()
        expect(ids).toEqual([...SPREAD_IDS].sort())
    })

    it('gives single-card exactly 1 position', () => {
        expect(requireSpread('single-card').positions).toHaveLength(1)
    })

    it('gives past-present-direction exactly 3 positions', () => {
        expect(requireSpread('past-present-direction').positions).toHaveLength(
            3
        )
    })

    it('gives five-card-cross exactly 5 positions', () => {
        expect(requireSpread('five-card-cross').positions).toHaveLength(5)
    })

    it('has a position count equal to the number of cards it draws, for every spread', () => {
        expect(SPREADS.length).toBeGreaterThan(0)
        for (const spread of SPREADS) {
            expect(spread.positions).toHaveLength(spread.cardCount)
        }
    })
})

describe('getSpread', () => {
    it('returns, for every known id, the same geometry SPREADS itself contains', () => {
        for (const id of SPREAD_IDS) {
            expect(getSpread(id)).toEqual(requireSpread(id))
        }
    })
})

describe('geometry invariants', () => {
    it('never gives two positions in the same spread identical coordinates', () => {
        for (const id of SPREAD_IDS) {
            const spread = requireSpread(id)
            const coords = spread.positions.map((p) => `${p.x},${p.y}`)
            expect(new Set(coords).size).toBe(coords.length)
        }
    })
})

describe('geometry invariants (property-based)', () => {
    it('never gives two positions in the same spread identical coordinates, for any of the three spreads', () => {
        fc.assert(
            fc.property(fc.constantFrom(...SPREAD_IDS), (id) => {
                const spread = requireSpread(id)
                const coords = spread.positions.map((p) => `${p.x},${p.y}`)
                expect(new Set(coords).size).toBe(coords.length)
            })
        )
    })
})

describe('five-card-cross geometry', () => {
    it('lays its five positions out as a plus sign: every position sits on the vertical or horizontal line through the centre', () => {
        const spread = requireSpread('five-card-cross')
        const center = boundingBoxCenter(spread.positions)

        for (const position of spread.positions) {
            const onVerticalAxis = position.x === center.x
            const onHorizontalAxis = position.y === center.y
            expect(onVerticalAxis || onHorizontalAxis).toBe(true)
        }

        const centerPositions = spread.positions.filter(
            (p) => p.x === center.x && p.y === center.y
        )
        expect(centerPositions).toHaveLength(1)

        const verticalArm = spread.positions.filter(
            (p) => p.x === center.x && p.y !== center.y
        )
        const horizontalArm = spread.positions.filter(
            (p) => p.y === center.y && p.x !== center.x
        )
        expect(verticalArm).toHaveLength(2)
        expect(horizontalArm).toHaveLength(2)
    })

    it('is vertically symmetric: the two positions on the vertical axis are equidistant from the centre', () => {
        const spread = requireSpread('five-card-cross')
        const center = boundingBoxCenter(spread.positions)

        const verticalArm = spread.positions.filter(
            (p) => p.x === center.x && p.y !== center.y
        )
        expect(verticalArm).toHaveLength(2)

        const distances = verticalArm
            .map((p) => Math.abs(p.y - center.y))
            .sort((a, b) => a - b)
        expect(distances[0]).toBe(distances[1])
    })
})

describe('content parity (geometry must not drift from the content collection)', () => {
    it("matches cardCount and every position label/x/y declared in each spread's content file", () => {
        const byLabel = (a: { label: string }, b: { label: string }) =>
            a.label.localeCompare(b.label)

        for (const id of SPREAD_IDS) {
            const geometry = requireSpread(id)
            const content = CONTENT[id]

            expect(geometry.cardCount).toBe(content.cardCount)
            expect(geometry.positions).toHaveLength(content.positions.length)

            const sortedGeometry = [...geometry.positions].sort(byLabel)
            const sortedContent = [...content.positions].sort(byLabel)
            expect(sortedGeometry).toEqual(sortedContent)
        }
    })
})

/**
 * The pedagogical claim the site's three spreads are meant to embody: each
 * one is a small step up from the last, not an arbitrary new layout. The
 * coordinates P05 actually wrote only support part of that claim as literal
 * containment -- see the two assertions below for exactly which part holds
 * and which doesn't.
 */
describe('the learning ladder', () => {
    const PRESENT_LABEL = 'Present'

    it('centres both the three-card and five-card spreads on a position literally labelled "Present"', () => {
        for (const id of [
            'past-present-direction',
            'five-card-cross',
        ] as const) {
            const spread = requireSpread(id)
            const center = boundingBoxCenter(spread.positions)
            const centerPosition = spread.positions.find(
                (p) => p.x === center.x && p.y === center.y
            )
            expect(centerPosition?.label).toBe(PRESENT_LABEL)
        }
    })

    it('does not put the single-card draw at the same coordinates as either spread\'s "Present" position -- the ladder is semantic (both are "the one card, read on its own"), not literal coordinate containment', () => {
        const single = requireSpread('single-card')
        expect(single.positions).toHaveLength(1)
        const soleDrawPosition = single.positions[0]!

        for (const id of [
            'past-present-direction',
            'five-card-cross',
        ] as const) {
            const spread = requireSpread(id)
            const present = spread.positions.find(
                (p) => p.label === PRESENT_LABEL
            )
            expect(present).toBeDefined()

            // As written, the single card sits at (0,0) -- in
            // past-present-direction that is "Past", not "Present". So the
            // single-card draw corresponds to the bigger spreads' centre
            // position by meaning only. Asserting coordinate equality here
            // would assert something the content does not actually say.
            const sameCoordinates =
                soleDrawPosition.x === present!.x &&
                soleDrawPosition.y === present!.y
            expect(sameCoordinates).toBe(false)
        }
    })

    it("keeps the three-card row and the five-card cross's horizontal arm the same relative shape, once each is normalised to its own left edge", () => {
        const threeCard = requireSpread('past-present-direction')
        const fiveCard = requireSpread('five-card-cross')

        const threeCardRow = [...threeCard.positions].sort((a, b) => a.x - b.x)
        expect(threeCardRow.every((p) => p.y === threeCardRow[0]!.y)).toBe(true)

        const fiveCardCenter = boundingBoxCenter(fiveCard.positions)
        const fiveCardArm = fiveCard.positions
            .filter((p) => p.y === fiveCardCenter.y)
            .sort((a, b) => a.x - b.x)

        expect(fiveCardArm).toHaveLength(threeCardRow.length)

        const threeCardOffsets = threeCardRow.map(
            (p) => p.x - threeCardRow[0]!.x
        )
        const fiveCardOffsets = fiveCardArm.map((p) => p.x - fiveCardArm[0]!.x)
        expect(fiveCardOffsets).toEqual(threeCardOffsets)

        // Same relative shape, but not label-for-label identical: P05 gave
        // the three-card row's endpoints "Past"/"Present", which the
        // five-card arm reuses, but its third slot is "Emerging" rather
        // than "Direction". That divergence is real content, not a typo in
        // this test, so it is asserted explicitly rather than glossed over
        // with a weaker check.
        expect(threeCardRow[0]!.label).toBe(fiveCardArm[0]!.label)
        expect(threeCardRow[1]!.label).toBe(fiveCardArm[1]!.label)
        expect(threeCardRow[2]!.label).not.toBe(fiveCardArm[2]!.label)
    })
})
