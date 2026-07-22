/**
 * Canonical Cellfade foundation lineage.
 *
 * Runtime code imports this module. Shell/Node distribution scripts cannot
 * import TypeScript directly, so `scripts/check-cellfade-foundation.mjs`
 * enforces their literals against this source during every verification run.
 */
export const FOUNDATION_LINEAGE = Object.freeze({
  repository: "cellfade/synclair",
  repositoryUrl: "https://github.com/cellfade/synclair",
  gitUrl: "https://github.com/cellfade/synclair.git",
  defaultBranch: "main",
  visibility: "private",
  publicLineageRepository: "joshuaiwata/synclair",
  publicLineageUrl: "https://github.com/joshuaiwata/synclair",
} as const)

export type FoundationLineage = typeof FOUNDATION_LINEAGE
