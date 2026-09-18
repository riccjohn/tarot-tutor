/**
 * Builds the responsive `<img>` attributes for a card from the Phase 3
 * image manifest (`src/data/card-images.json`) — never by globbing the
 * filesystem at render time. The manifest is the single source of truth
 * for which AVIF ladder rungs and JPEG fallback exist for each card.
 */

import cardImages from '../data/card-images.json'

type CardImageManifest = typeof cardImages
type ManifestEntry = CardImageManifest[keyof CardImageManifest]

export interface CardImageAttrs {
    /** `srcset` covering every AVIF ladder rung, e.g. "...-160.avif 160w, ...". */
    srcset: string
    sizes: string
    /** JPEG fallback `src`, for browsers that ignore `srcset`/`<picture>`. */
    src: string
    width: number
    height: number
}

/**
 * Looks up a card's manifest entry and shapes it into `<img>`-ready
 * attributes. Throws if the id has no manifest entry, since a card page
 * with no image is a build-time bug, not a runtime condition to handle.
 */
export function getCardImage(id: string): CardImageAttrs {
    const entry: ManifestEntry | undefined = (
        cardImages as Record<string, ManifestEntry>
    )[id]

    if (!entry) {
        throw new Error(`No card-images.json entry for card id "${id}"`)
    }

    const srcset = entry.avif
        .map((rung) => `${rung.src} ${rung.width}w`)
        .join(', ')

    return {
        srcset,
        sizes: '(min-width: 48rem) 320px, 45vw',
        src: entry.fallback.src,
        width: entry.fallback.width,
        height: entry.fallback.height,
    }
}
