# Synclair Factory and Control Plane Design

**Status:** Approved direction
**Date:** 2026-07-21
**Decision owner:** Cellfade
**Foundation repository:** `cellfade/synclair`
**Control-plane repository:** `cellfade/synclair-control-plane` (to create, private)

## Purpose

Turn the existing private Cellfade Synclair foundation into a repeatable project
creation and operations system for frontend-bearing codebases. The system must
support a local interactive factory first and a private hosted control plane as
the final operating experience.

The factory creates a real, miniature delivery workflow from the beginning:

1. create a private GitHub repository;
2. seed a minimal governance commit on `main`;
3. protect `main`;
4. generate the product-aware starter on a setup branch;
5. open a pull request;
6. produce a protected Vercel preview;
7. require human review before merge; and
8. require a separate explicit production promotion.

## Product principles

1. **Git remains product truth.** Product content, the manifest, lock state,
   design tokens, skills, agents, Synclair data, and generated code are
   committed in the product repository.
2. **The control plane stores workflow truth.** Drafts, resumable jobs,
   approvals, audit events, provider identifiers, and observed status live in
   the control-plane database.
3. **Generation is deterministic.** A validated manifest plus immutable
   generator, adapter, template, foundation, and agent-pack versions produces
   the same normalized file plan.
4. **Agents propose bounded content.** Models may prepare the product brief,
   tokens, shell copy, navigation, and one representative route. They do not
   choose repositories, branches, permissions, commands, merge behavior, or
   deployments.
5. **Automation stops at a PR.** Bootstrap and update automation may create a
   branch, validate it, and open or refresh a PR. It may not merge or promote
   production.
6. **Private is an invariant.** V1 creates and manages only repositories owned
   by the approved Cellfade account and with private visibility.
7. **Synclair is infrastructure, not the product.** Generated project identity
   and agent routing describe the product. Synclair remains the supporting
   collaboration and knowledge layer.

## Selected architecture

Use two private repositories with a versioned compatibility contract.

```text
cellfade/synclair
  neutral foundation
  hub runtime
  pinned skills and agents
  foundation releases and integrity manifest
               |
               | immutable release SHA
               v
cellfade/synclair-control-plane
  generator core and framework adapters
  local CLI and interactive wizard
  hosted control-plane application
  durable workflow orchestration
  GitHub and Vercel integrations
  Postgres persistence and audit trail
               |
               | generated setup PR
               v
cellfade/<product>
  product app
  synclair.project.json
  .synclair/lock.json
  embedded Synclair
  pinned agent/skill doorways
  CI and preview workflow
```

The control-plane repository is a modular monolith. Package boundaries make
the generator, providers, workflow engine, and persistence independently
testable without introducing microservice operations for a single-tenant V1.

## Repository responsibilities

### `cellfade/synclair`

- Remain neutral and independently runnable.
- Publish immutable foundation releases.
- Declare every foundation-owned file and its digest.
- Ship the hub, skills, agents, schemas, and agent bridge.
- Retain the public upstream lineage and license notices.
- Reject product seed, credentials, local paths, and host-specific data.
- Provide compatibility metadata for manifest and generator versions.

Foundation releases are built from an already-fixed commit. The committed
source contains a release template, never its own commit SHA. Release CI checks
out the approved commit, excludes release-output files from the owned-file
digest graph, generates the descriptor and archive, signs or attests them, and
publishes them under an immutable private tag. This avoids a self-referential
hash and makes publisher identity independently verifiable.
The V1 trust root is GitHub Artifact Attestations from the pinned
`cellfade/synclair/.github/workflows/publish-foundation-release.yml` workflow;
consumers verify the numeric repository identity, exact source commit,
`foundation-v<semver>` tag, workflow identity, and asset digests before use.

### `cellfade/synclair-control-plane`

