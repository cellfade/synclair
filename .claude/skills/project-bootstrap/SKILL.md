---
name: project-bootstrap
category: foundation
layer: foundation
version: 1.0.0
license: GPL-3.0-or-later
description: Run Synclair's repository-contained setup wizard for a new or existing frontend project. Use when asked to "run me through setup", start a private Cellfade application, choose Option A or Option B, or recreate and validate a setup from synclair.project.json. Collects the project, framework, topology, delivery, update, GitHub, and Vercel-preview decisions; writes the manifest before implementation; and stops at every external approval boundary.
---

# Project bootstrap

This is the manual pilot wizard. It makes setup repeatable now while the private
`@cellfade/create-synclair` factory remains unreleased. Never use the unrelated
public npm package named `synclair`.

## Non-negotiable boundaries

- Repositories are private and owned by `cellfade` unless the user explicitly
  changes the owner after a separate review.
- Prepare a governance seed on `main`, then put application and Synclair setup
  on a branch and open a pull request. Do not push application scaffolding
  directly to protected `main`.
- A Vercel preview is part of review. Merging, staging, and production promotion
  are separate events. Require explicit approval before production.
- Do not create a repository, change GitHub rules, link Vercel, open a PR,
  merge, deploy, promote, or delete provider resources until that exact external
  action is shown to and approved by the user.
- Resolve the foundation to an exact 40-character commit SHA. Never persist
  `main`, `latest`, or another mutable ref in the manifest.
- Never store tokens, credentials, provider connection IDs, or personal local
  paths in the manifest.

## Wizard interview

First choose an explicit new, empty local product-workspace directory. Confirm
the path, create it, initialize local `main`, and run the interview with that
directory as the target. Never write `synclair.project.json` into the neutral
foundation checkout. GitHub repository creation remains a later approval
boundary; a local workspace does not authorize it.

Ask one concise question at a time. Explain the recommended answer and record:

1. Product name, repository slug, one-sentence purpose, and whether this is a
   new application or an existing one.
2. Framework: `vite-react`, `nextjs`, `astro`, or `other` with an explicit
   adapter note. Recommend `vite-react` for a conventional client SPA and
   `nextjs` when server rendering or framework routes are product requirements.
3. Product layout: `apps/web` (recommended for a co-located Synclair hub) or
   `root` when an existing repository already requires it.
4. Delivery strategy:
   - **Option A — mainline:** Synclair and the product are reviewed together and
     live on `main`. This is the common default.
   - **Option B — overlay:** the full collaboration hub lives on the declared
     `synclair/overlay` review branch and only allowlisted product paths promote
     to `main`. This is experimental and requires its branch policy.
5. Topology: `embedded` when Synclair is inside the product repository, or
   `watcher` when a separate sibling repository observes an existing product.
   Topology is independent of Option A or Option B.
6. Foundation update mode: `manual`, `recommended` (default), or `automatic`.
   Automatic means “prepare a verified update PR”; it never means auto-merge or
   production deployment.
7. GitHub owner (default `cellfade`), private repository name, default branch,
   setup branch, and required human review.
8. Whether to prepare a Vercel preview (default yes), its product root, and the
   explicit stop-before-production rule.

Summarize the answers and ask for confirmation before writing files. Writing
the local manifest is reversible and does not authorize provider actions.

## Write the canonical manifest

Create `synclair.project.json` at the product repository root with this V1
shape. Fill every placeholder; use `null` only where shown.

```json
{
  "schemaVersion": 1,
  "project": {
    "name": "Product Name",
    "slug": "product-slug",
    "summary": "One sentence describing the product"
  },
  "repository": {
    "owner": "cellfade",
    "name": "product-slug",
    "visibility": "private",
    "defaultBranch": "main",
    "setupBranch": "codex/synclair-setup",
    "requirePullRequest": true
  },
  "application": {
    "lifecycle": "new",
    "framework": "vite-react",
    "layout": "apps/web",
    "rootDirectory": "apps/web"
  },
  "synclair": {
    "topology": "embedded",
    "path": "synclair",
    "delivery": {
      "strategy": "mainline",
      "overlayBranch": null,
      "overlayPolicy": null
    },
    "foundation": {
      "repository": "cellfade/synclair",
      "commit": "<verified 40-character lowercase foundation SHA>",
      "updateMode": "recommended"
    }
  },
  "deployment": {
    "provider": "vercel",
    "previewRequired": true,
    "productionAutoDeploy": false,
    "productionRequiresExplicitApproval": true
  }
}
```

For Option B set `strategy` to `overlay`, `overlayBranch` to
`synclair/overlay`, and choose `shared-merge` or `single-owner-rebase` as
`overlayPolicy`. Never rebase or rewrite `main`.

Validate before continuing:

- `visibility` is exactly `private`;
- the framework, layout, topology, strategy, and update mode are recognized;
- paths are repository-relative and contain no `..`;
- the foundation commit is an exact, nonzero 40-character SHA that resolves in
  the private `cellfade/synclair` repository;
- Option A has null overlay fields and Option B declares both overlay fields;
- preview is required, production auto-deploy is false, and production requires
  approval.

Run the executable validator from the foundation checkout before committing:

```bash
node <foundation-checkout>/scripts/validate-project-manifest.mjs \
  <product-workspace>/synclair.project.json \
  --verify-remote
```

After subtree installation, run the embedded copy with `--check-subtree` to
prove the manifest commit matches Git's `git-subtree-split` provenance. Commit
the confirmed manifest with the governance seed so setup can later be recreated
or validated from repository history.

## Manual execution order

1. Produce the manifest and a no-write action preview.
2. After approval, create the private GitHub repository with only the governance
   seed: README, repository rules documentation, CI shell, CODEOWNERS, and the
   committed manifest.
3. Prove the seed and protection state before any application branch is pushed.
4. Create the setup branch from the exact protected `main` SHA.
5. Scaffold only the declared framework and layout. Add one representative
   route; do not invent backend, auth, billing, or extra product scope.
6. Install Synclair using the exact foundation commit, reset the seed, reseed,
   then record the declared topology and generate ambient doorways.
7. Validate manifest/subtree provenance and run product and Synclair verification
   independently, then together.
8. Show the exact file plan and verification evidence before approval to push.
9. After approval, push the setup branch and open a human-reviewed PR.
10. After approval, use the pinned Vercel CLI for a preview-only deployment of
    the declared product root and inspect its exact head-SHA metadata. Defer Git
    integration until staged-production controls can be configured and read back.
11. Stop. Do not merge or promote production without new explicit approval.

## Recreate or validate

When `synclair.project.json` already exists, do not re-interview by default.
Read it, validate the invariants above, compare the repository tree and provider
plan with the manifest, and report drift. Recreate only into a new empty
directory or an explicit isolated worktree; never overwrite an existing
workspace. Update the manifest through a normal reviewed commit when a decision
changes.
