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
 *
 * Ritual gate (Phase 6): the primary card's full markup contract — image,
 * structural sections, symbol walkthrough, reading, invitation — stays in
 * the DOM from first render. The reveal only ever toggles a boolean; CSS
 * (not markup presence) hides the front face and the post-reveal content
 * region until `daily-stage`'s `data-revealed` flips to `"true"`. A
 * `<noscript>` stylesheet forces the revealed presentation for visitors
 * without JavaScript, since the flip can never fire for them.
 */

import { useEffect, useRef, useState, type Ref } from 'react'
import {
    composeCard,
    type ComposedCard,
    type ContentCollections,
} from '../../lib/content/compose'
import { drawForDate } from '../../lib/draw'
import { getCardImage } from '../../lib/images'
import { romanDate } from '../../lib/ornament'
import CardPlate from './CardPlate'

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
 * CSS that forces the revealed presentation, for visitors whose browser
 * never runs the script that would otherwise flip `data-revealed` to
 * `"true"`. Without this, `global.css`'s default (front face and
 * post-reveal content hidden until revealed) would hide the card from
 * no-JS visitors forever.
 */
const NOSCRIPT_REVEAL_CSS = `
[data-testid='reveal-button'] { display: none; }
.card-plate[data-revealed='false'] .card-plate__face--front { visibility: visible; }
.card-plate[data-revealed='false'] .card-plate__face--back { display: none; }
.card-plate[data-revealed='false'] .card-plate__flip { transform: rotateY(180deg); }
[data-testid='daily-reveal-content'][data-revealed='false'] { display: block; }
`.trim()

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
 * The card's own art (`card-image`) is rendered by `CardPlate`, not here —
 * this only renders the sections that follow it.
 *
 * Reversal is framed generically here (`reversal-note`) — identical text no
 * matter which card is reversed — never as card-specific interpretation.
 */
function DrawnCardSections({
    composed,
    reversed,
    nameRef,
}: {
    composed: ComposedCard
    reversed: boolean
    nameRef?: Ref<HTMLHeadingElement>
}) {
    const { own, suit, number, rank, majorArc } = composed

    return (
        <>
            <h1 data-testid="card-name" tabIndex={-1} ref={nameRef}>
                {composed.card.name}
            </h1>

            {reversed && (
                <p data-testid="reversal-note">
                    Reversed — read the same meaning turned inward or blocked,
                    not a different card.
                </p>
            )}

            {suit && (
                <section data-testid="suit-info">
                    <p className="eyebrow">Suit</p>
                    <h2>{suit.name}</h2>
                    <p>{suit.domain}</p>
                </section>
            )}

            {number && (
                <section data-testid="number-info">
                    <p className="eyebrow">Number</p>
                    <p>{number.stage}</p>
                </section>
            )}

            {rank && (
                <section data-testid="rank-info">
                    <p className="eyebrow">Rank</p>
                    <p>{rank.ladderPosition}</p>
                </section>
            )}

            {majorArc && (
                <section data-testid="arc-context">
                    <p className="eyebrow">Major arc</p>
                    <p>Septenary {majorArc.septenary}</p>
                </section>
            )}

            <section data-testid="symbol-walkthrough">
                <p className="eyebrow">What is drawn</p>
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
    const [revealed, setRevealed] = useState(false)
    const [showSecond, setShowSecond] = useState(false)
    const nameRef = useRef<HTMLHeadingElement>(null)

    const primaryDraw = drawForDate(DAILY_SPREAD_ID, 1, dateKey)[0]!
    const primaryComposed = composeCard(primaryDraw.card, collections)
    const primarySuit = primaryComposed.suit?.suit ?? 'major'

    useEffect(() => {
        if (revealed) {
            nameRef.current?.focus()
        }
    }, [revealed])

    return (
        <div data-testid="daily-draw">
            <noscript>
                <style>{NOSCRIPT_REVEAL_CSS}</style>
            </noscript>

            <p className="eyebrow" data-testid="roman-date">
                {romanDate(dateKey)}
            </p>
            <p data-testid="readable-date">{readableDate(dateKey)}</p>
            <p data-testid="daily-mechanism-note">
                This card is locked to today&rsquo;s date — it stays the same no
                matter how many times you reload or come back later today.
            </p>

            <div
                data-testid="daily-stage"
                data-revealed={revealed ? 'true' : 'false'}
            >
                <CardPlate
                    suit={primarySuit}
                    cardId={primaryComposed.card.id}
                    cardName={primaryComposed.card.name}
                    image={getCardImage(primaryComposed.card.id)}
                    reversed={primaryDraw.reversed}
                    revealed={revealed}
                />
            </div>

            {!revealed && (
                <button
                    type="button"
                    data-testid="reveal-button"
                    onClick={() => setRevealed(true)}
                >
                    Turn the card
                </button>
            )}

            <div
                data-testid="daily-reveal-content"
                data-revealed={revealed ? 'true' : 'false'}
            >
                <DrawnCardSections
                    composed={primaryComposed}
                    reversed={primaryDraw.reversed}
                    nameRef={nameRef}
                />
            </div>

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
    const suit = composed.suit?.suit ?? 'major'

    return (
        <>
            <CardPlate
                suit={suit}
                cardId={composed.card.id}
                cardName={composed.card.name}
                image={getCardImage(composed.card.id)}
                reversed={draw.reversed}
            />
            <DrawnCardSections composed={composed} reversed={draw.reversed} />
        </>
    )
}

/**
 * Formats the injected date key for display. Parsed as parts rather than
 * `new Date(key)`, which would read the key as UTC and show the previous day
 * for anyone west of Greenwich — the draw is local by design.
 */
function readableDate(dateKey: string): string {
    const [y, m, d] = dateKey.split('-').map(Number)
    if (!y || !m || !d) return ''
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    })
}
