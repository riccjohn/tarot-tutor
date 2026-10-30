// @vitest-environment jsdom

import { act, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import DeckViewer from '../islands/DeckViewer'

/**
 * The deck viewer island, rendered into jsdom. Layout maths lives in
 * `src/lib/viewer.ts` and is covered there; this file checks the wiring a
 * reader actually touches — filters, zoom, tap-to-open and the compare
 * toggle — plus that the view survives a reload through the URL.
 *
 * File is `.ts` with `createElement`, matching the other island tests.
 */

function shownCardIds(): string[] {
    return Array.from(document.querySelectorAll('[data-card-id]')).map(
        (el) => el.getAttribute('data-card-id') ?? ''
    )
}

function renderViewer() {
    return render(createElement(DeckViewer))
}

beforeEach(() => {
    window.history.replaceState(null, '', '/')
})

describe('deck viewer: filters', () => {
    it('shows all 78 cards by default', () => {
        renderViewer()
        expect(shownCardIds()).toHaveLength(78)
    })

    it.each([
        ['Major', 22],
        ['Minor', 56],
        ['Wands', 14],
        ['Cups', 14],
        ['Swords', 14],
        ['Pentacles', 14],
    ])('narrows to %s', (label, count) => {
        renderViewer()
        fireEvent.click(screen.getByRole('button', { name: label }))
        expect(shownCardIds()).toHaveLength(count)
    })

    it('marks the active filter as pressed', () => {
        renderViewer()
        const cups = screen.getByRole('button', { name: 'Cups' })
        fireEvent.click(cups)
        expect(cups.getAttribute('aria-pressed')).toBe('true')
        expect(
            screen
                .getByRole('button', { name: 'All' })
                .getAttribute('aria-pressed')
        ).toBe('false')
    })
})

describe('deck viewer: single-card view', () => {
    it('opens the tapped card on its own', () => {
        renderViewer()
        fireEvent.click(
            screen.getByRole('button', { name: 'Three of Swords' })
        )
        expect(screen.getByTestId('one-up-title').textContent).toBe(
            'Three of Swords'
        )
        expect(screen.getByTestId('one-up-position').textContent).toBe(
            '53 of 78'
        )
    })

    it('zooms all the way in to one card, and back out to a grid', () => {
        renderViewer()
        const zoomIn = screen.getByRole('button', {
            name: 'Show fewer, larger cards',
        })
        fireEvent.click(zoomIn)
        fireEvent.click(zoomIn)
        expect(screen.queryByTestId('one-up-title')).not.toBeNull()
        expect((zoomIn as HTMLButtonElement).disabled).toBe(true)

        fireEvent.click(
            screen.getByRole('button', { name: 'Show more cards' })
        )
        expect(screen.queryByTestId('one-up-title')).toBeNull()
        expect(shownCardIds()).toHaveLength(78)
    })
})

describe('deck viewer: compare suits', () => {
    it('offers the compare layout only for the minor arcana', () => {
        renderViewer()
        expect(screen.queryByRole('button', { name: 'Compare suits' })).toBe(
            null
        )
        fireEvent.click(screen.getByRole('button', { name: 'Minor' }))
        expect(
            screen.queryByRole('button', { name: 'Compare suits' })
        ).not.toBeNull()
    })

    it('lines the four suits up rank by rank', () => {
        renderViewer()
        fireEvent.click(screen.getByRole('button', { name: 'Minor' }))
        fireEvent.click(screen.getByRole('button', { name: 'Compare suits' }))

        const rows = screen.getAllByTestId('compare-row')
        expect(rows.map((row) => row.getAttribute('data-suit'))).toEqual([
            'wands',
            'cups',
            'swords',
            'pentacles',
        ])
        for (const row of rows) {
            expect(
                row.querySelectorAll('[data-card-id]')[0]?.getAttribute(
                    'data-card-id'
                )
            ).toMatch(/^ace-of-/)
        }
    })
})

describe('deck viewer: URL state', () => {
    it('restores the view from the query string', async () => {
        window.history.replaceState(null, '', '/?f=cups&cols=1&card=two-of-cups')
        await act(async () => {
            renderViewer()
        })
        expect(screen.getByTestId('one-up-title').textContent).toBe(
            'Two of Cups'
        )
        expect(screen.getByTestId('one-up-position').textContent).toBe(
            '2 of 14'
        )
    })

    it('writes the view back to the URL', () => {
        renderViewer()
        fireEvent.click(screen.getByRole('button', { name: 'Wands' }))
        expect(window.location.search).toBe('?f=wands')
    })
})
