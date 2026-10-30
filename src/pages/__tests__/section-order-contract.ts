/**
 * The locked card-section order, shared by the two React renderers that
 * emit it: `DailyDraw.tsx` and `FreePull.tsx`. The order is a product
 * requirement, so both are held to the sequences below.
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

/** Picks out contract sections, in document order, from a DOM subtree. */
export function sectionOrderFromDom(root: ParentNode): string[] {
    return Array.from(root.querySelectorAll('[data-testid]'))
        .map((el) => el.getAttribute('data-testid') ?? '')
        .filter((testId) =>
            (CARD_PAGE_TESTIDS as readonly string[]).includes(testId)
        )
}
