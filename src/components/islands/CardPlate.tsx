/**
 * The daily draw's flip stage: an engraved card back that turns to reveal
 * the drawn card's plate.
 *
 * Mirrors `CardFrame.astro` and `CardBack.astro`'s markup contract (same
 * `data-testid`s, same corner ornaments) rather than rendering them
 * directly — an Astro component cannot render inside a React island, the
 * same constraint `DailyDraw.tsx` and `FreePull.tsx` already work around
 * for `CardSections.astro`.
 *
 * `revealed` defaults to `true` so a non-flip usage (the optional second
 * card, which appears already face-up with no turning animation) gets the
 * plain plate look for free: a component that mounts already `revealed`
 * never receives a CSS transition trigger, since transitions only fire on
 * a *change* to an applied style, not on the value present at first paint.
 *
 * Reversal rotates the `card-image` element itself (`data-reversed`),
 * never this flip container — the frame and its corner ornaments always
 * stay upright, per the project's existing convention in `global.css`.
 */

import type { Suit } from '../../lib/deck'
import type { CardImageAttrs } from '../../lib/images'

export interface CardPlateProps {
    /** Suit accent to expose via `data-suit`. Use `'major'` for major arcana. */
    suit: Suit | 'major'
    /** Deck id of the drawn card, stamped onto the art element for stability checks. */
    cardId: string
    /** Card display name, used to build descriptive alt text. */
    cardName: string
    /** Responsive `<img>` attributes from `getCardImage`. */
    image: CardImageAttrs
    /** Whether the draw landed reversed. */
    reversed: boolean
    /** Whether the front face is showing. Defaults to `true` (no face-down stage). */
    revealed?: boolean
}

const CORNER_POSITIONS = [
    'corner-tl',
    'corner-tr',
    'corner-bl',
    'corner-br',
] as const

function CornerOrnament({
    position,
}: {
    position: (typeof CORNER_POSITIONS)[number]
}) {
    return (
        <svg
            data-testid="ornament"
            className={`corner ${position}`}
            viewBox="0 0 20 20"
            aria-hidden="true"
            focusable="false"
        >
            <path
                d="M1 19V6a5 5 0 0 1 5-5h13M5 19V9a4 4 0 0 1 4-4h10"
                fill="none"
                stroke="currentColor"
                strokeWidth={1}
            />
            <circle cx={4} cy={4} r={1.6} fill="currentColor" />
        </svg>
    )
}

function Corners() {
    return (
        <>
            {CORNER_POSITIONS.map((position) => (
                <CornerOrnament key={position} position={position} />
            ))}
        </>
    )
}

export default function CardPlate({
    suit,
    cardId,
    cardName,
    image,
    reversed,
    revealed = true,
}: CardPlateProps) {
    return (
        <div className="card-plate" data-revealed={revealed ? 'true' : 'false'}>
            <div className="card-plate__halo" aria-hidden="true" />
            <div className="card-plate__flip">
                <div
                    className="card-plate__face card-plate__face--back plate"
                    data-testid="card-back"
                    aria-hidden="true"
                >
                    <svg className="card-back-art" viewBox="0 0 110 190">
                        <g fill="none" stroke="currentColor">
                            <rect
                                x={4}
                                y={4}
                                width={102}
                                height={182}
                                strokeWidth={0.8}
                            />
                            <rect
                                x={8}
                                y={8}
                                width={94}
                                height={174}
                                strokeWidth={0.4}
                            />
                            <g transform="translate(55 95)" strokeWidth={0.5}>
                                <circle r={38} />
                                <circle r={34} strokeDasharray="1 2" />
                                <circle r={14} />
                                <path d="M0-34 29.4 17 -29.4 17Z" />
                                <path d="M0 34 -29.4-17 29.4-17Z" />
                                <circle r={3} fill="currentColor" />
                                <path d="M0-80v34M0 46v34" strokeWidth={0.4} />
                            </g>
                            <g strokeWidth={0.5}>
                                <path
                                    d="M55 18l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"
                                    fill="currentColor"
                                />
                                <path
                                    d="M55 158l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"
                                    fill="currentColor"
                                />
                            </g>
                            <g strokeWidth={0.5}>
                                <path d="M8 20h8v-8M102 20h-8v-8M8 170h8v8M102 170h-8v8" />
                            </g>
                        </g>
                    </svg>
                    <Corners />
                </div>

                <div
                    className="card-plate__face card-plate__face--front plate"
                    data-testid="card-frame"
                    data-suit={suit}
                >
                    <img
                        data-testid="card-image"
                        data-card-id={cardId}
                        data-reversed={reversed ? 'true' : 'false'}
                        src={image.src}
                        srcSet={image.srcset}
                        sizes={image.sizes}
                        width={image.width}
                        height={image.height}
                        alt={`${cardName} tarot card`}
                        loading="lazy"
                        decoding="async"
                    />
                    {reversed && (
                        <p
                            className="card-plate__plaque"
                            data-testid="reversal-plaque"
                        >
                            Reversed
                        </p>
                    )}
                    <Corners />
                </div>
            </div>
        </div>
    )
}
