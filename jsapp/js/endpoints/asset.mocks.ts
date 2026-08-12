import { http, HttpResponse } from 'msw'
import { endpoints } from '#/api.endpoints'
import type { AssetResponse } from '#/dataInterface'

interface AssetPatchMockOptions<TPayload> {
  asset: AssetResponse
  applyPatch: (asset: AssetResponse, payload: TPayload) => void
  onPatch?: (asset: AssetResponse, payload: TPayload) => void
  persistMutations?: boolean
}

// Storybook handlers often need isolated copies so one interaction test does
// not leak mutations into the next render.
const cloneAsset = (asset: AssetResponse): AssetResponse => JSON.parse(JSON.stringify(asset)) as AssetResponse

/**
 * Builds a reusable PATCH handler for single-asset stories while keeping the in-memory asset mutable.
 *
 * This custom handler is kept because it has stateful logic that Orval cannot generate.
 * For simple GET requests, use getApiV2AssetsRetrieveMockHandler from Orval instead.
 */
export const assetPatchMock = <TPayload>({
  asset,
  applyPatch,
  onPatch,
  persistMutations = true,
}: AssetPatchMockOptions<TPayload>) => {
  const currentAsset = cloneAsset(asset)

  return http.patch(endpoints.ASSET_URL, async ({ params, request }) => {
    if (params.uid !== asset.uid) {
      return HttpResponse.json({ detail: 'asset not found' }, { status: 404 })
    }

    const payload = (await request.json()) as TPayload

    // `persistMutations` lets stories opt into stateless request handling so
    // repeated play runs do not inherit state from previous runs.
    const targetAsset = persistMutations ? currentAsset : cloneAsset(asset)

    applyPatch(targetAsset, payload)

    // Give assertions a fresh snapshot so later mutations do not retroactively
    // change what the test thought was saved.
    const responseAsset = cloneAsset(targetAsset)
    onPatch?.(responseAsset, payload)

    return HttpResponse.json(responseAsset)
  })
}
