/**
 * The single rename point for the product.
 *
 * The name is provisional. Every other file — layouts, pages, meta tags,
 * content — must reference these exports rather than spelling the name out,
 * so that changing it later is one edit here instead of a repo-wide find and
 * replace.
 */

/** The product name. The only place this string may be written literally. */
export const SITE_NAME = 'Daily Tarot Tutor'

/** One line describing what the site teaches, for meta tags and headers. */
export const SITE_TAGLINE =
    'Learn to read tarot structurally: suit, number and symbol, not memorized meanings.'

/** Canonical production URL, without a trailing slash. */
export const SITE_URL = 'https://dailytarottutor.com'
