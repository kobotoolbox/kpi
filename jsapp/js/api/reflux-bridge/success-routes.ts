import { actions } from '#/actions'
import type { Asset } from '#/api/models/asset'
import type { DeploymentResponse } from '#/api/models/deploymentResponse'
import type { AssetResponse } from '#/dataInterface'
import type { BridgeSuccessRoute } from './shared'
import { isRecord, toLegacyAsset } from './shared'

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
    matches: ({ assetUid, responseData }) => Boolean(assetUid && isRecord(responseData)),
    run: ({ responseData }) => {
      actions.resources.updateAsset.completed(toLegacyAsset(responseData as unknown as Asset | AssetResponse))
    },
  },
  {
    endpoint: 'PATCH /api/v2/assets/:uid/',
    refluxAction: 'actions.reports.setStyle.completed',
    method: 'PATCH',
    matches: ({ assetUid, responseData, requestBody }) =>
      Boolean(assetUid && isRecord(responseData) && requestBody && 'report_styles' in requestBody),
    run: ({ responseData }) => {
      const asset = toLegacyAsset(responseData as unknown as Asset | AssetResponse)
      actions.reports.setStyle.completed(asset)
    },
  },
  {
    endpoint: 'PATCH /api/v2/assets/:uid/',
    refluxAction: 'actions.reports.setCustom.completed',
    method: 'PATCH',
    matches: ({ assetUid, responseData, requestBody }) =>
      Boolean(assetUid && isRecord(responseData) && requestBody && 'report_custom' in requestBody),
    run: ({ responseData }) => {
      const asset = toLegacyAsset(responseData as unknown as Asset | AssetResponse)
      actions.reports.setCustom.completed(asset)
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
      const asset = toLegacyAsset(responseData as unknown as Asset | AssetResponse)
      actions.map.setMapStyles.completed(asset)
    },
  },
  {
    endpoint: 'POST /api/v2/assets/',
    refluxAction: 'actions.resources.createResource.completed | actions.resources.cloneAsset.completed',
    method: 'POST',
    matches: ({ pathname, responseData }) => pathname === '/api/v2/assets/' && isRecord(responseData),
    run: ({ responseData, requestBody }) => {
      // Same endpoint powers both create and clone, so keep the branch here.
      const legacyAsset = toLegacyAsset(responseData as unknown as Asset | AssetResponse)

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
        actions.resources.deleteAsset.completed({ uid: assetUid, assetType: '' })
      }
    },
  },
  {
    endpoint: 'POST /api/v2/assets/:uid/deployment/',
    refluxAction: 'actions.resources.deployAsset.completed',
    method: 'POST',
    matches: ({ deploymentAssetUid, responseData }) => Boolean(deploymentAssetUid && isRecord(responseData)),
    run: ({ responseData }) => {
      const deployment = responseData as unknown as DeploymentResponse
      actions.resources.deployAsset.completed(toLegacyAsset(deployment.asset))
    },
  },
  {
    endpoint: 'PATCH /api/v2/assets/:uid/deployment/',
    refluxAction: 'actions.resources.setDeploymentActive.completed',
    method: 'PATCH',
    matches: ({ deploymentAssetUid, responseData }) => Boolean(deploymentAssetUid && isRecord(responseData)),
    run: ({ responseData }) => {
      const deployment = responseData as unknown as DeploymentResponse
      actions.resources.setDeploymentActive.completed(toLegacyAsset(deployment.asset))
    },
  },
]
