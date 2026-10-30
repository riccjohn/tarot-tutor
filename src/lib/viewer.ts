/**
 * The deck viewer's pure logic: which cards a filter shows and in what order,
 * how zoom steps move, how the suit-compare grid sizes itself, and how all of
 * that round-trips through the URL. No DOM here, so every rule is testable
 * without rendering.
 *
 * Order matters for learning. `DECK` lists all pips before all courts, but
 * the viewer walks each suit Ace to King, so a suit reads as one journey and
 * the compare grid lines the same rank up across all four suits.
 */

import {
    COURT_RANKS,
    DECK,
    PIP_RANKS,
    SUITS,
    getCard,
    isMajor,
    type Card,
    type Suit,
} from './deck'

export type Filter = 'all' | 'major' | 'minor' | Suit
export const FILTERS: readonly Filter[] = ['all', 'major', 'minor', ...SUITS]

/** `compare` lines the four suits up rank by rank. Minor arcana only. */
export type Layout = 'order' | 'compare'

/** A suit's fourteen ranks, Ace to King. */
export const SUIT_RANKS = [...PIP_RANKS, ...COURT_RANKS] as const

/** Cards per row in the grid. 1 is the swipeable single-card view. */
export const GRID_ZOOM_STEPS = [1, 2, 3, 4, 5, 6, 8] as const

/** Narrowest a grid card may get before the art stops being readable. */
const MIN_GRID_CARD_PX = 44

/** Shortest a compare-grid card may get, even on a very short screen. */
const MIN_COMPARE_CARD_PX = 90

/** Horizontal breathing room inside each compare-grid cell. */
const COMPARE_CELL_PADDING_PX = 8

export interface CardGroup {
    key: 'major' | Suit
    cards: Card[]
}

const MAJORS = DECK.filter(isMajor)

const SUIT_CARDS = Object.fromEntries(
    SUITS.map((suit) => [
        suit,
        SUIT_RANKS.map((rank) => getCard(`${rank}-of-${suit}`)!),
    ])
) as Record<Suit, Card[]>

/** The filter's cards in sections: majors, then each suit Ace to King. */
export function groupCards(filter: Filter): CardGroup[] {
    const groups: CardGroup[] = []
    if (filter === 'all' || filter === 'major') {
        groups.push({ key: 'major', cards: MAJORS })
    }
    for (const suit of SUITS) {
        if (filter === 'all' || filter === 'minor' || filter === suit) {
            groups.push({ key: suit, cards: SUIT_CARDS[suit] })
        }
    }
    return groups
}

/** The filter's cards as one sequence, the order the single-card view swipes through. */
export function filterCards(filter: Filter): Card[] {
    return groupCards(filter).flatMap((group) => group.cards)
}

/** The most cards per row that still leaves each one readable at this width. */
export function maxGridCols(width: number): number {
    return (
        GRID_ZOOM_STEPS.filter((cols) => width / cols >= MIN_GRID_CARD_PX).at(
            -1
        ) ?? 1
    )
}

/** One zoom step: `in` means fewer, larger cards; `out` means more. */
export function zoomGrid(
    cols: number,
    direction: 'in' | 'out',
    max: number
): number {
    const allowed = GRID_ZOOM_STEPS.filter((step) => step <= Math.max(1, max))
    const index = allowed.findLastIndex((step) => step <= cols)
    const next = direction === 'in' ? index - 1 : index + 1
    return allowed[Math.min(Math.max(next, 0), allowed.length - 1)]!
}

export interface CompareLayoutInput {
    availWidth: number
    /** Height for the four suit rows, excluding headers and pager. */
    availHeight: number
    rowGap: number
    /** Card width / height. */
    aspect: number
    /** Requested ranks across; clamped to what fits. Omit for the fit minimum. */
    ranks?: number
}

export interface CompareLayout {
    /** Fewest ranks across that still keeps all four suits on screen. */
    minRanks: number
    ranks: number
    columnWidth: number
    cardHeight: number
}

/**
 * Sizes the suit-compare grid so all four suits stay on screen at once —
 * the point of the view is to see one rank across every suit. Card height is
 * capped by the four rows sharing the height; zooming out adds ranks across
 * and shrinks cards, zooming in stops once cards hit that cap.
 */
export function compareLayout({
    availWidth,
    availHeight,
    rowGap,
    aspect,
    ranks,
}: CompareLayoutInput): CompareLayout {
    const maxCardHeight = Math.max(
        MIN_COMPARE_CARD_PX,
        (availHeight - rowGap * 3) / 4
    )
    const maxColumnWidth = maxCardHeight * aspect + COMPARE_CELL_PADDING_PX
    const minRanks = clamp(Math.ceil(availWidth / maxColumnWidth), 1, 14)
    const resolved = clamp(ranks ?? minRanks, minRanks, 14)
    const columnWidth = availWidth / resolved
    const cardHeight = Math.min(
        maxCardHeight,
        (columnWidth - COMPARE_CELL_PADDING_PX) / aspect
    )
    return { minRanks, ranks: resolved, columnWidth, cardHeight }
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max)
}

export interface ViewerState {
    filter: Filter
    layout: Layout
    /** Grid cards per row; 1 is the single-card view. */
    cols: number
    /** Ranks across in the compare grid; absent means fit to screen. */
    ranks?: number
    /** The card the single-card view is showing. */
    card?: string
}

const DEFAULT_STATE: ViewerState = { filter: 'all', layout: 'order', cols: 3 }

/** Reads viewer state from a query string, falling back on anything unrecognised. */
export function parseViewerState(search: string): ViewerState {
    const params = new URLSearchParams(search)
    const state: ViewerState = { ...DEFAULT_STATE }

    const filter = params.get('f')
    if (filter && (FILTERS as readonly string[]).includes(filter)) {
        state.filter = filter as Filter
    }
    if (params.get('layout') === 'compare' && state.filter === 'minor') {
        state.layout = 'compare'
    }
    const cols = Number(params.get('cols'))
    if ((GRID_ZOOM_STEPS as readonly number[]).includes(cols)) {
        state.cols = cols
    }
    const ranks = Number(params.get('ranks'))
    if (Number.isInteger(ranks) && ranks >= 1 && ranks <= 14) {
        state.ranks = ranks
    }
    const card = params.get('card')
    if (card && getCard(card)) {
        state.card = card
    }
    return state
}

/** Writes viewer state as a query string (with `?`), omitting defaults. */
export function serializeViewerState(state: ViewerState): string {
    const params = new URLSearchParams()
    if (state.filter !== DEFAULT_STATE.filter) params.set('f', state.filter)
    if (state.layout !== DEFAULT_STATE.layout) params.set('layout', state.layout)
    if (state.cols !== DEFAULT_STATE.cols) params.set('cols', String(state.cols))
    if (state.ranks !== undefined) params.set('ranks', String(state.ranks))
    if (state.card !== undefined) params.set('card', state.card)
    const query = params.toString()
    return query ? `?${query}` : ''
}
