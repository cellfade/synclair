# Manual Option A pilot

This runbook is the first real test of the Synclair foundation before the
private multi-framework factory exists. It creates a private product repository
with a small governance seed on `main`, then reviews the application and the
embedded Synclair hub through a setup pull request and Vercel preview.

The pilot proves the manual contract. It does not claim that Vite, Next.js, or
Astro generation has been automated yet.

## Target outcome

```text
private cellfade/<product>
├── apps/web/                 selected product framework
├── synclair/                 exact foundation revision
├── synclair.project.json     reproducible setup decisions
├── .github/                  ownership and CI shell
└── README.md                 product and local verification entrypoint
```

- **Delivery:** Option A, `mainline`
- **Topology:** `embedded`
- **Product layout:** `apps/web`
- **Review:** `codex/synclair-setup` pull request
- **Deployment:** Vercel preview for `apps/web`
- **Production:** disabled until a later, explicit approval

## Entry gate

Do not begin provider changes from an unmerged foundation branch. First merge
the reviewed foundation PR, then record the resulting exact **40-character commit SHA**
as `FOUNDATION_SHA`. A branch name such as `main` is not a valid
pilot input.

Before any external write, verify locally:

```bash
gh auth status
node --version
git --version
```

Resolve and prove the immutable foundation revision before putting it in the
manifest:

```bash
FOUNDATION_SHA="<approved-merged-40-character-sha>"
gh api "repos/cellfade/synclair/commits/$FOUNDATION_SHA" --jq .sha
```

The returned SHA must equal `FOUNDATION_SHA` exactly. Create a new empty local
workspace; never use the neutral foundation checkout as the product target:

```bash
mkdir <product-slug>
cd <product-slug>
git init -b main
git config user.name cellfade
git config user.email 44656818+cellfade@users.noreply.github.com
```

Run the repository-contained `project-bootstrap` skill and choose:

- a new application;
- one framework (`vite-react`, `nextjs`, or `astro`);
- `apps/web` layout;
- Option A / `mainline` delivery;
- `embedded` topology at `synclair/`;
- `recommended` foundation updates for the first pilot;
- private `cellfade` ownership;
- required PR review and Vercel preview;
- no automatic production deployment.

The skill produces `synclair.project.json`. Review it before continuing. Its
foundation commit must equal `FOUNDATION_SHA`.

From the foundation checkout, validate the local manifest and generate the
deterministic governance files without contacting a provider:

```bash
node <foundation-checkout>/scripts/validate-project-manifest.mjs \
  <product-workspace>/synclair.project.json \
  --verify-remote
node <foundation-checkout>/scripts/scaffold-pilot-governance.mjs \
  --target <product-workspace> \
  --manifest <product-workspace>/synclair.project.json
```

## Approval boundary 1 — private repository and governance seed

Show the repository name and exact initial file plan. After explicit approval,
create the repository as private and place only this governance seed on `main`:

- `README.md`;
- `.gitignore` and `.editorconfig`;
- `synclair.project.json`;
- `.github/CODEOWNERS`;
- `.github/ruleset-main.json`;
- a minimal `.github/workflows/ci.yml` shell;
- repository-rules documentation.

The seed precedes application scaffolding. Configure rules to require a pull
request, review, resolved conversations, and no force-push or branch deletion.
Read the repository visibility and rule state back before proceeding. If private
visibility or the required rule state cannot be proven, stop.

After approval, commit exactly the reviewed seed, create the private repository,
push only `main`, and read the target back:

```bash
git add README.md .gitignore .editorconfig synclair.project.json .github docs/repository-rules.md
git commit -m "Establish private project governance seed"
gh auth status
gh repo create cellfade/<product-slug> --private --source=. --remote=origin --push
gh repo view cellfade/<product-slug> \
  --json nameWithOwner,visibility,defaultBranchRef
gh api --method POST repos/cellfade/<product-slug>/rulesets \
  --input .github/ruleset-main.json
RULESET_ID="$(gh api repos/cellfade/<product-slug>/rulesets \
  --jq '.[] | select(.name == "main-governance" and .enforcement == "active") | .id')"
test -n "$RULESET_ID"
gh api "repos/cellfade/<product-slug>/rulesets/$RULESET_ID" | jq -e '
  (.rules | map(.type) | index("deletion") != null) and
  (.rules | map(.type) | index("non_fast_forward") != null) and
  (.rules | map(select(.type == "pull_request" and
    .parameters.required_approving_review_count == 1 and
    .parameters.required_review_thread_resolution == true)) | length == 1)'
```

The readback must show the approved owner, private visibility, `main`, and the
required rule state. Confirm that an eligible human reviewer exists before
making approval mandatory. GitHub plan limitations are a failed gate, not
permission to claim rules are enforced.

The spending policy is a **zero-dollar spending cap**, not a claim that Actions
cost nothing. The foundation verification workflow runs on foundation pull
requests and can consume included Actions minutes; the catalog workflow is
separately path-filtered. Foundation release and the generated product CI shell
are manual dispatch only. Do not approve paid overages. If included minutes are
unavailable, run the same gates locally and record that provider checks did not
run; change required-check policy only through a separate reviewed decision.

## Build the setup branch

Create `codex/synclair-setup` from the exact governance-seed `main` SHA. Do not
develop directly on `main`.

The first real pilot deliberately selects the Vite React adapter. Scaffold only
at `apps/web` with the pinned generator, create and commit its lockfile, and add
one representative product route:

```bash
git switch -c codex/synclair-setup
npm create vite@9.1.1 apps/web -- --template react-ts
npm --prefix apps/web install
```

