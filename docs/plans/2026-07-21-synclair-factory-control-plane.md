# Synclair Factory and Control Plane Implementation Plan

**Goal:** Deliver a repeatable local and hosted Cellfade-only system that creates
private frontend projects with a pinned Synclair foundation, real PR previews,
resumable automation, safe update PRs, and separate production approval.

**Architecture:** Preserve `cellfade/synclair` as the neutral portable foundation.
Create a private `cellfade/synclair-control-plane` modular monorepo containing a
pure generator, Vite/Next/Astro adapters, CLI, hosted Next.js control plane,
durable orchestration, Postgres persistence, GitHub integration, Vercel
integration, and sandboxed agent execution.

**Approach:** Two repositories with immutable release and compatibility
contracts. Git is authoritative for product configuration and generated content;
Postgres is authoritative for drafts, jobs, approvals, audit events, and observed
provider state.

**Approved design:**
[`2026-07-21-synclair-factory-control-plane-design.md`](2026-07-21-synclair-factory-control-plane-design.md)

## Repositories and paths

| Label | Remote | Local path |
|---|---|---|
| Foundation | `cellfade/synclair` | `/Users/andrewmiller/Documents/Claity Platform/cellfade-synclair` |
| Control plane | `cellfade/synclair-control-plane` | `/Users/andrewmiller/Documents/Claity Platform/synclair-control-plane` |
| Dogfood fixture | created by factory | `/private/tmp/synclair-dogfood-*` |

All paths below are relative to the repository named in each task.

## Execution rules

1. Create implementation branches with the `codex/` prefix.
2. Never modify or force-push protected `main` directly.
3. Use one isolated worktree per mutation agent.
4. No two agents own the same file in a parallel round.
5. Run tests before and after every implementation slice.
6. Provider mutations require an idempotency key and a recorded audit event.
7. Agents and sandboxes never receive GitHub, Vercel, database, or production
   credentials.
8. Repository creation, PR creation, deployment staging, and production
   promotion are reported as separate external boundaries.
9. Automatic update work stops at a verified PR.
10. Production promotion always identifies the exact staged deployment and SHA.

## Authoritative dependency order

Phase numbers group concerns; this dependency order controls execution and
supersedes any apparent numeric ordering:

1. account/provider capability preflight;
2. construct and publish an immutable foundation release;
3. create a runnable control-plane governance seed, push it once, prove CI, and
   protect `main`;
4. project/lock/resolved-input schemas;
5. deterministic generator kernel;
6. framework adapters and immutable foundation source;
7. complete generation composer and local artifact CLI;
8. provider-neutral persistence, SecretStore, audit, and application ports;
9. concrete GitHub/Vercel adapters and authenticated webhook ingress;
10. durable bootstrap/update/production coordinators and worker runtime;
11. local end-to-end CLI delivery and hosted control-plane UI;
12. updates, overlay operations, controlled production, dogfood, and audits.

Concrete provider code must not begin before the persistence, SecretStore, and
application-port contracts pass. Hosted mutation mode must not enable unless a
production job transport and sandbox capability pass live preflight.

## Verification tiers

- **PR-fast:** format, lint, typecheck, unit, package build, schema, secret scan,
  and golden determinism. No provider credentials.
- **Provider/nightly:** disposable private GitHub/Vercel fixtures, protected
  previews, webhook/revocation, and bot-author preview behavior.
- **Release:** security, browser acceptance, reliability, restore, rollback,
  Option A/Option B, staged-production, and independent audits.

Commands referenced below must be declared in the root `package.json` before a
task may invoke them. Provider/release commands consume recorded IDs from test
state; they never contain placeholder URLs.

## Phase 0 — Account and environment preflight

### Task 0.1: Record the execution preflight contract

**Repository:** Foundation

**Files:**
- Create: `docs/control-plane/preflight.md`
- Test: `scripts/check-control-plane-docs.mjs`

**Steps:**
1. Write a failing check for the required GitHub owner, private visibility,
   Vercel scope, Node version, pnpm version, and external-write boundaries.
2. Run the check and confirm it fails because the document is absent.
3. Add the preflight document without any credential values.
4. Run the check and confirm it passes.

**Verification:** `node scripts/check-control-plane-docs.mjs`

### Task 0.2: Repair GitHub CLI authentication for Cellfade

**Repository:** None; local credential setup only

**Files:** None

**Steps:**
1. Run `gh auth status` and record only account/status, never tokens.
2. Authenticate the intended Cellfade account through the browser/device flow.
3. Verify `gh api user --jq '{id,login}'` resolves the intended immutable ID.
4. Verify a read-only query to `cellfade/synclair` succeeds.

**Verification:** `gh auth status && gh repo view cellfade/synclair --json nameWithOwner,visibility`

### Task 0.3: Confirm Vercel scope and plan capabilities

**Repository:** Foundation plus provider preflight

**Files:**
- Create: `scripts/probe-vercel-capabilities.mjs`
- Create: `config/vercel-capability-policy.json`
- Create: `tools/vercel-cli.version`
- Modify: `package.json`

**Steps:**
1. Record the authenticated Vercel user/team identifier.
2. Confirm the target team for the private control plane.
3. Pin the exact Vercel CLI version used by the probe; reject unpinned or
   different installed versions.
4. Confirm preview protection, staged production, Sandbox, Queue/Workflow, and
   database capabilities available on the plan through read-only calls.
5. Record unavailable features as adapter fallbacks in the preflight report.

**Verification:** `npx vercel whoami` followed by the read-only capability probe
`node scripts/probe-vercel-capabilities.mjs --check-only`

### Task 0.3a: Resolve the Cellfade owner type and immutable identity

**Repository:** Foundation plus provider preflight

**Files:**
- Create: `docs/plans/control-plane-preflight.md`

**Steps:**
1. Resolve `cellfade` through GitHub and record numeric account ID and owner type.
2. If it is a user, require the numeric-user allowlist.
3. If it is an organization, require numeric org ID and live operator-team
   membership checks.
4. Fail the preflight if ownership cannot be resolved unambiguously.

**Verification:** `gh api users/cellfade --jq '{id,login,type}'`

### Task 0.4: Establish a no-secret baseline

**Repository:** Foundation

**Files:**
- Create: `.gitleaks.toml`
- Create: `tools/gitleaks.version`
- Create: `tools/gitleaks.sha256`
- Create: `tools/install-gitleaks.mjs`
- Create: `scripts/check-secrets.mjs`
- Create: `test/fixtures/secrets/fake-github-token.txt`
- Modify: `package.json`

**Steps:**
1. Install one checksum-pinned Gitleaks binary into `tools/bin/` and reject a
   version or checksum mismatch.
2. Keep an inert fixture containing a deliberately fake forbidden credential
   shape and prove the negative-fixture invocation fails without ever scanning
   a live credential.
3. Exclude that named fixture only from the clean-tree scan, while a dedicated
   negative test scans it explicitly and requires a nonzero result.
4. Add `check:secrets` to the aggregate verification gate and confirm the clean
   foundation passes.

**Verification:** `npm run check:secrets && npm run verify-ui`

## Phase 1 — Foundation release contract

### Task 1.1: Define the foundation release schema

**Repository:** Foundation

**Files:**
- Create: `schemas/foundation-release.schema.json`
- Create: `data/foundation-release.template.json`
- Test: `scripts/check-foundation-release.mjs`

**Steps:**
1. Write failing assertions for schema version, repository identity,
   compatible project schema, compatible generator range, license, payload
   classes, and owned-file manifest.
2. Add the JSON schema.
3. Add a neutral source template that contains no self commit or release hash.
4. Run the checker until all assertions pass.

**Verification:** `node scripts/check-foundation-release.mjs`

### Task 1.2: Generate the foundation-owned file manifest

**Repository:** Foundation

**Files:**
- Create: `scripts/build-foundation-manifest.mjs`
- Create: `config/foundation-payload-policy.json`
- Generated only: `dist/foundation-files.json`
- Test: `scripts/check-foundation-release.mjs`

**Steps:**
1. Add a failing test for normalized paths, SHA-256 hashes, and explicit
   classification as `foundation`, `agent-pack`, `project-seed-template`, or
   `runtime-template`.
2. Commit only a digest-free classification/include/exclude policy; do not
   commit a hashed file manifest inside the payload.
3. Generate `dist/foundation-files.json` outside the archive/payload digest
   graph; exclude all `dist/` release envelopes/manifests/archives and classify
   seed templates rather than omitting them.
4. Generate the manifest twice and assert byte-identical sorted output.

**Verification:** `node scripts/build-foundation-manifest.mjs --check`

### Task 1.3: Centralize Cellfade lineage metadata

**Repository:** Foundation

**Files:**
- Create: `lib/system/lineage.ts`
- Modify: `lib/system/mother.ts`
- Modify: `scripts/call-home.mjs`
- Modify: `scripts/synclair-sync.sh`
- Modify: `.claude/skills/synclair/SKILL.md`
- Modify: `.claude/skills/synclair-sync/SKILL.md`
- Test: `scripts/check-cellfade-foundation.mjs`

**Steps:**
1. Extend the existing gate to fail on any public mother-repo claim in the
   Cellfade execution path.
2. Add one machine-readable lineage source.
3. Update runtime, scripts, and documentation to derive from or match it.
4. Confirm the public upstream remains recorded only as lineage.

**Verification:** `npm run check:cellfade-foundation`

### Task 1.4: Guard the public-lineage CLI entrypoint during migration

**Repository:** Foundation

**Files:**
- Modify: `cli/bin/synclair.mjs`
- Modify: `cli/package.json`
- Modify: `cli/README.md`
- Create: `scripts/test-cli-deprecation.mjs`
- Test: `scripts/check-cellfade-foundation.mjs`

**Steps:**
1. Add a failing gate proving the private Cellfade repository cannot invoke a
   command that silently clones public upstream.
2. Make bare `new` exit nonzero with the future private-factory migration
   message, but provide a temporary explicit `new --cellfade-foundation` path
   that dry-runs/clones only `cellfade/synclair` and never public upstream.
3. Preserve read-only help/version behavior and document that the temporary
   private-clone path is removed only after Task 7.5 package smoke succeeds.
4. Verify bare `new` creates nothing, the temporary path resolves the private
   repository, and no private execution path resolves public upstream.

**Verification:** `node scripts/test-cli-deprecation.mjs`

### Task 1.5: Add a foundation release CI gate

**Repository:** Foundation

**Files:**
- Create: `.github/workflows/foundation-release.yml`
- Create: `tools/actionlint.version`
- Create: `tools/actionlint.sha256`
- Create: `tools/install-actionlint.mjs`
- Create: `scripts/check-workflows.mjs`
- Modify: `.github/workflows/verify.yml`
- Modify: `package.json`

**Steps:**
1. Add a local composite command for purity, release schema, manifest drift,
   secret scan, and existing UI verification.
2. Pin third-party Actions to reviewed full commit SHAs and install Actionlint
   from a recorded version/checksum.
3. Add pull-request and manual release validation.
4. Confirm the verification workflow contains no publish or deployment step.

**Verification:** `npm run verify:foundation`

### Task 1.6: Publish an immutable foundation release envelope

**Repository:** Foundation

**Files:**
- Create: `scripts/package-foundation-release.mjs`
- Create: `scripts/verify-foundation-release.mjs`
- Create: `scripts/verify-foundation-attestation.mjs`
- Create: `scripts/release-tag.mjs`
- Create: `.github/workflows/publish-foundation-release.yml`
- Create: `docs/control-plane/foundation-release.md`
- Modify: `package.json`
- Generated only: `dist/foundation-release.json`
- Generated only: `dist/foundation-files.json`
- Generated only: `dist/synclair-foundation.tar.gz`
- Generated only: `dist/release-tag.txt`

**Steps:**
1. Merge the verified source through a human-reviewed PR so the source commit is
   fixed.
2. From that exact commit, build the classified file manifest and archive.
3. Generate an envelope containing numeric repository ID, source commit,
   payload-manifest digest, archive digest, compatibility, and agent-pack
   subtree digest; the envelope is outside its own payload graph.
4. Attest the envelope and archive with GitHub Artifact Attestations using
   `actions/attest-build-provenance` pinned to a reviewed full commit SHA; trust
   only GitHub OIDC identity for
   `cellfade/synclair/.github/workflows/publish-foundation-release.yml`.
5. Accept only a manual workflow input matching `foundation-v<semver>`, prove it
   points to the fixed source commit, and emit it to `dist/release-tag.txt`.
6. After explicit release approval, create an immutable private tag/release and
   attach the envelope, manifest, archive, and tag record.
