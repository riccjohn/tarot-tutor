import { useState } from 'react'
import type { ComposedCard } from '../../lib/content/compose'
import type { Card } from '../../lib/deck'
import { drawFreely, type Draw } from '../../lib/draw'
import { getCardImage } from '../../lib/images'
import CardPlate from './CardPlate'

/**
 * The self-directed reading page's island: unlike the daily draw, every
 * pull is fresh (no date-locked determinism), so the RNG is injectable
 * (`draw`) precisely so tests can control which cards come back without
 * stubbing `Math.random`. The real call site defaults `draw` to
 * `drawFreely` from `src/lib/draw.ts`.
 */
export interface FreePullProps {
    /** How many cards one pull draws. Defaults to 1. */
    count?: number
    /**
     * Injectable draw function, so tests can control — or seed the RNG
     * behind — which cards come back. Defaults to `drawFreely` at the real
     * call site (the page that mounts this island).
     */
    draw?: (count: number) => Draw[]
    /**
     * Composes a drawn card's teaching payload for rendering. Optional
     * because a function value cannot survive Astro's island prop
     * serialization — the real page (`src/pages/draw.astro`) instead passes
     * `composedById`, a precomputed lookup built server-side from
     * `composeCard`. Tests exercise this island directly in React (no
     * serialization boundary), so they pass `compose` in as a plain
     * function.
     */
    compose?: (card: Card) => ComposedCard
    /**
     * A serializable alternative to `compose`: every card's composed
     * payload, keyed by card id. Used when `compose` isn't provided (the
     * real page's case). One of `compose` or `composedById` must be given.
     */
    composedById?: Record<string, ComposedCard>
}

/**
 * Renders one drawn card's teaching content in the same locked order as
 * `src/components/CardSections.astro`: image, then whichever structural
 * section(s) its kind carries (suit+number for pips, suit+rank for courts,
 * arc context for majors), then the symbol walkthrough, then the common
 * reading, then the invitation prompt.
 *
 * The card's own art is rendered through `CardPlate` (Phase 7), the same
 * frame-and-stage markup the daily draw uses — `revealed` defaults to
 * `true` there, so a pulled card appears already face-up with no flip
 * animation, cooler than the daily draw's turning ritual. Astro components
 * cannot be rendered inside a React island, so the sections below still
 * mirror `CardSections.astro`'s markup contract (same `data-testid`s, same
 * relative order) rather than reusing it directly. `CardSections.astro`
 * remains the ordering authority for card pages; if its order ever changes,
 * this must change with it.
 */
function DrawnCard({
    draw,
    compose,
}: {
    draw: Draw
    compose: (card: Card) => ComposedCard
}) {
    const composed = compose(draw.card)
    const { card, own, suit, number, rank, majorArc } = composed
    const image = getCardImage(card.id)
    const cardSuit = suit?.suit ?? 'major'

    return (
        <div
            data-testid="drawn-card"
            data-card-id={card.id}
            data-reversed={String(draw.reversed)}
        >
            {composed.status !== 'edited' && (
                <p data-testid="draft-badge">
                    Draft — this reading is still being written and may change.
                </p>
            )}

            {draw.reversed && (
                <p data-testid="reversal-badge">
                    Reversed — read the same meaning turned inward or blocked,
                    not a different card.
                </p>
            )}

            <h1 data-testid="card-name">{card.name}</h1>

            <CardPlate
                suit={cardSuit}
                cardId={card.id}
                cardName={card.name}
                image={image}
                reversed={draw.reversed}
            />

            {suit && (
                <section data-testid="suit-info">
                    <h2>{suit.name}</h2>
                    <p>{suit.domain}</p>
                </section>
            )}

            {number && (
                <section data-testid="number-info">
                    <p>{number.stage}</p>
                </section>
            )}

            {rank && (
                <section data-testid="rank-info">
                    <p>{rank.ladderPosition}</p>
                </section>
            )}

            {majorArc && (
                <section data-testid="arc-context">
                    <p>Septenary {majorArc.septenary}</p>
                </section>
            )}

            <section data-testid="symbol-walkthrough">
                <ul>
                    {own.symbols.map((symbol) => (
                        <li key={symbol.element}>
                            <strong>{symbol.element}</strong> — {symbol.note}
                        </li>
                    ))}
                </ul>
            </section>

            <section data-testid="common-reading">
                {composed.status !== 'draft' && (
                    <h2 data-testid="reading-framing">
                        One reading among many
                    </h2>
                )}
                <p>{own.commonReading}</p>
            </section>

            <section data-testid="invitation-prompt">
                <p>{own.invitationPrompt}</p>
            </section>
        </div>
    )
}

export default function FreePull({
    count = 1,
    draw = drawFreely,
    compose,
    composedById,
}: FreePullProps) {
    const [draws, setDraws] = useState<Draw[]>([])
    const resolvedCompose =
        compose ??
        ((card: Card): ComposedCard => {
            const composed = composedById?.[card.id]
            if (!composed) {
                throw new Error(`No composed data for card "${card.id}"`)
            }
            return composed
        })

    return (
        <div data-testid="free-pull">
            <button type="button" onClick={() => setDraws(draw(count))}>
                Pull
            </button>
            <div data-testid="pull-row">
                {draws.map((d) => (
                    <DrawnCard
                        key={`${d.card.id}-${d.reversed}`}
                        draw={d}
                        compose={resolvedCompose}
                    />
                ))}
            </div>
        </div>
    )
}