- Own `synclair.project.json` and lock-file schemas.
- Own deterministic project and update planning.
- Own Vite + React, Next.js, and Astro generator adapters.
- Own the interactive CLI and unattended manifest mode.
- Create private repositories and protected PR workflows.
- Link Vercel projects and observe protected previews.
- Store resumable workflow state and audit evidence.
- Surface manual, recommended, and weekly update policies.
- Stage, but never silently promote, production releases.

### Generated product repositories

- Commit the desired configuration in `synclair.project.json`.
- Commit resolved immutable versions and managed-file hashes in
  `.synclair/lock.json`.
- Keep product, foundation, agent-pack, and delivery file ownership explicit.
- Run product and Synclair verification independently.
- Keep provider credentials and runtime job identifiers out of Git.

## Generator architecture

The core is a pure TypeScript library:

```text
validated manifest
  + generator version
  + framework adapter version
  + immutable foundation release
  + pinned agent pack
        |
        v
GenerationPlan
  operations[] = { path, bytes, mode, sha256, owner, overwritePolicy }
  commands      = fixed adapter-owned verification commands
  probes        = fixed route and artifact acceptance probes
```

The generator core may not import GitHub, Vercel, Postgres, Next.js server
code, shell helpers, or model SDKs. The CLI and hosted system invoke the same
use cases through ports:

- `Workspace`
- `RepositoryHost`
- `DeploymentProvider`
- `JobStore`
- `AuditLog`
- `SecretStore`
- `Clock`
- `IdGenerator`

The existing Synclair `PlatformAdapter` is a preview-rendering abstraction. It
must be renamed or preserved as `PreviewAdapter`; it must not be expanded into
the new project-generation `FrameworkAdapter`.

## Supported framework adapters

V1 production-tested adapters:

| Adapter | Product shape | Required gates |
|---|---|---|
| `vite-react` | React + TypeScript SPA | lint, typecheck, unit, build, route smoke |
| `nextjs` | Next.js + TypeScript app | lint, typecheck, unit, build, route smoke |
| `astro` | Astro + TypeScript site/app | lint, typecheck, unit, build, route smoke |

Every adapter supports both root and `apps/web/` layouts. The wizard asks; an
unattended run defaults to `apps/web/`.

The generated starter contains:

- a product brief;
- semantic design tokens;
- an application shell;
- up to five navigation items;
- exactly one representative route;
- bounded initial copy and empty state;
- CI, tests, and preview configuration;
- the pinned Synclair foundation; and
- repository-contained skills, agents, and generated doorways.

V1 does not generate authentication, a backend, a database, billing, or a full
MVP.

## Manifest contract

`synclair.project.json` records desired, portable configuration:

```json
{
  "$schema": "https://schemas.cellfade.dev/synclair/project-v1.json",
  "schemaVersion": 1,
  "project": {
    "name": "Example Product",
    "slug": "example-product",
    "brief": "docs/product/brief.md"
  },
  "repository": {
    "owner": "cellfade",
    "name": "example-product",
    "visibility": "private",
    "defaultBranch": "main"
  },
  "application": {
    "framework": "nextjs",
    "root": "apps/web",
    "packageManager": "pnpm"
  },
  "synclair": {
    "topology": "embedded",
    "delivery": "mainline",
    "path": "synclair",
    "foundationRef": "<immutable-full-sha>",
    "agentPackRef": "<immutable-full-sha>",
    "updatePolicy": "recommended"
  },
  "delivery": {
    "previewProvider": "vercel",
    "productionBranch": "main",
    "productionApproval": "explicit"
  }
}
```

The manifest never contains tokens, installation IDs, deployment IDs, run
status, cookies, passwords, or private keys.

`.synclair/lock.json` records resolved implementation state:

- generator version;
- adapter version;
- foundation repository numeric ID and commit SHA;
- agent-pack commit SHA;
- normalized plan hash;
- managed paths, ownership, and baseline hashes;
- last applied operation and timestamp.
- release signature or attestation identity and digest.

The agent pack is part of the same foundation release and commit as the hub. It
is not independently versioned in V1. The lock may record its subtree digest,
but `agentPackRef` must equal `foundationRef`.