7. Download the release into a clean directory; run `gh attestation verify
   --repo cellfade/synclair` and verify numeric repository ID, workflow
   identity, digests, source commit, tag, and archive membership.

**Verification:** `npm run verify:foundation-release -- --tag-file dist/release-tag.txt`

### Task 1.7: Separate the existing preview adapter vocabulary

**Repository:** Foundation

**Files:**
- Modify: `lib/system/adapters/types.ts`
- Modify: `lib/system/adapters/index.ts`
- Modify: `lib/system/adapters/react-native.tsx`
- Modify: `lib/system/adapters/web-shadcn.tsx`
- Modify: `docs/foundation-model.md`
- Test: `scripts/check-cellfade-foundation.mjs`

**Steps:**
1. Add a failing architecture gate that prohibits generator packages from using
   the gallery preview adapter type.
2. Rename `PlatformAdapter` to `PreviewAdapter` or add an explicit deprecated
   alias with removal date.
3. Update current imports and documentation.
4. Confirm current hub previews remain green.

**Verification:** `npm run verify-ui`

## Phase 2 — Create and bootstrap the control-plane repository

### Task 2.1: Create the private repository and local checkout

**Repository:** Control plane

**Files:**
- Create: `README.md`
- Create: `.gitignore`
- Create: `.editorconfig`
- Create: `.node-version`
- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `pnpm-lock.yaml`
- Create: `tsconfig.base.json`
- Create: `eslint.config.mjs`
- Create: `vitest.workspace.ts`
- Create: `playwright.config.ts`
- Create: `test/setup.ts`
- Create: `scripts/check-repo.mjs`
- Create: `tools/actionlint.version`
- Create: `tools/actionlint.sha256`
- Create: `tools/install-actionlint.mjs`
- Create: `.github/CODEOWNERS`
- Create: `.github/pull_request_template.md`
- Create: `.github/SECURITY.md`
- Create: `.github/workflows/ci.yml`
- Create: `docs/architecture/README.md`
- Create: `docs/control-plane/preflight.md`

**Steps:**
1. Build and verify the complete local governance/toolchain seed before remote
   creation; define every root script used later.
2. Install a checksum-pinned Actionlint binary and validate the workflow.
3. Create `cellfade/synclair-control-plane` with private visibility and re-read
   numeric owner/repository IDs and visibility.
4. Configure repository-local Cellfade authorship.
5. Copy the approved, secret-free Phase 0 preflight record into the control
   plane repository and verify immutable provider IDs again before commit.
6. Commit and push the complete governance/toolchain seed to initial `main`.
7. Wait for the named CI check to run successfully once.

**Verification:** `gh repo view cellfade/synclair-control-plane --json visibility,defaultBranchRef`

### Task 2.2: Add repository governance

**Repository:** Control plane

**Files:**
- Test: `scripts/check-repo.mjs`

**Steps:**
1. Assert the initial `main` seed already contains ownership for workflows,
   auth, integrations, migrations, generator, and lock/schema files.
2. Assert the PR evidence template and read-only CI exist.
3. Assert every root verification command referenced by the plan resolves.
4. Record the successful initial CI check name for protection setup.

**Verification:** `./tools/bin/actionlint && pnpm run check:repo`

### Task 2.3: Protect `main`

**Repository:** Control plane

**Files:**
- Create: `tests/provider/github-protection.spec.ts`
- Modify: `package.json`

**Steps:**
1. Apply a ruleset requiring PRs, human approval, stale-review dismissal,
   latest-push and CODEOWNER approval, expected-source required checks,
   conversation resolution, no force pushes, no deletion, and no App bypass.
2. Disable auto-merge.
3. Read the policy back and compare every required field.
4. Perform the immediately available negative test proving a direct human push
   is rejected; require an empty bypass list in the API readback.
5. If any readback/negative test fails, mark bootstrap blocked and prohibit
   Vercel linking, branch publication, and PR creation.
6. Defer the App-authored direct-push negative test to Task 8.2a, when the
   registered App identity actually exists; protection is not considered fully
   proven for provider delivery until that later gate passes.

**Verification:** `pnpm test:provider:github-protection`

### Task 2.4: Create the implementation branch

**Repository:** Control plane

**Files:**
- Create: `scripts/check-implementation-branch.mjs`
- Modify: `package.json`

**Steps:**
1. Fetch protected `main`.
2. Create `codex/synclair-control-plane-foundation` from the exact seed SHA.
3. Record the exact base SHA in the first implementation PR description.
4. Assert the branch name and merge-base equal the recorded values.

**Verification:** `node scripts/check-implementation-branch.mjs --branch codex/synclair-control-plane-foundation --base "$(git rev-parse origin/main)"`

## Phase 3 — Project model and lock model

### Task 3.1: Add schema package skeleton

**Repository:** Control plane

**Files:**
- Create: `packages/project-model/package.json`
- Create: `packages/project-model/tsconfig.json`
- Create: `packages/project-model/src/index.ts`
- Create: `packages/project-model/src/types.ts`
- Test: `packages/project-model/src/index.test.ts`

**Steps:**
1. Add a failing import/export test.
2. Add the package and TypeScript project references.
3. Export empty versioned types.
4. Confirm workspace typecheck sees the package.

**Verification:** `pnpm --filter @cellfade/synclair-project-model test`

### Task 3.2: Implement `synclair.project.json` validation

**Repository:** Control plane

**Files:**
- Create: `packages/project-model/src/project-schema.ts`
- Create: `packages/project-model/schema/project-v1.json`
- Test: `packages/project-model/src/project-schema.test.ts`

**Steps:**
1. Add failing valid/invalid fixture tests.
2. Implement V1 schema with Zod and generated JSON Schema.
3. Reject public visibility, unknown owner, path traversal, mutable refs,
   unsupported framework, and production auto-deploy.
4. Confirm root and `apps/web` layouts validate.

**Verification:** `pnpm --filter @cellfade/synclair-project-model test -- project-schema`

### Task 3.3: Model mainline and overlay delivery

**Repository:** Control plane

**Files:**
- Modify: `packages/project-model/src/project-schema.ts`
- Test: `packages/project-model/src/delivery.test.ts`

**Steps:**
1. Add failing tests for mainline, shared overlay, and single-owner overlay.
2. Require merge refresh for shared overlays.
3. Permit rebase only for single-owner overlay and never on `main`.
4. Keep topology `embedded`; model overlay as delivery strategy.

**Verification:** `pnpm --filter @cellfade/synclair-project-model test -- delivery`

### Task 3.4: Implement lock-file validation

**Repository:** Control plane

**Files:**
- Create: `packages/project-model/src/lock-schema.ts`
- Create: `packages/project-model/schema/lock-v1.json`
- Test: `packages/project-model/src/lock-schema.test.ts`

**Steps:**
1. Add failing fixtures for mutable refs, duplicate paths, missing hashes, and
   unknown ownership.
2. Implement immutable version and managed-file records.
3. Validate normalized paths and SHA-256 values.
4. Export parse and serialize helpers.

**Verification:** `pnpm --filter @cellfade/synclair-project-model test -- lock-schema`

### Task 3.5: Add schema migrations and compatibility

**Repository:** Control plane

**Files:**
- Create: `packages/project-model/src/migrations.ts`
- Create: `packages/project-model/src/compatibility.ts`
- Test: `packages/project-model/src/migrations.test.ts`

**Steps:**
1. Add a failing no-op V1 migration test.
2. Add explicit unsupported-major errors.
3. Add generator/foundation compatibility range checks.
4. Confirm migrations are pure and deterministic.

**Verification:** `pnpm --filter @cellfade/synclair-project-model test -- migrations`

### Task 3.6: Make all plan-affecting wizard input canonical

**Repository:** Control plane

**Files:**
- Modify: `packages/project-model/src/project-schema.ts`
- Create: `packages/project-model/src/product-content-schema.ts`
- Test: `packages/project-model/src/product-content-schema.test.ts`

**Steps:**
1. Add failing tests showing product brief, visual direction, navigation, route,
   CTA, and empty-state copy change the resolved input hash.
2. Store those values directly in the manifest or in a committed canonical
   content file referenced by path and SHA-256.
3. Reject uncommitted, missing, secret-like, or extra product content.
4. Require unattended manifests to include all required plan-affecting input.

**Verification:** `pnpm exec vitest run packages/project-model/src/product-content-schema.test.ts`

### Task 3.7: Define immutable `ResolvedGenerationInput`

**Repository:** Control plane

**Files:**
- Create: `packages/project-model/src/resolved-generation-input.ts`
- Test: `packages/project-model/src/resolved-generation-input.test.ts`

**Steps:**
1. Define validated manifest bytes, canonical product-content bytes/hash, and
   exact generator, adapter, foundation, and agent-pack refs.
2. Require `agentPackRef === foundationRef` for V1.
3. Bind the canonical manifest digest into `ResolvedGenerationInput`. Exclude
   Clock, random IDs, timestamps, run IDs, and emitted manifest/lock operations
   only from recursive output hashing.
4. Prove the same input hashes identically on Linux and macOS CI.

**Verification:** `pnpm exec vitest run packages/project-model/src/resolved-generation-input.test.ts`

## Phase 4 — Deterministic generator core

### Task 4.1: Define generator ports and operations

**Repository:** Control plane

**Files:**
- Create: `packages/generator-core/package.json`
- Create: `packages/generator-core/src/ports.ts`
- Create: `packages/generator-core/src/operations.ts`
- Create: `packages/generator-core/src/index.ts`
- Test: `packages/generator-core/src/operations.test.ts`

**Steps:**
1. Add failing type-level and runtime operation tests.
2. Define workspace and immutable release/content-source ports; Clock, random ID,
   model calls, and provider state stay outside deterministic planning.
3. Define normalized write/remove operations with ownership and overwrite
   policy.
4. Assert the package has no provider, DB, shell, or UI dependency.

**Verification:** `pnpm --filter @cellfade/synclair-generator-core test`

### Task 4.2: Implement safe path normalization

**Repository:** Control plane

**Files:**
- Create: `packages/generator-core/src/repo-path.ts`
- Test: `packages/generator-core/src/repo-path.test.ts`

**Steps:**
1. Add lexical path traversal, absolute path, backslash, Unicode, and duplicate
   normalization tests.
2. Implement a branded `RepoPath` parser.
3. Reject all repository escapes.
4. Run property tests over generated path inputs; test symlink/realpath escape
   later at workspace and publisher boundaries.

**Verification:** `pnpm --filter @cellfade/synclair-generator-core test -- repo-path`

### Task 4.3: Implement deterministic plan hashing

**Repository:** Control plane

**Files:**
- Create: `packages/generator-core/src/plan.ts`
- Test: `packages/generator-core/src/plan.test.ts`

**Steps:**
1. Add failing ordering and cross-platform newline tests.
2. Canonicalize operation order and bytes.
3. Compute SHA-256 per file and for the plan.
4. Prove two equivalent inputs produce identical hashes.

**Verification:** `pnpm --filter @cellfade/synclair-generator-core test -- plan`

### Task 4.4: Implement managed-file conflict detection

**Repository:** Control plane

**Files:**
- Create: `packages/generator-core/src/managed-files.ts`
- Test: `packages/generator-core/src/managed-files.test.ts`

**Steps:**
1. Add tests for untouched, user-modified, missing, and obsolete managed files.
2. Compare workspace hashes with lock baselines.
3. Produce conflict diagnostics without writes.
4. Require explicit overwrite policy for every operation.

**Verification:** `pnpm --filter @cellfade/synclair-generator-core test -- managed-files`

### Task 4.5: Implement plan/apply/verify engine

**Repository:** Control plane

**Files:**
- Create: `packages/generator-core/src/engine.ts`
- Test: `packages/generator-core/src/engine.test.ts`

**Steps:**
1. Add failing in-memory workspace tests.
2. Implement generic side-effect-free operation validation and plan hashing,
   not complete bootstrap/update composition.
3. Apply only the validated operation list.
4. Verify final file hashes and return structured evidence.

**Verification:** `pnpm --filter @cellfade/synclair-generator-core test -- engine`

### Task 4.6: Add deterministic model-content boundary

**Repository:** Control plane

**Files:**
- Create: `packages/generator-core/src/canonical-content.ts`
- Test: `packages/generator-core/src/canonical-content.test.ts`

**Steps:**
1. Consume only canonical content bytes from `ResolvedGenerationInput`.
2. Reject extra routes, backend/auth instructions, commands, paths, and secrets.
3. Prove no model call can occur during `plan()`.
4. Treat any earlier model output as ordinary committed, reviewed input bytes.

**Verification:** `pnpm exec vitest run packages/generator-core/src/canonical-content.test.ts`

## Phase 5 — Framework adapters and golden projects

### Task 5.1: Define the framework adapter contract

