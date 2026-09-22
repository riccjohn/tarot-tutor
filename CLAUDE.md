# daily-tarot

A secular tarot **teaching** site: no fortune-telling voice, no accounts, no
backend. Static Astro output, published as a web PWA. The same `dist/` is
intended to wrap unchanged inside Capacitor for iOS/Android later, so nothing
may depend on a server at runtime.

This file holds only what you cannot learn by reading the code. The code is
heavily commented and explains its own _why_ — `src/styles/global.css`,
`src/content.config.ts`, `src/test-setup.ts` and `vitest.config.ts` in
particular. Read those rather than asking for them to be summarised here.

## The gate

Run all three before claiming any change is done. Together they take about ten
seconds, so there is no reason to skip them or to run only one.

```sh
pnpm check   # astro check + tsc — must report 0 errors (hints are fine)
pnpm test    # vitest run — 218 tests across 15 files
pnpm build   # 92 pages
```

A `Stop` hook runs the same three automatically and blocks on failure. It is
silent when they pass.

Run `pnpm prettier:write` before committing. Prettier owns Tailwind class order
and import order through plugins — never hand-sort either.

## The frozen markup contract

**This governs almost every change in this repo.**

Tests assert on `data-testid` and `data-*` attributes and on section DOM order —
never on CSS classes. That is deliberate: it is what let the entire visual
design be replaced without touching a test. The freedom is only real while the
markup holds still.

- Never rename, remove or reorder a `data-testid` or `data-*` attribute.
  New wrappers must **wrap** existing sections, never reorder them.
- **Never edit a tracked test file.** If a tracked test fails, the
  implementation drifted — fix the implementation. A `PreToolUse` hook blocks
  this. Creating a _new_ test file is fine. If you believe a tracked test
  encodes the wrong contract, stop and say so; do not route around the guard.
- Restyling is safe. Re-marking-up is not.

The contract sections and their per-kind order (pip / court / major) live in
`src/pages/__tests__/section-order-contract.ts`, shared by the Astro renderer
and both React islands because an Astro component cannot render inside a React
island.

The full rule list, with reasons, is in `docs/invariants.md`. Read it before any
styling, markup or content change.

## Test environments — never mix them in one file

| Subject             | Environment    | How                                                                       |
| ------------------- | -------------- | ------------------------------------------------------------------------- |
| `.astro` components | node (default) | `experimental_AstroContainer` + `linkedom`                                |
| React islands       | jsdom          | `// @vitest-environment jsdom` on line 1, `createElement` in a `.ts` file |

Mixing them in one file does not merely fail — it fails confusingly. Importing a
`.astro` component while a DOM global exists resolves it to the _client_ build,
where `isAstroComponentFactory` is undefined and `AstroContainer` throws
`NoMatchingRenderer`.

**Gotcha:** Vitest scans the whole file for the environment pragma, including
inside comments. A comment that quotes `@vitest-environment jsdom` silently
switches the file to jsdom. This has already cost one debugging session — if a
node-environment test starts throwing `NoMatchingRenderer`, grep the file for a
stray pragma in prose before suspecting anything else.

Vitest runs with `globals: false`: import `describe` / `it` / `expect`
explicitly. `src/test-setup.ts` explains why `cleanup` is registered by hand.

## Content

78 cards plus suit, number, rank, majors-arc, spread and learn collections, all
Zod-validated in `src/content.config.ts`. Everything lives in frontmatter, not
bodies. Every piece carries `status: draft | edited` and the UI marks drafts
honestly rather than passing them off as finished.

`DECK` in `src/lib/deck.ts` is `readonly Card[]` and `Object.freeze`d. Test
helpers must type against `readonly Card[]`, not `Card[]`.

## Copy voice

Plain register. The voice guide explicitly rejects mystical-earnest writing — the
occult atmosphere comes from visuals alone, never from the prose. New UI strings
stay plain and factual.

Do not change existing copy as a side effect of a styling or refactoring task.
Copy changes are their own task, made deliberately.

## Where things live

- `src/lib/` — deck, draw, spreads, ornament, images. Pure logic, property-tested
  with `fast-check`.
- `src/lib/content/compose.ts` — assembles a card page from its collection pieces.
- `src/components/islands/` — the only React. Everything else is `.astro`.
- `src/styles/global.css` — near enough the whole design system: an `@theme`
  token block plus rules keyed on `[data-testid=…]`. Colour literals belong here
  and nowhere else.
- `docs/invariants.md` — the hard rules, with reasons.
- `docs/decisions.md` — decisions made, and the ones still open.
