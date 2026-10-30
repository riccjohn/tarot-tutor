/**
 * The site is served from a subfolder on GitHub Pages
 * (`riccjohn.github.io/tarot-tutor/`), so every root-relative link and
 * asset path goes through here to pick up Astro's `base`.
 */
export function withBase(path: string): string {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '')
    return `${base}${path}`
}
