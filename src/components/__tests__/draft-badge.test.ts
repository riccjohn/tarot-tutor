import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { parseHTML } from 'linkedom'
import { beforeAll, describe, expect, it } from 'vitest'
import type { PieceStatus } from '../../lib/content/compose'
import DraftBadge from '../DraftBadge.astro'

/**
 * Rendered-output contract for `DraftBadge` across the three content
 * statuses. The badge is a quiet note that a reading is not yet
 * human-reviewed: it shows for `draft` AND `review` with identical text, and
 * is absent for `edited`.
 *
 * Rendered with `experimental_AstroContainer` + `renderToString`, then
 * parsed with linkedom, as `card-presentation.test.ts` does, under the
 * default node environment.
 *
 * `PieceStatus` does not include 'review' until the implementation lands, so
 * the literal is cast.
 */

let container: Awaited<ReturnType<typeof AstroContainer.create>>

beforeAll(async () => {
    container = await AstroContainer.create()
})

async function renderBadge(status: PieceStatus) {
    const html = await container.renderToString(DraftBadge, {
        props: { status },
    })
    const doc = parseHTML(html).document
    return {
        html,
        badges: doc.querySelectorAll('[data-testid="draft-badge"]'),
    }
}

const DRAFT = 'draft' as PieceStatus
const REVIEW = 'review' as PieceStatus
const EDITED = 'edited' as PieceStatus

describe('DraftBadge', () => {
    it('renders exactly one badge for draft', async () => {
        const { badges } = await renderBadge(DRAFT)
        expect(badges).toHaveLength(1)
    })

    it('renders exactly one badge for review', async () => {
        const { badges } = await renderBadge(REVIEW)
        expect(badges).toHaveLength(1)
    })

    it('renders the same text for review as for draft', async () => {
        const draft = await renderBadge(DRAFT)
        const review = await renderBadge(REVIEW)

        const draftText = draft.badges[0]?.textContent?.trim() ?? ''
        expect(draftText.length).toBeGreaterThan(0)
        expect(review.badges[0]?.textContent?.trim()).toBe(draftText)
    })

    it('renders nothing for edited', async () => {
        const { badges, html } = await renderBadge(EDITED)
        expect(badges).toHaveLength(0)
        expect(html).not.toContain('data-testid="draft-badge"')
    })
})
