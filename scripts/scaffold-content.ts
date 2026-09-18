/**
 * Seeds every content piece that isn't one of the hand-written references.
 *
 * Phase 5 writes one fully-worked reference per collection by hand — the
 * voice guide, the Three of Swords card, the Swords suit essay, the Three
 * number essay, and the three spreads — and leaves the remaining 271 pieces
 * as honest, schema-valid drafts. Bulk drafting real prose for all of them
 * is a later pass; this script's job is only to make every collection
 * complete and `pnpm check`-clean in the meantime.
 *
 * Idempotent and additive: a file that already exists is left untouched, so
 * running this after hand-writing a piece never clobbers it, and running it
 * again later (say, after a partial drafting pass) only fills remaining
 * gaps.
 *
 * Every generated draft is honestly a placeholder: factual/structural
 * fields (suit names, numerals, court ranks, a major's septenary row) are
 * filled in for real, since they're derived data rather than interpretive
 * writing. Every interpretive field (readings, domains, stages, ladder
 * positions, symbol descriptions) is left as an explicit "not yet written"
 * placeholder rather than faked prose — in particular, card symbol
 * descriptions are NEVER generated here, because describing artwork
 * requires opening the actual scan (see `three-of-swords.md`, written by
 * hand against `assets/card-scans/three-of-swords.png`). An agent or
 * script describing artwork it hasn't looked at will confabulate, and no
 * schema check catches that.
 *
 * Spreads are not touched here — all three are hand-written directly in
 * `src/content/spreads/`.
 *
 * Run with:
 *   pnpm content:scaffold
 */

import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
    COURT_RANKS,
    DECK,
    isMajor,
    PIP_RANKS,
    SUITS,
    type Card,
    type CourtRank,
    type PipRank,
    type Suit,
} from '../src/lib/deck.ts'

const ROOT_DIR = join(import.meta.dirname, '..')
const CONTENT_DIR = join(ROOT_DIR, 'src', 'content')

const DRAFT_SYMBOL_NOTE =
    'Placeholder entry pending the drafting pass — this card’s artwork ' +
    'has not been reviewed yet, so nothing here should be treated as ' +
    'descriptive.'

const DRAFT_READING =
    'Draft placeholder — this card’s common reading has not been ' +
    'written yet.'

const DRAFT_PROMPT =
    'Draft placeholder — an invitation prompt for this card has not ' +
    'been written yet.'

const DRAFT_DOMAIN =
    'Draft placeholder — this suit’s domain line has not been ' + 'written yet.'

const DRAFT_STAGE =
    'Draft placeholder — this number’s stage line has not been ' +
    'written yet.'

const DRAFT_LADDER_POSITION =
    'Draft placeholder — this rank’s ladder position has not ' +
    'been written yet.'

/** Conventional elemental attributions, used only as structural data. */
const SUIT_ELEMENT: Record<Suit, string> = {
    wands: 'Fire',
    cups: 'Water',
    swords: 'Air',
    pentacles: 'Earth',
}

function titleCase(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1)
}

function septenaryFor(majorNumber: number): 0 | 1 | 2 | 3 {
    if (majorNumber === 0) return 0
    return Math.ceil(majorNumber / 7) as 1 | 2 | 3
}

/** YAML frontmatter needs its multi-word placeholder strings quoted. */
function yamlString(value: string): string {
    return JSON.stringify(value)
}

interface WriteResult {
    written: boolean
}

async function writeIfMissing(
    path: string,
    contents: string
): Promise<WriteResult> {
    if (existsSync(path)) {
        return { written: false }
    }
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, contents)
    return { written: true }
}

function cardFrontmatter(card: Card): string {
    return `---
name: ${yamlString(card.name)}
symbols:
    - element: ${yamlString('Placeholder symbol 1 (not yet catalogued)')}
      note: ${yamlString(DRAFT_SYMBOL_NOTE)}
    - element: ${yamlString('Placeholder symbol 2 (not yet catalogued)')}
      note: ${yamlString(DRAFT_SYMBOL_NOTE)}
    - element: ${yamlString('Placeholder symbol 3 (not yet catalogued)')}
      note: ${yamlString(DRAFT_SYMBOL_NOTE)}
commonReading: ${yamlString(DRAFT_READING)}
invitationPrompt: ${yamlString(DRAFT_PROMPT)}
status: draft
---
`
}

