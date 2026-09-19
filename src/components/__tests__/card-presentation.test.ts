import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { parseHTML } from 'linkedom'
import { beforeAll, describe, expect, it } from 'vitest'
import cardImages from '../../data/card-images.json'
import { sectionOrderFromHtml } from '../../pages/__tests__/section-order-contract'
import CardBack from '../CardBack.astro'
import CardFrame from '../CardFrame.astro'
import CardImage from '../CardImage.astro'
import Divider from '../Divider.astro'
import Ornament from '../Ornament.astro'

/**
 * Rendered-output contract for Phase 3's presentation primitives: the
 * frame, back, ornaments and divider every page will assemble cards with,
 * plus the extended `CardImage` variant/reversed/sizes API.
 *
 * Rendered with `experimental_AstroContainer` + `renderToString`, then
 * parsed with linkedom, exactly as `card-page.test.ts` does. Run under the
 * default **node** environment (no jsdom vitest-environment pragma) —
 * see the header comment in `../../pages/__tests__/section-order-contract.ts`
 * for why an Astro-component import resolves to the client build (and
 * `AstroContainer` throws `NoMatchingRenderer`) the moment a DOM global
 * exists.
 *
 * Component/prop API this file assumes (see phase report for the full
 * rationale):
 *   - `CardImage` (extended, existing file): adds optional
 *     `variant?: 'plate' | 'thumb'` (default 'plate'),
 *     `reversed?: boolean` (default false), `sizes?: string` (explicit
 *     override, wins over the variant default). All three are additive —
 *     omitting them must reproduce today's contract exactly. Reversal sets
 *     `data-reversed="true"`/`"false"` directly on the rendered `<img>`
 *     (the art element itself), never on a wrapping "flip" container.
 *   - `CardFrame` (new): `suit?: Suit` (defaults to the literal `"major"`
 *     when omitted). Wraps a default slot. Root element carries
 *     `data-testid="card-frame"` and `data-suit="<suit|major>"`. Adds no
 *     testid from the shared card-page contract list, so wrapping a
 *     `CardImage` and running `sectionOrderFromHtml` over the result
 *     yields exactly `['card-image']`.
 *   - `CardBack` (new): no required props. Root element carries
 *     `data-testid="card-back"` and `aria-hidden="true"`. Emits no
 *     `card-image` testid and no `<img alt>`.
 *   - `Ornament` (new): `kind: 'corner' | 'wands' | 'cups' | 'swords' |
 *     'pentacles' | 'hero'`. Renders a single `<svg>` root carrying
 *     `data-testid="ornament"`, `aria-hidden="true"` and
 *     `focusable="false"`. Emits no `card-image` testid and no
 *     `<img alt>`.
 *   - `Divider` (new): no required props. Renders exactly one
 *     `data-testid="divider"` root element, `aria-hidden="true"`, with no
 *     text content (nothing for assistive tech to read).
 */

let container: Awaited<ReturnType<typeof AstroContainer.create>>

beforeAll(async () => {
    container = await AstroContainer.create()
})

async function renderToDoc(
    Component: Parameters<typeof container.renderToString>[0],
    options?: Parameters<typeof container.renderToString>[1]
) {
    const html = await container.renderToString(Component, options)
    return { html, doc: parseHTML(html).document }
}

const THREE_OF_SWORDS = {
    id: 'three-of-swords',
    name: 'Three of Swords',
} as const

describe('CardImage: unchanged default contract', () => {
    it('renders exactly one card-image img with the existing src/alt pattern when no new props are given', async () => {
        const { doc } = await renderToDoc(CardImage, {
            props: THREE_OF_SWORDS,
        })

        const images = doc.querySelectorAll('[data-testid="card-image"]')
        expect(images).toHaveLength(1)

        const img = images[0]!
        const manifestEntry = cardImages['three-of-swords']

        expect(img.getAttribute('src')).toBe(manifestEntry.fallback.src)
        expect(img.getAttribute('width')).toBe(
            String(manifestEntry.fallback.width)
        )
        expect(img.getAttribute('height')).toBe(
            String(manifestEntry.fallback.height)
        )
        expect(img.getAttribute('alt')).toBe('Three of Swords tarot card')
        expect(img.getAttribute('loading')).toBe('lazy')
    })
})

describe('CardImage: reversed', () => {
    it('marks the art element data-reversed="true" when reversed', async () => {
        const { doc } = await renderToDoc(CardImage, {
            props: { ...THREE_OF_SWORDS, reversed: true },
        })

        const images = doc.querySelectorAll('[data-testid="card-image"]')
        expect(images).toHaveLength(1)
        expect(images[0]!.getAttribute('data-reversed')).toBe('true')
    })

    it('renders data-reversed="false" or omits it entirely when upright', async () => {
        const { doc } = await renderToDoc(CardImage, {
            props: { ...THREE_OF_SWORDS, reversed: false },
        })

        const images = doc.querySelectorAll('[data-testid="card-image"]')
        expect(images).toHaveLength(1)
        const img = images[0]!
        const value = img.getAttribute('data-reversed')
        expect(value === null || value === 'false').toBe(true)
    })
})