**Repository:** Control plane

**Files:**
- Create: `packages/framework-adapters/package.json`
- Create: `packages/framework-adapters/src/types.ts`
- Create: `packages/framework-adapters/src/index.ts`
- Create: `packages/framework-adapters/templates/common/.github/workflows/ci.yml`
- Test: `packages/framework-adapters/src/contract.test.ts`

**Steps:**
1. Add a failing fake-adapter contract test.
2. Define validation, file planning, fixed commands, and acceptance probes.
3. Require root and `apps/web` layout support.
4. Require every adapter to declare toolchain versions.
5. Create the shared credential-free, read-only PR CI shell with pinned Actions
   and the exact required-check name needed by the composer and golden fixtures;
   provider/update specialization remains Task 8.7.

**Verification:** `pnpm --filter @cellfade/synclair-framework-adapters test -- contract`

### Task 5.2: Implement Vite + React file plan

**Repository:** Control plane

**Files:**
- Create: `packages/framework-adapters/src/vite-react.ts`
- Create: `packages/framework-adapters/templates/vite-react/package.json.tpl`
- Create: `packages/framework-adapters/templates/vite-react/pnpm-lock.yaml.tpl`
- Create: `packages/framework-adapters/templates/vite-react/vite.config.ts.tpl`
- Create: `packages/framework-adapters/templates/vite-react/tsconfig.json.tpl`
- Create: `packages/framework-adapters/templates/vite-react/src/main.tsx.tpl`
- Create: `packages/framework-adapters/templates/vite-react/src/App.tsx.tpl`
- Create: `packages/framework-adapters/templates/vite-react/src/styles.css.tpl`
- Create: `packages/framework-adapters/templates/vite-react/src/App.test.tsx.tpl`
- Create: `packages/framework-adapters/templates/vite-react/vercel.json.tpl`
- Test: `packages/framework-adapters/src/vite-react.test.ts`

**Steps:**
1. Add failing tree snapshots for both layouts.
2. Generate TypeScript app shell, navigation, tokens, and representative route.
3. Add fixed lint, typecheck, unit, build, and smoke commands.
4. Pin exact dependency versions, emit a committed lockfile, use
   `pnpm --frozen-lockfile`, and configure root/deploy ignores for Synclair.

**Verification:** `pnpm --filter @cellfade/synclair-framework-adapters test -- vite-react`

### Task 5.3: Prove the Vite golden fixture

**Repository:** Control plane

**Files:**
- Create: `fixtures/golden/vite-react/**`
- Create: `scripts/verify-golden.mjs`

**Steps:**
1. Generate the fixture from a fixed manifest.
2. Run install, lint, typecheck, tests, build, and route smoke.
3. Regenerate and assert no diff.
4. Add both layouts to the CI matrix.

**Verification:** `pnpm verify:golden vite-react`

### Task 5.4: Implement Next.js file plan

**Repository:** Control plane

**Files:**
- Create: `packages/framework-adapters/src/nextjs.ts`
- Create: `packages/framework-adapters/templates/nextjs/package.json.tpl`
- Create: `packages/framework-adapters/templates/nextjs/pnpm-lock.yaml.tpl`
- Create: `packages/framework-adapters/templates/nextjs/next.config.ts.tpl`
- Create: `packages/framework-adapters/templates/nextjs/tsconfig.json.tpl`
- Create: `packages/framework-adapters/templates/nextjs/app/layout.tsx.tpl`
- Create: `packages/framework-adapters/templates/nextjs/app/page.tsx.tpl`
- Create: `packages/framework-adapters/templates/nextjs/app/globals.css.tpl`
- Create: `packages/framework-adapters/templates/nextjs/app/page.test.tsx.tpl`
- Create: `packages/framework-adapters/templates/nextjs/vercel.json.tpl`
- Test: `packages/framework-adapters/src/nextjs.test.ts`

**Steps:**
1. Read the installed Next.js version’s bundled migration/convention docs.
2. Add failing tree snapshots for both layouts.
3. Generate the app shell, tokens, navigation, route, and tests.
4. Add exact dependency pins, committed lockfile, frozen install, fixed gates,
   and root/deploy exclusions for Synclair.

**Verification:** `pnpm --filter @cellfade/synclair-framework-adapters test -- nextjs`

### Task 5.5: Prove the Next.js golden fixture

**Repository:** Control plane

**Files:**
- Create: `fixtures/golden/nextjs/**`

**Steps:**
1. Generate the fixture from the fixed manifest.
2. Run the full adapter gate.
3. Regenerate and assert no diff.
4. Add both layouts to the CI matrix.

**Verification:** `pnpm verify:golden nextjs`

### Task 5.6: Implement Astro file plan

**Repository:** Control plane

**Files:**
- Create: `packages/framework-adapters/src/astro.ts`
- Create: `packages/framework-adapters/templates/astro/package.json.tpl`
- Create: `packages/framework-adapters/templates/astro/pnpm-lock.yaml.tpl`
- Create: `packages/framework-adapters/templates/astro/astro.config.mjs.tpl`
- Create: `packages/framework-adapters/templates/astro/tsconfig.json.tpl`
- Create: `packages/framework-adapters/templates/astro/src/layouts/AppLayout.astro.tpl`
- Create: `packages/framework-adapters/templates/astro/src/pages/index.astro.tpl`
- Create: `packages/framework-adapters/templates/astro/src/styles/global.css.tpl`
- Create: `packages/framework-adapters/templates/astro/src/pages/index.test.ts.tpl`
- Create: `packages/framework-adapters/templates/astro/vercel.json.tpl`
- Test: `packages/framework-adapters/src/astro.test.ts`

**Steps:**
1. Add failing tree snapshots for both layouts.
2. Generate the shell, tokens, navigation, representative route, and tests.
3. Add fixed lint, typecheck, unit, build, and smoke commands.
4. Preserve Astro-native conventions; pin dependencies, emit a lockfile, use
   frozen install, and exclude Synclair from product deploy inputs.

**Verification:** `pnpm --filter @cellfade/synclair-framework-adapters test -- astro`

### Task 5.7: Prove the Astro golden fixture

**Repository:** Control plane

**Files:**
- Create: `fixtures/golden/astro/**`

**Steps:**
1. Generate the fixed fixture.
2. Run the full adapter gate.
3. Regenerate and assert no diff.
4. Add both layouts to the CI matrix.

**Verification:** `pnpm verify:golden astro`

### Task 5.8: Add cross-adapter invariants

**Repository:** Control plane

**Files:**
- Create: `packages/framework-adapters/src/matrix.test.ts`

**Steps:**
1. Assert all adapters create only their product shell, navigation, one route,
   fixed commands, deploy exclusions, and acceptance probes.
2. Assert no adapter includes Synclair in the product deployment root.
3. Assert the unattended layout is `apps/web`.
4. Defer manifest, lock, foundation, and doorway assertions to the generation
   composer.
5. Assert no generated starter contains backend/auth/database/billing scaffolds
   or a second product route.

**Verification:** `pnpm --filter @cellfade/synclair-framework-adapters test -- matrix`

## Phase 6 — Foundation and agent-pack installation

### Task 6.0: Scaffold the generation application package

**Repository:** Control plane

**Files:**
- Create: `packages/generation-application/package.json`
- Create: `packages/generation-application/tsconfig.json`
- Create: `packages/generation-application/src/index.ts`

**Steps:**
1. Declare the already-created project-model, generator-core, and
   framework-adapters dependencies before any generation-application module is
   added; add foundation-source only in Task 6.7 after Task 6.1 creates it.
2. Export no provider SDK types and keep the initial composition entrypoint
   provider-neutral.
3. Prove the empty package typechecks in workspace order.

**Verification:** `pnpm --filter @cellfade/synclair-generation-application typecheck`

### Task 6.1: Add immutable foundation release client

**Repository:** Control plane

**Files:**
- Create: `packages/foundation-source/package.json`
- Create: `packages/foundation-source/src/release-source.ts`
- Create: `packages/foundation-source/src/fixture-release-source.ts`
- Create: `packages/foundation-source/src/filesystem-release-source.ts`
- Create: `packages/foundation-source/src/verify-release.ts`
- Create: `packages/foundation-source/src/index.ts`
- Test: `packages/foundation-source/src/verify-release.test.ts`

**Steps:**
1. Add failing tests for wrong repository ID, mutable ref, missing file, and hash
   mismatch.
2. Define a provider-neutral immutable-release byte source and test it with a
   local signed-release fixture; no provider credential or GitHub SDK is
   introduced in this phase.
3. Add a filesystem source that consumes a previously downloaded envelope,
   manifest, archive, tag record, and attestation bundle. It performs no network
   or authentication and accepts no mutable ref.
4. Validate every file against the release manifest and return bytes without
   writing a workspace.

**Verification:** `pnpm --filter @cellfade/synclair-foundation-source test`

### Task 6.2: Install mainline embedded Synclair

**Repository:** Control plane

**Files:**
- Create: `packages/generator-core/src/install-mainline.ts`
- Test: `packages/generator-core/src/install-mainline.test.ts`

**Steps:**
1. Add a failing expected-tree test.
2. Plan Synclair at the manifest path.
3. Exclude it from product build/deploy inputs.
4. Mark foundation-owned paths and hashes in the lock.

**Verification:** `pnpm --filter @cellfade/synclair-generator-core test -- install-mainline`

### Task 6.3: Install overlay Synclair

**Repository:** Control plane

**Files:**
- Create: `packages/generation-application/src/overlay-bundle.ts`
- Test: `packages/generation-application/src/overlay-bundle.test.ts`

**Steps:**
1. Define `GenerationBundle { mainPlan, overlayPlan, promotionAllowlist }`.
2. Keep product/governance/ambient-doorway truth in `mainPlan`.
3. Keep full hub/generated review artifacts in the overlay plan.
4. Define main lock plus overlay lock/superset with `baseMainSha` and overlay
   plan hash; branch mutation remains outside generation.

**Verification:** `pnpm exec vitest run packages/generation-application/src/overlay-bundle.test.ts`

### Task 6.4: Generate repository-contained agent doorways

**Repository:** Control plane

**Files:**
- Create: `packages/generator-core/src/agent-pack.ts`
- Test: `packages/generator-core/src/agent-pack.test.ts`

**Steps:**
1. Add failing tests for canonical `.claude` skills/agents and generated
   `.agents`, `.cursor`, and root `AGENTS.md` doorways.
2. Preserve foundation versus project ownership metadata.
3. Reject missing frontmatter and duplicate capabilities.
4. Assert regeneration is byte-identical.

**Verification:** `pnpm --filter @cellfade/synclair-generator-core test -- agent-pack`

### Task 6.5: Add product/Synclair independent verification

**Repository:** Control plane

**Files:**
- Create: `packages/framework-adapters/templates/common/scripts/verify-project.mjs`
- Modify: `packages/framework-adapters/src/matrix.test.ts`

**Steps:**
1. Add a failing fixture where product verification accidentally traverses
   Synclair.
2. Add separate `verify:product`, `verify:synclair`, and aggregate `verify`.
3. Assert product deploy ignores Synclair.
4. Run the full golden matrix.

**Verification:** `pnpm verify:golden:all`

### Task 6.6: Resolve compatible immutable releases before generation

**Repository:** Control plane

**Files:**
- Create: `packages/foundation-source/src/release-discovery.ts`
- Test: `packages/foundation-source/src/release-discovery.test.ts`

**Steps:**
1. Resolve numeric repository ID, immutable tag/SHA, attestation, and schema
   compatibility.
2. Interactive runs display and persist the exact selected refs.
3. Unattended runs reject missing or mutable refs.
4. Cache metadata only by immutable release digest.

**Verification:** `pnpm exec vitest run packages/foundation-source/src/release-discovery.test.ts`

### Task 6.7: Compose the complete generation plan

**Repository:** Control plane

**Files:**
- Create: `packages/generation-application/src/compose-project.ts`
- Create: `packages/generation-application/src/bootstrap.ts`
- Create: `packages/generation-application/src/update.ts`
- Modify: `packages/generation-application/src/index.ts`
- Modify: `packages/generation-application/package.json`
- Test: `packages/generation-application/src/compose-project.test.ts`

**Steps:**
1. Add the now-existing foundation-source dependency, then depend on
   project-model, generator kernel, adapters, and foundation source.
2. Compose product, brief/tokens, foundation, agent pack, manifest, branch locks,
   governance, CI, and deployment exclusions.
3. Return a `GenerationPlan` for mainline or `GenerationBundle` for overlay.
4. Assert ownership classes are non-overlapping and complete.

**Verification:** `pnpm exec vitest run packages/generation-application/src/compose-project.test.ts`