function suitFrontmatter(suit: Suit): string {
    return `---
suit: ${suit}
name: ${yamlString(titleCase(suit))}
domain: ${yamlString(DRAFT_DOMAIN)}
conventionalElement: ${yamlString(SUIT_ELEMENT[suit])}
status: draft
---
`
}

function numberFrontmatter(rank: PipRank, numeral: number): string {
    return `---
rank: ${rank}
numeral: ${numeral}
stage: ${yamlString(DRAFT_STAGE)}
status: draft
---
`
}

function rankFrontmatter(rank: CourtRank): string {
    return `---
rank: ${rank}
name: ${yamlString(titleCase(rank))}
ladderPosition: ${yamlString(DRAFT_LADDER_POSITION)}
status: draft
---
`
}

function majorArcFrontmatter(cardId: string, number: number): string {
    return `---
cardId: ${yamlString(cardId)}
number: ${number}
septenary: ${septenaryFor(number)}
status: draft
---
`
}

interface LearnTopic {
    id: string
    order: number
    title: string
    description: string
}

/**
 * The beginner track's topic list. Unlike the other collections there is no
 * derived source (like `DECK`) to drive this one from, so the list is
 * hand-maintained here. Descriptions are honest placeholders, not real copy
 * — the titles alone are enough to keep the track's shape visible while
 * `pnpm check` stays green.
 */
const LEARN_TOPICS: LearnTopic[] = [
    {
        id: 'what-a-reading-is',
        order: 1,
        title: "What a Reading Is (and Isn't)",
        description:
            'Draft placeholder — this lesson has not been written yet.',
    },
    {
        id: 'shuffling-and-drawing',
        order: 2,
        title: 'Shuffling and Drawing a Card',
        description:
            'Draft placeholder — this lesson has not been written yet.',
    },
    {
        id: 'reading-structure-first',
        order: 3,
        title: "Reading a Card's Structure First",
        description:
            'Draft placeholder — this lesson has not been written yet.',
    },
    {
        id: 'using-a-spread',
        order: 4,
        title: 'Using a Spread',
        description:
            'Draft placeholder — this lesson has not been written yet.',
    },
    {
        id: 'reversals-as-a-technique',
        order: 5,
        title: 'Reversals, as a Technique',
        description:
            'Draft placeholder — this lesson has not been written yet.',
    },
]

function learnFrontmatter(topic: LearnTopic): string {
    return `---
title: ${yamlString(topic.title)}
description: ${yamlString(topic.description)}
order: ${topic.order}
status: draft
---
`
}

async function main() {
    let written = 0
    let skipped = 0

    const record = (result: WriteResult) => {
        if (result.written) written += 1
        else skipped += 1
    }

    // Cards: all 78 deck ids, skipping three-of-swords (hand-written).
    for (const card of DECK) {
        const path = join(CONTENT_DIR, 'cards', `${card.id}.md`)
        record(await writeIfMissing(path, cardFrontmatter(card)))
    }

    // Suits: skipping swords (hand-written).
    for (const suit of SUITS) {
        const path = join(CONTENT_DIR, 'suits', `${suit}.md`)
        record(await writeIfMissing(path, suitFrontmatter(suit)))
    }

    // Numbers: skipping three (hand-written).
    for (const [index, rank] of PIP_RANKS.entries()) {
        const path = join(CONTENT_DIR, 'numbers', `${rank}.md`)
        record(await writeIfMissing(path, numberFrontmatter(rank, index + 1)))
    }

    // Court ranks: none hand-written yet.
    for (const rank of COURT_RANKS) {
        const path = join(CONTENT_DIR, 'ranks', `${rank}.md`)
        record(await writeIfMissing(path, rankFrontmatter(rank)))
    }

    // Major arcana arc notes: none hand-written yet.
    for (const card of DECK) {
        if (!isMajor(card)) continue
        const path = join(CONTENT_DIR, 'majors-arc', `${card.id}.md`)
        record(
            await writeIfMissing(
                path,
                majorArcFrontmatter(card.id, card.number)
            )
        )
    }

    // Learn track: none hand-written yet.
    for (const topic of LEARN_TOPICS) {
        const path = join(CONTENT_DIR, 'learn', `${topic.id}.md`)
        record(await writeIfMissing(path, learnFrontmatter(topic)))
    }

    console.log(
        `Scaffolded ${written} draft content files (${skipped} already present).`
    )
}

await main()