Updates compare the lock baseline with current files. A user-modified managed
file produces a conflict report or review PR; it is never overwritten silently.

## Synclair lifecycle configurations

Both primary configurations use the existing `embedded` topology. The
difference is delivery strategy.

### Option A — mainline embedded

Default for new projects.

- Product and Synclair live on `main` after the first PR merges.
- Normal feature work branches from `main`.
- Foundation updates target `main` through PRs.
- Product deployment excludes the Synclair runtime from its build artifact.

### Option B — overlay embedded

For repositories where the full Synclair hub must not live on production
history.

- Product source and portable governance remain on `main`.
- The full Synclair hub and generated review artifacts live on a long-lived
  `synclair/overlay` branch.
- Product work continues from `main`; the overlay is refreshed from it.
- Shared overlays merge `main` into the overlay.
- Explicitly single-owner overlays may rebase onto `main` and use
  force-with-lease only on the overlay.
- Promotion to `main` is product-path-only and occurs through a separate PR.
- Protected `main` is never rebased, force-pushed, or rewritten.
- Root agent doorways and product knowledge required to build the product stay
  on `main`; the full hub runtime, generated catalogs, and review-only artifacts
  stay on the overlay. The lock records a main projection and an overlay
  projection tied to the same foundation release.

The sibling watcher remains an advanced escape hatch for repositories that
cannot accept Synclair files. It is schema-compatible but not a hosted V1
creation path until the two embedded modes are proven.

## Bootstrap state machine

```text
draft
  -> validating
  -> ready_to_create
  -> repository_creating
  -> main_seeding
  -> main_protecting
  -> generation_queued
  -> generation_planning
  -> branch_writing
  -> pr_opening
  -> awaiting_checks
  -> preview_ready
  -> review_ready
  -> merged_observed
  -> awaiting_production_approval
  -> staged_production_ready
  -> production_promoted
```

Overlay runs insert explicit states after `preview_ready`:

```text
overlay_review_ready
  -> overlay_merged_observed
  -> product_promotion_planning
  -> product_promotion_pr_open
  -> product_promotion_review_ready
  -> product_promotion_merged_observed
  -> awaiting_production_approval
```

Every active state can become `blocked`, `failed_retryable`,
`failed_terminal`, or `canceling`. Cancellation preserves external evidence and
never deletes a repository by default. After merge, recovery is a revert or
repair run rather than cancellation.

Every provider mutation has an idempotency key. Retry reconciles live state
before acting and reuses matching repositories, branches, PRs, and deployments.

## Update policies

| Policy | Behavior |
|---|---|
| `manual` | No branch until the operator selects an immutable release. |
| `recommended` | Show compatibility and changes; branch only after operator action. |
| `automatic` | Weekly compatibility run; open or refresh one verified PR if green. |

Automatic means automatic PR preparation only. It never merges, rewrites
`main`, changes production, or updates project-owned skills. Governance,
authentication, workflow, or provider-policy changes always require manual
review even when automatic updates are enabled.

## Hosted control-plane experience

V1 screens:

1. **Projects** — actionable health, preview, production, lifecycle, and update
   status.
2. **New project wizard** — resumable product, starter, framework, layout,
   lifecycle, update, delivery, and review steps.
3. **Provisioning run** — durable timeline, sanitized logs, checkpoints,
   retries, and external links.
4. **Project overview** — manifest validity, deployed commit, preview, open PR,
   foundation freshness, and overlay divergence.
5. **Review workspace** — exact-SHA preview, checks, generated-path summary,
   and change requests; no production action.
6. **Production approval** — exact staged deployment, SHA, evidence, promoter,
   and rollback target.
7. **Synclair updates** — available releases, compatibility, diff, update mode,
   failed runs, and PRs.
8. **Activity and recovery** — append-only operator and automation history.
9. **Connections** — GitHub and Vercel health, scope, reconnect, and revoke;
   never credential values.