### Task 6.8: Prove local/hosted plan equivalence

**Repository:** Control plane

**Files:**
- Create: `packages/generation-application/src/equivalence.test.ts`

**Steps:**
1. Invoke the composer through local and hosted fake bindings.
2. Assert identical normalized plan/bundle hashes for all frameworks, layouts,
   and delivery modes.
3. Assert timestamps and run IDs are added after apply and excluded from plan
   hashes.
4. Run the equivalence test on Linux and macOS CI.

**Verification:** `pnpm exec vitest run packages/generation-application/src/equivalence.test.ts`

### Task 6.9: Add optional bounded model-content preparation

**Repository:** Control plane

**Files:**
- Create: `packages/product-content-provider/package.json`
- Create: `packages/product-content-provider/src/types.ts`
- Create: `packages/product-content-provider/src/prompt-v1.ts`
- Create: `packages/product-content-provider/src/prepare-content.ts`
- Test: `packages/product-content-provider/src/prepare-content.test.ts`

**Steps:**
1. Version the prompt and output schema.
2. Validate one route, bounded navigation/copy/tokens, timeout, and cost limits.
3. Fall back to wizard-entered content when no model provider is configured.
4. Require human review and commit canonical bytes before generation planning.

**Verification:** `pnpm exec vitest run packages/product-content-provider/src/prepare-content.test.ts`

## Phase 7 — Local artifact CLI

### Task 7.1: Add CLI package and dry-run command

