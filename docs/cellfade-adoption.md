# Cellfade Synclair foundation

This private repository is Cellfade's neutral Synclair foundation. It is not a
Cellfade product and must remain seed-free. Its job is to be the reviewed source
that every Cellfade project can clone or attach, while retaining an intentional
update path.

## Repository relationship

```text
joshuaiwata/synclair        public lineage
          │ reviewed merge
          ▼
cellfade/synclair           private Cellfade foundation
          │ clone, reseed, or subtree
          ▼
cellfade/<product>          private product repository
```

In the foundation checkout:

- `origin` is `cellfade/synclair`;
- `upstream` is `joshuaiwata/synclair`;
- Git authorship is configured locally as the `cellfade` GitHub user;
- project identity, brand, knowledge, catalogs, reports, routes, and setup mode
  remain blank.

In a downstream watcher or foundation checkout, `upstream` points to
`cellfade/synclair`. Embedded product repositories instead retain an explicit
subtree/update path pinned to reviewed foundation commits.

## Path 1 — create a new project from the foundation

Use the [`project-bootstrap`](../.claude/skills/project-bootstrap/SKILL.md)
interview and the [manual Option A pilot](pilot-option-a.md). The common layout
places the selected product framework at `apps/web`, installs the exact approved
foundation commit at `synclair/`, commits `synclair.project.json` with the
governance seed, and publishes application work only through the setup PR.

To inspect the private foundation source independently before the provider
boundary, use `gh repo clone cellfade/synclair <foundation-checkout>`. That
checkout is not the product repository.

## Path 2 — attach beside an existing project

From the existing project's parent directory:

```bash
gh repo clone cellfade/synclair <product-name>-synclair
cd <product-name>-synclair
git remote rename origin upstream
git config user.name cellfade
git config user.email 44656818+cellfade@users.noreply.github.com
scripts/synclair-reset.sh . --yes
node scripts/record-setup-mode.mjs watcher
```

Show `cellfade/<product-name>-synclair` and the planned private repository write.
After explicit approval, authenticate, create it, and immediately read back its
identity and visibility:

```bash
gh auth status
gh repo create cellfade/<product-name>-synclair \
  --private \
  --source=. \
  --remote=origin
gh repo view cellfade/<product-name>-synclair \
  --json nameWithOwner,visibility,defaultBranchRef
```

Stop if the reported owner or `visibility` is not exactly the approved private
target. Repository creation does not authorize a push, PR, merge, or deployment.

Reseed and run the existing-project intake against the sibling host repository.
The product repository remains untouched except for an optional pointer in its
`AGENTS.md`.

## Path 3 — attach inside an existing repository

Use a subtree so the product retains an explicit foundation update path:

```bash
cd <existing-product-repo>
git switch -c codex/add-synclair
git subtree add \
  --prefix synclair \
  https://github.com/cellfade/synclair.git \
  "$FOUNDATION_SHA" \
  --squash
```

Then:

1. keep `synclair/` out of the host's workspaces, TypeScript, lint, tests, and
   deployment inputs;
2. install its dependencies only from inside `synclair/`;
3. run `synclair/scripts/synclair-reset.sh synclair --yes
   --foundation-commit "$FOUNDATION_SHA"`;
4. reseed identity, brand, surfaces, and knowledge;
5. run `node synclair/scripts/record-setup-mode.mjs embedded`;
6. run `node synclair/scripts/bridge-agents.mjs` and commit the generated root
   agent doorways;
7. run existing-project intake using the host root;
8. verify both the host and Synclair independently.

Foundation updates use `git subtree pull --prefix synclair
https://github.com/cellfade/synclair.git "$FOUNDATION_SHA" --squash` from a
review branch after the target commit is reviewed.
Do not run the clone-oriented `synclair-sync.sh` inside a subtree.

## Foundation maintenance

Changes belong in this repository only when they are product-agnostic. Product
names, colors, domain rules, Figma data, routes, previews, reports, and knowledge
sources belong in downstream seed or adapter layers.

To review public-lineage updates in the foundation checkout:

```bash
git fetch upstream main
git switch -c codex/foundation-sync-YYYYMMDD
git merge upstream/main
npm ci
npm run verify-ui
```

Resolve and verify before merging into `main`. The sync helper deliberately does
not advance its call-home baseline while merge conflicts remain.

## Acceptance gate for the foundation

- `lib/system/seed/project.ts` retains the neutral `Your Product` identity.
- Brand ramps, knowledge sources, external catalogs, system maps, pages, and
  summaries are empty.
- `data/setup.json` remains unresolved in the foundation.
- No credentials, host paths, Figma IDs, personal paths, or product ports are
  committed.
- `npm run verify-ui` passes.
- The hub renders at `/synclair` on an available local port.
- Reset and sync helpers do not delete unrelated processes or record unresolved
  syncs as current.
- The private GitHub repository is owned by `cellfade`; commits use repository-
  local `cellfade` authorship without altering global Git identity.

## License

The inherited source is GPL-3.0-or-later. Keep the license and upstream notices,
and review distribution obligations before exposing a derivative outside
Cellfade.
