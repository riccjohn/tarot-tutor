import type { Suit } from '../../lib/deck'

/**
 * A small line-drawn mark for a suit (or the majors), coloured by
 * `currentColor` so the caller sets the suit accent. Decorative only: it
 * always sits beside the suit's written name.
 */
const PATHS: Record<Suit | 'major', React.ReactNode> = {
    major: (
        <>
            <circle cx={8} cy={8} r={6.5} />
            <path d="M8 3.5v9M3.5 8h9" />
        </>
    ),
    wands: <path d="M4 14 12 2M10.5 4.5 13 5M8 8l2.5.5" />,
    cups: <path d="M3.5 3h9c0 4-2 6-4.5 6S3.5 7 3.5 3ZM8 9v4M5 14h6" />,
    swords: <path d="M8 1.5v10M5 11.5h6M8 11.5v3" />,
    pentacles: (
        <>
            <circle cx={8} cy={8} r={6.5} />
            <path d="M8 2.8 11 12 3.3 6.4h9.4L5 12Z" />
        </>
    ),
}

export default function SuitSigil({ suit }: { suit: Suit | 'major' }) {
    return (
        <svg
            className="suit-sigil"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.2}
            aria-hidden="true"
            focusable="false"
        >
            {PATHS[suit]}
        </svg>
    )
}
