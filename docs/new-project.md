# Starting a new project from Synclair

> **Cellfade internal path:** clone the private foundation with
> `npx synclair new --cellfade-foundation <new-project>`. This temporary,
> explicit migration path clones only `cellfade/synclair` and wires it as
> `upstream`; bare `npx synclair new` fails closed while the private
> `@cellfade/create-synclair` factory is being released. The complete internal
> procedure is in [`cellfade-adoption.md`](cellfade-adoption.md).

> **Where this sits in the two axes** ([`setup-modes.md`](setup-modes.md)): this doc is
> the **fresh-seed** path — you reseed a brand/identity from scratch rather than intaking
> from existing code. It describes the common **embedded** bundle (the product grows
> inside the clone, one repo), but the *seeding* steps here are independent of topology.
> Adopting Synclair onto an app that already exists instead? See
> [`existing-project.md`](existing-project.md).

This is the **clone-and-prune** procedure — the operational half of
[`foundation-model.md`](foundation-model.md) §6. It replaces the old "carry a
snapshot" approach: a new project **clones the live Synclair foundation**, blanks
the seed, and reseeds. There is no snapshot to drift, because the procedure and
the foundation are the same repo.

The interactive version (interview → reseed → provision → memory → verify) is
driven by the global **`project-bootstrap`** skill; this doc is the mechanical
spine it follows.

## 1. Clone the foundation (keep its history)

```bash
npx synclair new --cellfade-foundation <new-project>
cd <new-project>
git remote add origin <the-project's-own-repo-url>   # when it exists; push here
```

The explicit temporary command clones the private
`https://github.com/cellfade/synclair.git` foundation and renames its `origin`
to `upstream`. Bare `new` never falls back to the public lineage.

The project's history begins on top of the foundation's — deliberate: shared
ancestry is what makes pulling future foundation updates an ordinary 3-way
merge (`scripts/synclair-sync.sh`, the `synclair-sync` skill) instead of a
hand-port. Don't `rm -rf .git`; that orphans the clone and every later sync
becomes an unrelated-histories slog.

## 2. Blank the seed

```bash
scripts/synclair-reset.sh . --yes
```

This resets exactly the seed inventory (foundation-model.md §8) — brand ramps,
knowledge sources, Figma data, the project's domain skill/agent, product-spec
digests — and leaves the Brain, adapters, Synclair-skin, and registered UI components
intact. The app still typechecks and runs (brand + knowledge just empty).

## 3. Declare the project surface

Declare the app's surface in `lib/system/seed/surfaces.ts`; `web-shadcn` is the
implicit default. The hub chooses a preview renderer per documented item with
`adapterFor(item.surface)`, so multiple surfaces can coexist. Token export,
project generation, and distribution use separate contracts. Synclair itself
stays Next + shadcn regardless (foundation-model.md §2).

## 4. Reseed (per §8)

| # | Reseed | Where |
|---|---|---|
| 1 | Identity | `lib/system/seed/project.ts` — `name` + `tagline` re-label Synclair's header (metadata derives from it) · then `package.json` name · `registry.json` homepage |
| 2 | Theme | `app/globals.css` semantic/brand tokens; add ramps to `lib/system/seed/brand-ramps.ts` |
| 3 | Domain | if domain-heavy, author `<domain>-domain` skill + `<domain>-advisor` agent; else skip |
| 4 | Knowledge | add real spec/PRD/Figma/deck sources to `lib/system/knowledge/sources.ts`; fill `/AGENTS.md` router pointers |
| 5 | Memory | seed a `project`-type memory + `MEMORY.md` pointer |

## 5. Provision & verify

- Skills/agents: keep the domain-neutral loadout (`build-view`, `component-library`,
  `product-spec`, `prd-retriever`, plus the neutral agents); import `shadcn`,
  `webapp-testing`, and Figma skills as needed.
- Connect MCP servers (Drive/Notion/Figma) so diggers can fetch — `claude mcp` /
  `/mcp` interactively, or claude.ai connector settings.
- `npm install && npm run dev` (port 4100). Load `/` (redirects to the hub) and
  Synclair: `/synclair`, `/synclair/components`, `/synclair/knowledge`,
  `/synclair/foundations`; confirm they render and the registry/knowledge lists are
  the new project's.

## What carries over vs. what's fresh

- **Carried (Brain + adapter + Synclair-skin):** token vocabulary, tiers, the docs
  contract + `Preview`/adapter seam, search, the knowledge-layer machinery
  (`AGENTS.md` router, manifest schema, `product-spec`, `prd-retriever`), the
  Synclair routes, and the registered UI components. This is the value the
  foundation carries between projects.
- **Fresh (seed):** brand, theme, domain knowledge, knowledge sources, identity.
  Reseeded per project; diverges freely with no sync back to Synclair.