## Authentication and authorization

V1 is private and Cellfade-only.

- Authenticate with a private GitHub App.
- Authorize by immutable GitHub numeric account ID.
- Require the configured Cellfade account allowlist; if Cellfade becomes an
  organization, also require live organization/team membership.
- Recheck authorization before privileged mutations.
- Use expiring user-to-server tokens for user-attributed actions.
- Use separate machine capabilities for identity, provisioning, and updates.
- Mint short-lived, exact-repository installation tokens just in time.
- Keep provider credentials server-side and out of previews, sandboxes, model
  prompts, manifests, artifacts, and logs.

Phase 0 resolves whether `cellfade` is a personal account or organization. A
personal account uses an immutable numeric-user allowlist. Organization mode
additionally requires live organization/team membership at login and before
each privileged mutation.

Every mutation crosses one shared authorization function that binds the
authenticated actor, numeric repository ID, project ID, and capability. Route
grouping is not authorization. Session IDs rotate after login and privilege
changes; encrypted server-side session material is versioned for key rotation
and revoked on GitHub authorization or App-installation revocation.

Provider capabilities are separate and testable:

| Capability | Allowed | Prohibited |
|---|---|---|
| Identity | Login and account/membership reads | Repository writes |
| Provisioner | Explicit private-repo creation, seed, protection | Cron/update use, merge, production |
| Updater | Selected-repo branches, commits, PRs, status reads | Administration, workflows, secrets, environments, merge, bypass |
| Vercel provisioner | Selected-team project/link/preview configuration | Production promotion |
| Production promoter | Exact staged deployment promotion after approval | Scheduled or agent invocation |

Short-lived tokens are downscoped to one numeric repository and the minimum
permission subset. Private keys are isolated by process role; the general web
and scheduled-update workers cannot access the provisioner key.

The application does not implement merge for automated identities. Updater and
provisioner identities have no ruleset bypass.

## Job and agent isolation

Use durable jobs with at-least-once semantics and explicit idempotency. Vercel
Queues/Workflow may provide transport when stable enough; the domain workflow
state remains in Postgres so the queue can be replaced.

Vercel Queue is a beta transport, not a domain dependency. Production hosted
mutation jobs require either a proven Queue push consumer or an approved
dedicated worker deployment. Postgres polling is local/development fallback
only and does not claim the 30-second production queue target. If neither
production transport passes preflight, the hosted UI remains read-only and the
local CLI remains the supported mutation path.

Use Vercel Sandbox or an equivalent Firecracker-isolated worker for generated
or agent-modified code:

- fresh workspace per run;
- no GitHub, Vercel, database, or production credentials;
- deny network by default and allow only fixed setup endpoints when necessary;
- fixed executable/argument arrays with `shell: false`;
- CPU, memory, disk, output, network, token, and duration limits;
- no shared checkout;
- no arbitrary repository-provided command execution;
- no `git add -A`;
- patch validation outside the sandbox; and
- a separate publisher that commits only the validated file manifest.

Generated repository CI, not the privileged publisher, performs dependency
installation, tests, and builds. If the control plane executes them for richer
preflight evidence, it does so only in the credential-free sandbox.

## GitHub delivery policy

The first commit contains only governance and the valid manifest. Immediately
afterward, protect `main` with:

- PR required;
- one human approval;
- stale approval dismissal;
- most-recent-push approval;
- required checks;
- conversation resolution;
- no force push;
- no branch deletion;
- no App bypass; and
- CODEOWNER review for workflows, authentication, provider configuration,
  generator policy, and lock files.

The setup branch is created from the exact governance seed SHA. Product code
and Synclair enter through the first PR.

Protection is fail-closed. Successful API readback and negative direct-push
tests from human and App fixtures are prerequisites for Vercel linking, branch
publication, and PR creation. A partial bootstrap that seeds `main` but cannot
prove protection enters `blocked` and performs no later mutation.

