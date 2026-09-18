import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { parseHTML } from 'linkedom'
import { beforeAll, describe, expect, it } from 'vitest'
import LearnEntryPage, {
    type LearnEntryNavLink,
    type LearnEntryView,
} from '../learn/[slug].astro'
import LearnIndexPage, { type LearnIndexEntry } from '../learn/index.astro'

/**
 * Rendered-output contract for the beginner learning track index and entry
 * pages (Phase 8, L4 boundary).
 *
 * Rendered with `experimental_AstroContainer` + `renderToString`, then
 * parsed with `linkedom` so ordering and navigation are asserted
 * structurally — by node position and by `data-slug`/`href` — rather than by
 * substring search in the raw HTML string.
 *
 * Fixtures mirror the real seed content in `src/content/learn/` (five
 * lessons, `order` 1 through 5, all `status: 'draft'`) but this file never
 * imports `astro:content` itself: both `LearnIndexPage` and
 * `LearnEntryPage` take plain fixture props (`LearnIndexEntry`,
 * `LearnEntryView`, `LearnEntryNavLink`), matching the pattern in
 * `card-page.test.ts` and `src/lib/content/compose.ts`.
 *
 * This file must run under the default `node` Vitest environment (it uses
 * `astro/container`, and a `.astro` import resolves to the client build
 * under jsdom, where `AstroContainer` throws `NoMatchingRenderer`) — no
 * environment override is declared anywhere in this file.
 */

/** Real Phase 5 seed slugs, titles and declared order, from `src/content/learn/`. */
const SEED = [
    {
        slug: 'what-a-reading-is',
        title: "What a Reading Is (and Isn't)",
        order: 1,
    },
    {
        slug: 'shuffling-and-drawing',
        title: 'Shuffling and Drawing a Card',
        order: 2,
    },
    {
        slug: 'reading-structure-first',
        title: "Reading a Card's Structure First",
        order: 3,
    },
    { slug: 'using-a-spread', title: 'Using a Spread', order: 4 },
    {
        slug: 'reversals-as-a-technique',
        title: 'Reversals, as a Technique',
        order: 5,
    },
] as const

function makeIndexEntry(
    seed: (typeof SEED)[number],
    status: LearnIndexEntry['status'] = 'draft'
): LearnIndexEntry {
    return {
        slug: seed.slug,
        title: seed.title,
        description: `Fixture description for ${seed.title}`,
        order: seed.order,
        status,
    }
}

/**
 * The index fixture, deliberately NOT in ascending `order` — reversed, then
 * perturbed further so it also doesn't coincide with alphabetical-by-slug
 * order. This is what proves the page sorts by the declared `order` field
 * rather than happening to echo back whatever order it was handed.
 */
const SHUFFLED_INDEX_ENTRIES: LearnIndexEntry[] = [
    makeIndexEntry(SEED[4]!), // order 5
    makeIndexEntry(SEED[1]!), // order 2
    makeIndexEntry(SEED[3]!), // order 4
    makeIndexEntry(SEED[0]!), // order 1
    makeIndexEntry(SEED[2]!), // order 3
]

const ASCENDING_SLUGS = [...SEED]
    .sort((a, b) => a.order - b.order)
    .map((s) => s.slug)
const ALPHABETICAL_SLUGS = [...SEED].map((s) => s.slug).sort()
const INPUT_SLUGS = SHUFFLED_INDEX_ENTRIES.map((e) => e.slug)

// Sanity on the fixture itself: if either of these ever collided with the
// expected ascending order, the corresponding assertion below would pass
// vacuously regardless of whether the page actually sorts.
if (JSON.stringify(ALPHABETICAL_SLUGS) === JSON.stringify(ASCENDING_SLUGS)) {
    throw new Error(
        'fixture bug: alphabetical order coincides with declared order'
    )
}
if (JSON.stringify(INPUT_SLUGS) === JSON.stringify(ASCENDING_SLUGS)) {
    throw new Error('fixture bug: input order coincides with declared order')
}

const GENERIC_BODY_HTML =
    '<p data-testid="fixture-paragraph">Fixture lesson body content.</p>'