**Repository:** Control plane

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/src/main.ts`
- Create: `packages/cli/src/commands/plan.ts`
- Test: `packages/cli/src/commands/plan.test.ts`

**Steps:**
1. Add a failing `--dry-run` mutation test.
2. Parse a manifest and print the normalized plan.
3. Guarantee no filesystem, Git, or network mutation.
4. Return nonzero on validation errors.

**Verification:** `pnpm --filter @cellfade/create-synclair test -- plan`

### Task 7.2: Implement the interactive wizard

**Repository:** Control plane

**Files:**
- Create: `packages/cli/src/commands/create.ts`
- Create: `packages/cli/src/wizard/questions.ts`
- Create: `packages/cli/src/wizard/answers.ts`
- Test: `packages/cli/src/wizard/questions.test.ts`

**Steps:**
1. Add a transcript test for product, starter, visual foundation, framework,
   layout, lifecycle, update mode, delivery, and review.
2. Default mainline, recommended updates, and `apps/web` unattended layout.
3. Require an explicit framework choice interactively.
4. Render the manifest and external action plan before confirmation.
5. Resolve and commit all exact release refs and canonical product content before
   invoking the generation composer. In local-only mode, require the immutable
   tag plus a local release-envelope directory and bind it through the verified
   filesystem source; the CLI itself performs no authenticated fetch.

**Verification:** `pnpm --filter @cellfade/create-synclair test -- wizard`

### Task 7.3: Implement local filesystem apply

**Repository:** Control plane

**Files:**
- Create: `packages/cli/src/adapters/local-workspace.ts`
- Create: `packages/cli/src/commands/apply.ts`
- Test: `packages/cli/src/commands/apply.test.ts`

**Steps:**
1. Add tests for new directory, nonempty directory, isolated worktree, and
   partial failure.
2. Permit writes only to a new empty directory or explicit isolated worktree.
3. Apply the exact operation list.
4. Clean a failed new directory only when it was created by the current run.

**Verification:** `pnpm --filter @cellfade/create-synclair test -- apply`

### Task 7.4: Implement CLI verify/recreate/update

**Repository:** Control plane

**Files:**
- Create: `packages/cli/src/commands/verify.ts`
- Create: `packages/cli/src/commands/recreate.ts`
- Create: `packages/cli/src/commands/update.ts`
- Test: `packages/cli/src/commands/lifecycle.test.ts`

**Steps:**
1. Add failing lifecycle tests against golden repositories.
2. Verify manifest/lock/content consistency.
3. Recreate into a separate directory and compare plan hashes.
4. Prepare update changes without merging.

**Verification:** `pnpm --filter @cellfade/create-synclair test -- lifecycle`

### Task 7.5: Package the private CLI

**Repository:** Control plane

**Files:**
- Modify: `packages/cli/package.json`
- Create: `packages/cli/README.md`
- Create: `.github/workflows/cli-release.yml`

**Steps:**
1. Package as private `@cellfade/create-synclair` or a private GitHub Release
   artifact.
2. Add provenance and checksum output.
3. After the approved Task 1.6 private release exists, download its four assets
   with authenticated `gh` outside the package, verify the GitHub attestation,
   and run install-and-execute smoke in a clean temporary directory through the
   filesystem release source. No fixture may satisfy this release gate.
4. Confirm the package contains no tokens or local paths.

**Verification:** `pnpm --filter @cellfade/create-synclair pack && pnpm test:cli-package`

### Task 7.5a: Complete the foundation CLI handoff

**Repository:** Foundation

**Files:**
- Modify: `cli/bin/synclair.mjs`
- Modify: `cli/README.md`
- Modify: `scripts/test-cli-deprecation.mjs`

**Steps:**
1. After Task 7.5's clean install-and-execute smoke is green, remove the
   temporary `new --cellfade-foundation` clone path.
2. Point the migration message to the exact private package/release install
   route and retain read-only help/version behavior.
3. Prove all foundation `new` invocations fail before filesystem mutation and
   the packaged factory CLI is the only supported creation route.

**Verification:** `node scripts/test-cli-deprecation.mjs`

This phase deliberately delivers deterministic local artifact generation. The
end-to-end local `deliver` command is added after provider and durable-workflow
ports exist in Task 10.14; the CLI does not duplicate provider logic.

## Phase 7B — Provider-neutral state, secrets, and capabilities

### Task 7B.0: Scaffold the Postgres persistence package

**Repository:** Control plane

**Files:**
- Create: `packages/persistence-postgres/package.json`
- Create: `packages/persistence-postgres/tsconfig.json`
- Create: `packages/persistence-postgres/src/client.ts`
- Create: `packages/persistence-postgres/src/schema.ts`
- Create: `packages/persistence-postgres/src/migration-runner.ts`
- Create: `packages/persistence-postgres/src/index.ts`
- Create: `packages/persistence-postgres/test/database.ts`
- Modify: `package.json`

**Steps:**
1. Create the package, disposable-test database harness, ordered migration
   runner, and root `db:migrate:test` command before any store implementation.
2. Require an explicit test database URL and reject production-like hosts.
3. Prove an empty migration set applies and rolls back in a disposable database.

**Verification:** `pnpm --filter @cellfade/synclair-persistence-postgres test && pnpm db:migrate:test`

### Task 7B.1: Define application-level provider ports

**Repository:** Control plane

**Files:**
- Create: `packages/application-contracts/package.json`
- Create: `packages/application-contracts/src/repository-host.ts`
- Create: `packages/application-contracts/src/deployment-provider.ts`
- Create: `packages/application-contracts/src/secret-store.ts`
- Create: `packages/application-contracts/src/audit-log.ts`
- Create: `packages/application-contracts/src/job-store.ts`
- Create: `packages/application-contracts/src/mutation-context.ts`
- Create: `packages/application-contracts/src/index.ts`
- Test: `packages/application-contracts/src/contracts.test.ts`

**Steps:**
1. Define provider-neutral DTOs using numeric IDs, exact SHAs, capability enums,
   and `MutationContext { idempotencyKey, auditReceipt }`.
2. Keep merge absent from automated repository ports.
3. Bind production promotion to explicit approval evidence.
4. Require every mutation method to receive a previously persisted audit receipt
   and require provider packages to implement the ports without SDK DTO leakage.

**Verification:** `pnpm exec vitest run packages/application-contracts/src/contracts.test.ts`

### Task 7B.2: Add identity and provider-connection migrations

**Repository:** Control plane

**Files:**
- Create: `db/migrations/0001_identity_sessions.sql`
- Create: `db/migrations/0002_provider_connections.sql`
- Create: `packages/persistence-postgres/src/identity-store.ts`
- Create: `packages/persistence-postgres/src/provider-connection-store.ts`
- Test: `packages/persistence-postgres/src/provider-connection-store.test.ts`

**Steps:**
1. Store numeric actor IDs, owner type, session revocation, and encrypted-secret
   handles rather than credential values in job records.
2. Add unique provider installation/configuration constraints.
3. Test login revocation and connection replacement.
4. Run reversible migrations on disposable Postgres.

**Verification:** `pnpm exec vitest run packages/persistence-postgres/src/provider-connection-store.test.ts && pnpm db:migrate:test`

### Task 7B.3: Add project and workflow migrations

**Repository:** Control plane

**Files:**
- Create: `db/migrations/0003_projects_drafts.sql`
- Create: `db/migrations/0004_runs_steps_leases.sql`
- Create: `packages/persistence-postgres/src/project-store.ts`
- Create: `packages/persistence-postgres/src/run-store.ts`
- Test: `packages/persistence-postgres/src/run-store.test.ts`

**Steps:**
1. Add drafts, projects, repositories, runs, steps, leases, and idempotency.
2. Enforce one active mutation run per numeric repository ID.
3. Test crash/reclaim and duplicate start.
4. Run reversible migrations.

**Verification:** `pnpm exec vitest run packages/persistence-postgres/src/run-store.test.ts && pnpm db:migrate:test`

### Task 7B.4: Add delivery, update, webhook, and audit migrations

**Repository:** Control plane

**Files:**
- Create: `db/migrations/0005_delivery_updates_approvals.sql`
- Create: `db/migrations/0006_webhooks_audit.sql`
- Create: `packages/persistence-postgres/src/delivery-store.ts`
- Create: `packages/persistence-postgres/src/webhook-store.ts`
- Create: `packages/persistence-postgres/src/audit-store.ts`
- Test: `packages/persistence-postgres/src/audit-store.test.ts`

**Steps:**
1. Add PRs, deployments, update candidates, approvals, webhook deliveries, and
   append-only audit events.
2. Deny application-role update/delete of audit rows.
3. Deduplicate provider delivery IDs.
4. Test approval single-use and audit tamper detection.

**Verification:** `pnpm exec vitest run packages/persistence-postgres/src/audit-store.test.ts && pnpm db:migrate:test`

### Task 7B.5: Implement encrypted SecretStore

**Repository:** Control plane

**Files:**
- Create: `db/migrations/0007_encrypted_secrets.sql`
- Create: `config/secret-store-policy.json`
- Create: `packages/secret-store/package.json`
- Create: `packages/secret-store/src/envelope.ts`
- Create: `packages/secret-store/src/postgres-secret-store.ts`
- Create: `packages/secret-store/src/keyring.ts`
- Test: `packages/secret-store/src/postgres-secret-store.test.ts`

**Steps:**
1. Implement envelope encryption with key versions and authenticated metadata;
   persist only ciphertext, nonce, algorithm, key version, expiry, and scope in
   the dedicated migration.
2. Return opaque handles; never credentials in job payloads or logs.
3. Source V1 KEK `SYNCLAIR_SECRETSTORE_KEK_V1` only from the Vercel production
   environment for the web/provisioner/approved worker processes; never expose
   it to Preview, generated-project CI, or Sandbox. Record key identifier
   `env:production:v1`, keep prior versions decrypt-only during rotation, and
   fail closed when the active key is absent.
4. Add rotation, revoke, expiry, wrong-environment, corrupted-ciphertext,
   backup/restore-with-key, and restore-without-key failure tests.
5. For V1, store GitHub refresh material only if required by the approved App
   flow; otherwise require reauthentication.

**Verification:** `pnpm exec vitest run packages/secret-store/src/postgres-secret-store.test.ts`

### Task 7B.6: Define and verify provider capability policy

**Repository:** Control plane

**Files:**
- Create: `config/provider-capabilities.json`
- Create: `scripts/check-provider-capabilities.mjs`
- Create: `docs/security/provider-permissions.md`
- Test: `tests/security/provider-capabilities.spec.ts`

**Steps:**
1. Define Identity, Provisioner, Updater, Vercel provisioner, and production
   promoter allowed/denied capabilities.
2. Require selected-repository installation and one-repository downscoping.
3. Prove provisioner is unavailable to cron/update workers and updater lacks
   admin/workflow/secret/environment/deployment/merge/bypass capability.
4. Prove Vercel provisioning credentials cannot promote production.

**Verification:** `pnpm test:provider-capabilities`

### Task 7B.7: Define PR event and secret exposure matrix

**Repository:** Control plane

**Files:**
- Create: `config/ci-secret-policy.json`
- Create: `scripts/check-generated-ci-secrets.mjs`
- Test: `tests/security/ci-secret-policy.spec.ts`

**Steps:**
1. Define secrets and permissions for PR, update, publisher, preview, staging,
   and production events.
2. Require PR/update validation to have `contents: read`, no environment, and no
   provider/production secrets.
3. Require publisher to consume only validated artifacts without checking out
   executable PR content.
4. Add same-repository bot-branch negative tests.

**Verification:** `pnpm test:ci-secret-policy`

## Phase 8 — GitHub identity, provisioning, and PR delivery

Task 8.7 executes before Tasks 8.4–8.5 so the governance seed and required check
exist before protection and publication.

### Task 8.0: Bind foundation releases to authenticated GitHub retrieval

**Repository:** Control plane

**Files:**
- Create: `packages/foundation-source/src/github-release-source.ts`
- Test: `packages/foundation-source/src/github-release-source.test.ts`
- Modify: `packages/foundation-source/src/index.ts`

**Steps:**
1. Implement the provider-neutral release-source contract using a short-lived,
   one-repository GitHub token obtained by opaque SecretStore handle.
2. Retrieve only the selected immutable tag and exact asset names from numeric
   repository ID `cellfade/synclair`; reject redirects or identity drift.
3. Discard the credential handle after retrieval and pass bytes through the
   Task 6.1 attestation/digest verifier before returning them.
4. Test revoked handle, wrong repository, mutable ref, redirect, and unverified
   asset rejection.

**Verification:** `pnpm exec vitest run packages/foundation-source/src/github-release-source.test.ts`

### Task 8.1: Define GitHub integration ports

**Repository:** Control plane

**Files:**
- Create: `packages/integration-github/package.json`
- Create: `packages/integration-github/src/types.ts`
- Create: `packages/integration-github/src/index.ts`
- Test: `packages/integration-github/src/types.test.ts`

**Steps:**
1. Implement the application-contract repository, identity, webhook, and status
   ports using GitHub SDK types only inside this package.
2. Exclude merge and production-deployment methods.
3. Require numeric repository/account IDs, exact SHAs, and idempotency keys.
4. Add compile-time tests proving prohibited operations and SDK DTO leakage are
   absent from application contracts.

**Verification:** `pnpm --filter @cellfade/synclair-github test`

### Task 8.2: Implement Cellfade identity authorization

**Repository:** Control plane

**Files:**
- Create: `packages/integration-github/src/identity.ts`
- Test: `packages/integration-github/src/identity.test.ts`

**Steps:**
1. Add tests for allowed numeric ID, wrong user, renamed login, expired token,
   revoked authorization, and owner-type-dependent organization membership.
2. Validate OAuth state and callback allowlist; require user or organization
   policy resolved in Task 0.3a.
3. Use expiring server-side user tokens and SecretStore handles.
4. Require recent reauthentication and live membership/allowlist verification
   for privileged operations.

**Verification:** `pnpm --filter @cellfade/synclair-github test -- identity`

### Task 8.2a: Register and verify private GitHub Apps

**Repository:** Control plane plus explicit GitHub configuration

**Files:**
- Create: `docs/runbooks/github-apps.md`
- Create: `config/github-app-policy.json`
- Create: `packages/integration-github/src/app-installations.ts`
- Test: `packages/integration-github/src/app-installations.test.ts`

**Steps:**
1. After explicit provider-configuration approval, register Identity,
   Provisioner, and Updater Apps with the exact capability policy.
2. Store only App IDs/client IDs in config; store secrets/private keys through
   SecretStore/environment-specific provider storage.
3. Verify a newly created repository is explicitly added to the selected-repo
   Updater installation before branch publication.
4. Test installation revocation, wrong installation, unrelated repository, and
   permission drift.
5. Against a disposable protected repository, prove an App-authored direct push
   to `main` is rejected and complete the deferred Task 2.3 protection gate.

**Verification:** `pnpm exec vitest run packages/integration-github/src/app-installations.test.ts && pnpm test:provider-capabilities`

### Task 8.2b: Implement one-repository token broker

**Repository:** Control plane

**Files:**
- Create: `packages/integration-github/src/token-broker.ts`
- Test: `packages/integration-github/src/token-broker.test.ts`

**Steps:**
1. Mint short-lived installation tokens for exactly one numeric repository and
   reduced capability subset.
2. Reject attempts to expand repositories or permissions.
3. Keep provisioner tokens unavailable to update/cron workers.
4. Revoke/discard handles after the step completes.

**Verification:** `pnpm exec vitest run packages/integration-github/src/token-broker.test.ts`

### Task 8.3: Implement private repository creation

**Repository:** Control plane

**Files:**
- Create: `packages/integration-github/src/provisioner.ts`
- Test: `packages/integration-github/src/provisioner.test.ts`

**Steps:**
1. Add mocked API tests for create, retry, name collision, wrong owner, and
   unexpected public visibility.
2. Create with private visibility only.
3. Re-read numeric owner/repository IDs and visibility before content writes.
4. Reconcile an existing idempotent match instead of duplicating it.

**Verification:** `pnpm --filter @cellfade/synclair-github test -- provisioner`

### Task 8.4: Seed governance and apply protection

**Repository:** Control plane

**Files:**
- Create: `packages/integration-github/src/governance.ts`
- Test: `packages/integration-github/src/governance.test.ts`

**Steps:**
1. Add tests enforcing seed-before-protection ordering.
2. Commit only governance and manifest to initial `main`.
3. Apply and read back the complete canonical Task 2.3 ruleset, including
   approvals, stale/latest-push/CODEOWNER review, expected-source checks,
   conversation resolution, no force/delete, and empty bypass list.
4. Verify direct human and App push rejection in the integration fixture.
5. Test partial bootstrap where seed succeeds but protection fails; later
   branch, Vercel, and PR methods must remain unreachable.

**Verification:** `pnpm test:github-integration -- governance`

### Task 8.5: Publish the setup branch and PR

**Repository:** Control plane

**Files:**
- Create: `packages/integration-github/src/publisher.ts`
- Test: `packages/integration-github/src/publisher.test.ts`

**Steps:**
1. Add tests proving publisher accepts only a validated plan and exact base SHA.
2. Commit only the declared file list.
3. Reuse the deterministic branch and matching open PR on retry.
4. Never stage, commit, or push an undeclared path.
5. Compare expected bot head SHA before refresh; if a human changed the branch,
   stop or create a new recovery branch rather than overwrite/force-push it.
6. Mainline targets `main`; overlay publishes the composite review tree to
   `synclair/overlay` and uses the bundle’s promotion allowlist for the separate
   product PR.

**Verification:** `pnpm --filter @cellfade/synclair-github test -- publisher`

### Task 8.6: Implement webhook verification and reconciliation

**Repository:** Control plane

**Files:**
- Create: `packages/integration-github/src/webhooks.ts`
- Create: `packages/integration-github/src/reconcile.ts`
- Test: `packages/integration-github/src/webhooks.test.ts`

**Steps:**
1. Add invalid signature, replay, duplicate delivery, stale event, and wrong
   repository tests.
2. Validate the raw-body HMAC with constant-time comparison.
3. Deduplicate delivery IDs.
4. Convert provider payloads into internal observed-state events.

**Verification:** `pnpm --filter @cellfade/synclair-github test -- webhooks`

### Task 8.7: Harden generated GitHub Actions

**Repository:** Control plane

**Files:**
- Modify: `packages/framework-adapters/templates/common/.github/workflows/ci.yml`
- Create: `packages/framework-adapters/templates/common/.github/workflows/synclair-update.yml`
- Test: `packages/framework-adapters/src/workflows.test.ts`

**Steps:**
1. Pin third-party Actions to full SHAs.
2. Default permissions to `contents: read`.
3. Separate PR comments or publishing into minimal-permission jobs.
4. Prohibit `pull_request_target` with checkout and write-authorized agent jobs.
5. Enforce the event/secret matrix from Task 7B.7 and exact expected check names.

**Verification:** `pnpm test:generated-workflows && ./tools/bin/actionlint fixtures/golden/*/.github/workflows/*.yml`

## Phase 9 — Vercel previews and staged production

### Task 9.1: Define deployment-provider port

**Repository:** Control plane

**Files:**
- Create: `packages/integration-vercel/package.json`
- Create: `packages/integration-vercel/src/types.ts`
- Test: `packages/integration-vercel/src/types.test.ts`

**Steps:**
1. Define ensure-project, observe-preview, create-staged-production, promote,
   and rollback interfaces.
2. Require exact repository ID, SHA, root directory, and approval evidence.
3. Keep promotion separate from preview and merge events.
4. Exclude Vercel imports from generator packages.

**Verification:** `pnpm --filter @cellfade/synclair-vercel test`

### Task 9.2: Implement Vercel project linking

**Repository:** Control plane

**Files:**
- Create: `packages/integration-vercel/src/projects.ts`
- Test: `packages/integration-vercel/src/projects.test.ts`

**Steps:**
1. Add tests for selected repository, wrong team, wrong root, duplicate project,
   and missing protection.
2. Create/link only after owner-confirmed provider connection.
3. Set adapter-specific framework/root settings.
4. Record provider IDs in DB, never the manifest.

**Verification:** `pnpm --filter @cellfade/synclair-vercel test -- projects`

### Task 9.2a: Implement Vercel connection, rotation, and revocation

**Repository:** Control plane plus explicit Vercel configuration

**Files:**
- Create: `packages/integration-vercel/src/connection.ts`
- Create: `packages/integration-vercel/src/revocation.ts`
- Create: `docs/runbooks/vercel-connection.md`
- Test: `packages/integration-vercel/src/connection.test.ts`

**Steps:**
1. Implement approved Vercel integration/OAuth or dedicated team credential flow
   through SecretStore handles.
2. Bind the connection to the intended numeric team/account.
3. Add rotation, disabled integration, wrong team, and revocation behavior.
4. Keep production promotion capability absent from provisioner credentials.

**Verification:** `pnpm exec vitest run packages/integration-vercel/src/connection.test.ts`

### Task 9.3: Observe exact-SHA protected previews

**Repository:** Control plane

**Files:**
- Create: `packages/integration-vercel/src/previews.ts`
- Create: `packages/integration-vercel/src/webhooks.ts`
- Test: `packages/integration-vercel/src/previews.test.ts`

**Steps:**
1. Add tests for ready, failed, superseded, unprotected, and wrong-SHA previews.
2. Correlate deployment to repository, branch, and SHA.
3. Require protection for control-plane and private project previews.
4. Surface preview readiness without promoting it.

**Verification:** `pnpm --filter @cellfade/synclair-vercel test -- previews`

### Task 9.3a: Authenticate and reconcile Vercel webhooks

**Repository:** Control plane

**Files:**
- Create: `packages/integration-vercel/src/webhook-auth.ts`
- Create: `packages/integration-vercel/src/reconcile.ts`
- Test: `packages/integration-vercel/src/webhook-auth.test.ts`

**Steps:**
1. Verify the raw-body signature with constant-time comparison.
2. Deduplicate delivery/event IDs and reject stale or replayed events.
3. Allowlist team and project and bind repository, deployment, and exact SHA.
4. Test forged, replayed, wrong-team, wrong-project, wrong-repository,
   wrong-deployment, and wrong-SHA events.

**Verification:** `pnpm exec vitest run packages/integration-vercel/src/webhook-auth.test.ts`

### Task 9.4: Implement staged production state

**Repository:** Control plane

**Files:**
- Create: `packages/integration-vercel/src/production.ts`
- Test: `packages/integration-vercel/src/production.test.ts`

**Steps:**
1. Add tests proving merge does not change the current production domain.
2. Require disabled automatic domain assignment.
3. Create or observe the staged production build for the merged SHA.
4. Require explicit approval before the promote method accepts input.
5. Read the live auto-assignment setting before every staging/approval action
   and fail closed if it changed.
6. Support `dashboard-observed` mode when the plan cannot safely expose a
   promotion API credential.

**Verification:** `pnpm --filter @cellfade/synclair-vercel test -- production`

### Task 9.5: Prove all adapter previews

**Repository:** Control plane

**Files:**
- Create: `tests/provider/vercel-preview.spec.ts`

**Steps:**
1. Create temporary private fixture repositories for all three adapters.
2. Open setup PRs from exact generated SHAs.
3. Verify protected previews and expected routes.
4. Prove GitHub-App-authored update commits receive exact-SHA previews or use
   the documented non-production deploy fallback.
5. Preserve fixtures for review; cleanup is a separate explicitly approved
   operation, not part of this unattended test.

**Verification:** `pnpm test:provider:vercel-preview`

### Task 9.6: Prove main merge does not change production

**Repository:** Control plane

**Files:**
- Create: `tests/provider/vercel-staged-production.spec.ts`

**Steps:**
1. Record the current production domain target.
2. Merge a disposable fixture PR after explicit approval.
3. Verify a staged build appears for the exact SHA while the domain target is
   unchanged.
4. Verify dashboard/API promotion is impossible without the configured separate
   human boundary.

**Verification:** `pnpm test:provider:vercel-staged-production`

## Phase 10 — Persistence and durable orchestration

### Task 10.0: Scaffold hosted runtime and authorization kernel

**Repository:** Control plane

**Files:**
- Create: `apps/control-plane/package.json`
- Create: `apps/control-plane/next.config.ts`
- Create: `apps/control-plane/tsconfig.json`
- Create: `apps/control-plane/vitest.config.ts`
- Create: `apps/control-plane/test/setup.ts`
- Create: `apps/control-plane/src/auth/session.ts`
- Create: `apps/control-plane/src/auth/authorize-mutation.ts`
- Test: `apps/control-plane/src/auth/session.test.ts`
- Test: `apps/control-plane/src/auth/authorize-mutation.test.ts`

**Steps:**
1. Create the nonvisual Next route/runtime and test scaffold before any API route
   or queue ingress task.
2. Implement server-side session parsing, expiry, rotation, revocation, and CSRF
   primitives against the application contracts and SecretStore.
3. Implement `authorizeMutation(actorId, projectId, repositoryId, capability)`
   with numeric resource binding and live owner policy.
4. Prove session fixation, arbitrary ID substitution, revoked connection,
   membership removal, and missing audit receipt are denied.

**Verification:** `pnpm exec vitest run apps/control-plane/src/auth/session.test.ts apps/control-plane/src/auth/authorize-mutation.test.ts`

### Task 10.1: Add database package and migrations

**Repository:** Control plane

**Files:**
- Modify: `packages/persistence-postgres/package.json`
- Modify: `packages/persistence-postgres/src/schema.ts`
- Modify: `packages/persistence-postgres/src/client.ts`
- Create: `packages/persistence-postgres/src/migrations.ts`
- Test: `packages/persistence-postgres/src/schema.test.ts`

**Steps:**
1. Compose and type the seven migrations created in Phase 7B.
2. Assert schema coverage for every designed entity and unique constraint.
3. Assert the application role cannot update/delete audit rows.
4. Run every migration up/down against disposable Postgres.

**Verification:** `pnpm test:db && pnpm db:migrate:test`

### Task 10.2: Define orchestration state machines

**Repository:** Control plane

**Files:**
- Create: `packages/orchestration/package.json`
- Create: `packages/orchestration/src/bootstrap-machine.ts`
- Create: `packages/orchestration/src/update-machine.ts`
- Create: `packages/orchestration/src/production-machine.ts`
- Test: `packages/orchestration/src/machines.test.ts`

**Steps:**
1. Add transition-table tests for success, retry, block, failure, cancel, and
   recovery.
2. Reject merge-as-automation and production-without-approval transitions.
3. Model provider state separately from workflow state.
4. Include explicit overlay review, overlay merge observation, product promotion
   PR/review/merge, and production states.
5. Serialize/restore state without information loss.
6. Test cancellation before repository creation, after repository creation,
   with an open PR, and after merge; ordinary cancel never deletes external
   resources and post-merge uses revert/repair.

**Verification:** `pnpm --filter @cellfade/synclair-orchestration test -- machines`

### Task 10.3: Implement idempotent job leasing

**Repository:** Control plane

**Files:**
- Create: `packages/orchestration/src/job-store.ts`
- Create: `packages/orchestration/src/leases.ts`
- Test: `packages/orchestration/src/leases.test.ts`

**Steps:**
1. Add tests for duplicate delivery, worker crash, expired lease, concurrent repo
   mutation, and bounded retry.
2. Permit one active mutation run per repository.
3. Resume from the last completed step.
4. Cap initial global concurrency at three.

**Verification:** `pnpm --filter @cellfade/synclair-orchestration test -- leases`

### Task 10.4: Add queue adapter with fallback

**Repository:** Control plane

**Files:**
- Create: `packages/orchestration/src/queue.ts`
- Create: `packages/orchestration/src/adapters/vercel-queue.ts`
- Create: `packages/orchestration/src/adapters/postgres-poll.ts`
- Test: `packages/orchestration/src/queue.test.ts`

**Steps:**
1. Define at-least-once publish/claim/ack behavior.
2. Implement Vercel Queue behind a feature flag.
3. Implement Postgres polling for local/development or a separately deployed
   worker only; it is not an indefinite serverless poller.
4. Require a proven Vercel Queue push consumer or approved dedicated worker for
   production hosted mutations; otherwise hosted mode is read-only.
5. Run identical delivery/idempotency contract tests against both adapters.

**Verification:** `pnpm --filter @cellfade/synclair-orchestration test -- queue`

### Task 10.5: Add sandbox execution boundary

**Repository:** Control plane

**Files:**
- Create: `packages/sandbox-runner/package.json`
- Create: `packages/sandbox-runner/src/vercel-sandbox.ts`
- Create: `packages/sandbox-runner/src/policy.ts`
- Test: `packages/sandbox-runner/src/policy.test.ts`

**Steps:**
1. Add traversal, symlink, secret-exfiltration, shell injection, fork-bomb,
   network, log-flood, and timeout tests.
2. Create fresh credential-free sandbox per run.
3. Permit only fixed executable/argument arrays.
4. Validate patch size, paths, hashes, binaries, and protected files outside the
   sandbox.

**Verification:** `pnpm --filter @cellfade/synclair-sandbox test`

### Task 10.6: Separate patch generation and publishing

**Repository:** Control plane

**Files:**
- Create: `packages/orchestration/src/patch-artifact.ts`
- Create: `packages/orchestration/src/publisher-job.ts`
- Test: `packages/orchestration/src/publisher-job.test.ts`

**Steps:**
1. Define canonical artifact bytes bound to job ID, numeric repository ID, base
   SHA, plan hash, expiry, and one-time publisher nonce.
2. Add a failing test proving publisher rejects an unsigned, expired, replayed,
   mismatched, or unhashed artifact.
3. Generate patch artifacts with no provider credentials and validate them
   outside the sandbox.
4. Sign with a dedicated artifact-signing key available only to the
   credential-free validator; verify in the isolated publisher process using a
   pinned public key, so neither side shares provider credentials.
5. Atomically consume the one-time nonce in Postgres in the same transaction
   that claims the publisher job; a failed provider call may retry only with a
   newly signed artifact/nonce.
6. Mint a short-lived repository token only inside the publisher step.

**Verification:** `pnpm --filter @cellfade/synclair-orchestration test -- publisher-job`

### Task 10.7: Implement structured redacted audit logging

**Repository:** Control plane

**Files:**
- Create: `packages/orchestration/src/audit.ts`
- Create: `packages/orchestration/src/redaction.ts`
- Test: `packages/orchestration/src/redaction.test.ts`

**Steps:**
1. Add tests for GitHub/Vercel tokens, cookies, keys, emails, paths, and model
   transcripts.
2. Store structured operations and hashes, not raw transcripts.
3. Add append-only hash chaining.
4. Export signed periodic checkpoints to independent durable storage and test
   row edit/delete, chain break, and checkpoint mismatch.
5. Cap sensitive debug retention.

**Verification:** `pnpm --filter @cellfade/synclair-orchestration test -- redaction`

### Task 10.8: Implement checkpointed bootstrap coordinator

**Repository:** Control plane

**Files:**
- Create: `packages/orchestration/src/bootstrap-service.ts`
- Create: `packages/orchestration/src/bootstrap-steps/create-repository.ts`
- Create: `packages/orchestration/src/bootstrap-steps/seed-main.ts`
- Create: `packages/orchestration/src/bootstrap-steps/protect-main.ts`
- Create: `packages/orchestration/src/bootstrap-steps/compose-generation.ts`
- Create: `packages/orchestration/src/bootstrap-steps/publish-branch.ts`
- Create: `packages/orchestration/src/bootstrap-steps/open-pr.ts`
- Create: `packages/orchestration/src/bootstrap-steps/observe-preview.ts`
- Test: `packages/orchestration/src/bootstrap-service.test.ts`

**Steps:**
1. Map every bootstrap state to one idempotent handler and recovery policy.
2. Execute private create -> seed -> protection proof -> plan/bundle -> publish
   -> PR -> checks/preview observation.
3. Make protection proof a hard gate before any later external mutation.
4. Persist provider IDs/checkpoints immediately after each successful step.

**Verification:** `pnpm exec vitest run packages/orchestration/src/bootstrap-service.test.ts`

### Task 10.9: Implement update, overlay, and release coordinators

**Repository:** Control plane

**Files:**
- Create: `packages/orchestration/src/update-service.ts`
- Create: `packages/orchestration/src/overlay-service.ts`
- Create: `packages/orchestration/src/production-service.ts`
- Create: `packages/orchestration/src/rollback-service.ts`
- Test: `packages/orchestration/src/coordinators.test.ts`

**Steps:**
1. Map update and overlay bundle states to executable handlers.
2. Map staging, explicit approval, observed dashboard promotion, API promotion,
   and rollback to separate handlers.
3. Reject automated merge and unapproved production in every coordinator.
4. Add resume tests at every provider boundary.

**Verification:** `pnpm exec vitest run packages/orchestration/src/coordinators.test.ts`

### Task 10.10: Add deployable worker and queue ingress

**Repository:** Control plane

**Files:**
- Create: `apps/worker/package.json`
- Create: `apps/worker/src/main.ts`
- Create: `apps/worker/src/consumer.ts`
- Create: `apps/worker/src/composition-root.ts`
- Create: `apps/control-plane/app/api/queue/jobs/route.ts`
- Create: `apps/control-plane/app/api/cron/jobs/route.ts`
- Test: `apps/worker/src/consumer.test.ts`

**Steps:**
1. Implement Queue push consumption for production and bounded poll mode for
   local/dedicated worker use.
2. Authenticate ingress, claim a lease, invoke one coordinator step, and ack or
   retry.
3. Prevent overlapping repository jobs and cap concurrency at three.
4. Disable hosted mutation mode when no approved production transport exists.

**Verification:** `pnpm exec vitest run apps/worker/src/consumer.test.ts`

### Task 10.11: Add authenticated webhook ingress routes

**Repository:** Control plane

**Files:**
- Create: `apps/control-plane/app/api/webhooks/github/route.ts`
- Create: `apps/control-plane/app/api/webhooks/vercel/route.ts`
- Test: `apps/control-plane/app/api/webhooks/webhooks.test.ts`

**Steps:**
1. Read raw bodies and invoke provider-specific signature verification.
2. Dedupe and persist the delivery before enqueueing reconciliation.
3. Return safe provider responses without leaking internal errors.
4. Test forged, replayed, revoked, wrong-environment, and duplicate deliveries.

**Verification:** `pnpm exec vitest run apps/control-plane/app/api/webhooks/webhooks.test.ts`

### Task 10.12: Add start, retry, and cancel run routes

**Repository:** Control plane

**Files:**
- Create: `apps/control-plane/app/api/runs/route.ts`
- Create: `apps/control-plane/app/api/runs/[runId]/retry/route.ts`
- Create: `apps/control-plane/app/api/runs/[runId]/cancel/route.ts`
- Test: `apps/control-plane/app/api/runs/runs.test.ts`

**Steps:**
1. Authorize actor, project, numeric repository, and capability on every action.
2. Add CSRF, arbitrary ID, session revocation, membership removal, and fixation
   tests.
3. Enqueue only after draft validation and external-write confirmation.
4. Preserve external evidence on cancel.

**Verification:** `pnpm exec vitest run apps/control-plane/app/api/runs/runs.test.ts`

### Task 10.13: Prove composition-root completeness

**Repository:** Control plane

**Files:**
- Create: `packages/orchestration/src/composition-root.test.ts`

**Steps:**
1. Instantiate all coordinators against fakes.
2. Assert every state has one executable handler and recovery policy.
3. Assert providers receive SecretStore handles, never raw secrets in jobs.
4. Assert automated code exposes no merge or unapproved production path.
5. For every provider mutation method, assert orchestration first appends an
   audit event and passes the returned receipt; reject missing, stale, wrong-job,
   or replayed receipts.

**Verification:** `pnpm exec vitest run packages/orchestration/src/composition-root.test.ts`

### Task 10.14: Complete the local end-to-end factory journey

**Repository:** Control plane

**Files:**
- Create: `packages/cli/src/commands/deliver.ts`
- Create: `packages/cli/src/adapters/local-run-store.ts`
- Test: `packages/cli/src/commands/deliver.test.ts`

**Steps:**
1. Bind the same coordinator to local provider/auth adapters.
2. Pause explicitly before private repo creation, provider linking, PR creation,
   fixture cleanup, merge observation, and any production action.
3. Create governance seed, prove protection, publish setup PR, and observe the
   exact-SHA preview.
4. Persist local resume checkpoints without storing credentials.

**Verification:** `pnpm exec vitest run packages/cli/src/commands/deliver.test.ts`

## Phase 11 — Hosted control-plane application

### Task 11.1: Bootstrap the Next.js control-plane app

**Repository:** Control plane

**Files:**
- Modify: `apps/control-plane/package.json`
- Modify: `apps/control-plane/next.config.ts`
- Create: `apps/control-plane/app/layout.tsx`
- Create: `apps/control-plane/app/page.tsx`
- Create: `apps/control-plane/app/globals.css`
- Test: `apps/control-plane/app/page.test.tsx`

**Steps:**
1. Read the installed Next.js bundled documentation before implementation.
2. Build the visual app shell on the runtime/auth scaffold from Task 10.0.
3. Add a failing authenticated-shell render test and accessible Cellfade
   internal shell.
4. Complete lint, typecheck, unit, build, and Playwright scripts.

**Verification:** `pnpm --filter @cellfade/synclair-control-plane verify`

### Task 11.2: Implement server-side GitHub sessions

**Repository:** Control plane

**Files:**
- Modify: `apps/control-plane/src/auth/session.ts`
- Create: `apps/control-plane/src/auth/github.ts`
- Create: `apps/control-plane/app/api/auth/github/route.ts`
- Create: `apps/control-plane/app/api/auth/github/callback/route.ts`
- Test: `apps/control-plane/src/auth/session.test.ts`

**Steps:**
1. Add state, callback, numeric allowlist, expiry, CSRF, and reauth tests.
2. Keep tokens in encrypted server-side storage.
3. Use secure HttpOnly SameSite cookies; regenerate session IDs after login and
   privilege changes; support key-version rotation, maximum lifetime, logout,
   and revocation propagation.
4. Deny project enumeration before authorization and route every mutation
   through `authorizeMutation`.

**Verification:** `pnpm --filter @cellfade/synclair-control-plane test -- auth`

### Task 11.3: Build the projects dashboard

**Repository:** Control plane

**Files:**
- Create: `apps/control-plane/app/(authenticated)/projects/page.tsx`
- Create: `apps/control-plane/src/projects/queries.ts`
- Test: `apps/control-plane/app/(authenticated)/projects/page.test.tsx`

**Steps:**
1. Add empty, loading, actionable, blocked, and provider-error tests.
2. Show lifecycle, framework, preview, production, foundation, and update status.
3. Add filters for review, blocked, update, and production approval.
4. Verify keyboard and reduced-motion behavior.

**Verification:** `pnpm --filter @cellfade/synclair-control-plane test -- projects`

### Task 11.4: Build the resumable project wizard

**Repository:** Control plane

**Files:**
- Create: `apps/control-plane/app/(authenticated)/projects/new/page.tsx`
- Create: `apps/control-plane/app/(authenticated)/projects/new/wizard.tsx`
- Create: `apps/control-plane/app/(authenticated)/projects/new/steps/product-step.tsx`
- Create: `apps/control-plane/app/(authenticated)/projects/new/steps/starter-step.tsx`
- Create: `apps/control-plane/app/(authenticated)/projects/new/steps/application-step.tsx`
- Create: `apps/control-plane/app/(authenticated)/projects/new/steps/synclair-step.tsx`
- Create: `apps/control-plane/app/(authenticated)/projects/new/steps/updates-step.tsx`
- Create: `apps/control-plane/app/(authenticated)/projects/new/steps/delivery-step.tsx`
- Create: `apps/control-plane/app/(authenticated)/projects/new/steps/review-step.tsx`
- Create: `apps/control-plane/src/projects/drafts.ts`
- Create: `apps/control-plane/src/projects/wizard-actions.ts`
- Test: `apps/control-plane/app/(authenticated)/projects/new/wizard.test.tsx`

**Steps:**
1. Add step, save/resume, validation, conditional overlay, and unattended-default
   tests.
2. Persist a server-side draft before external writes.
3. Show manifest and provider-action preview.
4. Make final confirmation the first external-write boundary.

**Verification:** `pnpm --filter @cellfade/synclair-control-plane test -- wizard`

### Task 11.5: Build provisioning timeline and recovery

**Repository:** Control plane

**Files:**
- Create: `apps/control-plane/app/(authenticated)/runs/[runId]/page.tsx`
- Create: `apps/control-plane/src/runs/actions.ts`
- Test: `apps/control-plane/app/(authenticated)/runs/[runId]/page.test.tsx`

**Steps:**
1. Add running, retryable, blocked, canceled, and completed tests.
2. Show last verified checkpoint and sanitized evidence.
3. Scope retry to the failed step after provider reconciliation.
4. Preserve repositories and PRs on ordinary cancel.

**Verification:** `pnpm --filter @cellfade/synclair-control-plane test -- runs`

### Task 11.6: Build project overview and review workspace

**Repository:** Control plane

**Files:**
- Create: `apps/control-plane/app/(authenticated)/projects/[projectId]/page.tsx`
- Create: `apps/control-plane/app/(authenticated)/projects/[projectId]/review/page.tsx`
- Test: `apps/control-plane/app/(authenticated)/projects/[projectId]/review/page.test.tsx`

**Steps:**
1. Add exact-SHA, missing preview, failed check, changes requested, and
   review-ready tests.
2. Link the protected preview by default. Embedding requires exact-origin CSP
   and frame allowlists and may not expose bypass credentials in URL/browser
   state.
3. Group changes by product, foundation, agent pack, and delivery.
4. Keep production controls absent from review.

**Verification:** `pnpm --filter @cellfade/synclair-control-plane test -- review`

### Task 11.7: Build updates and connections screens

**Repository:** Control plane

**Files:**
- Create: `apps/control-plane/app/(authenticated)/projects/[projectId]/updates/page.tsx`
- Create: `apps/control-plane/app/(authenticated)/connections/page.tsx`
- Test: `apps/control-plane/app/(authenticated)/projects/[projectId]/updates/page.test.tsx`

**Steps:**
1. Add manual, recommended, automatic, paused, conflict, and failed update tests.
2. Show provider scope and health without credential values.
3. Add reconnect/revoke actions with reauthentication.
4. Add a global automatic-update kill switch.

**Verification:** `pnpm --filter @cellfade/synclair-control-plane test -- updates connections`

### Task 11.8: Build production approval and activity screens

**Repository:** Control plane

**Files:**
- Create: `apps/control-plane/app/(authenticated)/projects/[projectId]/production/page.tsx`
- Create: `apps/control-plane/app/(authenticated)/activity/page.tsx`
- Test: `apps/control-plane/app/(authenticated)/projects/[projectId]/production/page.test.tsx`

**Steps:**
1. Add wrong-SHA, stale approval, self-generated action, failed stage, success,
   and rollback tests.
2. Show exact staged deployment, SHA, checks, and prior production.
3. Require recent reauthentication and explicit confirmation.
4. Record actor and immutable evidence before promotion.

**Verification:** `pnpm --filter @cellfade/synclair-control-plane test -- production activity`

## Phase 12 — Update automation and overlay operations

### Task 12.1: Discover compatible foundation releases

**Repository:** Control plane

**Files:**
- Create: `packages/orchestration/src/release-discovery.ts`
- Test: `packages/orchestration/src/release-discovery.test.ts`

**Steps:**
1. Add tests for no update, compatible update, incompatible schema, superseded
   release, and tampered manifest.
2. Compare immutable release descriptors with project lock state.
3. Persist an update candidate without mutating the repository.
4. Surface compatibility evidence.

**Verification:** `pnpm --filter @cellfade/synclair-orchestration test -- release-discovery`

### Task 12.2: Implement manual and recommended updates

**Repository:** Control plane

**Files:**
- Create: `packages/orchestration/src/update-policy.ts`
- Test: `packages/orchestration/src/update-policy.test.ts`

**Steps:**
1. Prove manual mode creates no branch until explicit action.
2. Prove recommended mode creates only a recommendation until explicit action.
3. Build a conflict-aware update plan.
4. Open a PR only after verification.

“Verification” here means credential-free sandbox/golden preflight. A green
preflight permits pushing the deterministic branch and opening a draft PR; PR
CI then revalidates it before the control plane marks the PR review-ready.
Failed preflight records a run and opens no PR.

**Verification:** `pnpm --filter @cellfade/synclair-orchestration test -- update-policy`

### Task 12.3: Implement weekly automatic update PRs

**Repository:** Control plane

**Files:**
- Create: `apps/control-plane/app/api/cron/weekly-updates/route.ts`
- Create: `packages/orchestration/src/weekly-updates.ts`
- Test: `packages/orchestration/src/weekly-updates.test.ts`

**Steps:**
1. Add duplicate cron, concurrent run, open-PR, failure, and kill-switch tests.
2. Enforce at most one update PR per project per target release per week.
3. Open or refresh a PR only when checks pass.
4. Never merge or stage production.
5. Authenticate the production cron/queue trigger with platform-auth
   verification or a constant-time static bearer check; reject Preview
   invocations, apply rate limits, and honor global/project kill switches.
6. When platform-signed timestamps/nonces exist, reject cryptographic replay;
   with Vercel's static cron bearer, treat repeat delivery as an authenticated
   duplicate and suppress it through the durable delivery/idempotency record.
   Test missing, wrong, replayed-or-duplicate, Preview, disabled, and
   over-budget triggers.
7. If an existing update branch diverged through human edits, stop or create a
   new recovery branch; never overwrite it.

**Verification:** `pnpm --filter @cellfade/synclair-orchestration test -- weekly-updates`

### Task 12.4: Implement overlay refresh health

**Repository:** Control plane

**Files:**
- Create: `packages/orchestration/src/overlay.ts`
- Test: `packages/orchestration/src/overlay.test.ts`

**Steps:**
1. Add shared merge, single-owner rebase, divergence, conflict, and stale-base
   tests.
2. Never write or rewrite protected `main`.
3. Permit force-with-lease only on the declared single-owner overlay.
4. Surface divergence and manual conflict instructions.
5. Keep overlay mode behind an experimental flag until all branch-protection,
   recovery, and root-layout promotion tests pass.

**Verification:** `pnpm --filter @cellfade/synclair-orchestration test -- overlay`

### Task 12.5: Implement product-path-only promotion PR

**Repository:** Control plane

**Files:**
- Create: `packages/orchestration/src/overlay-promotion.ts`
- Test: `packages/orchestration/src/overlay-promotion.test.ts`

**Steps:**
1. Add tests proving hub-only paths cannot enter the product promotion PR.
2. Derive eligible product paths from the manifest/lock ownership map.
3. Create a separate PR to `main` with its own checks and review.
4. Reuse the PR on retry.

**Verification:** `pnpm --filter @cellfade/synclair-orchestration test -- overlay-promotion`

## Phase 13 — Controlled production and rollback

### Task 13.1: Persist explicit production approvals

**Repository:** Control plane

**Files:**
- Create: `packages/orchestration/src/approvals.ts`
- Test: `packages/orchestration/src/approvals.test.ts`

**Steps:**
1. Add exact deployment/SHA, expiry, actor, reauth, replay, and revocation tests.
2. Bind approval to one staged deployment.
3. Make approval single-use.
4. Append an audit event before provider invocation.
5. Reject approval after main advances, staged deployment replacement,
   wrong-project/provider drift, prior promotion, or auto-assignment changes.

**Verification:** `pnpm --filter @cellfade/synclair-orchestration test -- approvals`

### Task 13.2: Promote and verify production

**Repository:** Control plane

**Files:**
- Modify: `packages/integration-vercel/src/production.ts`
- Create: `packages/orchestration/src/production-release.ts`
- Test: `packages/orchestration/src/production-release.test.ts`

**Steps:**
1. Add provider failure, stale stage, smoke failure, success, and timeout tests.
2. Promote only the approved staged deployment.
3. Run fixed health probes and inspect error logs.
4. Record current production only after verification.

**Verification:** `pnpm --filter @cellfade/synclair-orchestration test -- production-release`

### Task 13.3: Implement rollback

**Repository:** Control plane

**Files:**
- Create: `packages/orchestration/src/rollback.ts`
- Test: `packages/orchestration/src/rollback.test.ts`

**Steps:**
1. Add wrong-project, missing-prior, failed rollback, and success tests.
2. Require explicit human confirmation.
3. Roll back to the recorded prior production deployment.
4. Run health probes and audit the outcome.

**Verification:** `pnpm --filter @cellfade/synclair-orchestration test -- rollback`

## Phase 14 — End-to-end dogfood and audits

### Task 14.1: Dogfood Option A across all frameworks

**Repository:** Control plane

**Files:**
- Create: `tests/e2e/mainline-bootstrap.spec.ts`
- Create: `tests/fixtures/manifests/mainline-*.json`

**Steps:**
1. Create private disposable Vite, Next.js, and Astro projects for both root and
   `apps/web` layouts using unique run namespaces.
2. Verify governance seed, protected main, setup PR, checks, and protected
   previews.
3. Verify merge does not promote production.
4. Preserve evidence. Cleanup is a separately approved, target-listed task.

**Verification:** `pnpm test:e2e:mainline`

### Task 14.2: Dogfood Option B

**Repository:** Control plane

**Files:**
- Create: `tests/e2e/overlay-bootstrap.spec.ts`
- Create: `tests/fixtures/manifests/overlay-*.json`

**Steps:**
1. Exercise shared merge and single-owner rebase policies.
2. Advance `main` and verify overlay freshness reporting.
3. Produce a product-path-only promotion PR.
4. Prove protected `main` is never rewritten.
5. Cover both layouts, renamed/deleted product paths, ambient doorway ownership,
   main/overlay lock relationship, and product promotion exclusions.

**Verification:** `pnpm test:e2e:overlay`

### Task 14.3: Run visual and interaction acceptance

**Repository:** Control plane

**Files:**
- Create: `tests/acceptance/control-plane.spec.ts`
- Create: `tests/acceptance/generated-projects.spec.ts`
- Create: `qa/README.md`

**Steps:**
1. Test desktop and mobile wizard, dashboard, runs, review, updates, production,
   and recovery.
2. Test keyboard, focus, dialogs, errors, reduced motion, dark mode, and console
   health.
3. Capture screenshots for 390, 768, and 1440 widths.
4. Inspect real Vercel previews for every adapter.

**Verification:** `pnpm test:acceptance`

### Task 14.4: Run security negative tests

**Repository:** Control plane

**Files:**
- Create: `tests/security/authorization.spec.ts`
- Create: `tests/security/sandbox.spec.ts`
- Create: `tests/security/provider-boundaries.spec.ts`

**Steps:**
1. Prove unauthorized users cannot enumerate projects.
2. Prove updater cannot push to main, edit workflows, access another repo,
   obtain production credentials, merge, or deploy.
3. Prove prompt injection and malicious package scripts cannot reach publisher
   credentials.
4. Prove forged/replayed webhooks are rejected.
5. Prove preview/update CI receives no provider, environment, or production
   secrets and App revocation stops active jobs.

**Verification:** `pnpm test:security`

### Task 14.5: Run recovery and reliability tests

**Repository:** Control plane

**Files:**
- Create: `tests/reliability/retry.spec.ts`
- Create: `tests/reliability/recovery.spec.ts`
- Create: `tests/reliability/load.spec.ts`

**Steps:**
1. Crash jobs after every provider checkpoint and resume them.
2. Replay webhooks and queue messages.
3. Run three concurrent projects and conflicting same-repo requests.
4. Measure queue start, PR open, webhook, RPO, and RTO targets.

**Verification:** `pnpm test:reliability`

### Task 14.5a: Implement monitoring, budgets, and alerts

**Repository:** Control plane

**Files:**
- Create: `packages/observability/package.json`
- Create: `packages/observability/src/metrics.ts`
- Create: `packages/observability/src/alerts.ts`
- Create: `config/budgets.json`
- Create: `docs/runbooks/alerts.md`
- Test: `packages/observability/src/alerts.test.ts`

**Steps:**
1. Emit queue, job, provider, webhook, sandbox, spend, and release metrics.
2. Add per-user/repository/provider rate limits, budgets, and global kill
   switches.
3. Alert on stuck jobs, repeated auth failure, permission drift, protection
   drift, production alias drift, spend, and backup failure.
4. Test alerts and kill switches with fixtures.

**Verification:** `pnpm exec vitest run packages/observability/src/alerts.test.ts`

### Task 14.5b: Implement backup, retention, and restore drills

**Repository:** Control plane

**Files:**
- Create: `scripts/backup-control-plane.mjs`
- Create: `scripts/restore-control-plane.mjs`
- Create: `scripts/export-audit-checkpoint.mjs`
- Create: `docs/runbooks/backup-restore.md`
- Test: `tests/reliability/restore.spec.ts`

**Steps:**
1. Configure encrypted database backups and separate audit-checkpoint storage.
2. Implement privileged retention jobs separate from the append-only app role.
3. Restore a disposable environment and verify RPO/RTO and audit chain.
4. Rehearse GitHub App, Vercel connection, webhook, and session-key revocation.

**Verification:** `pnpm test:restore-drill`

### Task 14.6: Perform independent code, architecture, and threat review

**Repository:** Both

**Files:**
- Create: `docs/audits/foundation-release-audit.md` (Foundation)
- Create: `docs/audits/control-plane-architecture-audit.md` (Control plane)
- Create: `docs/audits/control-plane-security-audit.md` (Control plane)
- Create: `docs/audits/control-plane-ux-acceptance.md` (Control plane)

**Steps:**
1. Assign independent agents to foundation integrity, architecture, security,
   and UX evidence with non-overlapping outputs.
2. Resolve every critical/high finding before release.
3. Re-run full verification after fixes.
4. Record residual medium/low risks with owners and follow-up dates.

**Verification:** run `pnpm verify:release` in the control-plane repo, then run
`npm run verify:foundation` in the foundation repo.

### Task 14.7: Release the private control plane preview

**Repository:** Control plane

**Files:**
- Create: `vercel.json`
- Create: `docs/runbooks/control-plane-deploy.md`
- Create: `docs/runbooks/provider-revocation.md`
- Create: `docs/runbooks/rollback.md`
- Create: `docs/runbooks/incident-response.md`

**Steps:**
1. Link the private Vercel project to the protected repository.
2. Configure preview, production, Sandbox/Queue, Postgres, webhook, and auth
   secrets with environment separation.
3. Deploy a protected PR preview and run the complete acceptance suite.
4. Merge only after review.
5. Create a staged production build with domain auto-assignment disabled.
6. Stop at the staged build and request explicit human promotion; after that
   separate approval, observe the recorded deployment and verify rollback.

**Verification:** `pnpm verify:release && pnpm verify:recorded-deployment`

## Parallel agent execution map

Parallel rounds are allowed only after their dependencies pass.

| Round | Independent agents | File ownership |
|---|---|---|
| A | Foundation release; control-plane local toolchain | Separate repositories; one integrator owns each repo root and lockfile |
| B | Vite adapter; Next adapter; Astro adapter | Adapter-specific source/template/fixture paths only; integrator alone changes shared exports, package metadata, scripts, and lockfile |
| C | Application contracts; persistence migrations; SecretStore | Separate package paths after project model is stable; one DB integrator serializes migrations |
| D | GitHub adapter; Vercel adapter | Separate provider packages after contracts/stores pass; provider E2E remains serialized |
| E | Dashboard query/view; wizard step views; run timeline view | Begin only after shared shell, auth guard, components, actions contracts, and test setup land; integrator owns shared CSS/navigation/config |
| F | Mainline test authoring; overlay test authoring; security test authoring | Separate test files, but provider execution is serialized with unique fixture namespaces and quotas |
| G | Architecture audit; security audit; UX audit | Separate `docs/audits/**` files |

The primary agent integrates each round, verifies no shared-file ownership,
runs the full suite, and commits atomically.

Each dispatch prompt must name repository, base SHA, owned files, forbidden
shared files, verification command, and integration order. Subagents may not
edit root manifests, lockfiles, shared exports, common templates, or test setup
unless they are the designated integrator.

## Mandatory microtask decomposition

The parent tasks above are acceptance groups. During execution, each item below
is a separate RED-GREEN-REFACTOR unit and commit candidate; no agent receives an
entire parent epic at once.

- **Task 2.1:** local root configs -> root scripts -> pinned Actionlint -> local
  CI validation -> private remote creation -> visibility readback -> initial
  commit/push -> first CI observation.
- **Task 4.5:** operation validation -> in-memory apply -> hash verification ->
  conflict return type. Bootstrap/update composition remains Task 6.7.
- **Tasks 5.2/5.4/5.6:** package/config templates -> shell/tokens/navigation ->
  representative route -> tests/CI -> deployment exclusions -> root golden ->
  `apps/web` golden. Shared index changes are serialized afterward.
- **Task 6.3:** bundle type -> main projection -> overlay projection -> two lock
  projections -> promotion allowlist -> retry hash tests.
- **Task 7.4:** verify command -> recreate command -> update-plan command, each
  with its own file-specific test before CLI export wiring.
- **Task 8.4:** governance tree -> seed commit -> ruleset apply -> ruleset
  readback -> human push negative test -> App push negative test -> partial
  failure/block test.
- **Task 9.5:** Vite preview fixture -> Next preview fixture -> Astro preview
  fixture -> bot-author preview fixture. Cleanup is a separate approved task.
- **Task 10.1:** migrations are executed/tested in numeric order; client/schema
  composition follows only after all six pass.
- **Task 10.2:** bootstrap machine -> update machine -> overlay machine ->
  production machine -> serialization/restoration matrix.
- **Task 10.4:** queue contract -> fake -> Vercel Queue adapter -> push consumer
  -> local/dedicated poll adapter -> production-disable gate.
- **Task 10.5:** sandbox creation -> no-secret environment -> command allowlist
  -> network policy -> resource limits -> patch extraction -> symlink/realpath
  validation -> malicious fixture matrix.
- **Task 11.4:** draft store -> product step -> starter step -> application step
  -> Synclair step -> updates step -> delivery step -> review step -> resume ->
  external-write confirmation.
- **Tasks 11.6–11.8:** query/data contract first; then one page; then its server
  actions; then authorization tests; then interaction/visual tests.
- **Task 12.4:** divergence observation -> shared merge plan -> single-owner
  rebase plan -> lease-guarded force-with-lease -> conflict diagnostics ->
  experimental enablement gate.
- **Task 12.5:** allowlist derivation -> rename/delete semantics -> protected
  path rejection -> product diff -> branch publish -> PR reuse.
- **Tasks 14.1–14.2:** one framework/layout/mode fixture per run; evidence
  integration follows after each isolated run.
- **Task 14.3:** one screen/state/viewport test per slice.
- **Task 14.4:** one prohibited capability or attack fixture per slice.
- **Task 14.5:** one crash checkpoint, replay class, concurrency case, or SLO
  measurement per slice.

## External approval checkpoints

Even after plan approval, execution pauses at these distinct boundaries:

1. foundation source PR merge and private release/tag publication;
2. control-plane private repository creation and initial governance push;
3. GitHub App and Vercel integration registration/permission changes;
4. creation of disposable provider-backed dogfood repositories;
5. cleanup/deletion of named dogfood resources;
6. control-plane implementation PR merge;
7. production staged-build promotion; and
8. rollback of a live production deployment.

## Global verification matrix

Run the fast, affected-scope tier before every PR is marked ready:

```bash
# Foundation
cd "/Users/andrewmiller/Documents/Claity Platform/cellfade-synclair"
npm run verify:foundation

# Control plane
cd "/Users/andrewmiller/Documents/Claity Platform/synclair-control-plane"
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run `pnpm verify:golden:all` for adapter/composer/release changes, the
credential-free `pnpm test:security` suite for auth/provider/workflow/sandbox
changes, and affected browser acceptance slices for UI changes. Run the full
golden, security, provider-backed, recovery, and acceptance matrix only at the
release-candidate gate in Phase 14; provider-backed suites are never a routine
PR requirement.

Provider-backed suites run only with approved test identities and disposable
private fixture repositories. They must never target unrelated repositories or
production domains.

## Definition of done

- Foundation release and file manifests are immutable, verified, and neutral.
- The local wizard and manifest mode produce identical plan hashes.
- Vite + React, Next.js, and Astro pass both layouts and complete gates.
- Option A and Option B are proven with real private repositories.
- Every generated project contains the manifest, lock, product brief, tokens,
  shell, navigation, one route, Synclair, pinned skills/agents, CI, and preview.
- GitHub creation follows private repo -> governance seed -> protected main ->
  setup branch -> human-reviewed PR.
- Vercel previews are exact-SHA and protected.
- Merge never counts as production approval.
- Production domains remain unchanged until explicit human promotion.
- Manual, recommended, and weekly automatic updates stop at verified PRs.
- Jobs are resumable, idempotent, isolated, redacted, and audited.
- Critical/high architecture, security, and UX audit findings are closed.
- The protected hosted control plane can create, observe, update, stage, and
  recover projects through the designed workflow.
