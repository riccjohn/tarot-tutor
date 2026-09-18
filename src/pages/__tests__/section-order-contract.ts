/**
 * The locked card-section order, shared by the two renderers that emit it.
 *
 * `CardSections.astro` renders card pages; `DailyDraw.tsx` and
 * `FreePull.tsx` re-emit the same contract from React, because an Astro
 * component cannot render inside a React island. The order is a product
 * requirement, so both renderers are held to the sequences below.
 *
 * This lives in its own module because the two sides cannot be asserted in
 * one test file: importing a `.astro` component while a DOM global exists
 * resolves it to the client build, where `isAstroComponentFactory` is
 * undefined and `AstroContainer` throws `NoMatchingRenderer`. So the Astro
 * side is asserted under the default node environment in
 * `card-sections-order.test.ts`, the React side under jsdom in
 * `daily-draw.test.ts`, and both compare against these constants. A
 * renderer that drifts fails its own file.
 */

/** Contract sections, in the order a page must present them. */
export const CARD_PAGE_TESTIDS = [
    'card-image',
    'suit-info',
    'number-info',
    'rank-info',
    'arc-context',
    'common-reading',
    'invitation-prompt',
] as const

/** Expected sequence per card kind. Pips carry a number, courts a rank. */
export const EXPECTED_SECTION_ORDER = {
    pip: [
        'card-image',
        'suit-info',
        'number-info',
        'common-reading',
        'invitation-prompt',
    ],
    court: [
        'card-image',
        'suit-info',
        'rank-info',
        'common-reading',
        'invitation-prompt',
    ],
    major: ['card-image', 'arc-context', 'common-reading', 'invitation-prompt'],
} as const

/** Picks out contract sections, in document order, from rendered HTML. */
export function sectionOrderFromHtml(html: string): string[] {
    const order: string[] = []
    const regex = /data-testid="([^"]+)"/g
    let match: RegExpExecArray | null
    while ((match = regex.exec(html))) {
        const testId = match[1]!
        if ((CARD_PAGE_TESTIDS as readonly string[]).includes(testId)) {
            order.push(testId)
        }
    }
    return order
}

/** Picks out contract sections, in document order, from a DOM subtree. */
export function sectionOrderFromDom(root: ParentNode): string[] {
    return Array.from(root.querySelectorAll('[data-testid]'))
        .map((el) => el.getAttribute('data-testid') ?? '')
        .filter((testId) =>
            (CARD_PAGE_TESTIDS as readonly string[]).includes(testId)
        )
}