Do not invent authentication, billing, backend services, or extra application
scope. Next.js and Astro remain declared factory targets, not claims made by this
first Vite pilot.

Install the foundation from its immutable revision:

```bash
git subtree add \
  --prefix synclair \
  https://github.com/cellfade/synclair.git \
  "$FOUNDATION_SHA" \
  --squash
```

This command requires authenticated access to the private repository. If HTTPS
Git authentication is not already connected, run `gh auth setup-git` and retry;
never place a token in the command, remote URL, manifest, or shell history.

Reset the neutral seed before recording any project topology. Pass the immutable
foundation revision so the subtree does not mistake the parent product commit
for the upstream baseline:

```bash
synclair/scripts/synclair-reset.sh synclair --yes --foundation-commit "$FOUNDATION_SHA"
```

Reseed the project identity, surfaces, brand, and knowledge. Only then record
`synclair/data/setup.json` as `embedded` and generate the root ambient agent
doorways:

```bash
node synclair/scripts/record-setup-mode.mjs embedded
node synclair/scripts/bridge-agents.mjs
node synclair/scripts/validate-project-manifest.mjs \
  synclair.project.json \
  --verify-remote \
  --check-subtree \
  --repository-root .
```

The complete skills and agents remain pinned inside `synclair/.claude/`. The
root bridge is intentionally small; it does not copy the entire agent pack into
the product root. Foundation updates stay manual or recommended through normal
reviewed pull requests for this pilot.

## Local verification gate

Bootstrap the ignored, checksum-verified local tools and manifest, then run the
full Synclair gate:

```bash
npm --prefix synclair ci
npm --prefix synclair run bootstrap:foundation
npm --prefix synclair run verify:foundation
```

Run the Vite pilot's committed gates independently. Its default `build` includes
TypeScript; no unit-test command exists in the untouched scaffold, so record
“not configured” rather than claiming a unit suite ran:

```bash
npm --prefix apps/web run lint
npm --prefix apps/web run build
```

Then start the hub:

```bash
npm --prefix synclair run dev
```

Inspect `http://localhost:4100/synclair` on desktop and mobile. Confirm the hub
loads, search and navigation work, the console is clean, and the product and
Synclair checks do not traverse each other's build inputs.

Commit only the declared setup files. Record:

- governance-seed base SHA;
- setup head SHA;
- foundation SHA;
- product verification results;
- Synclair verification results;
- desktop and mobile hub evidence.

## Approval boundary 2 — push and pull request

Show the diff, exact commits, and verification evidence. After explicit
approval, push `codex/synclair-setup` and open a pull request to `main`.

The pull request description must identify Option A, embedded topology,
`apps/web`, the immutable foundation SHA, local test evidence, known
limitations, and the production stop. Human review is required. Do not merge as
part of opening the PR.

## Approval boundary 3 — Vercel preview

Defer Git integration until the factory can configure and read back staged
production controls. For this pilot, use a preview-only CLI deployment from the
reviewed setup-branch checkout. First show the user the exact Cellfade Vercel
scope, new project name, product root, setup SHA, and command. After separate
explicit approval, verify the exact CLI, bind the local product root to the
approved project name, and read the project back before any deployment:

```bash
VERCEL_SCOPE="<confirmed-cellfade-scope>"
VERCEL_PROJECT="<approved-project-name>"
npx vercel@54.14.2 --version
npx vercel@54.14.2 whoami --scope "$VERCEL_SCOPE"
npx vercel@54.14.2 link --yes --cwd apps/web \
  --scope "$VERCEL_SCOPE" \
  --project "$VERCEL_PROJECT"
npx vercel@54.14.2 project inspect "$VERCEL_PROJECT" \
  --scope "$VERCEL_SCOPE"
```

The inspect result and `apps/web/.vercel/project.json` must identify the approved
scope and project. Stop before deployment if they differ. Then create the preview
without `--prod` and bind it to the approved project explicitly:

```bash
SETUP_SHA="$(git rev-parse HEAD)"
npx vercel@54.14.2 deploy apps/web --yes \
  --scope "$VERCEL_SCOPE" \
  --project "$VERCEL_PROJECT" \
  --meta synclairGitSha="$SETUP_SHA"
```

Treat the returned URL as a preview only. Run
`npx vercel@54.14.2 inspect <preview-url>` and verify the intended team, project,
Preview environment, and `synclairGitSha` metadata. If any value is absent or
different, stop; do not accept the deployment as evidence. Keep `.vercel/` local
and uncommitted.

The pinned Vite and Vercel commands still execute exact-version public registry
packages during this manual pilot. That residual supply-chain dependency is
accepted only for the pilot; the released factory must carry lockfile or checksum
provenance for its generators and provider CLI.

Review the actual preview at desktop and mobile widths, exercise its primary
interaction, and check browser console health. Record the preview URL and SHA in
the PR evidence without adding provider credentials to git.

## Stop before production

The successful pilot endpoint is an open, reviewed setup pull request with a
verified Vercel preview. Stop before production: do not connect Git, merge,
create or assign a production domain, deploy with `--prod`, promote a
deployment, or delete pilot resources without a new explicit approval naming
that action.

## Pass criteria

- The GitHub repository is private and begins with the governance seed.
- `synclair.project.json` can explain every setup decision.
- Product and Synclair occupy their declared independent roots.
- The exact foundation SHA is recoverable from the subtree and manifest.
- Local product and Synclair gates pass from a clean clone after one documented
  bootstrap command.
- The setup arrives through a pull request, not a direct main push.
- The Vercel preview renders the exact PR head SHA.
- Nothing merged or reached production automatically.

If any item fails, keep the PR open, record the evidence, and fix the foundation
or runbook before using another project as a test subject.
