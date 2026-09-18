// @ts-check
import mdx from '@astrojs/mdx'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

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
})
