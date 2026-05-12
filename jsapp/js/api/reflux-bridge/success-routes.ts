import { actions } from '#/actions'
import type { BridgeSuccessRoute } from './shared'
import { getLegacyDeploymentAsset, isRecord, toLegacyAssetFromUnknown } from './shared'

/**
 * Response-time success routes.
 *
 * Add entries here when a successful mutation should refresh legacy Reflux `*.completed` listeners.
 */
export const BRIDGE_SUCCESS_ROUTES: ReadonlyArray<BridgeSuccessRoute> = [
  {
    endpoint: 'PATCH /api/v2/assets/:uid/',
    refluxAction: 'actions.resources.updateAsset.completed',
    method: 'PATCH',
    matches: ({ assetUid, responseData, requestBody }) =>
      Boolean(
        assetUid &&
          isRecord(responseData) &&
          requestBody &&
          !('report_styles' in requestBody) &&
          !('report_custom' in requestBody) &&
          !('map_styles' in requestBody),
      ),
    run: ({ responseData }) => {
      actions.resources.updateAsset.completed(toLegacyAssetFromUnknown(responseData))
    },
  },
  {
    endpoint: 'PATCH /api/v2/assets/:uid/',
    refluxAction: 'actions.reports.setStyle.completed',
    method: 'PATCH',
    matches: ({ assetUid, responseData, requestBody }) =>
      Boolean(assetUid && isRecord(responseData) && requestBody && 'report_styles' in requestBody),
    run: ({ responseData }) => {
      const asset = toLegacyAssetFromUnknown(responseData)
      actions.reports.setStyle.completed(asset)
      actions.resources.updateAsset.completed(asset)
    },
  },
  {
    endpoint: 'PATCH /api/v2/assets/:uid/',
    refluxAction: 'actions.resources.updateAsset.completed (report_custom fallback)',
    method: 'PATCH',
    matches: ({ assetUid, responseData, requestBody }) =>
      Boolean(assetUid && isRecord(responseData) && requestBody && 'report_custom' in requestBody),
    run: ({ responseData }) => {
      const asset = toLegacyAssetFromUnknown(responseData)
      // Legacy `setCustom.completed` expects `(asset, crid)`, but `crid` is not reliably recoverable from generic PATCH
      // payloads intercepted in Orval mutator. We intentionally emit `updateAsset.completed` only and accept that one
      // listener from `reports.tsx` relying specifically on `crid` will not run on this path.
      actions.resources.updateAsset.completed(asset)
    },
  },
  {
    endpoint: 'PATCH /api/v2/assets/:uid/',
    refluxAction: 'actions.map.setMapStyles.completed',
    method: 'PATCH',
    matches: ({ assetUid, responseData, requestBody }) =>
      Boolean(assetUid && isRecord(responseData) && requestBody && 'map_styles' in requestBody),
    run: ({ responseData }) => {
      // This is response-time only; `started` is emitted separately in the start route table.
      const asset = toLegacyAssetFromUnknown(responseData)
      actions.map.setMapStyles.completed(asset)
      actions.resources.updateAsset.completed(asset)
    },
  },
  {
    endpoint: 'POST /api/v2/assets/',
    refluxAction: 'actions.resources.createResource.completed | actions.resources.cloneAsset.completed',
    method: 'POST',
    matches: ({ pathname, responseData }) => pathname === '/api/v2/assets/' && isRecord(responseData),
    run: ({ responseData, requestBody }) => {
      // Same endpoint powers both create and clone, so keep the branch here.
      const legacyAsset = toLegacyAssetFromUnknown(responseData)

      if (typeof requestBody?.clone_from === 'string' && requestBody.clone_from.length > 0) {
        actions.resources.cloneAsset.completed(legacyAsset)
        return
      }

      actions.resources.createResource.completed(legacyAsset)
    },
  },
  {
    endpoint: 'DELETE /api/v2/assets/:uid/',
    refluxAction: 'actions.resources.deleteAsset.completed',
    method: 'DELETE',
    matches: ({ assetUid }) => Boolean(assetUid),
    run: ({ assetUid }) => {
      if (assetUid) {
        // We don't have a nice simple way of getting assetType. It is required
        // by a few components in Library code, we will fix up the code in there
        // to avoid over-engineering here.
        actions.resources.deleteAsset.completed({ uid: assetUid, assetType: '' })
      }
    },
  },
  {
    endpoint: 'POST /api/v2/assets/:uid/deployment/',
    refluxAction: 'actions.resources.deployAsset.completed',
    method: 'POST',
    matches: ({ deploymentAssetUid, responseData }) =>
      Boolean(deploymentAssetUid && getLegacyDeploymentAsset(responseData)),
    run: ({ responseData }) => {
      const asset = getLegacyDeploymentAsset(responseData)
      if (!asset) {
        return
      }

      actions.resources.deployAsset.completed(asset)
    },
  },
  {
    endpoint: 'PATCH /api/v2/assets/:uid/deployment/',
    refluxAction: 'actions.resources.setDeploymentActive.completed',
    method: 'PATCH',
    matches: ({ deploymentAssetUid, responseData }) =>
      Boolean(deploymentAssetUid && getLegacyDeploymentAsset(responseData)),
    run: ({ responseData }) => {
      const asset = getLegacyDeploymentAsset(responseData)
      if (!asset) {
        return
      }

      actions.resources.setDeploymentActive.completed(asset)
    },
  },
]
