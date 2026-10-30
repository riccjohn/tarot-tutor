/**
 * The deck viewer: the whole deck, filtered and zoomed.
 *
 * Three presentations share one toolbar:
 * - grid: N cards per row, grouped by majors and suits
 * - single card (grid zoomed to 1): full-height card, swipe left/right
 * - compare suits (minor arcana only): four suit rows, one column per rank,
 *   swiping a page of ranks at a time
 *
 * Swiping is native CSS scroll-snap rather than a gesture library, so it
 * feels like the platform on every phone. Every rule about which cards show,
 * in what order and at what size lives in `src/lib/viewer.ts`; this file only
 * measures the screen and wires events.
 *
 * View state lives in the query string (`replaceState`, never `pushState`,
 * so zooming does not flood the back button) and is read back after mount —
 * the static build renders the default view, then the island catches up.
 */

import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type RefObject,
} from 'react'
import type { Card, Suit } from '../../lib/deck'
import { getCardImage } from '../../lib/images'
import { suitAccent } from '../../lib/ornament'
import {
    FILTERS,
    compareLayout,
    filterCards,
    groupCards,
    maxGridCols,
    parseViewerState,
    serializeViewerState,
    zoomGrid,
    type CompareLayout,
    type Filter,
    type ViewerState,
} from '../../lib/viewer'
import SuitSigil from './SuitSigil'

const CARD_ASPECT = 1110 / 1920

const FILTER_LABELS: Record<Filter, string> = {
    all: 'All',
    major: 'Major',
    minor: 'Minor',
    wands: 'Wands',
    cups: 'Cups',
    swords: 'Swords',
    pentacles: 'Pentacles',
}

const GROUP_TITLES: Record<'major' | Suit, string> = {
    major: 'Major Arcana',
    wands: 'Wands',
    cups: 'Cups',
    swords: 'Swords',
    pentacles: 'Pentacles',
}

/** Column headings for the compare grid, Ace to King. */
const RANK_LABELS = [
    'A',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    'P',
    'Kn',
    'Q',
    'K',
]

/** Grid density at which card names hide and only the art shows. */
const DENSE_COLS = 5

