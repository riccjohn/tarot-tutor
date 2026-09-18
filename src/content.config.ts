import { glob } from 'astro/loaders'
import { defineCollection, z } from 'astro:content'
import { COURT_RANKS, PIP_RANKS, SUITS } from './lib/deck'

/**
 * Content is drafted first and edited afterwards, so every piece tracks its own
 * state. The UI marks drafts honestly rather than passing them off as finished.
 */
const status = z.enum(['draft', 'edited']).default('draft')

/**
 * The 78 per-card pieces.
 *
 * Everything lives in frontmatter rather than the body: these are three short,
 * distinct fields, and schema validation across 78 files is what catches the
 * gaps a large drafting pass will inevitably leave.
 */
const cards = defineCollection({
    loader: glob({ base: './src/content/cards', pattern: '**/*.md' }),
    schema: z.object({
        name: z.string(),
        /**
         * What is literally visible in this card's artwork, and what each
         * element conventionally points to. Written against the actual scan.
         */
        symbols: z
            .array(
                z.object({
                    element: z.string().min(1),
                    note: z.string().min(1),
                })
            )
            .min(3)
            .max(6),
        /** The brief gloss. Always presented as one reading among many. */
        commonReading: z.string().min(1),
        /** The question that hands interpretation back to the reader. */
        invitationPrompt: z.string().min(1),
        status,
    }),
})

/** Four suit essays, each reused across fourteen cards. */
const suits = defineCollection({
    loader: glob({ base: './src/content/suits', pattern: '**/*.{md,mdx}' }),
    schema: z.object({
        suit: z.enum(SUITS),
        name: z.string(),
        /** One line, for card-page summaries. */
        domain: z.string().min(1),
        conventionalElement: z.string().min(1),
        /**
         * Where traditions genuinely disagree about this suit's attribution.
         * Surfaced as teaching material rather than smoothed over.
         */
        contested: z.string().optional(),
        status,
    }),
})

/** Ten number essays, each reused across four pips. */
const numbers = defineCollection({
    loader: glob({ base: './src/content/numbers', pattern: '**/*.{md,mdx}' }),
    schema: z.object({
        rank: z.enum(PIP_RANKS),
        numeral: z.number().int().min(1).max(10),
        /** One line naming the stage, e.g. "the turn toward conflict". */
        stage: z.string().min(1),
        status,
    }),
})

/** Four court rank essays, each reused across four cards. */
const ranks = defineCollection({
    loader: glob({ base: './src/content/ranks', pattern: '**/*.{md,mdx}' }),
    schema: z.object({
        rank: z.enum(COURT_RANKS),
        name: z.string(),
        ladderPosition: z.string().min(1),
        status,
    }),
})

/** Where each major sits in the arc. */
const majorsArc = defineCollection({
    loader: glob({
        base: './src/content/majors-arc',
        pattern: '**/*.{md,mdx}',
    }),
    schema: z.object({
        cardId: z.string(),
        number: z.number().int().min(0).max(21),
        /**
         * Which row of seven, under the septenary scheme. The Fool is 0 and
         * sits outside the rows. This is one of two common schemes — the
         * narrative arc is the other — and the content says so.
         */
        septenary: z.union([
            z.literal(0),
            z.literal(1),
            z.literal(2),
            z.literal(3),
        ]),
        status,
    }),
})

/** Spread geometry and per-position semantics. */
const spreads = defineCollection({
    loader: glob({ base: './src/content/spreads', pattern: '**/*.{md,mdx}' }),
    schema: z.object({
        name: z.string(),
        cardCount: z.number().int().min(1).max(78),
        summary: z.string().min(1),
        positions: z
            .array(
                z.object({
                    label: z.string().min(1),
                    meaning: z.string().min(1),
                    /** Abstract grid coordinates, not pixels — where this position sits in the layout. */
                    x: z.number(),
                    y: z.number(),
                })
            )
            .min(1),
        /** Notes where this layout's lineage is disputed. */
        variantNote: z.string().optional(),
        order: z.number().int(),
        status,
    }),
})

/** The beginner learning track. */
const learn = defineCollection({
    loader: glob({ base: './src/content/learn', pattern: '**/*.{md,mdx}' }),
    schema: z.object({
        title: z.string(),
        description: z.string().min(1),
        order: z.number().int(),
        status,
    }),
})

export const collections = {
    cards,
    suits,
    numbers,
    ranks,
    majorsArc,
    spreads,
    learn,
}