/** Largest px figure mentioned in a `sizes` attribute value, for a coarse "which is bigger" comparison. */
function maxPixelValue(sizes: string): number {
    const matches = Array.from(sizes.matchAll(/(\d+)px/g)).map((m) =>
        Number(m[1])
    )
    expect(matches.length).toBeGreaterThan(0)
    return Math.max(...matches)
}

describe('CardImage: variant', () => {
    it('gives the thumb variant a smaller sizes than the plate variant, keeping loading="lazy"', async () => {
        const plate = await renderToDoc(CardImage, {
            props: { ...THREE_OF_SWORDS, variant: 'plate' },
        })
        const thumb = await renderToDoc(CardImage, {
            props: { ...THREE_OF_SWORDS, variant: 'thumb' },
        })

        const plateImg = plate.doc.querySelector('[data-testid="card-image"]')!
        const thumbImg = thumb.doc.querySelector('[data-testid="card-image"]')!

        const plateSizes = plateImg.getAttribute('sizes') ?? ''
        const thumbSizes = thumbImg.getAttribute('sizes') ?? ''

        expect(maxPixelValue(thumbSizes)).toBeLessThan(
            maxPixelValue(plateSizes)
        )
        expect(thumbImg.getAttribute('loading')).toBe('lazy')
    })

    it('lets an explicit sizes prop override the variant default, for both variants', async () => {
        const explicitSizes = '99px'

        const plateOverride = await renderToDoc(CardImage, {
            props: {
                ...THREE_OF_SWORDS,
                variant: 'plate',
                sizes: explicitSizes,
            },
        })
        const thumbOverride = await renderToDoc(CardImage, {
            props: {
                ...THREE_OF_SWORDS,
                variant: 'thumb',
                sizes: explicitSizes,
            },
        })

        expect(
            plateOverride.doc
                .querySelector('[data-testid="card-image"]')!
                .getAttribute('sizes')
        ).toBe(explicitSizes)
        expect(
            thumbOverride.doc
                .querySelector('[data-testid="card-image"]')!
                .getAttribute('sizes')
        ).toBe(explicitSizes)
    })
})

describe('CardFrame', () => {
    it('keeps card-image inside the frame and adds no contract testid of its own', async () => {
        const cardImageHtml = await container.renderToString(CardImage, {
            props: THREE_OF_SWORDS,
        })

        const { html, doc } = await renderToDoc(CardFrame, {
            props: { suit: 'wands' },
            slots: { default: cardImageHtml },
        })

        expect(doc.querySelectorAll('[data-testid="card-image"]')).toHaveLength(
            1
        )
        expect(sectionOrderFromHtml(html)).toEqual(['card-image'])
    })

    it('exposes the given suit as data-suit for accent styling', async () => {
        const { doc } = await renderToDoc(CardFrame, {
            props: { suit: 'wands' },
            slots: { default: '<p>card</p>' },
        })

        const frame = doc.querySelector('[data-testid="card-frame"]')
        expect(frame).not.toBeNull()
        expect(frame!.getAttribute('data-suit')).toBe('wands')
    })

    it('defaults data-suit to "major" when no suit is given', async () => {
        const { doc } = await renderToDoc(CardFrame, {
            props: {},
            slots: { default: '<p>card</p>' },
        })

        const frame = doc.querySelector('[data-testid="card-frame"]')
        expect(frame).not.toBeNull()
        expect(frame!.getAttribute('data-suit')).toBe('major')
    })
})

describe('CardBack', () => {
    it('renders aria-hidden and emits no card-image or alt-bearing img', async () => {
        const { doc } = await renderToDoc(CardBack, { props: {} })

        const back = doc.querySelector('[data-testid="card-back"]')
        expect(back).not.toBeNull()
        expect(back!.getAttribute('aria-hidden')).toBe('true')

        expect(doc.querySelector('[data-testid="card-image"]')).toBeNull()
        expect(doc.querySelector('img[alt]')).toBeNull()
    })
})

describe('Ornament', () => {
    const kinds = [
        'corner',
        'wands',
        'cups',
        'swords',
        'pentacles',
        'hero',
    ] as const

    it.each(kinds)(
        'renders the %s ornament as a decorative, unfocusable svg',
        async (kind) => {
            const { doc } = await renderToDoc(Ornament, { props: { kind } })

            const ornament = doc.querySelector('[data-testid="ornament"]')
            expect(ornament).not.toBeNull()
            expect(ornament!.tagName.toLowerCase()).toBe('svg')
            expect(ornament!.getAttribute('aria-hidden')).toBe('true')
            expect(ornament!.getAttribute('focusable')).toBe('false')

            expect(doc.querySelector('[data-testid="card-image"]')).toBeNull()
            expect(doc.querySelector('img[alt]')).toBeNull()
        }
    )
})

describe('Divider', () => {
    it('renders exactly one decorative element, hidden from assistive tech, with no text content', async () => {
        const { doc } = await renderToDoc(Divider, { props: {} })

        const dividers = doc.querySelectorAll('[data-testid="divider"]')
        expect(dividers).toHaveLength(1)

        const divider = dividers[0]!
        expect(divider.getAttribute('aria-hidden')).toBe('true')
        expect((divider.textContent ?? '').trim()).toBe('')
    })
})