export default function DeckViewer() {
    const [state, setState] = useState<ViewerState>(() =>
        parseViewerState('')
    )
    const [hydrated, setHydrated] = useState(false)
    const [compareScroll, setCompareScroll] = useState(0)
    const stageRef = useRef<HTMLDivElement>(null)
    const toolbarRef = useRef<HTMLDivElement>(null)
    const viewport = useViewport()
    const stageTop = useDocumentTop(stageRef)
    const stageWidth = useElementWidth(stageRef)
    const gutter = usePxVariable(stageRef, '--gutter', 16)

    useEffect(() => {
        setState(parseViewerState(window.location.search))
        setHydrated(true)
    }, [])

    useEffect(() => {
        if (!hydrated) return
        const url = `${window.location.pathname}${serializeViewerState(state)}`
        window.history.replaceState(null, '', url)
    }, [state, hydrated])

    const update = useCallback(
        (patch: Partial<ViewerState>) =>
            setState((prev) => ({ ...prev, ...patch })),
        []
    )

    const cards = filterCards(state.filter)
    const comparing = state.filter === 'minor' && state.layout === 'compare'
    const oneUp = !comparing && state.cols === 1
    // Two across is always allowed, so the single-card view can be left.
    const maxCols = stageWidth
        ? Math.max(2, maxGridCols(stageWidth))
        : 8
    // The compare table bleeds a gutter past the stage on each side; the
    // left one sits under the sticky suit labels.
    const labelWidth = COMPARE_LABEL_PX + gutter
    const compare = compareLayout({
        availWidth: (stageWidth || 358) - COMPARE_LABEL_PX,
        availHeight: (viewport?.height ?? 844) - stageTop - COMPARE_CHROME_PX,
        rowGap: COMPARE_ROW_GAP_PX,
        aspect: CARD_ASPECT,
        ranks: state.ranks,
    })
    const firstRank = Math.min(
        13,
        Math.round(compareScroll / compare.columnWidth)
    )
    const lastRank = Math.min(13, firstRank + compare.ranks - 1)

    function firstVisibleCardId(): string | undefined {
        const top = toolbarRef.current?.getBoundingClientRect().bottom ?? 0
        const buttons = stageRef.current?.querySelectorAll('[data-card-id]')
        const first = Array.from(buttons ?? []).find(
            (el) => el.getBoundingClientRect().bottom > top + 20
        )
        return first?.getAttribute('data-card-id') ?? undefined
    }

    function selectFilter(filter: Filter) {
        update({
            filter,
            layout: filter === 'minor' ? state.layout : 'order',
            card: oneUp ? filterCards(filter)[0]!.id : undefined,
        })
        window.scrollTo?.(0, 0)
    }

    function openCard(id: string) {
        update({ cols: 1, layout: 'order', card: id })
        window.scrollTo?.(0, 0)
    }

    return (
        <div className="deck-viewer" data-testid="deck-viewer">
            <div className="deck-viewer__toolbar" ref={toolbarRef}>
                <div
                    className="deck-viewer__chips"
                    role="group"
                    aria-label="Which cards"
                >
                    {FILTERS.map((filter) => (
                        <button
                            key={filter}
                            type="button"
                            className="deck-viewer__chip"
                            aria-pressed={state.filter === filter}
                            onClick={() => selectFilter(filter)}
                        >
                            {filter !== 'all' &&
                                filter !== 'major' &&
                                filter !== 'minor' && (
                                    <SuitSigil suit={filter} />
                                )}
                            {FILTER_LABELS[filter]}
                        </button>
                    ))}
                </div>

                <div className="deck-viewer__row">
                    {state.filter === 'minor' ? (
                        <div
                            className="deck-viewer__segment"
                            role="group"
                            aria-label="Minor arcana layout"
                        >
                            <button
                                type="button"
                                aria-pressed={state.layout === 'order'}
                                onClick={() => update({ layout: 'order' })}
                            >
                                In order
                            </button>
                            <button
                                type="button"
                                aria-pressed={state.layout === 'compare'}
                                onClick={() => {
                                    update({ layout: 'compare' })
                                    window.scrollTo?.(0, 0)
                                }}
                            >
                                Compare suits
                            </button>
                        </div>
                    ) : (
                        <span className="deck-viewer__count">
                            {cards.length} cards
                        </span>
                    )}

                    {comparing ? (
                        <ZoomControl
                            label={`${RANK_LABELS[firstRank]}–${RANK_LABELS[lastRank]}`}
                            canZoomIn={compare.ranks > compare.minRanks}
                            canZoomOut={compare.ranks < 14}
                            onZoomIn={() =>
                                update({ ranks: compare.ranks - 1 })
                            }
                            onZoomOut={() =>
                                update({ ranks: compare.ranks + 1 })
                            }
                        />
                    ) : (
                        <ZoomControl
                            label={oneUp ? '1 card' : `${state.cols} across`}
                            canZoomIn={!oneUp}
                            canZoomOut={state.cols < maxCols}
                            onZoomIn={() =>
                                update({
                                    cols: zoomGrid(state.cols, 'in', maxCols),
                                    card:
                                        state.cols === 2
                                            ? (firstVisibleCardId() ??
                                              cards[0]!.id)
                                            : state.card,
                                })
                            }
                            onZoomOut={() =>
                                update({
                                    cols: zoomGrid(state.cols, 'out', maxCols),
                                    card: oneUp
                                        ? state.card
                                        : firstVisibleCardId(),
                                })
                            }
                        />
                    )}
                </div>
            </div>

            <div className="deck-viewer__stage" ref={stageRef}>
                {comparing ? (
                    <CompareGrid
                        layout={compare}
                        labelWidth={labelWidth}
                        onScrolled={setCompareScroll}
                        onOpen={openCard}
                    />
                ) : oneUp ? (
                    <OneUp
                        cards={cards}
                        currentId={state.card ?? cards[0]!.id}
                        viewport={viewport}
                        onChange={(id) => update({ card: id })}
                    />
                ) : (
                    <Grid
                        filter={state.filter}
                        cols={Math.min(state.cols, maxCols)}
                        focusId={state.card}
                        onFocused={() => update({ card: undefined })}
                        onOpen={openCard}
                    />
                )}
            </div>
        </div>
    )
}

