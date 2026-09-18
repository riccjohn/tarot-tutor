/**
 * The home-page island: one card locked to today's local date, with an
 * optional second card.
 *
 * Card selection is driven entirely by the `dateKey` prop through
 * `drawForDate` from `src/lib/draw.ts` — no `Math.random()` on this path, no
 * duplicate randomness inside the island. The primary card is drawn with
 * `drawForDate(DAILY_SPREAD_ID, 1, dateKey)`; the optional second card, once
 * revealed, is drawn with `drawForDate(DAILY_SECOND_SPREAD_ID, 1, dateKey)` —
 * a different seed so it lands on a different card than the primary draw.
 *
 * `collections` (unlike `FreePull`'s `compose` prop) is plain, JSON-shaped
 * data — an array of `{ id, data }` entries per collection, with no
 * functions anywhere in it — so it survives Astro's island prop
 * serialization unchanged. `composeCard` itself is imported code, not a
 * prop value, so it runs inside the island with no serialization concern.
 *
 * No reroll, reshuffle or "draw again" affordance exists anywhere in the
 * output — the date lock is the point.
 */

import { useState } from 'react'
import {
    composeCard,
    type ComposedCard,
    type ContentCollections,
} from '../../lib/content/compose'
import { drawForDate } from '../../lib/draw'
import { getCardImage } from '../../lib/images'

/** Seed component for the primary daily card. Folded into `drawForDate`'s hash. */
export const DAILY_SPREAD_ID = 'daily'

/** Seed component for the optional second card — distinct from the primary seed. */
export const DAILY_SECOND_SPREAD_ID = 'daily-second'

export interface DailyDrawProps {
    /** Today's local date key (`YYYY-MM-DD`), injectable so tests never depend on the real clock. */
    dateKey: string
    /** The full set of source content collections `composeCard` draws from. */
    collections: ContentCollections
}

/**
 * Renders one drawn card's teaching content in the same locked order as
 * `src/components/CardSections.astro`: image, then whichever structural
 * section(s) its kind carries (suit+number for pips, suit+rank for courts,
 * arc context for majors), then the symbol walkthrough, then the common
 * reading, then the invitation prompt.
 *
 * Astro components cannot be rendered inside a React island, so this
 * mirrors `CardSections.astro`'s markup contract (same `data-testid`s, same
 * relative order) rather than reusing it directly. `CardSections.astro`
 * remains the ordering authority for card pages; if its order ever changes,
 * this must change with it.
 *
 * Reversal is framed generically here (`reversal-note`) — identical text no
 * matter which card is reversed — never as card-specific interpretation.
 */
function DrawnCardSections({
    composed,
    reversed,
}: {
    composed: ComposedCard
    reversed: boolean
}) {
    const { card, own, suit, number, rank, majorArc } = composed
    const image = getCardImage(card.id)

    return (
        <>
            <img
                data-testid="card-image"
                src={image.src}
                srcSet={image.srcset}
                sizes={image.sizes}
                width={image.width}
                height={image.height}
                alt={`${card.name} tarot card`}
                loading="lazy"
                decoding="async"
            />

            {reversed && (
                <p data-testid="reversal-note">
                    Reversed — read the same meaning turned inward or blocked,
                    not a different card.
                </p>
            )}

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
        </>
    )
}

export default function DailyDraw({ dateKey, collections }: DailyDrawProps) {
    const [showSecond, setShowSecond] = useState(false)

    const primaryDraw = drawForDate(DAILY_SPREAD_ID, 1, dateKey)[0]!
    const primaryComposed = composeCard(primaryDraw.card, collections)

    return (
        <div data-testid="daily-draw">
            <p data-testid="daily-mechanism-note">
                This card is locked to today&rsquo;s date — it stays the same no
                matter how many times you reload or come back later today.
            </p>

            <DrawnCardSections
                composed={primaryComposed}
                reversed={primaryDraw.reversed}
            />

            {showSecond ? (
                <div data-testid="second-card">
                    <SecondCard dateKey={dateKey} collections={collections} />
                </div>
            ) : (
                <button
                    type="button"
                    data-testid="second-card-button"
                    onClick={() => setShowSecond(true)}
                >
                    Reveal a second card
                </button>
            )}
        </div>
    )
}

function SecondCard({
    dateKey,
    collections,
}: {
    dateKey: string
    collections: ContentCollections
}) {
    const draw = drawForDate(DAILY_SECOND_SPREAD_ID, 1, dateKey)[0]!
    const composed = composeCard(draw.card, collections)

    return <DrawnCardSections composed={composed} reversed={draw.reversed} />
}
