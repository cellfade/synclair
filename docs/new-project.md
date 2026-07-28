# Starting a new project with Synclair

> **Cellfade internal path:** use the authenticated GitHub CLI for foundation
> access: `gh repo clone cellfade/synclair <foundation-checkout>`. The public npm
> package named `synclair` is unrelated and must not be used. For an actual new
> product, follow the reviewed [manual Option A pilot](pilot-option-a.md) rather
> than turning a foundation checkout into the product repository.

This is the fresh-seed path: create a new product, place its selected frontend at
`apps/web`, and embed Synclair at `synclair/`. The product and collaboration hub
share one GitHub repository but remain separate applications with independent
dependencies, verification, and Vercel roots.

Adopting Synclair onto code that already exists instead? See
[`existing-project.md`](existing-project.md). The topology and delivery axes are
defined in [`setup-modes.md`](setup-modes.md).

## 1. Capture the setup before scaffolding

Run the repository-contained `project-bootstrap` skill. It interviews for the
product, framework, layout, Option A or Option B delivery, embedded or watcher
topology, update policy, private GitHub repository, and Vercel preview boundary.

Review and commit the resulting `synclair.project.json` with the governance
seed. For the common Option A path it must declare:

- `application.layout: "apps/web"`;
- `synclair.topology: "embedded"`;
- `synclair.path: "synclair"`;
- `synclair.delivery.strategy: "mainline"`;
- the foundation's exact 40-character commit SHA;
- private visibility, PR review, preview required, production auto-deploy off.

## 2. Seed governance first

Create the private product repository only after explicit approval. Put README,
repository rules documentation, CI shell, CODEOWNERS, and
`synclair.project.json` on initial `main` before any application code.

Create `codex/synclair-setup` from that exact seed SHA. The application scaffold
and Synclair installation belong on this setup branch and reach `main` only
through a human-reviewed pull request.

## 3. Scaffold the product at `apps/web`

Use the one framework recorded in the manifest: Vite + React, Next.js, Astro, or
an explicitly documented adapter. Commit its lockfile and fixed lint, typecheck,
unit, build, and smoke commands.

The first pilot creates only a shell, navigation, and one representative route.
Do not invent backend, auth, database, billing, or extra product scope merely to
exercise the foundation.

## 4. Add the immutable foundation

Resolve the approved foundation revision to `FOUNDATION_SHA`; never install from
`main`, `latest`, or another mutable name.

```bash
git subtree add \
  --prefix synclair \
  https://github.com/cellfade/synclair.git \
  "$FOUNDATION_SHA" \
  --squash
```

Authenticated HTTPS access can be connected with `gh auth setup-git`. Never put
a credential in the remote URL, manifest, or command history.

Reset the neutral seed before recording the project topology, and pass the exact
foundation revision so the embedded checkout keeps the correct upstream
baseline:

```bash
synclair/scripts/synclair-reset.sh synclair --yes --foundation-commit "$FOUNDATION_SHA"
```

Reseed the project content, then record `synclair/data/setup.json` as `embedded`
and generate the small ambient doorway at the product root:

```bash
node synclair/scripts/record-setup-mode.mjs embedded
node synclair/scripts/bridge-agents.mjs
```

The full skills and agents remain pinned in `synclair/.claude/`. Foundation
updates use reviewed subtree/update pull requests; do not run the clone-oriented
`synclair-sync.sh` inside a subtree.

## 5. Reseed Synclair

Reseed the product-facing hub content after the reset in step 4:

| Reseed | Location |
|---|---|
| Identity | `synclair/lib/system/seed/project.ts` and embedded hub package metadata |
| Theme | `synclair/app/globals.css` and `synclair/lib/system/seed/brand-ramps.ts` |
| Surfaces | `synclair/lib/system/seed/surfaces.ts`, pointing at `../apps/web` |
| Knowledge | `synclair/lib/system/knowledge/sources.ts` and root `AGENTS.md` pointers |
| Domain | Optional project-specific skill and agent inside the product-owned seed layer |

The foundation's Brain, adapter seam, hub shell, registry, and neutral skills
carry over. Brand, identity, product knowledge, catalogs, reports, and domain
rules are fresh project seed and do not sync upstream.

## 6. Bootstrap and verify

Install checksum-pinned local verification tools explicitly; they are not
downloaded during `postinstall`:

```bash
npm --prefix synclair ci
npm --prefix synclair run bootstrap:project
npm --prefix synclair run verify:synclair
```

`verify:synclair` checks the installed hub without applying the mother
repository's neutral-seed or immutable-release-manifest assertions. Those
assertions remain exclusive to `verify:foundation` in `cellfade/synclair`.
Likewise, `bootstrap:project` installs the checksum-pinned local verification
tools without rebuilding the mother repository's release manifest.

Run the product gates separately from `apps/web`; the manual pilot does not yet
claim the control plane's future aggregate `verify:product` / `verify:synclair`
root commands.

Run the product's committed gates from `apps/web` independently. Start the hub:

```bash
npm --prefix synclair run dev
```

Inspect `http://localhost:4100/synclair`, including navigation, search, mobile,
and console health. The standalone hub's `/` redirects to `/synclair`; the
product itself is served from `apps/web` by its own framework and deployment.

## 7. Review, preview, and stop

After explicit approval, push `codex/synclair-setup` and open a pull request.
After a separate approval, use the pinned CLI preview procedure in the pilot
runbook: defer Git integration, bind and read back the approved project identity,
deploy `apps/web` without `--prod`, and review the exact-head-SHA preview.

Stop with an open, reviewed PR and verified preview. Merge and production
promotion require their own later approvals. See
[`pilot-option-a.md`](pilot-option-a.md) for the full evidence and pass criteria.