function ZoomControl({
    label,
    canZoomIn,
    canZoomOut,
    onZoomIn,
    onZoomOut,
}: {
    label: string
    canZoomIn: boolean
    canZoomOut: boolean
    onZoomIn: () => void
    onZoomOut: () => void
}) {
    return (
        <div className="deck-viewer__zoom">
            <button
                type="button"
                aria-label="Show more cards"
                disabled={!canZoomOut}
                onClick={onZoomOut}
            >
                −
            </button>
            <output aria-live="polite">{label}</output>
            <button
                type="button"
                aria-label="Show fewer, larger cards"
                disabled={!canZoomIn}
                onClick={onZoomIn}
            >
                +
            </button>
        </div>
    )
}

function CardButton({
    card,
    sizes,
    showName,
    onOpen,
}: {
    card: Card
    sizes: string
    showName: boolean
    onOpen: (id: string) => void
}) {
    return (
        <button
            type="button"
            className="deck-viewer__card"
            data-card-id={card.id}
            aria-label={card.name}
            onClick={() => onOpen(card.id)}
        >
            <CardArt card={card} sizes={sizes} />
            {showName && (
                <span className="deck-viewer__name" aria-hidden="true">
                    {card.name}
                </span>
            )}
        </button>
    )
}

function CardArt({ card, sizes }: { card: Card; sizes: string }) {
    const image = getCardImage(card.id)
    return (
        <img
            className="deck-viewer__art"
            src={image.src}
            srcSet={image.srcset}
            sizes={sizes}
            width={image.width}
            height={image.height}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
        />
    )
}

function Grid({
    filter,
    cols,
    focusId,
    onFocused,
    onOpen,
}: {
    filter: Filter
    cols: number
    focusId?: string
    onFocused: () => void
    onOpen: (id: string) => void
}) {
    const listRef = useRef<HTMLUListElement>(null)
    const groups = groupCards(filter)
    const sizes = `(min-width: 72rem) ${Math.round(1088 / cols)}px, ${Math.round(100 / cols)}vw`

    // Coming back out of the single-card view lands on the card you were on.
    useLayoutEffect(() => {
        if (!focusId) return
        listRef.current
            ?.querySelector(`[data-card-id="${focusId}"]`)
            ?.scrollIntoView?.({ block: 'center' })
        onFocused()
    }, [focusId, onFocused])

    return (
        <ul
            ref={listRef}
            className="deck-viewer__grid"
            style={{ '--cols': cols } as React.CSSProperties}
        >
            {groups.map((group) => [
                groups.length > 1 && (
                    <li
                        key={`heading-${group.key}`}
                        className="deck-viewer__group"
                        style={{ color: `var(${suitAccent(group.key)})` }}
                    >
                        <SuitSigil suit={group.key} />
                        <h2>{GROUP_TITLES[group.key]}</h2>
                    </li>
                ),
                ...group.cards.map((card) => (
                    <li key={card.id}>
                        <CardButton
                            card={card}
                            sizes={sizes}
                            showName={cols < DENSE_COLS}
                            onOpen={onOpen}
                        />
                    </li>
                )),
            ])}
        </ul>
    )
}

