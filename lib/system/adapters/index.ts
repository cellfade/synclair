import type { Preview } from "../doc-types"
import { getSurface, type SurfacePlatform } from "../surfaces"
import { reactNativeAdapter } from "./react-native"
import type { PreviewAdapter } from "./types"
import { webShadcnAdapter } from "./web-shadcn"

/**
 * Gallery preview adapters, keyed by surface platform (see
 * `docs/foundation-model.md` §5 and `lib/system/surfaces.ts`).
 *
 * Multi-surface projects have adapters COEXISTING — a web `button` and an RN
 * `button` each depicted by their own adapter — so resolution is per item
 * (`adapterFor(item.surface)`), not a global swap. Single-surface projects
 * resolve to `web-shadcn` everywhere, exactly the old singleton behavior.
 */
const fallbackAdapter: PreviewAdapter = {
  // Platforms without live rendering in the hub (yet): screenshots/embeds/code.
  id: "static",
  renderPreview(preview: Preview) {
    return preview.kind === "live" ? null : webShadcnAdapter.renderPreview(preview)
  },
}

const ADAPTERS: Record<SurfacePlatform, PreviewAdapter> = {
  web: webShadcnAdapter,
  "react-native": reactNativeAdapter,
  swiftui: fallbackAdapter,
  android: fallbackAdapter,
}

/**
 * Resolve the adapter for an item's surface. Unknown/absent surface (every
 * single-surface project) → `web-shadcn`, today's behavior.
 */
export function adapterFor(surfaceId?: string): PreviewAdapter {
  const platform = getSurface(surfaceId)?.platform
  return platform ? ADAPTERS[platform] : webShadcnAdapter
}

export type { PreviewAdapter } from "./types"
