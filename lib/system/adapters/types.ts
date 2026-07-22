import type { ReactNode } from "react"

import type { Preview } from "../doc-types"

/**
 * The gallery preview seam (see `docs/foundation-model.md` §5).
 *
 * Synclair's hub UI is always Next + shadcn, but the design system it depicts
 * can target a different platform. This interface controls only how previews
 * appear inside that hub. It is deliberately not a project generator or
 * delivery adapter.
 */
export interface PreviewAdapter {
  /** e.g. "web-shadcn" | "react-native" | "swiftui". */
  id: string

  /** How a `Preview` is depicted in the gallery. */
  renderPreview(preview: Preview): ReactNode
}