function OneUp({
    cards,
    currentId,
    viewport,
    onChange,
}: {
    cards: Card[]
    currentId: string
    viewport: Viewport | null
    onChange: (id: string) => void
}) {
    const trackRef = useRef<HTMLDivElement>(null)
    const top = useDocumentTop(trackRef)
    const found = cards.findIndex((card) => card.id === currentId)
    const index = found === -1 ? 0 : found
    const current = cards[index]!
    // Room left under the toolbar once the title row below the card is placed.
    const slideHeight = viewport
        ? Math.max(260, viewport.height - top - 96)
        : 520
    const sizes = `${Math.round(slideHeight * CARD_ASPECT)}px`

    // Jump (not animate) to the current card whenever it changes from outside a swipe.
    useLayoutEffect(() => {
        const track = trackRef.current
        if (!track || !track.clientWidth) return
        const target = index * track.clientWidth
        if (Math.abs(track.scrollLeft - target) > 1) track.scrollLeft = target
    }, [index, viewport?.width])

    const step = useCallback(
        (delta: number) => {
            const track = trackRef.current
            if (!track) return
            track.scrollBy({ left: delta * track.clientWidth, behavior: 'smooth' })
        },
        []
    )

    useEffect(() => {
        function onKey(event: KeyboardEvent) {
            if (event.key === 'ArrowLeft') step(-1)
            if (event.key === 'ArrowRight') step(1)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [step])

    function onScroll() {
        const track = trackRef.current
        if (!track || !track.clientWidth) return
        const settled = Math.round(track.scrollLeft / track.clientWidth)
        const card = cards[settled]
        if (card && card.id !== current.id) onChange(card.id)
    }

    return (
        <div className="deck-viewer__one-up">
            <div
                ref={trackRef}
                className="deck-viewer__track"
                style={{ '--slide-h': `${slideHeight}px` } as React.CSSProperties}
                onScroll={onScroll}
            >
                {cards.map((card, i) => (
                    <div
                        key={card.id}
                        className="deck-viewer__slide"
                        aria-hidden={i !== index}
                    >
                        <CardArt card={card} sizes={sizes} />
                    </div>
                ))}
            </div>
            <div className="deck-viewer__caption">
                <div>
                    <p className="deck-viewer__title" data-testid="one-up-title">
                        {current.name}
                    </p>
                    <p
                        className="deck-viewer__position"
                        data-testid="one-up-position"
                    >
                        {index + 1} of {cards.length}
                    </p>
                </div>
                <div className="deck-viewer__arrows">
                    <button
                        type="button"
                        aria-label="Previous card"
                        disabled={index === 0}
                        onClick={() => step(-1)}
                    >
                        ‹
                    </button>
                    <button
                        type="button"
                        aria-label="Next card"
                        disabled={index === cards.length - 1}
                        onClick={() => step(1)}
                    >
                        ›
                    </button>
                </div>
            </div>
        </div>
    )
}

/** Width of the sticky suit-label column in the compare grid. */
const COMPARE_LABEL_PX = 30
/** Rank header row plus page dots plus a little air below. */
const COMPARE_CHROME_PX = 34 + 26 + 16
const COMPARE_ROW_GAP_PX = 8

function CompareGrid({
    layout,
    labelWidth,
    onScrolled,
    onOpen,
}: {
    layout: CompareLayout
    labelWidth: number
    onScrolled: (scrollLeft: number) => void
    onOpen: (id: string) => void
}) {
    const [scrollLeft, setScrollLeft] = useState(0)
    const pageWidth = layout.columnWidth * layout.ranks
    const pages = Math.ceil(14 / layout.ranks)
    const page = Math.min(pages - 1, Math.round(scrollLeft / pageWidth))
    const sizes = `${Math.round(layout.cardHeight * CARD_ASPECT)}px`

    return (
        <div className="deck-viewer__compare">
            <div
                className="deck-viewer__compare-scroller"
                onScroll={(event) => {
                    setScrollLeft(event.currentTarget.scrollLeft)
                    onScrolled(event.currentTarget.scrollLeft)
                }}
            >
                <div
                    className="deck-viewer__compare-table"
                    style={
                        {
                            '--label-w': `${labelWidth}px`,
                            '--col-w': `${layout.columnWidth}px`,
                            '--card-h': `${layout.cardHeight}px`,
                            '--row-gap': `${COMPARE_ROW_GAP_PX}px`,
                        } as React.CSSProperties
                    }
                >
                    <div className="deck-viewer__corner" />
                    {RANK_LABELS.map((label, i) => (
                        <div
                            key={label}
                            className="deck-viewer__rank"
                            data-snap={i % layout.ranks === 0}
                        >
                            {label}
                        </div>
                    ))}
                    {groupCards('minor').map((group) => (
                        <CompareRow
                            key={group.key}
                            suit={group.key as Suit}
                            cards={group.cards}
                            sizes={sizes}
                            onOpen={onOpen}
                        />
                    ))}
                </div>
            </div>
            <div className="deck-viewer__pager" aria-hidden="true">
                {Array.from({ length: pages }, (_, i) => (
                    <i key={i} data-on={i === page} />
                ))}
            </div>
        </div>
    )
}

function CompareRow({
    suit,
    cards,
    sizes,
    onOpen,
}: {
    suit: Suit
    cards: Card[]
    sizes: string
    onOpen: (id: string) => void
}) {
    return (
        <div
            className="deck-viewer__compare-row"
            data-testid="compare-row"
            data-suit={suit}
            role="group"
            aria-label={GROUP_TITLES[suit]}
        >
            <div
                className="deck-viewer__suit"
                style={{ color: `var(${suitAccent(suit)})` }}
            >
                <span>{GROUP_TITLES[suit]}</span>
                <SuitSigil suit={suit} />
            </div>
            {cards.map((card) => (
                <div key={card.id} className="deck-viewer__cell">
                    <CardButton
                        card={card}
                        sizes={sizes}
                        showName={false}
                        onOpen={onOpen}
                    />
                </div>
            ))}
        </div>
    )
}

interface Viewport {
    width: number
    height: number
}

/** The window's size, or null until mounted (the static build has no window). */
function useViewport(): Viewport | null {
    const [viewport, setViewport] = useState<Viewport | null>(null)
    useEffect(() => {
        function read() {
            setViewport({
                width: document.documentElement.clientWidth,
                height: window.innerHeight,
            })
        }
        read()
        window.addEventListener('resize', read)
        return () => window.removeEventListener('resize', read)
    }, [])
    return viewport
}

/** An element's content width, kept current as the window resizes. */
function useElementWidth(ref: RefObject<HTMLElement | null>): number {
    const [width, setWidth] = useState(0)
    useLayoutEffect(() => {
        const el = ref.current
        if (!el) return
        const read = () => setWidth(el.clientWidth)
        read()
        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', read)
            return () => window.removeEventListener('resize', read)
        }
        const observer = new ResizeObserver(read)
        observer.observe(el)
        return () => observer.disconnect()
    }, [ref])
    return width
}

/** An element's top edge in document coordinates, so scrolling never changes it. */
function useDocumentTop(ref: RefObject<HTMLElement | null>): number {
    const [top, setTop] = useState(0)
    useLayoutEffect(() => {
        const el = ref.current
        if (!el) return
        setTop(el.getBoundingClientRect().top + window.scrollY)
    })
    return top
}

/** A px-valued CSS custom property as inherited by the element. */
function usePxVariable(
    ref: RefObject<HTMLElement | null>,
    name: string,
    fallback: number
): number {
    const [value, setValue] = useState(fallback)
    useLayoutEffect(() => {
        const el = ref.current
        if (!el) return
        const read = parseFloat(getComputedStyle(el).getPropertyValue(name))
        setValue(Number.isFinite(read) ? read : fallback)
    })
    return value
}
