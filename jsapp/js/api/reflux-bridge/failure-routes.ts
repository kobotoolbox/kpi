import { actions } from '#/actions'
import type { BridgeFailureRoute } from './shared'

/**
 * Response-time failure routes. Keep this table focused on legacy `*.failed` callbacks.
 */
export const BRIDGE_FAILURE_ROUTES: ReadonlyArray<BridgeFailureRoute> = [
  {
    endpoint: 'PATCH /api/v2/assets/:uid/',
    refluxAction: 'actions.resources.updateAsset.failed',
    method: 'PATCH',
    matches: ({ assetUid }) => Boolean(assetUid),
    run: ({ legacyFailurePayload }) => {
      actions.resources.updateAsset.failed(legacyFailurePayload as never)
    },
  },
  {
    endpoint: 'PATCH /api/v2/assets/:uid/',
    refluxAction: 'actions.reports.setStyle.failed',
    method: 'PATCH',
    matches: ({ assetUid, requestBody }) => Boolean(assetUid && requestBody && 'report_styles' in requestBody),
    run: ({ legacyFailurePayload }) => {
      actions.reports.setStyle.failed(legacyFailurePayload as never)
    },
  },
  {
    endpoint: 'PATCH /api/v2/assets/:uid/',
    refluxAction: 'actions.reports.setCustom.failed',
    method: 'PATCH',
    matches: ({ assetUid, requestBody }) => Boolean(assetUid && requestBody && 'report_custom' in requestBody),
    run: ({ legacyFailurePayload }) => {
      actions.reports.setCustom.failed(legacyFailurePayload as never)
    },
  },
  {
    endpoint: 'PATCH /api/v2/assets/:uid/',
    refluxAction: 'actions.map.setMapStyles.failed',
    method: 'PATCH',
    matches: ({ assetUid, requestBody }) => Boolean(assetUid && requestBody && 'map_styles' in requestBody),
    run: ({ legacyFailurePayload }) => {
      actions.map.setMapStyles.failed(legacyFailurePayload as never)
    },
  },
  {
    endpoint: 'POST /api/v2/assets/',
    refluxAction: 'actions.resources.createResource.failed | actions.resources.cloneAsset.failed',
    method: 'POST',
    matches: ({ pathname }) => pathname === '/api/v2/assets/',
    run: ({ requestBody, legacyFailurePayload }) => {
      // Same endpoint powers both create and clone, so branch by request body.
      if (typeof requestBody?.clone_from === 'string' && requestBody.clone_from.length > 0) {
        actions.resources.cloneAsset.failed(legacyFailurePayload as never)
        return
      }

      actions.resources.createResource.failed(legacyFailurePayload as never)
    },
  },
  {
    endpoint: 'DELETE /api/v2/assets/:uid/',
    refluxAction: 'actions.resources.deleteAsset.failed',
    method: 'DELETE',
    matches: ({ assetUid }) => Boolean(assetUid),
    run: ({ assetUid }) => {
      if (assetUid) {
        // DELETE failures only have the path UID to go on.
        actions.resources.deleteAsset.failed({ uid: assetUid, assetType: '' } as never)
      }
    },
  },
  {
    endpoint: 'POST /api/v2/assets/:uid/deployment/',
    refluxAction: 'actions.resources.deployAsset.failed',
    method: 'POST',
    matches: ({ deploymentAssetUid }) => Boolean(deploymentAssetUid),
    run: ({ legacyFailurePayload }) => {
      actions.resources.deployAsset.failed(legacyFailurePayload as never)
    },
  },
  {
    endpoint: 'PATCH /api/v2/assets/:uid/deployment/',
    refluxAction: 'actions.resources.setDeploymentActive.failed',
    method: 'PATCH',
    matches: ({ deploymentAssetUid }) => Boolean(deploymentAssetUid),
    run: ({ legacyFailurePayload }) => {
      actions.resources.setDeploymentActive.failed(legacyFailurePayload as never)
    },
  },
]
