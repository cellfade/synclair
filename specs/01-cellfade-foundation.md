# Cellfade Synclair foundation acceptance specification

## Purpose

Keep `cellfade/synclair` reusable as a neutral private foundation that can be
cloned for a new product, paired beside an existing product, or attached inside
an existing product repository without carrying another project's seed.

## AC-1 — Foundation seed remains neutral

- **Given** the Cellfade foundation checkout
- **When** the foundation gate runs
- **Then** project identity is the neutral `Your Product` placeholder
- **And** brand, knowledge, host catalog, system map, pages map, summaries, and
  dev-server records are empty
- **And** setup mode is unresolved

## AC-2 — Downstream updates resolve through Cellfade

- **Given** a project cloned from this foundation
- **When** call-home or the sync helper resolves its mother repository
- **Then** it resolves `cellfade/synclair`
- **And** the repository skill identifies `cellfade/synclair` as the Cellfade
  mother
- **And** registry metadata points to the Cellfade repository

## AC-3 — All supported adoption paths are documented

- **Given** a Cellfade builder starting or adopting a project
- **When** they read the internal adoption guide
- **Then** it provides commands for a new embedded project
- **And** a sibling watcher for an existing project
- **And** a subtree-based embedded attachment for an existing repository
- **And** every GitHub repository creation command specifies private visibility

## AC-4 — Safety hardening cannot silently regress

- **Given** a foundation sync with unresolved merge conflicts
- **When** the sync helper reaches baseline handling
- **Then** its conflict stop precedes baseline stamping
- **Given** a process listening on the preferred preview port that is not owned
  by this checkout
- **When** preview reclamation is evaluated
- **Then** the helper does not merge arbitrary port-listener PIDs into its kill
  list

## AC-5 — Synclair integrity remains green

- **Given** the locked dependency graph is installed
- **When** `npm run verify-ui` runs
- **Then** the Cellfade foundation gate, typecheck, lint, registry, previews, UX
  docs, foundation purity, pages map, and agent bridge checks all pass

## Traceability

| Criterion | Automated evidence |
|---|---|
| AC-1 | `scripts/check-cellfade-foundation.mjs` neutral seed assertions |
| AC-2 | `scripts/check-cellfade-foundation.mjs` lineage assertions |
| AC-3 | `scripts/check-cellfade-foundation.mjs` adoption-guide assertions |
| AC-4 | `scripts/check-cellfade-foundation.mjs` helper safety assertions |
| AC-5 | `npm run verify-ui` aggregate gate |
