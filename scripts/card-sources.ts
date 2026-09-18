/**
 * Maps our card ids onto filenames in the Internet Archive item.
 *
 * Source: https://archive.org/details/rider-waite-tarot
 * 78 PNG scans at 400+ dpi from a single coherent scan session, marked
 * Public Domain Mark 1.0. Chosen over Wikimedia Commons because Commons'
 * complete decks live in separate subcategories that were scanned from
 * different printings — mixing them yields a visually mismatched deck.
 *
 * The 1909 artwork by Pamela Colman Smith is public domain: published before
 * 1930 in the US, and both candidate author death dates have long lapsed for
 * UK/EU terms. Faithful scans add no new copyright.
 *
 * ARCHIVE_ITEM below is a third-party Internet Archive item identifier, not
 * product branding. It has to match upstream verbatim or the download URL
 * 404s, so it is deliberately spelled out here rather than obscured. The
 * project's trademark gate is therefore scoped to `src/` — nothing
 * user-facing, rendered, or shipped carries the string, and this script only
 * fetches the gitignored originals.
 */

import { DECK, type Card } from '../src/lib/deck.ts'

export const ARCHIVE_ITEM = 'rider-waite-tarot'
export const ARCHIVE_BASE = `https://archive.org/download/${ARCHIVE_ITEM}`

/** Majors use abbreviated names upstream, so they need an explicit mapping. */
const MAJOR_FILE_STEMS: Record<string, string> = {
    'the-fool': 'fool',
    'the-magician': 'magician',
    'the-high-priestess': 'priestess',
    'the-empress': 'empress',
    'the-emperor': 'emperor',
    'the-hierophant': 'hierophant',
    'the-lovers': 'lovers',
    'the-chariot': 'chariot',
    strength: 'strength',
    'the-hermit': 'hermit',
    'wheel-of-fortune': 'fortune',
    justice: 'justice',
    'the-hanged-man': 'hanged',
    death: 'death',
    temperance: 'temperance',
    'the-devil': 'devil',
    'the-tower': 'tower',
    'the-star': 'star',
    'the-moon': 'moon',
    'the-sun': 'sun',
    judgement: 'judgement',
    'the-world': 'world',
}

const PIP_FILE_SUFFIX: Record<string, string> = {
    ace: 'ace',
    two: '2',
    three: '3',
    four: '4',
    five: '5',
    six: '6',
    seven: '7',
    eight: '8',
    nine: '9',
    ten: '10',
}

export function sourceFilename(card: Card): string {
    if (card.kind === 'major') {
        const stem = MAJOR_FILE_STEMS[card.id]
        if (!stem) throw new Error(`No source mapping for major "${card.id}"`)
        return `major_arcana_${stem}.png`
    }
    const suffix = card.kind === 'pip' ? PIP_FILE_SUFFIX[card.rank] : card.rank
    if (!suffix) throw new Error(`No source mapping for "${card.id}"`)
    return `minor_arcana_${card.suit}_${suffix}.png`
}

export function sourceUrl(card: Card): string {
    return `${ARCHIVE_BASE}/${sourceFilename(card)}`
}

/** Every card paired with its upstream filename. */
export const CARD_SOURCES = DECK.map((card) => ({
    card,
    filename: sourceFilename(card),
    url: sourceUrl(card),
}))
