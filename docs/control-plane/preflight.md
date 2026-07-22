# Control-plane execution preflight

This document is the secret-free execution contract and report template for the
private Synclair control plane. Complete the evidence fields only from approved,
read-only provider checks. Record identifiers and capability states, never
credentials, cookies, authorization headers, private keys, or environment
values.

## Fixed contract

- GitHub owner: `cellfade`
- Repository visibility: `private`
- Foundation repository: `cellfade/synclair`
- Control-plane repository: `cellfade/synclair-control-plane`
- Node.js: `22.x`; record the exact patch version in the execution report.
- pnpm: `10.x`; record the exact patch version in the execution report.
- Vercel CLI: the exact version in `tools/vercel-cli.version`.

## Provider evidence report

The unexecuted template intentionally contains no account or team identifiers.
Populate these fields only after the corresponding read-only check succeeds.

| Evidence | Status | Recorded value |
|---|---|---|
| GitHub immutable owner ID and owner type | not recorded | — |
| GitHub operator immutable ID | not recorded | — |
| Foundation repository immutable ID | not recorded | — |
| Vercel authenticated user ID | not recorded | — |
| Vercel target team ID | not recorded | — |
| Vercel plan/tier | not recorded | — |

Vercel scope status: `not recorded`

Capability results use `available`, `unavailable`, or `not checked`. An
`unavailable` result must include the named adapter fallback from
`config/vercel-capability-policy.json`.

| Vercel capability | Status | Evidence source | Adapter fallback |
|---|---|---|---|
| Protected private previews | not checked | — | — |
| Staged production without automatic domain assignment | not checked | — | — |
| Sandbox isolation | not checked | — | — |
| Queue or Workflow durable transport | not checked | — | — |
| Postgres/database | not checked | — | — |

## External-write boundaries

Plan approval does not authorize external mutation. Pause for separate,
explicit human approval before each boundary:

1. foundation source PR merge and foundation release/tag publication;
2. control-plane repository creation and its initial governance push;
3. provider integration registration or permission changes in GitHub or Vercel;
4. creation or deletion of provider-backed dogfood repositories/projects;
5. control-plane implementation PR merge; and
6. staged production promotion or rollback of a live deployment.

Read-only identity, capability, and policy checks may prepare this report. A
failed, ambiguous, or unavailable check leaves its status unresolved and blocks
dependent external writes.