/**
 * A body fixture for the "contested suit-element attributions" requirement.
 * Two named traditions, with genuinely different (not merely duplicated)
 * element assignments — encoded as attributes rather than prose, so the
 * test below asserts structure (count, distinct sources, differing values)
 * rather than searching for a phrase the component could hardcode.
 */
const CONTESTED_ATTRIBUTIONS_BODY_HTML = `
    <ul data-testid="element-attribution-list">
        <li data-testid="element-attribution" data-source="golden-dawn" data-wands-element="fire" data-swords-element="air">
            Golden Dawn attribution: Wands correspond to Fire, Swords to Air.
        </li>
        <li data-testid="element-attribution" data-source="continental" data-wands-element="air" data-swords-element="fire">
            A rival, continental attribution reverses it: Wands to Air, Swords to Fire.
        </li>
    </ul>
`

function makeEntryView(
    seed: (typeof SEED)[number],
    overrides: Partial<LearnEntryView> = {}
): LearnEntryView {
    return {
        slug: seed.slug,
        title: seed.title,
        description: `Fixture description for ${seed.title}`,
        status: 'draft',
        bodyHtml: GENERIC_BODY_HTML,
        ...overrides,
    }
}

function navLinkFor(seed: (typeof SEED)[number]): LearnEntryNavLink {
    return { slug: seed.slug, title: seed.title }
}

let container: Awaited<ReturnType<typeof AstroContainer.create>>

beforeAll(async () => {
    container = await AstroContainer.create()
})

async function renderIndex(entries: LearnIndexEntry[]) {
    const html = await container.renderToString(LearnIndexPage, {
        props: { entries },
    })
    return parseHTML(html).document
}

async function renderEntry(props: {
    entry: LearnEntryView
    prev: LearnEntryNavLink | null
    next: LearnEntryNavLink | null
}) {
    const html = await container.renderToString(LearnEntryPage, { props })
    return parseHTML(html).document
}

describe('learn index: declared order', () => {
    it('lists entries in ascending `order`, not the fixture array order or alphabetical order', async () => {
        const doc = await renderIndex(SHUFFLED_INDEX_ENTRIES)

        const links = Array.from(
            doc.querySelectorAll('[data-testid="learn-index-entry"]')
        )
        expect(links).toHaveLength(SEED.length)

        const renderedSlugs = links.map((el) => el.getAttribute('data-slug'))
        expect(renderedSlugs).toEqual(ASCENDING_SLUGS)
        expect(renderedSlugs).not.toEqual(INPUT_SLUGS)
        expect(renderedSlugs).not.toEqual(ALPHABETICAL_SLUGS)
    })

    it('links each entry to its own page', async () => {
        const doc = await renderIndex(SHUFFLED_INDEX_ENTRIES)

        for (const seed of SEED) {
            const link = doc.querySelector(
                `[data-testid="learn-index-entry"][data-slug="${seed.slug}"]`
            )
            expect(link).not.toBeNull()
            expect(link!.getAttribute('href')).toContain(seed.slug)
        }
    })
})

describe('learn entry page: title, description, body', () => {
    it('renders the title, description and body from the fixture', async () => {
        const seed = SEED[0]!
        const doc = await renderEntry({
            entry: makeEntryView(seed),
            prev: null,
            next: navLinkFor(SEED[1]!),
        })

        const title = doc.querySelector('[data-testid="learn-title"]')
        const description = doc.querySelector(
            '[data-testid="learn-description"]'
        )
        const body = doc.querySelector('[data-testid="learn-body"]')

        expect(title).not.toBeNull()
        expect((title!.textContent ?? '').trim()).toBe(seed.title)

        expect(description).not.toBeNull()
        expect((description!.textContent ?? '').trim()).toBe(
            `Fixture description for ${seed.title}`
        )

        expect(body).not.toBeNull()
        expect(
            body!.querySelector('[data-testid="fixture-paragraph"]')
        ).not.toBeNull()
    })
})

