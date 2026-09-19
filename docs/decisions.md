# Decisions

Settled decisions worth not relitigating, and open ones an agent must not decide
on its own.

---

## Open

### Gilt on small text

**Status:** unresolved. Flagged by the design-overhaul session, never answered.

`--color-gilt-400` is currently applied to nav items, links and buttons. This
conflicts with the stated rule that gilt is reserved for large text and
decoration (`docs/invariants.md` §5).

It is **not** an accessibility problem — measured contrast is 7.12:1, comfortably
past AA. It is a taste call: gilt at small sizes reads thin, and spending the
accent everywhere costs it its weight where it matters.

A later commit (`d182bb0`, "Keep small text bone and drop the /draw lede") moved
some small text back to bone, so the intent appears to be _bone for small text_ —
but the rule and the CSS have not been reconciled.

**An agent must not resolve this by unilaterally restyling.** Ask.

### Repo naming

`package.json` says `daily-tarot`, the git remote says `tarot-tutor`, `README.md`
says `# tarot-tutor`, and `astro.config.mjs` publishes to `dailytarottutor.com`.
Four names for one project. Harmless today, confusing later. Not yet decided.

---

## Settled

### Design direction: "Grimoire Nocturne"

An engraved, candlelit manuscript set with editorial restraint — explicitly not a
jump-scare occult site and not a dashboard. Near-black ink ground, bone text,
tarnished gilt for large type and ornament, oxblood and verdigris held back for
rare emphasis. Per-suit accents appear only on sigils, numerals, eyebrows and
thumbnail frame rules.

Token values were **ported from the approved mockup**, not re-derived, so what
ships matches what was signed off.

### Tests assert on attributes, never on classes

Chosen so the visual design can change freely. This is the single highest-value
structural decision in the repo — it is what made a full restyle a safe
operation. See `docs/invariants.md` §1.

### Astro components under node, React islands under jsdom

Forced by Astro's dual build: importing a `.astro` component while a DOM global
exists resolves to the client build and throws `NoMatchingRenderer`. The two can
never share a test file, which is why
`src/pages/__tests__/section-order-contract.ts` exists as a shared module rather
than a shared test.

### Content lives in frontmatter, not bodies

Three short distinct fields per card across 78 files. Zod validation across all
of them is what catches the gaps a large drafting pass inevitably leaves — and it
only works on structured frontmatter.

### Static output, Capacitor-ready

No SSR, no runtime server. The mobile apps are meant to be the same `dist/`
wrapped, so a server dependency would be a one-way door.
