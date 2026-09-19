// @ts-check
import mdx from '@astrojs/mdx'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, fontProviders } from 'astro/config'

// https://astro.build/config
export default defineConfig({
    site: 'https://dailytarottutor.com',
    // Static output: the same build serves the web PWA and, later, wraps
    // unchanged inside Capacitor for iOS/Android.
    output: 'static',
    integrations: [mdx(), react(), sitemap()],
    vite: {
        plugins: [tailwindcss()],
    },
    // Grimoire Nocturne type system, self-hosted and preloaded through
    // Astro's built-in Fonts API rather than a Google Fonts <link>. See
    // src/styles/global.css for how each `cssVariable` is consumed.
    fonts: [
        {
            provider: fontProviders.google(),
            name: 'Cinzel',
            cssVariable: '--font-cinzel',
            // Small caps labels, numerals and nav: 400-600 covers it.
            weights: [400, 500, 600],
            styles: ['normal'],
            fallbacks: ['Georgia', 'serif'],
        },
        {
            provider: fontProviders.google(),
            name: 'Cormorant Garamond',
            cssVariable: '--font-cormorant',
            // Headings and card names run large and mostly italic.
            weights: [400, 500, 600, 700],
            styles: ['normal', 'italic'],
            fallbacks: ['Iowan Old Style', 'Palatino', 'serif'],
        },
        {
            provider: fontProviders.google(),
            name: 'Fraunces',
            cssVariable: '--font-fraunces',
            // Variable font: request the full weight axis so `380` (the
            // body's exact weight) and optical size can resolve directly
            // instead of snapping to the nearest static instance.
            weights: ['300 700'],
            styles: ['normal', 'italic'],
            fallbacks: ['Georgia', 'serif'],
        },
        {
            provider: fontProviders.google(),
            name: 'UnifrakturMaguntia',
            cssVariable: '--font-unifraktur',
            // Wordmark and lesson drop caps only — a single static weight.
            weights: [400],
            styles: ['normal'],
            fallbacks: ['serif'],
        },
    ],
})