PR/update validation runs with `contents: read`, no environment, no provider or
production secrets, and no write-capable job. A privileged publisher never
checks out executable PR content; it consumes only an externally validated,
replay-bound patch artifact.

## Vercel delivery policy

- Connect only the selected private repository.
- Create protected previews for PR commits.
- Keep preview credentials separate from production.
- Require preview readiness before review-ready status.
- After merge, create a staged production deployment from the exact `main` SHA.
- Disable automatic assignment of production domains.
- Require a separate human promotion of the staged deployment.
- Record deployment ID, SHA, actor, checks, and timestamp.
- Keep a tested rollback to the previous production deployment.
- Authenticate Vercel webhooks from the raw body, deduplicate deliveries, reject
  stale/replayed events, and bind team, project, repository, and exact SHA.
- Authenticate weekly triggers with a production-only platform/cron secret,
  constant-time comparison, rate limits, environment checks, and a global kill
  switch.

If the current GitHub/Vercel plan cannot enforce private environment reviewers,
the Vercel dashboard promotion remains the production approval boundary. In
that mode, the control plane records and verifies the human dashboard promotion
through provider observation; it never stores a production-promotion token.

## Persistence model

Postgres entities:

- `users`
- `sessions`
- `provider_connections`
- `project_drafts`
- `projects`
- `repositories`
- `generation_runs`
- `run_steps`
- `pull_requests`
- `deployments`
- `update_candidates`
- `approvals`
- `webhook_deliveries`
- `audit_events`

Audit events are append-only. Application credentials cannot update or delete
them. Store structured, redacted evidence rather than raw model transcripts.
Periodically sign/hash-chain and export audit checkpoints to separate durable
storage so a database administrator cannot rewrite history invisibly.

The secret store is a first-class port implemented before provider clients. It
supports envelope encryption, key versions, rotation, revocation, environment
separation, and handles to credentials rather than credential values in job
payloads. V1 keeps encrypted records in Postgres but sources the active KEK
only from the Vercel production environment (`SYNCLAIR_SECRETSTORE_KEK_V1`) for
the explicitly approved web/provisioner/worker roles. Preview, generated CI,
and Sandbox never receive it. Prior key versions remain decrypt-only during
rotation; missing key material fails closed, and backup/restore drills cover
both ciphertext and externally retained key material.

## Operational targets

- One active mutation run per repository.
- Initial global worker concurrency: three.
- Same manifest and pinned versions produce identical plan hashes across macOS
  and Linux.
- Retry never creates duplicate provider resources.
- Webhook delivery IDs are deduplicated.
- P95 queued bootstrap starts within 30 seconds.
- P95 setup PR opens within 15 minutes, excluding provider outages.
- Provider status appears within five seconds of a received webhook.
- Internal availability target: 99.5%.
- Database RPO no worse than five minutes; RTO no worse than four hours.
- Security and mutation audit retention: 180 days.
- Per-user, repository, sandbox, and provider-operation rate limits and budgets.
- Backup, restore, provider revocation, and audit-checkpoint drills before
  production promotion is enabled.

## Explicit non-goals for V1

- Public SaaS or customer multi-tenancy.
- Billing, invitations, or generalized RBAC.
- Arbitrary framework or package-manager execution.
- Full MVP generation.
- Backend, database, or production-data generation in product starters.
- Automatic merge or production promotion.
- Automatic semantic conflict resolution.
- Storing credentials in product repositories.
- Reusing ToolBelt-specific AWS, Terraform, service, or product data.
- Treating generated Synclair maps as authoritative without freshness and
  provenance evidence.

## Acceptance definition

The design is complete when the same manifest can create the same verified
project locally and through the hosted control plane; all three adapters pass
their golden and real-repository matrices; Option A and Option B are proven;
GitHub produces a private protected repository and first PR; Vercel produces a
protected exact-SHA preview; weekly updates stop at PRs; and production remains
unchanged until a separate human promotes the staged deployment.
