import { actions } from '#/actions'
import { endpoints } from '#/api.endpoints'
import type { BridgeSuccessHandler } from './shared'
import { SpecializedAssetPatchField, getLegacyDeploymentAsset, isRecord, toLegacyAssetFromUnknown } from './shared'

/**
 * Response-time success handlers.
 *
 * Add entries here when a successful mutation should refresh legacy Reflux `*.completed` listeners.
 */
export const BRIDGE_SUCCESS_HANDLERS: ReadonlyArray<BridgeSuccessHandler> = [
  {
    endpoint: `PATCH ${endpoints.ASSET_URL}`,
    refluxAction: 'actions.resources.updateAsset.completed',
    matches: ({ assetUid, responseData, requestBody }) =>
      Boolean(
        assetUid &&
          isRecord(responseData) &&
          requestBody &&
          !Object.values(SpecializedAssetPatchField).some((field) => field in requestBody),
      ),
    run: ({ responseData }) => {
      actions.resources.updateAsset.completed(toLegacyAssetFromUnknown(responseData))
    },
  },
  {
    endpoint: `PATCH ${endpoints.ASSET_URL}`,
    refluxAction: 'actions.reports.setStyle.completed',
    matches: ({ assetUid, responseData, requestBody }) =>
      Boolean(
        assetUid && isRecord(responseData) && requestBody && SpecializedAssetPatchField.ReportStyles in requestBody,
      ),
    run: ({ responseData }) => {
      const asset = toLegacyAssetFromUnknown(responseData)
      actions.reports.setStyle.completed(asset)
      actions.resources.updateAsset.completed(asset)
    },
  },
  {
    endpoint: `PATCH ${endpoints.ASSET_URL}`,
    refluxAction: 'actions.resources.updateAsset.completed (report_custom fallback)',
    matches: ({ assetUid, responseData, requestBody }) =>
      Boolean(
        assetUid && isRecord(responseData) && requestBody && SpecializedAssetPatchField.ReportCustom in requestBody,
      ),
    run: ({ responseData }) => {
      const asset = toLegacyAssetFromUnknown(responseData)
      // Legacy `setCustom.completed` expects `(asset, crid)`, but `crid` is not reliably recoverable from generic
      // PATCH payloads intercepted in Orval mutator. We intentionally emit `updateAsset.completed` only and accept
      // that one listener from `reports.tsx` that relies on `crid` will not run on this path.
      actions.resources.updateAsset.completed(asset)
    },
  },
  {
    endpoint: `PATCH ${endpoints.ASSET_URL}`,
    refluxAction: 'actions.map.setMapStyles.completed',
    matches: ({ assetUid, responseData, requestBody }) =>
      Boolean(assetUid && isRecord(responseData) && requestBody && SpecializedAssetPatchField.MapStyles in requestBody),
    run: ({ responseData }) => {
      // This is response-time only; `started` is emitted separately in the start handler table.
      const asset = toLegacyAssetFromUnknown(responseData)
      actions.map.setMapStyles.completed(asset)
      actions.resources.updateAsset.completed(asset)
    },
  },
  {
    endpoint: `POST ${endpoints.ASSETS_URL}`,
    refluxAction: 'actions.resources.createResource.completed | actions.resources.cloneAsset.completed',
    matches: ({ pathname, responseData }) => pathname === endpoints.ASSETS_URL && isRecord(responseData),
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
    endpoint: `DELETE ${endpoints.ASSET_URL}`,
    refluxAction: 'actions.resources.deleteAsset.completed',
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
    endpoint: 'POST /api/v2/imports/',
    refluxAction: 'actions.resources.createImport.completed',
    matches: ({ pathname, responseData }) => pathname === '/api/v2/imports/' && isRecord(responseData),
    run: ({ responseData }) => {
      actions.resources.createImport.completed(responseData)
    },
  },
  {
    endpoint: `POST ${endpoints.ASSET_DEPLOYMENT_URL}`,
    refluxAction: 'actions.resources.deployAsset.completed',
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
    // PATCH /deployment/ handles two cases: with `version_id` it is a redeploy,
    // without it it flips which deployment is active.
    endpoint: `PATCH ${endpoints.ASSET_DEPLOYMENT_URL}`,
    refluxAction: 'actions.resources.deployAsset.completed (redeployment)',
    matches: ({ deploymentAssetUid, responseData, requestBody }) =>
      Boolean(
        deploymentAssetUid && requestBody && 'version_id' in requestBody && getLegacyDeploymentAsset(responseData),
      ),
    run: ({ responseData }) => {
      const asset = getLegacyDeploymentAsset(responseData)
      if (!asset) {
        return
      }

      actions.resources.deployAsset.completed(asset)
    },
  },
  {
    endpoint: `PATCH ${endpoints.ASSET_DEPLOYMENT_URL}`,
    refluxAction: 'actions.resources.setDeploymentActive.completed',
    matches: ({ deploymentAssetUid, responseData, requestBody }) =>
      Boolean(
        deploymentAssetUid &&
          (!requestBody || !('version_id' in requestBody)) &&
          getLegacyDeploymentAsset(responseData),
      ),
    run: ({ responseData }) => {
      const asset = getLegacyDeploymentAsset(responseData)
      if (!asset) {
        return
      }

      actions.resources.setDeploymentActive.completed(asset)
    },
  },
]
