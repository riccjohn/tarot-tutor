import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { DECK, SUITS, isMajor } from '../deck'
import {
    FILTERS,
    GRID_ZOOM_STEPS,
    SUIT_RANKS,
    compareLayout,
    filterCards,
    groupCards,
    maxGridCols,
    parseViewerState,
    serializeViewerState,
    zoomGrid,
    type ViewerState,
} from '../viewer'

describe('filterCards', () => {
    it.each([
        ['all', 78],
        ['major', 22],
        ['minor', 56],
        ['wands', 14],
        ['cups', 14],
        ['swords', 14],
        ['pentacles', 14],
    ] as const)('%s yields %i cards', (filter, count) => {
        expect(filterCards(filter)).toHaveLength(count)
    })

    it('covers the whole deck exactly once under "all"', () => {
        const ids = filterCards('all').map((card) => card.id)
        expect(new Set(ids).size).toBe(78)
        expect([...ids].sort()).toEqual(DECK.map((card) => card.id).sort())
    })

    it('runs majors first, then each suit Ace to King', () => {
        const cards = filterCards('all')
        expect(cards.slice(0, 22).every(isMajor)).toBe(true)
        expect(cards[22]!.id).toBe('ace-of-wands')
        expect(cards[35]!.id).toBe('king-of-wands')
        expect(cards[36]!.id).toBe('ace-of-cups')
        expect(cards[77]!.id).toBe('king-of-pentacles')
    })

    it('orders a single suit Ace, Two … Ten, Page, Knight, Queen, King', () => {
        expect(filterCards('cups').map((card) => card.id)).toEqual(
            SUIT_RANKS.map((rank) => `${rank}-of-cups`)
        )
    })
})

describe('groupCards', () => {
    it('splits "all" into majors then the four suits', () => {
        expect(groupCards('all').map((group) => group.key)).toEqual([
            'major',
            ...SUITS,
        ])
    })

    it('gives "minor" four suit rows of fourteen, the compare grid', () => {
        const groups = groupCards('minor')
        expect(groups.map((group) => group.key)).toEqual([...SUITS])
        for (const group of groups) {
            expect(group.cards).toHaveLength(14)
        }
        // Same column = same rank across every suit.
        expect(groups.map((group) => group.cards[2]!.id)).toEqual(
            SUITS.map((suit) => `three-of-${suit}`)
        )
    })

    it('flattens back to filterCards for every filter', () => {
        for (const filter of FILTERS) {
            expect(groupCards(filter).flatMap((group) => group.cards)).toEqual(
                filterCards(filter)
            )
        }
    })
})

describe('grid zoom', () => {
    it('steps toward fewer, larger cards on zoom in and stops at one', () => {
        expect(zoomGrid(3, 'in', 8)).toBe(2)
        expect(zoomGrid(2, 'in', 8)).toBe(1)
        expect(zoomGrid(1, 'in', 8)).toBe(1)
    })

    it('steps toward more cards on zoom out and stops at the width cap', () => {
        expect(zoomGrid(3, 'out', 8)).toBe(4)
        expect(zoomGrid(4, 'out', 4)).toBe(4)
        expect(zoomGrid(6, 'out', 8)).toBe(8)
    })

    it('caps columns by width so no card gets narrower than 44px', () => {
        expect(maxGridCols(358)).toBe(8)
        expect(maxGridCols(300)).toBe(6)
        expect(maxGridCols(100)).toBe(2)
        expect(maxGridCols(10)).toBe(1)
    })

    it('always lands on a step within [1, max]', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...GRID_ZOOM_STEPS),
                fc.constantFrom('in' as const, 'out' as const),
                fc.integer({ min: 1, max: 8 }),
                (cols, direction, max) => {
                    const next = zoomGrid(cols, direction, max)
                    expect(GRID_ZOOM_STEPS).toContain(next)
                    expect(next).toBeGreaterThanOrEqual(1)
                    expect(next).toBeLessThanOrEqual(Math.max(1, max))
                }
            )
        )
    })
})

describe('compareLayout', () => {
    const ASPECT = 1110 / 1920

    it('fits A–4 on a phone, with all four suits on screen', () => {
        const layout = compareLayout({
            availWidth: 330,
            availHeight: 620,
            rowGap: 8,
            aspect: ASPECT,
        })
        expect(layout.minRanks).toBe(4)
        expect(layout.ranks).toBe(4)
        expect(layout.cardHeight * 4 + 8 * 3).toBeLessThanOrEqual(620)
    })

    it('shows all fourteen ranks on a wide, short screen', () => {
        const layout = compareLayout({
            availWidth: 1200,
            availHeight: 600,
            rowGap: 8,
            aspect: ASPECT,
        })
        expect(layout.minRanks).toBe(14)
    })

    it('honours a requested rank count between the fit minimum and 14', () => {
        const base = { availWidth: 330, availHeight: 620, rowGap: 8 }
        const args = { ...base, aspect: ASPECT }
        expect(compareLayout({ ...args, ranks: 7 }).ranks).toBe(7)
        expect(compareLayout({ ...args, ranks: 2 }).ranks).toBe(4)
        expect(compareLayout({ ...args, ranks: 20 }).ranks).toBe(14)
    })

    it('never draws a card taller than its share of the height', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 200, max: 2000 }),
                fc.integer({ min: 300, max: 1400 }),
                fc.option(fc.integer({ min: 1, max: 14 }), { nil: undefined }),
                (availWidth, availHeight, ranks) => {
                    const layout = compareLayout({
                        availWidth,
                        availHeight,
                        rowGap: 8,
                        aspect: ASPECT,
                        ranks,
                    })
                    expect(layout.ranks).toBeGreaterThanOrEqual(1)
                    expect(layout.ranks).toBeLessThanOrEqual(14)
                    expect(layout.cardHeight * 4 + 24).toBeLessThanOrEqual(
                        Math.max(availHeight, 4 * 90 + 24) + 0.001
                    )
                }
            )
        )
    })
})

describe('viewer URL state', () => {
    it('defaults to every card, in order, three across', () => {
        expect(parseViewerState('')).toEqual({
            filter: 'all',
            layout: 'order',
            cols: 3,
        })
    })

    it('ignores values it does not recognise', () => {
        expect(
            parseViewerState('?f=hearts&layout=sideways&cols=7&card=nope')
        ).toEqual({ filter: 'all', layout: 'order', cols: 3 })
    })

    it('drops the compare layout outside the minor arcana', () => {
        expect(parseViewerState('?f=cups&layout=compare').layout).toBe('order')
    })

    it('serialises defaults to an empty query', () => {
        expect(
            serializeViewerState({ filter: 'all', layout: 'order', cols: 3 })
        ).toBe('')
    })

    it('round-trips any valid state', () => {
        const state = fc.record(
            {
                filter: fc.constantFrom(...FILTERS),
                layout: fc.constantFrom('order' as const, 'compare' as const),
                cols: fc.constantFrom(...GRID_ZOOM_STEPS),
                ranks: fc.integer({ min: 1, max: 14 }),
                card: fc.constantFrom(...DECK.map((card) => card.id)),
            },
            { requiredKeys: ['filter', 'layout', 'cols'] }
        )
        fc.assert(
            fc.property(state, (raw) => {
                const valid: ViewerState = {
                    ...raw,
                    layout: raw.filter === 'minor' ? raw.layout : 'order',
                }
                expect(parseViewerState(serializeViewerState(valid))).toEqual(
                    valid
                )
            })
        )
    })
})
