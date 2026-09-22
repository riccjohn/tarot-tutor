# Invariants

Hard rules for this repo, with the reason each one exists. A rule without a
reason gets rationalised away at 2am, so every entry says what breaks.

These were previously enforced only inside a running agent session and were lost
when it ended. They are versioned here so they survive.

Some are mechanically enforced (tests, hooks); the rest are enforced by review.
The "Checked by" line says which.

---

## 1. The markup contract is frozen

Every `data-testid`, every `data-*` attribute, and the DOM order of card
sections. New wrappers **wrap**; they never reorder.

**Why:** tests assert on these and never on CSS classes. That is the only reason
a total visual overhaul — light editorial parchment to dark candlelit
grimoire — was able to ship without touching a test. Break the contract and you
lose the ability to restyle safely, permanently.

**Checked by:** the full test suite, on every gate.

The canonical section order per card kind lives in
`src/pages/__tests__/section-order-contract.ts`.

## 2. Tracked test files are immutable

Create new test files freely. Never edit, rewrite or delete a tracked one.

**Why:** a failing tracked test means the implementation drifted from the
contract. Editing the assertion instead makes the drift invisible — the diff
reads as a routine test update, and review misses it.

**Checked by:** `.claude/hooks/guard-tracked-tests.sh` (PreToolUse, blocks).

## 3. Colour literals live only in `global.css`

No hex, no `oklch()`, no named colours in `.astro` or `.tsx` files.

**Why:** `src/styles/global.css` maps a base palette onto semantic aliases
(`--color-paper`, `--color-ink`, `--color-accent`…) precisely so a future
direction change is a remap in one file rather than a repo-wide find-and-replace.
One stray literal in a component silently opts that component out.

**Checked by:** review today. Candidate for `scripts/lint-invariants.sh`:

```sh
grep -rnE '#[0-9a-fA-F]{3,6}\b|oklch\(' src/components src/pages
```

## 4. "Rider-Waite" never appears in output

**Why:** trademark. The scans are used, the name is not.

**Checked by:** `cards-index.test.ts` and `card-page.test.ts`, which assert it
across all 78 card pages.

## 5. Gilt is for large text and decoration only

`--color-gilt-400` on headings 40px and up, ornament, and rules. Body copy is
bone.

**Why:** gilt on bone at small sizes is legible but thin and cheapens the set.
The palette reserves it deliberately.

**Status: partially violated, decision pending.** See `docs/decisions.md` — gilt
is currently used on nav, links and buttons. It passes contrast at 7.12:1, so
this is a taste call, not an accessibility one.

## 6. Copy stays in the plain register

**Why:** the voice guide rejects mystical-earnest writing. The site teaches; it
does not perform divination. All the occult atmosphere is carried by visuals, so
the prose can stay honest and plain.

Copy changes are their own deliberate task — never a side effect of a styling or
refactoring change.

## 7. The free-pull view never shows an ISO date

Decorative dates use `romanDate` or a readable format. `YYYY-MM-DD` never
reaches the free-pull UI.

**Why:** a free pull is explicitly not tied to a calendar day, unlike the daily
draw. Showing a machine date implies a dailyness the feature does not have.

## 8. The reveal toggles state only

The daily card starts face-down. The full contract markup is **always in the
DOM** — revealing flips state, it does not mount sections.

**Why:** if reveal mounted the sections, every contract assertion would depend on
a click, and the no-JS path would render an empty page. `<noscript><style>`
forces the revealed state so the card is visible without JavaScript.

**Gotcha:** React 19 never materialises client-rendered children in SSR output.
A test asserting the noscript path must assert against **SSR markup**, not
rendered children. This cost one debugging session already.

## 9. Accessibility floor

- Ornaments are `aria-hidden`.
- `:focus-visible` is a solid 2px bone/gilt outline with offset — never removed,
  never a faint glow.
- Focus moves to the card name after reveal.
- `prefers-reduced-motion` means instant swaps, not merely faster ones.
- The no-JS fallback shows the card.

**Why:** the design is dark, low-contrast by nature and motion-heavy. Each of
these is the thing that keeps that from excluding people.

Contrast measurements: see the session record for the design overhaul.

## 10. Performance constraints

- Grain is a **baked** PNG tile. No live full-viewport SVG filters — they cost
  whole frames on mobile.
- Thumbnails are 160/320w AVIF with correct `sizes`.
- Fonts are self-hosted and preloaded through the Astro Fonts API. Never a
  Google Fonts `<link>`.
- The card back is a small inline SVG.
- No `ClientRouter`.

## 11. Build and platform

- Output is `static`. Nothing may require a server at runtime — the same `dist/`
  is meant to wrap unchanged inside Capacitor for iOS/Android.
- Fonts are configured as a **top-level `fonts:`** array in `astro.config.mjs`.
  Not `experimental.fonts` — that is the pre-stable location and does nothing on
  Astro 7.
- `--aspect-card` is `1110 / 1920`. The scans are that ratio; `5 / 8` is wrong
  and was a real bug.
- Reversed art rotates 180° on the **art layer**, not the flip container.
  Rotating the container fights the reveal animation.

## 12. Mobile-first

Everything targets a small screen by default. Wider layouts are opt-in via
`min-width` queries, never `max-width`.