describe('learn entry page: draft marker', () => {
    it('renders a visible draft marker for a draft-status entry', async () => {
        const seed = SEED[0]!
        const doc = await renderEntry({
            entry: makeEntryView(seed, { status: 'draft' }),
            prev: null,
            next: navLinkFor(SEED[1]!),
        })

        const badge = doc.querySelector('[data-testid="draft-badge"]')
        expect(badge).not.toBeNull()
        expect(badge!.hasAttribute('hidden')).toBe(false)
        expect((badge!.textContent ?? '').trim().length).toBeGreaterThan(0)
    })

    it('renders no draft marker for an edited entry', async () => {
        const seed = SEED[0]!
        const doc = await renderEntry({
            entry: makeEntryView(seed, { status: 'edited' }),
            prev: null,
            next: navLinkFor(SEED[1]!),
        })

        expect(doc.querySelector('[data-testid="draft-badge"]')).toBeNull()
    })
})

describe('learn entry page: contested suit-element attributions', () => {
    it('names at least two competing attributions with genuinely different element assignments, rather than asserting one', async () => {
        const seed = SEED[2]! // "Reading a Card's Structure First" — covers suit elements
        const doc = await renderEntry({
            entry: makeEntryView(seed, {
                bodyHtml: CONTESTED_ATTRIBUTIONS_BODY_HTML,
            }),
            prev: navLinkFor(SEED[1]!),
            next: navLinkFor(SEED[3]!),
        })

        const attributions = Array.from(
            doc.querySelectorAll('[data-testid="element-attribution"]')
        )
        expect(attributions.length).toBeGreaterThanOrEqual(2)

        const sources = attributions.map((el) => el.getAttribute('data-source'))
        expect(new Set(sources).size).toBe(sources.length)
        for (const source of sources) {
            expect(source).not.toBeNull()
            expect((source ?? '').length).toBeGreaterThan(0)
        }

        // Genuine disagreement, not two identically-attributed entries: the
        // wands-element assignment must actually differ across sources.
        const wandsElements = attributions.map((el) =>
            el.getAttribute('data-wands-element')
        )
        expect(new Set(wandsElements).size).toBeGreaterThan(1)
    })
})

describe('learn entry page: navigation at both ends of the track', () => {
    it('has no previous link and a correct next link on the first entry', async () => {
        const doc = await renderEntry({
            entry: makeEntryView(SEED[0]!),
            prev: null,
            next: navLinkFor(SEED[1]!),
        })

        expect(doc.querySelector('[data-testid="learn-prev-link"]')).toBeNull()

        const next = doc.querySelector('[data-testid="learn-next-link"]')
        expect(next).not.toBeNull()
        expect(next!.getAttribute('href')).toContain(SEED[1]!.slug)
        expect((next!.textContent ?? '').trim()).toBe(SEED[1]!.title)
    })

    it('has both a correct previous and a correct next link on a middle entry', async () => {
        const doc = await renderEntry({
            entry: makeEntryView(SEED[2]!),
            prev: navLinkFor(SEED[1]!),
            next: navLinkFor(SEED[3]!),
        })

        const prev = doc.querySelector('[data-testid="learn-prev-link"]')
        const next = doc.querySelector('[data-testid="learn-next-link"]')

        expect(prev).not.toBeNull()
        expect(prev!.getAttribute('href')).toContain(SEED[1]!.slug)
        expect((prev!.textContent ?? '').trim()).toBe(SEED[1]!.title)

        expect(next).not.toBeNull()
        expect(next!.getAttribute('href')).toContain(SEED[3]!.slug)
        expect((next!.textContent ?? '').trim()).toBe(SEED[3]!.title)
    })

    it('has a correct previous link and no next link on the last entry', async () => {
        const doc = await renderEntry({
            entry: makeEntryView(SEED[4]!),
            prev: navLinkFor(SEED[3]!),
            next: null,
        })

        const prev = doc.querySelector('[data-testid="learn-prev-link"]')
        expect(prev).not.toBeNull()
        expect(prev!.getAttribute('href')).toContain(SEED[3]!.slug)
        expect((prev!.textContent ?? '').trim()).toBe(SEED[3]!.title)

        expect(doc.querySelector('[data-testid="learn-next-link"]')).toBeNull()
    })
})
