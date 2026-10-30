/**
 * The site lives under the `/tarot-tutor/` URL path (on arcanegrain.dev,
 * proxied from GitHub Pages), so every root-relative link and asset path
 * goes through here to pick up Astro's `base`.
 */
export function withBase(path: string): string {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '')
    return `${base}${path}`
}
